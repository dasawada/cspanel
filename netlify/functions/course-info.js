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
  try {
    console.log('Fetching tutor to group mapping from:', GROUP_API_URL);
    // 每10分鐘更新一次
    if (cachedTutorToGroup && Date.now() - lastFetchTime < 10 * 60 * 1000) {
      console.log('Using cached tutor to group mapping');
      return cachedTutorToGroup;
    }
    
    const res = await fetchWithRetry(GROUP_API_URL, {}, 5000, 3); // 使用 retry 機制
    if (!res.ok) {
      throw new Error(`GROUP_API_URL request failed: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log('Fetched tutor to group data:', data?.length || 0, 'records');
    
    const map = {};
    data.forEach(row => {
      if (row.tutor && row.group) map[row.tutor.trim()] = row.group.trim();
    });
    cachedTutorToGroup = map;
    lastFetchTime = Date.now();
    return map;
  } catch (err) {
    console.error('fetchTutorToGroup error:', err);
    // 如果有舊的快取，返回舊的，否則返回空物件
    return cachedTutorToGroup || {};
  }
}

exports.handler = async (event) => {
  console.log('Function started, method:', event.httpMethod);
  console.log('Environment check - GROUP_API_URL:', !!GROUP_API_URL, 'ONE_CLUB_JWT:', !!process.env.ONE_CLUB_JWT);
  
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
    console.log('Request body:', body);
    
    const { courseId, checkPreparing } = body;
    const jwt = process.env.ONE_CLUB_JWT;
    
    if (!jwt) {
      console.error('Missing ONE_CLUB_JWT environment variable');
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
    let tutorToGroupMap = {}; // 提前宣告，避免重複調用
    
    if (courseId) {
      console.log('Fetching course data for courseId:', courseId);
      try {
        // 查課程
        const courseJson = await fetchWithJwt(`https://api-new.oneclass.co/mms/course/UseAggregate/${courseId}`, jwt);
        console.log('Course API response status:', courseJson?.status);
        
        if (courseJson.status !== 'success') {
          console.error('Course API failed:', courseJson);
          return { 
            statusCode: 500, 
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Course API failed', detail: courseJson }) 
          };
        }
        courseData = courseJson.data;

        // 取得組別對照表，並加進 courseData
        tutorToGroupMap = await fetchTutorToGroup(); // 只調用一次
        if (courseData.tutor) {
          courseData.group = tutorToGroupMap[courseData.tutor.trim()] || null;
          console.log('Assigned group to course:', courseData.group);
        }

        // 查家長
        if (courseData.students && courseData.students.length > 0) {
          const parentOneClubId = courseData.students[0].parentOneClubId;
          if (parentOneClubId) {
            console.log('Fetching parent data for:', parentOneClubId);
            try {
              const parentResp = await fetchWithRetry(`https://api.oneclass.co/staff/customers/${parentOneClubId}`, {
                headers: { 'Accept': 'application/json, text/plain, */*' }
              }, 5000, 3);
              parentJson = await parentResp.json();
            } catch (parentErr) {
              console.error('Parent API error (non-critical):', parentErr);
              // 家長資料錯誤不影響主要功能
            }
          }
        }
      } catch (courseErr) {
        console.error('Course processing error:', courseErr);
        throw courseErr; // 重新拋出錯誤
      }
    } else {
      console.log('No courseId provided, fetching tutorToGroupMap only');
      // 如果沒有 courseId，仍需要取得 tutorToGroupMap
      tutorToGroupMap = await fetchTutorToGroup();
    }

    // 查準備中課程
    let preparingCourses = null;
    if (checkPreparing) {
      console.log('Checking preparing courses with params:', checkPreparing);
      try {
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
        console.log('Preparing courses fetched:', preparingCourses?.data?.length || 0, 'records');
      } catch (prepErr) {
        console.error('Preparing courses error:', prepErr);
        throw prepErr;
      }
    }

    // 若兩者皆無，回傳錯誤
    if (!courseId && !checkPreparing) {
      console.log('Neither courseId nor checkPreparing provided');
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Missing courseId or checkPreparing' })
      };
    }

    console.log('Function completed successfully');
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
        tutorToGroupMap // 直接使用已獲取的變數
      })
    };
  } catch (err) {
    console.error('Course-info handler error:', err);
    console.error('Error stack:', err.stack);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: err.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};