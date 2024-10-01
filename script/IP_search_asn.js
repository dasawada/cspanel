const googleApiKey = 'AIzaSyCozo2rhMeVsjLB2e3nlI9ln_sZ4fIdCSw';
const ipinfoToken = '5da0a6c614f15b';
const spreadsheetId = '1Trnuwo7rxpNHN6IpOcjrPEdFutxmr1KIJYmgbKwoL9E';
const range = 'list!B1:D';

async function getASNData() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${googleApiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    const asnData = {};
    if (data.values) {
        data.values.forEach(row => {
            const [cidrRange, ispName, asn] = row;
            if (cidrRange && ispName && asn) {
                const trimmedCidrRange = cidrRange.trim();
                const trimmedIspName = ispName.trim();
                const trimmedAsn = asn.trim();
                if (!asnData[trimmedAsn]) {
                    asnData[trimmedAsn] = [];
                }
                asnData[trimmedAsn].push({ cidrRange: trimmedCidrRange, ispName: trimmedIspName });
            }
        });
    } else {
        console.error("No data found in the specified range.");
    }
    console.log("ASN Data:", asnData); // 調試輸出
    return asnData;
}

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
        return [ipLow >>> 0, ipHigh >>> 0]; // 使用無符號右移保證範圍正確
    }

    const ipLong = ipToLong(ip);
    const [low, high] = cidrToRange(cidr);
    return ipLong >= low && ipLong <= high;
}

const asnDataPromise = getASNData();

document.getElementById('ip_input').addEventListener('keydown', async function(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); // 阻止默認提交
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

async function IP_handleIpInput(ip) {
    const url = `https://ipinfo.io/${ip}?token=${ipinfoToken}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        const country = data.country || 'N/A';
        const org = data.org || 'N/A';
        const hostname = data.hostname || ''; // 提取主機名，如果無值則為空字符串
        const asn = org.split(' ')[0].replace('AS', ''); // 提取 ASN 編號

        const asnData = await asnDataPromise;
        let found = false;
        let ispName = '未知服務商';
        if (asnData[asn]) {
            for (const entry of asnData[asn]) {
                if (isIpInCidr(ip, entry.cidrRange)) {
                    ispName = entry.ispName;
                    found = true;
                    break;
                }
            }
        }

        if (!found) { // 如果未找到，顯示ipinfo的原始結果
            ispName = org;
        }

        document.getElementById('ip_country').textContent = `國家：${country}`;
        document.getElementById('ip_org').textContent = `服務商：${ispName}`;
        
        if (hostname) { // 如果主機名不為空，則顯示主機名
            document.getElementById('ip_hostname').textContent = `主機名：${hostname}`;
        } else { // 如果主機名為空，則清空主機名顯示區域
            document.getElementById('ip_hostname').textContent = '';
        }
    } catch (error) {
        console.error(error);
        IP_clearOutput();
        document.getElementById('ip_country').textContent = `錯誤：`;
        document.getElementById('ip_org').textContent = `${error}`;
    }
}

function IP_clearOutput() {
    document.getElementById('ip_country').textContent = '';
    document.getElementById('ip_org').textContent = '';
    document.getElementById('ip_hostname').textContent = ''; // 清空主機名
}

// 獲取最近更新日期並設置佔位符
const newGoogleApiKey = 'AIzaSyCozo2rhMeVsjLB2e3nlI9ln_sZ4fIdCSw';
const newSpreadsheetId = '1Trnuwo7rxpNHN6IpOcjrPEdFutxmr1KIJYmgbKwoL9E';
const newRange = 'update!A1:A1'; // 更新日期範圍

async function IP_fetchNewUpdateDate() {
    try {
        console.log("Fetching update date...");
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${newSpreadsheetId}/values/${newRange}?key=${newGoogleApiKey}`;
        const response = await fetch(url);
        console.log("Response status:", response.status); // 檢查狀態碼
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const data = await response.json();
        console.log("Data received:", data); // 檢查響應內容
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
    adjustHeight(); // 初次加载时的高度调整
});

const container = document.querySelector('.IPsearch_in_panelALL');
const initialHeight = '36px'; // 初始高度
const ipInput = document.getElementById('ip_input');

// 调整高度的函数
const adjustHeight = () => {
  requestAnimationFrame(() => {
    const newHeight = container.scrollHeight + 'px'; // 计算新的高度
    container.style.transition = 'height 0.3s ease';

    if (ipInput.value === '') {
      container.style.height = initialHeight;
    } else {
      container.style.height = newHeight; // 根据输入内容调整高度
    }
    
    console.log("Container height adjusted to:", newHeight);
  });
};

// 添加 MutationObserver 强制监听 DOM 变化
const observer = new MutationObserver(() => {
  adjustHeight();  // DOM 有变化时，强制调整高度
});

// 监听容器内部 DOM 变化，主要观察 IP input 相关的变化
observer.observe(container, { childList: true, subtree: true });

// 输入框事件监听
ipInput.addEventListener('input', () => {
  setTimeout(adjustHeight, 0); // 在每次输入后调整高度
});

// 处理粘贴内容时的高度调整
ipInput.addEventListener('paste', () => {
  setTimeout(adjustHeight, 50);  // 确保内容粘贴完成后调整高度
});

// 页面加载时检查输入框是否有值
document.addEventListener('DOMContentLoaded', () => {
  if (ipInput.value !== '') {
    adjustHeight(); // 页面加载后如果input有值，调整高度
  }
});

// 点击 input 时强制触发高度检查
ipInput.addEventListener('click', adjustHeight);
