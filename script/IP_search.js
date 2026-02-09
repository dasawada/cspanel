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

function buildSignalTooltip(signalName, customData) {
  const normalizedSignal = String(signalName).toUpperCase().replace(/\s+/g, "_");
  const explanation = SIGNAL_EXPLANATIONS[normalizedSignal];
  
  // Special handling for HOTSPOT
  if (signalName.includes("HOTSPOT") || customData?.mobile_hotspot_assessment) {
    const assessment = customData.mobile_hotspot_assessment || {};
    const likelihood = assessment.likelihood || "";
    const likelihoodZh = formatHotspotLikelihood(likelihood);
    const confidence = Math.round(assessment.confidence || 0);
    const posterior = Math.round((assessment.posterior_probability || 0) * 100);
    
    const risk = customData.connection_stability_risk || {};
    const volatility = risk.expected_volatility || 0;
    const riskLevel = risk.risk_level || "UNKNOWN";
    const riskLevelZh = { LOW: "低", MEDIUM: "中", HIGH: "高" }[riskLevel] || riskLevel;
    
    let html = `<div class="ip-tooltip-section">
      <div class="ip-tooltip-header">行動熱點評估</div>
      <div class="ip-tooltip-divider"></div>
      <div class="ip-tooltip-row"><span class="ip-tooltip-label">判斷等級</span><span class="ip-tooltip-value">${likelihoodZh}</span></div>
      <div class="ip-tooltip-row"><span class="ip-tooltip-label">後驗機率</span><span class="ip-tooltip-value">${posterior}%</span></div>
      <div class="ip-tooltip-row"><span class="ip-tooltip-label">置信度</span><span class="ip-tooltip-value">${confidence}%</span></div>
    </div>`;
    
    if (assessment.decision_summary) {
      html += `<div class="ip-tooltip-section">
        <div class="ip-tooltip-subheader">貝葉斯推論</div>
        <div class="ip-tooltip-text">${assessment.decision_summary}</div>
      </div>`;
    }
    
    html += `<div class="ip-tooltip-section">
      <div class="ip-tooltip-subheader">連線穩定性</div>
      <div class="ip-tooltip-row"><span class="ip-tooltip-label">波動率</span><span class="ip-tooltip-value">${volatility.toFixed(2)} ${volatility > 0.5 ? '(高度不穩定)' : ''}</span></div>
      <div class="ip-tooltip-row"><span class="ip-tooltip-label">風險等級</span><span class="ip-tooltip-value ip-tooltip-value--${riskLevel.toLowerCase()}">${riskLevelZh}</span></div>
    </div>`;
    
    return html;
  }
  
  // Special handling for HOSTING
  if (signalName.includes("HOSTING") || normalizedSignal === "DATACENTER") {
    const isHosting = customData?.risk_assessment?.is_hosting;
    const layers = customData?.connection_stability_risk?.layers || {};
    const evidence = layers.evidence || [];
    const datacenterEvidence = evidence.filter(e => 
      e.signal?.includes("datacenter") || 
      e.signal?.includes("hosting") ||
      e.source === "initial_classification"
    );
    
    let html = `<div class="ip-tooltip-section">
      <div class="ip-tooltip-header">機房 IP 檢測</div>
      <div class="ip-tooltip-divider"></div>
      <div class="ip-tooltip-row"><span class="ip-tooltip-label">判斷</span><span class="ip-tooltip-value">資料中心連線</span></div>
    </div>`;
    
    if (datacenterEvidence.length > 0) {
      html += `<div class="ip-tooltip-section">
        <div class="ip-tooltip-subheader">特徵</div>
        <ul class="ip-tooltip-list">`;
      
      datacenterEvidence.slice(0, 3).forEach(evd => {
        const desc = evd.description || evd.signal || "";
        html += `<li>• ${desc}</li>`;
      });
      
      html += `</ul></div>`;
    }
    
    html += `<div class="ip-tooltip-section">
      <div class="ip-tooltip-subheader">風險特性</div>
      <div class="ip-tooltip-text">連線穩定 (波動率 0.05)<br>但可能涉及 VPN/Proxy</div>
    </div>`;
    
    return html;
  }
  
  // Special handling for OUTAGE
  if (signalName.includes("OUTAGE") || normalizedSignal === "TRAFFIC_ANOMALY") {
    const networkHealth = customData?.network_health || {};
    const status = networkHealth.status || "";
    const statusZh = formatStatus(status);
    const trend = networkHealth.traffic_trend || "N/A";
    
    let html = `<div class="ip-tooltip-section">
      <div class="ip-tooltip-header">斷線警報</div>
      <div class="ip-tooltip-divider"></div>
      <div class="ip-tooltip-row"><span class="ip-tooltip-label">狀態</span><span class="ip-tooltip-value">${statusZh}</span></div>
      <div class="ip-tooltip-row"><span class="ip-tooltip-label">流量趨勢</span><span class="ip-tooltip-value">${trend}</span></div>
    </div>`;
    
    html += `<div class="ip-tooltip-section">
      <div class="ip-tooltip-subheader">影響</div>
      <div class="ip-tooltip-text">該 IP 可能無法正常連線<br>建議檢查用戶網路狀態</div>
    </div>`;
    
    return html;
  }
  
  // Generic signal explanation
  if (explanation) {
    let html = `<div class="ip-tooltip-section">
      <div class="ip-tooltip-header">${explanation.label}</div>
      <div class="ip-tooltip-divider"></div>
      <div class="ip-tooltip-subheader">說明</div>
      <div class="ip-tooltip-text">${explanation.description}</div>
    </div>`;
    
    html += `<div class="ip-tooltip-section">
      <div class="ip-tooltip-subheader">風險意義</div>
      <div class="ip-tooltip-text">${explanation.risk_impact}</div>
    </div>`;
    
    // Try to find matching evidence
    const layers = customData?.connection_stability_risk?.layers || {};
    const evidence = layers.evidence || [];
    const matchingEvidence = evidence.find(e => 
      e.signal?.toUpperCase() === normalizedSignal ||
      e.description?.toUpperCase().includes(normalizedSignal)
    );
    
    if (matchingEvidence && matchingEvidence.reliability) {
      html += `<div class="ip-tooltip-section">
        <div class="ip-tooltip-row"><span class="ip-tooltip-label">證據可靠度</span><span class="ip-tooltip-value">${Math.round(matchingEvidence.reliability * 100)}%</span></div>
      </div>`;
    }
    
    return html;
  }
  
  // Fallback for unknown signals
  return `<div class="ip-tooltip-section">
    <div class="ip-tooltip-header">${signalName}</div>
    <div class="ip-tooltip-divider"></div>
    <div class="ip-tooltip-text">此信號表示系統偵測到特定風險特徵</div>
  </div>`;
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

    // API v3: Evidence layers for explainability
    const layers = customData && customData.layers ? customData.layers : {};
    const evidenceList = Array.isArray(layers.evidence) ? layers.evidence : [];
    const filteredEvidence = evidenceList
      .filter(evd => evd && evd.factor)
      .map(evd => ({
        factor: String(evd.factor).replace(/_/g, " "),
        weight: evd.weight || 0,
        impact: evd.impact || ""
      }));

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
    const pushTag = (text, className) => {
      const normalized = String(text).toUpperCase();
      if (seenTags.has(normalized)) {
        return;
      }
      seenTags.add(normalized);
      tags.push({ text, className });
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
      const likelihoodKey = String(hotspotLikelihood || "").toLowerCase();
      if (likelihoodKey === "certain" || likelihoodKey === "highly_probable") {
        pushTag(`HOTSPOT (確定 ${Math.round(hotspotConfidence)}%)`, "ip-tag--mobile ip-tag--certain");
      } else if (likelihoodKey === "probable" || likelihoodKey === "possible") {
        pushTag(`疑似熱點 (${hotspotLikelihoodDisplay} ${Math.round(hotspotConfidence)}%)`, "ip-tag--mobile ip-tag--possible");
      } else {
        pushTag("HOTSPOT", "ip-tag--mobile");
      }
    }

    const isHosting =
      signals.includes("HOSTING_IP") ||
      signals.includes("DATACENTER") ||
      Boolean(customData.risk_assessment && customData.risk_assessment.is_hosting);
    if (isHosting) {
      pushTag("HOSTING", "ip-tag--hosting");
    }

    const isOutage =
      signals.includes("TRAFFIC_ANOMALY") ||
      statusLower === "outage" ||
      statusLower === "inactive";
    if (isOutage) {
      pushTag("OUTAGE", "ip-tag--outage");
    }

    signals.forEach((signal) => {
      if (["MOBILE_NETWORK", "HOSTING_IP", "DATACENTER", "TRAFFIC_ANOMALY"].includes(signal)) {
        return;
      }
      pushTag(signal.replace(/_/g, " "), "ip-tag--signal");
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

      // API v3: Evidence Chain (Risk Attribution)
      if (filteredEvidence.length > 0) {
        const evidenceSection = document.createElement("div");
        evidenceSection.className = "ip-dashboard__evidence";
        
        const evidenceHeader = document.createElement("div");
        evidenceHeader.className = "ip-dashboard__evidence-header";
        evidenceHeader.textContent = "\u98a8\u96aa\u6b78\u56e0";
        
        const evidenceHeaderInfo = createInfoButton("\u5f71\u97ff\u98a8\u96aa\u5224\u65b7\u7684\u95dc\u9375\u56e0\u5b50\uff0c\u6839\u64da API \u8b49\u64da\u5c64 (layers.evidence) \u751f\u6210");
        evidenceHeader.appendChild(evidenceHeaderInfo);
        evidenceSection.appendChild(evidenceHeader);
        
        const evidenceList = document.createElement("ul");
        evidenceList.className = "ip-dashboard__evidence-list";
        
        filteredEvidence.slice(0, 5).forEach((evd) => {
          const item = document.createElement("li");
          item.className = "ip-evidence-item";
          
          const factorText = createTextElement("span", "ip-evidence-item__factor", evd.factor);
          item.appendChild(factorText);
          
          if (evd.weight && evd.weight !== 0) {
            const weightBadge = createTextElement(
              "span", 
              evd.weight > 0 ? "ip-evidence-item__weight ip-evidence-item__weight--positive" : "ip-evidence-item__weight ip-evidence-item__weight--negative",
              evd.weight > 0 ? `+${evd.weight.toFixed(2)}` : evd.weight.toFixed(2)
            );
            item.appendChild(weightBadge);
          }
          
          evidenceList.appendChild(item);
        });
        
        evidenceSection.appendChild(evidenceList);
        dashboard.appendChild(evidenceSection);
      }

      if (tags.length) {
        const tagsElement = document.createElement("div");
        tagsElement.className = "ip-dashboard__tags";
        tags.forEach((tag) => {
          const tagElement = createTextElement("span", `ip-tag ${tag.className}`, tag.text);
          bindTooltipTrigger(tagElement, () => buildSignalTooltip(tag.text, customData), {
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
