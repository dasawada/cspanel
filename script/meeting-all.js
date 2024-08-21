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

        if (!meetingMap[meetingName]) {
            // 如果這個會議名稱尚未出現，初始化為空陣列
            meetingMap[meetingName] = [];
        }

        // 將相同會議名稱的詳細資訊存入對應的會議名稱
        meetingMap[meetingName].push({
            startDate: new Date(meeting[1]),
            endDate: new Date(meeting[7]),
            repeatPattern: meeting[2] ? meeting[2].split(',') : [],
            meetingTimeRange: meeting[4] ? meeting[4].split('-') : null,
            meetingInfo: meeting[6] ? meeting[6] : '無會議資訊',
            accountid: meeting[5],
            tag: meeting[3] // 標籤來自 D 欄
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

        const uniqueRepeatPatterns = new Set(); // 記錄唯一的重複模式

        meetingMap[meetingName].forEach(details => {
            // 將所有的重複模式合併到 Set 中
            details.repeatPattern.forEach(pattern => uniqueRepeatPatterns.add(pattern));

            // 第三層 時間範圍
            const meetingTimeRange = document.createElement('div');
            meetingTimeRange.className = 'all-meeting-time-range';
            meetingTimeRange.style.position = 'relative';

            // 如果有標籤，顯示於按鈕左側
            if (details.tag) {
                const tagElement = document.createElement('div');
                tagElement.textContent = details.tag;
                tagElement.style.cssText = `
                    color: rgb(34, 154, 22);
                    border: 1px solid rgb(34, 154, 22);
                    padding: 1px 4px;
                    justify-content: center;
                    width: fit-content;
                    margin-right: 8px;
                    display: inline-block;
                    opacity: 0.7;
                    border-radius: 7px;
                    font-size: 10px;
                `;
                meetingTimeRange.appendChild(tagElement);
            }

            // 添加時間範圍
            const timeText = document.createElement('span');
            timeText.textContent = details.meetingTimeRange 
                ? `${details.meetingTimeRange[0]} - ${details.meetingTimeRange[1]}` 
                : '無時間範圍';
            meetingTimeRange.appendChild(timeText);

            const timeToggleButton = document.createElement('span');
            timeToggleButton.className = 'all-meeting-time-toggle-btn fa fa-angle-down'; // 使用上下箭頭
            timeToggleButton.style.position = 'absolute';
            timeToggleButton.style.right = '0';
            meetingTimeRange.appendChild(timeToggleButton);

            const detailDiv = document.createElement('div');
            detailDiv.className = 'all-details-background-div';
            detailDiv.style.display = 'none'; // 初始隱藏

            // 第四層 摺疊後的會議詳細資訊
            const meetingDetails = document.createElement('div');
            meetingDetails.className = 'all-meeting-details';
            meetingDetails.style.display = 'none';

            const meetingInfoElement = document.createElement('p');
            meetingInfoElement.innerHTML = `<i class="fa fa-info-circle" aria-hidden="true"></i> ${details.meetingInfo}`;

            const accountElement = document.createElement('p');
            accountElement.textContent = `開立帳號: ${details.accountid}`;

            meetingDetails.appendChild(meetingInfoElement);
            meetingDetails.appendChild(accountElement);

            whiteDiv.appendChild(meetingTimeRange);
            whiteDiv.appendChild(meetingDetails);
        });

        // 合併相同的週期顯示
        const meetingRepeat = document.createElement('div');
        meetingRepeat.className = 'all-meeting-repeat';
        meetingRepeat.textContent = `每週 ${Array.from(uniqueRepeatPatterns).join(', ')}`;
        whiteDiv.appendChild(meetingRepeat);

        meetingItem.appendChild(meetingTitle);
        meetingItem.appendChild(whiteDiv);
        resultContainer.appendChild(meetingItem);
    }

    // 顯示結果容器
    resultContainer.style.display = 'block';
}


// 使用事件委託來處理四層的展開和收合功能
document.getElementById('all-meeting-result-container').addEventListener('click', function(event) {
    // 第一層 會議名稱的摺疊
    if (event.target.classList.contains('all-meeting-main-toggle-btn')) {
        const mainToggleBtn = event.target;
        const whiteDiv = mainToggleBtn.closest('.all-meeting-result-item').querySelector('.all-white-background-div');

        if (whiteDiv.style.display === 'none') {
            whiteDiv.style.display = 'block';
            mainToggleBtn.classList.remove('fa-plus');
            mainToggleBtn.classList.add('fa-minus');
        } else {
            whiteDiv.style.display = 'none';
            mainToggleBtn.classList.remove('fa-minus');
            mainToggleBtn.classList.add('fa-plus');
        }
    }

    // 第二層 週期的摺疊
    if (event.target.classList.contains('all-meeting-repeat-toggle-btn')) {
        const repeatToggleBtn = event.target;
        const timeDiv = repeatToggleBtn.closest('.all-meeting-repeat').nextElementSibling;

        if (timeDiv.style.display === 'none') {
            timeDiv.style.display = 'block';
            repeatToggleBtn.classList.remove('fa-angle-down');
            repeatToggleBtn.classList.add('fa-angle-up');
        } else {
            timeDiv.style.display = 'none';
            repeatToggleBtn.classList.remove('fa-angle-up');
            repeatToggleBtn.classList.add('fa-angle-down');
        }
    }

    // 第三層 時間的摺疊
    if (event.target.classList.contains('all-meeting-time-toggle-btn')) {
        const timeToggleBtn = event.target;
        const detailDiv = timeToggleBtn.closest('.all-meeting-time-range').nextElementSibling;

        if (detailDiv.style.display === 'none') {
            detailDiv.style.display = 'block';
            timeToggleBtn.classList.remove('fa-angle-down');
            timeToggleBtn.classList.add('fa-angle-up');
        } else {
            detailDiv.style.display = 'none';
            timeToggleBtn.classList.remove('fa-angle-up');
            timeToggleBtn.classList.add('fa-angle-down');
        }
    }
});
