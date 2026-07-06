import { callGoogleSheetAPI } from './googleSheetAPI.js';

const ORG_SHEET_RANGE = 'wtf!A:ZZ';

// 組織矩陣資料與搜尋索引
let orgMatrixData = null;
let consultantSearchRecords = [];
let wtfDataPromise = null;
let previousOptitleOutput = '';

// ===== HTML 模板 =====
const optitlePanelHTML = `
<div class="optitlepanel">
    <form id="consultantForm" style="margin: 0;">
        <div class="op-title-output-div">
            <span class="optitle-text-form">[顧問</span>
            <label style="position: relative; display: inline-block; cursor: text;">
                <input type="text" id="consultantName" name="consultantName" class="optitle-input" style="width: 70px;">
                <span class="optitle-placeholder" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none;">顧問姓名</span>
            </label>
            <span class="optitle-text-form">]</span>
            <label style="position: relative; display: inline-block; cursor: text;">
                <input type="text" id="studentName" name="studentName" class="optitle-input" style="width: 70px;">
                <span class="optitle-placeholder" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none;">學生姓名</span>
            </label>
            <span class="optitle-text-form">/</span>
            <label style="position: relative; display: inline-block; cursor: text;">
                <input type="text" id="parentName" name="parentName" class="optitle-input" style="width: 70px;">
                <span class="optitle-placeholder" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none;">家長姓名</span>
            </label>
            <span class="optitle-text-form">#</span>
            <label style="position: relative; display: inline-block; cursor: text;">
                <input type="text" id="invoiceNumber" name="invoiceNumber" class="optitle-input" style="width: 70px;">
                <span class="optitle-placeholder" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none;">單號</span>
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
  orgMatrixData = null;
  consultantSearchRecords = [];
  wtfDataPromise = null;
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
  optitleOutput.textContent = '';
  optitleOutput.appendChild(document.createTextNode(outputText));
  optitleOutput.appendChild(createOptitleCopyButton());
  
  setTimeout(() => {
    optitleOutput.style.transform = "scale(1)";
    optitleOutput.style.opacity = "1";
  }, 100);
}

function createOptitleCopyButton() {
  const button = document.createElement('button');
  button.id = 'OPtitle_copyButton';
  button.type = 'button';
  button.style.border = 'none';
  button.style.padding = '3px';
  button.style.marginLeft = '3px';
  button.title = '複製到剪貼簿';
  button.addEventListener('click', OPtitle_copyText);

  const image = document.createElement('img');
  image.src = 'img/copy-icon.png';
  image.alt = '複製標題';
  image.style.width = '15px';
  image.style.height = '15px';

  button.appendChild(image);
  return button;
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
  copyText(textToCopy);
  
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

function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
  }
  fallbackCopyText(text);
  return Promise.resolve();
}

function fallbackCopyText(text) {
  const tempInput = document.createElement("input");
  tempInput.value = text;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand("copy");
  document.body.removeChild(tempInput);
}

function normalizeSearchText(value) {
  return String(value || '').replace(/\s/g, '').toLowerCase();
}

function cell(row, col) {
  return row && row[col] != null ? String(row[col]).trim() : '';
}

export function parseOrgMatrix(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const headerRow = safeRows[0] || [];
  const managerRow = safeRows[1] || [];
  const memberRows = safeRows.slice(2);
  const period = cell(headerRow, 0);

  const deptSlots = [];
  for (let col = 1; col < headerRow.length; col += 2) {
    const department = cell(headerRow, col);
    if (department) {
      deptSlots.push({ department, nameCol: col, titleCol: col + 1 });
    }
  }

  const departments = deptSlots.map(({ department, nameCol, titleCol }) => {
    const manager = {
      name: cell(managerRow, nameCol),
      title: cell(managerRow, titleCol),
      role: cell(managerRow, 0) || '主管'
    };

    const members = [];
    for (const row of memberRows) {
      const name = cell(row, nameCol);
      if (!name) continue;
      members.push({
        name,
        title: cell(row, titleCol),
        role: cell(row, 0)
      });
    }

    return {
      department,
      manager,
      members,
      headcount: 1 + members.length
    };
  });

  return {
    period,
    generated_at: new Date().toISOString(),
    departments,
    summary: {
      total_departments: departments.length,
      total_headcount: departments.reduce((sum, department) => sum + department.headcount, 0)
    }
  };
}

function buildConsultantSearchRecords(orgData) {
  if (!orgData?.departments) return [];

  return orgData.departments.flatMap((department) => {
    const people = [];
    if (department.manager?.name) {
      people.push({
        consultant: department.manager.name,
        title: department.manager.title,
        role: department.manager.role,
        team: department.department,
        teamLeader: department.manager.name
      });
    }

    department.members.forEach((member) => {
      people.push({
        consultant: member.name,
        title: member.title,
        role: member.role,
        team: department.department,
        teamLeader: department.manager?.name || ''
      });
    });

    return people.map((person) => ({
      ...person,
      normalizedName: normalizeSearchText(person.consultant)
    }));
  });
}

function findConsultantRecord(searchTerm) {
  return consultantSearchRecords.find(record => record.normalizedName === searchTerm) || null;
}

// ===== 載入 Google Sheet 資料 =====
function loadWtfData() {
  if (wtfDataPromise) return wtfDataPromise;

  wtfDataPromise = callGoogleSheetAPI({ range: ORG_SHEET_RANGE })
    .then(response => {
      if (!response.values || !response.values.length) {
        console.error("loadWtfData: 沒有取得資料");
        orgMatrixData = null;
        consultantSearchRecords = [];
        return null;
      }
      orgMatrixData = parseOrgMatrix(response.values);
      consultantSearchRecords = buildConsultantSearchRecords(orgMatrixData);
      console.log("loadWtfData: 組織矩陣資料", orgMatrixData);
      return orgMatrixData;
    })
    .catch(error => {
      console.error("loadWtfData: 錯誤", error);
      return null;
    })
    .finally(() => {
      wtfDataPromise = null;
    });

  return wtfDataPromise;
}

// ===== 搜尋功能 =====
function search() {
  const consultantInput = document.getElementById('consultantName');
  if (!consultantInput) return;
  
  const searchTerm = normalizeSearchText(consultantInput.value);
  if (!searchTerm) {
    const resultsDiv = document.getElementById('search_SAWHO_ResultsDiv');
    const resultsSpan = document.getElementById('search_SAWHO_ResultsSpan');
    if (resultsDiv) resultsDiv.innerHTML = '';
    if (resultsSpan) resultsSpan.innerHTML = '';
    return;
  }

  const proceedSearch = () => {
    const foundRecord = findConsultantRecord(searchTerm);
    
    const resultsSpan = document.getElementById('search_SAWHO_ResultsSpan');
    const resultsDiv = document.getElementById('search_SAWHO_ResultsDiv');
    if (resultsSpan) resultsSpan.innerHTML = '';
    if (resultsDiv) resultsDiv.innerHTML = '';
    
    if (foundRecord) {
      const p = document.createElement('p');
      
      const consultantSpan = document.createElement('span');
      consultantSpan.textContent = foundRecord.consultant;
      consultantSpan.className = 'gl-chip--success copyable-text';
      consultantSpan.style.cursor = 'pointer';
      consultantSpan.title = '點我一下複製名字';
      consultantSpan.addEventListener('click', () => {
        copyText(foundRecord.consultant.length <= 2 ? foundRecord.consultant.slice(-1) : foundRecord.consultant.slice(-2));
        consultantSpan.title = '已複製！';
        setTimeout(() => { consultantSpan.title = '點我一下複製名字'; }, 1000);
      });
      
      const leaderSpan = document.createElement('span');
      leaderSpan.textContent = foundRecord.teamLeader;
      leaderSpan.className = 'gl-chip--warning copyable-text';
      leaderSpan.style.cursor = 'pointer';
      leaderSpan.title = '點我一下複製名字';
      leaderSpan.addEventListener('click', () => {
        copyText(foundRecord.teamLeader.length <= 2 ? foundRecord.teamLeader.slice(-1) : foundRecord.teamLeader.slice(-2));
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

  if (searchTerm.length <= 2) {
    if (!consultantSearchRecords.length && !orgMatrixData) {
      loadWtfData().then(proceedSearch);
    } else {
      proceedSearch();
    }
    return;
  }

  // 輸入長度 >= 3，若快取查無資料才 fetch
  if (findConsultantRecord(searchTerm)) {
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
  if (el) el.innerHTML = previousOptitleOutput;
}

// ===== 掛載全域函數 (保留 legacy inline 呼叫相容性) =====
if (typeof window !== 'undefined') {
  window.OPtitle_copyText = OPtitle_copyText;
  window.search = search;
  window.clearFields = clearFields;
  window.initOptitlePanel = initOptitlePanel;
}
