const GROUP_API_URL = Deno.env.get("GROUP_API_URL");
if (!GROUP_API_URL) {
  throw new Error('Missing GROUP_API_URL environment variable');
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
    if (i < maxRetry - 1) {
      await new Promise(r => setTimeout(r, intervalMs));
    }
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
  data.forEach((row) => {
    if (row.tutor && row.group) map[row.tutor.trim()] = row.group.trim();
  });
  cachedTutorToGroup = map;
  lastFetchTime = Date.now();
  return map;
}

export default async (request, context) => {
  // 統一的 CORS 標頭
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400'
  };

  // 處理 preflight OPTIONS 請求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  // 只允許 POST 請求
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed', method: request.method }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  // 檢查環境變數
  const GROUP_API_URL = Deno.env.get("GROUP_API_URL");
  const jwt = Deno.env.get('ONE_CLUB_JWT');
  
  if (!GROUP_API_URL || !jwt) {
    return new Response(JSON.stringify({ 
      error: 'Missing environment variables',
      details: {
        hasGroupApiUrl: !!GROUP_API_URL,
        hasJwt: !!jwt
      }
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { courseId, checkPreparing } = body;
    
    let courseData = null;
    let parentJson = null;
    
    if (courseId) {
      // 查課程
      const courseJson = await fetchWithJwt(`https://api-new.oneclass.co/mms/course/UseAggregate/${courseId}`, jwt);
      if (courseJson.status !== 'success') {
        return new Response(JSON.stringify({ error: 'Course API failed', detail: courseJson }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      courseData = courseJson.data;

      // 取得組別對照表，並加進 courseData
      const tutorToGroupMap = await fetchTutorToGroup();
      if (courseData.tutor) {
        courseData.group = tutorToGroupMap[courseData.tutor.trim()] || null;
      }

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
          value.forEach((v) => params.append(key, v));
        } else {
          params.append(key, String(value));
        }
      });
      const preparingJson = await fetchWithJwt(`https://api-new.oneclass.co/mms/course/findAllUseAggregate?${params.toString()}`, jwt);
      preparingCourses = preparingJson;
    }

    // 若兩者皆無，回傳錯誤
    if (!courseId && !checkPreparing) {
      return new Response(JSON.stringify({ error: 'Missing courseId or checkPreparing' }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    return new Response(JSON.stringify({
      status: 'success',
      data: courseData,
      parent: parentJson,
      preparingCourses,
      tutorToGroupMap: await fetchTutorToGroup()
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
};