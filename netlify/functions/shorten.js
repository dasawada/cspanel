const fetch = require('node-fetch');

exports.handler = async (event) => {
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
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(data),
  };
};
