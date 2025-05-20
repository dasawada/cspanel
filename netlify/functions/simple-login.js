exports.handler = async (event) => {
  // 只允許 POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
      headers: { 'Allow': 'POST' }
    };
  }

  let password;
  try {
    const body = JSON.parse(event.body || '{}');
    password = body.password;
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON' })
    };
  }

  // 驗證密碼
  if (password === process.env.GIVE_ME_MONEY) {
    // 產生一個簡單 token（正式環境建議用 JWT）
    const token = Buffer.from(Date.now() + ':' + password).toString('base64');
    return {
      statusCode: 200,
      body: JSON.stringify({ token })
    };
  } else {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }
};