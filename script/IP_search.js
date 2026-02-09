import { callGoogleMapsAPI } from "./googleSheetAPI.js";

const logEntries = [];
function log(eventType, details) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    eventType,
    details
  };
  logEntries.push(entry);
}

window.debugLogEntries = logEntries;
window.downloadLogFile = function() {
  if (typeof window.debugLogEntries === "undefined" || !Array.isArray(window.debugLogEntries)) {
    return;
  }
  const filename = `ip_search_log_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const blob = new Blob([JSON.stringify(window.debugLogEntries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const MIN_PANEL_HEIGHT = 36;
const IP_SEARCH_API_BASE = "https://stirring-pothos-28253d.netlify.app/ipsearch/";
let ipSearchSeq = 0;

const STATUS_LABELS = {
  healthy: "流量曲線穩定",
  degraded: "流量低於平均值 25% 以上",
  outage: "所屬網段目前斷線",
  drop_detected: "有無預警斷線風險",
  alive_no_stats: "暫無異常數據",
  insufficient: "樣本數過少無法判定",
  inactive: "該IP可能未分配實體設備或已下線"
};

const CATEGORY_LABELS = {
  residential: "住宅",
  mobile: "行動",
  datacenter: "機房",
  education: "教育",
  unknown: "未知"
};

const ACCESS_TYPE_LABELS = {
  fiber: "光纖固網",
  dsl: "DSL 固網",
  cable: "Cable 固網",
  mobile_hotspot: "行動熱點",
  cellular: "行動網路",
  vpn: "VPN 繞行",
  proxy: "Proxy 代理",
  datacenter: "機房連線",
  satellite: "衛星連線",
  unknown: "未知連線"
};

const UNCERTAINTY_LABELS = {
  very_low: "極低",
  low: "低",
  medium: "中",
  high: "高",
  very_high: "極高"
};

const DATA_QUALITY_LABELS = {
  very_high: "極高品質",
  high: "高品質",
  medium: "中等品質",
  low: "低品質",
  very_low: "極低品質",
  insufficient: "樣本不足"
};

const HOTSPOT_LIKELIHOOD_LABELS = {
  certain: "確定",
  highly_probable: "極可能",
  probable: "很可能",
  possible: "可能",
  unlikely: "不太可能",
  very_unlikely: "極不可能"
};

const SIGNAL_EXPLANATIONS = {
  "NO_PTR": {
    label: "NO_PTR 信號",
    description: "該 IP 沒有反向 DNS 記錄",
    risk_impact: "可能為動態 IP 或臨時配發，增加連線不穩定可能性"
  },
  "MOBILE_NETWORK": {
    label: "行動網路信號",
    description: "PTR 記錄包含行動網路關鍵字",
    risk_impact: "使用手機熱點或行動數據，連線穩定性較低"
  },
  "HOSTING_IP": {
    label: "機房 IP 信號",
    description: "檢測到資料中心或雲服務特徵",
    risk_impact: "連線穩定但可能涉及 VPN/Proxy 使用"
  },
  "DATACENTER": {
    label: "資料中心信號",
    description: "ASN 屬於資料中心或雲服務提供商",
    risk_impact: "非一般住宅用戶，可能為企業或代理連線"
  },
  "TRAFFIC_ANOMALY": {
    label: "流量異常信號",
    description: "偵測到流量模式異常",
    risk_impact: "連線可能不穩定或即將中斷"
  },
  "VPN_DETECTED": {
    label: "VPN 偵測",
    description: "偵測到 VPN 或代理連線特徵",
    risk_impact: "真實 IP 位置可能與顯示不同"
  },
  "PROXY_DETECTED": {
    label: "代理伺服器偵測",
    description: "偵測到代理伺服器特徵",
    risk_impact: "連線經過中繼，真實來源可能不同"
  },
  "HIGH_RISK_ASN": {
    label: "高風險 ASN",
    description: "該自治系統曾有異常紀錄",
    risk_impact: "需要額外注意該連線的安全性"
  }
};

const HOTSPOT_SIGNAL_CODES = new Set(["MOBILE_NETWORK", "MOBILE_POSSIBLE", "MOBILE_UNLIKELY"]);
const HOSTING_SIGNAL_CODES = new Set(["HOSTING_IP", "DATACENTER"]);
const OUTAGE_SIGNAL_CODES = new Set(["TRAFFIC_ANOMALY"]);

const SIGNAL_CODE_TO_GROUP = {
  MOBILE_NETWORK: "HOTSPOT",
  MOBILE_POSSIBLE: "HOTSPOT",
  MOBILE_UNLIKELY: "HOTSPOT",
  HOSTING_IP: "HOSTING",
  DATACENTER: "HOSTING",
  TRAFFIC_ANOMALY: "OUTAGE"
};

const SIGNAL_TOOLTIP_GROUPS = {
  HOTSPOT: {
    title: "行動熱點信號",
    defaultConclusion: "偵測到行動網路特徵",
    defaultImpact: "可能造成連線波動，建議必要時加做二次驗證",
    signalCodes: HOTSPOT_SIGNAL_CODES,
    keywords: ["MOBILE", "CELLULAR", "HOTSPOT"],
    sources: new Set(["ptr", "rpki_csv", "initial_classification"])
  },
  HOSTING: {
    title: "機房連線信號",
    defaultConclusion: "偵測到資料中心或機房連線特徵",
    defaultImpact: "連線通常較穩定，但需留意 VPN / Proxy 風險",
    signalCodes: HOSTING_SIGNAL_CODES,
    keywords: ["HOSTING", "DATACENTER", "CLOUD", "PROXY"],
    sources: new Set(["ptr", "rpki_csv", "initial_classification"])
  },
  OUTAGE: {
    title: "流量異常信號",
    defaultConclusion: "偵測到流量異常或斷線風險",
    defaultImpact: "可能影響可用性，建議優先檢查網路狀態",
    signalCodes: OUTAGE_SIGNAL_CODES,
    keywords: ["ANOMALY", "OUTAGE", "DROP", "TRAFFIC"],
    sources: new Set(["traffic"])
  }
};

async function getGoogleMapUrl(lat, lon) {
  try {
    const data = await callGoogleMapsAPI({ lat, lon });
    return data.embedUrl;
  } catch (error) {
    return "";
  }
}

function formatQueryContext(value) {
  if (!value) {
    return "N/A";
  }

  if (value === "Real-time Monitoring") {
    return "實時紀錄";
  }
  if (value === "Historical Forensics") {
    return "歷史模式";
  }

  return value;
}

function formatTimestampToUtc8(value) {
  if (!value) {
    return "N/A";
  }

  let date;
  if (typeof value === "number") {
    date = new Date(value < 1000000000000 ? value * 1000 : value);
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      date = new Date(numeric < 1000000000000 ? numeric * 1000 : numeric);
    } else {
      date = new Date(trimmed);
    }
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour12: false
  });
}

function formatStatus(value) {
  if (!value) {
    return "N/A";
  }
  const key = String(value).toLowerCase();
  return STATUS_LABELS[key] || value;
}

function formatCategory(value) {
  if (!value) {
    return "N/A";
  }
  const key = String(value).toLowerCase();
  return CATEGORY_LABELS[key] || value;
}

function formatAccessType(value) {
  if (!value) {
    return "N/A";
  }
  const key = String(value).toLowerCase().replace(/\s+/g, "_");
  return ACCESS_TYPE_LABELS[key] || value;
}

function formatUncertainty(value) {
  if (!value) {
    return "N/A";
  }
  const key = String(value).toLowerCase();
  return UNCERTAINTY_LABELS[key] || value;
}

function formatDataQuality(value) {
  if (!value) {
    return "N/A";
  }
  const key = String(value).toLowerCase();
  return DATA_QUALITY_LABELS[key] || value;
}

function formatHotspotLikelihood(value) {
  if (!value) {
    return "N/A";
  }
  const key = String(value).toLowerCase();
  return HOTSPOT_LIKELIHOOD_LABELS[key] || value;
}

function getConfidenceClass(uncertainty, dataQuality) {
  const uncertaintyKey = String(uncertainty || "").toLowerCase();
  const qualityKey = String(dataQuality || "").toLowerCase();
  
  if (uncertaintyKey === "very_high" || uncertaintyKey === "high" || qualityKey === "very_low" || qualityKey === "low") {
    return "confidence-low";
  }
  if (uncertaintyKey === "medium" || qualityKey === "medium") {
    return "confidence-medium";
  }
  return "confidence-high";
}

function getConfidenceLabelZh(uncertainty, dataQuality) {
  const uncertaintyKey = String(uncertainty || "").toLowerCase();
  const qualityKey = String(dataQuality || "").toLowerCase();
  
  if (uncertaintyKey === "very_high" || uncertaintyKey === "high" || qualityKey === "very_low" || qualityKey === "low") {
    return "低信賴";
  }
  if (uncertaintyKey === "medium" || qualityKey === "medium") {
    return "中信賴";
  }
  return "高信賴";
}

function getAccessTypeClass(accessType) {
  const key = String(accessType || "").toLowerCase();
  if (key.includes("vpn") || key.includes("proxy")) {
    return "access-type-vpn";
  }
  if (key.includes("mobile") || key.includes("cellular") || key.includes("hotspot")) {
    return "access-type-mobile";
  }
  if (key.includes("datacenter")) {
    return "access-type-datacenter";
  }
  return "access-type-normal";
}

// Portal-based Tooltip System
let activeTooltip = null;
let activeTooltipTrigger = null;
let tooltipHideTimer = null;
let tooltipPortalSeq = 0;

const COMPACT_TOOLTIP_VARIANT = {
  classNames: ["ip-tooltip-compact"],
  padding: 10,
  offset: 8,
  html: false
};

const TOOLTIP_VARIANTS = {
  text: COMPACT_TOOLTIP_VARIANT,
  compact: COMPACT_TOOLTIP_VARIANT,
  rich: {
    classNames: ["ip-tooltip-rich"],
    padding: 12,
    offset: 8,
    html: true
  }
};

function clearTooltipHideTimer() {
  if (tooltipHideTimer) {
    clearTimeout(tooltipHideTimer);
    tooltipHideTimer = null;
  }
}

function disposeActiveTooltip(immediate = false) {
  if (activeTooltipTrigger) {
    activeTooltipTrigger.removeAttribute("aria-describedby");
    activeTooltipTrigger = null;
  }

  if (!activeTooltip) {
    return;
  }
  const tooltipToRemove = activeTooltip;
  activeTooltip = null;

  if (tooltipToRemove._cleanup) {
    tooltipToRemove._cleanup();
  }

  if (immediate) {
    tooltipToRemove.remove();
    return;
  }

  tooltipToRemove.classList.remove("ip-tooltip-portal--visible");
  setTimeout(() => {
    tooltipToRemove.remove();
  }, 200);
}

function scheduleTooltipHide(delay = 150) {
  clearTooltipHideTimer();
  tooltipHideTimer = setTimeout(() => {
    removeTooltipPortal();
  }, delay);
}

function createTooltipPortal(content, triggerElement, options = {}) {
  if (!triggerElement) {
    return null;
  }
  const variant = TOOLTIP_VARIANTS[options.variant] || TOOLTIP_VARIANTS.compact;

  clearTooltipHideTimer();
  disposeActiveTooltip(true);

  const tooltip = document.createElement("div");
  tooltip.id = `ip-tooltip-portal-${++tooltipPortalSeq}`;
  tooltip.className = "ip-tooltip-portal";
  tooltip.setAttribute("role", "tooltip");
  variant.classNames.forEach((className) => tooltip.classList.add(className));

  if (variant.html) {
    tooltip.innerHTML = String(content || "");
  } else {
    tooltip.textContent = String(content || "");
  }

  document.body.appendChild(tooltip);

  const updatePosition = () => {
    const rect = triggerElement.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    tooltip.classList.remove("ip-tooltip-portal--below");
    let top = rect.top - tooltipRect.height - variant.offset;
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    const padding = variant.padding;

    if (top < padding) {
      top = rect.bottom + variant.offset;
      tooltip.classList.add("ip-tooltip-portal--below");
    }

    if (left < padding) {
      left = padding;
    }

    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  };

  requestAnimationFrame(() => {
    updatePosition();
    tooltip.classList.add("ip-tooltip-portal--visible");
  });

  const handleScroll = () => updatePosition();
  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      removeTooltipPortal();
    }
  };
  window.addEventListener("scroll", handleScroll, true);
  window.addEventListener("resize", handleScroll);
  document.addEventListener("keydown", handleKeydown);

  tooltip._cleanup = () => {
    window.removeEventListener("scroll", handleScroll, true);
    window.removeEventListener("resize", handleScroll);
    document.removeEventListener("keydown", handleKeydown);
  };

  triggerElement.setAttribute("aria-describedby", tooltip.id);
  activeTooltipTrigger = triggerElement;
  activeTooltip = tooltip;
  return tooltip;
}

function removeTooltipPortal() {
  clearTooltipHideTimer();
  disposeActiveTooltip(false);
}

function createRichTooltipPortal(htmlContent, triggerElement) {
  return createTooltipPortal(htmlContent, triggerElement, { variant: "rich" });
}

function bindTooltipTrigger(element, getContent, options = {}) {
  if (!element || typeof getContent !== "function") {
    return;
  }

  const variant = options.variant || "text";
  const hideDelay = Number.isFinite(options.hideDelay) ? options.hideDelay : 150;

  if (options.cursor) {
    element.style.cursor = options.cursor;
  }

  const showTooltip = () => {
    clearTooltipHideTimer();
    const content = getContent();
    if (content === undefined || content === null || content === "") {
      return;
    }
    if (variant === "rich") {
      createRichTooltipPortal(content, element);
      return;
    }
    createTooltipPortal(content, element, { variant });
  };

  const hideTooltip = () => {
    scheduleTooltipHide(hideDelay);
  };

  element.addEventListener("mouseenter", showTooltip);
  element.addEventListener("mouseleave", hideTooltip);

  if (options.showOnFocus) {
    element.addEventListener("focus", showTooltip);
    element.addEventListener("blur", () => {
      removeTooltipPortal();
    });
  }
}

function createInfoButton(tooltip) {
  const btn = document.createElement("span");
  btn.className = "ip-info-btn";
  btn.textContent = "?";
  btn.tabIndex = 0;
  btn.setAttribute("aria-label", tooltip);

  bindTooltipTrigger(btn, () => tooltip, {
    variant: "compact",
    hideDelay: 100,
    cursor: "help",
    showOnFocus: true
  });

  return btn;
}

// Tooltip content builders
function buildRiskBadgeTooltip(customData) {
  if (!customData || !customData.connection_stability_risk) {
    return "<div class=\"ip-tooltip-section\"><strong>資料不足</strong></div>";
  }

  const risk = customData.connection_stability_risk;
  const riskLevelZh = { LOW: "低", MEDIUM: "中", HIGH: "高", UNKNOWN: "未知" }[risk.risk_level] || risk.risk_level;
  const volatilityPercent = Math.round((risk.expected_volatility || 0) * 100);
  
  const dataQuality = risk.data_quality || {};
  const qualityGradeZh = formatDataQuality(dataQuality.grade);
  const uncertaintyZh = formatUncertainty(risk.uncertainty_grade);
  
  let html = `<div class="ip-tooltip-section">
    <div class="ip-tooltip-header">風險評估詳情</div>
    <div class="ip-tooltip-divider"></div>
    <div class="ip-tooltip-row"><span class="ip-tooltip-label">風險等級</span><span class="ip-tooltip-value ip-tooltip-value--${risk.risk_level?.toLowerCase() || 'unknown'}">${riskLevelZh}</span></div>
    <div class="ip-tooltip-row"><span class="ip-tooltip-label">風險評分</span><span class="ip-tooltip-value">${risk.risk_score || 0} / 100</span></div>
    <div class="ip-tooltip-row"><span class="ip-tooltip-label">期望波動率</span><span class="ip-tooltip-value">${volatilityPercent}%</span></div>
  </div>`;
  
  html += `<div class="ip-tooltip-section">
    <div class="ip-tooltip-subheader">判斷信心</div>
    <div class="ip-tooltip-row"><span class="ip-tooltip-label">數據品質</span><span class="ip-tooltip-value">${qualityGradeZh}</span></div>
    <div class="ip-tooltip-row"><span class="ip-tooltip-label">有效證據</span><span class="ip-tooltip-value">${dataQuality.evidence_count || 0} 項</span></div>
    <div class="ip-tooltip-row"><span class="ip-tooltip-label">不確定性</span><span class="ip-tooltip-value">${uncertaintyZh}</span></div>
    ${dataQuality.has_strong_signal ? '<div class="ip-tooltip-note">✓ 存在決定性證據</div>' : ''}
  </div>`;
  
  // Top evidence
  const layers = risk.layers || {};
  const evidence = layers.evidence || [];
  if (evidence.length > 0) {
    html += `<div class="ip-tooltip-section">
      <div class="ip-tooltip-subheader">主要風險來源</div>
      <ul class="ip-tooltip-list">`;
    
    evidence.slice(0, 3).forEach(evd => {
      const desc = evd.description || evd.signal || "";
      const reliability = evd.reliability ? ` (可靠度 ${Math.round(evd.reliability * 100)}%)` : "";
      html += `<li>${desc}${reliability}</li>`;
    });
    
    html += `</ul></div>`;
  }
  
  return html;
}

function buildAccessTypeTooltip(customData) {
  if (!customData || !customData.connection_stability_risk) {
    return "<div class=\"ip-tooltip-section\"><strong>資料不足</strong></div>";
  }

  const risk = customData.connection_stability_risk;
  const mostLikely = risk.most_likely_access || {};
  const layers = risk.layers || {};
  const posterior = layers.posterior || [];
  const prior = layers.prior || {};
  const evidence = layers.evidence || [];
  
  const typeLabel = mostLikely.label || formatAccessType(mostLikely.type);
  const probability = Math.round((mostLikely.probability || 0) * 100);
  const volatility = mostLikely.inherent_volatility || 0;
  
  let html = `<div class="ip-tooltip-section">
    <div class="ip-tooltip-header">連線類型判斷</div>
    <div class="ip-tooltip-divider"></div>
    <div class="ip-tooltip-row"><span class="ip-tooltip-label">最可能</span><span class="ip-tooltip-value">${typeLabel} (${probability}%)</span></div>
    <div class="ip-tooltip-row"><span class="ip-tooltip-label">固有波動</span><span class="ip-tooltip-value">${volatility.toFixed(2)} ${volatility > 0.5 ? '(高風險)' : '(穩定)'}</span></div>
  </div>`;
  
  // Other possibilities
  const alternatives = posterior.filter(p => p.access_type !== mostLikely.type && p.probability >= 0.10);
  if (alternatives.length > 0) {
    html += `<div class="ip-tooltip-section">
      <div class="ip-tooltip-subheader">其他可能</div>
      <ul class="ip-tooltip-list">`;
    
    alternatives.slice(0, 2).forEach(alt => {
      const altLabel = formatAccessType(alt.access_type);
      const altProb = Math.round(alt.probability * 100);
      html += `<li>${altLabel} ${altProb}%</li>`;
    });
    
    html += `</ul></div>`;
  }
  
  // Judgment basis
  html += `<div class="ip-tooltip-section">
    <div class="ip-tooltip-subheader">判斷依據</div>`;
  
  // Prior
  if (prior.source && prior.distribution) {
    const priorLabel = prior.label || prior.source;
    html += `<div class="ip-tooltip-subsection">
      <div class="ip-tooltip-note">[先驗] ${priorLabel}</div>`;
    
    const topPriors = Object.entries(prior.distribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    if (topPriors.length > 0) {
      html += `<div class="ip-tooltip-prior">`;
      topPriors.forEach(([type, prob]) => {
        const label = formatAccessType(type);
        html += `<span>${label} ${Math.round(prob * 100)}%</span>`;
      });
      html += `</div>`;
    }
    html += `</div>`;
  }
  
  // Evidence
  const relevantEvidence = evidence.filter(e => 
    e.source === 'ptr' || 
    e.source === 'rpki_csv' || 
    e.source === 'initial_classification' ||
    e.signal?.includes('hosting') ||
    e.signal?.includes('mobile')
  );
  
  if (relevantEvidence.length > 0) {
    html += `<div class="ip-tooltip-subsection">
      <div class="ip-tooltip-note">[證據]</div>
      <ul class="ip-tooltip-list ip-tooltip-list--compact">`;
    
    relevantEvidence.slice(0, 3).forEach(evd => {
      const desc = evd.description || evd.signal || "";
      html += `<li>✓ ${desc}</li>`;
    });
    
    html += `</ul></div>`;
  }
  
  html += `</div>`;
  
  return html;
}

function getRiskAttributionSummary(customData) {
  const summary = formatValue(customData?.connection_stability_risk?.summary, "");
  if (summary) {
    return summary;
  }

  const risk = customData?.connection_stability_risk || {};
  const riskLevel = String(risk.risk_level || "").toUpperCase();
  const riskLevelZh = { LOW: "低", MEDIUM: "中", HIGH: "高", UNKNOWN: "未知" }[riskLevel] || "未知";
  const mostLikely = risk.most_likely_access || {};
  const accessLabel = mostLikely.label || formatAccessType(mostLikely.type);
  const score = Number(risk.risk_score);
  const scoreText = Number.isFinite(score) ? `${score} / 100` : "N/A";

  if (accessLabel && accessLabel !== "N/A") {
    return `最可能連線型態：${accessLabel}；風險等級 ${riskLevelZh}（${scoreText}）`;
  }
  return `風險等級 ${riskLevelZh}（${scoreText}）`;
}

function buildRiskAttributionTooltip(customData) {
  if (!customData || !customData.connection_stability_risk) {
    return "<div class=\"ip-tooltip-section\"><strong>資料不足</strong></div>";
  }

  const risk = customData.connection_stability_risk;
  const summary = getRiskAttributionSummary(customData);
  const riskLevel = String(risk.risk_level || "UNKNOWN").toUpperCase();
  const riskLevelZh = { LOW: "低", MEDIUM: "中", HIGH: "高", UNKNOWN: "未知" }[riskLevel] || riskLevel;
  const score = Number(risk.risk_score);
  const scoreText = Number.isFinite(score) ? `${score} / 100` : "N/A";
  const uncertaintyText = formatUncertainty(risk.uncertainty_grade || "N/A");
  const qualityText = formatDataQuality((risk.data_quality && risk.data_quality.grade) || "N/A");
  const evidenceCount = risk.data_quality && Number.isFinite(Number(risk.data_quality.evidence_count))
    ? Number(risk.data_quality.evidence_count)
    : getSignalEvidenceList(customData).length;

  let html = `<div class="ip-tooltip-section">
    <div class="ip-tooltip-header">風險歸因詳情</div>
    <div class="ip-tooltip-divider"></div>
    <div class="ip-tooltip-text">${escapeHtml(summary)}</div>
  </div>`;

  html += `<div class="ip-tooltip-section">
    <div class="ip-tooltip-subheader">判斷概況</div>
    <div class="ip-tooltip-row"><span class="ip-tooltip-label">風險等級</span><span class="ip-tooltip-value ip-tooltip-value--${riskLevel.toLowerCase()}">${riskLevelZh}</span></div>
    <div class="ip-tooltip-row"><span class="ip-tooltip-label">風險分數</span><span class="ip-tooltip-value">${scoreText}</span></div>
    <div class="ip-tooltip-row"><span class="ip-tooltip-label">不確定性</span><span class="ip-tooltip-value">${uncertaintyText}</span></div>
    <div class="ip-tooltip-row"><span class="ip-tooltip-label">數據品質</span><span class="ip-tooltip-value">${qualityText}</span></div>
    <div class="ip-tooltip-row"><span class="ip-tooltip-label">證據數量</span><span class="ip-tooltip-value">${evidenceCount} 項</span></div>
  </div>`;

  const evidence = getSignalEvidenceList(customData)
    .slice()
    .sort((a, b) => (Number(b.reliability) || 0) - (Number(a.reliability) || 0))
    .slice(0, 3);

  if (evidence.length > 0) {
    html += `<div class="ip-tooltip-section">
      <div class="ip-tooltip-subheader">關鍵證據</div>
      <ul class="ip-tooltip-list">`;

    evidence.forEach((evd) => {
      const description = evd.description || evd.signal || evd.raw_value || "無描述";
      const source = evd.source ? ` / ${evd.source}` : "";
      const reliability = Number(evd.reliability);
      const reliabilityText = Number.isFinite(reliability) && reliability > 0
        ? `（可靠度 ${Math.round(reliability * 100)}%${source}）`
        : (source ? `（來源 ${evd.source}）` : "");
      html += `<li>${escapeHtml(`${description}${reliabilityText}`)}</li>`;
    });

    html += `</ul></div>`;
  }

  return html;
}

function normalizeSignalCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shortenTooltipText(value, maxLength = 68) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

function getSignalGroupConfig(signalCode, groupKey = "") {
  const resolvedGroupKey = String(groupKey || SIGNAL_CODE_TO_GROUP[signalCode] || "").toUpperCase();
  return SIGNAL_TOOLTIP_GROUPS[resolvedGroupKey] || null;
}

function getSignalTooltipContext(tagOrSignal) {
  if (tagOrSignal && typeof tagOrSignal === "object") {
    const signalCode = normalizeSignalCode(tagOrSignal.signalCode || tagOrSignal.signal);
    const text = formatValue(tagOrSignal.text || signalCode, "SIGNAL");
    const groupKey = String(tagOrSignal.groupKey || SIGNAL_CODE_TO_GROUP[signalCode] || "").toUpperCase();
    return { text, signalCode, groupKey };
  }

  const text = formatValue(tagOrSignal, "SIGNAL");
  const signalCode = normalizeSignalCode(text);
  const groupKey = String(SIGNAL_CODE_TO_GROUP[signalCode] || "").toUpperCase();
  return { text, signalCode, groupKey };
}

function getSignalEvidenceList(customData) {
  const layers = customData?.connection_stability_risk?.layers || customData?.layers || {};
  return Array.isArray(layers.evidence) ? layers.evidence.filter(Boolean) : [];
}

function scoreSignalEvidence(evidence, signalCode, groupConfig) {
  const evidenceSignal = normalizeSignalCode(evidence.signal);
  const evidenceText = `${String(evidence.description || "")} ${String(evidence.raw_value || "")}`.toUpperCase();
  let score = 0;

  if (signalCode && evidenceSignal === signalCode) {
    score += 8;
  }

  if (groupConfig?.signalCodes instanceof Set && groupConfig.signalCodes.has(evidenceSignal)) {
    score += 6;
  }

  if (signalCode) {
    const signalToken = signalCode.replace(/_/g, " ");
    if (evidenceText.includes(signalToken)) {
      score += 2;
    }
  }

  const keywords = Array.isArray(groupConfig?.keywords) ? groupConfig.keywords : [];
  keywords.forEach((keyword) => {
    if (evidenceText.includes(String(keyword).toUpperCase())) {
      score += 2;
    }
  });

  const source = String(evidence.source || "").toLowerCase();
  if (groupConfig?.sources instanceof Set && groupConfig.sources.has(source)) {
    score += 1;
  }

  score += Number(evidence.reliability) || 0;
  return score;
}

function findTopSignalEvidence(customData, signalCode, groupConfig) {
  const scoredEvidence = getSignalEvidenceList(customData)
    .map((evidence) => ({
      evidence,
      score: scoreSignalEvidence(evidence, signalCode, groupConfig)
    }))
    .filter((entry) => entry.score > 0);

  if (!scoredEvidence.length) {
    return null;
  }

  scoredEvidence.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (Number(b.evidence.reliability) || 0) - (Number(a.evidence.reliability) || 0);
  });

  return scoredEvidence[0].evidence;
}

function formatSignalEvidence(evidence) {
  if (!evidence) {
    return "無直接證據（僅模型信號）";
  }

  const description = shortenTooltipText(evidence.description || evidence.signal || evidence.raw_value || "無描述", 62);
  const reliability = Number(evidence.reliability);
  if (Number.isFinite(reliability) && reliability > 0) {
    return `${description}（可靠度 ${Math.round(reliability * 100)}%）`;
  }
  return description;
}

function getDataQualityGrade(customData) {
  const riskQuality = customData?.connection_stability_risk?.data_quality;
  if (typeof riskQuality === "string") {
    return riskQuality;
  }
  if (riskQuality && typeof riskQuality === "object" && riskQuality.grade) {
    return riskQuality.grade;
  }

  const legacyQuality = customData?.risk_assessment?.data_quality;
  if (typeof legacyQuality === "string") {
    return legacyQuality;
  }
  if (legacyQuality && typeof legacyQuality === "object" && legacyQuality.grade) {
    return legacyQuality.grade;
  }
  return "";
}

function buildSignalConfidenceSummary(customData, groupKey) {
  const uncertaintyRaw =
    customData?.connection_stability_risk?.uncertainty_grade ||
    customData?.risk_assessment?.uncertainty_grade ||
    customData?.network_health?.uncertainty ||
    "";
  const dataQualityRaw = getDataQualityGrade(customData);
  const uncertaintyText = formatUncertainty(uncertaintyRaw || "N/A");
  const dataQualityText = formatDataQuality(dataQualityRaw || "N/A");

  const parts = [`不確定性 ${uncertaintyText}`, `數據品質 ${dataQualityText}`];
  if (groupKey === "HOTSPOT") {
    const hotspotConfidence = Math.round(customData?.mobile_hotspot_assessment?.confidence || 0);
    if (hotspotConfidence > 0) {
      parts.push(`熱點信心 ${hotspotConfidence}%`);
    }
  }
  return parts.join(" / ");
}

function buildSignalCardTooltip({ title, signalCode, conclusion, evidence, confidence, impact }) {
  const header = signalCode ? `${title} (${signalCode})` : title;
  return `<div class="ip-tooltip-section">
    <div class="ip-tooltip-header">${escapeHtml(header)}</div>
    <div class="ip-tooltip-divider"></div>
    <div class="ip-tooltip-subheader">結論</div>
    <div class="ip-tooltip-text">${escapeHtml(conclusion)}</div>
  </div>
  <div class="ip-tooltip-section">
    <div class="ip-tooltip-subheader">主因證據</div>
    <div class="ip-tooltip-text">${escapeHtml(evidence)}</div>
  </div>
  <div class="ip-tooltip-section">
    <div class="ip-tooltip-subheader">可信度</div>
    <div class="ip-tooltip-text">${escapeHtml(confidence)}</div>
  </div>
  <div class="ip-tooltip-section">
    <div class="ip-tooltip-subheader">風險影響</div>
    <div class="ip-tooltip-text">${escapeHtml(impact)}</div>
  </div>`;
}

function buildSignalTooltip(tagOrSignal, customData) {
  const { text, signalCode, groupKey } = getSignalTooltipContext(tagOrSignal);
  const explanation = SIGNAL_EXPLANATIONS[signalCode];
  const groupConfig = getSignalGroupConfig(signalCode, groupKey);

  let title = explanation?.label || groupConfig?.title || `${text} 信號`;
  let conclusion = explanation?.description || groupConfig?.defaultConclusion || "偵測到特定風險特徵";
  let impact = explanation?.risk_impact || groupConfig?.defaultImpact || "建議搭配其他風險訊號一起判讀";

  if (groupKey === "HOTSPOT") {
    const assessment = customData?.mobile_hotspot_assessment || {};
    const likelihood = assessment.likelihood ? formatHotspotLikelihood(assessment.likelihood) : "";
    const posterior = Math.round((assessment.posterior_probability || 0) * 100);
    if (likelihood && posterior > 0) {
      conclusion = `${likelihood}（後驗機率 ${posterior}%）`;
    } else if (likelihood) {
      conclusion = `${likelihood}（模型評估）`;
    }

    const expectedVolatility = Math.round((customData?.connection_stability_risk?.expected_volatility || 0) * 100);
    if (expectedVolatility > 0) {
      impact = `期望波動率 ${expectedVolatility}%；${groupConfig?.defaultImpact || impact}`;
    }
  } else if (groupKey === "HOSTING") {
    const isHosting = Boolean(customData?.risk_assessment?.is_hosting);
    if (isHosting) {
      conclusion = "模型判定為資料中心 / 機房連線";
    }

    const expectedVolatility = Math.round((customData?.connection_stability_risk?.expected_volatility || 0) * 100);
    if (expectedVolatility > 0) {
      impact = `期望波動率 ${expectedVolatility}%；需留意代理與來源真實性`;
    }
  } else if (groupKey === "OUTAGE") {
    const status = formatStatus(customData?.network_health?.status || "N/A");
    const trend = formatValue(customData?.network_health?.traffic_trend, "N/A");
    conclusion = `狀態 ${status} / 流量趨勢 ${trend}`;
    impact = "該 IP 可能無法穩定連線，建議優先檢查網路狀態";
  }

  const topEvidence = findTopSignalEvidence(customData, signalCode, groupConfig);
  let evidenceText = formatSignalEvidence(topEvidence);
  if (!topEvidence && groupKey === "HOTSPOT") {
    const decisionSummary = customData?.mobile_hotspot_assessment?.decision_summary;
    if (decisionSummary) {
      evidenceText = shortenTooltipText(decisionSummary, 62);
    }
  }

  const confidenceText = buildSignalConfidenceSummary(customData, groupKey);
  return buildSignalCardTooltip({
    title,
    signalCode,
    conclusion,
    evidence: evidenceText,
    confidence: confidenceText,
    impact
  });
}

function formatValue(value, fallback = "N/A") {
  if (value === null || value === undefined) {
    return fallback;
  }
  const text = String(value).trim();
  return text ? text : fallback;
}

function getRiskClass(score) {
  const normalized = String(score || "").toUpperCase();
  if (normalized === "LOW") {
    return "ip-badge--low";
  }
  if (normalized === "MEDIUM") {
    return "ip-badge--medium";
  }
  if (normalized === "HIGH") {
    return "ip-badge--high";
  }
  return "ip-badge--unknown";
}

function getRiskLabelZh(score) {
  const normalized = String(score || "").toUpperCase();
  if (normalized === "LOW") {
    return "低";
  }
  if (normalized === "MEDIUM") {
    return "中";
  }
  if (normalized === "HIGH") {
    return "高";
  }
  return "未知";
}

function ensureElementIsDiv(id) {
  const element = document.getElementById(id);
  if (!element) {
    return null;
  }

  if (element.tagName.toLowerCase() === "div") {
    return element;
  }

  const replacement = document.createElement("div");
  replacement.id = element.id;
  replacement.className = element.className;
  replacement.style.cssText = element.style.cssText;
  while (element.firstChild) {
    replacement.appendChild(element.firstChild);
  }
  if (element.parentNode) {
    element.parentNode.replaceChild(replacement, element);
  }
  return replacement;
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function createStatItem(label, value, options = {}) {
  const item = document.createElement("div");
  item.className = "ip-stat";
  if (options.className) {
    String(options.className)
      .split(" ")
      .filter(Boolean)
      .forEach((name) => item.classList.add(name));
  }
  if (options.wide) {
    item.classList.add("ip-stat--wide");
  }
  if (options.wrap) {
    item.classList.add("ip-stat--wrap");
  }

  const labelContainer = document.createElement("span");
  labelContainer.className = "ip-stat__label-container";
  
  const labelElement = createTextElement("span", "ip-stat__label", label);
  labelContainer.appendChild(labelElement);
  
  if (options.tooltip) {
    const infoBtn = createInfoButton(options.tooltip);
    labelContainer.appendChild(infoBtn);
  }
  
  const valueElement = createTextElement("span", "ip-stat__value", value);
  if (options.title) {
    valueElement.title = options.title;
  }
  
  item.appendChild(labelContainer);
  item.appendChild(valueElement);
  return item;
}

function normalizeQueryDate(value) {
  if (!value) {
    return "";
  }
  const trimmed = String(value).trim();
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
}

function parseIpQuery(rawValue) {
  const trimmed = String(rawValue || "").trim();
  if (!trimmed) {
    return { ip: "", date: "" };
  }

  const match = trimmed.match(/^(.+?)[\s+]+(\d{8}|\d{4}-\d{2}-\d{2})$/);
  if (!match) {
    return { ip: trimmed, date: "" };
  }

  return {
    ip: match[1].trim(),
    date: normalizeQueryDate(match[2])
  };
}

function getSearchSpinner() {
  const existing = document.getElementById("ip_search_spinner");
  if (existing) {
    return existing;
  }

  const ipInput = document.getElementById("ip_input");
  if (!ipInput || !ipInput.parentElement) {
    return null;
  }

  const spinner = document.createElement("span");
  spinner.id = "ip_search_spinner";
  spinner.className = "ip-search-spinner";
  spinner.setAttribute("aria-hidden", "true");
  ipInput.parentElement.insertBefore(spinner, ipInput.nextSibling);
  return spinner;
}

function setSearchSpinnerVisible(isVisible) {
  const spinner = getSearchSpinner();
  if (!spinner) {
    return;
  }

  spinner.classList.toggle("is-visible", isVisible);
  spinner.setAttribute("aria-hidden", isVisible ? "false" : "true");
}

async function IP_handleIpInput(ip, date) {
  const ipinfoToken = "5da0a6c614f15b";
  const requestSeq = ++ipSearchSeq;
  setSearchSpinnerVisible(true);

  const ipinfoPromise = fetch(`https://ipinfo.io/${ip}?token=${ipinfoToken}`).then((res) => res.json());
  const customApiUrl = date
    ? `${IP_SEARCH_API_BASE}${ip}?date=${encodeURIComponent(date)}`
    : `${IP_SEARCH_API_BASE}${ip}`;
  const customApiPromise = fetch(customApiUrl).then((res) => res.json());

  try {
    const [ipinfoData, customData] = await Promise.all([ipinfoPromise, customApiPromise]);

    const identity = customData && customData.identity ? customData.identity : {};
    const countryCode = formatValue(identity.country || ipinfoData.country, "N/A");
    const regionNames = new Intl.DisplayNames(["zh-TW"], { type: "region" });
    let countryDisplay = countryCode;
    try {
      if (countryCode.length === 2) {
        const localized = regionNames.of(countryCode);
        if (localized) {
          countryDisplay = localized;
        }
      }
    } catch (error) {
      // Keep the fallback display on any Intl failure.
    }

    const city = typeof ipinfoData.city === "string" ? ipinfoData.city.trim() : "";
    const locationDisplay = city ? `${countryDisplay} / ${city}` : countryDisplay;

    const ispDisplay = formatValue(
      identity.isp || identity.org_original || identity.org_raw || ipinfoData.org,
      "N/A"
    );

    let asnDisplay = formatValue(identity.asn, "");
    if (!asnDisplay && typeof ipinfoData.org === "string") {
      const asnMatch = ipinfoData.org.match(/AS\d+/i);
      if (asnMatch) {
        asnDisplay = asnMatch[0].toUpperCase();
      }
    }
    asnDisplay = asnDisplay ? asnDisplay : "ASN N/A";

    const networkHealth = customData && customData.network_health ? customData.network_health : {};
    const riskScore = formatValue(networkHealth.risk_score, "UNKNOWN").toUpperCase();
    const riskBadgeClass = getRiskClass(riskScore);
    const riskLabel = getRiskLabelZh(riskScore);

    // API v3: Extract confidence metrics
    const riskAssessment = customData && customData.risk_assessment ? customData.risk_assessment : {};
    const uncertaintyGrade = riskAssessment.uncertainty_grade || networkHealth.uncertainty || "";
    const dataQuality = riskAssessment.data_quality || "";
    const confidenceClass = getConfidenceClass(uncertaintyGrade, dataQuality);
    const confidenceLabel = getConfidenceLabelZh(uncertaintyGrade, dataQuality);
    const uncertaintyDisplay = formatUncertainty(uncertaintyGrade);
    const dataQualityDisplay = formatDataQuality(dataQuality);

    // API v3: Access type (scenario reconstruction)
    const accessType = riskAssessment.most_likely_access || identity.access_type || "";
    const accessTypeDisplay = formatAccessType(accessType);
    const accessTypeClass = getAccessTypeClass(accessType);

    // API v3: Mobile hotspot assessment
    const hotspotAssessment = customData && customData.mobile_hotspot_assessment ? customData.mobile_hotspot_assessment : {};
    const hotspotLikelihood = hotspotAssessment.likelihood || "";
    const hotspotConfidence = hotspotAssessment.confidence || 0;
    const hotspotLikelihoodDisplay = formatHotspotLikelihood(hotspotLikelihood);

    const riskAttributionSummary = getRiskAttributionSummary(customData);

    const statusCode = formatValue(networkHealth.status, "");
    const statusFallback = statusCode ? formatStatus(statusCode) : "";
    const statusDisplay = formatValue(networkHealth.description || statusFallback || statusCode, "N/A");
    const statusTitle = statusCode ? `狀態代碼: ${statusCode}` : statusDisplay;

    const trafficTrend = formatValue(networkHealth.traffic_trend, "N/A");
    const bgpPrefix = formatValue(
      networkHealth.bgp_prefix || (customData.network && customData.network.bgp_prefix),
      "N/A"
    );
    const categoryDisplay = formatValue(formatCategory(identity.category), "N/A");

    const hostname = formatValue(
      networkHealth.ptr || (customData.network && customData.network.ptr) || ipinfoData.hostname,
      "N/A"
    );

    const rawSignals = Array.isArray(customData.risk_signals)
      ? customData.risk_signals
      : Array.isArray(customData.risk_assessment && customData.risk_assessment.signals)
        ? customData.risk_assessment.signals
        : [];
    const signals = rawSignals
      .map((signal) => String(signal || "").trim().toUpperCase())
      .filter(Boolean);

    const tags = [];
    const seenTags = new Set();
    const pushTag = ({ text, className, signalCode, groupKey = "" }) => {
      const normalizedSignalCode = normalizeSignalCode(signalCode || text);
      const resolvedGroupKey = String(groupKey || SIGNAL_CODE_TO_GROUP[normalizedSignalCode] || "GENERIC").toUpperCase();
      const dedupeKey = `${resolvedGroupKey}:${normalizedSignalCode}`;
      if (seenTags.has(dedupeKey)) {
        return;
      }
      seenTags.add(dedupeKey);
      tags.push({
        text,
        className,
        signalCode: normalizedSignalCode,
        groupKey: resolvedGroupKey
      });
    };

    const hostnameLower = hostname.toLowerCase();
    const categoryLower = String(identity.category || "").toLowerCase();
    const statusLower = String(networkHealth.status || "").toLowerCase();

    const isMobile =
      signals.includes("MOBILE_NETWORK") ||
      /mobile|cellular|emome/i.test(hostnameLower) ||
      /mobile|cellular/i.test(categoryLower) ||
      (hotspotLikelihood && !["unlikely", "very_unlikely"].includes(String(hotspotLikelihood).toLowerCase()));
    
    if (isMobile) {
      const mobileSignalCode = signals.find((signal) => HOTSPOT_SIGNAL_CODES.has(signal)) || "MOBILE_NETWORK";
      const likelihoodKey = String(hotspotLikelihood || "").toLowerCase();
      if (likelihoodKey === "certain" || likelihoodKey === "highly_probable") {
        pushTag({
          text: `HOTSPOT (確定 ${Math.round(hotspotConfidence)}%)`,
          className: "ip-tag--mobile ip-tag--certain",
          signalCode: mobileSignalCode,
          groupKey: "HOTSPOT"
        });
      } else if (likelihoodKey === "probable" || likelihoodKey === "possible") {
        pushTag({
          text: `疑似熱點 (${hotspotLikelihoodDisplay} ${Math.round(hotspotConfidence)}%)`,
          className: "ip-tag--mobile ip-tag--possible",
          signalCode: mobileSignalCode,
          groupKey: "HOTSPOT"
        });
      } else {
        pushTag({
          text: "HOTSPOT",
          className: "ip-tag--mobile",
          signalCode: mobileSignalCode,
          groupKey: "HOTSPOT"
        });
      }
    }

    const isHosting =
      signals.includes("HOSTING_IP") ||
      signals.includes("DATACENTER") ||
      Boolean(customData.risk_assessment && customData.risk_assessment.is_hosting);
    if (isHosting) {
      const hostingSignalCode = signals.includes("HOSTING_IP") ? "HOSTING_IP" : "DATACENTER";
      pushTag({
        text: "HOSTING",
        className: "ip-tag--hosting",
        signalCode: hostingSignalCode,
        groupKey: "HOSTING"
      });
    }

    const isOutage =
      signals.includes("TRAFFIC_ANOMALY") ||
      statusLower === "outage" ||
      statusLower === "inactive";
    if (isOutage) {
      pushTag({
        text: "OUTAGE",
        className: "ip-tag--outage",
        signalCode: "TRAFFIC_ANOMALY",
        groupKey: "OUTAGE"
      });
    }

    signals.forEach((signal) => {
      if (
        HOTSPOT_SIGNAL_CODES.has(signal) ||
        HOSTING_SIGNAL_CODES.has(signal) ||
        OUTAGE_SIGNAL_CODES.has(signal)
      ) {
        return;
      }
      pushTag({
        text: signal.replace(/_/g, " "),
        className: "ip-tag--signal",
        signalCode: signal
      });
    });

    const queryContextDisplay = formatQueryContext(customData && customData.query_context);
    const timestampDisplay = formatTimestampToUtc8(customData && customData.timestamp);
    const modeValue = formatValue(customData && customData.mode, "N/A");
    let modeLabel = modeValue;
    if (/cloudflare radar/i.test(modeValue)) {
      modeLabel = "Cloudflare資訊";
    } else if (/legacy fallback/i.test(modeValue) || /legacy/i.test(modeValue)) {
      modeLabel = "Legacy資訊";
    }

    const ipResultContainer = document.getElementById("ip_result_container");
    const countryElement = ensureElementIsDiv("ip_country");
    const orgElement = ensureElementIsDiv("ip_org");

    if (countryElement) {
      countryElement.textContent = "";
      countryElement.style.display = "none";
    }
    if (orgElement) {
      orgElement.textContent = "";
      orgElement.style.display = "";
    }

    if (orgElement) {
      const dashboard = document.createElement("div");
      dashboard.className = "ip-dashboard";

      const header = document.createElement("div");
      header.className = "ip-dashboard__header";
      const locationElement = createTextElement("div", "ip-dashboard__location", locationDisplay);
      locationElement.title = locationDisplay;
      
      const badgesContainer = document.createElement("div");
      badgesContainer.className = "ip-dashboard__badges";
      
      const riskBadge = createTextElement("span", `ip-badge ${riskBadgeClass}`, `風險 ${riskLabel}`);
      bindTooltipTrigger(riskBadge, () => buildRiskBadgeTooltip(customData), {
        variant: "rich",
        hideDelay: 150,
        cursor: "pointer"
      });
      
      badgesContainer.appendChild(riskBadge);
      
      if (uncertaintyGrade || dataQuality) {
        const confidenceBadge = createTextElement(
          "span", 
          `ip-badge ip-confidence-badge ${confidenceClass}`, 
          confidenceLabel
        );
        confidenceBadge.title = `不確定性: ${uncertaintyDisplay} | 數據品質: ${dataQualityDisplay}`;
        bindTooltipTrigger(confidenceBadge, () => buildRiskBadgeTooltip(customData), {
          variant: "rich",
          hideDelay: 150,
          cursor: "pointer"
        });
        
        badgesContainer.appendChild(confidenceBadge);
      }
      
      header.appendChild(locationElement);
      header.appendChild(badgesContainer);

      const identityElement = document.createElement("div");
      identityElement.className = "ip-dashboard__identity";
      
      const topRow = document.createElement("div");
      topRow.className = "ip-dashboard__identity-row";
      
      const asnElement = createTextElement("div", "ip-dashboard__asn", asnDisplay);
      topRow.appendChild(asnElement);
      
      if (accessType) {
        const accessElement = createTextElement("div", `ip-dashboard__access ${accessTypeClass}`, accessTypeDisplay);
        accessElement.title = `連線類型: ${accessTypeDisplay}`;
        bindTooltipTrigger(accessElement, () => buildAccessTypeTooltip(customData), {
          variant: "rich",
          hideDelay: 150,
          cursor: "pointer"
        });
        
        topRow.appendChild(accessElement);
      }
      
      identityElement.appendChild(topRow);
      
      const ispElement = createTextElement("div", "ip-dashboard__isp", ispDisplay);
      ispElement.title = ispDisplay;
      identityElement.appendChild(ispElement);

      const statusItem = createStatItem("狀態", statusDisplay, {
        title: statusTitle,
        wide: true,
        className: "ip-stat--status",
        tooltip: statusCode ? `狀態代碼: ${statusCode}` : ""
      });

      const grid = document.createElement("div");
      grid.className = "ip-dashboard__grid";
      grid.appendChild(createStatItem("類型", categoryDisplay, { 
        title: categoryDisplay,
        tooltip: "使用者所屬的網路類別分類" 
      }));
      grid.appendChild(createStatItem("BGP 前綴", bgpPrefix, { 
        title: bgpPrefix,
        tooltip: "該 IP 所屬的 BGP 路由前綴段" 
      }));
      grid.appendChild(createStatItem("流量趋勢", trafficTrend, { 
        title: trafficTrend,
        tooltip: "近期網路流量的變化趋勢" 
      }));
      grid.appendChild(createStatItem("查詢模式", queryContextDisplay, { 
        title: queryContextDisplay,
        tooltip: "實時追蹤或歷史模式查詢" 
      }));

      const hostnameItem = createStatItem("主機名", hostname, {
        title: hostname,
        wide: true,
        wrap: true
      });

      const footer = document.createElement("div");
      footer.className = "ip-dashboard__footer";
      footer.appendChild(createTextElement("span", "", modeLabel));
      footer.appendChild(createTextElement("span", "", timestampDisplay));

      dashboard.appendChild(header);
      dashboard.appendChild(identityElement);
      dashboard.appendChild(statusItem);
      dashboard.appendChild(grid);
      dashboard.appendChild(hostnameItem);

      // API v3: Risk Attribution Summary (details in hover card)
      if (customData && customData.connection_stability_risk) {
        const evidenceSection = document.createElement("div");
        evidenceSection.className = "ip-dashboard__evidence";
        
        const evidenceHeader = document.createElement("div");
        evidenceHeader.className = "ip-dashboard__evidence-header";
        evidenceHeader.textContent = "風險歸因";

        const evidenceHeaderInfo = createInfoButton("滑入下方摘要可查看完整歸因細節");
        evidenceHeader.appendChild(evidenceHeaderInfo);
        evidenceSection.appendChild(evidenceHeader);

        const summaryText = createTextElement("div", "ip-dashboard__evidence-summary", riskAttributionSummary);
        summaryText.title = riskAttributionSummary;
        bindTooltipTrigger(summaryText, () => buildRiskAttributionTooltip(customData), {
          variant: "rich",
          hideDelay: 150,
          cursor: "pointer",
          showOnFocus: true
        });
        evidenceSection.appendChild(summaryText);

        dashboard.appendChild(evidenceSection);
      }

      if (tags.length) {
        const tagsElement = document.createElement("div");
        tagsElement.className = "ip-dashboard__tags";
        tags.forEach((tag) => {
          const tagElement = createTextElement("span", `ip-tag ${tag.className}`, tag.text);
          tagElement.dataset.signalCode = tag.signalCode;
          bindTooltipTrigger(tagElement, () => buildSignalTooltip(tag, customData), {
            variant: "rich",
            hideDelay: 150,
            cursor: "pointer"
          });
          
          tagsElement.appendChild(tagElement);
        });
        dashboard.appendChild(tagsElement);
      }

      dashboard.appendChild(footer);
      orgElement.appendChild(dashboard);
    }

    const oldHostname = document.getElementById("ip_hostname");
    if (oldHostname) {
      oldHostname.remove();
    }

    if (ipResultContainer) {
      ipResultContainer.classList.add("hasResult");
    }


    let ipMapContainer = document.getElementById("ip_map");
    if (!ipMapContainer) {
      ipMapContainer = document.createElement("div");
      ipMapContainer.id = "ip_map";
      ipMapContainer.style.width = "100%";
      ipMapContainer.style.height = "160px";
      ipMapContainer.style.margin = "8px auto 0";
      ipMapContainer.style.borderRadius = "6px";
      ipMapContainer.style.overflow = "hidden";
      if (ipResultContainer) {
        ipResultContainer.appendChild(ipMapContainer);
      }
    }
    ipMapContainer.style.display = "";

    if (ipinfoData.loc) {
      const [lat, lon] = ipinfoData.loc.split(",");
      const embedUrl = await getGoogleMapUrl(lat, lon);
      if (embedUrl) {
        ipMapContainer.innerHTML = `<iframe width="100%" height="100%" frameborder="0" style="border:0; width:100%; height:100%;" src="${embedUrl}" allowfullscreen></iframe>`;
      } else {
        ipMapContainer.innerHTML = "";
        ipMapContainer.style.display = "none";
      }
    } else {
      ipMapContainer.innerHTML = "";
      ipMapContainer.style.display = "none";
    }

    ensureResultOrder();

    requestAnimationFrame(() => {
      adjustHeight(true);
    });
  } catch (error) {
    IP_clearOutput();
    const countryElement = document.getElementById("ip_country");
    const orgElement = document.getElementById("ip_org");

    countryElement.style.display = "";
    orgElement.style.display = "";

    countryElement.textContent = "錯誤：";
    orgElement.textContent = "查詢失敗";
    console.error("IP Search Error:", error);

    ensureResultOrder();

    requestAnimationFrame(() => {
      adjustHeight(true);
    });
  } finally {
    if (requestSeq === ipSearchSeq) {
      setSearchSpinnerVisible(false);
    }
  }
}

