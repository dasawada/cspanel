// 標題生成的浮水印
document.querySelectorAll('.optitle-input').forEach(input => {
    const placeholder = input.nextElementSibling;
    if (input.value) {
        placeholder.style.visibility = 'hidden';
    }
    input.addEventListener('focus', () => {
        placeholder.style.visibility = 'hidden';
    });
    input.addEventListener('blur', () => {
        if (!input.value) {
            placeholder.style.visibility = 'visible';
        }
    });
    input.addEventListener('input', () => {
        if (input.value) {
            placeholder.style.visibility = 'hidden';
        } else {
            placeholder.style.visibility = 'visible';
        }
        checkInputs(); // 每次輸入改變時檢查輸入框值
    });
});

// 檢查輸入框值，並生成或清除輸出
function checkInputs() {
    var consultantName = document.getElementById("consultantName").value.trim();
    var studentName = document.getElementById("studentName").value.trim();
    var parentName = document.getElementById("parentName").value.trim();
    var invoiceNumber = document.getElementById("invoiceNumber").value.trim();

    // 如果所有輸入框都為空，則清除輸出並顯示預設文本
    if (consultantName === '' && studentName === '' && parentName === '' && invoiceNumber === '') {
        clearOutput(); // 清除輸出內容
    } else {
        // 如果其中任一輸入框有值，則生成結果
        generateText();
    }
}

