// 定義 dayMapping 在頂部
const dayMapping = {
    '一': 1,
    '二': 2,
    '三': 3,
    '四': 4,
    '五': 5,
    '六': 6,
    '日': 7
};

// 動態監聽輸入框並顯示結果
document.getElementById('all-meeting-search-input').addEventListener('input', function() {
    const query = this.value.trim();
    
    if (query !== '') {
        // 呼叫函數從 Google Sheets 中搜尋會議
        fetchAllMeetings(query);
    } else {
        document.getElementById('all-meeting-result-container').innerHTML = '';
        document.getElementById('all-meeting-result-container').style.display = 'none'; // 隱藏結果區域
    }
});

// Fetch 會議資料
async function fetchAllMeetings(query) {
    const apiKey = 'AIzaSyCozo2rhMeVsjLB2e3nlI9ln_sZ4fIdCSw';  // 替換為你的 API Key
    const spreadsheetId = '1zL2qD_CXmtXc24uIgUNsHmWEoieiLQQFvMOqKQ6HI_8';  // 替換為你的 Spreadsheet ID
    const ranges = [
        '「US版Zoom學員名單(5/15)」!A:L',
        '「騰訊會議(長週期)」!A:L',
        '「騰訊會議(短週期)」!A:L'
    ];

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=${ranges.join('&ranges=')}&key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        // 初始化空陣列來儲存符合搜尋條件的會議
        let filteredMeetings = [];

        // 遍歷每個工作表的數據
        data.valueRanges.forEach(sheetData => {
            const rows = sheetData.values;
            // 過濾出符合搜尋條件的會議名稱，並推入 filteredMeetings
            const matchingMeetings = rows.filter(row => row[0] && row[0].toLowerCase().includes(query.toLowerCase()));  // row[0] 為會議名稱
            filteredMeetings = filteredMeetings.concat(matchingMeetings);  // 合併會議
        });

        // 顯示會議名稱
        displayMeetings(filteredMeetings);
    } catch (error) {
        document.getElementById('all-meeting-error').textContent = '請求失敗：' + error.message;
    }
}

