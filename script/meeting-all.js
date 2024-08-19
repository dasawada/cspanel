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

    // 建立會議名稱的 Map，將會議名稱作為鍵，會議詳細資料作為值
    const meetingMap = {};

    meetings.forEach(meeting => {
        const meetingName = meeting[0]; // 會議名稱 (A列)

        if (!meetingMap[meetingName]) {
            // 如果這個會議名稱尚未出現，初始化為空陣列
            meetingMap[meetingName] = [];
        }

        // 將會議詳細資訊存入對應的會議名稱
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

    // 遍歷會議名稱並顯示
    for (let meetingName in meetingMap) {
        const meetingItem = document.createElement('div');
        meetingItem.className = 'all-meeting-result-item';

        // 會議名稱容器
        const meetingTitle = document.createElement('div');
        meetingTitle.className = 'all-meeting-title';

        // 添加會議名稱
        const titleText = document.createElement('span');
        titleText.textContent = meetingName;
        meetingTitle.appendChild(titleText);
        
        // 添加原本的展開/收合按鈕 (會議名稱的摺疊)
        const mainToggleButton = document.createElement('span');
        mainToggleButton.className = 'all-meeting-main-toggle-btn fa fa-plus'; // 初始顯示 + 號
        meetingTitle.appendChild(mainToggleButton);

        const whiteDiv = document.createElement('div');
        whiteDiv.className = 'all-white-background-div';
        whiteDiv.style.display = 'none'; // 初始隱藏

        meetingMap[meetingName].forEach(details => {
            const meetingSummary = document.createElement('div');
            meetingSummary.className = 'all-meeting-summary';
            meetingSummary.innerHTML = `
                ${details.meetingTimeRange ? details.meetingTimeRange[0] + ' - ' + details.meetingTimeRange[1] : '無時間範圍'}／
               每周 ${details.repeatPattern.join(', ')}
               <br>日期: ${details.startDate.toLocaleDateString()}～${details.endDate.toLocaleDateString()}
            `;
            meetingSummary.style.display = 'block';

            // 摺疊後的會議詳細資訊
            const meetingDetails = document.createElement('div');
            meetingDetails.className = 'all-meeting-details';
            meetingDetails.style.display = 'none';

            const meetingInfoElement = document.createElement('p');
            meetingInfoElement.textContent = `會議資訊: ${details.meetingInfo}`;

            const accountElement = document.createElement('p');
            accountElement.textContent = `開立帳號: ${details.accountid}`;

            meetingDetails.appendChild(meetingInfoElement);
            meetingDetails.appendChild(accountElement);

            // 添加展開/收合按鈕 (會議詳細資訊的摺疊，放在 all-meeting-summary 的右上角)
            const detailToggleButton = document.createElement('span');
            detailToggleButton.className = 'all-meeting-detail-toggle-btn fa fa-angle-down'; // 初始顯示下箭頭
            meetingSummary.appendChild(detailToggleButton);

            // 標籤浮動顯示（如果不為空）
            if (details.tag) {
                const tagElement = document.createElement('div');
                tagElement.textContent = details.tag;
                tagElement.style.cssText = `
                    color: rgb(34, 154, 22);
                    border: 1px solid rgb(34, 154, 22);
                    padding: 1px 4px;
                    justify-content: center;
                    width: fit-content;
                    position: absolute;
                    right: 15px;
                    bottom: 25px;
                    opacity: 0.7;
					border-radius: 8px;
					fontsize:10px;
                `;
                meetingDetails.appendChild(tagElement);
            }

            meetingSummary.appendChild(meetingDetails);
            whiteDiv.appendChild(meetingSummary);
        });

        meetingItem.appendChild(meetingTitle);
        meetingItem.appendChild(whiteDiv);
        resultContainer.appendChild(meetingItem);
    }

    // 顯示結果容器
    resultContainer.style.display = 'block';
}

// 使用事件委託來處理兩級的展開和收合功能
document.getElementById('all-meeting-result-container').addEventListener('click', function(event) {
    // 會議名稱的摺疊
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

    // 會議詳細資訊的摺疊
    if (event.target.classList.contains('all-meeting-detail-toggle-btn')) {
        const detailToggleBtn = event.target;
        const meetingDetails = detailToggleBtn.closest('.all-meeting-summary').querySelector('.all-meeting-details');

        if (meetingDetails.style.display === 'none') {
            meetingDetails.style.display = 'block';
            detailToggleBtn.classList.remove('fa-angle-down');
            detailToggleBtn.classList.add('fa-angle-up');
        } else {
            meetingDetails.style.display = 'none';
            detailToggleBtn.classList.remove('fa-angle-up');
            detailToggleBtn.classList.add('fa-angle-down');
        }
    }
});
