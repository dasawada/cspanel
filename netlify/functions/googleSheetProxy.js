exports.handler = async (event) => {
  try {
    console.log("[googleSheetProxy] 進入函數，HTTP 方法：", event.httpMethod);

    // 🟢 處理 CORS 預檢請求
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

    // 🟢 確保請求有內容
    if (!event.body || event.body.trim() === "") {
      throw new Error("請求中沒有提供 body 資料");
    }

    const { range, method = "GET", payload, mapRequest, lat, lon } = JSON.parse(event.body);
    const apiKey = process.env.GSHEET_API_KEY;

    if (!apiKey) {
      throw new Error("缺少 GSHEET_API_KEY 環境變數");
    }

    // 🟢 **處理 Google Maps API 請求**
    if (mapRequest) {
      console.log("[googleSheetProxy] Google Maps API 請求：", { lat, lon });

      if (!lat || !lon) {
        throw new Error("缺少 lat 和 lon 參數");
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

    // 🟢 **處理 Google Sheets API 請求**
    if (!range) {
      throw new Error("缺少 range 參數");
    }

    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) {
      throw new Error("缺少 GOOGLE_SHEET_ID 環境變數");
    }

    console.log("[googleSheetProxy] Google Sheets API 請求：", { range, method });

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
    console.error("[googleSheetProxy] 錯誤：", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message })
    };
  }
};
