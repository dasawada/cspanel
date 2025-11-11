/**
 * Bitrix Deal ID 搜尋功能處理器 (Netlify Functions 版本)
 * GET /.netlify/functions/dealId?dealId=xxxx
 * POST body: { dealId }
 */

const fetch = require('node-fetch');

// Bitrix Webhook URL - 從環境變數讀取
const BITRIX_WEBHOOK_URL = process.env.BITRIX24_WEBHOOK_URL;

// CacheManager: 直接用 API 取得 tutor group，並做記憶體快取
let _tutorGroupCache = null;
let _tutorGroupLast = 0;
async function fetchTutorToGroup() {
  const url = process.env.GROUP_API_URL;
  if (!url) return [];
  if (_tutorGroupCache && Date.now() - _tutorGroupLast < 10 * 60 * 1000) return _tutorGroupCache;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const arr = await r.json();
    _tutorGroupCache = Array.isArray(arr) ? arr : [];
    _tutorGroupLast = Date.now();
    return _tutorGroupCache;
  } catch {
    return [];
  }
}

// fetchWithRetry: 支援重試與超時
async function fetchWithRetry(url, options = {}, maxRetries = 3, timeout = 30000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (!resp.ok && resp.status >= 500 && attempt < maxRetries) {
        await new Promise(res => setTimeout(res, 1000 * attempt));
        continue;
      }
      return resp;
    } catch (err) {
      clearTimeout(timer);
      const shouldRetry = attempt < maxRetries && (
        err.name === 'AbortError' ||
        err.message.includes('QUIC') ||
        err.message.includes('NETWORK_IDLE_TIMEOUT') ||
        err.message.includes('ERR_TIMED_OUT') ||
        err.message.includes('ERR_CONNECTION')
      );
      if (!shouldRetry) throw err;
      await new Promise(res => setTimeout(res, 1000 * attempt));
    }
  }
}

// 批量處理學生資料
async function fetchStudentsInBatches(customers, batchSize = 5) {
  const allStudents = [];
  const tutorInfoMap = new Map();
  for (let i = 0; i < customers.length; i += batchSize) {
    const batch = customers.slice(i, i + batchSize);
    const batchPromises = batch.map(async (customer) => {
      if (!customer.oneClubId) return [];
      let tutorName = null;
      if (customer.tutor && customer.tutor.name) {
        tutorName = customer.tutor.name;
        tutorInfoMap.set(customer.oneClubId, tutorName);
      }
      try {
        const studentApi = `https://api.oneclass.co/staff/customers/${customer.oneClubId}`;
        const studentResp = await fetchWithRetry(studentApi);
        if (studentResp.ok) {
          const studentData = await studentResp.json();
          const students = studentData.data.students || [];
          return students.map(student => ({
            ...student,
            tutorName: tutorName
          }));
        }
      } catch (err) {
        // 可加 log
      }
      return [];
    });
    const batchResults = await Promise.allSettled(batchPromises);
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        allStudents.push(...result.value);
      }
    });
    if (i + batchSize < customers.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  return { allStudents, tutorInfoMap };
}

