import { callGoogleSheetBatchAPI } from './googleSheetAPI.js';

let formEventHandler = null;

// 初始化函數 - 供 mediator 呼叫
export function initMeetingMatchCheck() {
    const form = document.getElementById('meeting-check-form');
    if (!form) return;
    
    // 移除舊的事件監聯（如有）
    if (formEventHandler) {
        form.removeEventListener('submit', formEventHandler);
    }
    
    // 定義並綁定新的事件處理器
    formEventHandler = function(event) {
        event.preventDefault();

        const meetingType = document.getElementById('meeting-type').value; // 修改為從下拉選單提取值

        // 其他邏輯保持不變
        const startDateInput = document.getElementById('meeting-check-date').value;
        const endDateInput = document.getElementById('meeting-check-end-date').value;
        const startTimeInput = document.getElementById('meeting-check-start-time').value;
        const endTimeInput = document.getElementById('meeting-check-end-time').value;

        if (!startDateInput || !endDateInput || !startTimeInput || !endTimeInput) {
            document.getElementById('meeting-check-error').textContent = '請輸入有效的日期和時間範圍。';
            return;
        }

        const queryStartDate = new Date(startDateInput);
        const queryEndDate = new Date(endDateInput);
        const startTime = meetingCheckParseTime(startTimeInput);
        const endTime = meetingCheckParseTime(endTimeInput);

        if (queryStartDate > queryEndDate) {
            document.getElementById('meeting-check-error').textContent = '開始日期不能晚於結束日期。';
            return;
        }

        checkMeetingRange(queryStartDate, queryEndDate, startTime, endTime, meetingType);
    };
    
    form.addEventListener('submit', formEventHandler);
    console.log('MeetingMatchCheck: 初始化完成 ✅');
}

// 清理函數 - 供 mediator 呼叫
export function clearMeetingMatchCheck() {
    const form = document.getElementById('meeting-check-form');
    if (form && formEventHandler) {
        form.removeEventListener('submit', formEventHandler);
        formEventHandler = null;
    }
    
    // 清空結果區域
    const resultDiv = document.getElementById('meeting-check-result');
    const accountResultsDiv = document.getElementById('meeting-check-account-results');
    if (resultDiv) resultDiv.innerHTML = '';
    if (accountResultsDiv) accountResultsDiv.innerHTML = '';
    
    console.log('MeetingMatchCheck: 已清理 🧹');
}

function meetingCheckParseTime(input) {
    if (!input) {
        return null;  // 如果輸入為空，直接返回 null
    }

    // 0000 格式 (四位數字) -> 00:00
    const timePattern1 = /(\d{4})/; // 0000 格式
    let match = input.match(timePattern1);
    if (match) {
        return `${match[1].slice(0, 2)}:${match[1].slice(2, 4)}`;  // 將四位數轉換為 00:00 格式
    }

    // 00:00 格式
    const timePattern2 = /(\d{2}):(\d{2})/; // 00:00 格式
    match = input.match(timePattern2);
    if (match) {
        return `${match[1]}:${match[2]}`;  // 保持 00:00 格式
    }

    return null;  // 如果解析失敗，返回 null
}

// 在文件開頭添加 dateRangesOverlap 函數
function dateRangesOverlap(startDate1, endDate1, startDate2, endDate2) {
    return (startDate1 <= endDate2) && (startDate2 <= endDate1);
}

