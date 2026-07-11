import { callGoogleSheetAPI, callGoogleSheetBatchAPI } from "./googleSheetAPI.js";

// ===== 常數定義 =====
const fudausearch_SHEET_RANGE = "OMGLIST!A:I";

// ===== 模組內部變數 =====
let fudausearch_cachedData = [];

// ===== HTML 模板 =====
const fudausearchPanelHTML = `
<div class="fudausearch-container" id="fudausearch-container">
  <button class="fudausearch-fixed-button" id="fudausearch-fixed-button" style="display: none;">學務部</button>
  <div class="fudausearch-input-wrapper gl-capsule">
    <input type="text" id="fudausearch-input" placeholder="輔導職代、顧問組長查詢" autocomplete="off" />
    <button class="fudausearch-clear-btn gl-capsule__end" id="fudausearch-clear-btn">x</button>
    <div id="fudausearch-suggestions" class="fudausearch-suggestions"></div>
  </div>
  <div id="fudausearch-results"></div>
</div>
`;

// ===== 按鈕顯示配置 =====
const fudausearch_buttonConfig = {
  "公帳號_成交轉單": true,
  "排課組": false,        // 設為 false 即隱藏
  "客服工程師": true,
  "組長": true,
  "輔導本人": true,
  "顧問本人": true,
  "職代一": true,
  "職代二": true,
  "公帳號": true,
  "數字組": false
};

// ===== 初始化函數 (供外部呼叫) =====
export function initFudausearchPanel(containerId = 'fudausearch-placeholder') {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`initFudausearchPanel: 找不到容器 #${containerId}`);
    return;
  }
  
  // 如果容器尚未包含必要元素，才注入 HTML（避免重複插入或覆寫現有 DOM）
  if (!container.querySelector('#fudausearch-input')) {
    container.innerHTML = fudausearchPanelHTML;
  }
  
  // 綁定事件
  bindFudausearchEvents();
  
  // 載入 Google Sheet 資料
  fudausearch_loadData();
  
  console.log('✅ FudausearchPanel 已初始化');
}

// ===== 清除面板函數 (登出時呼叫) =====
// 非破壞式：只重置面板「內容狀態」（結果、建議、輸入值與快取），不動容器
// 結構與拖曳把手。轉單頁（新增資料夾/轉單小工具.html）自帶靜態 markup
// （含 #fudausearch-drag-handle），且 Firebase onAuthStateChanged 載入時會
// 先回一次 null → 走到這裡。舊版 `innerHTML = ''` 會洗掉那份靜態 markup：
//   (1) makeDraggable 綁定的把手被清 → 拖不動；
//   (2) 再登入時 initFudausearchPanel 見容器空 → 注入自帶 .fudausearch-container
//       的模板 → 雙層嵌套。
// 改為只清內容，panel_all（占位符注入模型）與轉單頁（自帶 markup 模型）通吃。
export function clearFudausearchPanel(containerId = 'fudausearch-placeholder') {
  const container = document.getElementById(containerId);
  if (container) {
    const results = container.querySelector('#fudausearch-results');
    if (results) results.innerHTML = '';

    const suggestions = container.querySelector('#fudausearch-suggestions');
    if (suggestions) {
      suggestions.innerHTML = '';
      suggestions.style.display = 'none';
    }

    const inputField = container.querySelector('#fudausearch-input');
    if (inputField) inputField.value = '';
  }
  // 清空快取資料
  fudausearch_cachedData = [];
  console.log('🧹 FudausearchPanel 已清除（非破壞式）');
}

// ===== 綁定事件 =====
// 冪等綁定：非破壞式 clear 後容器與元素仍在，登出→再登入會再次呼叫本函式。
// 先以「具名 handler」removeEventListener 再 addEventListener，避免同一次輸入
// 觸發多次 suggestion（handler 已具名於模組層級，參照穩定，可安全移除）。
function bindFudausearchEvents() {
  const inputField = document.getElementById("fudausearch-input");
  if (inputField) {
    inputField.removeEventListener("input", fudausearch_updateSuggestions);
    inputField.addEventListener("input", fudausearch_updateSuggestions);
  }

  const clearButton = document.getElementById("fudausearch-clear-btn");
  if (clearButton) {
    clearButton.removeEventListener("click", fudausearch_clearInput);
    clearButton.addEventListener("click", fudausearch_clearInput);
  }
}

