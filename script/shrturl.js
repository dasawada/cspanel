import { CSPANEL_API } from './cspanel-api.js';
import { authFetch, readApiError } from './auth-fetch.js';

// ===== HTML 模板 =====
const shrtUrlPanelHTML = `
<div class="linkout">
    <div class="input-container">
        <input type="text" id="ShrtURL_longUrl" placeholder="輸入網址">
        <button id="ShrtURL_shortenButton" disabled>製作短網址</button>
    </div>
    <div id="ShrtURL_isGdContainer">
        <input type="text" id="ShrtURL_isGdOutput" placeholder="此處將顯示【is.gd】短網址" readonly>
        <div style="width:85px">
            <button id="ShrtURL_isGdCopyButton">複製</button>
        </div>
    </div>

    <div id="ShrtURL_reurlContainer">
        <input type="text" id="ShrtURL_reurlOutput" placeholder="此處將顯示【reurl.cc】短網址" readonly>
        <div style="width:85px">
            <button id="ShrtURL_reurlCopyButton">複製</button>
        </div>
    </div>

    <div id="ShrtURL_clearButton">
        <i class="fas fa-trash"></i>
    </div>
</div>
`;

// ===== 初始化函數 =====
export function initShrtUrlPanel(containerId = 'shrturl-placeholder') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`initShrtUrlPanel: 找不到容器 #${containerId}`);
        return;
    }

    // 注入 HTML
    container.innerHTML = shrtUrlPanelHTML;

    // 綁定事件
    bindShrtUrlEvents();

    // 初始化按鈕狀態
    ShrtURL_checkInputValue();

    console.log('✅ ShrtUrlPanel 已初始化');
}

// ===== 清除面板函數 (登出時呼叫) =====
export function clearShrtUrlPanel(containerId = 'shrturl-placeholder') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
    }
    console.log('🧹 ShrtUrlPanel 已清除');
}

// ===== 綁定事件 =====
function bindShrtUrlEvents() {
    // 綁定輸入框 input 事件
    const inputField = document.getElementById("ShrtURL_longUrl");
    if (inputField) {
        inputField.addEventListener("input", ShrtURL_checkInputValue);
    }

    // 綁定短網址按鈕點擊事件
    const shortenButton = document.getElementById("ShrtURL_shortenButton");
    if (shortenButton) {
        shortenButton.addEventListener("click", ShrtURL_generateShortUrls);
    }

    // 綁定複製按鈕點擊事件
    const isGdCopyButton = document.getElementById("ShrtURL_isGdCopyButton");
    if (isGdCopyButton) {
        isGdCopyButton.addEventListener("click", () => ShrtURL_copyUrl("ShrtURL_isGdOutput"));
    }

    const reurlCopyButton = document.getElementById("ShrtURL_reurlCopyButton");
    if (reurlCopyButton) {
        reurlCopyButton.addEventListener("click", () => ShrtURL_copyUrl("ShrtURL_reurlOutput"));
    }

    // 綁定清除按鈕點擊事件
    const clearButton = document.getElementById("ShrtURL_clearButton");
    if (clearButton) {
        clearButton.addEventListener("click", ShrtURL_clearInputs);
    }
}

// ===== 短網址生成 (同時生成 is.gd 和 reurl.cc) =====
function ShrtURL_generateShortUrls() {
    const longUrl = document.getElementById('ShrtURL_longUrl').value;

    // 如果未輸入網址，直接結束函數
    if (!longUrl) return;

    // 呼叫 is.gd 短網址 API
    ShrtURL_shortenIsGd(longUrl);

    // 呼叫 reurl.cc 短網址 API
    ShrtURL_shortenReurl(longUrl);
}

// ===== 呼叫 is.gd 短網址 API =====
function ShrtURL_shortenIsGd(longUrl) {
    const apiUrl = `https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}`;

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            const outputField = document.getElementById('ShrtURL_isGdOutput');
            if (data.shorturl) {
                outputField.value = data.shorturl;
                ShrtURL_toggleCopyButton('ShrtURL_isGdCopyButton', true);
            } else {
                outputField.value = 'is.gd 短網址生成失敗';
                ShrtURL_toggleCopyButton('ShrtURL_isGdCopyButton', false);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            const outputField = document.getElementById('ShrtURL_isGdOutput');
            outputField.value = 'is.gd 短網址生成失敗';
            ShrtURL_toggleCopyButton('ShrtURL_isGdCopyButton', false);
        });
}

