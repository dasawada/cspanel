// netlify/functions/googleSheetProxyBatch.js
const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    const { ranges } = JSON.parse(event.body);
    if (!ranges || !Array.isArray(ranges)) {
      throw new Error("缺少 ranges 參數或格式不正確");
    }

    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) {
      throw new Error("缺少 GOOGLE_SHEET_ID 環境變數");
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
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error("批次讀取失敗:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message })
    };
  }
};
