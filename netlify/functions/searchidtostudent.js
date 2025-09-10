/* Netlify Function: Proxy to Cloudflare Workers search & student API
 * 支援路徑：
 *   /.netlify/functions/searchidtostudent/search/101061
 *   /.netlify/functions/searchidtostudent/search/abcdef123456abcdef123456
 *   /.netlify/functions/searchidtostudent/search2b/王小明
 *   /.netlify/functions/searchidtostudent/101061   (純數字 -> search/{dealId})
 * 舊式：
 *   /.netlify/functions/searchidtostudent?keyword=101061
 */
const DEFAULT_ROOT = 'https://aitest.yuusuke-hamasaki.workers.dev/api';
const LEGACY_SEARCH_BASE = DEFAULT_ROOT + '/search/';

const allowOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
let isColdStart = !global.__NF_WARM__;
global.__NF_WARM__ = true;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  // --- 高精度計時 (ns) ---
  const t0 = now();              // 進入 handler
  let tBuild, tFetchStart, tHeaders, tFirstByte, tBodyEnd, tJsonStart, tJsonEnd;

  try {
    const method = event.httpMethod || 'GET';

    // 解析與組 URL
    const rawPath = event.path || '';
    const trailing = extractTrailing(rawPath);
    const cleanTrail = trailing.replace(/^\/+/, '');
    const queryString = event.rawQuery ? `?${event.rawQuery}` : '';

    const apiRoot = (process.env.SEARCH_API_ROOT || DEFAULT_ROOT).replace(/\/+$/, '');
    let targetUrl;
    if (cleanTrail) {
      const built = buildUrlFromTrailing(apiRoot, cleanTrail, queryString);
      if (!built.valid) {
        return badRequest(built.errorCode || 'invalid_path', built.message || 'Invalid path');
      }
      targetUrl = built.url;
    } else {
      targetUrl = (process.env.SEARCH_API_BASE || LEGACY_SEARCH_BASE).replace(/\/+$/, '/') + queryString.replace(/^\?/, '?');
    }

    // 準備 headers / options
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

    tBuild = now();              // 組 URL 與 options 完成
    tFetchStart = tBuild;        // 發起 fetch (同步即可視為同一刻)

    const upstream = await fetch(targetUrl, fetchOptions);
    tHeaders = now();            // 收到回應標頭 (TTFB)

    const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
    const isBinary = !/^(application\/json|text\/|application\/(javascript|xml|x-www-form-urlencoded)|image\/svg)/i.test(contentType);

    // 以串流方式讀取以取得 firstByte 與 download 時間
    let bodyText;
    if (upstream.body && typeof upstream.body.getReader === 'function') {
      const reader = upstream.body.getReader();
      const chunks = [];
      let totalLen = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!tFirstByte) tFirstByte = now(); // 第一個 chunk
        chunks.push(value);
        totalLen += value.byteLength;
      }
      tBodyEnd = now();
      if (isBinary) {
        bodyText = Buffer.concat(chunks.map(u8 => Buffer.from(u8))).toString('base64');
      } else {
        bodyText = Buffer.concat(chunks.map(u8 => Buffer.from(u8))).toString('utf8');
      }
    } else {
      // fallback（極少數情況）——失去 firstByte 精度
      if (isBinary) {
        const ab = await upstream.arrayBuffer();
        tFirstByte = tFirstByte || now();
        tBodyEnd = now();
        bodyText = Buffer.from(ab).toString('base64');
      } else {
        bodyText = await upstream.text();
        tFirstByte = tFirstByte || now();
        tBodyEnd = now();
      }
    }

    // Optional: JSON parse timing (只為測量，不修改輸出)
    let jsonMs = 0;
    if (!isBinary && process.env.PROXY_PARSE_JSON === '1' && contentType.includes('application/json')) {
      tJsonStart = now();
      try { JSON.parse(bodyText); } catch (_) { /* ignore parse error */ }
      tJsonEnd = now();
      jsonMs = msDiff(tJsonStart, tJsonEnd);
    }

    // 若未取得 firstByte（非常少，代表無 body）則視為等於 headers
    if (!tFirstByte) tFirstByte = tHeaders;

    // 計算各段時間
    const buildMs     = msDiff(t0, tBuild);
    const waitMs      = msDiff(tFetchStart, tHeaders);      // fetch -> headers (TTFB + upstream processing)
    const firstByteMs = msDiff(tHeaders, tFirstByte);       // headers -> first chunk
    const downloadMs  = msDiff(tFirstByte, tBodyEnd);       // first chunk -> body end
    const totalMs     = msDiff(t0, tBodyEnd);

    const upstreamCache = upstream.headers.get('cf-cache-status') || upstream.headers.get('x-cache') || '';
    const upstreamCTLen = upstream.headers.get('content-length') || '';
    const region = process.env.AWS_REGION || process.env.NETLIFY_REGION || '';

    // 結構化日誌
    console.log(JSON.stringify({
      at: new Date().toISOString(),
      route: cleanTrail || '(legacy)',
      targetUrl,
      status: upstream.status,
      coldStart: isColdStart,
      timing: { buildMs, waitMs, firstByteMs, downloadMs, jsonMs, totalMs },
      upstream: { cache: upstreamCache, contentLength: upstreamCTLen },
      region
    }));

    // Server-Timing (遵循瀏覽器格式)
    const serverTimingParts = [
      `build;dur=${buildMs}`,
      `wait;dur=${waitMs}`,
      `firstbyte;dur=${firstByteMs}`,
      `download;dur=${downloadMs}`,
      ...(jsonMs ? [`json;dur=${jsonMs}`] : []),
      `total;dur=${totalMs}`
    ];
    const serverTiming = serverTimingParts.join(', ');

    return {
      statusCode: upstream.status,
      headers: {
        ...corsHeaders(),
        'Content-Type': contentType || (isBinary ? 'application/octet-stream' : 'text/plain; charset=utf-8'),
        'Cache-Control': 'no-store',
        'Server-Timing': serverTiming,
        'X-Proxy-Upstream': targetUrl,
        'X-Proxy-Cold': isColdStart ? '1' : '0',
        'X-Proxy-Region': region,
        'X-Upstream-Cache': upstreamCache,
        'X-Upstream-CT': upstreamCTLen,
        // 細節 timing headers
        'X-Timing-Build': String(buildMs),
        'X-Timing-Wait': String(waitMs),
        'X-Timing-FirstByte': String(firstByteMs),
        'X-Timing-Download': String(downloadMs),
        'X-Timing-JSON': String(jsonMs),
        'X-Timing-Total': String(totalMs)
      },
      body: bodyText,
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

/* --------- Helpers --------- */
function now() { return process.hrtime.bigint(); }
function msDiff(a, b) {
  if (!a || !b) return 0;
  return Number(b - a) / 1e6;
}

function extractTrailing(fullPath) {
  const marker = '/.netlify/functions/searchidtostudent';
  const idx = fullPath.indexOf(marker);
  if (idx === -1) return '';
  return fullPath.slice(idx + marker.length);
}

function buildUrlFromTrailing(apiRoot, trail, query) {
  const parts = trail.split('/').filter(Boolean);
  if (parts.length === 1) {
    const only = parts[0];
    if (/^\d+$/.test(only)) {
      return { valid: true, url: `${apiRoot}/search/${encodeURIComponent(only)}${query}` };
    }
    return { valid: false, errorCode: 'missing_prefix', message: 'Path must start with search/ or search2b/' };
  }
  const prefix = parts[0];
  const tail = parts.slice(1).join('/');
  if (!tail) return { valid: false, errorCode: 'missing_identifier', message: 'Missing identifier after prefix' };

  if (prefix === 'search') {
    if (!isDealId(tail) && !isHash24(tail)) {
      return { valid: false, errorCode: 'invalid_identifier', message: 'Must be numeric dealId or 24-char hex hash' };
    }
    return { valid: true, url: `${apiRoot}/search/${encodeURIComponent(tail)}${query}` };
  }
  if (prefix === 'search2b') {
    if (tail.length > 40) {
      return { valid: false, errorCode: 'name_too_long', message: 'Name too long' };
    }
    return { valid: true, url: `${apiRoot}/search2b/${encodeURIComponent(tail)}${query}` };
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