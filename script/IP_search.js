import { callGoogleSheetAPI, callGoogleSheetBatchAPI, callGoogleMapsAPI } from "./googleSheetAPI.js";

// --- 日誌記錄開始 ---
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

// 將 logEntries 和一個下載函數暴露到全域，僅供調試
window.debugLogEntries = logEntries; // 使用不同的名稱以避免潛在衝突
window.downloadLogFile = function() {
    if (typeof window.debugLogEntries === 'undefined' || !Array.isArray(window.debugLogEntries)) {
        return;
    }
    const filename = `ip_search_log_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const blob = new Blob([JSON.stringify(window.debugLogEntries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
// --- 日誌記錄結束 ---

// 定義各個範圍，不再定義 spreadsheetId
const listRange = 'ip-list!B1:E';
const countryMappingRange = 'ip-dixt!A:C';

// 先記錄全域 Promise（供 IP_handleIpInput 使用）
const sheetDataPromise = getSheetData();
const countryMappingPromise = getCountryMapping();

const MIN_PANEL_HEIGHT = 36; // Define a constant for minimum height

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
    const countryElement = document.getElementById('ip_country');
    const orgElement = document.getElementById('ip_org');

    // 先將元素設為可見，再填入內容
    countryElement.style.display = ''; // 恢復預設或 CSS 指定的 display 樣式
    orgElement.style.display = '';   // 恢復預設或 CSS 指定的 display 樣式

    countryElement.innerHTML = `<span class="label">國家：</span>${countryDisplay}`;
    const ispLines = ispDisplay.split('\n').map(line => line.trim());
    orgElement.innerHTML = `<span class="label">服務商：</span>${ispLines.join('<br>')}`;

    if (hostname) {
      let hostnameElement = document.getElementById('ip_hostname');
      if (!hostnameElement) {
        hostnameElement = document.createElement('p');
        hostnameElement.id = 'ip_hostname';
        hostnameElement.style.margin = '0';
        hostnameElement.style.padding = '0';
        ipResultContainer.appendChild(hostnameElement);
      }
      hostnameElement.style.display = ''; // 確保可見
      hostnameElement.innerHTML = `<span class="label">主機名：</span>${hostname}`;

      // 新增：檢查並添加手機熱點標籤
      addHotspotTag(hostname);
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
    ipMapContainer.style.display = ''; // 確保地圖容器可見
    if (data.loc) {
      const [lat, lon] = data.loc.split(',');
      const embedUrl = await getGoogleMapUrl(lat, lon);
      if (embedUrl) {
        ipMapContainer.innerHTML = `<iframe width="260" height="260" frameborder="0" style="border:0; width:100%; height:100%;" src="${embedUrl}" allowfullscreen></iframe>`;
      } else {
        ipMapContainer.innerHTML = "";
        ipMapContainer.style.display = 'none'; // 如果沒有地圖內容，則隱藏
      }
    } else {
      ipMapContainer.innerHTML = "";
      ipMapContainer.style.display = 'none'; // 如果沒有位置數據，則隱藏
    }
    
    // 在搜尋結果出來後強制調整高度
    requestAnimationFrame(() => {
      adjustHeight(true);
    });
  } catch (error) {
    IP_clearOutput(); // IP_clearOutput 內部會處理隱藏
    const countryElement = document.getElementById('ip_country');
    const orgElement = document.getElementById('ip_org');

    // 顯示錯誤訊息前，確保元素可見
    countryElement.style.display = '';
    orgElement.style.display = '';

    countryElement.textContent = `錯誤：`;
    orgElement.textContent = `${error.message || error}`;
    
    // 在顯示錯誤後強制調整高度
    requestAnimationFrame(() => {
      adjustHeight(true);
    });
  }
}

// filepath: /Users/jianmingxiu/cspanel_clone/cspanel/script/IP_search_asn.js
// ...
function IP_clearOutput() {
  const countryElement = document.getElementById('ip_country');
  const orgElement = document.getElementById('ip_org');

  if (countryElement) { 
    countryElement.textContent = ''; // 這些是靜態的，不清空會留白
    countryElement.style.display = 'none';
  }
  if (orgElement) { 
    orgElement.textContent = ''; // 這些是靜態的，不清空會留白
    orgElement.style.display = 'none';
  }

  const hostnameElement = document.getElementById('ip_hostname');
  if (hostnameElement) {
    hostnameElement.remove();
  }

  const mapElement = document.getElementById('ip_map');
  if (mapElement) {
    mapElement.remove();
  }

  const ipResultContainer = document.getElementById('ip_result_container');
  if (ipResultContainer) {
    ipResultContainer.classList.remove('hasResult');
  }
  
  // 清空輸出後直接調整高度至最小值
  adjustHeightToMin();
}

// 調整介面高度的程式碼
const container = document.querySelector('.IPsearch_in_panelALL');
const ipInput = document.getElementById('ip_input');
let originalPlaceholder = '';

// 新增直接調整至最小高度的函數
function adjustHeightToMin() {
  if (!container) return;
  
  if (typeof log === 'function') {
    log('adjustHeightToMin_call', { 
      MIN_PANEL_HEIGHT: MIN_PANEL_HEIGHT,
      currentHeight: container.style.height
    });
  }
  
  requestAnimationFrame(() => {
    container.style.transition = 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
    container.style.height = `${MIN_PANEL_HEIGHT}px`;
    
    if (typeof log === 'function') {
      log('adjustHeightToMin_complete', { 
        newHeight: container.style.height
      });
    }
  });
}

const adjustHeight = (animate = true) => {
  if (typeof log === 'function') {
    log('adjustHeight_start', { 
      animate: animate, 
      scrollHeight: container ? container.scrollHeight : 'N/A', 
      currentStyleHeight: container ? container.style.height : 'N/A' 
    });
  }
  if (!container) return;

  requestAnimationFrame(() => {
    if (animate) {
      container.style.transition = 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
    } else {
      container.style.transition = 'none';
    }

    // 取得實際需要的高度，檢查內部元素實際高度
    let targetHeight = 0;
    const ipResultContainer = document.getElementById('ip_result_container');
    
    // 如果結果容器有內容，計算所有可見子元素的高度總和
    if (ipResultContainer && ipResultContainer.classList.contains('hasResult')) {
      // 獲取所有非隱藏的子元素
      const visibleChildren = Array.from(ipResultContainer.children)
        .filter(child => child.style.display !== 'none');
      
      // 計算每個可見子元素的高度
      visibleChildren.forEach(child => {
        targetHeight += child.offsetHeight;
      });
      
      // 加上輸入框和容器的padding/margin等
      targetHeight += ipInput ? ipInput.offsetHeight : 0;
      targetHeight += 20; // 額外空間用於 padding 和 margin
    } else {
      // 如果沒有結果，使用最小高度
      targetHeight = MIN_PANEL_HEIGHT;
    }
    
    targetHeight = Math.max(targetHeight, MIN_PANEL_HEIGHT); 

    if (container.style.height !== `${targetHeight}px`) {
      container.style.height = `${targetHeight}px`;
      
      // 確保高度設置成功，強制重排
      // @ts-ignore
      container.offsetHeight;
    }
    
    if (typeof log === 'function') {
      log('adjustHeight_end', { 
        newStyleHeight: container ? container.style.height : 'N/A',
        finalTargetHeight: targetHeight,
        offsetHeight: container ? container.offsetHeight : 'N/A'
      });
    }
  });
};

let debounceTimeout;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    if (container) {
      // @ts-ignore
      container.offsetHeight; // 讀取 offsetHeight 來觸發 reflow
    }
    if (typeof log === 'function') { 
      log('MutationObserver_adjustHeight_call', { 
        scrollHeight: container ? container.scrollHeight : 'N/A', 
        offsetHeight: container ? container.offsetHeight : 'N/A', 
        styleHeight: container ? container.style.height : 'N/A' 
      });
    }
    adjustHeight(); 
  }, 200); 
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
    originalPlaceholder = '資料更新失敗';
    ipInput.placeholder = originalPlaceholder;
  }
}

// 導出初始化函數
export async function initIPSearch() {
  // 初始化邏輯：設置事件監聽器、調整高度等
  const container = document.querySelector('.IPsearch_in_panelALL');
  const ipInput = document.getElementById('ip_input');
  let originalPlaceholder = '';

  // 調整高度函數（保持不變）
  const adjustHeightToMin = () => {
    if (!container) return;
    requestAnimationFrame(() => {
      container.style.transition = 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
      container.style.height = `${MIN_PANEL_HEIGHT}px`;
    });
  };

  const adjustHeight = (animate = true) => {
    if (typeof log === 'function') {
      log('adjustHeight_start', { 
        animate: animate, 
        scrollHeight: container ? container.scrollHeight : 'N/A', 
        currentStyleHeight: container ? container.style.height : 'N/A' 
      });
    }
    if (!container) return;

    requestAnimationFrame(() => {
      if (animate) {
        container.style.transition = 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
      } else {
        container.style.transition = 'none';
      }

      // 取得實際需要的高度，檢查內部元素實際高度
      let targetHeight = 0;
      const ipResultContainer = document.getElementById('ip_result_container');
      
      // 如果結果容器有內容，計算所有可見子元素的高度總和
      if (ipResultContainer && ipResultContainer.classList.contains('hasResult')) {
        // 獲取所有非隱藏的子元素
        const visibleChildren = Array.from(ipResultContainer.children)
          .filter(child => child.style.display !== 'none');
        
        // 計算每個可見子元素的高度
        visibleChildren.forEach(child => {
          targetHeight += child.offsetHeight;
        });
        
        // 加上輸入框和容器的padding/margin等
        targetHeight += ipInput ? ipInput.offsetHeight : 0;
        targetHeight += 20; // 額外空間用於 padding 和 margin
      } else {
        // 如果沒有結果，使用最小高度
        targetHeight = MIN_PANEL_HEIGHT;
      }
      
      targetHeight = Math.max(targetHeight, MIN_PANEL_HEIGHT); 

      if (container.style.height !== `${targetHeight}px`) {
        container.style.height = `${targetHeight}px`;
        
        // 確保高度設置成功，強制重排
        // @ts-ignore
        container.offsetHeight;
      }
      
      if (typeof log === 'function') {
        log('adjustHeight_end', { 
          newStyleHeight: container ? container.style.height : 'N/A',
          finalTargetHeight: targetHeight,
          offsetHeight: container ? container.offsetHeight : 'N/A'
        });
      }
    });
  };

  // MutationObserver（保持不變）
  let debounceTimeout;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      if (container) {
        // @ts-ignore
        container.offsetHeight; // 讀取 offsetHeight 來觸發 reflow
      }
      if (typeof log === 'function') { 
        log('MutationObserver_adjustHeight_call', { 
          scrollHeight: container ? container.scrollHeight : 'N/A', 
          offsetHeight: container ? container.offsetHeight : 'N/A', 
          styleHeight: container ? container.style.height : 'N/A' 
        });
      }
      adjustHeight(); 
    }, 200); 
  });

  // 獲取更新日期（保持不變）
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
      originalPlaceholder = '資料更新失敗';
      ipInput.placeholder = originalPlaceholder;
    }
  }

  // 初始化
  await IP_fetchNewUpdateDate();
  if (container) {
    adjustHeight(false);
    observer.observe(container, { 
      childList: true,
      subtree: true,
      characterData: true
    });
  }
  
  if (ipInput) {
    ipInput.addEventListener('input', async function(event) {
      const currentIp = event.target.value.trim();
      if (currentIp === '') {
        IP_clearOutput();
        // 現在實作了 adjustHeightToMin 函數，替代之前被註解的程式碼
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
            ipInput.placeholder = originalPlaceholder;
        }
    });

    // 新增：監聽 keydown 事件以禁用 Enter 鍵的預設提交行為
    ipInput.addEventListener('keydown', function(event) {
      if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault(); // 防止表單提交
      }
    });
  }
}

// 新增輔助函數：檢查hostname並添加手機熱點標籤
function addHotspotTag(hostname) {
  const orgElem = document.getElementById('ip_org');
  if (!orgElem) return;

  // 移除現有的標籤（如果存在），以避免重複
  const existingTag = orgElem.querySelector('.mobile-hotspot-tag');
  if (existingTag) {
    existingTag.remove();
  }

  // 檢查hostname是否包含關鍵字
  if (/mobile|emome/i.test(hostname) && !orgElem.querySelector('.mobile-hotspot-tag')) {
    const tag = document.createElement('span');
    tag.className = 'mobile-hotspot-tag';
    Object.assign(tag.style, {
      color: '#fff',
      backgroundColor: 'rgb(61, 145, 200)',
      border: '1px solid rgb(46, 89, 114)',
      fontWeight: 'bold',
      padding: '0px 4px',
      marginLeft: '8px',
      fontSize: '10px',
      borderRadius: '4px',
      display: 'inline-block'
    });
    tag.textContent = '手機熱點';
    orgElem.appendChild(tag);
  }
}
