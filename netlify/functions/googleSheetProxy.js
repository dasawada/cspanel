// netlify/functions/googleSheetProxy.js

exports.handler = async (event) => {
  try {
    // 用動態 import() 來取得 node-fetch 的預設匯出
    const { default: fetch } = await import("node-fetch");

    if (!event.body) {
      throw new Error("請求中沒有提供 body 資料");
    }
    const { sheetId, range, method = "GET", payload } = JSON.parse(event.body);

    if (!sheetId || !range) {
      throw new Error("缺少必要的參數：sheetId 或 range");
    }

    const apiKey = process.env.GSHEET_API_KEY;
    if (!apiKey) {
      throw new Error("缺少 GSHEET_API_KEY 環境變數");
    }

    const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify(payload) : null
    });

    if (!response.ok) {
      throw new Error(`Google API 回應錯誤: ${response.status} - ${await response.text()}`);
    }

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
    console.error("GoogleSheet Proxy Error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message })
    };
  }
};