// ===== 載入資料 =====
async function fudausearch_loadData() {
  try {
    const data = await callGoogleSheetAPI({
      range: fudausearch_SHEET_RANGE,
      method: "GET"
    });
    fudausearch_cachedData = data.values || [];
    console.log("[fudausearch_loadData] 載入資料成功：", fudausearch_cachedData);
  } catch (error) {
    console.error("無法載入 Google Sheets 資料:", error);
    fudausearch_cachedData = [];
  }
}

// ===== 排序函數 =====
function fudausearch_sortButtons(results) {
  const typeOrder = [
    "公帳號_成交轉單", "排課組", "客服工程師",
    "組長", "輔導本人", "顧問本人", "職代一", "職代二",
    "公帳號", "數字組",
  ];
  return results.sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));
}

// ===== 模式處理函數：學務模式 =====
function handleXuewuMode(row, group, input) {
  let fudausearch_results = [
    { text: "無資料", fullName: "無資料", type: "職代一" },
    { text: "無資料", fullName: "無資料", type: "職代二" },
    { text: "無資料", fullName: "無資料", type: "公帳號" },
    { text: "客", fullName: "公帳號_客服用", type: "客服工程師" },
    { text: "排", fullName: "課組", type: "排課組" },
    { text: "無資料", fullName: "無資料", type: "數字組" }
  ];

  // 更新職代一
  if (row[3]) {
    fudausearch_results[0].text = row[3];
    fudausearch_results[0].fullName = row[3].slice(1);
  }
  // 更新職代二
  if (row[5]) {
    fudausearch_results[1].text = row[5];
    fudausearch_results[1].fullName = row[5].slice(1);
  }
  // 更新公帳號
  if (group === "學務部") {
    fudausearch_results[2].text = group;
    fudausearch_results[2].fullName = "學務";
  } else if (group && ["學務一組", "學務二組", "學務三組", "學務五組", "學務六組"].includes(group)) {
    const groupNum = group.replace(/學務|組/g, "");
    fudausearch_results[2].text = `公 輔${groupNum}`;
    fudausearch_results[2].fullName = `輔導${groupNum}組`;
  }
  // 更新群組
  if (group && ["學務一組", "學務二組", "學務三組", "學務五組", "學務六組"].includes(group)) {
    if (group === "學務二組") {
      fudausearch_results[5].text = "二2C";
      fudausearch_results[5].fullName = "輔導二組2C";
    } else {
      const number = group.replace(/學務|組/g, "");
      fudausearch_results[5].text = number;
      fudausearch_results[5].fullName = `第${number}組`;
    }
  }
  // 組長
  if (row[8]) {
    const nameNoSurname = row[8].slice(1);
    fudausearch_results.push({
      text: "組長",
      fullName: nameNoSurname,
      type: "組長"
    });
  }
  // 本人與學務部
  fudausearch_results.unshift({ text: "公", fullName: "成交轉單", type: "公帳號_成交轉單" });
  fudausearch_results.unshift({ text: input, fullName: input.slice(1), type: "輔導本人" });

  // 過濾掉空的職代二按鈕
  fudausearch_results = fudausearch_results.filter(result =>
    !(result.type === "職代二" && (result.text === "無資料" || !result.text))
  );
  return fudausearch_results;
}

// ===== 模式處理函數：獨立模式 =====
function handleIndependentMode(row, group, input) {
  let fudausearch_results = [];

  // 顧問本人
  fudausearch_results.push({
    text: row[1],
    fullName: row[1].slice(1),
    type: "顧問本人"
  });

  // 職代一
  if (row[3]) {
    fudausearch_results.push({
      text: row[3],
      fullName: row[3].slice(1),
      type: "職代一"
    });
  }

  // 職代二
  if (row[5]) {
    fudausearch_results.push({
      text: row[5],
      fullName: row[5].slice(1),
      type: "職代二"
    });
  }

  // 組長（若有且不是本人，避免重複）
  if (row[8] && row[1] !== row[8]) {
    fudausearch_results.push({
      text: `組長：${row[8]}`,
      fullName: row[8].slice(1),
      type: "組長"
    });
  } else if (row[8] && row[1] === row[8]) {
    fudausearch_results.push({
      text: `組長：${row[8]}`,
      fullName: row[8].slice(1),
      type: "組長"
    });
  }

  return fudausearch_results;
}

// ===== 模式映射 =====
const fudausearch_modes = {
  xuewu: handleXuewuMode,
  independent: handleIndependentMode
};

