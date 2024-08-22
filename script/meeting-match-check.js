document.getElementById('meeting-check-form').addEventListener('submit', function(event) {
    event.preventDefault();  // 這行代碼應該阻止表單提交
    console.log('表單提交被攔截');

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

    // 呼叫 checkMeeting 函數，檢查會議衝突
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
    const spreadsheetId = '1zL2qD_CXmtXc24uIgUNsHmWEoieiLQQFvMOqKQ6HI_8';
    
    // 根據選擇的類型設定搜尋的 Sheet 名稱
    let sheetName = '';
    if (meetingType === '長週期') {
        sheetName = '「騰訊會議(長週期)」';  // 搜尋名為 "長" 的 sheet
    } else if (meetingType === '短週期') {
        sheetName = '「騰訊會議(短週期)」';  // 搜尋名為 "短" 的 sheet
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
            if (!row || row.length < 12) continue; // 保證行數據存在並且有足夠的列數

            // 對所有欄位進行防呆檢查
            const meetingName = row[0] || ''; 
            const startDate = row[1] ? new Date(row[1]) : null;
            const endDate = row[7] ? new Date(row[7]) : null;
            const meetingTimeRange = row[4] ? row[4].split('-') : null;
            const accountid = row[5] || '';
            const meetingInfo = row[6] || '';
            const repeatPattern = row[2] ? row[2].split(',') : [];
            const label = (row.length > 3 && row[3]) ? row[3] : ''; // 確保 `row[3]` 存在並有值

            // 檢查是否存在缺失的關鍵字段
            if (!meetingName || !startDate || !endDate || !meetingTimeRange || !accountid) {
                console.warn(`第 ${i + 1} 行資料不完整，跳過該行`);
                continue; // 跳過這一行
            }

            const meetingStartTime = parseTime(meetingTimeRange[0]);
            const meetingEndTime = parseTime(meetingTimeRange[1]);

            // 檢查時間範圍解析是否成功
            if (!meetingStartTime || !meetingEndTime) {
                console.warn(`第 ${i + 1} 行的時間範圍無效，跳過該行`);
                continue;
            }

            const labelTag = label ? `【${label}】` : ''; // 如果存在標籤，生成標籤

            // 初始化 accountResults[accountid] 如果尚未存在
            if (!accountResults[accountid]) {
                accountResults[accountid] = {
                    hasMeeting: false,
                    overlappingMeetings: []
                };
            }

            // 檢查會議日期和時間
            if (checkDate >= startDate && checkDate <= endDate && repeatPattern.includes(dayMap[checkDay])) {
                if (startTime < meetingEndTime && endTime > meetingStartTime) {
                    accountResults[accountid].hasMeeting = true;
                    accountResults[accountid].overlappingMeetings.push({
                        name: meetingName,
                        startDate: startDate,
                        endDate: endDate,
                        repeatPattern: repeatPattern.join(','),
                        timeRange: `${meetingStartTime} - ${meetingEndTime}`,
                        info: meetingInfo,
                        account: accountid, // 將 accountid 一起保存
                        label: label // 存儲標籤
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

    if (!accountResultsDiv) {
        console.error('父容器 meeting-check-account-results 不存在！');
        return;
    }

    accountResultsDiv.innerHTML = '';

    resultDiv.textContent = '查詢結果如下:';
    resultDiv.style.color = 'green';

    const noMeetingGroup = document.createElement('div');
    noMeetingGroup.className = 'meeting-check-result-group meeting-check-no-meeting';
    noMeetingGroup.innerHTML = '<h3>可排會議的帳號：</h3>';

    const hasMeetingGroup = document.createElement('div');
    hasMeetingGroup.className = 'meeting-check-result-group meeting-check-has-meeting';
    hasMeetingGroup.innerHTML = '<h3>已存在的會議安排：</h3>';

    const meetingsByName = {}; // 用於統整相同名稱的會議

    for (const account in accountResults) {
        const accountResult = document.createElement('div');
        accountResult.className = 'meeting-check-account-title';
        accountResult.innerHTML = `<strong>帳號: </strong>`;

        const accountSpan = createCopyableAccountElement(account);
        accountResult.appendChild(accountSpan);

        if (!accountResults[account].hasMeeting) {
            noMeetingGroup.appendChild(accountResult);
        } else {
            // 統整相同會議名稱的會議資訊
            accountResults[account].overlappingMeetings.forEach(meeting => {
                if (!meetingsByName[meeting.name]) {
                    meetingsByName[meeting.name] = []; // 初始化會議名稱
                }
                meetingsByName[meeting.name].push(meeting); // 將會議加入對應名稱的數組
            });
        }
    }

    // 顯示統整後的會議資訊
    for (const meetingName in meetingsByName) {
        const meetingGroupDiv = document.createElement('div');
        meetingGroupDiv.className = 'meeting-check-card'; // 卡片容器

        const meetingHeader = document.createElement('div');
        meetingHeader.className = 'meeting-check-title';
        meetingHeader.innerHTML = `<i class="fa fa-calendar"></i> ${meetingName} <i class="fa fa-plus toggle-icon"></i>`;
        meetingHeader.style.position = 'relative';
        meetingHeader.style.cursor = 'pointer';

        const meetingDetailsContainer = document.createElement('div');
        meetingDetailsContainer.className = 'meeting-check-info';
        meetingDetailsContainer.style.display = 'none'; // 預設收合

        meetingsByName[meetingName].forEach((meeting, index, array) => {
            const meetingDetails = document.createElement('div');
            meetingDetails.innerHTML = `
                <div>
                    <i class="fa fa-repeat"></i> <strong>每週</strong> ${meeting.repeatPattern}
                </div>
                <div>
                    <i class="fa fa-clock"></i> <strong>時間:</strong> ${meeting.timeRange}
                </div>
                <div>
                    <i class="fa fa-calendar-alt"></i> ${meeting.startDate.toISOString().split('T')[0]} ～ ${meeting.endDate.toISOString().split('T')[0]}
                </div>
                <p class="meeting-check-details">
                    <i class="fa fa-info-circle"></i> ${meeting.info.replace(/\n/g, '<br>')}
                </p>
            `;

            // 生成標籤並應用樣式
            let labelElement = '';  // 初始化標籤元素
            if (meeting.label) {
                labelElement = document.createElement('span');
                labelElement.textContent = `${meeting.label}`;

                // 動態設置樣式
                if (meeting.label === '一次性') {
                    labelElement.style.color = 'rgb(154, 22, 22)';
                    labelElement.style.border = '1px solid rgb(154, 22, 22)';
                } else if (meeting.label === '短週期') {
                    labelElement.style.color = 'rgb(34, 154, 22)';
                    labelElement.style.border = '1px solid rgb(34, 154, 22)';
                }

                // 公共樣式設置
                labelElement.style.padding = '1px 4px';
                labelElement.style.marginLeft = '8px';
                labelElement.style.fontSize = '10px';
				labelElement.style.borderRadius = '4px';
                
                // 將標籤插入到正確的位置
                const repeatDiv = meetingDetails.querySelector('div:nth-child(1)');
                if (repeatDiv) {
                    repeatDiv.appendChild(labelElement);
                } else {
                    console.error('Repeat div not found');
                }
            }

            const meetingAccountSpan = createCopyableAccountElement(meeting.account);  // 使用 meeting.account
            if (meetingAccountSpan) {
                meetingDetails.appendChild(meetingAccountSpan);
            }
            
            // 將會議詳細資訊添加到容器
            meetingDetailsContainer.appendChild(meetingDetails);

            // 如果不是最後一個會議，則插入分隔線
            if (index < array.length - 1) {
                const hr = document.createElement('hr');
                hr.style.border = '1px solid #ccc';  // 設定分隔線樣式
                hr.style.margin = '10px 0';  // 控制分隔線的上下距離
                meetingDetailsContainer.appendChild(hr);
            }
        });

        // 點擊標題展開/收合會議內容
        meetingHeader.addEventListener('click', function () {
            if (meetingDetailsContainer.style.display === 'none') {
                meetingDetailsContainer.style.display = 'block';
                meetingHeader.querySelector('.toggle-icon').className = 'fa fa-minus toggle-icon'; // 切換為減號
            } else {
                meetingDetailsContainer.style.display = 'none';
                meetingHeader.querySelector('.toggle-icon').className = 'fa fa-plus toggle-icon'; // 切換為加號
            }
        });

        meetingGroupDiv.appendChild(meetingHeader);
        meetingGroupDiv.appendChild(meetingDetailsContainer);
        hasMeetingGroup.appendChild(meetingGroupDiv);
    }

    if (noMeetingGroup.children.length > 0) {
        accountResultsDiv.appendChild(noMeetingGroup);
    }

    if (hasMeetingGroup.children.length > 0) {
        accountResultsDiv.appendChild(hasMeetingGroup);
    }
}

// 創建可複製帳號元素的函數
function createCopyableAccountElement(accountid) {
    if (!accountid) {
        console.error('accountid 為空');
        return null;
    }

    const accountSpan = document.createElement('span');
    accountSpan.textContent = accountid;  // 確保這裡賦值了正確的帳號
    accountSpan.className = 'meeting-now-account-span';  // 使用該 class
    accountSpan.style.cursor = 'pointer';
    accountSpan.style.color = 'gray';  // 初始顏色設置為灰色

    return accountSpan;
}

// 使用事件委託處理所有點擊事件
document.getElementById('meeting-check-account-results').addEventListener('click', function(event) {
    const targetAccountSpan = event.target.closest('.meeting-now-account-span'); // 確保使用的是 .meeting-now-account-span

    if (targetAccountSpan) {
        // 處理點擊帳號的複製事件
        navigator.clipboard.writeText(targetAccountSpan.textContent)
        .then(function() {
            const originalColor = targetAccountSpan.style.color;
            targetAccountSpan.style.color = 'green'; // 複製後變綠色
            setTimeout(function() {
                targetAccountSpan.style.color = 'gray'; // 1秒後恢復原顏色
            }, 1000);
        })
        .catch(function(error) {
            console.error('複製失敗', error);
            targetAccountSpan.style.color = 'red'; // 複製失敗變紅色
            setTimeout(function() {
                targetAccountSpan.style.color = 'gray'; // 1秒後恢復原顏色
            }, 1000);
        });
    }
});

// 懸停變色效果
document.getElementById('meeting-check-account-results').addEventListener('mouseover', function(event) {
    const targetAccountSpan = event.target.closest('.meeting-now-account-span');
    if (targetAccountSpan) {
        targetAccountSpan.style.color = 'blue';
    }
});

// 移開時恢復顏色
document.getElementById('meeting-check-account-results').addEventListener('mouseout', function(event) {
    const targetAccountSpan = event.target.closest('.meeting-now-account-span');
    if (targetAccountSpan) {
        targetAccountSpan.style.color = 'gray';
    }
});

document.querySelectorAll('.meeting-check-info').forEach(function(infoDiv) {
    infoDiv.addEventListener('click', function() {
        // 移除其他元素的 "selected" 類
        document.querySelectorAll('.meeting-check-info').forEach(function(div) {
            div.classList.remove('selected');
        });
        // 為當前選取的元素增加 "selected" 類
        infoDiv.classList.add('selected');
    });
});