// 將上面的標題組合成固定格式，並清除空白鍵及單號中的井字
function generateText() {
    var consultantName = document.getElementById("consultantName").value.replace(/\s/g, '');
    var studentName = document.getElementById("studentName").value.replace(/\s/g, '');
    var parentName = document.getElementById("parentName").value.replace(/\s/g, '');
    var invoiceNumber = document.getElementById("invoiceNumber").value.replace(/[#\s]/g, '');

    var outputText = "[顧問 " + consultantName + "] " + studentName;
    
    if (studentName !== '' && parentName !== '') {
        outputText += " / " + parentName;
    } else {
        outputText += parentName;
    }

    if (invoiceNumber !== '') {
        outputText += " #" + invoiceNumber;
    }

    var copyButtonHTML = '<button id="OPtitle_copyButton" type="button" onclick="OPtitle_copyText()" style="border: none; margin-left: 6px;" title="複製到剪貼簿">' +
                         '<img src="img/copy-icon.png" alt="複製標題" style="width: 15px; height: 15px;">' +
                         '</button>';

    const optitleOutput = document.getElementById("optitleoutput");
    optitleOutput.style.transform = "scale(1.1)";
    optitleOutput.style.opacity = "0.5";

    // 更新文本和按钮
    optitleOutput.innerHTML = outputText + copyButtonHTML;

    // 恢复样式
    setTimeout(() => {
        optitleOutput.style.transform = "scale(1)";
        optitleOutput.style.opacity = "1";
    }, 100);
}


// 清除文本，重置為預設文本
function clearOutput() {
    const optitleOutput = document.getElementById("optitleoutput");
    optitleOutput.style.transform = "scale(1.1)";
    optitleOutput.style.opacity = "0.5";
    
    setTimeout(() => {
        optitleOutput.innerText = "生成的標題會顯示在這裡٩(๑❛ᴗ❛๑)۶";
        optitleOutput.style.transform = "scale(1)";
        optitleOutput.style.opacity = "1";
    }, 1000);
}
// 每次輸入變化時，統一通過 checkInputs() 函數來檢查所有輸入框的值
document.getElementById('consultantName').addEventListener('input', checkInputs);
document.getElementById('studentName').addEventListener('input', checkInputs);
document.getElementById('parentName').addEventListener('input', checkInputs);
document.getElementById('invoiceNumber').addEventListener('input', checkInputs);


// 清除指定的輸入欄位
function clearFields() {
    // 清空欄位的邏輯
    document.getElementById("consultantName").value = "";
    document.getElementById("studentName").value = "";
    document.getElementById("parentName").value = "";
    document.getElementById("invoiceNumber").value = "";
    
    // 手動觸發 blur 事件
    document.getElementById("consultantName").dispatchEvent(new Event('blur'));
    document.getElementById("studentName").dispatchEvent(new Event('blur'));
    document.getElementById("parentName").dispatchEvent(new Event('blur'));
    document.getElementById("invoiceNumber").dispatchEvent(new Event('blur'));

    clearOutput(); // 清除輸出內容
    search();
	
    // 獲取垃圾桶按鈕元素
    const button = document.getElementById('clearButton');
    // 獲取圖標元素
    const icon = button.querySelector('i');
    // 添加動畫效果
    icon.classList.add('trash-animated');
    
    // 等待動畫結束後移除動畫類
    setTimeout(() => {
        icon.classList.remove('trash-animated');
    }, 1000); // 動畫持續時間1秒
}

// 複製按鈕功能
function OPtitle_copyText() {
    event.preventDefault();
    var textToCopy = document.getElementById("optitleoutput").innerText;
    var tempInput = document.createElement("input");
    tempInput.value = textToCopy;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);

    // 將按鈕設置為已複製狀態
    var copyButton = document.getElementById("OPtitle_copyButton");
    copyButton.classList.add("OPtitle_copied", "OPtitle_unclickable");
	
	
    // 重新觸發 title 屬性更新
    var tempTitle = copyButton.title;
    copyButton.title = "";
    copyButton.title = tempTitle;

    // 三秒後恢復按鈕為可選擇狀態
    setTimeout(function() {
        copyButton.classList.remove("OPtitle_copied", "OPtitle_unclickable");
    }, 3000);
}

// search 函數只處理 consultantName
function search() {
    var searchString = document.getElementById('consultantName').value.replace(/\s+/g, '');

    if (searchString === '') {
        const searchResultsDiv = document.getElementById('search_SAWHO_ResultsDiv');
        const searchResultsSpan = document.getElementById('search_SAWHO_ResultsSpan');
        if (searchResultsDiv) {
            searchResultsDiv.innerHTML = '';
        }
        if (searchResultsSpan) {
            searchResultsSpan.innerHTML = '';
        }
        clearOutput(); // 清除輸出內容
        return;
    }

    // 始终生成文本
    generateText();
	
    $.get(endpoint, function(response) {
        console.log(response);

        const search_SAWHO_ResultsSpan = document.getElementById('search_SAWHO_ResultsSpan');
        const search_SAWHO_ResultsDiv = document.getElementById('search_SAWHO_ResultsDiv');

        search_SAWHO_ResultsSpan.innerHTML = '';
        search_SAWHO_ResultsDiv.innerHTML = '';

        let found = false;
        for (let rowIndex = 0; rowIndex < response.values.length; rowIndex++) {
            for (let columnIndex = 0; columnIndex < response.values[rowIndex].length; columnIndex++) {
                const cellValue = response.values[rowIndex][columnIndex].replace(/\s+/g, '').toLowerCase(); // 去除所有單元格內的空白字符
                if (cellValue === searchString.toLowerCase()) {
                    const resultColumnIdentifier = String.fromCharCode('A'.charCodeAt(0) + columnIndex);
                    const teamLeaderRow = 3;
                    const teamRow = teamLeaderRow - 1;

                    const consultantName = response.values[rowIndex][columnIndex];
                    const teamLeaderValue = response.values[teamLeaderRow][columnIndex];
                    let teamValue = response.values[teamRow][columnIndex];

                    // 如果 teamLeaderValue 或 teamValue 為空，自動填入"不知道"
                    if (!teamLeaderValue) {
                        teamLeaderValue = "不知道";
                    }
                    if (!teamValue) {
                        teamValue = "不知道";
                    }

                    const p = document.createElement('p');

                    // 顧問名稱部分
                    const consultantSpan = document.createElement('span');
                    consultantSpan.textContent = consultantName;
                    consultantSpan.className = 'green-gradient-text copyable-text';
                    consultantSpan.style.cursor = 'pointer';
                    consultantSpan.title = '點我一下複製名字';

                    consultantSpan.addEventListener('click', function() {
                        const tempInput = document.createElement('input');
                        if (consultantName.length <= 2) {
                            tempInput.value = consultantName.slice(-1); // 若顧問名為兩個字符或更少，複製最後一個字符
                        } else {
                            tempInput.value = consultantName.slice(-2); // 複製最後兩個字符
                        }
                        document.body.appendChild(tempInput);
                        tempInput.select();
                        document.execCommand('copy');
                        document.body.removeChild(tempInput);
                        consultantSpan.title = '已複製！';
                        
                        // 一秒後復原 title
                        setTimeout(function() {
                            consultantSpan.title = '點我一下複製名字';
                        }, 1000); // 1000 毫秒 = 1 秒
                    });

                    // 組長部分
                    const leaderSpan = document.createElement('span');
                    leaderSpan.textContent = teamLeaderValue;
                    leaderSpan.className = 'yellow-gradient-text copyable-text';
                    leaderSpan.style.cursor = 'pointer';
                    leaderSpan.title = '點我一下複製名字';

                    leaderSpan.addEventListener('click', function() {
                        const tempInput = document.createElement('input');
                        tempInput.value = teamLeaderValue.slice(-2); // 複製第二個字起的組長名
                        document.body.appendChild(tempInput);
                        tempInput.select();
                        document.execCommand('copy');
                        document.body.removeChild(tempInput);
                        leaderSpan.title = '已複製！';

                        // 一秒後復原 title
                        setTimeout(function() {
                            leaderSpan.title = '點我一下複製名字';
                        }, 1000); // 1000 毫秒 = 1 秒
                    });

                    // 構建完整的文本
                    p.appendChild(document.createTextNode('顧問'));
                    p.appendChild(consultantSpan);
                    p.appendChild(document.createTextNode('的組長是：'));
                    p.appendChild(leaderSpan);
                    p.appendChild(document.createTextNode(`（team：${teamValue}）`));

                    document.getElementById('search_SAWHO_ResultsSpan').appendChild(p);

                    found = true;
                    break;
                }
            }
            if (found) {
                break;
            }
        }

        if (!found) {
            const p = document.createElement('p');
            p.textContent = `【${searchString}】咦？這顧問找不到組長唷ఠ_ఠ`;
            search_SAWHO_ResultsDiv.appendChild(p);
        }
    });
}

// 在 document 加載完成後設置事件監聽器
document.addEventListener('DOMContentLoaded', function() {
    // 將事件綁定到輸入框，輸入變化時檢查並更新結果
    document.getElementById('consultantName').addEventListener('input', checkInputs);
    document.getElementById('studentName').addEventListener('input', checkInputs);
    document.getElementById('parentName').addEventListener('input', checkInputs);
    document.getElementById('invoiceNumber').addEventListener('input', checkInputs);
    document.getElementById('clearButton').addEventListener('click', clearFields);
});
let previousOptitleOutput = '';

// 更新 optitleoutput 的内容
function updateOptitleOutput(content) {
    previousOptitleOutput = content;
    document.getElementById('optitleoutput').innerHTML = content;
}

// 清空 optitleoutput 但保留先前的结果
function clearOptitleOutput() {
    document.getElementById('optitleoutput').innerHTML = previousOptitleOutput;
}
