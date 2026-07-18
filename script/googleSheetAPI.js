import { getCspanelApiBase, normalizeApiBase } from './cspanel-api.js';
import { authFetch, readApiError } from './auth-fetch.js';

let API_BASE_OVERRIDE = null;

export function setApiBase(base) {
  API_BASE_OVERRIDE = normalizeApiBase(base) || null;
}

function buildGoogleSheetUrl(baseUrl, endpoint) {
  const normalizedBase = normalizeApiBase(baseUrl);
  if (!normalizedBase) return '';
  if (normalizedBase.endsWith('/.netlify/functions')) {
    return `${normalizedBase}/${endpoint}`;
  }
  return `${normalizedBase}/.netlify/functions/${endpoint}`;
}

function getGoogleSheetEndpointUrl(endpoint) {
  const primaryBase = API_BASE_OVERRIDE || getCspanelApiBase();
  return buildGoogleSheetUrl(primaryBase, endpoint);
}

async function fetchGoogleSheetEndpoint(endpoint, requestOptions) {
  const response = await authFetch(getGoogleSheetEndpointUrl(endpoint), requestOptions);
  if (!response.ok) {
    const apiError = await readApiError(response);
    const requestSuffix = apiError.requestId ? `（requestId: ${apiError.requestId}）` : '';
    const error = new Error(`[${apiError.code}] ${apiError.message}${requestSuffix}`);
    error.code = apiError.code;
    error.requestId = apiError.requestId;
    error.status = apiError.status;
    throw error;
  }
  return response;
}

/**
 * 單一範圍讀取 Google Sheets 的資料（透過本站受保護代理）
 * @param {Object} options
 *   - range: 讀取的範圍字串，例如 "Sheet1!A:K"
 *   - method: 相容參數，只允許 "GET" 語意
 *   - payload: 相容參數，必須為 null
 * @returns {Promise} 回傳解析後的 JSON 資料
 */
export async function callGoogleSheetAPI({ range, method = "GET", payload = null }) {
  if (String(method).toUpperCase() !== 'GET' || payload != null) {
    throw new Error('Google Sheet config proxy 只允許唯讀查詢');
  }
  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose: 'config', range })
  };

  const response = await fetchGoogleSheetEndpoint('googleSheetProxy', requestOptions);
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
    // mapRequest 暫留作 classic caller-first handshake；purpose 是 Edge 終態 authority。
    body: JSON.stringify({ purpose: 'map', mapRequest: true, lat, lon })
  };

  const response = await fetchGoogleSheetEndpoint('googleSheetProxy', requestOptions);
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

  const response = await fetchGoogleSheetEndpoint('googleSheetProxyBatch', requestOptions);
  return response.json();
}
