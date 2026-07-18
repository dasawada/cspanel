const DEFAULT_CSPANEL_API_BASE = 'https://stirring-pothos-28253d.netlify.app';

// authFetch 只能把 Firebase Bearer 送到這些編譯期明列的 origin。
// window.CSPANEL_API_BASE 仍可用來改 API URL，但不會因此擴張可信目的地。
const CSPANEL_AUTH_ORIGINS = Object.freeze([
  new URL(DEFAULT_CSPANEL_API_BASE).origin
]);

function normalizeApiBase(base) {
  return String(base || '').replace(/\/+$/, '');
}

function getCspanelApiBase() {
  if (typeof window !== 'undefined' && window.CSPANEL_API_BASE) {
    return normalizeApiBase(window.CSPANEL_API_BASE);
  }
  return DEFAULT_CSPANEL_API_BASE;
}

const CSPANEL_API = {
  get orderTool() {
    return `${getCspanelApiBase()}/api/order-tool-api`;
  },
  get dealComposite() {
    return `${getCspanelApiBase()}/api/deal-composite`;
  },
  get courseBundle() {
    return `${getCspanelApiBase()}/course-bundle`;
  },
  get shorten() {
    return `${getCspanelApiBase()}/.netlify/functions/shorten`;
  },
  get courseDiaries() {
    return `${getCspanelApiBase()}/.netlify/functions/course-diaries`;
  },
  get googleSheetProxy() {
    return `${getCspanelApiBase()}/.netlify/functions/googleSheetProxy`;
  },
  get googleSheetProxyBatch() {
    return `${getCspanelApiBase()}/.netlify/functions/googleSheetProxyBatch`;
  },
  ipsearch(ip, { date } = {}) {
    const url = new URL(`/ipsearch/${encodeURIComponent(String(ip || '').trim())}`, getCspanelApiBase());
    if (date) url.searchParams.set('date', String(date));
    return url.toString();
  }
};

export {
  CSPANEL_API,
  CSPANEL_AUTH_ORIGINS,
  DEFAULT_CSPANEL_API_BASE,
  getCspanelApiBase,
  normalizeApiBase
};
