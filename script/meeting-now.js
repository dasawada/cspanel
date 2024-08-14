// 點擊 "搜尋今日所有會議" 按鈕時觸發的事件
document.getElementById('meetingsearch-fetch-meetings').addEventListener('click', async function() {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];  // 獲取當前日期 yyyy-mm-dd
    const currentTime = now.toTimeString().split(' ')[0].slice(0, 5); // 獲取當前時間 hh:mm

    await meetingsearchFetchMeetings(currentDate, currentTime, now);
});

// 解析時間字串的函數
function meetingsearchParseTime(input) {
    // 解析兩種格式：0000 或 00:00
    const timePattern1 = /(\d{2})(\d{2})/; // 0000
    const timePattern2 = /(\d{2}):(\d{2})/; // 00:00
    let match = input.match(timePattern1);
    if (match) {
        return `${match[1]}:${match[2]}`;
    }
    match = input.match(timePattern2);
    if (match) {
        return `${match[1]}:${match[2]}`;
    }
    return null;
}

// 創建會議項目的函數
function createMeetingItem(meeting, className, index, accountid) {
    const meetingDiv = document.createElement('div');
    const uniqueId = `meeting-${className}-${index}`;  // 生成唯一ID
    meetingDiv.className = `meetingsearch-meeting-item ${className}`;
    meetingDiv.id = uniqueId;

    // 創建 + / - 按鈕，用於收合
    const toggleButton = document.createElement('button');
    toggleButton.textContent = '+'; // 初始狀態為“+”
    toggleButton.style.marginRight = '10px'; // 按鈕和文本之間的間距

    // 為按鈕添加點擊事件
    toggleButton.addEventListener('click', function(event) {
        // 切換按鈕的文本
        toggleButton.textContent = toggleButton.textContent === '+' ? '-' : '+';

        // 切換會議資訊的顯示狀態
        const infoDiv = meetingDiv.querySelector('.meetingsearch-info');
        if (infoDiv) {
            infoDiv.style.display = infoDiv.style.display === 'none' ? 'block' : 'none';
        }

        // 阻止事件冒泡，防止點擊按鈕時觸發父元素的點擊事件
        event.stopPropagation();
    });

    // 創建會議內容和超連結元素
    const meetingContent = document.createElement('span');
    meetingContent.innerHTML = `${meeting.name}（${meeting.startTime}~${meeting.endTime}）`;

    // 創建圖標並包裹在超連結中
    const iconLink = document.createElement('a');
    iconLink.href = meeting.link;
    iconLink.target = '_blank'; // 在新標籤頁打開連結

    const iconImg = document.createElement('img');
    if (meeting.type.toLowerCase() === 'voov') {
        iconImg.src = 'img/voov.png';
        iconImg.alt = 'voov';
    } else if (meeting.type.toLowerCase() === 'zoom') {
        iconImg.src = 'img/zoom.png';
        iconImg.alt = 'zoom';
    }
    iconImg.className = 'meeting-icon'; // 設置圖標的 CSS 類名
    iconLink.appendChild(iconImg); // 將圖標圖片添加到超連結中

    // 將內容、圖標連結和文本連結添加到 meetingDiv 中
    const parentDiv = document.createElement('div'); // 創建上一層元素
    parentDiv.style.position = 'relative'; // 父元素設置為相對定位

    parentDiv.appendChild(toggleButton);
    parentDiv.appendChild(meetingContent);
    parentDiv.appendChild(iconLink); // 添加圖標連結

    meetingDiv.appendChild(parentDiv); // 將 parentDiv 添加到 meetingDiv 中

    // 創建會議資訊的 div
    const infoDiv = document.createElement('div');
    infoDiv.className = 'meetingsearch-info';
    infoDiv.id = `info-${uniqueId}`;  // 生成唯一ID
    infoDiv.innerHTML = `會議資訊：<br>${meeting.info.replace(/\n/g, '<br>')}`;
    infoDiv.style.display = 'none'; // 初始狀態下隱藏會議資訊

// 創建會議開立帳號的文本並設為可點擊
const accountText = document.createElement('p');
const accountTextContent = `會議開立帳號：${accountid}`; // 使用模板字符串创建内容
accountText.textContent = accountTextContent; 
accountText.style.marginTop = '10px';
accountText.className = 'meeting-now-account';
accountText.style.cursor = 'pointer';

accountText.addEventListener('click', function() {
    // 复制前端显示的文本内容，而不是直接复制 accountid
    const textToCopy = accountText.textContent.split('：')[1]; // 仅复制“会議開立帳號：”之后的部分
    navigator.clipboard.writeText(textToCopy).then(function() {
        accountText.textContent = '已複製！';
        setTimeout(() => {
            accountText.textContent = accountTextContent; // 还原显示的文本内容
        }, 2000);
    }).catch(function(error) {
        console.error('複製失敗', error);
        accountText.textContent = '複製失敗';
        setTimeout(() => {
            accountText.textContent = accountTextContent; // 还原显示的文本内容
        }, 2000);
    });
});

    // 將帳號文本添加到會議資訊 div 中
    infoDiv.appendChild(accountText);

    // 將會議資訊 div 添加到 meetingDiv 中
    meetingDiv.appendChild(infoDiv);

    return meetingDiv; // 別忘了返回創建的元素
}