// 顯示會議名稱和相關資訊，並將邏輯修改為四層結構
function displayMeetings(meetings) {
    const resultContainer = document.getElementById('all-meeting-result-container');
    resultContainer.innerHTML = '';  // 清空之前的結果

    if (meetings.length === 0) {
        resultContainer.innerHTML = '<p class="all-no-results">找不到符合條件的會議。</p>';
        resultContainer.style.display = 'block';
        return;
    }

    // 將會議名稱的 Map 設置為四層結構
    const meetingMap = {};

    meetings.forEach(meeting => {
        const meetingName = meeting[0]; // 會議名稱 (A列)
        const meetingLink = meeting[10] || '#'; // 會議連結 (J列)，避免 undefined，給定預設值
        const accountId = meeting[5]; // 開立帳號 (F列)

        // 使用 column F 的前四碼判斷會議類型
        const meetingType = accountId ? accountId.substring(0, 4).toLowerCase() : '';

        if (!meetingMap[meetingName]) {
            // 初始化會議名稱對應的空對象，將週期作為鍵來儲存
            meetingMap[meetingName] = {};
        }

        // 處理會議的詳細資訊
        const repeatPattern = meeting[2] ? meeting[2].split(',') : [];
        const timeRange = meeting[4] ? meeting[4].split('-') : null;

        // 如果該週期尚未出現，初始化為空陣列
        repeatPattern.forEach(pattern => {
            if (!meetingMap[meetingName][pattern]) {
                meetingMap[meetingName][pattern] = [];
            }

            // 將時間範圍及相關詳細資料推入對應的週期
            meetingMap[meetingName][pattern].push({
                meetingTimeRange: timeRange,
                meetingInfo: meeting[6] ? meeting[6] : '無會議資訊',
                accountid: accountId,
                tag: meeting[3], // 標籤來自 D 欄
                link: meetingLink,
                type: meetingType // 會議類型來自帳號的前四碼
            });
        });
    });

// 遍歷會議名稱並顯示四層結構
for (let meetingName in meetingMap) {
    const meetingItem = document.createElement('div');
    meetingItem.className = 'all-meeting-result-item';

    // 會議名稱容器 (第一層)
    const meetingTitle = document.createElement('div');
    meetingTitle.className = 'all-meeting-title';

    // 添加會議名稱
    const titleText = document.createElement('span');
    titleText.textContent = meetingName;
    meetingTitle.appendChild(titleText);

    // 添加第一層摺疊按鈕
    const mainToggleButton = document.createElement('span');
    mainToggleButton.className = 'all-meeting-main-toggle-btn fa fa-plus'; // 初始顯示 + 號
    meetingTitle.appendChild(mainToggleButton);

    const whiteDiv = document.createElement('div');
    whiteDiv.className = 'all-white-background-div';
    whiteDiv.style.display = 'none'; // 初始隱藏

    // 排序每個會議的週期
    const sortedRepeatPatterns = Object.keys(meetingMap[meetingName]).sort((a, b) => {
        return dayMapping[a.charAt(0)] - dayMapping[b.charAt(0)];
    });

    // 遍歷排序後的週期
    sortedRepeatPatterns.forEach(repeatPattern => {
        // 創建外部包裹的 div，命名為 all-meeting-per-list
        const perListDiv = document.createElement('div');
        perListDiv.className = 'all-meeting-per-list';

        // 第二層 - 週期
        const meetingRepeat = document.createElement('div');
        meetingRepeat.className = 'all-meeting-repeat';
        meetingRepeat.textContent = `每週 ${repeatPattern}`;

        const repeatToggleButton = document.createElement('span');
        repeatToggleButton.className = 'all-meeting-repeat-toggle-btn fa fa-angle-down'; // 使用上下箭頭
        meetingRepeat.appendChild(repeatToggleButton);

        // 創建時間範圍的外部容器
        const timeDiv = document.createElement('div');
        timeDiv.className = 'all-time-background-div';
        timeDiv.style.display = 'none'; // 初始隱藏

        // 遍歷該週期的所有時間範圍和詳細資料
        meetingMap[meetingName][repeatPattern].forEach(details => {
            // 創建外部包裹的父元素
            const meetingWrapper = document.createElement('div');
            meetingWrapper.className = 'meeting-wrapper';
            meetingWrapper.style.display = 'flex'; // 使用flex進行水平排列

            // 創建圖示並包裹在link中
            const iconDiv = document.createElement('div');
            iconDiv.className = 'meeting-icon-wrapper';

            const iconLink = document.createElement('a');
            iconLink.href = details.link;
            iconLink.target = '_blank'; // 新頁籤打開連結

            const iconImg = document.createElement('img');
            if (details.type === 'voov') {
                iconImg.src = 'img/voov.png';
                iconImg.alt = 'voov';
            } else if (details.type === 'zoom') {
                iconImg.src = 'img/zoom.png';
                iconImg.alt = 'zoom';
            }
            iconImg.className = 'meeting-icon'; // 設定圖示的 CSS 類名
            iconLink.appendChild(iconImg); // 將圖示添加到超連結中
            iconDiv.appendChild(iconLink); // 將圖示包裹在 div 中

            // 第三層 - 時間範圍
            const meetingTimeRange = document.createElement('div');
            meetingTimeRange.className = 'all-meeting-time-range';

            // 時間範圍和切換按鈕
            meetingTimeRange.textContent = details.meetingTimeRange 
                ? `${details.meetingTimeRange[0]} - ${details.meetingTimeRange[1]}` 
                : '無時間範圍';

            const timeToggleButton = document.createElement('span');
            timeToggleButton.className = 'all-meeting-time-toggle-btn fa fa-angle-down'; // 使用 FontAwesome 的上下箭頭圖示

            // 點擊切換按鈕顯示或隱藏詳細資訊
            timeToggleButton.addEventListener('click', function() {
                const isDetailVisible = detailDiv.style.display === 'block';
                detailDiv.style.display = isDetailVisible ? 'none' : 'block';
                timeToggleButton.className = isDetailVisible 
                    ? 'all-meeting-time-toggle-btn fa fa-angle-down' 
                    : 'all-meeting-time-toggle-btn fa fa-angle-up'; // 切換箭頭方向
            });

            // 將切換按鈕添加到時間範圍中
            meetingTimeRange.appendChild(timeToggleButton);

            // 將圖示和時間範圍添加到父元素 meetingWrapper 中
            meetingWrapper.appendChild(iconDiv); // 先添加圖示
            meetingWrapper.appendChild(meetingTimeRange); // 再添加時間範圍

            // 創建詳細資訊的容器
            const detailDiv = document.createElement('div');
            detailDiv.className = 'all-details-background-div';
            detailDiv.style.display = 'none'; // 初始隱藏

            // 第四層 - 詳細資訊
            const meetingDetails = document.createElement('div');
            meetingDetails.className = 'all-meeting-details';

            const meetingInfoElement = document.createElement('p');
            meetingInfoElement.innerHTML = `<i class="fa fa-info-circle" aria-hidden="true"></i> ${details.meetingInfo}`;

            const accountElement = document.createElement('p');
            accountElement.textContent = `開立帳號: ${details.accountid}`;

            meetingDetails.appendChild(meetingInfoElement);
            meetingDetails.appendChild(accountElement);

            // 添加到詳細資訊層
            detailDiv.appendChild(meetingDetails);

            // 將外部包裹的父元素及詳細資訊添加到 timeDiv
            timeDiv.appendChild(meetingWrapper);
            timeDiv.appendChild(detailDiv);
        });

        // 將週期和時間範圍組合到 all-meeting-per-list
        perListDiv.appendChild(meetingRepeat);
        perListDiv.appendChild(timeDiv);

        // 將 all-meeting-per-list 組合到 whiteDiv
        whiteDiv.appendChild(perListDiv);
    });

    meetingItem.appendChild(meetingTitle);
    meetingItem.appendChild(whiteDiv);
    resultContainer.appendChild(meetingItem);
}

// 顯示結果容器
resultContainer.style.display = 'block';

}

