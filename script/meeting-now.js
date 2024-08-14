// 點擊 "搜尋今日所有會議" 按鈕時觸發的事件
document.getElementById('meetingsearch-fetch-meetings').addEventListener('click', async function() {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];  // 獲取當前日期 yyyy-mm-dd
    const currentTime = now.toTimeString().split(' ')[0].slice(0, 5); // 獲取當前時間 hh:mm

    await meetingsearchFetchMeetings(currentDate, currentTime, now);
});

// 解析時間字串的函數
function meetingsearchParseTime(input) {
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

// 創建會議資訊項的函數
function createMeetingItem(meeting, className, index, accountid) {
    const meetingDiv = document.createElement('div');
    const uniqueId = `meeting-${className}-${index}`;  // 生成唯一ID
    meetingDiv.className = `meetingsearch-meeting-item ${className}`;
    meetingDiv.id = uniqueId;

    // 創建 + / - 按鈕，用於收合
    const toggleButton = document.createElement('button');
    toggleButton.textContent = '+';// 初始狀態為 "+"
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

    // 創建會議內容和link元素
    const meetingContent = document.createElement('span');
    meetingContent.innerHTML = `${meeting.name}（${meeting.startTime}~${meeting.endTime}）`;

    // 創建圖示並包裹在link中
    const iconLink = document.createElement('a');
    iconLink.href = meeting.link;
    iconLink.target = '_blank'; 

    const iconImg = document.createElement('img');
    if (meeting.type.toLowerCase() === 'voov') {
        iconImg.src = 'img/voov.png';
        iconImg.alt = 'voov';
    } else if (meeting.type.toLowerCase() === 'zoom') {
        iconImg.src = 'img/zoom.png';
        iconImg.alt = 'zoom';
    }
    iconImg.className = 'meeting-icon'; // 設定圖示的 CSS 類名
    iconLink.appendChild(iconImg); // 將圖示圖片添加到超連結中

    // 將內容、圖示連結和文本連結添加到 meetingDiv 中
    const parentDiv = document.createElement('div'); //創建上一層元素
    parentDiv.style.position = 'relative'; // 創建上一層元素

    parentDiv.appendChild(toggleButton);
    parentDiv.appendChild(meetingContent);
    parentDiv.appendChild(iconLink); // 添加圖示連結

    meetingDiv.appendChild(parentDiv); // 將 parentDiv 添加到 meetingDiv 中

    // 創建會議資訊 div
    const infoDiv = document.createElement('div');
    infoDiv.className = 'meetingsearch-info';
    infoDiv.id = `info-${uniqueId}`;  // 生成唯一ID
    infoDiv.innerHTML = `會議資訊：<br>${meeting.info.replace(/\n/g, '<br>')}`;
    infoDiv.style.display = 'none'; // 初始狀態下隱藏會議資訊

    // 創建沒有任何樣式的 account 資訊 div，並將其加入 infoDiv 中
    const accountDiv = document.createElement('div');
    const accountSpan = createCopyableAccountElement(accountid); // 使用 createCopyableAccountElement 函數創建可複製的 account 資訊
    accountDiv.appendChild(accountSpan); // 將 account 資訊添加到 div 中

    infoDiv.appendChild(accountDiv); // 將 accountDiv 添加到會議資訊 div 中

    // 將會議資訊 div 添加到 meetingDiv 中
    meetingDiv.appendChild(infoDiv);

    return meetingDiv; // 返回創建的元素
}

// 創建可複製的 account 資訊元素的函數
function createCopyableAccountElement(accountid) {
    const accountSpan = document.createElement('span');
    accountSpan.textContent = accountid;
    accountSpan.className = 'meeting-now-account-span'; // 添加 CSS 類
    accountSpan.style.cursor = 'pointer';
    accountSpan.style.color = 'gray'; // 初始顏色設定為灰色

    // 懸停變色效果
    accountSpan.addEventListener('mouseover', function() {
        accountSpan.style.color = 'blue';
    });
    accountSpan.addEventListener('mouseout', function() {
        accountSpan.style.color = 'gray'; // 懸停離開時恢復為灰色
    });

    return accountSpan;
}



// 搜尋並顯示會議的主要函數
async function meetingsearchFetchMeetings(currentDate, currentTime, now, filterText = '') {
    const apiKey = 'AIzaSyCozo2rhMeVsjLB2e3nlI9ln_sZ4fIdCSw';
    const spreadsheetId = '1Trnuwo7rxpNHN6IpOcjrPEdFutxmr1KIJYmgbKwoL9E';
    const range = '外部課程列表!A:K';

    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`);
        const data = await response.json();
        const rows = data.values;

        const ongoingMeetings = [];
        const upcomingMeetings = [];
        const waitingMeetings = [];
        const endedMeetings = [];

        for (let i = 1; i < rows.length; i++) {
            const meetingName = rows[i][0];
            const startDate = new Date(rows[i][1]);
            const endDate = new Date(rows[i][2]);
            const repeatPattern = rows[i][3] ? rows[i][3].split(',') : [];
            const meetingTimeRange = rows[i][4].split('-');
            const meetingStartTime = meetingsearchParseTime(meetingTimeRange[0]);
            const meetingEndTime = meetingsearchParseTime(meetingTimeRange[1]);
            const meetingType = rows[i][5];
            const meetingInfo = rows[i][7];
            const accountid = rows[i][9];
            const meetingLink = rows[i][10];

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

            if (today >= startDate && today <= endDate && repeatPattern.includes(dayMap[dayOfWeek])) {
                if (filterText && !meetingName.toLowerCase().includes(filterText.toLowerCase())) {
                    continue;
                }

                if (currentTime >= meetingStartTime && currentTime < meetingEndTime) {
                    ongoingMeetings.push({
                        name: meetingName,
                        startTime: meetingStartTime,
                        endTime: meetingEndTime,
                        info: meetingInfo,
                        type: meetingType,
                        link: meetingLink,
                        account: accountid
                    });
                } else if (currentTime < meetingStartTime) {
                    const meetingStartDateTime = new Date(`${currentDate}T${meetingStartTime}`);
                    const timeDifferenceInHours = (meetingStartDateTime - now) / (1000 * 60 * 60);

                    if (timeDifferenceInHours <= 0.5) {
                        upcomingMeetings.push({
                            name: meetingName,
                            startTime: meetingStartTime,
                            endTime: meetingEndTime,
                            info: meetingInfo,
                            type: meetingType,
                            link: meetingLink,
                            account: accountid
                        });
                    } else {
                        waitingMeetings.push({
                            name: meetingName,
                            startTime: meetingStartTime,
                            endTime: meetingEndTime,
                            info: meetingInfo,
                            type: meetingType,
                            link: meetingLink,
                            account: accountid
                        });
                    }
                } else if (currentTime >= meetingEndTime) {
                    endedMeetings.push({
                        name: meetingName,
                        startTime: meetingStartTime,
                        endTime: meetingEndTime,
                        info: meetingInfo,
                        type: meetingType,
                        link: meetingLink,
                        account: accountid
                    });
                }
            }
        }

        const resultDiv = document.getElementById('meetingsearch-account-results');
        resultDiv.innerHTML = '';

        if (ongoingMeetings.length > 0) {
            ongoingMeetings.sort((a, b) => a.startTime.localeCompare(b.startTime));
            resultDiv.innerHTML += `<strong>進行中：</strong>`;
            ongoingMeetings.forEach((meeting, index) => {
                const meetingItem = createMeetingItem(meeting, 'meetingsearch-ongoing', index, meeting.account);
                resultDiv.appendChild(meetingItem);
            });
        }

        if (upcomingMeetings.length > 0) {
            upcomingMeetings.sort((a, b) => a.startTime.localeCompare(b.startTime));
            resultDiv.innerHTML += `<strong>即將開始 (半小時內)：</strong>`;
            upcomingMeetings.forEach((meeting, index) => {
                const meetingItem = createMeetingItem(meeting, 'meetingsearch-upcoming', index, meeting.account);
                resultDiv.appendChild(meetingItem);
            });
        }

        if (waitingMeetings.length > 0) {
            waitingMeetings.sort((a, b) => a.startTime.localeCompare(b.startTime));
            resultDiv.innerHTML += `<strong>等待中：</strong>`;
            waitingMeetings.forEach((meeting, index) => {
                const meetingItem = createMeetingItem(meeting, 'meetingsearch-waiting', index, meeting.account);
                resultDiv.appendChild(meetingItem);
            });
        }

        if (endedMeetings.length > 0) {
            endedMeetings.sort((a, b) => a.startTime.localeCompare(b.startTime));
            resultDiv.innerHTML += `<strong>已結束：</strong>`;
            endedMeetings.forEach((meeting, index) => {
                const meetingItem = createMeetingItem(meeting, 'meetingsearch-ended', index, meeting.account);
                resultDiv.appendChild(meetingItem);
            });
        }

        if (ongoingMeetings.length === 0 && upcomingMeetings.length === 0 && waitingMeetings.length === 0 && endedMeetings.length === 0) {
            resultDiv.textContent = '今日沒有會議安排。';
        }

    } catch (error) {
        document.getElementById('meetingsearch-error').textContent = '請求失敗：' + error.message;
    }
}

// 使用事件委託處理所有點擊事件
document.getElementById('meetingsearch-account-results').addEventListener('click', function(event) {
    const targetMeetingItem = event.target.closest('.meetingsearch-meeting-item');
    const targetAccountSpan = event.target.closest('.meeting-now-account-span');

    if (targetAccountSpan) {
        // 處理點擊帳號的複製事件
        try {
            const tempInput = document.createElement('input');
            tempInput.value = targetAccountSpan.textContent;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);

            // 改變文本顏色表示已複製
            const originalColor = targetAccountSpan.style.color;
            targetAccountSpan.style.color = 'green';// 複製後變綠色
            setTimeout(function() {
                targetAccountSpan.style.color = originalColor;// 1秒後恢復原顏色
            }, 1000);
        } catch (error) {
            console.error('複製失敗', error);
            targetAccountSpan.style.color = 'red';// 如果複製失敗，文本變為紅色
            setTimeout(function() {
                targetAccountSpan.style.color = originalColor; // 1秒後恢復原顏色
            }, 1000);
        }
    } else if (targetMeetingItem && event.target.tagName.toLowerCase() === 'button') {
        // 處理 + / - 按鈕的點擊事件
        const infoDiv = targetMeetingItem.querySelector('.meetingsearch-info');
        if (infoDiv) {
            infoDiv.style.display = infoDiv.style.display === 'none' ? 'block' : 'none';
        }
    }
});

document.getElementById('meetingsearch-account-results').addEventListener('mouseover', function(event) {
    const targetAccountSpan = event.target.closest('.meeting-now-account-span');
    
    if (targetAccountSpan) {
        targetAccountSpan.style.color = 'black'; // 懸停時變藍色
    }
});

document.getElementById('meetingsearch-account-results').addEventListener('mouseout', function(event) {
    const targetAccountSpan = event.target.closest('.meeting-now-account-span');
    
    if (targetAccountSpan) {
        targetAccountSpan.style.color = 'gray'; // 懸停離開時恢復灰色
    }
});

// 自動監聽輸入框的值，並根據輸入的值篩選會議
document.getElementById('meetingsearch-filter-input').addEventListener('input', function() {
    const filterText = document.getElementById('meetingsearch-filter-input').value.toLowerCase();
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].slice(0, 5);

    meetingsearchFetchMeetings(currentDate, currentTime, now, filterText);
});
