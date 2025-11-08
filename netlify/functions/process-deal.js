/* 集中處理：
   - Bitrix 交易資訊（備註、聯絡人、訂單連結）
   - OneClass 訂單/Quotation
   - 顧問組別 Google Sheet
   - OneClub 客戶搜尋與 Tutor 查詢（為 ocidSelect 提供 options 與 tutor 名稱對應）
   回傳已完成欄位的 sheet、students、links、notes、ocidOptions、selectedOneClubId、tutorLookup
*/
const TEAM_SHEET_SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '15TsK4mB_zfH6SGqTvUe1AOYzwQfE90Z8gN1Gf5tiYLU';
const TEAM_SHEET_RANGE = process.env.TEAM_SHEET_RANGE || 'wtf';
const GOOGLE_API_KEY = process.env.GSHEET_API_KEY; // 必填
const BITRIX_WEBHOOK_BASE = process.env.DEAL_BITRIX_WEBHOOK_BASE;
const SITE_URL = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.SITE_URL || '';
const ONECLASS_BASE = 'https://api.oneclass.co/product/open';

const EDUCATION_MAP = { K: '幼稚園', E: '國小', J: '國中', H: '高中' };

const admin = require('firebase-admin');

// 初始化 Firebase Admin SDK（僅一次）
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // 處理換行符
      project_id: process.env.FIREBASE_PROJECT_ID,
    }),
  });
}

