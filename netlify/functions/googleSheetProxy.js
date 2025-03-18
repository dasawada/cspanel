exports.handler = async (event) => {
  try {
    if (!event.body || event.body.trim() === "") {
      throw new Error("請求中沒有提供 body 資料");
    }
    
    const { sheetId, range, method = "GET", payload } = JSON.parse(event.body);
    
    // 之後的程式碼……
    // 動態引入 node-fetch
    const { default: fetch } = await import("node-fetch");
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
