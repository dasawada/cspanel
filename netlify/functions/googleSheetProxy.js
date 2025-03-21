// googleSheetProxy.js
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

    // 確保請求有提供 body 資料
    if (!event.body || event.body.trim() === "") {
      throw new Error("請求中沒有提供 body 資料");
    }

    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (err) {
      throw new Error("無法解析 JSON 格式的請求 body");
    }

    // 檢查是否為 Google Maps 請求
    if (requestBody.mapRequest) {
      const { lat, lon } = requestBody;
      if (!lat || !lon) {
        throw new Error("缺少必要的參數：lat 和 lon");
      }
      // 從環境變數中取得 API 金鑰
      const apiKey = process.env.GSHEET_API_KEY;
      if (!apiKey) {
        throw new Error("缺少 GSHEET_API_KEY 環境變數");
      }
      // 組合 Google Maps 嵌入連結
      const googleMapsUrl = https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${lat},${lon}&zoom=11&maptype=roadmap;
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({ embedUrl: googleMapsUrl })
      };
    }

    // 處理 Google Sheets API 請求
    const { range, method = "GET", payload } = requestBody;
    if (!range) {
      throw new Error("缺少必要的參數：range");
    }

    // 從環境變數中取得 Spreadsheet ID 與 API 金鑰
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) {
      throw new Error("缺少 GOOGLE_SHEET_ID 環境變數");
    }
    const apiKey = process.env.GSHEET_API_KEY;
    if (!apiKey) {
      throw new Error("缺少 GSHEET_API_KEY 環境變數");
    }

    // 動態引入 node-fetch (ESM)
    const { default: fetch } = await import("node-fetch");

    // 組合 Google Sheets API 的 endpoint
    const endpoint = https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey};
    const options = {
      method: method.toUpperCase(),
      headers: { "Content-Type": "application/json" },
      // 僅在 POST 請求時傳送 payload
      body: method.toUpperCase() === "POST" ? JSON.stringify(payload) : null
    };

    const response = await fetch(endpoint, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(Google API 回應錯誤: ${response.status} - ${errorText});
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
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};