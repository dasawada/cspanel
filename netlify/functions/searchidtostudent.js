/* Netlify Function: Proxy to Cloudflare Workers search & student API
 * Added: in-memory cache, proxyOverhead timing, X-Cache, correlation id.
 */
const DEFAULT_ROOT = 'https://aitest.yuusuke-hamasaki.workers.dev/api';
const LEGACY_SEARCH_BASE = DEFAULT_ROOT + '/search/';

const allowOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
const CACHE_TTL = parseInt(process.env.PROXY_CACHE_TTL_MS || '10000', 10); // ms
const LOG_SAMPLE_RATE = Number.isFinite(Number(process.env.LOG_SAMPLE_RATE))
  ? Number(process.env.LOG_SAMPLE_RATE)
  : 1;

let isColdStart = !global.__NF_WARM__;
global.__NF_WARM__ = true;

// 簡易記憶體快取 { key: { expire, status, headers, body, isBase64, timings } }
const memoryCache = global.__SEARCH_PROXY_CACHE__ || new Map();
global.__SEARCH_PROXY_CACHE__ = memoryCache;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  const reqId = genId();
  const t0 = now();
  let tBuild, tFetchStart, tHeaders, tFirstByte, tBodyEnd, tJsonStart, tJsonEnd;
  let fromCache = false;
  let cacheKey, cached;

  try {
    const method = event.httpMethod || 'GET';
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

    const urlObj = new URL(targetUrl);
    const noCache = urlObj.searchParams.get('noCache') === '1';

    // 只對 GET + 200 預期結果做記憶體快取（search/search2b）
    const isCachable = method === 'GET' && !noCache && isCachablePath(urlObj.pathname);

    if (isCachable) {
      cacheKey = cacheKeyFrom(urlObj);
      cached = memoryCache.get(cacheKey);
      if (cached && cached.expire > Date.now()) {
        fromCache = true;
        const totalMs = msDiff(t0, now());
        const proxyOverheadMs = totalMs; // 快取命中視為全部代理耗時
        return respond({
          statusCode: cached.status,
            body: cached.body,
            isBase64Encoded: cached.isBase64,
            contentType: cached.contentType,
            timings: {
              buildMs: 0,
              waitMs: 0,
              firstByteMs: 0,
              downloadMs: 0,
              jsonMs: cached.timings?.jsonMs || 0,
              totalMs,
              proxyOverheadMs
            },
            upstreamMeta: cached.upstreamMeta || {},
            targetUrl,
            reqId,
            cacheState: 'HIT',
            cold: isColdStart
        });
      } else if (cached) {
        // 過期清除
        memoryCache.delete(cacheKey);
      }
    }

    // 準備 fetch
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

    tBuild = now();
    tFetchStart = tBuild;

    const upstream = await fetch(targetUrl, fetchOptions);
    tHeaders = now();

    const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
    const isBinary = !/^(application\/json|text\/|application\/(javascript|xml|x-www-form-urlencoded)|image\/svg)/i.test(contentType);

    // 串流讀取
    let bodyText;
    if (upstream.body && typeof upstream.body.getReader === 'function') {
      const reader = upstream.body.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!tFirstByte) tFirstByte = now();
        chunks.push(value);
      }
      tBodyEnd = now();
      if (isBinary) {
        bodyText = Buffer.concat(chunks.map(u8 => Buffer.from(u8))).toString('base64');
      } else {
        bodyText = Buffer.concat(chunks.map(u8 => Buffer.from(u8))).toString('utf8');
      }
    } else {
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

    // JSON parse timing (optional)
    let jsonMs = 0;
    if (!isBinary && process.env.PROXY_PARSE_JSON === '1' && contentType.includes('application/json')) {
      tJsonStart = now();
      try { JSON.parse(bodyText); } catch (_) {}
      tJsonEnd = now();
      jsonMs = msDiff(tJsonStart, tJsonEnd);
    }
    if (!tFirstByte) tFirstByte = tHeaders;

    // 計算
    const buildMs     = msDiff(t0, tBuild);
    const waitMs      = msDiff(tFetchStart, tHeaders);
    const firstByteMs = msDiff(tHeaders, tFirstByte);
    const downloadMs  = msDiff(tFirstByte, tBodyEnd);
    const totalMs     = msDiff(t0, tBodyEnd);
    const proxyOverheadMs = totalMs - waitMs; // 除去 upstream 等待

    const upstreamCache = upstream.headers.get('cf-cache-status') || upstream.headers.get('x-cache') || '';
    const upstreamCTLen = upstream.headers.get('content-length') || '';
    const upstreamCE   = upstream.headers.get('content-encoding') || '';
    const upstreamRay  = upstream.headers.get('cf-ray') || '';
    const upstreamTE   = upstream.headers.get('transfer-encoding') || '';
    const upstreamAge  = upstream.headers.get('age') || '';
    const region = process.env.AWS_REGION || process.env.NETLIFY_REGION || '';

    const statusCode = upstream.status;
    const upstreamMeta = {
      cache: upstreamCache,
      contentLength: upstreamCTLen,
      contentEncoding: upstreamCE,
      cfRay: upstreamRay,
      transferEncoding: upstreamTE,
      age: upstreamAge,
      region
    };

    // 寫入快取
    if (isCachable && statusCode === 200) {
      memoryCache.set(cacheKey, {
        expire: Date.now() + CACHE_TTL,
        status: statusCode,
        body: bodyText,
        isBase64: isBinary,
        contentType,
        timings: { jsonMs },
        upstreamMeta
      });
    }

    // 日誌（採樣）
    if (Math.random() < LOG_SAMPLE_RATE) {
      console.log(JSON.stringify({
        at: new Date().toISOString(),
        id: reqId,
        route: cleanTrail || '(legacy)',
        targetUrl,
        status: statusCode,
        coldStart: isColdStart,
        cache: isCachable ? (fromCache ? 'HIT' : (noCache ? 'BYPASS' : 'MISS')) : 'NA',
        timing: { buildMs, waitMs, firstByteMs, downloadMs, jsonMs, totalMs, proxyOverheadMs },
        upstream: upstreamMeta
      }));
    }

    return respond({
      statusCode,
      body: bodyText,
      isBase64Encoded: isBinary,
      contentType,
      timings: { buildMs, waitMs, firstByteMs, downloadMs, jsonMs, totalMs, proxyOverheadMs },
      upstreamMeta,
      targetUrl,
      reqId,
      cacheState: isCachable ? (noCache ? 'BYPASS' : 'MISS') : 'NA',
      cold: isColdStart
    });

  } catch (err) {
    console.error('Proxy error:', err);
    return {
      statusCode: 502,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json',
        'X-Request-Id': reqId
      },
      body: JSON.stringify({ error: 'Upstream fetch failed', detail: err.message, requestId: reqId })
    };
  }
};

