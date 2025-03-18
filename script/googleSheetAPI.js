// js/googleSheetAPI.js

/**
 * 單一範圍讀取 Google Sheets 的資料（透過 Netlify Function 代理）
 * @param {Object} options
 *   - sheetId: Spreadsheet ID
 *   - range: 讀取的範圍字串，例如 "Sheet1!A:K"
 *   - method: 請求方法，預設 "GET"
 *   - payload: 若為 POST 請求，傳送的資料
 * @returns {Promise} 回傳解析後的 JSON 資料
 */
export async function callGoogleSheetAPI({ sheetId, range, method = "GET", payload = null }) {
  const proxyUrl = "https://stirring-pothos-28253d.netlify.app/.netlify/functions/googleSheetProxy";
  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheetId, range, method, payload })
  });
  return response.json();
}

/**
 * 批次讀取多個範圍（Google Sheets API 的 batchGet），
 * 前提是你已新增 Netlify Function 檔案：netlify/functions/googleSheetProxyBatch.js
 * @param {Object} options
 *   - sheetId: Spreadsheet ID
 *   - ranges: 陣列，例如 [ "Sheet1!A:K", "Sheet2!A:K" ]
 * @returns {Promise} 回傳解析後的 JSON 資料（結果在 result.valueRanges 中）
 */
export async function callGoogleSheetBatchAPI({ sheetId, ranges }) {
  const proxyUrl = "https://stirring-pothos-28253d.netlify.app/.netlify/functions/googleSheetProxyBatch";
  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheetId, ranges })
  });
  return response.json();
}
