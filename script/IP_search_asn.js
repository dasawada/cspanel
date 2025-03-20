import { callGoogleSheetAPI, callGoogleSheetBatchAPI } from "./googleSheetAPI.js";
// 定義各個範圍，不再定義 spreadsheetId
const listRange = 'ip-list!B1:E';
const countryMappingRange = 'ip-dixt!A:C';

// 先記錄全域 Promise（供 IP_handleIpInput 使用）
const sheetDataPromise = getSheetData();
const countryMappingPromise = getCountryMapping();

/**
 * 呼叫 Netlify 後端代理 Google Sheets 與 Google Maps API
 * 傳入物件 { range, method, payload, mapRequest, lat, lon }
 */
async function callGoogleSheetAPI({ range, method = "GET", payload, mapRequest, lat, lon }) {
  const requestBody = mapRequest
    ? { mapRequest: true, lat, lon }
    : { range, method, payload };
  const response = await fetch("/.netlify/functions/googleSheetProxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });
  return response.json();
}

/**
 * 讀取 Google Sheet 中服務商資料
 */
async function getSheetData() {
  try {
    console.log("[getSheetData] 呼叫 callGoogleSheetAPI，參數：", {
      range: listRange,
      method: "GET"
    });
    const data = await callGoogleSheetAPI({
      range: listRange,
      method: "GET"
    });
    console.log("[getSheetData] 回傳資料：", data);
    const sheetData = [];
    if (data.values) {
      data.values.forEach(row => {
        const cidrRange = row[0] ? row[0].trim() : '';
        const isp1 = row[1] ? row[1].trim() : '';
        const isp2 = row[3] ? row[3].trim() : '';
        if (cidrRange && (isp1 || isp2)) {
          sheetData.push({ cidrRange, isp1, isp2 });
        }
      });
    } else {
      console.error("[getSheetData] 沒有找到資料");
    }
    console.log("[getSheetData] 最終資料：", sheetData);
    return sheetData;
  } catch (error) {
    console.error("[getSheetData] 發生錯誤：", error);
    return [];
  }
}

/**
 * 讀取國家對照資料 (英文代碼 -> 中文名稱)
 */
async function getCountryMapping() {
  try {
    console.log("[getCountryMapping] 呼叫 callGoogleSheetAPI，參數：", {
      range: countryMappingRange,
      method: "GET"
    });
    const data = await callGoogleSheetAPI({
      range: countryMappingRange,
      method: "GET"
    });
    console.log("[getCountryMapping] 回傳資料：", data);
    const mapping = {};
    if (data.values) {
      data.values.forEach(row => {
        const eng = row[0] ? row[0].trim() : '';
        const chi = row[2] ? row[2].trim() : '';
        if (eng && chi) {
          mapping[eng] = chi;
        }
      });
    } else {
      console.error("[getCountryMapping] 沒有找到國家對照資料");
    }
    console.log("[getCountryMapping] 最終 mapping：", mapping);
    return mapping;
  } catch (error) {
    console.error("[getCountryMapping] 發生錯誤：", error);
    return {};
  }
}

/**
 * 判斷輸入 IP 是否落在指定 CIDR 範圍內
 */
function isIpInCidr(ip, cidr) {
  function ipToLong(ip) {
    return ip.split('.').reduce((sum, x) => (sum << 8) + parseInt(x), 0) >>> 0;
  }
  function cidrToRange(cidr) {
    const [base, bits] = cidr.split('/');
    const ipBase = ipToLong(base);
    const mask = ~(2 ** (32 - bits) - 1);
    const ipLow = ipBase & mask;
    const ipHigh = ipBase | ~mask;
    return [ipLow >>> 0, ipHigh >>> 0];
  }
  const ipLong = ipToLong(ip);
  const [low, high] = cidrToRange(cidr);
  return ipLong >= low && ipLong <= high;
}

/**
 * 取得 Google Maps 嵌入 URL，透過 Netlify 後端代理
 */
async function getGoogleMapUrl(lat, lon) {
  try {
    const data = await callGoogleSheetAPI({ mapRequest: true, lat, lon });
    return data.embedUrl;
  } catch (error) {
    console.error("[getGoogleMapUrl] 無法取得地圖連結：", error);
    return "";
  }
}

/**
 * 處理 IP 輸入，讀取 ipinfo API 資料，並依據 Google Sheet 資料及國家對照表來顯示結果
 */
async function IP_handleIpInput(ip) {
  console.log("[IP_handleIpInput] 處理 IP：", ip);
  const ipinfoToken = '5da0a6c614f15b';
  const url = `https://ipinfo.io/${ip}?token=${ipinfoToken}`;
  try {
    console.log("[IP_handleIpInput] Fetch ipinfo URL：", url);
    const response = await fetch(url);
    const data = await response.json();
    console.log("[IP_handleIpInput] ipinfo 回傳：", data);

    // 取得 ipinfo 中的國家代碼及 city
    const countryCode = data.country || 'N/A';
    const city = data.city || '';
    const hostname = data.hostname || '';
    const org = data.org || 'N/A';

    // 取得國家對照表
    const countryMapping = await countryMappingPromise;
    console.log("[IP_handleIpInput] countryMapping：", countryMapping);
    const country = countryMapping[countryCode] || countryCode;
    const countryDisplay = city ? `${country}／${city}` : country;

    // 取得服務商資料
    const sheetData = await sheetDataPromise;
    console.log("[IP_handleIpInput] sheetData：", sheetData);
    let matchedEntry = null;
    for (const entry of sheetData) {
      if (isIpInCidr(ip, entry.cidrRange)) {
        matchedEntry = entry;
        break;
      }
    }
    console.log("[IP_handleIpInput] matchedEntry：", matchedEntry);

    let ispDisplay = '';
    if (matchedEntry) {
      if (matchedEntry.isp2 && matchedEntry.isp1 !== matchedEntry.isp2) {
        ispDisplay = matchedEntry.isp1 + "\n" + matchedEntry.isp2;
      } else {
        ispDisplay = matchedEntry.isp1 || matchedEntry.isp2;
      }
    } else {
      ispDisplay = org;
    }

    document.getElementById('ip_country').innerHTML = `<span class="label">國家：</span>${countryDisplay}`;
    const ispLines = ispDisplay.split('\n').map(line => line.trim());
    document.getElementById('ip_org').innerHTML = `<span class="label">服務商：</span><br>${ispLines.join('<br>')}`;
    if (hostname) {
      document.getElementById('ip_hostname').innerHTML = `<span class="label">主機名：</span>${hostname}`;
    } else {
      document.getElementById('ip_hostname').innerHTML = '';
    }
    document.getElementById('ip_result_container').classList.add('hasResult');

    // 地圖處理
    const ipResultContainer = document.getElementById('ip_result_container');
    let ipMapContainer = document.getElementById('ip_map');
    if (!ipMapContainer) {
      ipMapContainer = document.createElement('div');
      ipMapContainer.id = 'ip_map';
      ipMapContainer.style.width = '260px';
      ipMapContainer.style.height = '220px';
      ipMapContainer.style.margin = '5px auto 5px';
      ipResultContainer.appendChild(ipMapContainer);
    }
    if (data.loc) {
      const [lat, lon] = data.loc.split(',');
      const embedUrl = await getGoogleMapUrl(lat, lon);
      if (embedUrl) {
        ipMapContainer.innerHTML = `<iframe width="260" height="260" frameborder="0" style="border:0; width:100%; height:100%;" src="${embedUrl}" allowfullscreen></iframe>`;
      } else {
        ipMapContainer.innerHTML = "";
      }
    } else {
      ipMapContainer.innerHTML = "";
    }
  } catch (error) {
    console.error("[IP_handleIpInput] 錯誤：", error);
    IP_clearOutput();
    document.getElementById('ip_country').textContent = `錯誤：`;
    document.getElementById('ip_org').textContent = `${error}`;
  }
}

function IP_clearOutput() {
  document.getElementById('ip_country').textContent = '';
  document.getElementById('ip_org').textContent = '';
  document.getElementById('ip_hostname').textContent = '';
  document.getElementById('ip_result_container').classList.remove('hasResult');
}

// 監聽 ip 輸入框的 keydown 與 input 事件
document.getElementById('ip_input').addEventListener('keydown', async function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const ip = event.target.value.trim();
    if (ip === '') {
      IP_clearOutput();
      return;
    }
    console.log("[Event] Enter pressed. Processing IP:", ip);
    await IP_handleIpInput(ip);
  }
});

