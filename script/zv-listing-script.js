// 打開 modal
document.getElementById('zv-metting-list-modal-btn').onclick = function() {
    document.getElementById('zv-metting-list-results-modal').style.display = 'block';
}

// 關閉 modal
function zvMettingListCloseModal() {
    document.getElementById('zv-metting-list-results-modal').style.display = 'none';
}
// 點擊背景關閉 modal
document.getElementById('zv-metting-list-results-modal').onclick = function(event) {
    if (event.target === document.getElementById('zv-metting-list-results-modal')) {
        zvMettingListCloseModal();
    }
}
// 整理課程時間的函數
function zvMettingListFormatData() {
    const input = document.getElementById('zv-metting-list-inputData').value;
    const lines = input.split('\n');
    let resultArray = [];

    for (let i = 0; i < lines.length; i++) {
        const timeMatch = lines[i].match(/(\d{2}:\d{2}-\d{2}:\d{2})/);
        if (timeMatch && lines[i + 3]) {
            const time = timeMatch[0];
            const name = lines[i + 3].trim();  // 檢查是否存在第 4 行
            resultArray.push({ time, name });
        }
    }

    // 根據時間升冪排序
    resultArray.sort((a, b) => {
        const timeA = a.time.split('-')[0]; // 取起始時間
        const timeB = b.time.split('-')[0]; // 取起始時間
        return timeA.localeCompare(timeB);
    });

    // 生成排序後的結果
    let result = '';
    resultArray.forEach(item => {
        result += `${item.time} ${item.name}\n`; // 將結果加入 textarea
    });

    document.getElementById('zv-metting-list-output').value = result; // 顯示結果在 textarea 中
}

// 複製結果到剪貼簿
function zvMettingListCopyToClipboard() {
    const outputTextarea = document.getElementById('zv-metting-list-output');
    navigator.clipboard.writeText(outputTextarea.value).then(() => {
        // 更改按鈕樣式以提示複製成功
        const copyButton = document.getElementById('zv-metting-list-copy-btn');
        copyButton.style.backgroundColor = '#4CAF50'; // 綠色
        copyButton.style.color = 'white';
        copyButton.innerText = '已複製!';

        // 2秒後恢復按鈕的初始狀態
        setTimeout(() => {
            copyButton.style.backgroundColor = '';
            copyButton.style.color = '';
            copyButton.innerText = '複製';
        }, 2000);
    }).catch(err => {
        console.error('複製失敗:', err);
    });
}