// 搜尋並顯示會議的主要函數
async function meetingsearchFetchMeetings(currentDate, currentTime, now, filterText = '') {
    const apiKey = 'AIzaSyCozo2rhMeVsjLB2e3nlI9ln_sZ4fIdCSw';
    const spreadsheetId = '1Trnuwo7rxpNHN6IpOcjrPEdFutxmr1KIJYmgbKwoL9E';
    const range = '外部課程列表!A:K';  // 假設數據在Google Sheets的A到K列

    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`);
        const data = await response.json();
        const rows = data.values;

        const ongoingMeetings = [];
        const upcomingMeetings = [];
        const waitingMeetings = [];
        const endedMeetings = [];

        for (let i = 1; i < rows.length; i++) { // 假設第一行是標題
            const meetingName = rows[i][0]; // 會議名稱 (A)
            const startDate = new Date(rows[i][1]); // 開始日期 (B)
            const endDate = new Date(rows[i][2]); // 結束日期 (C)
            const repeatPattern = rows[i][3] ? rows[i][3].split(',') : []; // 重複模式 (D)
            const meetingTimeRange = rows[i][4].split('-'); // 時間範圍 (E)
            const meetingStartTime = meetingsearchParseTime(meetingTimeRange[0]); // 會議開始時間
            const meetingEndTime = meetingsearchParseTime(meetingTimeRange[1]); // 會議結束時間
            const meetingType = rows[i][5]; // 會議類型 (F)
            const meetingInfo = rows[i][7]; // 會議資訊 (H)
            const accountid = rows[i][9]; // 會議開立帳號 (J)
            const meetingLink = rows[i][10]; // 會議連結 (K)

            const today = new Date();
            const dayOfWeek = today.getDay();
            const dayMap = {
                0: '日',
                1: '一',
                2: '二',
                3: '三',
                4: '四',
                5: '五',
                6: '六'
            };

            // 檢查日期範圍和重複模式
            if (today >= startDate && today <= endDate && repeatPattern.includes(dayMap[dayOfWeek])) {
                // 先過濾會議名稱
                if (filterText && !meetingName.toLowerCase().includes(filterText.toLowerCase())) {
                    continue;
                }

                // 檢查會議是否正在進行中
                if (currentTime >= meetingStartTime && currentTime < meetingEndTime) {
                    ongoingMeetings.push({
                        name: meetingName,
                        startTime: meetingStartTime,
                        endTime: meetingEndTime,
                        info: meetingInfo,
                        type: meetingType,
                        link: meetingLink,
                        account: accountid // 正確傳遞 account 值
                    });
                }
                // 檢查會議是否即將開始（半小時內）
                else if (currentTime < meetingStartTime) {
                    const meetingStartDateTime = new Date(`${currentDate}T${meetingStartTime}`);
                    const timeDifferenceInHours = (meetingStartDateTime - now) / (1000 * 60 * 60); // 計算時間差，以小時為單位

                    if (timeDifferenceInHours <= 0.5) {  // 如果時間差在半小時內
                        upcomingMeetings.push({
                            name: meetingName,
                            startTime: meetingStartTime,
                            endTime: meetingEndTime,
                            info: meetingInfo,
                            type: meetingType,
                            link: meetingLink,
                            account: accountid // 正確傳遞 account 值
                        });
                    } else {
                        waitingMeetings.push({  // 如果時間差超過半小時
                            name: meetingName,
                            startTime: meetingStartTime,
                            endTime: meetingEndTime,
                            info: meetingInfo,
                            type: meetingType,
                            link: meetingLink,
                            account: accountid // 正確傳遞 account 值
                        });
                    }
                }
                // 檢查會議是否已結束
                else if (currentTime >= meetingEndTime) {
                    endedMeetings.push({
                        name: meetingName,
                        startTime: meetingStartTime,
                        endTime: meetingEndTime,
                        info: meetingInfo,
                        type: meetingType,
                        link: meetingLink,
                        account: accountid // 正確傳遞 account 值
                    });
                }
            }
        }

        const resultDiv = document.getElementById('meetingsearch-account-results');
        resultDiv.innerHTML = '';  // 清空之前的內容

        // 處理進行中的會議
        if (ongoingMeetings.length > 0) {
            ongoingMeetings.sort((a, b) => a.startTime.localeCompare(b.startTime));  // 按照時間排序
            resultDiv.innerHTML += `<strong>進行中：</strong>`;
            ongoingMeetings.forEach((meeting, index) => {
                const meetingItem = createMeetingItem(meeting, 'meetingsearch-ongoing', index, meeting.account);
                resultDiv.appendChild(meetingItem);
            });
        }

        // 處理即將開始的會議
        if (upcomingMeetings.length > 0) {
            upcomingMeetings.sort((a, b) => a.startTime.localeCompare(b.startTime));  // 按照時間排序
            resultDiv.innerHTML += `<strong>即將開始 (半小時內)：</strong>`;
            upcomingMeetings.forEach((meeting, index) => {
                const meetingItem = createMeetingItem(meeting, 'meetingsearch-upcoming', index, meeting.account);
                resultDiv.appendChild(meetingItem);
            });
        }

        // 處理等待中的會議
        if (waitingMeetings.length > 0) {
            waitingMeetings.sort((a, b) => a.startTime.localeCompare(b.startTime));  // 按照時間排序
            resultDiv.innerHTML += `<strong>等待中：</strong>`;
            waitingMeetings.forEach((meeting, index) => {
                const meetingItem = createMeetingItem(meeting, 'meetingsearch-waiting', index, meeting.account);
                resultDiv.appendChild(meetingItem);
            });
        }

        // 處理已結束的會議
        if (endedMeetings.length > 0) {
            endedMeetings.sort((a, b) => a.startTime.localeCompare(b.startTime));  // 按照時間排序
            resultDiv.innerHTML += `<strong>已結束：</strong>`;
            endedMeetings.forEach((meeting, index) => {
                const meetingItem = createMeetingItem(meeting, 'meetingsearch-ended', index, meeting.account);
                resultDiv.appendChild(meetingItem);
            });
        }

        // 如果沒有任何會議
        if (ongoingMeetings.length === 0 && upcomingMeetings.length === 0 && waitingMeetings.length === 0 && endedMeetings.length === 0) {
            resultDiv.textContent = '今日沒有會議安排。';
        }

    } catch (error) {
        document.getElementById('meetingsearch-error').textContent = '請求失敗：' + error.message;
    }
}


// 使用事件委託處理點擊事件
document.getElementById('meetingsearch-account-results').addEventListener('click', function(event) {
    const target = event.target.closest('.meetingsearch-meeting-item');

    // 僅當點擊的目標是收合按鈕時才進行操作
    if (target && event.target.tagName.toLowerCase() === 'button') {
        const infoDiv = target.querySelector('.meetingsearch-info');
        if (infoDiv) {
            infoDiv.style.display = infoDiv.style.display === 'none' ? 'block' : 'none';
        }
    }
});

// 自動監聽輸入框的值，並根據輸入的值篩選會議
document.getElementById('meetingsearch-filter-input').addEventListener('input', function() {
    const filterText = document.getElementById('meetingsearch-filter-input').value.toLowerCase();
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];  // 獲取當前日期 yyyy-mm-dd
    const currentTime = now.toTimeString().split(' ')[0].slice(0, 5); // 獲取當前時間 hh:mm

    meetingsearchFetchMeetings(currentDate, currentTime, now, filterText);
});
