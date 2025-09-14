export const config = {
  path: '/searchidtostudent/*'
};

// 目標後端固定為該域名（仍允許以環境變數 SEARCH_API_ROOT 覆寫）
const DEFAULT_API_ROOT = 'https://aitest.yuusuke-hamasaki.workers.dev/api';

export default async (request) => {
  const allowOrigin = Deno.env.get('CORS_ALLOW_ORIGIN') ?? '*';
  const apiRoot = (Deno.env.get('SEARCH_API_ROOT') || DEFAULT_API_ROOT).replace(/\/+$/, '');

  const url = new URL(request.url);
  const prefix = '/searchidtostudent';
  let trailing = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : '';
  trailing = trailing.replace(/^\/+/, ''); // 去掉多餘前導斜線

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
    return json({ error: 'invalid_path' }, 400, corsBase);
  }

  // 直接對 upstream 建立完整 URL
  const targetUrl = `${apiRoot}/${trailing}${url.search}`;

  // 準備 outbound headers
  const outboundHeaders = buildOutboundHeaders(request.headers);

  // 可選逾時（避免卡住）
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s
  const init = {
    method: request.method,
    headers: outboundHeaders,
    signal: controller.signal
  };
  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = request.body;
  }

  try {
    const upstream = await fetch(targetUrl, init);
    clearTimeout(timeout);

    // 保留 upstream headers（再補 CORS）
    const respHeaders = new Headers(upstream.headers);
    respHeaders.set('Access-Control-Allow-Origin', allowOrigin);
    respHeaders.set('Access-Control-Expose-Headers', 'Content-Type,Content-Length');
    respHeaders.set('Vary', mergeVary(respHeaders.get('Vary'), 'Origin'));

    // 直接串流回傳（避免重組造成編碼問題）
    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders
    });
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    return json(
      { error: aborted ? 'upstream_timeout' : 'upstream_failed', detail: String(err), upstream: targetUrl },
      502,
      corsBase
    );
  }
};

function buildOutboundHeaders(src) {
  const banned = new Set(['host','connection','content-length','origin','referer']);
  const h = new Headers();
  for (const [k,v] of src.entries()) {
    const lower = k.toLowerCase();
    if (banned.has(lower)) continue;
    if (lower.startsWith('sec-')) continue;
    h.set(k, v);
  }
  if (!h.has('Accept')) {
    h.set('Accept', 'application/json, text/plain;q=0.8,*/*;q=0.5');
  }
  // 為避免壓縮/解壓差異造成亂碼，顯式要求 identity（必要時可移除）
  if (!h.has('Accept-Encoding')) {
    h.set('Accept-Encoding', 'identity');
  }
  return h;
}

function json(obj, status, base) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...base,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

function mergeVary(existing, add) {
  if (!existing) return add;
  const parts = new Set(existing.split(',').map(s => s.trim()).filter(Boolean));
  parts.add(add);
  return Array.from(parts).join(', ');
}