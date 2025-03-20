exports.handler = async (event) => {
  // 先用動態 import 載入 fetch
  const { default: fetch } = await import('node-fetch');

  // 處理 preflight
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

  try {
    const { url } = JSON.parse(event.body);
    const resp = await fetch('https://api.reurl.cc/shorten', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'reurl-api-key': process.env.REURL_API_KEY,
      },
      body: JSON.stringify({ url }),
    });
    const data = await resp.json();

    return {
      statusCode: data.res === 'success' ? 200 : 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ res: 'error', message: err.message }),
    };
  }
};
