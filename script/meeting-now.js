import { callGoogleSheetBatchAPI } from './googleSheetAPI.js';

// 初始化會議分類數組
let ongoingMeetings = [];
let upcomingMeetings = [];
let waitingMeetings = [];
let endedMeetings = [];

// 點擊 "搜尋今日所有會議" 按鈕時觸發的事件
document.getElementById('meetingsearch-fetch-meetings').addEventListener('click', async function() {
    const now = new Date();

    // 將時間轉換為台灣時區
    const taiwanOffset = 8 * 60; // 台灣時區的時差，單位為分鐘 (UTC+8)
    const localTime = new Date(now.getTime() + (taiwanOffset * 60 * 1000)); // 調整為台灣時間

    // 獲取台灣時區的日期和時間
    const currentDate = localTime.toISOString().split('T')[0]; // 獲取當前日期 yyyy-mm-dd
    const currentTime = localTime.toTimeString().split(' ')[0].slice(0, 5); // 獲取當前時間 hh:mm

    await meetingsearchFetchMeetings(currentDate, currentTime, localTime);
});

// 自動監聽輸入框的值，並根據輸入的值篩選會議
document.getElementById('meetingsearch-filter-input').addEventListener('input', function() {
    const filterText = document.getElementById('meetingsearch-filter-input').value.toLowerCase();
    
    const now = new Date();

    // 將時間轉換為台灣時區
    const taiwanOffset = 8 * 60; // 台灣時區的時差，單位為分鐘 (UTC+8)
    const localTime = new Date(now.getTime() + (taiwanOffset * 60 * 1000)); // 調整為台灣時間

    // 獲取台灣時區的日期和時間
    const currentDate = localTime.toISOString().split('T')[0]; // 獲取當前日期 yyyy-mm-dd
    const currentTime = localTime.toTimeString().split(' ')[0].slice(0, 5); // 獲取當前時間 hh:mm

    meetingsearchFetchMeetings(currentDate, currentTime, localTime, filterText);
});

// 更新時間解析函數，加入更嚴格的驗證
function parseTime(input, currentDate) {
    // 檢查輸入是否為空或非字串
    if (!input || typeof input !== 'string') {
        return null;
    }

    // 移除所有空白
    input = input.replace(/\s+/g, '');

    // 檢查是否為有效的時間格式
    const timePattern1 = /^(\d{2})(\d{2})$/; // 0000
    const timePattern2 = /^(\d{2}):(\d{2})$/; // 00:00
    
    let match = input.match(timePattern1);
    let hours, minutes;
    
    if (match) {
        hours = match[1];
        minutes = match[2];
    } else {
        match = input.match(timePattern2);
        if (match) {
            hours = match[1];
            minutes = match[2];
        } else {
            return null;
        }
    }

    // 驗證時間值的有效性
    const hoursNum = parseInt(hours, 10);
    const minutesNum = parseInt(minutes, 10);
    
    if (hoursNum < 0 || hoursNum > 23 || minutesNum < 0 || minutesNum > 59) {
        return null;
    }

    // 格式化時間，確保是兩位數
    hours = hours.padStart(2, '0');
    minutes = minutes.padStart(2, '0');

    // 創建日期對象
    const dateTimeString = `${currentDate}T${hours}:${minutes}:00`;
    const dateObj = new Date(dateTimeString);

    // 檢查日期對象是否有效
    if (isNaN(dateObj.getTime())) {
        return null;
    }

    return {
        original: input,
        formatted: `${hours}:${minutes}`,
        date: dateObj
    };
}

// 在讀取 Google Sheets 資料後，強制將時間作為字串處理
function handleMeetingData(row) {
    const timeData = row[4]; // 從工作表中讀取的時間
    const timeAsString = String(timeData); // 強制轉為字串
    const parsedTime = parseTime(timeAsString); // 使用 parseTime 函數解析時間

    console.log(parsedTime); // 檢查解析後的時間
}

