document.getElementById('meetingsearch-fetch-meetings').addEventListener('click', async function() {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];  // 獲取當前日期 yyyy-mm-dd
    const currentTime = now.toTimeString().split(' ')[0].slice(0, 5); // 獲取當前時間 hh:mm

    await meetingsearchFetchMeetings(currentDate, currentTime, now);
});

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

function createMeetingItem(meeting, className, index) {
    const meetingDiv = document.createElement('div');
    const uniqueId = `meeting-${className}-${index}`;  // 生成唯一ID
    meetingDiv.className = `meetingsearch-meeting-item ${className}`;
    meetingDiv.id = uniqueId;
    meetingDiv.innerHTML = `${meeting.name}（${meeting.startTime}~${meeting.endTime}）`;

    const infoDiv = document.createElement('div');
    infoDiv.className = 'meetingsearch-info';
    infoDiv.id = `info-${uniqueId}`;  // 生成唯一ID
    infoDiv.innerHTML = `會議資訊：<br>${meeting.info.replace(/\n/g, '<br>')}`;
    infoDiv.style.display = 'none'; // 初始状态下隐藏会议信息
    meetingDiv.appendChild(infoDiv);

    return meetingDiv;
}

async function meetingsearchFetchMeetings(currentDate, currentTime, now, filterText = '') {
    const apiKey = 'AIzaSyCozo2rhMeVsjLB2e3nlI9ln_sZ4fIdCSw';
    const spreadsheetId = '1Trnuwo7rxpNHN6IpOcjrPEdFutxmr1KIJYmgbKwoL9E';
    const range = '課程列表!A:I';  // 假設數據在Sheet1的A到I列

    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`);
        const data = await response.json();
        const rows = data.values;

        const ongoingMeetings = [];
        const upcomingMeetings = [];
        const waitingMeetings = [];
        const endedMeetings = [];

        for (let i = 1; i < rows.length; i++) { // 假設第一行是標題
            const meetingName = rows[i][0];
            const startDate = new Date(rows[i][1]);
            const endDate = new Date(rows[i][2]);
            const repeatPattern = rows[i][3].split(',');  // 多個工作日
            const meetingTimeRange = rows[i][4].split('-');
            const meetingStartTime = meetingsearchParseTime(meetingTimeRange[0]);
            const meetingEndTime = meetingsearchParseTime(meetingTimeRange[1]);
            const meetingInfo = rows[i][6];

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
                // 先过滤会议信息
                if (filterText && !meetingName.toLowerCase().includes(filterText.toLowerCase())) {
                    continue;
                }

                // 檢查會議是否正在進行中
                if (currentTime >= meetingStartTime && currentTime < meetingEndTime) {
                    ongoingMeetings.push({
                        name: meetingName,
                        startTime: meetingStartTime,
                        endTime: meetingEndTime,
                        info: meetingInfo
                    });
                }
                // 檢查會議是否即將開始（兩小時內）
                else if (currentTime < meetingStartTime) {
                    const meetingStartDateTime = new Date(`${currentDate}T${meetingStartTime}`);
                    const timeDifferenceInHours = (meetingStartDateTime - now) / (1000 * 60 * 60); // 计算时间差，以小时为单位

                    if (timeDifferenceInHours <= 2) {  // 如果时间差在两小时内
                        upcomingMeetings.push({
                            name: meetingName,
                            startTime: meetingStartTime,
                            endTime: meetingEndTime,
                            info: meetingInfo
                        });
                    } else {
                        waitingMeetings.push({  // 如果时间差超过两小时
                            name: meetingName,
                            startTime: meetingStartTime,
                            endTime: meetingEndTime,
                            info: meetingInfo
                        });
                    }
                }
                // 檢查會議是否已結束
                else if (currentTime >= meetingEndTime) {
                    endedMeetings.push({
                        name: meetingName,
                        startTime: meetingStartTime,
                        endTime: meetingEndTime,
                        info: meetingInfo
                    });
                }
            }
        }

        const resultDiv = document.getElementById('meetingsearch-account-results');
        resultDiv.innerHTML = '';  // 清空之前的内容

        // 处理进行中的会议
        if (ongoingMeetings.length > 0) {
            resultDiv.innerHTML += `<strong>進行中：</strong>`;
            ongoingMeetings.forEach((meeting, index) => {
                const meetingItem = createMeetingItem(meeting, 'meetingsearch-ongoing', index);
                resultDiv.appendChild(meetingItem);
                
            });
        }

        // 处理即将开始的会议
        if (upcomingMeetings.length > 0) {
            resultDiv.innerHTML += `<strong>即將開始：</strong>`;
            upcomingMeetings.forEach((meeting, index) => {
                const meetingItem = createMeetingItem(meeting, 'meetingsearch-upcoming', index);
                resultDiv.appendChild(meetingItem);
                
            });
        }

        // 处理等待中的会议
        if (waitingMeetings.length > 0) {
            resultDiv.innerHTML += `<strong>等待中：</strong>`;
            waitingMeetings.forEach((meeting, index) => {
                const meetingItem = createMeetingItem(meeting, 'meetingsearch-waiting', index);
                resultDiv.appendChild(meetingItem);
                
            });
        }

        // 处理已结束的会议
        if (endedMeetings.length > 0) {
            resultDiv.innerHTML += `<strong>已結束：</strong>`;
            endedMeetings.forEach((meeting, index) => {
                const meetingItem = createMeetingItem(meeting, 'meetingsearch-ended', index);
                resultDiv.appendChild(meetingItem);
                
            });
        }

        // 如果没有任何会议
        if (ongoingMeetings.length === 0 && upcomingMeetings.length === 0 && waitingMeetings.length === 0 && endedMeetings.length === 0) {
            resultDiv.textContent = '今日沒有會議安排。';
        }

    } catch (error) {
        document.getElementById('meetingsearch-error').textContent = '請求失敗：' + error.message;
    }
}

// 使用事件委托处理点击事件
document.getElementById('meetingsearch-account-results').addEventListener('click', function(event) {
    const target = event.target.closest('.meetingsearch-meeting-item');
    if (target) {
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