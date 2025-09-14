// filepath: /cspanel/cspanel/netlify/edge-functions/searchidtostudent.js
export default async (request) => {
  const { method, headers, body } = request;
  const url = new URL(request.url);
  const apiRoot = (process.env.SEARCH_API_ROOT || 'https://aitest.yuusuke-hamasaki.workers.dev/api').replace(/\/+$/, '');
  
  // Handle CORS
  const allowOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,Accept',
    'Access-Control-Max-Age': '86400'
  };

  if (method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders });
  }

  const trailing = url.pathname.replace(/^\/+/, '');
  const queryString = url.search;

  let targetUrl;
  if (trailing) {
    targetUrl = `${apiRoot}/${trailing}${queryString}`;
  } else {
    return new Response(JSON.stringify({ error: 'Invalid path' }), { status: 400, headers: corsHeaders });
  }

  const fetchOptions = {
    method,
    headers: filterOutboundHeaders(headers),
  };

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    fetchOptions.body = body;
  }

  try {
    const upstream = await fetch(targetUrl, fetchOptions);
    const responseBody = await upstream.text();
    const responseHeaders = new Headers(upstream.headers);
    
    // Add CORS headers to the response
    responseHeaders.append('Access-Control-Allow-Origin', allowOrigin);
    
    return new Response(responseBody, {
      status: upstream.status,
      headers: responseHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Upstream fetch failed', detail: err.message }), {
      status: 502,
      headers: corsHeaders
    });
  }
};

function filterOutboundHeaders(incoming = {}) {
  const banned = new Set(['host', 'connection', 'content-length', 'origin', 'referer']);
  const out = {};
  for (const [k, v] of Object.entries(incoming)) {
    const lower = k.toLowerCase();
    if (banned.has(lower)) continue;
    if (lower.startsWith('sec-')) continue;
    out[k] = v;
  }
  if (!out['Accept']) out['Accept'] = 'application/json, text/plain;q=0.8,*/*;q=0.5';
  if (!out['Accept-Encoding']) out['Accept-Encoding'] = 'gzip, br';
  return out;
}