// ===== 呼叫 reurl.cc 短網址 API =====
async function ShrtURL_shortenReurl(longUrl) {
    const outputField = document.getElementById('ShrtURL_reurlOutput');
    try {
        const response = await authFetch(CSPANEL_API.shorten, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: longUrl }),
        });
        if (!response.ok) {
            const apiError = await readApiError(response);
            const error = new Error(apiError.message);
            error.code = apiError.code;
            error.requestId = apiError.requestId;
            throw error;
        }

        const data = await response.json();
        if (data.res === 'success') {
            outputField.value = data.short_url;
            ShrtURL_toggleCopyButton('ShrtURL_reurlCopyButton', true);
        } else {
            outputField.value = 'reurl.cc 短網址生成失敗';
            ShrtURL_toggleCopyButton('ShrtURL_reurlCopyButton', false);
        }
    } catch (error) {
        console.error('reurl.cc proxy error:', error);
        const code = error?.code ? `[${error.code}]` : '';
        const requestId = error?.requestId ? ` requestId: ${error.requestId}` : '';
        outputField.value = code || requestId
            ? `reurl.cc 短網址生成失敗（${code}${requestId}）`
            : 'reurl.cc 短網址生成失敗';
        ShrtURL_toggleCopyButton('ShrtURL_reurlCopyButton', false);
    }
}

// ===== 動態切換複製按鈕的顯示 =====
function ShrtURL_toggleCopyButton(buttonId, isVisible) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.style.visibility = isVisible ? 'visible' : 'hidden';
    }
}

// ===== 檢查輸入值並動態控制生成按鈕和複製按鈕 =====
function ShrtURL_checkInputValue() {
    const longUrlInput = document.getElementById('ShrtURL_longUrl');
    const shortenButton = document.getElementById('ShrtURL_shortenButton');

    if (!longUrlInput || !shortenButton) return;

    const longUrl = longUrlInput.value.trim();

    // 控制生成按鈕的狀態
    shortenButton.disabled = longUrl === '';

    // 如果輸出框無值，隱藏複製按鈕
    const isGdOutput = document.getElementById('ShrtURL_isGdOutput');
    const reurlOutput = document.getElementById('ShrtURL_reurlOutput');
    
    if (isGdOutput) {
        ShrtURL_toggleCopyButton('ShrtURL_isGdCopyButton', !!isGdOutput.value.trim());
    }
    if (reurlOutput) {
        ShrtURL_toggleCopyButton('ShrtURL_reurlCopyButton', !!reurlOutput.value.trim());
    }
}

// ===== 複製短網址到剪貼板 =====
function ShrtURL_copyUrl(outputId) {
    const outputElement = document.getElementById(outputId);
    const buttonId = outputId === 'ShrtURL_isGdOutput' ? 'ShrtURL_isGdCopyButton' : 'ShrtURL_reurlCopyButton';
    const copyButton = document.getElementById(buttonId);

    if (!outputElement || !copyButton) return;

    outputElement.select();
    document.execCommand('copy');

    // 切換按鈕文字為「已複製」
    copyButton.textContent = '已複製';

    // 2 秒後還原按鈕文字
    setTimeout(() => {
        copyButton.textContent = '複製';
    }, 2000);
}

// ===== 清除所有輸入和輸出欄位 =====
function ShrtURL_clearInputs() {
    const longUrlInput = document.getElementById('ShrtURL_longUrl');
    const isGdOutput = document.getElementById('ShrtURL_isGdOutput');
    const reurlOutput = document.getElementById('ShrtURL_reurlOutput');

    // 清空輸入框和輸出框
    if (longUrlInput) longUrlInput.value = '';
    if (isGdOutput) isGdOutput.value = '';
    if (reurlOutput) reurlOutput.value = '';

    // 隱藏複製按鈕
    ShrtURL_toggleCopyButton('ShrtURL_isGdCopyButton', false);
    ShrtURL_toggleCopyButton('ShrtURL_reurlCopyButton', false);

    // 確保清除按鈕動畫
    const clearButtonIcon = document.querySelector('#ShrtURL_clearButton i');
    if (clearButtonIcon) {
        clearButtonIcon.classList.add('trash-animated');
        setTimeout(() => {
            clearButtonIcon.classList.remove('trash-animated');
        }, 1000); // 動畫持續 1 秒
    }

    // 更新按鈕狀態
    ShrtURL_checkInputValue();
}
