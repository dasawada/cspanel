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
            const range = '課程列表!A:I';  // 假設數據在Sheet1的A到I列

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
                    const account = rows[i][8];
                    if (!accountResults[account]) {
                        accountResults[account] = {
                            hasMeeting: false,
                            overlappingMeetings: []
                        };
                    }
                }

                for (let i = 1; i < rows.length; i++) { // 假設第一行是標題
                    const account = rows[i][8];
                    const meetingName = rows[i][0];
                    const startDate = new Date(rows[i][1]);
                    const endDate = new Date(rows[i][2]);
                    const repeatPattern = rows[i][3].split(',');  // 多個工作日
                    const meetingTimeRange = rows[i][4].split('-');
                    const meetingStartTime = parseTime(meetingTimeRange[0]);
                    const meetingEndTime = parseTime(meetingTimeRange[1]);
                    const meetingInfo = rows[i][6];

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
                                    timeRange: `${meetingStartTime}-${meetingEndTime}`,
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
                noMeetingGroup.innerHTML = '<h3>可安排會議的帳號：</h3>';
                
                const hasMeetingGroup = document.createElement('div');
                hasMeetingGroup.className = 'meeting-check-result-group meeting-check-has-meeting';
                hasMeetingGroup.innerHTML = '<h3>已有會議安排：</h3>';

                for (const account in accountResults) {
                    const accountResult = document.createElement('div');
                    accountResult.className = 'meeting-check-account-title';
                    accountResult.innerHTML = `<strong>帳號: ${account}</strong>`;
                    
                    if (accountResults[account].hasMeeting) {
                        const meetingInfoDiv = document.createElement('div');
                        meetingInfoDiv.style.border = '1px solid #ddd';
                        meetingInfoDiv.style.borderRadius = '8px';
                        meetingInfoDiv.style.padding = '10px';
                        meetingInfoDiv.style.marginTop = '10px';
                        meetingInfoDiv.style.backgroundColor = '#ffffff';
                        meetingInfoDiv.style.boxShadow = 'inset 0 2px 5px rgba(0, 0, 0, 0.1)';

                        let meetingsHTML = '';
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
                                            <i class="fa fa-repeat"></i> <strong>重複模式:</strong> ${meeting.repeatPattern}
                                        </div>
                                    </div>
                                    <p class="meeting-check-details">
                                        <i class="fa fa-info-circle"></i> ${meeting.info.replace(/\n/g, '<br>')}
                                    </p>
                                </div>`;
                        });

                        meetingInfoDiv.innerHTML = meetingsHTML;
                        accountResult.appendChild(meetingInfoDiv);
                        hasMeetingGroup.appendChild(accountResult);
                    } else {
                        noMeetingGroup.appendChild(accountResult);
                    }
                }

                if (noMeetingGroup.children.length > 1) {
                    accountResultsDiv.appendChild(noMeetingGroup);
                }
                if (hasMeetingGroup.children.length > 1) {
                    accountResultsDiv.appendChild(hasMeetingGroup);
                }

            } catch (error) {
                document.getElementById('meeting-check-error').textContent = '請求失敗：' + error.message;
            }
        }