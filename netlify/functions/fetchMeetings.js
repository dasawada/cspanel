const fetch = require('node-fetch');

exports.handler = async (event) => {
    const query = event.queryStringParameters.query || '';
    const apiKey = process.env.GSHEET_API_KEY;
    const spreadsheetId = process.env.GOOGLE_SHEET_VVZM_ID;

    const ranges = [
        '「US版Zoom學員名單(5/15)」!A:K',
        '「騰訊會議(長週期)」!A:K',
        '「騰訊會議(短週期)」!A:K'
    ];

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=${ranges.join('&ranges=')}&key=${apiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Google API error: ${response.status}`);
        const data = await response.json();

        let filteredMeetings = [];
        data.valueRanges.forEach(sheetData => {
            const rows = sheetData.values || [];
            const matchingMeetings = rows.filter(row => row[0] && row[0].toLowerCase().includes(query.toLowerCase()));
            filteredMeetings = filteredMeetings.concat(matchingMeetings);
        });

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify(filteredMeetings),
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: error.message }),
        };
    }
};
