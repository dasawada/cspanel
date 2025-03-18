// netlify/functions/googleSheetProxyBatch.js
const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    // 從前端傳來的 JSON 取得 sheetId 與 ranges 陣列
    const { sheetId, ranges } = JSON.parse(event.body);
    
    // 從環境變數中取得 API Key（這裡使用已設置好的 GSHEET_API_KEY）
    const apiKey = process.env.GSHEET_API_KEY;
    if (!apiKey) {
      throw new Error("缺少 GSHEET_API_KEY 環境變數");
    }
    
    // 組合多個範圍的查詢字串，格式例如：ranges=Sheet1!A:K&ranges=Sheet2!A:K
    const rangesQuery = ranges.map(range => `ranges=${encodeURIComponent(range)}`).join('&');
    
    // 建立 batchGet 請求的 URL
    const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${rangesQuery}&key=${apiKey}`;
    
    // 發送 GET 請求
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    
    const result = await response.json();
    
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" // 如有需要，可限制來源
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
