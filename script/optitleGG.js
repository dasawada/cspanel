import { callGoogleSheetAPI } from './googleSheetAPI.js';

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
    search(); // added so that search gets triggered on input change
  }
}

function generateText() {
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
  outputText += "";
  
  // 更新顯示區
  const optitleOutput = document.getElementById("optitleoutput");
  optitleOutput.style.transform = "scale(1.1)";
  optitleOutput.style.opacity = "0.5";
  optitleOutput.innerHTML = outputText + 
    '<button id="OPtitle_copyButton" type="button" onclick="OPtitle_copyText(event)" style="border: none;padding: 3px;margin-left:3px;" title="複製到剪貼簿">' +
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

// 修改複製按鈕功能，接受 event 參數
function OPtitle_copyText(e) {
  if(e && e.preventDefault) e.preventDefault();
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

// 新增全域變數，用來存放結構化的 "wtf" 表資料
let structuredWtfRecords = [];

// 新增：從 "wtf" 表載入資料並轉置為結構化記錄 (每個記錄代表一個欄位)
function loadWtfData() {
  return callGoogleSheetAPI({ range: 'wtf!A:Z' })
    .then(response => {
      if (!response.values || !response.values.length) {
        console.error("loadWtfData: 沒有取得資料");
        return;
      }
      // 轉置：假設每個記錄存在同一欄
      const rows = response.values;
      const numCols = Math.max(...rows.map(r => r.length));
      structuredWtfRecords = [];
      for (let j = 0; j < numCols; j++) {
        const record = [];
        for (let i = 0; i < rows.length; i++) {
          record.push(rows[i][j] ? rows[i][j] : '');
        }
        structuredWtfRecords.push(record);
      }
      console.log("loadWtfData: 結構化資料", structuredWtfRecords);
    })
    .catch(error => console.error("loadWtfData: 錯誤", error));
}

// 修改搜尋函數，先確保已從 Google Sheets 取得並結構化資料，再在本地搜尋
function search() {
  const consultantInput = document.getElementById('consultantName');
  const searchTerm = consultantInput.value.replace(/\s/g, '').toLowerCase();
  if (!searchTerm) {
    document.getElementById('search_SAWHO_ResultsDiv').innerHTML = '';
    document.getElementById('search_SAWHO_ResultsSpan').innerHTML = '';
    return;
  }
  
  const proceedSearch = () => {
    let foundRecord = null;
    // 遍歷結構化資料，每個 record 為一欄資料陣列
    structuredWtfRecords.some(record => {
      return record.some(cell => {
        // 將 cell 中的空白也全數移除再比較
        if (cell && cell.replace(/\s/g, '').toLowerCase() === searchTerm) {
          foundRecord = {
            consultant: cell,
            team: record[2] || '',
            teamLeader: record[3] || ''
          };
          return true;
        }
        return false;
      });
    });
    // 清空舊結果
    document.getElementById('search_SAWHO_ResultsSpan').innerHTML = '';
    document.getElementById('search_SAWHO_ResultsDiv').innerHTML = '';
    if (foundRecord) {
      const p = document.createElement('p');
      const consultantSpan = document.createElement('span');
      consultantSpan.textContent = foundRecord.consultant;
      consultantSpan.className = 'green-gradient-text copyable-text';
      consultantSpan.style.cursor = 'pointer';
      consultantSpan.title = '點我一下複製名字';
      consultantSpan.addEventListener('click', () => {
        const tempInput = document.createElement('input');
        tempInput.value = foundRecord.consultant.length <= 2 ? foundRecord.consultant.slice(-1) : foundRecord.consultant.slice(-2);
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        consultantSpan.title = '已複製！';
        setTimeout(() => { consultantSpan.title = '點我一下複製名字'; }, 1000);
      });
      const leaderSpan = document.createElement('span');
      leaderSpan.textContent = foundRecord.teamLeader;
      leaderSpan.className = 'yellow-gradient-text copyable-text';
      leaderSpan.style.cursor = 'pointer';
      leaderSpan.title = '點我一下複製名字';
      leaderSpan.addEventListener('click', () => {
        const tempInput = document.createElement('input');
        tempInput.value = foundRecord.teamLeader.length <= 2 ? foundRecord.teamLeader.slice(-1) : foundRecord.teamLeader.slice(-2);
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        leaderSpan.title = '已複製！';
        setTimeout(() => { leaderSpan.title = '點我一下複製名字'; }, 1000);
      });
      p.appendChild(document.createTextNode('顧問'));
      p.appendChild(consultantSpan);
      p.appendChild(document.createTextNode(' 的組長是：'));
      p.appendChild(leaderSpan);
      p.appendChild(document.createTextNode(` (team: ${foundRecord.team})`));
      document.getElementById('search_SAWHO_ResultsSpan').appendChild(p);
    } else {
      const p = document.createElement('p');
      p.textContent = `【${searchTerm}】咦？這顧問找不到組長唷ఠ_ఠ`;
      document.getElementById('search_SAWHO_ResultsDiv').appendChild(p);
    }
  };

  if(structuredWtfRecords.length === 0) {
    loadWtfData().then(proceedSearch);
  } else {
    proceedSearch();
  }
}

// 在 DOMContentLoaded 時先載入結構化資料
document.addEventListener('DOMContentLoaded', function() {
  loadWtfData();
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

// 將需要前端 inline 呼叫的函數掛在全域
window.OPtitle_copyText = OPtitle_copyText;
window.search = search;