/* ---------- Respond Helper ---------- */
function respond(ctx) {
  const {
    statusCode, body, isBase64Encoded, contentType,
    timings, upstreamMeta, targetUrl, reqId, cacheState, cold
  } = ctx;
  const { buildMs, waitMs, firstByteMs, downloadMs, jsonMs, totalMs, proxyOverheadMs } = timings;

  const serverTimingParts = [];
  if (cacheState === 'HIT') {
    serverTimingParts.push('cache;desc="memory";dur=0');
  } else {
    serverTimingParts.push(`build;dur=${buildMs}`, `wait;dur=${waitMs}`, `firstbyte;dur=${firstByteMs}`, `download;dur=${downloadMs}`);
    if (jsonMs) serverTimingParts.push(`json;dur=${jsonMs}`);
  }
  serverTimingParts.push(`total;dur=${totalMs}`, `proxyoverhead;dur=${proxyOverheadMs}`);

  // 新增：Expose headers / Timing-Allow-Origin
  const expose = [
    'Server-Timing',
    'X-Proxy-Upstream','X-Proxy-Cold','X-Proxy-Region',
    'X-Upstream-Cache','X-Upstream-CT','X-Upstream-CE','X-Upstream-CF-Ray','X-Upstream-TE','X-Upstream-Age',
    'X-Cache','X-Request-Id',
    'X-Timing-Build','X-Timing-Wait','X-Timing-FirstByte','X-Timing-Download','X-Timing-JSON','X-Timing-Total','X-Timing-ProxyOverhead'
  ].join(', ');

  return {
    statusCode,
    headers: {
      ...corsHeaders(),
      'Content-Type': contentType || (isBase64Encoded ? 'application/octet-stream' : 'text/plain; charset=utf-8'),
      'Cache-Control': process.env.PROXY_CACHE_CONTROL || 'no-store',
      'Server-Timing': serverTimingParts.join(', '),
      'Timing-Allow-Origin': '*',                   // 讓瀏覽器可讀 Server-Timing
      'Access-Control-Expose-Headers': expose,      // 讓前端 JS 可讀自訂標頭
      'X-Proxy-Upstream': targetUrl,
      'X-Proxy-Cold': cold ? '1' : '0',
      'X-Proxy-Region': upstreamMeta.region || '',
      'X-Upstream-Cache': upstreamMeta.cache || '',
      'X-Upstream-CT': upstreamMeta.contentLength || '',
      'X-Upstream-CE': upstreamMeta.contentEncoding || '',
      'X-Upstream-CF-Ray': upstreamMeta.cfRay || '',
      'X-Upstream-TE': upstreamMeta.transferEncoding || '',
      'X-Upstream-Age': upstreamMeta.age || '',
      'X-Cache': cacheState,
      'X-Request-Id': reqId,
      'X-Timing-Build': String(buildMs),
      'X-Timing-Wait': String(waitMs),
      'X-Timing-FirstByte': String(firstByteMs),
      'X-Timing-Download': String(downloadMs),
      'X-Timing-JSON': String(jsonMs || 0),
      'X-Timing-Total': String(totalMs),
      'X-Timing-ProxyOverhead': String(proxyOverheadMs)
    },
    body,
    isBase64Encoded
  };
}

