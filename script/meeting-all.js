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
        '「US版Zoom學員名單(5/15)」的副本!A:L',
        '「騰訊會議(長週期)」的副本!A:L',
        '「騰訊會議(短週期)」的副本!A:L'
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

// 顯示會議名稱和相關資訊
function displayMeetings(meetings) {
    const resultContainer = document.getElementById('all-meeting-result-container');
    resultContainer.innerHTML = '';  // 清空之前的結果

    if (meetings.length === 0) {
        resultContainer.innerHTML = '<p class="all-no-results">找不到符合條件的會議。</p>';
        resultContainer.style.display = 'block';
        return;
    }

    // 遍歷會議並顯示
    meetings.forEach(meeting => {
        const meetingItem = document.createElement('div');
        meetingItem.className = 'all-meeting-result-item';

        // 會議名稱容器
        const meetingTitle = document.createElement('div');
        meetingTitle.className = 'all-meeting-title';
        
        // 添加會議名稱
        const titleText = document.createElement('span');
        titleText.textContent = meeting[0]; // 會議名稱 (A列)
        meetingTitle.appendChild(titleText);
        
        // 添加 + 按鈕
        const toggleButton = document.createElement('span');
        toggleButton.className = 'all-meeting-toggle-btn fa fa-plus'; // 初始顯示 + 號
        meetingTitle.appendChild(toggleButton);

        // 會議詳細資訊容器
        const meetingDetails = document.createElement('div');
        meetingDetails.className = 'all-meeting-details';
        meetingDetails.style.display = 'none'; // 初始隱藏

        // 開始日期 ～ 結束日期
        const startDate = new Date(meeting[1]);
        const endDate = new Date(meeting[7]);
        const dateRange = document.createElement('p');
        dateRange.textContent = `日期: ${startDate.toLocaleDateString()} ～ ${endDate.toLocaleDateString()}`;

        // 重複週期
        const repeatPattern = meeting[2] ? meeting[2].split(',') : [];
        const repeatInfo = document.createElement('p');
        repeatInfo.textContent = `每周: ${repeatPattern.join(', ')}`;

        // 時間範圍
        const meetingTimeRange = meeting[4] ? meeting[4].split('-') : null;
        const timeRange = document.createElement('p');
        if (meetingTimeRange) {
            timeRange.textContent = `時間: ${meetingTimeRange[0]} - ${meetingTimeRange[1]}`;
        }

        // 會議資訊
        const meetingInfo = meeting[6] ? meeting[6] : '無會議資訊';
        const meetingInfoElement = document.createElement('p');
        meetingInfoElement.textContent = `會議資訊: ${meetingInfo}`;

        // 會議開立帳號
        const accountid = meeting[5];
        const accountElement = document.createElement('p');
        accountElement.textContent = `開立帳號: ${accountid}`;

        // 將詳細資料加入 meetingDetails
        meetingDetails.appendChild(dateRange);
        meetingDetails.appendChild(repeatInfo);
        if (meetingTimeRange) {
            meetingDetails.appendChild(timeRange);
        }
        meetingDetails.appendChild(meetingInfoElement);
        meetingDetails.appendChild(accountElement);

        // 白底div
        const whiteDiv = document.createElement('div');
        whiteDiv.className = 'all-white-background-div';
        whiteDiv.appendChild(meetingTitle);
        whiteDiv.appendChild(meetingDetails);

        // 將白底div添加到會議項目
        meetingItem.appendChild(whiteDiv);

        // 將會議項目添加到結果容器中
        resultContainer.appendChild(meetingItem);
    });

    // 顯示結果菜單
    resultContainer.style.display = 'block';
}

// 使用事件委託來處理 + 按鈕的展開和收起功能
document.getElementById('all-meeting-result-container').addEventListener('click', function(event) {
    if (event.target.classList.contains('all-meeting-toggle-btn')) {
        const toggleBtn = event.target;
        const meetingDetails = toggleBtn.parentElement.nextElementSibling;

        if (meetingDetails.style.display === 'none') {
            // 展開會議詳情
            meetingDetails.style.display = 'block';
            toggleBtn.classList.remove('fa-plus');
            toggleBtn.classList.add('fa-minus');
        } else {
            // 收起會議詳情
            meetingDetails.style.display = 'none';
            toggleBtn.classList.remove('fa-minus');
            toggleBtn.classList.add('fa-plus');
        }
    }
});