function json(resObj, status = 200) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    body: JSON.stringify(resObj),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({}, 200);
  try {
    // 新增：驗證 Firebase ID Token
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ status: 'error', message: '缺少有效的 Firebase ID Token' }, 401);
    }
    const idToken = authHeader.split(' ')[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      return json({ status: 'error', message: 'Firebase ID Token 無效或過期' }, 401);
    }
    // Token 有效，可選：使用 decodedToken.uid 等進行進一步檢查（例如，檢查用戶權限）

    const dealId = (event.queryStringParameters?.dealId || '').trim().replace(/[^A-Za-z0-9]/g, '');
    if (!dealId) return json({ status: 'error', message: '缺少有效 dealId' }, 400);
    if (!BITRIX_WEBHOOK_BASE) return json({ status: 'error', message: '後端未配置 BITRIX_WEBHOOK_BASE' }, 500);
    if (!GOOGLE_API_KEY) return json({ status: 'error', message: '後端未配置 GOOGLE_API_KEY' }, 500);

    // 1) Bitrix 交易
    const bitrixUrl = `${BITRIX_WEBHOOK_BASE}/crm.deal.get?ID=${dealId}`;
    const bitrixRes = await fetch(bitrixUrl);
    if (!bitrixRes.ok) throw new Error(`Bitrix 查詢失敗: ${bitrixRes.status}`);
    const bitrixJson = await bitrixRes.json();
    if (bitrixJson.error) throw new Error(`Bitrix API: ${bitrixJson.error_description}`);
    const dealData = bitrixJson.result || {};

    const notes = dealData.UF_CRM_1646312993 ? String(dealData.UF_CRM_1646312993).replace(/\r\n/g, '\n') : '無備註';
    const contactId = dealData.CONTACT_ID || '';
    const contactLink = contactId ? `https://oneclass.bitrix24.com/crm/contact/details/${contactId}/` : '';
    const dealLink = `https://oneclass.bitrix24.com/crm/deal/details/${dealId}/`;

    const link1 = dealData.UF_CRM_1646313465 || '';
    const link2 = dealData.UF_CRM_1646313701 || '';
    const orderLinks = [link1, link2].filter(Boolean);
    const activeOrderLink = orderLinks[0] || null;

    const orderIdMatch = activeOrderLink ? activeOrderLink.match(/order\/(\w+)/) : null;
    const activeOrderId = orderIdMatch ? orderIdMatch[1] : '';

    // 2) OneClass 訂單
    let order = null;
    if (activeOrderId) {
      const orderApi = `${ONECLASS_BASE}/orders/${activeOrderId}/`;
      const orderRes = await fetch(orderApi);
      if (!orderRes.ok) throw new Error(`OneClass 訂單 API 錯誤: ${orderRes.status}`);
      const orderJson = await orderRes.json();
      order = orderJson.data || null;
    }

    // 學制（從商品 plan.name 推斷）
    let contractSchoolType = '';
    if (order?.commodities?.length) {
      for (const commodity of order.commodities) {
        const name = commodity?.plan?.name || '';
        if (name.includes('國小')) { contractSchoolType = '國小'; break; }
        if (name.includes('國中')) { contractSchoolType = '國中'; break; }
        if (name.includes('高中')) { contractSchoolType = '高中'; break; }
      }
    }

    // 學生資料
    const students = (order?.students || []).map(s => ({
      name: s.name,
      education: s.education, // K/E/J/H
      grade: s.grade          // '1'..'6' etc.
    }));

    // 3) 顧問組別（Google Sheet）
    async function fetchTeamSheetData() {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${TEAM_SHEET_SPREADSHEET_ID}/values/${encodeURIComponent(TEAM_SHEET_RANGE)}?key=${GOOGLE_API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`顧問組別 GoogleSheet API 錯誤: ${res.status}`);
      const data = await res.json();
      return data.values || [];
    }
    function findTeamCodeForConsultant(name, sheet) {
      if (!name || !sheet) return '';
      const key = name.replace(/\s+/g, '').toLowerCase();
      for (let r = 0; r < sheet.length; r++) {
        for (let c = 0; c < sheet[r].length; c++) {
          const cell = (sheet[r][c] || '').replace(/\s+/g, '').toLowerCase();
          if (cell === key) {
            if (sheet[2] && sheet[2][c]) return sheet[2][c];
          }
        }
      }
      return '';
    }

    let advisorName = '';
    if (order?.managers?.length) advisorName = order.managers[0]?.name || '';
    let colE = advisorName || '';
    if (advisorName) {
      try {
        const teamSheet = await fetchTeamSheetData();
        const teamStr = findTeamCodeForConsultant(advisorName, teamSheet);
        if (teamStr) {
          const trimmed = teamStr.replace(/^TEAM/i, '');
          colE = `${trimmed}組-${advisorName}`;
        }
      } catch (e) {
        // 忽略顧問組別查詢失敗
      }
    }

    // 4) Quotation 整理（複製前端規則）
    function extractQuantity(productName, desc) {
      const qtyRegex = /x\s*(\d+)/i;
      const m = productName.match(qtyRegex) || desc.match(qtyRegex);
      return m ? m[1] : '';
    }
    function generatePackageOutput(desc, productName, quantity) {
      if (desc.includes('團課') || desc.includes('團體課')) {
        return '團課堂' + quantity;
      }
      const minRegex = /(\d+)\s*mins/i;
      const m = productName.match(minRegex);
      const minutes = m ? m[1] : '';
      return minutes ? `${quantity}(${minutes}mins)` : quantity;
    }
    function generateOutput(category, productName, desc, quantity) {
      if (category.includes('配套')) return generatePackageOutput(desc, productName, quantity);
      return quantity;
    }
    function categorizeOutput(category, output, productNames, activityItems, packageItems, activityCategories) {
      if (category.includes('OC+TN') || category.includes('OC+N')) {
        productNames.push(output);
      } else if (category.includes('配套')) {
        packageItems.push(output);
      } else if (activityCategories.includes(category) || category.includes('活動商品')) {
        activityItems.push(output);
      } else {
        productNames.push(output);
      }
    }
    function formatQuotationData(dataArray) {
      const productNames = [];
      const activityItems = [];
      const packageItems = [];
      const activityCategories = ['', '贈品'];
      (dataArray || []).forEach(item => {
        const category = item[1] || '';
        const productName = item[2] || '';
        const desc = item[3] || '';
        if (category === '贈品' && (productName.includes('講義') || desc.includes('講義'))) return;
        if (category.includes('講義')) return;
        const quantity = extractQuantity(productName, desc);
        if (!quantity) return;
        const output = generateOutput(category, productName, desc, quantity);
        categorizeOutput(category, output, productNames, activityItems, packageItems, activityCategories);
      });
      return [...productNames, ...activityItems, ...packageItems].join('+');
    }

    let iMerged = contractSchoolType || '';
    if (activeOrderId) {
      const qRes = await fetch(`${ONECLASS_BASE}/orders/${activeOrderId}/quotation`);
      if (!qRes.ok) throw new Error(`Quotation API 錯誤: ${qRes.status}`);
      const qJson = await qRes.json();
      const formatted = formatQuotationData(qJson.data || []);
      if (formatted) iMerged = `${iMerged}${formatted}`;
    }

    // 5) OneClub：客戶搜尋與 Tutor
    const customerName = order?.customerInfo?.name || '';
    let ocidOptions = [];
    if (customerName && SITE_URL) {
      try {
        const ocidRes = await fetch(`${SITE_URL}/.netlify/functions/oneclub-customers?name=${encodeURIComponent(customerName)}`);
        if (ocidRes.ok) {
          const ocidJson = await ocidRes.json();
          ocidOptions = (ocidJson.data?.customers || []).map(c => ({ oneClubId: c.oneClubId, name: c.name }));
        }
      } catch (_) {}
    }
    const selectedOneClubId = ocidOptions[0]?.oneClubId || '';

    // 為 ocidOptions 全部預抓 tutor 對應（供前端切換不再發請求）
    const tutorLookup = {};
    if (SITE_URL && ocidOptions.length) {
      await Promise.all(
        ocidOptions.map(async (c) => {
          try {
            const tRes = await fetch(`${SITE_URL}/.netlify/functions/oneclub-tutor?oneClubId=${encodeURIComponent(c.oneClubId)}`);
            if (!tRes.ok) return;
            const tJson = await tRes.json();
            const name = tJson?.data?.tutor?.name || '';
            if (name) tutorLookup[c.oneClubId] = name;
          } catch (_) {}
        })
      );
    }
    const tutorName = selectedOneClubId ? (tutorLookup[selectedOneClubId] || '') : '';

    // 6) 填表欄位
    const sheet = {
      colA: order?.payAt
        ? new Date(parseInt(order.payAt, 10)).toLocaleDateString('en-US', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit' })
        : '',
      colB: `#${String(order?.crmNo || '') === dealId ? String(order?.crmNo || '') : `${dealId}【需核對】`}`,
      colC: contactLink,
      colD: '',
      colE: colE,
      colF: (order?.students || []).map(s => s.name).join('＆'),
      colG: customerName,
      colH: '',
      colI: iMerged,
      colJ: '',
      colK: tutorName || '',
      colL: '',
      colM: order?.amt || '',
    };

    return json({
      status: 'success',
      data: {
        sheet,
        notes,
        links: {
          dealLink,
          contactLink,
          orderLinks,
        },
        orderId: activeOrderId,
        students,
        ocidOptions,
        selectedOneClubId,
        tutorLookup,
      },
    });
  } catch (err) {
    return json({ status: 'error', message: err.message }, 500);
  }
};