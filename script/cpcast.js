function copyToClipboard(button, text, isDynamic = false, type = 'MGM名單') {
    if (isDynamic) {
        // 獲取當前 UTC 時間並轉換為台灣時間 (+8)
        const now = new Date();
        const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const year = taiwanTime.getUTCFullYear();
        const month = String(taiwanTime.getUTCMonth() + 1).padStart(2, '0'); // 月份補零

        // 根據 type 決定格式
        if (type === '輔導MGM') {
            // 格式為【202501_輔導MGM_B】
            text = `${year}${month}_${type}_B`;
        } else {
            // 默認格式為【2025年01月_MGM名單_B】
            text = `${year}年${month}月_${type}_B`;
        }
    }

    // 複製到剪貼簿
    var textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);

    // 按鈕變色呈現複製狀態
    var originalColor = button.style.backgroundColor; // 保存原始背景色
    button.style.backgroundColor = '#4caf50'; // 設置為綠色

    // 延遲恢復原始顏色
    setTimeout(function () {
        button.style.backgroundColor = originalColor; // 恢復原始背景色
    }, 2000); // 2秒後恢復
}