document.getElementById('ip_input').addEventListener('input', async function(event) {
  const ip = event.target.value.trim();
  if (ip === '') {
    IP_clearOutput();
    return;
  }
  console.log("[Event] Input changed. Processing IP:", ip);
  await IP_handleIpInput(ip);
});

// 調整介面高度的程式碼
const container = document.querySelector('.IPsearch_in_panelALL');
const initialHeight = '36px';
const ipInput = document.getElementById('ip_input');

const adjustHeight = () => {
  requestAnimationFrame(() => {
    const newHeight = container.scrollHeight + 'px';
    container.style.transition = 'height 0.3s ease';
    container.style.height = ipInput.value === '' ? initialHeight : newHeight;
    console.log("[adjustHeight] New container height:", newHeight);
  });
};

const observer = new MutationObserver(() => {
  adjustHeight();
});

observer.observe(container, { childList: true, subtree: true });

ipInput.addEventListener('input', () => {
  setTimeout(adjustHeight, 0);
});

ipInput.addEventListener('paste', () => {
  setTimeout(adjustHeight, 50);
});

ipInput.addEventListener('click', adjustHeight);

/* 
  獲取最近更新日期並設置 ip 搜尋框的 placeholder
  使用共用 API 模組，從後端取得更新日期
*/
async function IP_fetchNewUpdateDate() {
  try {
    console.log("[IP_fetchNewUpdateDate] Fetching update date...");
    const data = await callGoogleSheetAPI({
      range: 'update!A1:A1',
      method: "GET"
    });
    console.log("[IP_fetchNewUpdateDate] Data received:", data);
    if (!data.values || !data.values.length) {
      throw new Error('No data found in the specified range.');
    }
    const dateUpdated = data.values[0][0];
    document.getElementById('ip_input').placeholder = '資料於 ' + dateUpdated + ' 更新';
  } catch (error) {
    console.error("[IP_fetchNewUpdateDate] Error:", error);
    document.getElementById('ip_input').placeholder = '資料更新失敗';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  IP_fetchNewUpdateDate();
  adjustHeight();
});
