/*  Netlify Function: Proxy to Cloudflare Workers search API
 *  Call example (前端):
 *    fetch('/.netlify/functions/searchidtostudent?keyword=abc')
 *  或 POST:
 *    fetch('/.netlify/functions/searchidtostudent', { method:'POST', body: JSON.stringify({ keyword:'abc' }) })
 */
const DEFAULT_BASE = 'https://aitest.yuusuke-hamasaki.workers.dev/api/search/';

const allowOrigin = process.env.CORS_ALLOW_ORIGIN || '*'; // 可改成你的網域

exports.handler = async (event, context) => {
  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: ''
    };
  }

  try {
    const method = event.httpMethod || 'GET';

    // 遠端基底，可用環境變數覆寫 (e.g. SEARCH_API_BASE)
    const base = (process.env.SEARCH_API_BASE || DEFAULT_BASE).replace(/\/+$/, '/') ;

    // 將本地 query string 直接附加
    const queryString = event.rawQuery ? `?${event.rawQuery}` : '';

    // 若想支援動態子路徑，可解析 event.path；此處固定指向 base
    const targetUrl = base + queryString;

    // 準備 fetch 選項
    const fetchOptions = {
      method,
      headers: filterOutboundHeaders(event.headers),
      redirect: 'follow'
    };

    // 傳遞 body（僅適用可帶 body 的方法）
    if (['POST','PUT','PATCH','DELETE'].includes(method)) {
      fetchOptions.body = event.body && (event.isBase64Encoded
        ? Buffer.from(event.body, 'base64')
        : event.body);
    }

    // Node 18+ 內建 fetch；若舊 runtime 需安裝 node-fetch
    const response = await fetch(targetUrl, fetchOptions);

    // 嘗試判定是否為 JSON
    const contentType = response.headers.get('content-type') || '';
    const isBinary = !/^(application\/json|text\/|application\/(javascript|xml|x-www-form-urlencoded)|image\/svg)/i.test(contentType);

    let body;
    if (isBinary) {
      const arrayBuffer = await response.arrayBuffer();
      body = Buffer.from(arrayBuffer).toString('base64');
    } else {
      body = await response.text();
    }

    // 回傳，保留部分 headers
    return {
      statusCode: response.status,
      headers: {
        ...corsHeaders(),
        'Content-Type': contentType || 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
      body,
      isBase64Encoded: isBinary
    };

  } catch (err) {
    console.error('Proxy error:', err);
    return {
      statusCode: 502,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Upstream fetch failed', detail: err.message })
    };
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,Accept',
    'Access-Control-Max-Age': '86400'
  };
}

// 過濾掉不適合轉發的瀏覽器端頭 (可再精簡)
function filterOutboundHeaders(incoming = {}) {
  const banned = new Set([
    'host','connection','content-length','accept-encoding','origin','referer'
  ]);
  const out = {};
  for (const [k,v] of Object.entries(incoming)) {
    const lower = k.toLowerCase();
    if (banned.has(lower)) continue;
    if (lower.startsWith('sec-')) continue;
    out[k] = v;
  }
  // 確保接受 JSON
  if (!out['Accept']) out['Accept'] = 'application/json, text/plain;q=0.8,*/*;q=0.5';
  return out;
}