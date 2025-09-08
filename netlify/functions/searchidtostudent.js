/* Netlify Function: Proxy to Cloudflare Workers search & student API
 * 新增支援路徑：
 *   /.netlify/functions/searchidtostudent/search/101061
 *   /.netlify/functions/searchidtostudent/search/abcdef123456abcdef123456
 *   /.netlify/functions/searchidtostudent/search2b/王小明
 *   /.netlify/functions/searchidtostudent/101061   (純數字自動視為 search/{dealId})
 * 舊式仍可：
 *   /.netlify/functions/searchidtostudent?keyword=101061
 */
const DEFAULT_ROOT = 'https://aitest.yuusuke-hamasaki.workers.dev/api'; // 不加尾斜線
const LEGACY_SEARCH_BASE = DEFAULT_ROOT + '/search/'; // 舊 query 模式

const allowOrigin = process.env.CORS_ALLOW_ORIGIN || '*';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  const started = Date.now();
  try {
    const method = event.httpMethod || 'GET';
    const rawPath = event.path || '';
    const trailing = extractTrailing(rawPath); // 取得 function 名稱後的部分 (可能為 '', '/search/xxx', '/101')
    const cleanTrail = trailing.replace(/^\/+/, ''); // 去前導斜線
    const queryString = event.rawQuery ? `?${event.rawQuery}` : '';

    const apiRoot = (process.env.SEARCH_API_ROOT || DEFAULT_ROOT).replace(/\/+$/, '');
    let targetUrl;

    if (cleanTrail) {
      // 具有子路徑
      targetUrl = buildUrlFromTrailing(apiRoot, cleanTrail, queryString);
      if (!targetUrl.valid) {
        return badRequest(targetUrl.errorCode || 'invalid_path', targetUrl.message || 'Invalid path');
      }
      targetUrl = targetUrl.url;
    } else {
      // 無子路徑 => fallback 舊模式 (keyword/hash24/dealId 以 query)
      targetUrl = (process.env.SEARCH_API_BASE || LEGACY_SEARCH_BASE).replace(/\/+$/, '/') + queryString.replace(/^\?/, '?');
    }

    const fetchOptions = {
      method,
      headers: filterOutboundHeaders(event.headers),
      redirect: 'follow'
    };

    if (['POST','PUT','PATCH','DELETE'].includes(method)) {
      fetchOptions.body = event.body && (event.isBase64Encoded
        ? Buffer.from(event.body, 'base64')
        : event.body);
    }

    const upstream = await fetch(targetUrl, fetchOptions);
    const contentType = upstream.headers.get('content-type') || '';
    const isBinary = !/^(application\/json|text\/|application\/(javascript|xml|x-www-form-urlencoded)|image\/svg)/i.test(contentType);

    let body;
    if (isBinary) {
      const ab = await upstream.arrayBuffer();
      body = Buffer.from(ab).toString('base64');
    } else {
      body = await upstream.text();
    }

    return {
      statusCode: upstream.status,
      headers: {
        ...corsHeaders(),
        'Content-Type': contentType || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Proxy-Upstream': targetUrl,
        'X-Proxy-Elapsed': String(Date.now() - started)
      },
      body,
      isBase64Encoded: isBinary
    };
  } catch (err) {
    console.error('Proxy error:', err);
    return {
      statusCode: 502,
      headers: corsHeaders(),
      body: JSON.stringify({
        error: 'Upstream fetch failed',
        detail: err.message
      })
    };
  }
};

function extractTrailing(fullPath) {
  const marker = '/.netlify/functions/searchidtostudent';
  const idx = fullPath.indexOf(marker);
  if (idx === -1) return '';
  return fullPath.slice(idx + marker.length); // 可能為 '' 或 '/search/123'
}

function buildUrlFromTrailing(apiRoot, trail, query) {
  // 支援：
  // search/{idOrHash}
  // search2b/{name}
  // {numericOnly} -> search/{dealId}
  const parts = trail.split('/').filter(Boolean); // 去除空字串
  if (parts.length === 1) {
    const only = parts[0];
    if (/^\d+$/.test(only)) {
      // 單純數字 => dealId
      return {
        valid: true,
        url: `${apiRoot}/search/${encodeURIComponent(only)}${query}`
      };
    }
    // 單一字串但不是純數字 -> 視為錯誤（避免誤判 search2b 少層）
    return { valid: false, errorCode: 'missing_prefix', message: 'Path must start with search/ or search2b/' };
  }

  const prefix = parts[0];
  const tail = parts.slice(1).join('/'); // 允許名字中含 / 的話可再改
  if (!tail) {
    return { valid: false, errorCode: 'missing_identifier', message: 'Missing identifier after prefix' };
  }

  if (prefix === 'search') {
    if (!isDealId(tail) && !isHash24(tail)) {
      return { valid: false, errorCode: 'invalid_identifier', message: 'Must be numeric dealId or 24-char hex hash' };
    }
    return {
      valid: true,
      url: `${apiRoot}/search/${encodeURIComponent(tail)}${query}`
    };
  }

  if (prefix === 'search2b') {
    if (tail.length > 40) {
      return { valid: false, errorCode: 'name_too_long', message: 'Name too long' };
    }
    return {
      valid: true,
      url: `${apiRoot}/search2b/${encodeURIComponent(tail)}${query}`
    };
  }

  return { valid: false, errorCode: 'unsupported_prefix', message: 'Unsupported path prefix' };
}

function isDealId(v) { return /^\d+$/.test(v); }
function isHash24(v) { return /^[a-fA-F0-9]{24}$/.test(v); }

function badRequest(code, message) {
  return {
    statusCode: 400,
    headers: corsHeaders(),
    body: JSON.stringify({ error: code, message })
  };
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,Accept',
    'Access-Control-Max-Age': '86400'
  };
}

function filterOutboundHeaders(incoming = {}) {
  const banned = new Set(['host','connection','content-length','accept-encoding','origin','referer']);
  const out = {};
  for (const [k,v] of Object.entries(incoming)) {
    const lower = k.toLowerCase();
    if (banned.has(lower)) continue;
    if (lower.startsWith('sec-')) continue;
    out[k] = v;
  }
  if (!out['Accept']) out['Accept'] = 'application/json, text/plain;q=0.8,*/*;q=0.5';
  return out;
}