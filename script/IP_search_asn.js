const googleApiKey = 'AIzaSyCozo2rhMeVsjLB2e3nlI9ln_sZ4fIdCSw';
const ipinfoToken = '5da0a6c614f15b';
const spreadsheetId = '1Trnuwo7rxpNHN6IpOcjrPEdFutxmr1KIJYmgbKwoL9E';
const range = 'list!B1:D'; // 包含CIDR、ISP和ASN的範圍

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
        return [ipLow, ipHigh];
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
            clearOutput();
            return;
        }
        await handleIpInput(ip);
    }
});

document.getElementById('ip_input').addEventListener('input', async function(event) {
    const ip = event.target.value.trim();
    if (ip === '') {
        clearOutput();
        return;
    }
    await handleIpInput(ip);
});

async function handleIpInput(ip) {
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
        clearOutput();
        document.getElementById('ip_country').textContent = `錯誤：`;
        document.getElementById('ip_org').textContent = `${error}`;
    }
}

function clearOutput() {
    document.getElementById('ip_country').textContent = '';
    document.getElementById('ip_org').textContent = '';
    document.getElementById('ip_hostname').textContent = ''; // 清空主機名
}


		
// placeholder日期顯示

        const newGoogleApiKey = 'AIzaSyCozo2rhMeVsjLB2e3nlI9ln_sZ4fIdCSw';
        const newSpreadsheetId = '1Trnuwo7rxpNHN6IpOcjrPEdFutxmr1KIJYmgbKwoL9E';
        const newRange = 'update!A1:A1'; // 更新日期範圍

        async function fetchNewUpdateDate() {
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

        document.addEventListener('DOMContentLoaded', fetchNewUpdateDate);
		
// 展開收合的平滑動畫效果
const container = document.querySelector('.IPsearch_in_panelALL');
const ipInput = document.getElementById('ip_input');
const initialHeight = container.style.height || '36px'; // 初始高度

// 设置一个定时器，每隔0.5秒检查一次容器的高度变化
setInterval(() => {
  const currentHeight = container.clientHeight;
  const newHeight = container.scrollHeight + 'px';

  if (container.style.height !== newHeight) {
    container.style.height = newHeight;
  }
}, 1);

ipInput.addEventListener('input', () => {
  if (ipInput.value === '') {
    container.style.transition = 'height 0.1s ease';
    container.style.height = initialHeight;
  } else {
    container.style.transition = 'height 0.1s ease';
    const newHeight = container.scrollHeight + 'px';
    container.style.height = newHeight;
  }
});