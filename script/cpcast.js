function copyToClipboard(text) {
    var copyMessage = document.getElementById('copyMessage');
    copyMessage.textContent = '檔次已複製【' + text + '】';
    copyMessage.classList.remove('hidden'); // 顯示消息

    // 移除並重新添加 fade-out 類以重置動畫
    copyMessage.classList.remove('fade-out');
    void copyMessage.offsetWidth; // 觸發重排
    copyMessage.classList.add('fade-out');

    var textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);

    setTimeout(function() {
        copyMessage.classList.add('hidden'); // 動畫結束後隱藏
    }, 4000); // 與動畫持續時間匹配
}

function copyToClipboard_F12script(text, message) {
    var copyMessage = document.getElementById('copyMessage');
    copyMessage.textContent = message;
    copyMessage.classList.remove('hidden'); // 顯示消息

    // 移除並重新添加 fade-out 類以重置動畫
    copyMessage.classList.remove('fade-out');
    void copyMessage.offsetWidth; // 觸發重排
    copyMessage.classList.add('fade-out');

    var textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);

    setTimeout(function() {
        copyMessage.classList.add('hidden'); // 動畫結束後隱藏
    }, 4000); // 與動畫持續時間匹配
	
}
// 清空檔次提示語函數
document.addEventListener("DOMContentLoaded", function() {
    var copyMessage = document.getElementById('copyMessage');
    copyMessage.textContent = '　';
});

