// 可由全域變數覆寫 API Base，例如：
//   window.CSPANEL_API_BASE = 'https://your-worker.example.workers.dev';
// 預設為現有 Netlify Functions 路徑
let API_BASE = (typeof window !== 'undefined' && window.CSPANEL_API_BASE)
  ? String(window.CSPANEL_API_BASE).replace(/\/+$/,'')
  : 'https://sheetread.jimmychienwada.cc';

// 備援機制的三層路由
const API_ENDPOINTS = [
  'https://sheetread.jimmychienwada.cc',  // 第一優先
  'https://google-sheet-worker.yuusuke-hamasaki.workers.dev',  // 第二優先
  'https://stirring-pothos-28253d.netlify.app/.netlify/functions'  // 最後退回Netlify
];

export function setApiBase(base) {
  API_BASE = String(base || '').replace(/\/+$/,'');
}

function apiUrl(path, baseUrl = API_BASE) {
  if (baseUrl.includes('netlify')) {
    // Netlify使用不同的路徑結構，需要在函數名稱前加上適當的前綴
    return `${baseUrl}/${path}`;
  }
  return `${baseUrl}/${path}`;
}

/**
 * 嘗試呼叫API，具備fallback機制
 * @param {string} endpoint API端點路徑
 * @param {Object} requestOptions fetch請求選項
 * @returns {Promise} 回傳fetch response
 */
async function fetchWithFallback(endpoint, requestOptions) {
  for (let i = 0; i < API_ENDPOINTS.length; i++) {
    const baseUrl = API_ENDPOINTS[i];
    const isNetlify = baseUrl.includes('netlify');
    
    try {
      let url;
      let finalRequestOptions = { ...requestOptions };
      
      if (isNetlify) {
        // Netlify Functions 的特殊處理
        url = apiUrl(endpoint, baseUrl);
        // Netlify 可能需要不同的請求格式或標頭
        finalRequestOptions.headers = {
          ...finalRequestOptions.headers,
          // 可以添加 Netlify 特定的標頭
        };
      } else {
        // Worker 端點的處理
        url = apiUrl(endpoint, baseUrl);
      }
      
      const response = await fetch(url, finalRequestOptions);
      
      if (response.ok) {
        console.log(`Successfully connected to ${baseUrl}`);
        return response;
      }
      
      // 如果不是最後一個端點，繼續嘗試下一個
      if (i < API_ENDPOINTS.length - 1) {
        console.warn(`API endpoint ${baseUrl} failed with status ${response.status}, trying next endpoint...`);
        continue;
      } else {
        // 最後一個端點也失敗了，拋出錯誤
        const errorText = await response.text();
        throw new Error(`All API endpoints failed. Last error: HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      // 如果不是最後一個端點，繼續嘗試下一個
      if (i < API_ENDPOINTS.length - 1) {
        console.warn(`API endpoint ${baseUrl} failed with error:`, error.message, 'trying next endpoint...');
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