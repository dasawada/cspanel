// Google Sheets 設定
  const fudausearch_SHEET_ID = "1mM2WDKN6LlvNQvMIKrGcgZ8X1s4LYUzDdyVs7ThMBfA";
  const fudausearch_API_KEY = "AIzaSyCozo2rhMeVsjLB2e3nlI9ln_sZ4fIdCSw";
  const fudausearch_SHEET_RANGE = "輔導代理人名單!A:F";

  // 搜尋函數
  async function fudausearch_search() {
    const inputField = document.getElementById("fudausearch-input");
    const input = inputField.value.trim().replace(/\s+/g, ""); // 移除空白鍵並清除多餘空格
    const resultsContainer = document.getElementById("fudausearch-results");
    resultsContainer.innerHTML = "";

    // 如果 input 為空，直接退出搜尋
    if (!input) return;

    // 初始化結果
    let fudausearch_results = [
      { text: "無資料", fullName: "無資料", type: "職代一" },
      { text: "無資料", fullName: "無資料", type: "職代二" },
      { text: "無資料", fullName: "無資料", type: "公帳號" },
      { text: "無資料", fullName: "無資料", type: "B-2" }, // B-2 的初始結果
      { text: "客服", fullName: "公帳號_客服用", type: "客服工程師" },
      { text: "排課組", fullName: "課組", type: "排課組" }
    ];

    // 取得 Google Sheets 資料
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${fudausearch_SHEET_ID}/values/${fudausearch_SHEET_RANGE}?key=${fudausearch_API_KEY}`
    );
    const data = await response.json();
    const rows = data.values;

    // 確保 B-2 的值從 Column B-row2 提取
    if (rows[1] && rows[1][1]) {
      const fullName = rows[1][1].trim(); // 確保去掉首尾空白
      fudausearch_results[3].text = fullName; // 更新按鈕顯示為全名
      fudausearch_results[3].fullName = fullName.slice(1); // 複製時只複製名字
    }

    // 搜尋並更新其他結果
    let hasMatch = false;
    rows.forEach((row, rowIndex) => {
      const group = fudausearch_getGroup(row[0], rows, rowIndex); // 檢索組別
      if (row[1] === input) {
        hasMatch = true; // 表示有匹配結果
        // 更新職代一
        if (row[3]) {
          fudausearch_results[0].text = row[3];
          fudausearch_results[0].fullName = row[3].slice(1); // 只取名字
        }
        // 更新職代二
        if (row[5]) {
          fudausearch_results[1].text = row[5];
          fudausearch_results[1].fullName = row[5].slice(1); // 只取名字
        }
        // 更新公帳號
        if (group === "學務部") {
          fudausearch_results[2].text = group;
          fudausearch_results[2].fullName = "學務";
        } else if (group && ["學務一組", "學務二組", "學務三組", "學務五組", "學務六組"].includes(group)) {
          fudausearch_results[2].text = `輔導${group.replace("學務", "")}`;
          fudausearch_results[2].fullName = `輔導${group.replace("學務", "")}`;
        }
      }
    });

    // 如果有匹配結果，新增學務部按鈕並置於第一個
    if (hasMatch) {
      fudausearch_results.unshift({ text: "學", fullName: "學務", type: "學務部" });
    } else {
      fudausearch_results = []; // 無匹配時清空結果
    }

    // 渲染按鈕
    fudausearch_renderButtons(fudausearch_results);
  }

  // 按鈕生成函數
  function fudausearch_renderButtons(fudausearch_results) {
    const resultsContainer = document.getElementById("fudausearch-results");
    fudausearch_results.forEach((result) => {
      const button = document.createElement("button");

      // 檢查是否為學務部按鈕，應用特殊樣式
      if (result.type === "學務部") {
        button.className = "fudausearch-button fudausearch-button-special";
      } else {
        button.className = "fudausearch-button";
      }

      button.textContent = result.text; // 按鈕只顯示結果
      button.dataset.type = result.type; // 保存類型
      button.onclick = () => fudausearch_copyToClipboard(result.fullName || result.text, button);
      resultsContainer.appendChild(button);
    });
  }

  // 複製功能
  function fudausearch_copyToClipboard(content, button) {
    const originalText = button.textContent; // 保存原始按鈕文字
    button.classList.add("copied");
    button.textContent = "已複製";
    navigator.clipboard.writeText(content).then(() => {
      setTimeout(() => {
        button.classList.remove("copied");
        button.textContent = originalText; // 恢復原始文字
      }, 1000);
    });
  }

  // 組別檢索函數
  function fudausearch_getGroup(columnA, rows, currentRow) {
    if (columnA) return columnA; // 如果同行有值，直接返回
    for (let i = currentRow - 1; i >= 0; i--) {
      if (rows[i][0]) return rows[i][0]; // 向上找到最近的非空值
    }
    return "未知組別"; // 如果完全沒有值，返回默認值
  }

  // 綁定輸入框事件
  document
    .getElementById("fudausearch-input")
    .addEventListener("input", fudausearch_search);
