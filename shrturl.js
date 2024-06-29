// 短網址生成
function shortenUrlIsGd() {
    const longUrl = document.getElementById('longUrl').value;
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
            } else {
                alert("生成短網址失敗");
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert("生成短網址失敗");
        });
}

// 複製短網址到剪貼版
function copyShortUrlToClipboard() {
    const shortUrlOutput = document.getElementById('shortUrlOutput');
    shortUrlOutput.select();
    document.execCommand('copy');
    showCopyButtonMessage('已複製(ﾉ∀`*)');
}

// 顯示複製狀態消息
function showCopyButtonMessage(message) {
    const copyButton = document.getElementById('shortencpbt');
    copyButton.textContent = message;

    setTimeout(() => {
        copyButton.textContent = 'Copy';
    }, 2000); // 2秒後重置按鈕文本
}