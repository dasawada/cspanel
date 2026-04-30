const DEFAULT_CSPANEL_API_BASE = 'https://stirring-pothos-28253d.netlify.app';

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
  get googleSheetProxy() {
    return `${getCspanelApiBase()}/.netlify/functions/googleSheetProxy`;
  },
  get googleSheetProxyBatch() {
    return `${getCspanelApiBase()}/.netlify/functions/googleSheetProxyBatch`;
  }
};

export {
  CSPANEL_API,
  DEFAULT_CSPANEL_API_BASE,
  getCspanelApiBase,
  normalizeApiBase
};
