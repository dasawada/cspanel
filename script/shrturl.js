
    // 短網址生成
    function shortenUrlIsGd() {
        const longUrl = document.getElementById('longUrl').value;
        const shortenButton = document.getElementById('shortenButton');

        if (!longUrl) {
            alert("請輸入網址");
            return;
        }

        const apiUrl = `https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}`;

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                if (data.shorturl) {
                    document.getElementById('shortUrlOutput').value = data.shorturl;
                    checkInputValue();
                    showShortenButtonMessage('生成成功');
                } else {
                    showShortenButtonMessage('生成失敗');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showShortenButtonMessage('生成失敗');
            });
    }

// 檢查輸入框值並設置按鈕狀態
function checkInputValue() {
    const longUrl = document.getElementById('longUrl').value.trim();
    const shortUrlOutput = document.getElementById('shortUrlOutput').value.trim();
    const ShrtURL_copyButton = document.getElementById('ShrtURL_copyButton');
    const shortenButton = document.getElementById('shortenButton');

    // 如果長網址輸入框無值，禁用生成按鈕和复制按钮
    if (longUrl === '') {
        ShrtURL_copyButton.style.visibility = 'hidden';
        shortenButton.disabled = true;
    } else {
        shortenButton.disabled = false;
    }

    // 如果短網址輸出框無值，禁用复制按钮
    if (shortUrlOutput === '') {
        ShrtURL_copyButton.style.visibility = 'hidden';
    } else {
        ShrtURL_copyButton.style.visibility = 'visible';
    }
}

    // 複製短網址到剪貼板
    function copyShortUrlToClipboard() {
        const shortUrlOutput = document.getElementById('shortUrlOutput');
        const ShrtURL_copyButton = document.getElementById('ShrtURL_copyButton');

        shortUrlOutput.select();
        document.execCommand('copy');
        showShrtURL_copyButtonMessage('已複製！');
    }

    // 顯示复制按鈕消息
    function showShrtURL_copyButtonMessage(message) {
        const ShrtURL_copyButton = document.getElementById('ShrtURL_copyButton');
        ShrtURL_copyButton.textContent = message;

        setTimeout(() => {
            ShrtURL_copyButton.textContent = 'Copy';
        }, 2000); // 2秒後重置按鈕文本
    }

    // 顯示生成按鈕消息
    function showShortenButtonMessage(message) {
        const shortenButton = document.getElementById('shortenButton');
        shortenButton.textContent = message;

        setTimeout(() => {
            shortenButton.textContent = '製作短網址';
        }, 2000); // 2秒後重置按鈕文本
    }

    // 初始化檢查按鈕狀態
    document.addEventListener('DOMContentLoaded', checkInputValue);
	
// 清除指定的輸入欄位
function shorturl_clearInput() {
    // 清空欄位的邏輯
    document.getElementById('longUrl').value = ''; // 清空输入字段
    document.getElementById('shortUrlOutput').value = ''; // 清空输出字段

    // 獲取垃圾桶按鈕元素並添加動畫效果
    const icon = document.querySelector('#shorturl_clearButton i');
    if (icon) {
        icon.classList.add('trash-animated');

        setTimeout(() => {
            icon.classList.remove('trash-animated');
        }, 1000); // 动画持续时间1秒
    }
}