/* ---------- Helpers ---------- */
function now() { return process.hrtime.bigint(); }
function msDiff(a, b) { return Number(b - a) / 1e6; }

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
    if (tail.length > 40) return { valid: false, errorCode: 'name_too_long', message: 'Name too long' };
    return { valid: true, url: `${apiRoot}/search2b/${encodeURIComponent(tail)}${query}` };
  }
  return { valid: false, errorCode: 'unsupported_prefix', message: 'Unsupported path prefix' };
}

function isDealId(v) { return /^\d+$/.test(v); }
function isHash24(v) { return /^[a-fA-F0-9]{24}$/.test(v); }
function isCachablePath(p) { return /\/api\/(search|search2b)\//.test(p); }

function cacheKeyFrom(u) {
  // 忽略無意義 query 排序
  const qp = [...u.searchParams.entries()]
    .filter(([k]) => k !== 'noCache')
    .sort((a,b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))
    .map(([k,v]) => `${k}=${v}`).join('&');
  return `${u.origin}${u.pathname}${qp ? '?'+qp : ''}`;
}

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
  const banned = new Set(['host','connection','content-length','origin','referer']);
  const out = {};
  for (const [k,v] of Object.entries(incoming)) {
    const lower = k.toLowerCase();
    if (banned.has(lower)) continue;
    if (lower.startsWith('sec-')) continue;
    out[k] = v;
  }
  if (!out['Accept']) out['Accept'] = 'application/json, text/plain;q=0.8,*/*;q=0.5';
  if (!out['Accept-Encoding']) out['Accept-Encoding'] = 'gzip, br';
  return out;
}

function genId() {
  return 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}