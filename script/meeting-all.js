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

// 定義中文星期的對應數值
const dayMapping = {
    '一': 1,
    '二': 2,
    '三': 3,
    '四': 4,
    '五': 5,
    '六': 6,
    '日': 7
};

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
                accountid: meeting[5],
                tag: meeting[3] // 標籤來自 D 欄
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
            // 第二層 - 週期
            const meetingRepeat = document.createElement('div');
            meetingRepeat.className = 'all-meeting-repeat';
            meetingRepeat.textContent = `每週 ${repeatPattern}`;

            const repeatToggleButton = document.createElement('span');
            repeatToggleButton.className = 'all-meeting-repeat-toggle-btn fa fa-angle-down'; // 使用上下箭頭
            meetingRepeat.appendChild(repeatToggleButton);

            const timeDiv = document.createElement('div');
            timeDiv.className = 'all-time-background-div';
            timeDiv.style.display = 'none'; // 初始隱藏

            // 遍歷該週期的所有時間範圍和詳細資料
            meetingMap[meetingName][repeatPattern].forEach(details => {
                // 第三層 - 時間範圍
                const meetingTimeRange = document.createElement('div');
                meetingTimeRange.className = 'all-meeting-time-range';
                meetingTimeRange.textContent = details.meetingTimeRange 
                    ? `${details.meetingTimeRange[0]} - ${details.meetingTimeRange[1]}` 
                    : '無時間範圍';

                const timeToggleButton = document.createElement('span');
                timeToggleButton.className = 'all-meeting-time-toggle-btn fa fa-angle-down'; // 使用上下箭頭
                meetingTimeRange.appendChild(timeToggleButton);

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

                // 添加時間範圍及詳細資訊到 timeDiv
                timeDiv.appendChild(meetingTimeRange);
                timeDiv.appendChild(detailDiv);
            });

            // 將週期、時間範圍和詳細資訊組合到 whiteDiv
            whiteDiv.appendChild(meetingRepeat);
            whiteDiv.appendChild(timeDiv);
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
    // 第一層展開收合
    if (event.target.classList.contains('all-meeting-main-toggle-btn')) {
        const mainToggleBtn = event.target;
        const whiteDiv = mainToggleBtn.closest('.all-meeting-result-item').querySelector('.all-white-background-div');
        whiteDiv.style.display = whiteDiv.style.display === 'none' ? 'block' : 'none';
        mainToggleBtn.classList.toggle('fa-plus');
        mainToggleBtn.classList.toggle('fa-minus');
    }

    // 第二層展開收合 (週期)
    if (event.target.classList.contains('all-meeting-repeat-toggle-btn')) {
        const repeatToggleBtn = event.target;
        const timeDiv = repeatToggleBtn.closest('.all-meeting-repeat').nextElementSibling;
        timeDiv.style.display = timeDiv.style.display === 'none' ? 'block' : 'none';
        repeatToggleBtn.classList.toggle('fa-angle-down');
        repeatToggleBtn.classList.toggle('fa-angle-up');
    }

    // 第三層展開收合 (時間範圍)
    if (event.target.classList.contains('all-meeting-time-toggle-btn')) {
        const timeToggleBtn = event.target;
        const detailDiv = timeToggleBtn.closest('.all-meeting-time-range').nextElementSibling;
        detailDiv.style.display = detailDiv.style.display === 'none' ? 'block' : 'none';
        timeToggleBtn.classList.toggle('fa-angle-down');
        timeToggleBtn.classList.toggle('fa-angle-up');
    }
});
