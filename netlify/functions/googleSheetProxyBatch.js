// netlify/functions/googleSheetProxyBatch.js

const allowedOrigins = [
  'https://dasawada.github.io',
  'http://127.0.0.1:5500',
  'http://localhost:5500'
];

const corsHeaders = origin => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400'
});

let fetchModule;

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  
  // Validate origin
  if (!allowedOrigins.includes(origin)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Origin not allowed' })
    };
  }

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(origin),
      body: ''
    };
  }

  try {
    // Dynamically import node-fetch if not already imported
    if (!fetchModule) {
      fetchModule = await import('node-fetch');
    }
    const fetch = fetchModule.default;

    const { ranges } = JSON.parse(event.body);
    if (!ranges || !Array.isArray(ranges)) {
      throw new Error("缺少 ranges 參數或格式不正確");
    }

    const sheetId = process.env.GOOGLE_SHEET_VVZM_ID;
    if (!sheetId) {
      throw new Error("缺少 GOOGLE_SHEET_VVZM_ID 環境變數");
    }

    const apiKey = process.env.GSHEET_API_KEY;
    if (!apiKey) {
      throw new Error("缺少 GSHEET_API_KEY 環境變數");
    }

    const rangesQuery = ranges.map(range => `ranges=${encodeURIComponent(range)}`).join('&');
    const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${rangesQuery}&key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    const result = await response.json();

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(origin),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error("批次讀取失敗:", error);
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders(origin),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        error: error.message,
        details: error.code === 'ERR_REQUIRE_ESM' ? 'Node-fetch import error' : 'Request failed'
      })
    };
  }
};