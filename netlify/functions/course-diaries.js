const fetch = require('node-fetch');

exports.handler = async (event) => {
  // CORS 處理
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
    const { courseId } = body;
    const jwt = process.env.ONE_CLUB_JWT;

    if (!jwt) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing ONE_CLUB_JWT' }) };
    }
    if (!courseId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing courseId' }) };
    }

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