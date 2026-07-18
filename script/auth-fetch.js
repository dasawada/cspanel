import { CSPANEL_AUTH_ORIGINS } from './cspanel-api.js';

function authClientError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'AuthFetchError';
  error.code = code;
  Object.assign(error, details);
  return error;
}

function getPageBaseUrl() {
  return globalThis.location?.href || 'https://dasawada.github.io/cspanel/';
}

function getInputUrl(input) {
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  if (input instanceof URL) return input.href;
  return String(input);
}

function resolveTrustedTarget(input) {
  let target;
  try {
    target = new URL(getInputUrl(input), getPageBaseUrl());
  } catch {
    throw authClientError('AUTH_DESTINATION_INVALID', 'API 目的地格式無效');
  }

  if (!CSPANEL_AUTH_ORIGINS.includes(target.origin)) {
    throw authClientError(
      'AUTH_DESTINATION_FORBIDDEN',
      '拒絕將登入憑證傳送到非 CSPANEL API 目的地',
      { origin: target.origin }
    );
  }

  return target;
}

export function getFirebaseUser() {
  try {
    const compatUser = globalThis.window?.firebase?.auth?.()?.currentUser;
    if (compatUser) return compatUser;
  } catch {
    // Firebase compat 尚未初始化時再嘗試 modular auth。
  }

  return globalThis.window?.auth?.currentUser || null;
}

export async function getFirebaseIdToken({ forceRefresh = false } = {}) {
  const user = getFirebaseUser();
  if (!user || typeof user.getIdToken !== 'function') {
    throw authClientError('AUTH_REQUIRED', '請先登入再執行此操作');
  }

  try {
    return await user.getIdToken(Boolean(forceRefresh));
  } catch {
    throw authClientError('AUTH_TOKEN_UNAVAILABLE', '無法取得登入憑證，請重新登入');
  }
}

function buildRequestTemplate(input, target, init) {
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return new Request(input, init);
  }
  return new Request(target.href, init);
}

function notifyFinalUnauthorized() {
  globalThis.window?.dispatchEvent?.(new Event('firework-force-logout'));
}

export async function authFetch(input, init = {}, { retry401 = true } = {}) {
  // Destination guard 必須早於 Firebase token retrieval。
  const target = resolveTrustedTarget(input);
  const template = buildRequestTemplate(input, target, init);

  const send = async (forceRefresh) => {
    const token = await getFirebaseIdToken({ forceRefresh });
    const request = template.clone();
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${token}`);

    return fetch(new Request(request, {
      headers,
      redirect: 'error',
      credentials: 'omit'
    }));
  };

  let response = await send(false);
  if (response.status === 401 && retry401) {
    response = await send(true);
  }

  if (response.status === 401) notifyFinalUnauthorized();
  return response;
}

export async function readApiError(response) {
  let payload = null;
  try {
    payload = await response.clone().json();
  } catch {
    // 非 JSON 回應只使用安全的 status fallback，不回顯 raw body。
  }

  const nested = payload?.error && typeof payload.error === 'object'
    ? payload.error
    : null;
  const code = nested?.code
    || (typeof payload?.code === 'string' ? payload.code : '')
    || `HTTP_${response.status}`;
  const message = response.status >= 500
    ? '服務暫時無法完成請求'
    : (nested?.message
      || (typeof payload?.error === 'string' ? payload.error : '')
      || (typeof payload?.message === 'string' ? payload.message : '')
      || response.statusText
      || 'API 請求失敗');
  const requestId = nested?.requestId
    || payload?.requestId
    || response.headers.get('X-Request-Id')
    || '';

  return {
    code,
    message,
    requestId,
    status: response.status
  };
}
