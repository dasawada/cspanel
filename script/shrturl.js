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
                        checkInputValue();
                    } else {
                        alert("生成短網址失敗");
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert("生成短網址失敗");
                });
        }

        // 檢查輸入框值並設置按鈕狀態
        function checkInputValue() {
            const shortUrlOutput = document.getElementById('shortUrlOutput');
            const ShrtURL_copyButton = document.getElementById('ShrtURL_copyButton');

            // 如果輸入框有值，顯示按鈕，否則隱藏按鈕
            if (shortUrlOutput.value.trim() === '') {
                ShrtURL_copyButton.style.display = 'none';
            } else {
                ShrtURL_copyButton.style.display = 'inline-block';
            }
        }

        // 複製短網址到剪貼板
        function copyShortUrlToClipboard() {
            const shortUrlOutput = document.getElementById('shortUrlOutput');

            shortUrlOutput.select();
            document.execCommand('copy');
            showCopyButtonMessage('已複製(ﾉ∀`*)');
        }

        // 顯示複製按鈕消息
        function showCopyButtonMessage(message) {
            const copyButtonMessage = document.getElementById('copyButtonMessage');
            copyButtonMessage.textContent = message;

            setTimeout(() => {
                copyButtonMessage.textContent = '';
            }, 2000); // 2秒後清除消息
        }

        // 監聽輸入框的輸入事件
        document.getElementById('shortUrlOutput').addEventListener('input', checkInputValue);

        // 初始化檢查按鈕狀態
        checkInputValue();
