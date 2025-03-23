import { callGoogleSheetAPI } from './googleSheetAPI.js';

// 以下為原 optitlearange.js 的內容（浮水印、輸入框檢查、標題生成等）
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

function checkInputs() {
  const consultantName = document.getElementById("consultantName").value.trim();
  const studentName = document.getElementById("studentName").value.trim();
  const parentName = document.getElementById("parentName").value.trim();
  const invoiceNumber = document.getElementById("invoiceNumber").value.trim();

  if (consultantName === '' && studentName === '' && parentName === '' && invoiceNumber === '') {
    clearOutput();
  } else {
    generateText();
  }
}

function generateText() {
  // 生成標題文本，並同時透過 Netlify proxy 間接讀取 Google Sheets 資料（例如範圍"wtf"，避免前端暴露 API key）
  const consultantName = document.getElementById("consultantName").value.replace(/\s/g, '');
  const studentName = document.getElementById("studentName").value.replace(/\s/g, '');
  const parentName = document.getElementById("parentName").value.replace(/\s/g, '');
  const invoiceNumber = document.getElementById("invoiceNumber").value.replace(/[#\s]/g, '');
  
  let outputText = "[顧問 " + consultantName + "] " + studentName;
  if (studentName !== '' && parentName !== '') {
    outputText += " / " + parentName;
  } else {
    outputText += parentName;
  }
  if (invoiceNumber !== '') {
    outputText += " #" + invoiceNumber;
  }
  
  // 更新顯示區
  const optitleOutput = document.getElementById("optitleoutput");
  optitleOutput.style.transform = "scale(1.1)";
  optitleOutput.style.opacity = "0.5";
  optitleOutput.innerHTML = outputText + 
    '<button id="OPtitle_copyButton" type="button" onclick="OPtitle_copyText()" style="border: none; margin-left: 6px;" title="複製到剪貼簿">' +
    '<img src="img/copy-icon.png" alt="複製標題" style="width: 15px; height: 15px;">' +
    '</button>';
  
  setTimeout(() => {
    optitleOutput.style.transform = "scale(1)";
    optitleOutput.style.opacity = "1";
  }, 100);
  
  // 以下範例示範如何使用 proxy 取得 Google Sheets 資料，進一步處理（如需要）
  // callGoogleSheetAPI({ range: 'wtf' })
  //   .then(data => {
  //     console.log("Fetched sheet data:", data);
  //     // 可依需求修改 outputText
  //   })
  //   .catch(err => console.error("Sheet data fetch error:", err));
}

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

document.getElementById('consultantName').addEventListener('input', checkInputs);
document.getElementById('studentName').addEventListener('input', checkInputs);
document.getElementById('parentName').addEventListener('input', checkInputs);
document.getElementById('invoiceNumber').addEventListener('input', checkInputs);

function clearFields() {
  document.getElementById("consultantName").value = "";
  document.getElementById("studentName").value = "";
  document.getElementById("parentName").value = "";
  document.getElementById("invoiceNumber").value = "";
  
  document.getElementById("consultantName").dispatchEvent(new Event('blur'));
  document.getElementById("studentName").dispatchEvent(new Event('blur'));
  document.getElementById("parentName").dispatchEvent(new Event('blur'));
  document.getElementById("invoiceNumber").dispatchEvent(new Event('blur'));
  
  clearOutput();
  search();
  
  const button = document.getElementById('clearButton');
  const icon = button.querySelector('i');
  icon.classList.add('trash-animated');
  setTimeout(() => {
    icon.classList.remove('trash-animated');
  }, 1000);
}

function OPtitle_copyText() {
  event.preventDefault();
  var textToCopy = document.getElementById("optitleoutput").innerText;
  var tempInput = document.createElement("input");
  tempInput.value = textToCopy;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand("copy");
  document.body.removeChild(tempInput);
  
  var copyButton = document.getElementById("OPtitle_copyButton");
  copyButton.classList.add("OPtitle_copied", "OPtitle_unclickable");
  var tempTitle = copyButton.title;
  copyButton.title = "";
  copyButton.title = tempTitle;
  setTimeout(function() {
    copyButton.classList.remove("OPtitle_copied", "OPtitle_unclickable");
  }, 3000);
}

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
    clearOutput();
    return;
  }
  
  generateText();
  
  callGoogleSheetAPI({ range: 'wtf' })
    .then(response => {
      console.log(response);
      const search_SAWHO_ResultsSpan = document.getElementById('search_SAWHO_ResultsSpan');
      const search_SAWHO_ResultsDiv = document.getElementById('search_SAWHO_ResultsDiv');
      search_SAWHO_ResultsSpan.innerHTML = '';
      search_SAWHO_ResultsDiv.innerHTML = '';
      let found = false;
      for (let rowIndex = 0; rowIndex < response.values.length; rowIndex++) {
        for (let columnIndex = 0; columnIndex < response.values[rowIndex].length; columnIndex++) {
          const cellValue = response.values[rowIndex][columnIndex].replace(/\s+/g, '').toLowerCase();
          if (cellValue === searchString.toLowerCase()) {
            const resultColumnIdentifier = String.fromCharCode('A'.charCodeAt(0) + columnIndex);
            const teamLeaderRow = 3;
            const teamRow = teamLeaderRow - 1;
            const consultantName = response.values[rowIndex][columnIndex];
            const teamLeaderValue = response.values[teamLeaderRow][columnIndex];
            const teamValue = response.values[teamRow][columnIndex];
            const p = document.createElement('p');
            const consultantSpan = document.createElement('span');
            consultantSpan.textContent = consultantName;
            consultantSpan.className = 'green-gradient-text copyable-text';
            consultantSpan.style.cursor = 'pointer';
            consultantSpan.title = '點我一下複製名字';
            consultantSpan.addEventListener('click', function() {
              const tempInput = document.createElement('input');
              tempInput.value = consultantName.length <= 2 ? consultantName.slice(-1) : consultantName.slice(-2);
              document.body.appendChild(tempInput);
              tempInput.select();
              document.execCommand('copy');
              document.body.removeChild(tempInput);
              consultantSpan.title = '已複製！';
              setTimeout(() => {
                consultantSpan.title = '點我一下複製名字';
              }, 1000);
            });
            const leaderSpan = document.createElement('span');
            leaderSpan.textContent = teamLeaderValue;
            leaderSpan.className = 'yellow-gradient-text copyable-text';
            leaderSpan.style.cursor = 'pointer';
            leaderSpan.title = '點我一下複製名字';
            leaderSpan.addEventListener('click', function() {
              const tempInput = document.createElement('input');
              tempInput.value = teamLeaderValue.length <= 2 ? teamLeaderValue.slice(-1) : teamLeaderValue.slice(-2);
              document.body.appendChild(tempInput);
              tempInput.select();
              document.execCommand('copy');
              document.body.removeChild(tempInput);
              leaderSpan.title = '已複製！';
              setTimeout(() => {
                leaderSpan.title = '點我一下複製名字';
              }, 1000);
            });
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
        if (found) break;
      }
      if (!found) {
        const p = document.createElement('p');
        p.textContent = `【${searchString}】咦？這顧問找不到組長唷ఠ_ఠ`;
        document.getElementById('search_SAWHO_ResultsDiv').appendChild(p);
      }
    })
    .catch(error => console.error(error));
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('consultantName').addEventListener('input', checkInputs);
  document.getElementById('studentName').addEventListener('input', checkInputs);
  document.getElementById('parentName').addEventListener('input', checkInputs);
  document.getElementById('invoiceNumber').addEventListener('input', checkInputs);
  document.getElementById('clearButton').addEventListener('click', clearFields);
});
let previousOptitleOutput = '';

function updateOptitleOutput(content) {
  previousOptitleOutput = content;
  document.getElementById('optitleoutput').innerHTML = content;
}

function clearOptitleOutput() {
  document.getElementById('optitleoutput').innerHTML = previousOptitleOutput;
}

// ...existing code...