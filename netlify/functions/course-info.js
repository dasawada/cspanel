const fetch = require('node-fetch');

exports.handler = async (event) => {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return { 
      statusCode: 405, 
      headers,
      body: 'Method Not Allowed' 
    };
  }

  try {
    // 你原本的邏輯，這裡改用 query string 取得 courseId
    const courseId = event.queryStringParameters && event.queryStringParameters.courseId;
    if (!courseId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing courseId' }) };
    }
    const jwt = process.env.ONE_CLUB_JWT;
    // 查課程
    const courseResp = await fetch(`https://api-new.oneclass.co/mms/course/UseAggregate/${courseId}`, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Authorization': jwt
      }
    });
    const courseJson = await courseResp.json();
    if (courseJson.status !== 'success') {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Course API failed', detail: courseJson }) };
    }
    const courseData = courseJson.data;
    // 查家長
    let parentJson = null;
    if (courseData.students && courseData.students.length > 0) {
      const parentOneClubId = courseData.students[0].parentOneClubId;
      if (parentOneClubId) {
        const parentResp = await fetch(`https://api.oneclass.co/staff/customers/${parentOneClubId}`, {
          headers: { 'Accept': 'application/json, text/plain, */*' }
        });
        parentJson = await parentResp.json();
      }
    }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ course: courseJson, parent: parentJson })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};