function IP_clearOutput() {
  const countryElement = document.getElementById("ip_country");
  const orgElement = document.getElementById("ip_org");

  if (countryElement) {
    countryElement.textContent = "";
    countryElement.style.display = "none";
  }
  if (orgElement) {
    orgElement.textContent = "";
    orgElement.style.display = "none";
  }

  const hostnameElement = document.getElementById("ip_hostname");
  if (hostnameElement) {
    hostnameElement.remove();
  }

  const mapElement = document.getElementById("ip_map");
  if (mapElement) {
    mapElement.remove();
  }

  const ipResultContainer = document.getElementById("ip_result_container");
  if (ipResultContainer) {
    ipResultContainer.classList.remove("hasResult");
  }

  setSearchSpinnerVisible(false);
  adjustHeightToMin();
}

function ensureResultOrder() {
  const ipResultContainer = document.getElementById("ip_result_container");
  if (!ipResultContainer) {
    return;
  }

  const countryElement = document.getElementById("ip_country");
  const orgElement = document.getElementById("ip_org");
  const hostnameElement = document.getElementById("ip_hostname");
  const mapElement = document.getElementById("ip_map");

  [countryElement, orgElement, hostnameElement, mapElement].forEach((element) => {
    if (element) {
      ipResultContainer.appendChild(element);
    }
  });
}

