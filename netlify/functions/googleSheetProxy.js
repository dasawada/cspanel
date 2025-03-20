exports.handler = async (event) => {
  try {
    // 處理 CORS 預檢請求
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
        },
        body: ""
      };
    }

    if (!event.body || event.body.trim() === "") {
      throw new Error("請求中沒有提供 body 資料");
    }

    const { range, method = "GET", payload, mapRequest, lat, lon } = JSON.parse(event.body);

    // 直接從環境變數中取得 API Key
    const apiKey = process.env.GSHEET_API_KEY;
    if (!apiKey) {
      throw new Error("缺少 GSHEET_API_KEY 環境變數");
    }

    // 處理 Google Maps API 請求
    if (mapRequest) {
      if (!lat || !lon) {
        throw new Error("缺少必要的參數：lat 和 lon");
      }
      const googleMapsURL = `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${lat},${lon}&zoom=11&maptype=roadmap`;

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ embedUrl: googleMapsURL })
      };
    }

    // 處理 Google Sheets API 請求
    if (!range) {
      throw new Error("缺少必要的參數：range");
    }

    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) {
      throw new Error("缺少 GOOGLE_SHEET_ID 環境變數");
    }

    // 動態引入 node-fetch（ESM）
    const { default: fetch } = await import("node-fetch");

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