// 擴大撈取範圍，包括 zoom、長、短工作表
async function meetingsearchFetchMeetings(currentDate, currentTime, now, filterText = '') {
    try {
        // 重置會議數組
        ongoingMeetings = [];
        upcomingMeetings = [];
        waitingMeetings = [];
        endedMeetings = [];

        const ranges = ['「騰訊會議(長週期)」!A:K', '「騰訊會議(短週期)」!A:K'];
        const data = await callGoogleSheetBatchAPI({ ranges });
        
        // Process meeting data
        data.valueRanges.forEach((sheet, index) => {
            const rows = sheet.values;
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                
                // 跳過標題行或空行
                if (!row || row.length === 0) continue;

                // 檢查並處理時間範圍
                const meetingTimeRangeString = row[4] || '';
                if (!meetingTimeRangeString) {
                    console.warn(`第 ${i + 1} 行時間範圍為空`);
                    continue;
                }

                const meetingTimeRange = meetingTimeRangeString.split('-');
                if (meetingTimeRange.length !== 2 || !meetingTimeRange[0] || !meetingTimeRange[1]) {
                    console.warn(`第 ${i + 1} 行時間範圍格式無效: ${meetingTimeRangeString}`);
                    continue;
                }

                // 根據 F 列前四碼判斷會議類型
                const accountIdPrefix = row[5]?.slice(0, 4).toLowerCase(); // 取前四個字符，轉為小寫
                let meetingType = ''; // 初始化會議類型

                if (accountIdPrefix === 'voov') {
                    meetingType = 'voov';
                } else if (accountIdPrefix === 'zoom') {
                    meetingType = 'zoom';
                }

                const meetingName = row[0]; // 會議名稱 (A列)
                const startDate = new Date(row[1]); // 開始日期 (B列)
                const endDate = new Date(row[7]); // 結束日期 (H列)
                endDate.setHours(23, 59, 59, 999); // 設置為當天的 23:59:59.999
                const repeatPatternString = row[2] || ''; // 確保有空字串作為默認值
                const repeatPattern = repeatPatternString ? repeatPatternString.split(',') : []; // 檢查並拆分重複模式

                // 使用 parseTime 函數來解析時間
                const meetingStartTimeObj = parseTime(meetingTimeRange[0], currentDate);
                const meetingEndTimeObj = parseTime(meetingTimeRange[1], currentDate);

                // 如果時間解析失敗，記錄警告並跳過
                if (!meetingStartTimeObj || !meetingEndTimeObj) {
                    console.warn(`第 ${i + 1} 行時間解析失敗: ${row[0] || '未命名會議'}`);
                    continue;
                }

                // 使用 Date 物件進行比較
                const meetingStartDateTime = meetingStartTimeObj.date;
                const meetingEndDateTime = meetingEndTimeObj.date;
                const currentDateTime = new Date(); // 當前系統時間

                const meetingStartTime = meetingStartTimeObj.formatted; // 格式化時間字串
                const meetingEndTime = meetingEndTimeObj.formatted; // 格式化時間字串

                const accountid = row[5]; // 會議開立帳號 (F列)
                const meetingInfo = row[6]; // 會議資訊 (G列)
                const meetingLink = row[10]; // 會議連結 (J列)

                if (!meetingName || !startDate || !endDate || !meetingTimeRange || !accountid) {
                    console.warn(`第 ${i + 1} 行資料不完整，跳過該行`);
                    continue;
                }

                // 確認日期範圍
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

                // 檢查是否符合重複模式和當前日期範圍
                if (today >= startDate && today <= endDate && repeatPattern.includes(dayMap[dayOfWeek])) {
                    if (filterText && !meetingName.toLowerCase().includes(filterText.toLowerCase())) {
                        continue;
                    }

                    // 比較當前時間與會議時間範圍
                    if (currentDateTime >= meetingStartDateTime && currentDateTime < meetingEndDateTime) {
                        ongoingMeetings.push({
                            name: meetingName,
                            startTime: meetingStartTimeObj.formatted,
                            endTime: meetingEndTimeObj.formatted,
                            info: meetingInfo,
                            type: meetingType,
                            link: meetingLink,
                            account: accountid
                        });
                    } else if (currentDateTime < meetingStartDateTime) {
                        const timeDifferenceInHours = (meetingStartDateTime - currentDateTime) / (1000 * 60 * 60);

                        if (timeDifferenceInHours <= 0.5) {
                            // 即將開始的會議
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
                            // 等待中的會議
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
                    } else if (currentDateTime >= meetingEndDateTime) {
                        // 已結束的會議
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
        });

        // 會議分類結束後進行排序
        ongoingMeetings.sort((a, b) => a.startTime.localeCompare(b.startTime));
        upcomingMeetings.sort((a, b) => a.startTime.localeCompare(b.startTime));
        waitingMeetings.sort((a, b) => a.startTime.localeCompare(b.startTime));
        endedMeetings.sort((a, b) => a.startTime.localeCompare(b.startTime));

        // 然後依次將每個數組中的會議顯示
        const resultDiv = document.getElementById('meetingsearch-account-results');
        resultDiv.innerHTML = '';

        if (ongoingMeetings.length > 0) {
            resultDiv.innerHTML += `<strong>進行中：</strong>`;
            ongoingMeetings.forEach((meeting, index) => {
                const meetingItem = createMeetingItem(meeting, 'meetingsearch-ongoing', index, meeting.account);
                resultDiv.appendChild(meetingItem);
            });
        }

        if (upcomingMeetings.length > 0) {
            resultDiv.innerHTML += `<strong>即將開始 (半小時內)：</strong>`;
            upcomingMeetings.forEach((meeting, index) => {
                const meetingItem = createMeetingItem(meeting, 'meetingsearch-upcoming', index, meeting.account);
                resultDiv.appendChild(meetingItem);
            });
        }

        if (waitingMeetings.length > 0) {
            resultDiv.innerHTML += `<strong>等待中：</strong>`;
            waitingMeetings.forEach((meeting, index) => {
                const meetingItem = createMeetingItem(meeting, 'meetingsearch-waiting', index, meeting.account);
                resultDiv.appendChild(meetingItem);
            });
        }

        if (endedMeetings.length > 0) {
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
        console.error('處理會議資料時發生錯誤:', error);
        const errorDiv = document.getElementById('meetingsearch-error');
        if (errorDiv) {
            errorDiv.textContent = `請求失敗：${error.message}`;
        }
        
        // 清空所有會議列表
        ongoingMeetings = [];
        upcomingMeetings = [];
        waitingMeetings = [];
        endedMeetings = [];
        
        // 清空顯示區域
        const resultDiv = document.getElementById('meetingsearch-account-results');
        if (resultDiv) {
            resultDiv.innerHTML = '載入會議資料時發生錯誤';
        }
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

// 創建會議資訊項的函數
function createMeetingItem(meeting, className, index, accountid) {
    const meetingDiv = document.createElement('div');
    const uniqueId = `meeting-${className}-${index}`;  // 生成唯一ID
    meetingDiv.className = `meetingsearch-meeting-item ${className}`;
    meetingDiv.id = uniqueId;

    // 創建包裹 div1, div2, div3 的父元素
    const meetingRowDiv = document.createElement('div');
    meetingRowDiv.className = 'meeting-now-row'; // 用來包裹 div1, div2, div3 的父容器

    // 創建 + / - 按鈕，用於收合
    const toggleButtonDiv = document.createElement('div');
    toggleButtonDiv.className = 'meeting-now-div1'; // 第一個 div
    const toggleButton = document.createElement('button');
    toggleButton.textContent = '+'; // 初始狀態為 "+"
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
    toggleButtonDiv.appendChild(toggleButton);

    // 第二個 div，放置會議內容
    const meetingContentDiv = document.createElement('div');
    meetingContentDiv.className = 'meeting-now-div2'; // 第二個 div
    const meetingContent = document.createElement('span');
    meetingContent.innerHTML = `${meeting.name}（${meeting.startTime}~${meeting.endTime}）`;
    meetingContentDiv.appendChild(meetingContent);

    // 第三個 div，放置圖示和連結
    const iconLinkDiv = document.createElement('div');
    iconLinkDiv.className = 'meeting-now-div3'; // 第三個 div
    const accountIdPrefix = accountid.slice(0, 4).toLowerCase(); // 取前四個字符，轉為小寫
    let meetingType = ''; // 初始化會議類型

    if (accountIdPrefix === 'voov') {
        meetingType = 'voov';
    } else if (accountIdPrefix === 'zoom') {
        meetingType = 'zoom';
    }

    const iconLink = document.createElement('a');
    iconLink.href = meeting.link;
    iconLink.target = '_blank';

    const iconImg = document.createElement('img');
    if (meetingType === 'voov') {
        iconImg.src = 'img/voov.png';
        iconImg.alt = 'voov';
    } else if (meetingType === 'zoom') {
        iconImg.src = 'img/zoom.png';
        iconImg.alt = 'zoom';
    }
    iconImg.className = 'meeting-icon'; // 設定圖示的 CSS 類名
    iconLink.appendChild(iconImg);
    iconLinkDiv.appendChild(iconLink);

    // 將 div1, div2, div3 添加到 meetingRowDiv 中
    meetingRowDiv.appendChild(toggleButtonDiv);
    meetingRowDiv.appendChild(meetingContentDiv);
    meetingRowDiv.appendChild(iconLinkDiv);

    // 最後將 meetingRowDiv 添加到 meetingDiv 中
    meetingDiv.appendChild(meetingRowDiv);

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
