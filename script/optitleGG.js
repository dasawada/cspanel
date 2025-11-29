import { callGoogleSheetAPI } from './googleSheetAPI.js';

// 新增全域變數，用來存放結構化的 "wtf" 表資料
let structuredWtfRecords = [];
let previousOptitleOutput = '';

// ===== HTML 模板 =====
const optitlePanelHTML = `
<div class="optitlepanel">
    <form id="consultantForm" style="margin: 0;">
        <div class="op-title-output-div">
            <span class="optitle-text-form">[顧問</span>
            <label style="position: relative; display: inline-block; cursor: text;">
                <input type="text" id="consultantName" name="consultantName" class="optitle-input" style="width: 70px;">
                <span class="optitle-placeholder" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); color: #999; pointer-events: none;">顧問姓名</span>
            </label>
            <span class="optitle-text-form">]</span>
            <label style="position: relative; display: inline-block; cursor: text;">
                <input type="text" id="studentName" name="studentName" class="optitle-input" style="width: 70px;">
                <span class="optitle-placeholder" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); color: #999; pointer-events: none;">學生姓名</span>
            </label>
            <span class="optitle-text-form">/</span>
            <label style="position: relative; display: inline-block; cursor: text;">
                <input type="text" id="parentName" name="parentName" class="optitle-input" style="width: 70px;">
                <span class="optitle-placeholder" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); color: #999; pointer-events: none;">家長姓名</span>
            </label>
            <span class="optitle-text-form">#</span>
            <label style="position: relative; display: inline-block; cursor: text;">
                <input type="text" id="invoiceNumber" name="invoiceNumber" class="optitle-input" style="width: 70px;">
                <span class="optitle-placeholder" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); color: #999; pointer-events: none;">單號</span>
            </label>
        </div>
    </form>
    <div class="spacer"></div>
    <span id="optitleoutput">生成的標題會顯示在這裡٩(๑❛ᴗ❛๑)۶</span>
    <span id="search_SAWHO_ResultsSpan"></span>
    <div id="search_SAWHO_ResultsDiv"></div>
    <div id="clearButton" class="clearIcon" title="清除標題">
        <i class="fas fa-trash"></i>
    </div>
</div>
`;

// ===== 初始化函數 =====
export function initOptitlePanel(containerId = 'optitle-placeholder') {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`initOptitlePanel: 找不到容器 #${containerId}`);
    return;
  }
  
  // 注入 HTML
  container.innerHTML = optitlePanelHTML;
  
  // 綁定事件
  bindInputEvents();
  bindClearButton();
  
  // 載入 Google Sheet 資料
  loadWtfData();
  
  console.log('✅ OptitlePanel 已初始化');
}

// ===== 清除面板函數 (登出時呼叫) =====
export function clearOptitlePanel(containerId = 'optitle-placeholder') {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
  }
  // 清空快取資料
  structuredWtfRecords = [];
  previousOptitleOutput = '';
  console.log('🧹 OptitlePanel 已清除');
}

// ===== 綁定輸入框事件 =====
function bindInputEvents() {
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
      checkInputs();
    });
  });
}

// ===== 綁定清除按鈕 =====
function bindClearButton() {
  const clearBtn = document.getElementById('clearButton');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearFields);
  }
}

// ===== 檢查輸入 =====
function checkInputs() {
  const consultantName = document.getElementById("consultantName")?.value.trim() || '';
  const studentName = document.getElementById("studentName")?.value.trim() || '';
  const parentName = document.getElementById("parentName")?.value.trim() || '';
  const invoiceNumber = document.getElementById("invoiceNumber")?.value.trim() || '';

  if (consultantName === '' && studentName === '' && parentName === '' && invoiceNumber === '') {
    clearOutput();
  } else {
    generateText();
    search();
  }
}

// ===== 生成標題文字 =====
function generateText() {
  const consultantName = document.getElementById("consultantName")?.value.replace(/\s/g, '') || '';
  const studentName = document.getElementById("studentName")?.value.replace(/\s/g, '') || '';
  const parentName = document.getElementById("parentName")?.value.replace(/\s/g, '') || '';
  const invoiceNumber = document.getElementById("invoiceNumber")?.value.replace(/[#\s]/g, '') || '';
  
  let outputText = "[顧問 " + consultantName + "] " + studentName;
  if (studentName !== '' && parentName !== '') {
    outputText += " / " + parentName;
  } else {
    outputText += parentName;
  }
  if (invoiceNumber !== '') {
    outputText += " #" + invoiceNumber;
  }
  
  const optitleOutput = document.getElementById("optitleoutput");
  if (!optitleOutput) return;
  
  optitleOutput.style.transform = "scale(1.1)";
  optitleOutput.style.opacity = "0.5";
  optitleOutput.innerHTML = outputText + 
    '<button id="OPtitle_copyButton" type="button" style="border: none;padding: 3px;margin-left:3px;" title="複製到剪貼簿">' +
    '<img src="img/copy-icon.png" alt="複製標題" style="width: 15px; height: 15px;">' +
    '</button>';
  
  // 綁定複製按鈕事件
  const copyBtn = document.getElementById('OPtitle_copyButton');
  if (copyBtn) {
    copyBtn.addEventListener('click', OPtitle_copyText);
  }
  
  setTimeout(() => {
    optitleOutput.style.transform = "scale(1)";
    optitleOutput.style.opacity = "1";
  }, 100);
}

// ===== 清除輸出 =====
function clearOutput() {
  const optitleOutput = document.getElementById("optitleoutput");
  if (!optitleOutput) return;
  
  optitleOutput.style.transform = "scale(1.1)";
  optitleOutput.style.opacity = "0.5";
  setTimeout(() => {
    optitleOutput.innerText = "生成的標題會顯示在這裡٩(๑❛ᴗ❛๑)۶";
    optitleOutput.style.transform = "scale(1)";
    optitleOutput.style.opacity = "1";
  }, 1000);
}

// ===== 清除所有欄位 =====
function clearFields() {
  const fields = ["consultantName", "studentName", "parentName", "invoiceNumber"];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      el.dispatchEvent(new Event('blur'));
    }
  });
  
  clearOutput();
  search();
  
  const button = document.getElementById('clearButton');
  const icon = button?.querySelector('i');
  if (icon) {
    icon.classList.add('trash-animated');
    setTimeout(() => {
      icon.classList.remove('trash-animated');
    }, 1000);
  }
}

