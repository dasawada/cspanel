// Deno 環境下，使用 Web Crypto API 和原生 fetch

// Helper to read env in Deno
const env = (key) => Deno.env.get(key);

// ===== Firebase Admin 替代方案 =====
// 由於 firebase-admin 無法在 Deno 運行，需要用 Firebase REST API 驗證 token
async function verifyFirebaseToken(idToken) {
  const projectId = env('FIREBASE_PROJECT_ID');
  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID not set');
  }
  
  const apiKey = env('FIREBASE_WEB_API_KEY');
  if (!apiKey) {
    throw new Error('FIREBASE_WEB_API_KEY not set');
  }
  
  // 使用 Firebase Auth REST API 驗證 token
  const response = await fetch(
    `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Token verification failed');
  }
  
  const data = await response.json();
  if (!data.users || data.users.length === 0) {
    throw new Error('Invalid token');
  }
  
  return {
    uid: data.users[0].localId,
    email: data.users[0].email,
    emailVerified: data.users[0].emailVerified,
  };
}

// ===== AES 加密 (使用 Web Crypto API 替代 CryptoJS) =====
function utf8ToBytes(str) {
  return new TextEncoder().encode(str);
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// CryptoJS 相容的 AES 加密 (OpenSSL 格式)
async function aesEncrypt(plaintext, passphrase) {
  // 生成隨機 salt
  const salt = crypto.getRandomValues(new Uint8Array(8));
  
  // 使用 PBKDF 派生 key 和 iv (CryptoJS 預設使用 MD5，這裡用簡化版本)
  const keyMaterial = await deriveKeyAndIV(passphrase, salt);
  const key = keyMaterial.slice(0, 32);
  const iv = keyMaterial.slice(32, 48);
  
  // 導入 key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  );
  
  // 加密
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    utf8ToBytes(plaintext)
  );
  
  // 組合成 OpenSSL 格式: "Salted__" + salt + ciphertext
  const prefix = utf8ToBytes('Salted__');
  const result = new Uint8Array(prefix.length + salt.length + encrypted.byteLength);
  result.set(prefix, 0);
  result.set(salt, prefix.length);
  result.set(new Uint8Array(encrypted), prefix.length + salt.length);
  
  return bytesToBase64(result);
}

// 簡化的 key 派生 (模擬 CryptoJS 的 EVP_BytesToKey)
async function deriveKeyAndIV(passphrase, salt) {
  const passphraseBytes = utf8ToBytes(passphrase);
  const result = new Uint8Array(48); // 32 bytes key + 16 bytes iv
  let prevHash = new Uint8Array(0);
  let offset = 0;
  
  while (offset < 48) {
    const data = new Uint8Array(prevHash.length + passphraseBytes.length + salt.length);
    data.set(prevHash, 0);
    data.set(passphraseBytes, prevHash.length);
    data.set(salt, prevHash.length + passphraseBytes.length);
    
    const hash = await crypto.subtle.digest('MD5', data);
    prevHash = new Uint8Array(hash);
    
    const copyLength = Math.min(prevHash.length, 48 - offset);
    result.set(prevHash.slice(0, copyLength), offset);
    offset += copyLength;
  }
  
  return result;
}

// ===== qs.stringify 替代方案 =====
function qsStringify(obj) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  }
  return params.toString();
}

// Alias map
const aliasMap = (() => {
  const raw = env('ALIAS_MAP');
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
})();

function resolveAlias(decoded) {
  const email = decoded?.email;
  return email ? aliasMap[email] || null : null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  let parsedBody;
  try {
    const bodyText = await request.text();
    if (!bodyText) {
      return json({ success: false, error: 'Request body is missing.' }, 400);
    }
    parsedBody = JSON.parse(bodyText);
  } catch (e) {
    console.error('JSON Parsing Error:', e.message);
    return json({ success: false, error: 'Malformed JSON in request body.' }, 400);
  }

  try {
    const { token, action, data } = parsedBody;

    if (!token) return json({ success: false, error: 'Firebase token is missing in request.' }, 401);
    if (!action) return json({ success: false, error: 'Action is missing in request.' }, 400);

    const decodedToken = await verifyFirebaseToken(token);

    let result;
    switch (action) {
      case 'searchBitrixContact':
        result = await searchBitrixContact(data);
        break;
      case 'searchBitrixContactAdvanced':
        result = await searchBitrixContactAdvanced(data);
        break;
      case 'getJwtToken':
        result = await getJwtToken();
        break;
      case 'getCourseInfo':
        result = await getCourseInfo(data);
        break;
      case 'verifyCourseIds':
        result = await verifyCourseIds(data);
        break;
      case 'getParentInfo':
        result = await getParentInfo(data);
        break;
      case 'fetchCompleteClassInfo':
        result = await fetchCompleteClassInfo(data);
        break;
      case 'checkAndProcessCourseInfo': {
        const alias = resolveAlias(decodedToken);
        const processedCourseData = await checkAndProcessCourseInfo({ ...data, alias });
        result = { success: true, data: processedCourseData };
        break;
      }
      default:
        return json({ success: false, error: 'Invalid action provided.' }, 400);
    }

    return json(result, 200);
  } catch (error) {
    console.error('Handler Execution Error:', error.message, error.stack ? error.stack : error);
    if (error.message && error.message.includes('TOKEN')) {
      return json({ success: false, error: `Authentication error: ${error.message}` }, 401);
    }
    return json({ success: false, error: 'Internal server error. Please check server logs for more details.' }, 500);
  }
}

// ===== 修正 JWT Token 取得函數 =====
async function getJwtToken() {
  try {
    const envToken = env('ONE_CLUB_JWT');
    if (envToken && envToken.trim() !== '') {
      return { success: true, data: { token: envToken } };
    }

    const coffeeshopListUrl =
      env('COFFEESHOP_LIST_FUNCTION_URL') ||
      'https://stirring-pothos-28253d.netlify.app/.netlify/functions/coffeeshoplist';

    const response = await fetch(coffeeshopListUrl);
    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Could not retrieve error body');
      throw new Error(`Failed to fetch token from coffeeshoplist. Status: ${response.status}. Resp: ${errorBody}`);
    }

    const result = await response.json();
    if (!result || typeof result.token !== 'string' || result.token.trim() === '') {
      throw new Error('Invalid or empty token received from coffeeshoplist.');
    }
    return { success: true, data: { token: result.token } };
  } catch (error) {
    console.error('getJwtToken error:', error.message, error.stack ? error.stack : error);
    return { success: false, error: `JWT token fetch failed: ${error.message}` };
  }
}

// ===== fetch with timeout & retry 工具 =====
async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(url, options = {}, timeoutMs = 3000, maxRetry = 3, intervalMs = 300) {
  let lastError;
  for (let i = 0; i < maxRetry; i++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      if (response.ok) return response;
      lastError = new Error('Response not ok');
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error');
    }
    if (i < maxRetry - 1) await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw lastError;
}

// ===== OneBoard URL 產生器 =====
async function generateOneBoardUrl({ courseId, userId, userName, role = 'advisor', classType = 'sync-single' }) {
  const SECRET = env('ONEBOARD_SECRET');
  const BASE = env('ONEBOARD_BASE_URL') || 'https://oneboard.oneclass.com.tw';

  const payloadObj = { role, userId, userName, autoRecord: 'false' };
  const payloadStr = JSON.stringify(qsStringify(payloadObj));
  const token = await aesEncrypt(payloadStr, SECRET);
  const encToken = encodeURIComponent(token);

  const pathSegment = role === 'observer' ? 'observer' : 'setup';
  const baseQuery = `autoRecord=false&classType=${classType}&role=${role}&token=${encToken}`;
  const extraQuery =
    role === 'observer'
      ? `&userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`
      : '';

  return `${BASE}/${courseId}/${pathSegment}?${baseQuery}${extraQuery}`;
}

// ===== Bitrix 相關 API =====
async function searchBitrixContact(data) {
  const { phone } = data || {};
  const bitrixUrl = env('BITRIX_WEBHOOK_URL');
  if (!bitrixUrl) return { success: false, error: 'BITRIX_WEBHOOK_URL not set' };

  try {
    const response = await fetch(`${bitrixUrl}/crm.contact.list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: { PHONE: phone },
        select: ['ID', 'NAME', 'LAST_NAME', 'PHONE', 'EMAIL', 'UF_CRM_1688023476'],
      }),
    });
    const result = await response.json();
    return { success: true, data: result };
  } catch (error) {
    console.error('Bitrix search error:', error);
    return { success: false, error: 'Contact search failed' };
  }
}

