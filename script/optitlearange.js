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
    });
});

// 標題生成，輸入框有值生成文本，空時清除輸出
function checkInputs() {
    var consultantName = document.getElementById("consultantName").value.replace(/\s/g, '');
    var studentName = document.getElementById("studentName").value.replace(/\s/g, '');
    var parentName = document.getElementById("parentName").value.replace(/\s/g, '');
    var invoiceNumber = document.getElementById("invoiceNumber").value.replace(/[#\s]/g, '');

    if (consultantName !== '' || studentName !== '' || parentName !== '' || invoiceNumber !== '') {
        generateText();
    } else {
        clearOutput(); // 當所有輸入框都為空時清除輸出內容
    }
}
// 將上面的標題組合成固定格式，並清除空白鍵及單號中的井字
function generateText() {
    var consultantName = document.getElementById("consultantName").value.replace(/\s/g, '');
    var studentName = document.getElementById("studentName").value.replace(/\s/g, '');
    var parentName = document.getElementById("parentName").value.replace(/\s/g, '');
    var invoiceNumber = document.getElementById("invoiceNumber").value.replace(/[#\s]/g, '');
    
    var outputText = "[顧問 " + consultantName + "] " + studentName;

    // 確保學生+家長皆有出現才加斜線
    if (studentName !== '' && parentName !== '') {
        outputText += " / " + parentName;
    } else {
        outputText += parentName;
    }
    // 有單號才顯示井號
    if (invoiceNumber !== '') {
        outputText += " #" + invoiceNumber;
    }
    // 獲取並顯示標題
    document.getElementById("optitleoutput").innerText = outputText;
}
// input 無值時清除標題
function clearOutput() {
    document.getElementById("optitleoutput").innerText = "";
}

// 清除指定的輸入欄位
function clearFields() {
    document.getElementById("consultantName").value = "";
    document.getElementById("studentName").value = "";
    document.getElementById("parentName").value = "";
    document.getElementById("invoiceNumber").value = "";
    clearOutput(); // 清除輸出內容
    search();
}

// 檢查輸入框值，並生成或清除輸出
function checkInputs() {
    var consultantName = document.getElementById("consultantName").value.replace(/\s/g, '');
    var studentName = document.getElementById("studentName").value.replace(/\s/g, '');
    var parentName = document.getElementById("parentName").value.replace(/\s/g, '');
    var invoiceNumber = document.getElementById("invoiceNumber").value.replace(/[#\s]/g, '');

    if (consultantName !== '' || studentName !== '' || parentName !== '' || invoiceNumber !== '') {
        generateText();
    } else {
        clearOutput(); // 當所有輸入框都為空時清除輸出內容
    }
}

// 複製生成好的標題 按鈕樣式
function copyText() {
    event.preventDefault();
    var textToCopy = document.getElementById("optitleoutput").innerText;
    var tempInput = document.createElement("input");
    tempInput.value = textToCopy;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);

    // 將按鈕文字設置為已複製
    var copyButton = document.getElementById("copyButton");
    copyButton.innerText = "已複製";
    copyButton.classList.add("unclickable"); // 按鈕不可選取

    // 三秒後恢復按鈕為可選取
    setTimeout(function() {
        copyButton.innerText = "複製標題";
        copyButton.classList.remove("unclickable"); // 取消按鈕不可選取
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
            const teamValue = response.values[teamRow][columnIndex];

            const p = document.createElement('p');

            // 顧問名稱部分
            const consultantSpan = document.createElement('span');
            consultantSpan.textContent = consultantName;
            consultantSpan.className = 'green-gradient-text copyable-text';
            consultantSpan.style.cursor = 'pointer';
            consultantSpan.title = '點我一下複製名字';

            consultantSpan.addEventListener('click', function() {
                const tempInput = document.createElement('input');
                tempInput.value = consultantName.substring(1); // 複製第二個字起的顧問名
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
				tempInput.value = teamLeaderValue.substring(1); // 複製第二個字起的組長名
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
            p.textContent = `【${searchString}】→這個顧問找不到組長唷 ఠ_ఠ`;
            search_SAWHO_ResultsDiv.appendChild(p);
        }
    });
}