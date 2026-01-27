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

  const labelElement = createTextElement("span", "ip-stat__label", label);
  const valueElement = createTextElement("span", "ip-stat__value", value);
  if (options.title) {
    valueElement.title = options.title;
  }
  item.appendChild(labelElement);
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
      /mobile|cellular/i.test(categoryLower);
    if (isMobile) {
      pushTag("HOTSPOT", "ip-tag--mobile");
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
      const riskBadge = createTextElement("span", `ip-badge ${riskBadgeClass}`, `風險 ${riskLabel}`);
      header.appendChild(locationElement);
      header.appendChild(riskBadge);

      const identityElement = document.createElement("div");
      identityElement.className = "ip-dashboard__identity";
      const asnElement = createTextElement("div", "ip-dashboard__asn", asnDisplay);
      const ispElement = createTextElement("div", "ip-dashboard__isp", ispDisplay);
      ispElement.title = ispDisplay;
      identityElement.appendChild(asnElement);
      identityElement.appendChild(ispElement);

      const statusItem = createStatItem("狀態", statusDisplay, {
        title: statusTitle,
        wide: true,
        className: "ip-stat--status"
      });

      const grid = document.createElement("div");
      grid.className = "ip-dashboard__grid";
      grid.appendChild(createStatItem("類型", categoryDisplay, { title: categoryDisplay }));
      grid.appendChild(createStatItem("BGP 前綴", bgpPrefix, { title: bgpPrefix }));
      grid.appendChild(createStatItem("流量趨勢", trafficTrend, { title: trafficTrend }));
      grid.appendChild(createStatItem("查詢模式", queryContextDisplay, { title: queryContextDisplay }));

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

      if (tags.length) {
        const tagsElement = document.createElement("div");
        tagsElement.className = "ip-dashboard__tags";
        tags.forEach((tag) => {
          const tagElement = createTextElement("span", `ip-tag ${tag.className}`, tag.text);
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