// ===== 搜尋函數 =====
async function fudausearch_search() {
  const inputField = document.getElementById("fudausearch-input");
  const input = inputField.value.trim().replace(/\s+/g, "");
  const resultsContainer = document.getElementById("fudausearch-results");
  resultsContainer.innerHTML = "";
  if (!input) return;

  let fudausearch_results = [];
  let hasMatch = false;

  fudausearch_cachedData.forEach((row, rowIndex) => {
    const group = fudausearch_getGroup(row[0], fudausearch_cachedData, rowIndex);
    if (row[1] === input) {
      hasMatch = true;
      const mode = group.startsWith("學務") ? "xuewu" : "independent";
      console.log(`[debug] ✅ 命中 rowIndex=${rowIndex} input="${input}" group="${group}" mode="${mode}" row=`, row);
      fudausearch_results = fudausearch_modes[mode](row, group, input);
    }
  });
  console.log(`[debug] 搜尋完畢 hasMatch=${hasMatch} results=`, fudausearch_results);

  if (!hasMatch) fudausearch_results = [];

  // 過濾掉 text 為「無資料」或空字串的按鈕
  fudausearch_results = fudausearch_results.filter(r => r.text && r.text !== "無資料");

  // 依 fullName 去重，若有組長則優先保留組長
  const uniqueMap = new Map();
  fudausearch_results.forEach(r => {
    if (!uniqueMap.has(r.fullName)) {
      uniqueMap.set(r.fullName, r);
    } else {
      if (r.type === "組長") {
        uniqueMap.set(r.fullName, r);
      }
    }
  });
  fudausearch_results = Array.from(uniqueMap.values());

  fudausearch_results = fudausearch_sortButtons(fudausearch_results);
  fudausearch_renderButtons(fudausearch_results);
}

// ===== 更新建議選單 =====
function fudausearch_updateSuggestions() {
  const inputField = document.getElementById("fudausearch-input");
  const suggestionsContainer = document.getElementById("fudausearch-suggestions");
  const inputValue = inputField.value.trim();

  suggestionsContainer.innerHTML = "";

  if (!inputValue) {
    suggestionsContainer.style.display = "none";
    return;
  }

  const suggestions = fudausearch_cachedData.filter((row) => row[1]?.includes(inputValue));

  suggestions.forEach((row) => {
    const suggestionItem = document.createElement("div");
    suggestionItem.className = "fudausearch-suggestion-item";
    suggestionItem.textContent = row[1];
    suggestionItem.onclick = () => {
      inputField.value = row[1];
      fudausearch_search();
      suggestionsContainer.style.display = "none";
    };
    suggestionsContainer.appendChild(suggestionItem);
  });

  suggestionsContainer.style.display = suggestions.length > 0 ? "block" : "none";
}

// ===== 渲染按鈕 =====
function fudausearch_renderButtons(fudausearch_results) {
  const resultsContainer = document.getElementById("fudausearch-results");
  resultsContainer.innerHTML = "";

  // 過濾掉配置中設為 false 的按鈕
  const filteredResults = fudausearch_results.filter(result => 
    fudausearch_buttonConfig[result.type] !== false
  );

  filteredResults.forEach((result) => {
    const button = document.createElement("button");
    button.className = "fudausearch-button";

    if (result.type === "公帳號_成交轉單") {
      button.classList.add("fudausearch-button-special");
    } else if (result.type === "排課組") {
      button.classList.add("fudausearch-button-paikezu");
    } else if (result.type === "客服工程師") {
      button.classList.add("fudausearch-button-kefugon");
    } else if (result.type === "數字組") {
      button.classList.add("fudausearch-button-groupnumber");
    }

    button.textContent = result.text;
    button.dataset.type = result.type;
    button.onclick = () => fudausearch_copyToClipboard(result.fullName || result.text, button);

    resultsContainer.appendChild(button);
  });
}

// ===== 清除輸入框 =====
function fudausearch_clearInput() {
  const inputField = document.getElementById("fudausearch-input");
  const suggestionsContainer = document.getElementById("fudausearch-suggestions");
  inputField.value = "";
  suggestionsContainer.style.display = "none";
  fudausearch_search();
}

// ===== 複製功能 =====
function fudausearch_copyToClipboard(content, button) {
  button.classList.add("copied");
  navigator.clipboard.writeText(content).then(() => {
    setTimeout(() => button.classList.remove("copied"), 1000);
  });
}

// ===== 組別檢索函數 =====
// 向上尋找最近的「非純數字」群組名稱（跳過小組序號如 "2"、"3"）
function fudausearch_getGroup(columnA, rows, currentRow) {
  const isGroupName = (val) => val && !/^\d+$/.test(val.trim());

  if (isGroupName(columnA)) return columnA.trim();

  for (let i = currentRow - 1; i >= 0; i--) {
    const val = rows[i][0];
    if (isGroupName(val)) return val.trim();
  }
  return "未知組別";
}