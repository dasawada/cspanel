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
        '「US版Zoom學員名單(5/15)」!A:K',
        '「騰訊會議(長週期)」!A:K',
        '「騰訊會議(短週期)」!A:K'
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
        const tag = meeting[3] || '無標籤'; // 使用 D 欄作為標籤，無標籤時顯示 "無標籤"

        // 如果該週期尚未出現，初始化為空陣列
        repeatPattern.forEach(pattern => {
            if (!meetingMap[meetingName][pattern]) {
                meetingMap[meetingName][pattern] = {};
            }
            if (!meetingMap[meetingName][pattern][tag]) {
                meetingMap[meetingName][pattern][tag] = [];
            }

            // 將時間範圍及相關詳細資料推入對應的週期和標籤
            meetingMap[meetingName][pattern][tag].push({
                meetingTimeRange: timeRange,
                meetingInfo: meeting[6] ? meeting[6] : '無會議資訊',
                accountid: accountId,
                link: meetingLink,
                type: meetingType
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

            // 遍歷該週期內的標籤分組
            Object.keys(meetingMap[meetingName][repeatPattern]).forEach(tag => {
                const tagGroupDiv = document.createElement('div');
                tagGroupDiv.className = 'tag-group';
                tagGroupDiv.style.borderTop = '1px solid #ddd'; // 分隔線

                const tagHeader = document.createElement('div');
                tagHeader.className = 'tag-header';
                tagHeader.textContent = tag;
                tagGroupDiv.appendChild(tagHeader);

                // 遍歷該標籤下的所有時間範圍
                meetingMap[meetingName][repeatPattern][tag].forEach(details => {
                    // 創建外部包裹的父元素
                    const meetingWrapper = document.createElement('div');
                    meetingWrapper.className = 'meeting-wrapper';
                    meetingWrapper.style.display = 'flex';

                    // 創建圖示並包裹在link中
                    const iconDiv = document.createElement('div');
                    iconDiv.className = 'meeting-icon-wrapper';

                    const iconLink = document.createElement('a');
                    iconLink.href = details.link;
                    iconLink.target = '_blank';

                    const iconImg = document.createElement('img');
                    iconImg.src = details.type === 'voov' ? 'img/voov.png' : 'img/zoom.png';
                    iconImg.alt = details.type;
                    iconImg.className = 'meeting-icon';
                    iconLink.appendChild(iconImg);
                    iconDiv.appendChild(iconLink);

                    // 第三層 - 時間範圍
                    const meetingTimeRange = document.createElement('div');
                    meetingTimeRange.className = 'all-meeting-time-range';
                    meetingTimeRange.textContent = details.meetingTimeRange 
                        ? `${details.meetingTimeRange[0]} - ${details.meetingTimeRange[1]}` 
                        : '無時間範圍';

                    // 將圖示和時間範圍添加到父元素 meetingWrapper 中
                    meetingWrapper.appendChild(iconDiv);
                    meetingWrapper.appendChild(meetingTimeRange);

                    // 創建詳細資訊的容器
                    const detailDiv = document.createElement('div');
                    detailDiv.className = 'all-details-background-div';
                    detailDiv.style.display = 'none';

                    // 第四層 - 詳細資訊
                    const meetingDetails = document.createElement('div');
                    meetingDetails.className = 'all-meeting-details';

                    const meetingInfoElement = document.createElement('p');
                    meetingInfoElement.innerHTML = `<i class="fa fa-info-circle" aria-hidden="true"></i> ${details.meetingInfo}`;

                    const accountElement = document.createElement('p');
                    accountElement.textContent = `開立帳號: ${details.accountid}`;

                    meetingDetails.appendChild(meetingInfoElement);
                    meetingDetails.appendChild(accountElement);
                    detailDiv.appendChild(meetingDetails);

                    tagGroupDiv.appendChild(meetingWrapper);
                    tagGroupDiv.appendChild(detailDiv);
                });

                timeDiv.appendChild(tagGroupDiv);
            });

            // 將週期和時間範圍組合到 all-meeting-per-list
            perListDiv.appendChild(meetingRepeat);
            perListDiv.appendChild(timeDiv);
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