       document.getElementById('meeting-check-form').addEventListener('submit', function(event) {
            event.preventDefault();
            const dateInput = document.getElementById('meeting-check-date').value;
            const startTimeInput = document.getElementById('meeting-check-start-time').value;
            const endTimeInput = document.getElementById('meeting-check-end-time').value;

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

            checkMeeting(date, startTime, endTime);
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

        async function checkMeeting(date, startTime, endTime) {
            const apiKey = 'AIzaSyCozo2rhMeVsjLB2e3nlI9ln_sZ4fIdCSw';
            const spreadsheetId = '1Trnuwo7rxpNHN6IpOcjrPEdFutxmr1KIJYmgbKwoL9E';
            const range = '外部課程列表!A:K';  // 假設數據在Sheet1的A到I列

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

                // 初始化帳號結果
        for (let i = 1; i < rows.length; i++) {
            const meetingType = rows[i][5]; // 會議類型 (F)
            const account = rows[i][9]; // 會議開立帳號 (J)

            // 只處理 `會議類型` 為 `voov` 的會議
            if (meetingType.toLowerCase() !== 'voov') continue;

            if (account && !accountResults[account]) { // 確保 account 不為 undefined
                accountResults[account] = {
                    hasMeeting: false,
                    overlappingMeetings: []
                };
            }
        }


        for (let i = 1; i < rows.length; i++) { // 假設第一行是標題
            const meetingName = rows[i][0]; // 會議名稱 (A)
            const startDate = new Date(rows[i][1]); // 開始日期 (B)
            const endDate = new Date(rows[i][2]); // 結束日期 (C)
            const repeatPattern = rows[i][3] ? rows[i][3].split(',') : []; // 重複模式 (D)
            const meetingTimeRange = rows[i][4].split('-'); // 時間範圍 (E)
            const meetingStartTime = parseTime(meetingTimeRange[0]); // 會議開始時間
            const meetingEndTime = parseTime(meetingTimeRange[1]); // 會議結束時間
            const meetingType = rows[i][5]; // 會議類型 (F)
            const meetingInfo = rows[i][7]; // 會議資訊 (H)
            const account = rows[i][9]; // 會議開立帳號 (J)

            // 再次檢查 `會議類型` 是否為 `voov`
            if (meetingType.toLowerCase() !== 'voov') continue;

            // 檢查日期範圍
            if (checkDate >= startDate && checkDate <= endDate) {
                // 檢查重複模式
                if (repeatPattern.includes(dayMap[checkDay])) {
                    // 檢查時間範圍
                    if ((startTime < meetingEndTime && endTime > meetingStartTime)) {
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
                }

    const resultDiv = document.getElementById('meeting-check-result');
    const errorDiv = document.getElementById('meeting-check-error');
    const accountResultsDiv = document.getElementById('meeting-check-account-results');
    accountResultsDiv.innerHTML = '';

    resultDiv.textContent = '查詢結果如下:';
    resultDiv.style.color = 'green';
    errorDiv.textContent = '';
    
    const noMeetingGroup = document.createElement('div');
    noMeetingGroup.className = 'meeting-check-result-group meeting-check-no-meeting';
    noMeetingGroup.innerHTML = '<h3>可排會議的帳號：</h3>';
    
    const hasMeetingGroup = document.createElement('div');
    hasMeetingGroup.className = 'meeting-check-result-group meeting-check-has-meeting';
    hasMeetingGroup.innerHTML = '<h3>已存在的會議安排：</h3>';

    const toggleButton = document.createElement('button');
    toggleButton.textContent = '顯示/隱藏 已存在的會議安排';
    toggleButton.style.marginTop = '10px';
    toggleButton.style.cursor = 'pointer';

    toggleButton.addEventListener('click', () => {
        // 创建新窗口
const popupWindow = window.open('', '_blank', 'width=800,height=600');

// 写入基本的HTML结构
popupWindow.document.write('<html><head><title>已存在的會議安排</title>');

// 添加外部CSS文件的链接
popupWindow.document.write(`
    <link rel="stylesheet" href="style/font.css">
    <link rel="stylesheet" href="style/body.css">
    <link rel="stylesheet" href="style/button.css">
    <link rel="stylesheet" href="style/DT_CSS.css">
    <link rel="stylesheet" href="style/ipsearch_css.css">
    <link rel="stylesheet" href="style/as_num.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link rel="stylesheet" href="style/meeting-now-css.css">
    <link rel="stylesheet" href="style/meeting-match-check.css">
`);

// 继续写入剩余的HTML内容
popupWindow.document.write('</head><body>');
// 这里继续添加你需要显示的内容
popupWindow.document.write('</body></html>');

// 关闭文档流，以便新窗口渲染内容
popupWindow.document.close();

        if (popupWindow) {
            popupWindow.document.write('<html><head><title>已存在的會議安排</title></head><body>');
            popupWindow.document.write('<h3>已存在的會議安排：</h3>');
            let meetingsHTML = '';

 
            for (const account in accountResults) {
                if (accountResults[account].hasMeeting) {
                    meetingsHTML += `<div style="border: 1px solid #ddd; border-radius: 8px; padding: 10px; margin-top: 10px; background-color: #ffffff; box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.1);">
                    <strong>帳號: ${account}</strong><br>`;
                    
                    accountResults[account].overlappingMeetings.forEach(meeting => {
                        meetingsHTML += `
                            <div class="meeting-check-card">
                                <h4 class="meeting-check-title"><i class="fa fa-calendar"></i> ${meeting.name}</h4>
                                <div class="meeting-check-info">
                                    <div>
                                        <i class="fa fa-calendar-alt"></i> ${meeting.startDate.toISOString().split('T')[0]} ～ ${meeting.endDate.toISOString().split('T')[0]}
                                    </div>
                                    <div>
                                        <i class="fa fa-clock"></i> <strong>時間:</strong> ${meeting.timeRange}
                                    </div>
                                    <div>
                                        <i class="fa fa-repeat"></i> <strong>每週</strong> ${meeting.repeatPattern}
                                    </div>
                                </div>
                                <p class="meeting-check-details">
                                    <i class="fa fa-info-circle"></i> ${meeting.info.replace(/\n/g, '<br>')}
                                </p>
                            </div>`;
                    });

                    meetingsHTML += '</div>';
                }
            }

            popupWindow.document.write(meetingsHTML);
            popupWindow.document.write('</body></html>');
            popupWindow.document.close(); // 結束寫入並顯示窗口內容
        } else {
            alert('無法打開新窗口，請檢查瀏覽器是否阻止彈出窗口。');
        }
    });

    for (const account in accountResults) {
        const accountResult = document.createElement('div');
        accountResult.className = 'meeting-check-account-title';
        accountResult.innerHTML = `<strong>帳號: ${account}</strong>`;
        
        if (accountResults[account].hasMeeting) {
            // 如果有會議安排，則忽略這裡的處理，因為會在新窗口中顯示
        } else {
            noMeetingGroup.appendChild(accountResult);
        }
    }

    if (noMeetingGroup.children.length > 1) {
        accountResultsDiv.appendChild(noMeetingGroup);
    }

    if (Object.values(accountResults).some(result => result.hasMeeting)) {
        hasMeetingGroup.appendChild(toggleButton);
        accountResultsDiv.appendChild(hasMeetingGroup);
    }
}

catch (error) {
                document.getElementById('meeting-check-error').textContent = '請求失敗：' + error.message;
            }
        }