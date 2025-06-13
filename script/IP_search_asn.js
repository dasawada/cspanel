import { callGoogleSheetAPI, callGoogleSheetBatchAPI, callGoogleMapsAPI } from "./googleSheetAPI.js";

// 定義各個範圍，不再定義 spreadsheetId
const listRange = 'ip-list!B1:E';
const countryMappingRange = 'ip-dixt!A:C';

// 先記錄全域 Promise（供 IP_handleIpInput 使用）
const sheetDataPromise = getSheetData();
const countryMappingPromise = getCountryMapping();

/**
 * 讀取 Google Sheet 中服務商資料
 */
async function getSheetData() {
  try {
    const data = await callGoogleSheetAPI({
      range: listRange,
      method: "GET"
    });
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
    }
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
    const data = await callGoogleSheetAPI({
      range: countryMappingRange,
      method: "GET"
    });
    const mapping = {};
    if (data.values) {
      data.values.forEach(row => {
        const eng = row[0] ? row[0].trim() : '';
        const chi = row[2] ? row[2].trim() : '';
        if (eng && chi) {
          mapping[eng] = chi;
        }
      });
    }
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
 * 取得 Google Maps 嵌入 URL，透過 Netlify 後端代理（使用獨立的 callGoogleMapsAPI 函數）
 */
async function getGoogleMapUrl(lat, lon) {
  try {
    const data = await callGoogleMapsAPI({ lat, lon });
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
  const ipinfoToken = '5da0a6c614f15b';
  const url = `https://ipinfo.io/${ip}?token=${ipinfoToken}`;
  try {
    const response = await fetch(url);
    const data = await response.json();

    // 取得 ipinfo 中的國家代碼及 city
    const countryCode = data.country || 'N/A';
    const city = data.city || '';
    const hostname = data.hostname || '';
    const org = data.org || 'N/A';

    // 取得國家對照表
    const countryMapping = await countryMappingPromise;
    const country = countryMapping[countryCode] || countryCode;
    const countryDisplay = city ? `${country}／${city}` : country;

    // 取得服務商資料
    const sheetData = await sheetDataPromise;
    let matchedEntry = null;
    for (const entry of sheetData) {
      if (isIpInCidr(ip, entry.cidrRange)) {
        matchedEntry = entry;
        break;
      }
    }

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

    const ipResultContainer = document.getElementById('ip_result_container');
    document.getElementById('ip_country').innerHTML = `<span class="label">國家：</span>${countryDisplay}`;
    const ispLines = ispDisplay.split('\n').map(line => line.trim());
    document.getElementById('ip_org').innerHTML = `<span class="label">服務商：</span>${ispLines.join('<br>')}`;

    if (hostname) {
        let hostnameElement = document.getElementById('ip_hostname');
        if (!hostnameElement) {
            hostnameElement = document.createElement('p');
            hostnameElement.id = 'ip_hostname';
            hostnameElement.style.margin = '0';
            hostnameElement.style.padding = '0';
            ipResultContainer.appendChild(hostnameElement);
        }
        hostnameElement.innerHTML = `<span class="label">主機名：</span>${hostname}`;
    }

    document.getElementById('ip_result_container').classList.add('hasResult');

    // 地圖處理
    let ipMapContainer = document.getElementById('ip_map');
    if (!ipMapContainer) {
      ipMapContainer = document.createElement('div');
      ipMapContainer.id = 'ip_map';
      ipMapContainer.style.width = '260px';
      ipMapContainer.style.height = '180px';
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
    document.getElementById('ip_org').textContent = `${error.message || error}`;
  }
}

function IP_clearOutput() {
  document.getElementById('ip_country').textContent = '';
  document.getElementById('ip_org').textContent = '';
  const hostnameElement = document.getElementById('ip_hostname');
  if (hostnameElement) {
    hostnameElement.remove();
  }
  const mapElement = document.getElementById('ip_map');
  if (mapElement) {
    mapElement.remove();
  }
  document.getElementById('ip_result_container').classList.remove('hasResult');

  if (container) {
    // Temporarily disable transition to ensure 'auto' height is accurately determined for scrollHeight
    container.style.transition = 'none';
    // Set height to auto to allow it to shrink to content
    container.style.height = 'auto';
    // adjustHeight will read the new scrollHeight and apply it (or minHeight)
    // and also restore the transition.
    adjustHeight();
  } else {
    // Still call adjustHeight in case it needs to do something even if container was initially null
    // (though it has a guard, this is for completeness of flow)
    adjustHeight();
  }
}

// 調整介面高度的程式碼
const container = document.querySelector('.IPsearch_in_panelALL');
const ipInput = document.getElementById('ip_input');
let originalPlaceholder = '';

const adjustHeight = () => {
  if (!container) return;

  requestAnimationFrame(() => {
    // Always ensure the correct transition is set before any height modification
    container.style.transition = 'height 0.1s ease';

    let targetHeight = container.scrollHeight;
    const minHeight = 36; // Should match CSS min-height
    targetHeight = Math.max(targetHeight, minHeight);

    if (container.style.height !== `${targetHeight}px`) {
      container.style.height = `${targetHeight}px`;
    }
    // If height doesn't change, the transition is still correctly set by the line above.
  });
};

const observer = new MutationObserver(() => {
  adjustHeight();
});

/* 
  獲取最近更新日期並設置 ip 搜尋框的 placeholder
  使用共用 API 模組，從後端取得更新日期
*/
async function IP_fetchNewUpdateDate() {
  if (!ipInput) return;
  try {
    const data = await callGoogleSheetAPI({
      range: 'update!A1:A1',
      method: "GET"
    });
    if (!data.values || !data.values.length || !data.values[0][0]) {
      throw new Error('No date data found in the specified range.');
    }
    const dateUpdated = data.values[0][0];
    originalPlaceholder = '資料於 ' + dateUpdated + ' 更新';
    ipInput.placeholder = originalPlaceholder;
  } catch (error) {
    console.error("[IP_fetchNewUpdateDate] Error:", error);
    originalPlaceholder = '資料更新失敗';
    ipInput.placeholder = originalPlaceholder;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!ipInput) {
    console.error('#ip_input element not found on DOMContentLoaded. IP Search may not function.');
  }
  if (!container) {
    console.error('.IPsearch_in_panelALL container not found on DOMContentLoaded. Height adjustments may not work.');
  }

  IP_fetchNewUpdateDate();

  if (container) {
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    adjustHeight();
  }
  
  if (ipInput) {
    ipInput.addEventListener('input', async function(event) {
      const currentIp = event.target.value.trim();
      if (currentIp === '') {
        IP_clearOutput();
        ipInput.placeholder = '請輸入IP';
        return;
      }
      
      if (ipInput.placeholder !== originalPlaceholder && originalPlaceholder) {
          ipInput.placeholder = originalPlaceholder;
      }

      await IP_handleIpInput(currentIp);
    });

    ipInput.addEventListener('blur', function(event) {
        if (event.target.value.trim() === '' && originalPlaceholder) {
        }
    });
  }
});