const container = document.querySelector(".IPsearch_in_panelALL");
const ipInput = document.getElementById("ip_input");
const DEFAULT_PLACEHOLDER = "請輸入 IP (支援 IPv4/IPv6)";

function adjustHeightToMin() {
  if (!container) {
    return;
  }

  if (typeof log === "function") {
    log("adjustHeightToMin_call", {
      MIN_PANEL_HEIGHT: MIN_PANEL_HEIGHT,
      currentHeight: container.style.height
    });
  }

  requestAnimationFrame(() => {
    container.style.transition = "height 0.5s cubic-bezier(0.4, 0, 0.2, 1)";
    container.style.height = `${MIN_PANEL_HEIGHT}px`;
  });
}

const adjustHeight = (animate = true) => {
  if (!container) {
    return;
  }

  requestAnimationFrame(() => {
    if (animate) {
      container.style.transition = "height 0.5s cubic-bezier(0.4, 0, 0.2, 1)";
    } else {
      container.style.transition = "none";
    }

    let targetHeight = 0;
    const ipResultContainer = document.getElementById("ip_result_container");

    if (ipResultContainer && ipResultContainer.classList.contains("hasResult")) {
      const visibleChildren = Array.from(ipResultContainer.children).filter(
        (child) => child.style.display !== "none"
      );

      visibleChildren.forEach((child) => {
        const styles = window.getComputedStyle(child);
        const marginTop = parseFloat(styles.marginTop) || 0;
        const marginBottom = parseFloat(styles.marginBottom) || 0;
        targetHeight += child.offsetHeight + marginTop + marginBottom;
      });

      targetHeight += ipInput ? ipInput.offsetHeight : 0;
      targetHeight += 20;
    } else {
      targetHeight = MIN_PANEL_HEIGHT;
    }

    targetHeight = Math.max(targetHeight, MIN_PANEL_HEIGHT);

    if (container.style.height !== `${targetHeight}px`) {
      container.style.height = `${targetHeight}px`;
      // @ts-ignore
      container.offsetHeight;
    }
  });
};

