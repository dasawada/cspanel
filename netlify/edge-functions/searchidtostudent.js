export const config = { path: '/searchidtostudent/*' };

const DEFAULT_API_ROOT = 'https://aitest.yuusuke-hamasaki.workers.dev/api';

export default async (request) => {
  const allowOrigin = Deno.env.get('CORS_ALLOW_ORIGIN') ?? '*';
  const apiRoot = (Deno.env.get('SEARCH_API_ROOT') || DEFAULT_API_ROOT).replace(/\/+$/, '');

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
    return json({ error: 'missing_path' }, 400, corsBase);
  }
  if (trailing.includes('..')) {
    return json({ error: 'invalid_path' }, 400, corsBase);
  }

  // 對齊 serverless 行為：純數字或 24 hex 自動加上 search/
  const norm = normalizeTrailing(trailing);
  if (!norm.ok) {
    return json({ error: norm.error || 'invalid_path' }, 400, corsBase);
  }

  const targetUrl = `${apiRoot}/${norm.path}${url.search}`;

  const outboundHeaders = buildOutboundHeaders(request.headers);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const init = { method: request.method, headers: outboundHeaders, signal: controller.signal };
  if (!['GET','HEAD'].includes(request.method)) init.body = request.body;

  try {
    const upstream = await fetch(targetUrl, init);
    clearTimeout(timeout);

    const respHeaders = new Headers(upstream.headers);
    respHeaders.set('Access-Control-Allow-Origin', allowOrigin);
    respHeaders.set('Access-Control-Expose-Headers', 'Content-Type,Content-Length');
    respHeaders.set('Vary', mergeVary(respHeaders.get('Vary'), 'Origin'));

    return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    return json(
      { error: aborted ? 'upstream_timeout' : 'upstream_failed', detail: String(err), upstream: targetUrl },
      502,
      corsBase
    );
  }
};

function normalizeTrailing(t) {
  // 已含前綴則直接使用
  if (t.startsWith('search/')) return { ok: true, path: t };
  if (t.startsWith('search2b/')) return { ok: true, path: t };

  // 單段：判斷數字或 24 位 hex（對齊 serverless buildUrlFromTrailing 的邏輯）
  if (/^\d+$/.test(t) || /^[a-fA-F0-9]{24}$/.test(t)) {
    return { ok: true, path: `search/${t}` };
  }
  return { ok: false, error: 'unsupported_pattern' };
}

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
  // 不設定 Accept-Encoding 讓平台自動處理壓縮（避免亂碼）
  return h;
}

function json(obj, status, base) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...base, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function mergeVary(existing, add) {
  if (!existing) return add;
  const parts = new Set(existing.split(',').map(s => s.trim()).filter(Boolean));
  parts.add(add);
  return [...parts].join(', ');
}