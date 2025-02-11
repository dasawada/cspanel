const googleApiKey = 'AIzaSyCozo2rhMeVsjLB2e3nlI9ln_sZ4fIdCSw';
const ipinfoToken = '5da0a6c614f15b';
const spreadsheetId = '1Trnuwo7rxpNHN6IpOcjrPEdFutxmr1KIJYmgbKwoL9E';

// 服務商資料：網段、ISP1、ISP2 (list!B1:E)
const listRange = 'list!B1:E';
// 國家對照資料：英文代碼在 A 欄、中文名稱在 C 欄 (country!A:C)
const countryMappingRange = 'ipcountry!A:C';

/**
 * 讀取 Google Sheet 中服務商資料
 */
async function getSheetData() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${listRange}?key=${googleApiKey}`;
  const response = await fetch(url);
  const data = await response.json();
  const sheetData = [];
  if (data.values) {
    data.values.forEach(row => {
      const cidrRange = row[0] ? row[0].trim() : '';
      const isp1 = row[1] ? row[1].trim() : '';
      const isp2 = row[3] ? row[3].trim() : ''; // 使用 E 欄
      if (cidrRange && (isp1 || isp2)) {
        sheetData.push({ cidrRange, isp1, isp2 });
      }
    });
  } else {
    console.error("No data found in the specified range.");
  }
  console.log("Sheet Data:", sheetData);
  return sheetData;
}
const sheetDataPromise = getSheetData();

/**
 * 讀取國家對照資料 (英文代碼 -> 中文名稱)
 */
async function getCountryMapping() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${countryMappingRange}?key=${googleApiKey}`;
  const response = await fetch(url);
  const data = await response.json();
  const mapping = {};
  if (data.values) {
    // 每列：row[0] 為英文代碼，row[2] 為中文名稱
    data.values.forEach(row => {
      const eng = row[0] ? row[0].trim() : '';
      const chi = row[2] ? row[2].trim() : '';
      if (eng && chi) {
        mapping[eng] = chi;
      }
    });
  } else {
    console.error("No country mapping data found in the specified range.");
  }
  console.log("Country mapping:", mapping);
  return mapping;
}
const countryMappingPromise = getCountryMapping();

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
 * 處理 IP 輸入，讀取 ipinfo API 資料，並依據 Google Sheet 資料及國家對照表來顯示結果
 */
async function IP_handleIpInput(ip) {
  const url = `https://ipinfo.io/${ip}?token=${ipinfoToken}`;
  try {
    const response = await fetch(url);
    const data = await response.json();

    // 取得 ipinfo 中的國家代碼及 city
    const countryCode = data.country || 'N/A';
    const city = data.city || '';
    const hostname = data.hostname || '';
    const org = data.org || 'N/A';

    // 使用國家對照表將國家代碼轉換為中文
    const countryMapping = await countryMappingPromise;
    const country = countryMapping[countryCode] || countryCode;
    const countryDisplay = city ? `${country}／${city}` : country;

    // 根據 Google Sheet 中服務商資料，比對輸入 IP 所屬網段
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

    // 顯示國家、服務商與主機名，並用 <span class="label"> 包住標題
    document.getElementById('ip_country').innerHTML = `<span class="label">國家：</span>${countryDisplay}`;

    const ispLines = ispDisplay.split('\n').map(line => `${line.trim()}`);
    document.getElementById('ip_org').innerHTML = `<span class="label">服務商：</span><br>${ispLines.join('<br>')}`;

    if (hostname) {
      document.getElementById('ip_hostname').innerHTML = `<span class="label">主機名：</span>${hostname}`;
    } else {
      document.getElementById('ip_hostname').innerHTML = '';
    }

    // 當有資料時，加入 hasResult class 以啟用分隔線樣式
    document.getElementById('ip_result_container').classList.add('hasResult');

    // 地圖處理：動態生成並插入顯示區塊
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
		const embedUrl = `https://www.google.com/maps/embed/v1/view?key=${googleApiKey}&center=${lat},${lon}&zoom=11&maptype=roadmap`;
		ipMapContainer.innerHTML = `<iframe width="260" height="260" frameborder="0" style="border:0; width:100%; height:100%;" src="${embedUrl}" allowfullscreen></iframe>`;
	} else {
		ipMapContainer.innerHTML = "";
	}
  } catch (error) {
    console.error(error);
    IP_clearOutput();
    document.getElementById('ip_country').textContent = `錯誤：`;
    document.getElementById('ip_org').textContent = `${error}`;
  }
}

document.getElementById('ip_input').addEventListener('keydown', async function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const ip = event.target.value.trim();
    if (ip === '') {
      IP_clearOutput();
      return;
    }
    await IP_handleIpInput(ip);
  }
});

document.getElementById('ip_input').addEventListener('input', async function(event) {
  const ip = event.target.value.trim();
  if (ip === '') {
    IP_clearOutput();
    return;
  }
  await IP_handleIpInput(ip);
});

function IP_clearOutput() {
  document.getElementById('ip_country').textContent = '';
  document.getElementById('ip_org').textContent = '';
  document.getElementById('ip_hostname').textContent = '';
  document.getElementById('ip_result_container').classList.remove('hasResult');
}

// 調整介面高度的程式碼
const container = document.querySelector('.IPsearch_in_panelALL');
const initialHeight = '36px';
const ipInput = document.getElementById('ip_input');

const adjustHeight = () => {
  requestAnimationFrame(() => {
    const newHeight = container.scrollHeight + 'px';
    container.style.transition = 'height 0.3s ease';
    container.style.height = ipInput.value === '' ? initialHeight : newHeight;
    console.log("Container height adjusted to:", newHeight);
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
  (使用 update 工作表中的 A1 儲存格，該儲存格記錄最新更新日期)
*/
const newGoogleApiKey = 'AIzaSyCozo2rhMeVsjLB2e3nlI9ln_sZ4fIdCSw';
const newSpreadsheetId = '1Trnuwo7rxpNHN6IpOcjrPEdFutxmr1KIJYmgbKwoL9E';
const newRange = 'update!A1:A1'; // 更新日期範圍

async function IP_fetchNewUpdateDate() {
  try {
    console.log("Fetching update date...");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${newSpreadsheetId}/values/${newRange}?key=${newGoogleApiKey}`;
    const response = await fetch(url);
    console.log("Response status:", response.status);
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }
    const data = await response.json();
    console.log("Data received:", data);
    if (!data.values || !data.values.length) {
      throw new Error('No data found in the specified range.');
    }
    const dateUpdated = data.values[0][0];
    document.getElementById('ip_input').placeholder = '資料於 ' + dateUpdated + ' 更新';
  } catch (error) {
    console.error('Error fetching update date:', error);
    document.getElementById('ip_input').placeholder = '資料更新失敗';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  IP_fetchNewUpdateDate(); // 確保獲取更新日期
  adjustHeight();         // 初次載入時調整高度
});