let debounceTimeout;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    if (container) {
      // @ts-ignore
      container.offsetHeight;
    }
    adjustHeight();
  }, 200);
});

export async function initIPSearch() {
  const container = document.querySelector(".IPsearch_in_panelALL");
  const ipInput = document.getElementById("ip_input");

  if (ipInput) {
    ipInput.placeholder = DEFAULT_PLACEHOLDER;
    getSearchSpinner();
  }

  if (container) {
    adjustHeight(false);
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  if (ipInput) {
    const submitIpSearch = async (rawValue) => {
      const { ip, date } = parseIpQuery(rawValue ?? ipInput.value);
      if (ip === "") {
        IP_clearOutput();
        ipInput.placeholder = DEFAULT_PLACEHOLDER;
        return;
      }

      await IP_handleIpInput(ip, date);
    };

    ipInput.addEventListener("input", function() {
      if (ipInput.value.trim() === "") {
        IP_clearOutput();
        ipInput.placeholder = DEFAULT_PLACEHOLDER;
      }
    });

    ipInput.addEventListener("keydown", function(event) {
      if (event.key === "Enter" || event.keyCode === 13) {
        event.preventDefault();
        submitIpSearch();
      }
    });

    ipInput.addEventListener("paste", function() {
      setTimeout(() => {
        submitIpSearch();
      }, 0);
    });
  }
}

function addHotspotTag(hostname, apiData) {
  const orgElem = document.getElementById("ip_org");
  if (!orgElem) {
    return;
  }

  const tagContainer = orgElem.querySelector(".ip-dashboard__tags");
  if (!tagContainer) {
    return;
  }

  const isHostnameMobile = /mobile|emome/i.test(hostname);

  let isApiMobile = false;
  if (apiData) {
    const signals = Array.isArray(apiData.risk_signals)
      ? apiData.risk_signals
      : Array.isArray(apiData.risk_assessment && apiData.risk_assessment.signals)
        ? apiData.risk_assessment.signals
        : [];
    const normalizedSignals = signals
      .map((signal) => String(signal || "").trim().toUpperCase())
      .filter(Boolean);
    if (normalizedSignals.includes("MOBILE_NETWORK")) {
      isApiMobile = true;
    }

    const category = typeof (apiData.identity && apiData.identity.category) === "string"
      ? apiData.identity.category
      : "";
    if (/mobile|cellular/i.test(category)) {
      isApiMobile = true;
    }
  }

  if ((isHostnameMobile || isApiMobile) && !tagContainer.querySelector(".ip-tag--mobile")) {
    const tag = document.createElement("span");
    tag.className = "ip-tag ip-tag--mobile";
    tag.textContent = "HOTSPOT";
    tagContainer.appendChild(tag);
  }
}
