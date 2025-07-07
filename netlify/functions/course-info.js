const fetch = require('node-fetch');

const GROUP_API_URL = process.env.GROUP_API_URL;
if (!GROUP_API_URL) {
  throw new Error('Missing GROUP_API_URL environment variable');
}

// ===== fetch with timeout & retry 工具 =====
async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
  ]);
}

async function fetchWithRetry(url, options = {}, timeoutMs = 3000, maxRetry = 3, intervalMs = 300) {
  let lastError;
  for (let i = 0; i < maxRetry; i++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      if (response.ok) return response;
      lastError = new Error('Response not ok');
    } catch (err) {
      lastError = err;
    }
    if (i < maxRetry - 1) await new Promise(r => setTimeout(r, intervalMs));
  }
  throw lastError;
}

// 改寫 fetchWithJwt，加入 retry/timeout
const fetchWithJwt = async (url, jwt, timeoutMs = 3000, maxRetry = 3) => {
  const resp = await fetchWithRetry(
    url,
    {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Authorization': jwt
      }
    },
    timeoutMs,
    maxRetry
  );
  return resp.json();
};

let cachedTutorToGroup = null;
let lastFetchTime = 0;

async function fetchTutorToGroup() {
  // 每10分鐘更新一次
  if (cachedTutorToGroup && Date.now() - lastFetchTime < 10 * 60 * 1000) {
    return cachedTutorToGroup;
  }
  const res = await fetch(GROUP_API_URL);
  const data = await res.json();
  const map = {};
  data.forEach(row => {
    if (row.tutor && row.group) map[row.tutor.trim()] = row.group.trim();
  });
  cachedTutorToGroup = map;
  lastFetchTime = Date.now();
  return map;
}

exports.handler = async (event) => {
  // CORS 處理（如需跨網域呼叫）
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Allow': 'POST, OPTIONS',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { courseId, checkPreparing } = body;
    const jwt = process.env.ONE_CLUB_JWT;
    if (!jwt) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Missing ONE_CLUB_JWT' })
      };
    }

    let courseData = null;
    let parentJson = null;
    if (courseId) {
      // 查課程
      const courseJson = await fetchWithJwt(`https://api-new.oneclass.co/mms/course/UseAggregate/${courseId}`, jwt);
      if (courseJson.status !== 'success') {
        return { statusCode: 500, body: JSON.stringify({ error: 'Course API failed', detail: courseJson }) };
      }
      courseData = courseJson.data;

      // 查家長
      if (courseData.students && courseData.students.length > 0) {
        const parentOneClubId = courseData.students[0].parentOneClubId;
        if (parentOneClubId) {
          const parentResp = await fetch(`https://api.oneclass.co/staff/customers/${parentOneClubId}`, {
            headers: { 'Accept': 'application/json, text/plain, */*' }
          });
          parentJson = await parentResp.json();
        }
      }
    }

    // 查準備中課程
    let preparingCourses = null;
    if (checkPreparing) {
      const params = new URLSearchParams();
      Object.entries(checkPreparing).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v));
        } else {
          params.append(key, value);
        }
      });
      const preparingJson = await fetchWithJwt(`https://api-new.oneclass.co/mms/course/findAllUseAggregate?${params.toString()}`, jwt);
      preparingCourses = preparingJson;
    }

    // 若兩者皆無，回傳錯誤
    if (!courseId && !checkPreparing) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Missing courseId or checkPreparing' })
      };
    }

    // 取得組別對照表
    const tutorToGroupMap = await fetchTutorToGroup();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'success',
        data: courseData,
        parent: parentJson,
        preparingCourses,
        tutorToGroupMap
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: err.message })
    };
  }
};