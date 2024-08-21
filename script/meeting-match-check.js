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

    const meetingName = row[0]; // 會議名稱 (A)
    const startDate = new Date(row[1]); // 開始日期 (B)
    const endDate = new Date(row[7]); // 結束日期 (H)
    const meetingTimeRange = row[4] ? row[4].split('-') : null; // 時間範圍 (E)
    const accountid = row[5]; // 會議開立帳號 (F)
    const meetingInfo = row[6] ? row[6] : ''; // 會議資訊 (G)，如果不存在設置為空字串
    const repeatPattern = row[2] ? row[2].split(',') : []; // 重複模式 (C)，如果不存在設置為空數組

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
                info: meetingInfo // 使用已定義的 meetingInfo
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
    
    // 檢查父容器是否存在
    if (!accountResultsDiv) {
        console.error('父容器 meeting-check-account-results 不存在！');
        return;
    }

    accountResultsDiv.innerHTML = '';  // 清空之前的結果

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
        accountResult.innerHTML = `<strong>帳號: </strong>`;

        // 創建可複製的帳號元素並插入
        const accountSpan = createCopyableAccountElement(account);
        accountResult.appendChild(accountSpan);

        // 沒有會議的帳號
        if (!accountResults[account].hasMeeting) {
            noMeetingGroup.appendChild(accountResult);
        } else {
            // 有會議的帳號
            accountResults[account].overlappingMeetings.forEach(meeting => {
                const meetingDiv = document.createElement('div');
                meetingDiv.className = 'meeting-check-card';

// 建立會議卡片的標題部分
const meetingHeader = document.createElement('div');
meetingHeader.className = 'meeting-check-title';
meetingHeader.innerHTML = `<i class="fa fa-calendar"></i> ${meeting.name} <i class="fa fa-plus toggle-icon"></i>`;
meetingHeader.style.position = 'relative'; // 確保父元素是相對定位
meetingHeader.style.cursor = 'pointer';

                // 會議詳細內容
                const meetingDetails = document.createElement('div');
                meetingDetails.className = 'meeting-check-info';
                meetingDetails.style.display = 'none'; // 初始隱藏

                // 插入會議的詳細內容
                meetingDetails.innerHTML = `
                    <div>
                    <i class="fa fa-calendar-alt"></i> ${meeting.startDate.toISOString().split('T')[0]} ～ ${meeting.endDate.toISOString().split('T')[0]}
                    　<i class="fa fa-repeat"></i> <strong>每週</strong> ${meeting.repeatPattern}
					</div>
                    <div>
                        <i class="fa fa-clock"></i> <strong>時間:</strong> ${meeting.timeRange}
                    </div>
                    <p class="meeting-check-details">
                        <i class="fa fa-info-circle"></i> ${meeting.info.replace(/\n/g, '<br>')}
                    </p>
                `;

                // 為會議卡片內部插入可複製的帳號元素
                const meetingAccountSpan = createCopyableAccountElement(account);
                meetingDetails.appendChild(meetingAccountSpan);

// 展開/收合會議卡片的內容
meetingHeader.addEventListener('click', function() {
    if (meetingDetails.style.display === 'none') {
        meetingDetails.style.display = 'block';
        meetingHeader.querySelector('.toggle-icon').className = 'fa fa-minus toggle-icon'; // 切換為減號
    } else {
        meetingDetails.style.display = 'none';
        meetingHeader.querySelector('.toggle-icon').className = 'fa fa-plus toggle-icon'; // 切換為加號
    }
});

                // 將會議標題和內容添加到卡片中
                meetingDiv.appendChild(meetingHeader);
                meetingDiv.appendChild(meetingDetails);
                hasMeetingGroup.appendChild(meetingDiv);
            });
        }
    }

    // 如果有可排會議的帳號，顯示在無會議組中
    if (noMeetingGroup.children.length > 1) {
        accountResultsDiv.appendChild(noMeetingGroup);
    }

    // 如果有已排會議的帳號，顯示在有會議組中
    if (Object.values(accountResults).some(result => result.hasMeeting)) {
        accountResultsDiv.appendChild(hasMeetingGroup);
    }
}

function createCopyableAccountElement(accountid) {
    const accountSpan = document.createElement('span');
    accountSpan.textContent = accountid;
    accountSpan.className = 'meeting-now-account-span'; // 確保使用這個 class
    accountSpan.style.cursor = 'pointer';
    accountSpan.style.color = 'gray'; // 初始顏色設定為灰色

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