async function checkMeetingRange(queryStartDate, queryEndDate, startTime, endTime, meetingType) {
    // 根據選擇的類型設定搜尋的 Sheet 名稱
    let sheetName = '';
    if (meetingType === '長週期') {
        sheetName = '「騰訊會議(長週期)」';
    } else if (meetingType === '短週期') {
        sheetName = '「騰訊會議(短週期)」';
    }

    const range = `${sheetName}!A:K`;

    try {
        const data = await callGoogleSheetBatchAPI({
            ranges: [range]
        });
        const rows = data.valueRanges[0].values;

        const accountResults = {};

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
            if (!row || row.length < 11) continue; // 確保行數據存在並且有足夠的列數 (A 到 K)
            
            // 這裡僅處理前 11 個列
            const relevantData = row.slice(0, 11); // 只獲取 A 到 K 列的數據

            const meetingName = row[0] || ''; 
            const startDate = row[1] ? new Date(row[1]) : null;
            const endDate = row[7] ? new Date(row[7]) : null;

            if (endDate) {
                // 設置結束日期為當天的 23:59:59
                endDate.setHours(23, 59, 59, 999);
            }

            // 日誌：記錄撈取到的開始日期和結束日期
            console.log(`第 ${i + 1} 行撈取到的開始日期: ${startDate}, 結束日期: ${endDate}`);

            if (!startDate || !endDate) {
                console.warn(`第 ${i + 1} 行的日期無效，跳過該行`);
                continue;
            }
            const meetingTimeRange = row[4] ? row[4].split('-') : null;
            const accountid = row[5] || '';
            const meetingInfo = row[6] || '';
            const repeatPattern = row[2] ? row[2].split(',') : [];
            const label = (row.length > 3 && row[3]) ? row[3] : '';

            if (!meetingName || !startDate || !endDate || !meetingTimeRange || !accountid) {
                console.warn(`第 ${i + 1} 行資料不完整，跳過該行`);
                continue;
            }

            const meetingStartTime = meetingCheckParseTime(meetingTimeRange[0]);
            const meetingEndTime = meetingCheckParseTime(meetingTimeRange[1]);

            // 日誌：記錄撈取到的會議開始時間和結束時間
            console.log(`會議開始時間: ${meetingStartTime}, 會議結束時間: ${meetingEndTime}`);

            if (!meetingStartTime || !meetingEndTime) {
                console.warn(`第 ${i + 1} 行的時間範圍無效，跳過該行`);
                continue;
            }

            const labelTag = label ? `${label}` : '';

            if (!accountResults[accountid]) {
                accountResults[accountid] = {
                    hasMeeting: false,
                    overlappingMeetings: []
                };
            }

            const hasOverlap = (queryStartDate <= endDate) && (queryEndDate >= startDate);

            if (repeatPattern.includes(dayMap[queryStartDate.getDay()]) && hasOverlap) {
                for (let currentDate = new Date(Math.max(queryStartDate.getTime(), startDate.getTime())); 
                     currentDate <= Math.min(queryEndDate.getTime(), endDate.getTime()); 
                     currentDate.setDate(currentDate.getDate() + 1)) {
                    
                    if (repeatPattern.includes(dayMap[currentDate.getDay()])) {
                        if (startTime < meetingEndTime && endTime > meetingStartTime) {
                            accountResults[accountid].hasMeeting = true;
                            accountResults[accountid].overlappingMeetings.push({
                                name: meetingName,
                                startDate: startDate,
                                endDate: endDate,
                                repeatPattern: repeatPattern.join(','),
                                timeRange: `${meetingStartTime} - ${meetingEndTime}`,
                                info: meetingInfo,
                                account: accountid,
                                label: label
                            });
                            break;
                        }
                    }
                }
            }
        }

        displayResults(accountResults);
    } catch (error) {
        document.getElementById('meeting-check-error').textContent = '請求失敗：' + error.message;
    }
}

function formatDateToLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份从 0 开始
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

    let hasNoMeetingAccounts = false;
    let hasMeetingAccounts = false;

    for (const account in accountResults) {
        const accountResult = document.createElement('div');
        accountResult.className = 'meeting-check-account-title';
        accountResult.innerHTML = `<strong>帳號: </strong>`;

        const accountSpan = createCopyableAccountElement(account);
        accountResult.appendChild(accountSpan);

        if (!accountResults[account].hasMeeting) {
            noMeetingGroup.appendChild(accountResult);
            hasNoMeetingAccounts = true;
        } else {
            hasMeetingAccounts = true;
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
                    <i class="fa fa-calendar-alt"></i> ${formatDateToLocal(meeting.startDate)} ～ ${formatDateToLocal(meeting.endDate)}
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
                    labelElement.style.color = '#ffffff'; // 設置文字顏色為白色
                    labelElement.style.backgroundColor = 'rgb(207, 4, 4)'; // 設置底色為紅色
                    labelElement.style.border = '1px solid rgb(207, 4, 4)'; // 邊框顏色
                    labelElement.style.fontWeight = 'bold'; // 設置文字為粗體
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

    // 檢查是否有無會議帳號
    if (!hasNoMeetingAccounts) {
        noMeetingGroup.innerHTML += '<p>此時段無可用帳號</p>';  // 加入「無」說明
    }

    // 檢查是否有已排會議帳號
    if (!hasMeetingAccounts) {
        hasMeetingGroup.innerHTML += '<p>此時段尚無會議</p>';  // 加入「無」說明
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
    accountSpan.textContent = accountid;
    accountSpan.className = 'meeting-now-account-span';
    accountSpan.style.cursor = 'pointer';
    accountSpan.style.color = 'gray';

    return accountSpan;
}