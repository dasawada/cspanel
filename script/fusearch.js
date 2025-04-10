import { callGoogleSheetAPI, callGoogleSheetBatchAPI } from "./googleSheetAPI.js";

// 不再定義 fudausearch_SHEET_ID 與 API Key，只保留讀取範圍設定
const fudausearch_SHEET_RANGE = "OMGLIST!A:F";

// 緩存全局資料變量
let fudausearch_cachedData = [];

/**
 * 頁面載入時下載資料
 * 透過後端代理，後端會自動使用環境變數取得統一的 Spreadsheet ID 與 API Key
 */
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

// 排序函數
function fudausearch_sortButtons(results) {
  const typeOrder = ["學務部", "排課組", "客服工程師", "輔導本人", "公帳號", "數字組"];
  return results.sort((a, b) => {
    const indexA = typeOrder.indexOf(a.type);
    const indexB = typeOrder.indexOf(b.type);
    return indexA - indexB;
  });
}

// 搜尋函數
async function fudausearch_search() {
  const inputField = document.getElementById("fudausearch-input");
  const input = inputField.value.trim().replace(/\s+/g, ""); // 移除空白鍵並清除多餘空格
  const resultsContainer = document.getElementById("fudausearch-results");

  // 清空按鈕容器內容，避免重複按鈕
  resultsContainer.innerHTML = "";

  // 如果 input 為空，直接退出搜尋
  if (!input) return;

// 初始化結果
let fudausearch_results = [
  { text: "無資料", fullName: "無資料", type: "公帳號" },
  { text: "客", fullName: "公帳號_客服用", type: "客服工程師" },
  { text: "排", fullName: "課組", type: "排課組" },
  { text: "無資料", fullName: "無資料", type: "數字組" }
];

// 確保 B-2 的值從 Column B-row2 提取
if (fudausearch_cachedData[1] && fudausearch_cachedData[1][1]) {
  const fullName = fudausearch_cachedData[1][1].trim();
  fudausearch_results[3].text = fullName;
  fudausearch_results[3].fullName = fullName.slice(1);
}

// 使用緩存資料進行匹配
let hasMatch = false;
fudausearch_cachedData.forEach((row, rowIndex) => {
  const group = fudausearch_getGroup(row[0], fudausearch_cachedData, rowIndex); // 檢索組別
  if (row[1] === input) {
    hasMatch = true;

    // 更新公帳號
    if (group === "學務部") {
      fudausearch_results[0].text = group;
      fudausearch_results[0].fullName = "學務";
    } else if (group && ["學務一組", "學務二組", "學務三組", "學務五組", "學務六組"].includes(group)) {
      fudausearch_results[0].text = `輔導${group.replace("學務", "")}`;
      fudausearch_results[0].fullName = `輔導${group.replace("學務", "")}`;
    }

// 更新群組
if (group && ["學務一組", "學務二組", "學務三組", "學務五組", "學務六組"].includes(group)) {
  if (group === "學務二組") {
    fudausearch_results[3].text = "輔導二組2C";         // 按鈕顯示為【輔導二組2C】
    fudausearch_results[3].fullName = "輔導二組2C";     // 點擊複製的內容
  } else {
    const number = group.replace(/學務|組/g, "");       // 例如「三」
    fudausearch_results[3].text = number;               // 按鈕顯示為數字，例如「三」
    fudausearch_results[3].fullName = `第${number}組`;  // 點擊複製的內容，例如「第三組」
  }
}

  }
});

  if (hasMatch) {
    fudausearch_results.unshift({ text: "學", fullName: "學務", type: "學務部" });
    fudausearch_results.unshift({ text: input, fullName: input.slice(1), type: "輔導本人" });
  } else {
    fudausearch_results = []; // 無匹配時清空結果
  }

  // 排序按鈕
  fudausearch_results = fudausearch_sortButtons(fudausearch_results);

  // 渲染按鈕
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

// 渲染按鈕
function fudausearch_renderButtons(fudausearch_results) {
  const resultsContainer = document.getElementById("fudausearch-results");
  resultsContainer.innerHTML = ""; // 確保每次渲染時清空容器

  fudausearch_results.forEach((result) => {
    const button = document.createElement("button");
    
    // 預設樣式
    button.className = "fudausearch-button";

    // 根據類型應用特殊樣式
    if (result.type === "學務部") {
      button.classList.add("fudausearch-button-special");
    } else if (result.type === "排課組") {
      button.classList.add("fudausearch-button-paikezu");
    } else if (result.type === "客服工程師") {
      button.classList.add("fudausearch-button-kefugon");
    } else if (result.type === "數字組") {
      button.classList.add("fudausearch-button-groupnumber");
    }

    button.textContent = result.text; // 按鈕只顯示結果
    button.dataset.type = result.type; // 保存類型
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
