// 表單提交事件
document.getElementById('meeting-check-form').addEventListener('submit', function(event) {
    event.preventDefault(); // 阻止表單的默認行為
    const dateInput = document.getElementById('meeting-check-date').value;
    const startTimeInput = document.getElementById('meeting-check-start-time').value;
    const endTimeInput = document.getElementById('meeting-check-end-time').value;

    // 獲取會議類型的值
    const meetingType = document.querySelector('input[name="meeting-type"]:checked').value;

    // 驗證輸入
    if (!dateInput || !startTimeInput || !endTimeInput) {
        document.getElementById('meeting-check-error').textContent = '請輸入有效的日期和時間範圍。';
        return;
    }

    const date = parseDate(dateInput);
    const startTime = parseTime(startTimeInput);
    const endTime = parseTime(endTimeInput);

    if (!date || !startTime || !endTime) {
        document.getElementById('meeting-check-error').textContent = '請輸入有效的日期和時間格式。';
        return;
    }

    // 將 meetingType 傳入 checkMeeting 函式
    checkMeeting(date, startTime, endTime, meetingType);
});

function parseDate(input) {
    const datePattern = /(\d{4})[.\-/ ]?(\d{2})[.\-/ ]?(\d{2})/;
    const match = input.match(datePattern);
    if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
    }
    return null;
}

function parseTime(input) {
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

async function checkMeeting(date, startTime, endTime, meetingType) {
    const apiKey = 'AIzaSyCozo2rhMeVsjLB2e3nlI9ln_sZ4fIdCSw';
    const spreadsheetId = '1Trnuwo7rxpNHN6IpOcjrPEdFutxmr1KIJYmgbKwoL9E';
    
    // 根據選擇的類型設定搜尋的 Sheet 名稱
    let sheetName = '';
    if (meetingType === '長週期') {
        sheetName = '長';  // 搜尋名為 "長" 的 sheet
    } else if (meetingType === '短週期') {
        sheetName = '短';  // 搜尋名為 "短" 的 sheet
    }

    const range = `${sheetName}!A:L`;  // 假設數據在選定的 Sheet 的 A 到 L 列

    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`);
        const data = await response.json();
        const rows = data.values;

        const accountResults = {};  // 儲存每個帳號的查找結果
        const checkDate = new Date(date);
        const checkDay = checkDate.getDay();

        const dayMap = {
            0: '日',
            1: '一',
            2: '二',
            3: '三',
            4: '四',
            5: '五',
            6: '六'
        };

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 12) continue;

            const meetingType = row[11]; // 會議類型 (L)
            const account = row[5]; // 會議開立帳號 (F)

            if (!meetingType || typeof meetingType !== 'string' || meetingType.toLowerCase() !== 'voov') continue;

            if (account && !accountResults[account]) {
                accountResults[account] = {
                    hasMeeting: false,
                    overlappingMeetings: []
                };
            }

            const meetingName = row[0]; // 會議名稱 (A)
            const startDate = new Date(row[1]); // 開始日期 (B)
            const endDate = new Date(row[7]); // 結束日期 (H)
            const repeatPattern = row[2] ? row[2].split(',') : []; // 重複模式 (C)
            const meetingTimeRange = row[4].split('-'); // 時間範圍 (E)
            const meetingStartTime = parseTime(meetingTimeRange[0]); // 會議開始時間
            const meetingEndTime = parseTime(meetingTimeRange[1]); // 會議結束時間
            const meetingInfo = row[6]; // 會議資訊 (G)

            if (checkDate >= startDate && checkDate <= endDate && repeatPattern.includes(dayMap[checkDay])) {
                if (startTime < meetingEndTime && endTime > meetingStartTime) {
                    accountResults[account].hasMeeting = true;
                    accountResults[account].overlappingMeetings.push({
                        name: meetingName,
                        startDate: startDate,
                        endDate: endDate,
                        repeatPattern: repeatPattern.join(','),
                        timeRange: `${meetingStartTime} - ${meetingEndTime}`,
                        info: meetingInfo
                    });
                }
            }
        }

        displayResults(accountResults);
    } catch (error) {
        document.getElementById('meeting-check-error').textContent = '請求失敗：' + error.message;
    }
}

function displayResults(accountResults) {
    const resultDiv = document.getElementById('meeting-check-result');
    const accountResultsDiv = document.getElementById('meeting-check-account-results');
    accountResultsDiv.innerHTML = '';

    resultDiv.textContent = '查詢結果如下:';
    resultDiv.style.color = 'green';

    const noMeetingGroup = document.createElement('div');
    noMeetingGroup.className = 'meeting-check-result-group meeting-check-no-meeting';
    noMeetingGroup.innerHTML = '<h3>可排會議的帳號：</h3>';

    const hasMeetingGroup = document.createElement('div');
    hasMeetingGroup.className = 'meeting-check-result-group meeting-check-has-meeting';
    hasMeetingGroup.innerHTML = '<h3>已存在的會議安排：</h3>';

    for (const account in accountResults) {
        const accountResult = document.createElement('div');
        accountResult.className = 'meeting-check-account-title';
        accountResult.innerHTML = `<strong>帳號: ${account}</strong>`;

        if (!accountResults[account].hasMeeting) {
            noMeetingGroup.appendChild(accountResult);
        } else {
            accountResults[account].overlappingMeetings.forEach(meeting => {
                const meetingDiv = document.createElement('div');
                meetingDiv.className = 'meeting-check-card';

                // 建立會議卡片的頭部
                const meetingHeader = document.createElement('div');
                meetingHeader.className = 'meeting-check-title';
                meetingHeader.innerHTML = `<i class="fa fa-calendar"></i> ${meeting.name} <i class="fa fa-plus"></i>`;
                meetingHeader.style.cursor = 'pointer';

                // 會議詳細內容
                const meetingDetails = document.createElement('div');
                meetingDetails.className = 'meeting-check-info';
                meetingDetails.style.display = 'none'; // 初始隱藏
                meetingDetails.innerHTML = `
                    <div>
                        <i class="fa fa-calendar-alt"></i> ${meeting.startDate.toISOString().split('T')[0]} ～ ${meeting.endDate.toISOString().split('T')[0]}
                    </div>
                    <div>
                        <i class="fa fa-clock"></i> <strong>時間:</strong> ${meeting.timeRange}
                    </div>
                    <div>
                        <i class="fa fa-repeat"></i> <strong>每週</strong> ${meeting.repeatPattern}
                    </div>
                    <p class="meeting-check-details">
                        <i class="fa fa-info-circle"></i> ${meeting.info.replace(/\n/g, '<br>')}
                    </p>
                `;

                // 點擊會議頭部展開/收合內容
                meetingHeader.addEventListener('click', function() {
                    if (meetingDetails.style.display === 'none') {
                        meetingDetails.style.display = 'block';
                        meetingHeader.querySelector('i.fa-plus').className = 'fa fa-minus';
                    } else {
                        meetingDetails.style.display = 'none';
                        meetingHeader.querySelector('i.fa-minus').className = 'fa fa-plus';
                    }
                });

                // 將頭部和內容加入卡片
                meetingDiv.appendChild(meetingHeader);
                meetingDiv.appendChild(meetingDetails);
                hasMeetingGroup.appendChild(meetingDiv);
            });
        }
    }

    if (noMeetingGroup.children.length > 1) {
        accountResultsDiv.appendChild(noMeetingGroup);
    }

    if (Object.values(accountResults).some(result => result.hasMeeting)) {
        accountResultsDiv.appendChild(hasMeetingGroup);
    }
}