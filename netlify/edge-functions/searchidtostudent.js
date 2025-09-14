export const config = {
  path: '/searchidtostudent/*'
};

export default async (request, context) => {
  // Deno 環境取得環境變數
  const allowOrigin = Deno.env.get('CORS_ALLOW_ORIGIN') ?? '*';
  const apiRoot = (Deno.env.get('SEARCH_API_ROOT') ?? 'https://aitest.yuusuke-hamasaki.workers.dev/api').replace(/\/+$/, '');

  const url = new URL(request.url);
  const prefix = '/searchidtostudent';
  let trailing = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : '';
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

  const init = {
    method: request.method,
    headers: outboundHeaders
  };
  if (!['GET', 'HEAD'].includes(request.method)) {
    // 直接傳遞原始可讀串流
    init.body = request.body;
  }

  try {
    const upstreamReq = new Request(targetUrl, init);
    const upstream = await fetch(upstreamReq);

    const respHeaders = new Headers(upstream.headers);
    respHeaders.set('Access-Control-Allow-Origin', allowOrigin);
    respHeaders.set('Access-Control-Expose-Headers', 'Content-Type,Content-Length');

    // 直接串流回傳
    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders
    });
  } catch (err) {
    console.error('edge_upstream_error', err);
    return json({ error: 'upstream_failed', detail: err.message ?? String(err) }, 502, corsBase);
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
  // 不設 Accept-Encoding，讓平台自動處理
  return out;
}