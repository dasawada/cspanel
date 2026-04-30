import {
  DEFAULT_CSPANEL_API_BASE,
  getCspanelApiBase,
  normalizeApiBase
} from './cspanel-api.js';

let API_BASE_OVERRIDE = null;

const GOOGLE_SHEET_FALLBACK_BASES = [
  'https://sheetread.jimmychienwada.cc/.netlify/functions',
  'https://google-sheet-worker.yuusuke-hamasaki.workers.dev'
];

export function setApiBase(base) {
  API_BASE_OVERRIDE = normalizeApiBase(base) || null;
}

function buildGoogleSheetUrl(baseUrl, endpoint) {
  const normalizedBase = normalizeApiBase(baseUrl);
  if (!normalizedBase) return '';
  if (normalizedBase.endsWith('/.netlify/functions') || normalizedBase.includes('workers.dev')) {
    return `${normalizedBase}/${endpoint}`;
  }
  return `${normalizedBase}/.netlify/functions/${endpoint}`;
}

function getGoogleSheetEndpointUrls(endpoint) {
  const primaryBase = API_BASE_OVERRIDE || getCspanelApiBase();
  const bases = [
    primaryBase,
    DEFAULT_CSPANEL_API_BASE,
    ...GOOGLE_SHEET_FALLBACK_BASES
  ];

  return [...new Set(bases.map((baseUrl) => buildGoogleSheetUrl(baseUrl, endpoint)).filter(Boolean))];
}

/**
 * 嘗試呼叫API，具備fallback機制
 * @param {string} endpoint API端點路徑
 * @param {Object} requestOptions fetch請求選項
 * @returns {Promise} 回傳fetch response
 */
async function fetchWithFallback(endpoint, requestOptions) {
  const endpointUrls = getGoogleSheetEndpointUrls(endpoint);

  for (let i = 0; i < endpointUrls.length; i++) {
    const url = endpointUrls[i];

    try {
      const response = await fetch(url, requestOptions);
      
      if (response.ok) {
        console.log(`Successfully connected to ${url}`);
        return response;
      }
      
      // 如果不是最後一個端點，繼續嘗試下一個
      if (i < endpointUrls.length - 1) {
        console.warn(`API endpoint ${url} failed with status ${response.status}, trying next endpoint...`);
        continue;
      } else {
        // 最後一個端點也失敗了，拋出錯誤
        const errorText = await response.text();
        throw new Error(`All API endpoints failed. Last error: HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      // 如果不是最後一個端點，繼續嘗試下一個
      if (i < endpointUrls.length - 1) {
        console.warn(`API endpoint ${url} failed with error:`, error.message, 'trying next endpoint...');
        continue;
      } else {
        // 最後一個端點也失敗了，拋出錯誤
        throw new Error(`All API endpoints failed. Last error: ${error.message}`);
      }
    }
  }
}

/**
 * 單一範圍讀取 Google Sheets 的資料（透過代理，具備fallback機制）
 * @param {Object} options
 *   - range: 讀取的範圍字串，例如 "Sheet1!A:K"
 *   - method: 請求方法，預設 "GET"
 *   - payload: 若為 POST 請求，傳送的資料
 * @returns {Promise} 回傳解析後的 JSON 資料
 */
export async function callGoogleSheetAPI({ range, method = "GET", payload = null }) {
  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ range, method, payload })
  };

  const response = await fetchWithFallback('googleSheetProxy', requestOptions);
  return response.json();
}

/**
 * 讀取 Google Maps 嵌入 URL（透過代理，具備fallback機制）
 * @param {Object} options
 *   - lat: 緯度
 *   - lon: 經度
 * @returns {Promise} 回傳解析後的 JSON 資料，內容包含 embedUrl 屬性
 */
export async function callGoogleMapsAPI({ lat, lon }) {
  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mapRequest: true, lat, lon })
  };

  const response = await fetchWithFallback('googleSheetProxy', requestOptions);
  return response.json();
}

/**
 * 批次讀取多個範圍（Google Sheets API 的 batchGet），具備fallback機制
 * @param {Object} options
 *   - ranges: 陣列，例如 [ "Sheet1!A:K", "Sheet2!A:K" ]
 * @returns {Promise} 回傳解析後的 JSON 資料（結果在 result.valueRanges 中）
 */
export async function callGoogleSheetBatchAPI({ ranges }) {
  const requestOptions = {
    method: "POST",
    headers: { 
      "Content-Type": "application/json"
    },
    mode: 'cors',
    body: JSON.stringify({ ranges })
  };

  const response = await fetchWithFallback('googleSheetProxyBatch', requestOptions);
  return response.json();
}
