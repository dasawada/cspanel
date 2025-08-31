/**
 * Netlify Function: 學BAR學生搜尋
 * GET /.netlify/functions/search2b?name=xxx
 * POST body: { name }
 */

const fetch = require('node-fetch');

function err(code, message) {
  return { success: false, error: code, message };
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  let name;
  // 支援 /search2b/:value 路徑
  const pathMatch = event.path.match(/^\/\.netlify\/functions\/search2b\/(.+)$/);
  if (pathMatch && pathMatch[1]) {
    name = decodeURIComponent(pathMatch[1]);
  } else if (event.httpMethod === 'GET') {
    const url = new URL(event.rawUrl || `http://localhost${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`);
    name = url.searchParams.get('name');
  } else if (event.httpMethod === 'POST' && event.body) {
    try {
      const bodyObj = JSON.parse(event.body);
      name = bodyObj.name;
    } catch {}
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify(err('MISSING_NAME', '請輸入學生姓名'))
    };
  }

  const token = process.env.ONE_CLUB_JWT && String(process.env.ONE_CLUB_JWT).trim();
  if (!token) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(err('MISSING_JWT', 'JWT token 未設定'))
    };
  }

  const apiUrl = `https://api.oneclass.co/staff/customers?skip=0&limit=50&oneClubId=Barf&type=learningBar&paidMember=true&name=${encodeURIComponent(name)}`;
  try {
    const res = await fetch(apiUrl, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`API 狀態 ${res.status}`);
    const result = await res.json();
    if (result.status !== 'success' || !result.data?.customers) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify(err('NOT_FOUND', '查無學生資料'))
      };
    }

    const studentsArr = result.data.customers.map(c => `${c.name}（${c.oneClubId}）`);
    const students = studentsArr.join('＆');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        students,
        count: result.data.customers.length,
        TutorGroup: "T2",
        tutorName: "學BAR",
        searchType: "studentSearch2B"
      })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(err('INTERNAL_ERROR', e?.message || 'API 錯誤'))
    };
  }
};