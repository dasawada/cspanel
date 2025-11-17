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

// 硬編碼 tutor 與 group 的對應關係
function getTutorGroup(tutor) {
  if (!tutor) return null;
  const tutorTrimmed = tutor.trim();
  
  // 輔導固定為 "行政"
  if (tutorTrimmed === '輔導') {
    return '行政';
  }
  
  // 其他 tutor 的 group 留空
  return null;
}

// 新增：處理課程物件的 group 欄位
function processCourseGroup(course, useTutorApi) {
  if (!useTutorApi && course && course.tutor) {
    course.group = getTutorGroup(course.tutor);
  }
  return course;
}

// 新增：處理課程陣列的 group 欄位
function processCoursesGroup(courses, useTutorApi) {
  if (!courses) return courses;
  
  if (Array.isArray(courses)) {
    return courses.map(course => processCourseGroup(course, useTutorApi));
  }
  
  // 處理 preparingCourses 的結構 (可能有 data 陣列)
  if (courses.data && Array.isArray(courses.data)) {
    courses.data = courses.data.map(course => processCourseGroup(course, useTutorApi));
  }
  
  return courses;
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
  const jwt = Deno.env.get('ONE_CLUB_JWT');
  const useTutorApi = Deno.env.get('USE_TUTOR_API') === 'true'; // 新增開關，預設為 false
  
  if (!jwt) {
    return new Response(JSON.stringify({ 
      error: 'Missing environment variables',
      details: {
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

  const startTime = Date.now(); // 記錄開始時間

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

      // 處理單一課程的 group
      processCourseGroup(courseData, useTutorApi);

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
      
      // 處理準備中課程陣列的 group
      preparingCourses = processCoursesGroup(preparingJson, useTutorApi);
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
      preparingCourses
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (err) {
    console.log(`Request took ${Date.now() - startTime} ms`); // 記錄耗時
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