import { callGoogleSheetAPI, callGoogleSheetBatchAPI } from "./googleSheetAPI.js";

// 定義各個範圍（前端只負責傳入讀取範圍）
const fudausearch_SHEET_RANGE = "OMGLIST!A:F";
const countryMappingRange = 'ip-dixt!A:C';

// 先記錄全域 Promise（供其他功能使用）
const sheetDataPromise = getSheetData();
const countryMappingPromise = getCountryMapping();

/**
 * 讀取 Google Sheet 中服務商資料
 */
export async function getSheetData() {
  try {
    console.log("[getSheetData] 呼叫 callGoogleSheetAPI，參數：", {
      range: fudausearch_SHEET_RANGE,
      method: "GET"
    });
    // 前端只傳入 range 與 method，sheetId 與 API key 由後端統一設定
    const data = await callGoogleSheetAPI({
      range: fudausearch_SHEET_RANGE,
      method: "GET"
    });
    console.log("[getSheetData] 回傳資料：", data);
    const sheetData = [];
    if (data.values) {
      data.values.forEach(row => {
        const cidrRange = row[0] ? row[0].trim() : '';
        const isp1 = row[1] ? row[1].trim() : '';
        const isp2 = row[3] ? row[3].trim() : '';
        if (cidrRange && (isp1 || isp2)) {
          sheetData.push({ cidrRange, isp1, isp2 });
        }
      });
    } else {
      console.error("[getSheetData] 沒有找到資料");
    }
    console.log("[getSheetData] 最終資料：", sheetData);
    return sheetData;
  } catch (error) {
    console.error("[getSheetData] 發生錯誤：", error);
    return [];
  }
}

/**
 * 讀取國家對照資料 (英文代碼 -> 中文名稱)
 */
export async function getCountryMapping() {
  try {
    console.log("[getCountryMapping] 呼叫 callGoogleSheetAPI，參數：", {
      range: countryMappingRange,
      method: "GET"
    });
    const data = await callGoogleSheetAPI({
      range: countryMappingRange,
      method: "GET"
    });
    console.log("[getCountryMapping] 回傳資料：", data);
    const mapping = {};
    if (data.values) {
      data.values.forEach(row => {
        const eng = row[0] ? row[0].trim() : '';
        const chi = row[2] ? row[2].trim() : '';
        if (eng && chi) {
          mapping[eng] = chi;
        }
      });
    } else {
      console.error("[getCountryMapping] 沒有找到國家對照資料");
    }
    console.log("[getCountryMapping] 最終 mapping：", mapping);
    return mapping;
  } catch (error) {
    console.error("[getCountryMapping] 發生錯誤：", error);
    return {};
  }
}

/**
 * 其他功能：例如用於「fudausearch」的資料讀取
 * 這裡將原本直接使用 fetch 的方式改用 callGoogleSheetAPI
 */
async function getFudaSearchData() {
  try {
    // 前端僅傳入範圍與方法
    const data = await callGoogleSheetAPI({
      range: fudausearch_SHEET_RANGE,
      method: "GET"
    });
    console.log("[getFudaSearchData] 回傳資料：", data);
    return data;
  } catch (error) {
    console.error("[getFudaSearchData] 發生錯誤：", error);
    return null;
  }
}

// 緩存全局資料變量（用於搜尋功能）
let fudausearch_cachedData = [];

/**
 * 載入 fudausearch 資料：使用後端代理取得資料，不再前端直接用 API key 與 sheetId
 */
async function fudausearch_loadData() {
  try {
    // 使用 callGoogleSheetAPI 取得資料
    const data = await callGoogleSheetAPI({
      range: fudausearch_SHEET_RANGE,
      method: "GET"
    });
    fudausearch_cachedData = data.values || []; // 將資料存入緩存
  } catch (error) {
    console.error("無法載入 Google Sheets 資料:", error);
    fudausearch_cachedData = [];
  }
}

// 其餘搜尋、排序、渲染等函式維持不變...
// 排序函數
function fudausearch_sortButtons(results) {
  const typeOrder = ["學務部", "排課組", "客服工程師", "輔導本人", "職代一", "職代二", "公帳號", "B-2", "數字組"];
  return results.sort((a, b) => {
    const indexA = typeOrder.indexOf(a.type);
    const indexB = typeOrder.indexOf(b.type);
    return indexA - indexB;
  });
}

