// 可由全域變數覆寫 API Base，例如：
//   window.CSPANEL_API_BASE = 'https://your-worker.example.workers.dev';
// 預設為現有 Netlify Functions 路徑
let API_BASE = (typeof window !== 'undefined' && window.CSPANEL_API_BASE)
  ? String(window.CSPANEL_API_BASE).replace(/\/+$/,'')
  : 'https://sheetread.jimmychienwada.cc';

export function setApiBase(base) {
  API_BASE = String(base || '').replace(/\/+$/,'');
}
function apiUrl(path) {
  return `${API_BASE}/${path}`;
}

/**
 * 單一範圍讀取 Google Sheets 的資料（透過 Netlify Function 代理）
 * @param {Object} options
 *   - range: 讀取的範圍字串，例如 "Sheet1!A:K"
 *   - method: 請求方法，預設 "GET"
 *   - payload: 若為 POST 請求，傳送的資料
 * @returns {Promise} 回傳解析後的 JSON 資料
 */
export async function callGoogleSheetAPI({ range, method = "GET", payload = null }) {
  const proxyUrl = apiUrl('googleSheetProxy');
  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ range, method, payload })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  return response.json();
}

/**
 * 讀取 Google Maps 嵌入 URL（透過 Netlify Function 代理）
 * @param {Object} options
 *   - lat: 緯度
 *   - lon: 經度
 * @returns {Promise} 回傳解析後的 JSON 資料，內容包含 embedUrl 屬性
 */
export async function callGoogleMapsAPI({ lat, lon }) {
  const proxyUrl = apiUrl('googleSheetProxy');
  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mapRequest: true, lat, lon })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  return response.json();
}

/**
 * 批次讀取多個範圍（Google Sheets API 的 batchGet）
 * @param {Object} options
 *   - ranges: 陣列，例如 [ "Sheet1!A:K", "Sheet2!A:K" ]
 * @returns {Promise} 回傳解析後的 JSON 資料（結果在 result.valueRanges 中）
 */
export async function callGoogleSheetBatchAPI({ ranges }) {
  const proxyUrl = apiUrl('googleSheetProxyBatch');
  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json"
    },
    mode: 'cors',
    body: JSON.stringify({ ranges })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  return response.json();
}