// 使用事件委託來處理展開和收合功能
document.getElementById('all-meeting-result-container').addEventListener('click', function(event) {
    // 第一層展開收合 (綁定在 all-meeting-title)
    if (event.target.closest('.all-meeting-title')) {
        const mainToggleBtn = event.target.closest('.all-meeting-title').querySelector('.all-meeting-main-toggle-btn');
        const whiteDiv = mainToggleBtn.closest('.all-meeting-result-item').querySelector('.all-white-background-div');
        whiteDiv.style.display = whiteDiv.style.display === 'none' ? 'block' : 'none';
        mainToggleBtn.classList.toggle('fa-plus');
        mainToggleBtn.classList.toggle('fa-minus');
    }

    // 第二層展開收合 (週期，綁定在 all-meeting-repeat)
    if (event.target.closest('.all-meeting-repeat')) {
        const repeatToggleBtn = event.target.closest('.all-meeting-repeat').querySelector('.all-meeting-repeat-toggle-btn');
        const timeDiv = repeatToggleBtn.closest('.all-meeting-repeat').nextElementSibling;
        timeDiv.style.display = timeDiv.style.display === 'none' ? 'block' : 'none';
        repeatToggleBtn.classList.toggle('fa-angle-down');
        repeatToggleBtn.classList.toggle('fa-angle-up');
    }

    // 第三層展開收合 (時間範圍，綁定在 all-meeting-time-range)
    if (event.target.closest('.all-meeting-time-range')) {
        const timeRangeDiv = event.target.closest('.all-meeting-time-range');
        const timeToggleBtn = timeRangeDiv.querySelector('.all-meeting-time-toggle-btn');
        
        // 確保 timeToggleBtn 存在並查找時間範圍下的下一個兄弟元素
        if (timeToggleBtn) {
            const detailDiv = timeRangeDiv.nextElementSibling; // 這裡應該是 detailDiv
            if (detailDiv && detailDiv.classList.contains('all-details-background-div')) {
                // 切換顯示和按鈕圖示
                detailDiv.style.display = detailDiv.style.display === 'none' ? 'block' : 'none';
                timeToggleBtn.classList.toggle('fa-angle-down');
                timeToggleBtn.classList.toggle('fa-angle-up');
            }
        }
    }

    // 處理 all-meeting-per-list 點擊時改變背景顏色和圓角
    if (event.target.closest('.all-meeting-per-list')) {
        const perListDiv = event.target.closest('.all-meeting-per-list');
        // 切換背景顏色和圓角
        perListDiv.style.backgroundColor = perListDiv.style.backgroundColor === 'rgb(241, 241, 241)' ? '' : '#f1f1f1';
        perListDiv.style.borderRadius = perListDiv.style.borderRadius === '10px' ? '' : '10px'; // 切換圓角
    }
});