// ===== 複製標題 =====
function OPtitle_copyText(e) {
  if (e && e.preventDefault) e.preventDefault();
  const optitleOutput = document.getElementById("optitleoutput");
  if (!optitleOutput) return;
  
  const textToCopy = optitleOutput.innerText;
  const tempInput = document.createElement("input");
  tempInput.value = textToCopy;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand("copy");
  document.body.removeChild(tempInput);
  
  const copyButton = document.getElementById("OPtitle_copyButton");
  if (copyButton) {
    copyButton.classList.add("OPtitle_copied", "OPtitle_unclickable");
    const tempTitle = copyButton.title;
    copyButton.title = "";
    copyButton.title = tempTitle;
    setTimeout(function() {
      copyButton.classList.remove("OPtitle_copied", "OPtitle_unclickable");
    }, 3000);
  }
}

// ===== 載入 Google Sheet 資料 =====
function loadWtfData() {
  return callGoogleSheetAPI({ range: 'wtf!A:Z' })
    .then(response => {
      if (!response.values || !response.values.length) {
        console.error("loadWtfData: 沒有取得資料");
        return;
      }
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

// ===== 搜尋功能 =====
function search() {
  const consultantInput = document.getElementById('consultantName');
  if (!consultantInput) return;
  
  const searchTerm = consultantInput.value.replace(/\s/g, '').toLowerCase();
  if (!searchTerm) {
    const resultsDiv = document.getElementById('search_SAWHO_ResultsDiv');
    const resultsSpan = document.getElementById('search_SAWHO_ResultsSpan');
    if (resultsDiv) resultsDiv.innerHTML = '';
    if (resultsSpan) resultsSpan.innerHTML = '';
    return;
  }

  const proceedSearch = () => {
    let foundRecord = null;
    structuredWtfRecords.some(record => {
      return record.some(cell => {
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
    
    const resultsSpan = document.getElementById('search_SAWHO_ResultsSpan');
    const resultsDiv = document.getElementById('search_SAWHO_ResultsDiv');
    if (resultsSpan) resultsSpan.innerHTML = '';
    if (resultsDiv) resultsDiv.innerHTML = '';
    
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
      
      p.appendChild(document.createTextNode(' 顧問'));
      p.appendChild(consultantSpan);
      p.appendChild(document.createTextNode(' 的組長是：'));
      p.appendChild(leaderSpan);
      p.appendChild(document.createTextNode(` (team: ${foundRecord.team})`));
      if (resultsSpan) resultsSpan.appendChild(p);
    } else {
      const p = document.createElement('p');
      p.textContent = `【${searchTerm}】咦？這顧問找不到組長唷ఠ_ఠ`;
      if (resultsDiv) resultsDiv.appendChild(p);
    }
  };

  // 只要輸入長度 <= 2，永遠只用快取
  if (searchTerm.length <= 2) {
    proceedSearch();
    return;
  }

  // 輸入長度 >= 3，若快取查無資料才 fetch
  let foundInCache = false;
  structuredWtfRecords.some(record => {
    return record.some(cell => cell && cell.replace(/\s/g, '').toLowerCase() === searchTerm && (foundInCache = true));
  });
  if (foundInCache) {
    proceedSearch();
  } else {
    loadWtfData().then(() => {
      proceedSearch();
    });
  }
}

// ===== 輔助函數 =====
function updateOptitleOutput(content) {
  previousOptitleOutput = content;
  const el = document.getElementById('optitleoutput');
  if (el) el.innerHTML = content;
}

function clearOptitleOutput() {
  const el = document.getElementById('optitleoutput');
  if (el) el.innerHTML = previousOpttitleOutput;
}

// ===== 掛載全域函數 (供 inline 呼叫，若有需要) =====
window.OPtitle_copyText = OPtitle_copyText;
window.search = search;
window.clearFields = clearFields;
window.initOptitlePanel = initOptitlePanel;