// 搜尋函數
async function fudausearch_search() {
  const inputField = document.getElementById("fudausearch-input");
  const input = inputField.value.trim().replace(/\s+/g, "");
  const resultsContainer = document.getElementById("fudausearch-results");

  resultsContainer.innerHTML = "";

  if (!input) return;

  let fudausearch_results = [
    { text: "無資料", fullName: "無資料", type: "職代一" },
    { text: "無資料", fullName: "無資料", type: "職代二" },
    { text: "無資料", fullName: "無資料", type: "公帳號" },
    { text: "無資料", fullName: "無資料", type: "B-2" },
    { text: "客", fullName: "公帳號_客服用", type: "客服工程師" },
    { text: "排", fullName: "課組", type: "排課組" },
    { text: "無資料", fullName: "無資料", type: "數字組" }
  ];

  // 這裡使用 fudausearch_cachedData 做匹配（邏輯不變）
  if (fudausearch_cachedData[1] && fudausearch_cachedData[1][1]) {
    const fullName = fudausearch_cachedData[1][1].trim();
    fudausearch_results[3].text = fullName;
    fudausearch_results[3].fullName = fullName.slice(1);
  }

  let hasMatch = false;
  fudausearch_cachedData.forEach((row, rowIndex) => {
    const group = fudausearch_getGroup(row[0], fudausearch_cachedData, rowIndex);
    if (row[1] === input) {
      hasMatch = true;
      if (row[3]) {
        fudausearch_results[0].text = row[3];
        fudausearch_results[0].fullName = row[3].slice(1);
      }
      if (row[5]) {
        fudausearch_results[1].text = row[5];
        fudausearch_results[1].fullName = row[5].slice(1);
      }
      if (group === "學務部") {
        fudausearch_results[2].text = group;
        fudausearch_results[2].fullName = "學務";
      } else if (group && ["學務一組", "學務二組", "學務三組", "學務五組", "學務六組"].includes(group)) {
        fudausearch_results[2].text = `輔導${group.replace("學務", "")}`;
        fudausearch_results[2].fullName = `輔導${group.replace("學務", "")}`;
      }
      if (group && ["學務一組", "學務二組", "學務三組", "學務五組", "學務六組"].includes(group)) {
        const number = group.replace(/學務|組/g, "");
        fudausearch_results[6].text = number;
        fudausearch_results[6].fullName = `第${number}組`;
      }
    }
  });

  if (hasMatch) {
    fudausearch_results.unshift({ text: "學", fullName: "學務", type: "學務部" });
    fudausearch_results.unshift({ text: input, fullName: input.slice(1), type: "輔導本人" });
  } else {
    fudausearch_results = [];
  }

  fudausearch_results = fudausearch_sortButtons(fudausearch_results);
  fudausearch_renderButtons(fudausearch_results);
}

// 更新建議選單、渲染按鈕、複製、組別檢索等函式保持不變……
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

function fudausearch_renderButtons(fudausearch_results) {
  const resultsContainer = document.getElementById("fudausearch-results");
  resultsContainer.innerHTML = "";
  fudausearch_results.forEach((result) => {
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

function fudausearch_clearInput() {
  const inputField = document.getElementById("fudausearch-input");
  const suggestionsContainer = document.getElementById("fudausearch-suggestions");
  inputField.value = "";
  suggestionsContainer.style.display = "none";
  fudausearch_search();
}

function fudausearch_copyToClipboard(content, button) {
  button.classList.add("copied");
  navigator.clipboard.writeText(content).then(() => {
    setTimeout(() => button.classList.remove("copied"), 1000);
  });
}

function fudausearch_getGroup(columnA, rows, currentRow) {
  if (columnA) return columnA;
  for (let i = currentRow - 1; i >= 0; i--) {
    if (rows[i][0]) return rows[i][0];
  }
  return "未知組別";
}

// 初始化時加載資料
document.addEventListener("DOMContentLoaded", fudausearch_loadData);
document.getElementById("fudausearch-input").addEventListener("input", fudausearch_updateSuggestions);

//-----------------------------------------
// 以下部分為獲取最近更新日期並設置 placeholder
async function IP_fetchNewUpdateDate() {
  try {
    console.log("[IP_fetchNewUpdateDate] Fetching update date via callGoogleSheetAPI...");
    const data = await callGoogleSheetAPI({
      range: 'update!A1:A1',
      method: "GET"
    });
    console.log("[IP_fetchNewUpdateDate] Data received:", data);
    if (!data.values || !data.values.length) {
      throw new Error('No data found in the specified range.');
    }
    const dateUpdated = data.values[0][0];
    document.getElementById('ip_input').placeholder = '資料於 ' + dateUpdated + ' 更新';
  } catch (error) {
    console.error("[IP_fetchNewUpdateDate] Error:", error);
    document.getElementById('ip_input').placeholder = '資料更新失敗';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  IP_fetchNewUpdateDate();
  // 假如有需要，也可調整介面高度
});
