// 允許 OPTIONS 預檢請求
exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            },
            body: "",
        };
    }
const fetch = require('node-fetch');

exports.handler = async (event) => {
    const query = event.queryStringParameters.query || '';
    const apiKey = process.env.GSHEET_API_KEY;  // ✅ 直接使用 Netlify 環境變數
    const spreadsheetId = process.env.GOOGLE_SHEET_VVZM_ID;

    const ranges = [
        '「US版Zoom學員名單(5/15)」!A:K',
        '「騰訊會議(長週期)」!A:K',
        '「騰訊會議(短週期)」!A:K'
    ];

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=${ranges.join('&ranges=')}&key=${apiKey}`;

    try {
        // 1️⃣ 向 Google Sheets API 發送請求
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Google API error: ${response.status}`);
        const data = await response.json();

        // 2️⃣ 過濾符合查詢條件的會議
        let filteredMeetings = [];
        data.valueRanges.forEach(sheetData => {
            const rows = sheetData.values || [];
            const matchingMeetings = rows.filter(row => row[0] && row[0].toLowerCase().includes(query.toLowerCase()));
            filteredMeetings = filteredMeetings.concat(matchingMeetings);
        });

        // 3️⃣ 回應請求並確保 CORS header 存在
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            },
            body: JSON.stringify(filteredMeetings),
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            },
            body: JSON.stringify({ error: error.message }),
        };
    }
};
