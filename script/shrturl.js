// 短網址生成 (同時生成 is.gd 和 reurl.cc)
function ShrtURL_generateShortUrls() {
    const longUrl = document.getElementById('ShrtURL_longUrl').value;

    // 如果未輸入網址，直接結束函數
    if (!longUrl) return;

    // 呼叫 is.gd 短網址 API
    ShrtURL_shortenIsGd(longUrl);

    // 呼叫 reurl.cc 短網址 API
    ShrtURL_shortenReurl(longUrl);
}


// 呼叫 is.gd 短網址 API
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

// 呼叫 reurl.cc 短網址 API
function ShrtURL_shortenReurl(longUrl) {
    const apiUrl = 'https://stirring-pothos-28253d.netlify.app/.netlify/functions/shorten';

    fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: longUrl }),
    })
        .then(response => response.json())
        .then(data => {
            const outputField = document.getElementById('ShrtURL_reurlOutput');
            if (data.res === 'success') {
                outputField.value = data.short_url;
                ShrtURL_toggleCopyButton('ShrtURL_reurlCopyButton', true);
            } else {
                outputField.value = 'reurl.cc 短網址生成失敗';
                ShrtURL_toggleCopyButton('ShrtURL_reurlCopyButton', false);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            const outputField = document.getElementById('ShrtURL_reurlOutput');
            outputField.value = 'reurl.cc 短網址生成失敗';
            ShrtURL_toggleCopyButton('ShrtURL_reurlCopyButton', false);
        });
}

// 動態切換複製按鈕的顯示
function ShrtURL_toggleCopyButton(buttonId, isVisible) {
    const button = document.getElementById(buttonId);
    button.style.visibility = isVisible ? 'visible' : 'hidden';
}

// 檢查輸入值並動態控制生成按鈕和複製按鈕
function ShrtURL_checkInputValue() {
    const longUrl = document.getElementById('ShrtURL_longUrl').value.trim();
    const shortenButton = document.getElementById('ShrtURL_shortenButton');

    // 控制生成按鈕的狀態
    shortenButton.disabled = longUrl === '';

    // 如果輸出框無值，隱藏複製按鈕
    ShrtURL_toggleCopyButton('ShrtURL_isGdCopyButton', !!document.getElementById('ShrtURL_isGdOutput').value.trim());
    ShrtURL_toggleCopyButton('ShrtURL_reurlCopyButton', !!document.getElementById('ShrtURL_reurlOutput').value.trim());
}

// 複製短網址到剪貼板
function ShrtURL_copyUrl(outputId) {
    const outputElement = document.getElementById(outputId);
    const buttonId = outputId === 'ShrtURL_isGdOutput' ? 'ShrtURL_isGdCopyButton' : 'ShrtURL_reurlCopyButton';
    const copyButton = document.getElementById(buttonId);

    outputElement.select();
    document.execCommand('copy');

    // 切換按鈕文字為「已複製」
    copyButton.textContent = '已複製';

    // 2 秒後還原按鈕文字
    setTimeout(() => {
        copyButton.textContent = '複製';
    }, 2000);
}

// 清除所有輸入和輸出欄位
function ShrtURL_clearInputs() {
    // 清空輸入框和輸出框
    document.getElementById('ShrtURL_longUrl').value = '';
    document.getElementById('ShrtURL_isGdOutput').value = '';
    document.getElementById('ShrtURL_reurlOutput').value = '';

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

// 初始化檢查按鈕狀態
document.addEventListener('DOMContentLoaded', ShrtURL_checkInputValue);