// ===== 新增：進階 Bitrix 搜尋（包含多格式電話號碼） =====
async function searchBitrixContactAdvanced(data) {
  const { phone } = data || {};
  const bitrixUrl = env('BITRIX_WEBHOOK_URL');
  if (!bitrixUrl) return { success: false, error: 'BITRIX_WEBHOOK_URL not set' };

  try {
    const phoneFormats = generatePhoneFormats(phone);
    const allResults = new Map();

    for (const formattedPhone of phoneFormats) {
      let retryCount = 0;
      while (retryCount < 3) {
        try {
          const response = await fetch(`${bitrixUrl}/crm.contact.list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filter: { PHONE: formattedPhone },
              select: ['ID', 'NAME', 'LAST_NAME', 'PHONE', 'EMAIL'],
              start: 0,
            }),
          });

          if (!response.ok) throw new Error('Network response was not ok');

          const result = await response.json();
          if (result?.result?.length) {
            result.result.forEach((contact) => {
              if (!allResults.has(contact.ID)) allResults.set(contact.ID, contact);
            });
          }
          break;
        } catch (err) {
          retryCount++;
          if (retryCount === 3) console.error('搜尋失敗:', err);
          else await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    const results = Array.from(allResults.values());
    return {
      success: true,
      data: {
        result: results,
        total: results.length,
        searchFormats: phoneFormats,
      },
    };
  } catch (error) {
    console.error('Advanced Bitrix search error:', error);
    return { success: false, error: 'Advanced contact search failed' };
  }
}

// 電話格式生成函數
function generatePhoneFormats(phone = '') {
  const rawPhone = String(phone).replace(/\D/g, '');
  return [
    rawPhone,
    rawPhone.replace(/(\d{4})(\d{3})(\d{3})/, '$1-$2-$3'),
    rawPhone.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3'),
  ].filter(Boolean);
}

// ===== OneClass 相關 API =====
async function getCourseInfo(data = {}) {
  const { courseId } = data;
  const apiUrl = 'https://api-new.oneclass.co/mms/course/UseAggregate';
  try {
    const jwtResult = await getJwtToken();
    if (!jwtResult.success) throw new Error('Failed to get JWT token');
    const response = await fetchWithRetry(
      `${apiUrl}/${courseId}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: jwtResult.data.token,
        },
      },
      3000,
      3,
      300
    );
    const result = await response.json();
    return { success: true, data: result };
  } catch (error) {
    console.error('Course info error:', error);
    return { success: false, error: 'Course info fetch failed' };
  }
}

async function verifyCourseIds(data = {}) {
  const { courseIds = [] } = data;
  const apiUrl = 'https://api-new.oneclass.co/mms/course/UseAggregate';
  try {
    const jwtResult = await getJwtToken();
    if (!jwtResult.success) throw new Error('Failed to get JWT token');
    const verificationPromises = courseIds.map((id) =>
      fetchWithRetry(
        `${apiUrl}/${id}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: jwtResult.data.token,
          },
        },
        3000,
        3,
        300
      )
        .then((response) => response.json())
        .then((d) => (d && d.status === 'success' ? { id, valid: true } : { id, valid: false }))
        .catch(() => ({ id, valid: false }))
    );
    const results = await Promise.all(verificationPromises);
    return { success: true, data: results };
  } catch (error) {
    console.error('Course verification error:', error);
    return { success: false, error: 'Course verification failed' };
  }
}

async function getParentInfo(data = {}) {
  const { parentOneClubId } = data;
  const parentApiUrl = 'https://api.oneclass.co/staff/customers/';
  try {
    const response = await fetchWithRetry(`${parentApiUrl}${parentOneClubId}`, {}, 3000, 3, 300);
    const result = await response.json();
    return { success: true, data: result };
  } catch (error) {
    console.error('Parent info error:', error);
    return { success: false, error: 'Parent info fetch failed' };
  }
}

// ===== 完整課程資訊查詢 =====
async function fetchCompleteClassInfo(data = {}) {
  const { courseId } = data;

  try {
    const courseResult = await getCourseInfo({ courseId });
    if (!courseResult.success || courseResult.data.status !== 'success') {
      throw new Error('查詢失敗');
    }

    const courseData = courseResult.data.data;
    const students = courseData.students || [];
    const teacher = courseData.teacher || {};

    const typeLabels = {
      individualLiveCourse: '（家教）',
      individualLearningBarPlusCourse: '（學霸）',
      groupLiveCourse: '（家教團）',
      individualTutorialCenterPlusCourse: '（補教）',
      groupTutorialCenterPlusCourse: '（補教團）',
      groupLearningBarPlusCourse: '（學霸團）',
    };

    let contactId = '#';
    let studentInfo = '(無資料)';
    let tutorName = '(無資料)';

    if (students.length > 0) {
      const student = students[0];
      const parentResult = await getParentInfo({ parentOneClubId: student.parentOneClubId });

      if (parentResult.success && parentResult.data?.data) {
        contactId = parentResult.data.data.contactId || '#';
        const bxButton = `<a href="https://oneclass.bitrix24.com/crm/contact/details/${contactId}/" target="_blank" rel="noopener noreferrer" style="display:inline-block; background-color:#0078D7; color:white; padding:1px 5px; border-radius:15px; cursor:pointer; font-size: 10px; text-decoration:none;">${contactId}</a>`;
        studentInfo = `<strong>${student.name}</strong> (${student.parentOneClubId}) ${bxButton}`;
        tutorName = parentResult.data.data.tutor?.name || '(無資料)';
      }
    }

    const typeLabel = courseData.isAudition ? '（試聽）' : typeLabels[courseData.type] || '（不明）';
    const dateRange = formatCustomDateRange(courseData.startAt, courseData.endAt) + typeLabel;

    const completeInfo = {
      dateRange,
      studentInfo,
      teacher: {
        fullName: teacher.fullName,
        oneClubId: teacher.oneClubId,
        mobile: teacher.mobile,
      },
      tutorName,
      contactId,
      rawData: { courseData, students },
    };

    return { success: true, data: completeInfo };
  } catch (error) {
    console.error('Complete class info fetch failed:', error);
    return { success: false, error: error.message || 'Complete class info fetch failed' };
  }
}

// Helper function to generate HTML for class info
function generateClassInfoHtml(info) {
  if (!info) {
    return '<p style="color:orange;">未找到課程詳細資訊。</p>';
  }
  const teacherFullName = info.teacher?.fullName || '(無資料)';
  const teacherOneClubId = info.teacher?.oneClubId || 'N/A';
  const teacherMobile = info.teacher?.mobile ? `0${info.teacher.mobile}` : 'N/A';
  const tutorName = info.tutorName || '(無資料)';

  return `
        <div class="class-info-header">${info.dateRange || '(日期無資料)'}</div>
        <div class="class-info-row">
            學生：${info.studentInfo || '(無資料)'}
        </div>
        <div class="class-info-row">
            老師：<strong>${teacherFullName}</strong> (ID：${teacherOneClubId})
        </div>
        <div class="class-info-row class-info-footer">
            <div class="class-info-flex">
                <div>師電：${teacherMobile}</div>
                <div>輔導：<strong>${tutorName}</strong></div>
            </div>
        </div>
    `;
}

// ===== 課程檢查與處理邏輯 (Modified) =====
async function checkAndProcessCourseInfo(data = {}) {
  const { content } = data;
  try {
    function extractCourseId(input) {
      const match = String(input || '').match(/([0-9a-fA-F]{24})/);
      return match ? [match[0]] : [];
    }

    let courseIds = extractCourseId(content);

    if (courseIds.length === 0) {
      const message = '非課程ID/教室ID，將改為搜尋客戶列表';
      return {
        html: `<p style="color:red;">${message}</p>`,
        redirectUrl: `https://oneclub.backstage.oneclass.com.tw/customer/customerlist/${content}`,
      };
    }

    const finalCourseIdToFetch = courseIds[0];
    const courseInfoResult = await fetchCompleteClassInfo({ courseId: finalCourseIdToFetch });

    if (courseInfoResult && courseInfoResult.success && courseInfoResult.data) {
      const html = generateClassInfoHtml(courseInfoResult.data);
      const groupTypes = ['groupLiveCourse', 'groupTutorialCenterPlusCourse', 'groupLearningBarPlusCourse'];
      const courseType = courseInfoResult.data.rawData.courseData.type;
      const classType = groupTypes.includes(courseType) ? 'sync-multiple' : 'sync-single';

      if (!data.alias) {
        return { html };
      }

      const boardUrlAdvisor = await generateOneBoardUrl({
        courseId: finalCourseIdToFetch,
        userId: data.alias,
        userName: '顧問',
        role: 'advisor',
        classType,
      });

      const boardUrlObserver = await generateOneBoardUrl({
        courseId: finalCourseIdToFetch,
        userId: data.alias,
        userName: '觀察者',
        role: 'observer',
        classType,
      });
      const boardButtonAdvisor = `<a href="${boardUrlAdvisor}" target="_blank" style="display:inline-block;margin-left:4px;background:#28a745;color:#fff;padding:1px 5px;border-radius:12px;font-size:10px;text-decoration:none;">顧問</a>`;
      const boardButtonObserver = `<a href="${boardUrlObserver}" target="_blank" style="display:inline-block;margin-left:4px;background:#17a2b8;color:#fff;padding:1px 5px;border-radius:12px;font-size:10px;text-decoration:none;">觀察者</a>`;

      let htmlWithBtn = html.replace(
        /(<div class="class-info-header">[^<]+<\/div>)/,
        '$1 ' + boardButtonAdvisor + ' ' + boardButtonObserver
      );
      if (htmlWithBtn === html) {
        htmlWithBtn =
          html + '<div style="margin-top:4px;">' + boardButtonAdvisor + ' ' + boardButtonObserver + '</div>';
      }
      return { html: htmlWithBtn };
    } else {
      const errorMessage =
        (courseInfoResult && courseInfoResult.error) ||
        `無法獲取課程ID ${finalCourseIdToFetch} 的詳細資訊。`;
      return { html: `<p style="color:red;">${errorMessage}</p>` };
    }
  } catch (error) {
    console.error('Critical Error in checkAndProcessCourseInfo:', error.message, error.stack);
    throw error;
  }
}

// ===== 時間格式化函數 =====
function formatCustomDateRange(startIso, endIso) {
  if (!startIso) return '(無資料)';

  const wMap = {
    週日: '(日)',
    週一: '(一)',
    週二: '(二)',
    週三: '(三)',
    週四: '(四)',
    週五: '(五)',
    週六: '(六)',
  };

  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;

  const optionsDate = {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  };
  const optionsTime = {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  };

  const dateFormatter = new Intl.DateTimeFormat('zh-TW', optionsDate);
  const timeFormatter = new Intl.DateTimeFormat('zh-TW', optionsTime);

  const startParts = dateFormatter.formatToParts(start);
  const sYear = startParts.find((x) => x.type === 'year').value;
  const sMonth = startParts.find((x) => x.type === 'month').value.padStart(2, '0');
  const sDay = startParts.find((x) => x.type === 'day').value.padStart(2, '0');
  const sWeekday = startParts.find((x) => x.type === 'weekday').value;
  const sWeekAbbr = wMap[sWeekday] || '';
  const sTime = timeFormatter.format(start);

  let eTime = '';
  if (end) eTime = timeFormatter.format(end);

  return `${sYear}-${sMonth}-${sDay} ${sWeekAbbr} ${sTime} - ${eTime}`;
}

// JSON response helper
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}