// Netlify handler
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // 取得 dealId，支援 /dealId/:id 及 ?dealId=xxx
  let dealId;
  if (event.httpMethod === 'GET') {
    // 先從 path 取最後一段
    const segments = event.path.split('/').filter(Boolean);
    dealId = segments.length > 1 ? segments[segments.length - 1] : undefined;
    // 若 query 有 dealId，則覆寫
    const url = new URL(event.rawUrl || `http://localhost${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`);
    if (url.searchParams.get('dealId')) dealId = url.searchParams.get('dealId');
  } else if (event.httpMethod === 'POST' && event.body) {
    try {
      const bodyObj = JSON.parse(event.body);
      dealId = bodyObj.dealId;
    } catch {}
  }

  if (!dealId || dealId === 'search') {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing deal ID' })
    };
  }

  try {
    // 1. 取得 Bitrix deal 資料
    if (!BITRIX_WEBHOOK_URL) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Bitrix webhook URL not configured' })
      };
    }
    
    const bitrixUrl = `${BITRIX_WEBHOOK_URL}/crm.deal.get?ID=${dealId}`;
    const dealResp = await fetchWithRetry(bitrixUrl);
    const dealData = await dealResp.json();

    if (!dealData.result) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Deal not found', dealId })
      };
    }

    const orderLink1 = dealData.result.UF_CRM_1646313465 || "";
    const match = orderLink1.match(/order\/([^\/]+)$/);
    let phone = null, orderNum = null, customerId = null;

    if (match) {
      orderNum = match[1];
      const orderApi = `https://api.oneclass.co/product/open/orders/${orderNum}/`;
      const orderResp = await fetchWithRetry(orderApi);
      if (!orderResp.ok) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Order not found', orderNumber: orderNum })
        };
      }
      const orderData = await orderResp.json();
      customerId = orderData.data.customerId;

      const customerApi = `https://api.oneclass.co/staff/customers/${customerId}`;
      const customerResp = await fetchWithRetry(customerApi);
      if (!customerResp.ok) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Customer not found', customerId })
        };
      }
      const customerData = await customerResp.json();
      phone = customerData.data.phone;
      if (!phone) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Phone number not found', customerId })
        };
      }
    } else {
      const merchantMatch = orderLink1.match(/merchantId=([^&]+)/);
      if (merchantMatch) {
        const merchantId = merchantMatch[1];
        const getOrderUrl = 'https://asia-northeast1-oneclasspay.cloudfunctions.net/getOrder_user';
        const getOrderResp = await fetchWithRetry(getOrderUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ MerchantId: merchantId })
        });
        if (!getOrderResp.ok) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Failed to get order from merchant ID', merchantId, status: getOrderResp.status })
          };
        }
        const getOrderData = await getOrderResp.json();
        if (getOrderData.status !== 'success' || !getOrderData.content || !getOrderData.content.userPhone) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Phone number not found in merchant order data', merchantId, responseData: getOrderData })
          };
        }
        phone = getOrderData.content.userPhone;
      } else {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Order number or merchant ID not found in deal data', orderLink: orderLink1 })
        };
      }
    }

    // 電話號碼格式轉換：+886933351588 -> 0933351588
    if (phone && phone.startsWith('+886') && phone.length === 13) {
      phone = '0' + phone.substring(4);
    }

    // 5. 用 phone 搜尋所有相關客戶
    const phoneSearchApi = `https://api.oneclass.co/staff/customers?skip=0&limit=50&phone=${phone}`;
    const phoneSearchResp = await fetchWithRetry(phoneSearchApi, {
      headers: { 'Authorization': `Bearer ${process.env.ONE_CLUB_JWT}` }
    });
    if (!phoneSearchResp.ok) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Phone search failed', phone })
      };
    }
    const phoneSearchData = await phoneSearchResp.json();

    let customers = [];
    if (phoneSearchData && phoneSearchData.data && Array.isArray(phoneSearchData.data.customers)) {
      customers = phoneSearchData.data.customers;
    } else {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Invalid phone search response format', phone, responseData: phoneSearchData })
      };
    }

    // 收集所有 oneClubId
    const allOneClubIds = customers.filter(c => c.oneClubId).map(c => c.oneClubId);

    // 6. 批量處理學生資料
    const { allStudents, tutorInfoMap } = await fetchStudentsInBatches(customers);

    // 7. 篩選 active 且 school 有內容的學生
    let filtered = allStudents.filter(s => {
      if (s.status !== 'active') return false;
      if (!s.school || typeof s.school !== 'object') return false;
      const schoolValues = Object.values(s.school);
      return schoolValues.some(value => value && typeof value === 'string' && value.trim() !== '');
    });

    if (filtered.length === 0) {
      filtered = allStudents.filter(s => s.status === 'active');
    }

    // 8. 收集所有 tutor 名稱來查找 TutorGroup
    let tutorGroup = '';
    let leaderName = '';
    let leaderGroup = '';
    let finalTutorName = '';
    const tutorNames = filtered.map(s => s.tutorName).filter(tutorName => tutorName && tutorName.trim());

    if (tutorNames.length > 0) {
      try {
        const list = await fetchTutorToGroup();
        for (const tutorName of tutorNames) {
          const found = list.find(item => {
            if (!item.tutor) return false;
            const apiTutor = item.tutor.trim();
            const studentTutor = tutorName.trim();
            if (apiTutor === studentTutor) return true;
            if (studentTutor.length > 1) {
              const studentTutorWithoutSurname = studentTutor.slice(1);
              if (apiTutor === studentTutorWithoutSurname || apiTutor.includes(studentTutorWithoutSurname)) return true;
            }
            if (studentTutor.includes(apiTutor) || apiTutor.includes(studentTutor)) return true;
            return false;
          });
          if (found) {
            tutorGroup = found.group || '';
            if (found.leader && found.leader.trim()) {
              leaderName = found.leader.trim();
              const leaderFound = list.find(l => l.tutor && l.tutor.trim() === leaderName);
              if (leaderFound) {
                leaderGroup = leaderFound.group || '';
                tutorGroup = leaderGroup;
                finalTutorName = leaderName;
              } else {
                finalTutorName = leaderName;
              }
            } else {
              finalTutorName = tutorName;
            }
            break;
          }
        }
      } catch {
        tutorGroup = '';
      }
    }

    // 9. 組合學生名稱格式
    const studentNames = filtered.map(s => s.name);
    const result = studentNames.join('＆');
    if (!finalTutorName) {
      const uniqueTutorNames = [...new Set(tutorNames)];
      finalTutorName = uniqueTutorNames.join('＆');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: !!result, // 有學生資料則 success:true
        students: result,
        count: filtered.length,
        dealId,
        orderNumber: orderNum,
        customerId,
        TutorGroup: tutorGroup,
        tutorName: finalTutorName,
        leaderName,
        leaderGroup,
        phone,
        totalCustomersFound: customers.length,
        oneClubIds: allOneClubIds,
        searchType: 'dealId'
      })
    };

  } catch (error) {
    let errorMessage = 'Search failed';
    let statusCode = 500;
    if (error.name === 'AbortError') {
      errorMessage = 'Request timeout';
      statusCode = 408;
    } else if (error.message && (error.message.includes('QUIC') || error.message.includes('NETWORK'))) {
      errorMessage = 'Network connection error';
      statusCode = 503;
    } else if (error.message && error.message.includes('ERR_NAME_NOT_RESOLVED')) {
      errorMessage = 'DNS resolution failed';
      statusCode = 502;
    }
    return {
      statusCode,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        detail: error.message,
        type: error.name
      })
    };
  }
};