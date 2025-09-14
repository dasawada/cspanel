// filepath: /cspanel/cspanel/netlify/edge-functions/searchidtostudent.js
export default async (request) => {
  const allowOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
  const apiRoot = (process.env.SEARCH_API_ROOT || 'https://aitest.yuusuke-hamasaki.workers.dev/api').replace(/\/+$/, '');
  const url = new URL(request.url);

  // 與 netlify.toml 中 path 對應
  const edgePrefix = '/searchidtostudent';
  let trailing = url.pathname.startsWith(edgePrefix)
    ? url.pathname.slice(edgePrefix.length)
    : url.pathname;
  trailing = trailing.replace(/^\/+/, '');

  const corsBase = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,Accept',
    'Access-Control-Max-Age': '86400'
  };

  if (request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsBase });
  }

  if (!trailing) {
    return json({ error: 'missing_path', message: 'Path after /searchidtostudent/ is required' }, 400, corsBase);
  }
  if (trailing.includes('..')) {
    return json({ error: 'invalid_path', message: 'Illegal path segment' }, 400, corsBase);
  }

  const targetUrl = `${apiRoot}/${trailing}${url.search}`;

  const outboundHeaders = filterOutboundHeaders(request.headers);

  const fetchInit = { method: request.method, headers: outboundHeaders };
  if (!['GET', 'HEAD'].includes(request.method)) {
    fetchInit.body = request.body;
  }

  try {
    const upstream = await fetch(targetUrl, fetchInit);
    const resHeaders = new Headers(upstream.headers);
    resHeaders.set('Access-Control-Allow-Origin', allowOrigin);
    resHeaders.set('Access-Control-Expose-Headers', 'Content-Type,Content-Length');

    // 不強制讀取為 text，直接串流轉回（Edge Response 可直接回傳）
    return new Response(upstream.body, {
      status: upstream.status,
      headers: resHeaders
    });
  } catch (err) {
    return json({ error: 'upstream_failed', detail: err.message }, 502, corsBase);
  }
};

function json(obj, status, base) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...base,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

function filterOutboundHeaders(src) {
  const banned = new Set(['host', 'connection', 'content-length', 'origin', 'referer']);
  const out = new Headers();
  for (const [k, v] of src.entries()) {
    const lower = k.toLowerCase();
    if (banned.has(lower)) continue;
    if (lower.startsWith('sec-')) continue;
    out.set(k, v);
  }
  if (!out.has('Accept')) {
    out.set('Accept', 'application/json, text/plain;q=0.8,*/*;q=0.5');
  }
  // 不手動設定 Accept-Encoding，讓平台自處理壓縮
  return out;
}