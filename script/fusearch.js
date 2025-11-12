import { callGoogleSheetAPI, callGoogleSheetBatchAPI } from "./googleSheetAPI.js";
const fudausearch_SHEET_RANGE = "OMGLIST!A:I";

let fudausearch_cachedData = [];

async function fudausearch_loadData() {
  try {
    // 調用共用 API 代理，只傳入讀取範圍與方法
    const data = await callGoogleSheetAPI({
      range: fudausearch_SHEET_RANGE,
      method: "GET"
    });
    fudausearch_cachedData = data.values || []; // 將數據存入緩存
    console.log("[fudausearch_loadData] 載入資料成功：", fudausearch_cachedData);
  } catch (error) {
    console.error("無法載入 Google Sheets 資料:", error);
    fudausearch_cachedData = []; // 錯誤時給空值
  }
}

// 排序函數：在最後加入「組長」
function fudausearch_sortButtons(results) {
  const typeOrder = [
    "學務部", "排課組", "客服工程師",
    "組長", "輔導本人", "顧問本人", "職代一", "職代二",
    "公帳號", "數字組",
  ];
  return results.sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));
}

// 模式處理函數
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
  fudausearch_results.unshift({ text: "學", fullName: "學務", type: "學務部" });
  fudausearch_results.unshift({ text: input, fullName: input.slice(1), type: "輔導本人" });

  // 過濾掉空的職代二按鈕
  fudausearch_results = fudausearch_results.filter(result =>
    !(result.type === "職代二" && (result.text === "無資料" || !result.text))
  );
  return fudausearch_results;
}

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
    // 組長就是本人，顯示組長身份（但已在顧問本人顯示，不重複）
    fudausearch_results.push({
      text: `組長：${row[8]}`,
      fullName: row[8].slice(1),
      type: "組長"
    });
  }

  return fudausearch_results;
}

// 模式映射
const fudausearch_modes = {
  xuewu: handleXuewuMode,
  independent: handleIndependentMode
};

// 搜尋函數
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
      fudausearch_results = fudausearch_modes[mode](row, group, input);
    }
  });

  if (!hasMatch) fudausearch_results = [];

  // 過濾掉 text 為「無資料」或空字串的按鈕
  fudausearch_results = fudausearch_results.filter(r => r.text && r.text !== "無資料");

  // 依 fullName 去重，若有組長則優先保留組長
  const uniqueMap = new Map();
  fudausearch_results.forEach(r => {
    if (!uniqueMap.has(r.fullName)) {
      uniqueMap.set(r.fullName, r);
    } else {
      // 若已存在，且目前是組長則覆蓋
      if (r.type === "組長") {
        uniqueMap.set(r.fullName, r);
      }
    }
  });
  fudausearch_results = Array.from(uniqueMap.values());

  fudausearch_results = fudausearch_sortButtons(fudausearch_results);
  fudausearch_renderButtons(fudausearch_results);
}

// 更新建議選單，使用緩存資料
function fudausearch_updateSuggestions() {
  const inputField = document.getElementById("fudausearch-input");
  const suggestionsContainer = document.getElementById("fudausearch-suggestions");
  const inputValue = inputField.value.trim();

  suggestionsContainer.innerHTML = ""; // 清空選單

  if (!inputValue) {
    suggestionsContainer.style.display = "none"; // 隱藏選單
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

// 在文件開頭添加按鈕顯示配置
const fudausearch_buttonConfig = {
  "學務部": true,
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

// 渲染按鈕
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

    if (result.type === "學務部") {
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

// 清除輸入框
function fudausearch_clearInput() {
  const inputField = document.getElementById("fudausearch-input");
  const suggestionsContainer = document.getElementById("fudausearch-suggestions");
  inputField.value = "";
  suggestionsContainer.style.display = "none";
  fudausearch_search();
}

// 複製功能
function fudausearch_copyToClipboard(content, button) {
  button.classList.add("copied");
  navigator.clipboard.writeText(content).then(() => {
    setTimeout(() => button.classList.remove("copied"), 1000);
  });
}

// 組別檢索函數
function fudausearch_getGroup(columnA, rows, currentRow) {
  if (columnA) return columnA;
  for (let i = currentRow - 1; i >= 0; i--) {
    if (rows[i][0]) return rows[i][0];
  }
  return "未知組別";
}
document.addEventListener("DOMContentLoaded", () => {
    // 初始化時加載資料
    fudausearch_loadData();

    // 綁定輸入框 input 事件
    const inputField = document.getElementById("fudausearch-input");
    if (inputField) {
        inputField.addEventListener("input", fudausearch_updateSuggestions);
    }

    // 綁定清除按鈕點擊事件
    const clearButton = document.getElementById("fudausearch-clear-btn");
    if (clearButton) {
        clearButton.addEventListener("click", fudausearch_clearInput);
    }
});
