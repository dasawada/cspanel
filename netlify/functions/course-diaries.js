const fetch = require('node-fetch');

exports.handler = async (event) => {
  // CORS 處理
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Allow': 'GET, OPTIONS',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const courseId = event.queryStringParameters.courseId;
  const jwt = process.env.ONE_CLUB_JWT; // 建議設在環境變數

  if (!jwt) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing ONE_CLUB_JWT' }) };
  }
  if (!courseId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing courseId' }) };
  }

  try {
    const resp = await fetch(`https://api-new.oneclass.co/mms/course/${courseId}/diaries`, {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await resp.json();
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};