// netlify/functions/googleSheetProxy.js
exports.handler = async (event) => {
  try {
    // 動態引入 node-fetch，並取得預設匯出
    const { default: fetch } = await import("node-fetch");
    
    const { sheetId, range, method = "GET", payload } = JSON.parse(event.body);
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
