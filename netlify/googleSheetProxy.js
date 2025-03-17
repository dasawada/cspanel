// netlify/functions/googleSheetProxy.js
const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    // 前端會傳來必要的參數（例如 sheetId、range 或其他）
    const { sheetId, range, method = "GET", payload } = JSON.parse(event.body);
    const apiKey = process.env.GSHEET_API_KEY; // 從環境變數讀取

    const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify(payload) : null
    });
    const result = await response.json();
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" // 根據需要限制來源
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message })
    };
  }
};
