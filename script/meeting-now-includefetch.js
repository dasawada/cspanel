import { callGoogleSheetBatchAPI } from './googleSheetAPI.js';
import { ZVaccountEmailMap } from './ZVaccountEmailMap.js';
// 初始化會議分類數組
let ongoingMeetings = [];
let upcomingMeetings = [];
let waitingMeetings = [];
let endedMeetings = [];

// 移除原有的按鈕事件監聽器，改為頁面載入時自動執行
document.addEventListener('DOMContentLoaded', async function() {
    const now = new Date();
    const taiwanOffset = 8 * 60;
    const localTime = new Date(now.getTime() + (taiwanOffset * 60 * 1000));
    const currentDate = localTime.toISOString().split('T')[0];
    const currentTime = localTime.toTimeString().split(' ')[0].slice(0, 5);

    await meetingsearchFetchMeetings(currentDate, currentTime, localTime);
});

// 修改清單圖示按鈕事件
document.getElementById('zv-metting-list-modal-btn').addEventListener('click', async function() {
    try {
        const { startAt, endAt } = getTodayUTCTimeRange();

        // 獲取所有課程
        const [processingCourses, preparingCourses, overCourses] = await Promise.all([
            fetchCourses('processing', startAt, endAt),
            fetchCourses('preparing', startAt, endAt),
            fetchCourses('over', startAt, endAt)
        ]);

        const allCourses = [...processingCourses, ...preparingCourses, ...overCourses];

        // 格式化課程資訊
        const formattedMeetings = allCourses
            .map(course => {
                const studentName = course.students?.[0]?.name;
                if (!studentName) return null;
                const startTime = new Date(course.startAt);
                const formattedTime = startTime.toLocaleTimeString('zh-TW', {
                    timeZone: 'Asia/Taipei',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
                return `${formattedTime} ${studentName}`;
            })
            .filter(Boolean) // 移除空值
            .sort() // 按時間排序
            .join('\n');

        // 更新並顯示 Modal
        const outputTextarea = document.getElementById('zv-metting-list-output');
        outputTextarea.value = formattedMeetings;

        // 顯示 Modal
        document.getElementById('zv-metting-list-results-modal').style.display = 'block';
    } catch (error) {
        console.error('獲取會議列表失敗:', error);
    }
});

// 綁定刷新按鈕事件
document.getElementById('meetingsearch-refresh-btn').addEventListener('click', async function() {
    const now = new Date();
    const taiwanOffset = 8 * 60;
    const localTime = new Date(now.getTime() + (taiwanOffset * 60 * 1000));
    const currentDate = localTime.toISOString().split('T')[0];
    const currentTime = localTime.toTimeString().split(' ')[0].slice(0, 5);

    // 清空搜尋框
    const filterInput = document.getElementById('meetingsearch-filter-input');
    if (filterInput) filterInput.value = '';

    // 重新撈取會議
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

function getTodayUTCTimeRange() {
    // 獲取當前時間
    const now = new Date();

    // 獲取台灣時間的當天日期字符串（YYYY-MM-DD）
    const twDateString = now.toLocaleDateString('zh-TW', { 
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).split('/').join('-');

    // 設定台灣時間當天的開始時間（00:00）和結束時間（23:59:59.999）
    const startTW = new Date(`${twDateString}T00:00:00+08:00`);
    const endTW = new Date(`${twDateString}T23:59:59.999+08:00`);

    // 轉換為 UTC ISO 字串
    const startAt = startTW.toISOString();  // 會自動轉換為 UTC
    const endAt = endTW.toISOString();      // 會自動轉換為 UTC

    return { startAt, endAt };
}

// Function to normalize date string
function normalizeDateString(dateStr) {
    // 將 2025/04/18 轉成 2025-04-18
    return dateStr.replace(/\//g, '-');
}

// Function to check if a date falls within a range
function isDateInRange(targetDate, startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) return false;
    const start = new Date(normalizeDateString(startDateStr));
    const end = new Date(normalizeDateString(endDateStr));
    const target = new Date(normalizeDateString(targetDate));
    return target >= start && target <= end;
}

// Function to get day of week in Chinese
function getDayOfWeekChinese(date) {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return days[date.getDay()];
}

// Function to compare times (HH:mm format or HHMM format)
function compareTimeStrings(time1, time2) {
    // Convert HHMM to HH:mm if needed
    const formatTime = (time) => {
        if (time.includes(':')) return time;
        return `${time.substring(0, 2)}:${time.substring(2)}`;
    };
    return formatTime(time1) === formatTime(time2);
}

// 修改時間轉換函數
function formatTaiwanTime(utcTimeString) {
    // 確保使用 UTC 時間作為基準
    const utcDate = new Date(utcTimeString);
    
    // 使用 Intl.DateTimeFormat 進行可靠的時區轉換
    const taiwanTime = new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(utcDate);

    // 獲取台灣時區的星期幾
    const weekday = new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        weekday: 'short'
    }).format(utcDate).replace('週', '').replace('星期', '');

    // 移除時間中的冒號並返回結果
    return {
        weekday,
        time: taiwanTime.replace(':', '')
    };
}

// 修改時間範圍比對函數
function isTimeOverlap(courseStart, courseEnd, sheetTimeRange, utcStartTime) {
    if (!sheetTimeRange || !sheetTimeRange.includes('-')) return false;

    // 解析 Google Sheet 的時間範圍 (格式如 "1000-1100")
    const [sheetStart, sheetEnd] = sheetTimeRange.split('-').map(t => t.trim());

    // 轉換為數字以便比較時間
    const courseStartNum = parseInt(courseStart.time);
    const courseEndNum = parseInt(courseEnd.time);
    const sheetStartNum = parseInt(sheetStart);
    const sheetEndNum = parseInt(sheetEnd);

    // 添加詳細的比對日誌
    console.log('Detailed time comparison:', {
        courseTime: {
            start: courseStartNum,
            end: courseEndNum,
            raw: `${courseStart.time}-${courseEnd.time}`
        },
        sheetTime: {
            start: sheetStartNum,
            end: sheetEndNum,
            raw: sheetTimeRange
        },
        strictComparison: {
            startMatch: courseStartNum === sheetStartNum,
            endWithinRange: courseEndNum <= sheetEndNum,
            isValid: courseStartNum === sheetStartNum && courseEndNum <= sheetEndNum
        }
    });

    // 嚴格比對：課程開始時間必須完全匹配，結束時間必須在範圍內
    return courseStartNum === sheetStartNum && courseEndNum <= sheetEndNum;
}

// 在 findMatchingSheetData 函數中添加時區檢查日誌
function findMatchingSheetData(course, sheetsData, currentDate) {
    const studentName = course.students?.[0]?.name?.toLowerCase();
    if (!studentName) return null;

    // 預先處理課程時間，確保使用台灣時間
    const courseStart = formatTaiwanTime(course.startAt);
    const courseEnd = formatTaiwanTime(course.endAt);

    console.log('Course timezone check:', {
        originalStartTime: course.startAt,
        convertedStartTime: courseStart.time,
        weekday: courseStart.weekday,
        currentDate
    });

    for (const sheet of sheetsData.valueRanges) {
        const rows = sheet.values || [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 11) continue;

            // 檢查學生姓名
            const sheetStudentName = row[0]?.trim()?.toLowerCase();
            if (!sheetStudentName || !sheetStudentName.includes(studentName)) continue;

            // 檢查日期範圍
            if (!isDateInRange(currentDate, row[1], row[7])) continue;

            // 檢查星期
            if (!row[2]?.includes(courseStart.weekday)) continue;

            // 檢查時間範圍重疊
            const sheetTimeRange = row[4];
            if (!sheetTimeRange || !isTimeOverlap(courseStart, courseEnd, sheetTimeRange, course.startAt)) continue;

            return {
                meetingLink: row[10],
                accountId: row[5],
                meetingInfo: row[6],
                gsStartTime: `${row[1] || '無開始日'}~${row[7] || '無結束日'} ${row[4] || ''} ${row[2] ? `(每週${row[2]})` : ''}`
            };
        }
    }
    return null;
}

// 擴大撈取範圍，包括 OneClass API 和 Google Sheets
async function meetingsearchFetchMeetings(currentDate, currentTime, now, filterText = '') {
    try {
        // Get DOM elements
        const errorDiv = document.getElementById('meetingsearch-error');
        const resultDiv = document.getElementById('meetingsearch-account-results');

        // 清除現有結果
        if (resultDiv) resultDiv.innerHTML = '';
        if (errorDiv) errorDiv.innerHTML = '';

        // Reset meeting arrays
        ongoingMeetings = [];
        upcomingMeetings = [];
        waitingMeetings = [];
        endedMeetings = [];

        // Get today's time range (UTC)
        const { startAt, endAt } = getTodayUTCTimeRange();
        
        // Fetch all courses and Google Sheets data in parallel
        const [processingCourses, preparingCourses, overCourses, sheetsData] = await Promise.all([
            fetchCourses('processing', startAt, endAt),
            fetchCourses('preparing', startAt, endAt),
            fetchCourses('over', startAt, endAt),
            callGoogleSheetBatchAPI({ 
                ranges: [
                    '「US版Zoom學員名單(5/15)」!A:K',
                    '「騰訊會議(長週期)」!A:K',
                    '「騰訊會議(短週期)」!A:K'
                ]
            })
        ]);

        // Combine all courses
        const allCourses = [...processingCourses, ...preparingCourses, ...overCourses];

        // Process each course
        allCourses.forEach(course => {
            const studentName = course.students?.[0]?.name;
            if (!studentName) return;

            // Convert course times to Taiwan timezone
            const startTime = new Date(course.startAt); // This is a Date object
            const endTime = new Date(course.endAt);   // This is a Date object
            const currentTimeInLoop = new Date(); // Renamed to avoid conflict with the outer scope currentTime

            // Try to find matching sheet data
            const sheetData = findMatchingSheetData(course, sheetsData, currentDate);

            // Create meeting object
            const meeting = {
                name: `${studentName} - ${course.tags.map(t => t.name).join(', ')}`,
                actualStartTime: startTime, // Store the full Date object for sorting
                startTime: new Date(startTime).toLocaleTimeString('zh-TW', { 
                    timeZone: 'Asia/Taipei',
                    hour: '2-digit', 
                    minute: '2-digit', 
                    hour12: false 
                }),
                endTime: new Date(endTime).toLocaleTimeString('zh-TW', { 
                    timeZone: 'Asia/Taipei',
                    hour: '2-digit', 
                    minute: '2-digit', 
                    hour12: false 
                }),
                info: `老師：${course.teacher.fullName}\n課程標籤：${course.tags.map(t => t.name).join(', ')}\n${sheetData?.meetingInfo || ''}`,
                type: sheetData?.accountId?.toLowerCase().startsWith('voov') ? 'voov' : 'zoom',
                link: sheetData?.meetingLink || '',
                account: sheetData?.accountId || '無對應帳號',
                gsStartTime: sheetData?.gsStartTime || '無對應資料',
                hasMeetingInfo: !!sheetData
            };

            // Classify meeting based on time
            if (currentTimeInLoop >= startTime && currentTimeInLoop < endTime) {
                ongoingMeetings.push(meeting);
            } else if (currentTimeInLoop < startTime) {
                const timeDifferenceInHours = (startTime - currentTimeInLoop) / (1000 * 60 * 60);
                if (timeDifferenceInHours <= 0.5) {
                    upcomingMeetings.push(meeting);
                } else {
                    waitingMeetings.push(meeting);
                }
            } else if (currentTimeInLoop >= endTime) {
                endedMeetings.push(meeting);
            }
        });

        // Apply filter if provided
        if (filterText) {
            const filter = (meetings) => meetings.filter(m => 
                m.name.toLowerCase().includes(filterText.toLowerCase()) || 
                m.info.toLowerCase().includes(filterText.toLowerCase())
            );
            ongoingMeetings = filter(ongoingMeetings);
            upcomingMeetings = filter(upcomingMeetings);
            waitingMeetings = filter(waitingMeetings);
            endedMeetings = filter(endedMeetings);
        }

        // Sort meetings in ascending order (earliest first)
        const sortMeetingsAsc = (a, b) => a.actualStartTime - b.actualStartTime; 
        ongoingMeetings.sort(sortMeetingsAsc);
        upcomingMeetings.sort(sortMeetingsAsc);
        waitingMeetings.sort(sortMeetingsAsc);
        endedMeetings.sort(sortMeetingsAsc);

        // 顯示結果
        resultDiv.innerHTML = '';

        // 創建顯示會議的輔助函數
        function createMeetingSection(title, meetings) {
            if (meetings.length > 0) {
                const sectionDiv = document.createElement('div');
                // 使用具體的類名而不是動態生成的
                sectionDiv.className = `meeting-section meetingsearch-${title.replace(/[()]/g, '').replace(/ /g, '-')}`;
                
                // 添加標題
                const titleElement = document.createElement('strong');
                titleElement.textContent = title;
                sectionDiv.appendChild(titleElement);
                
                // 添加會議項目
                meetings.forEach((meeting, index) => {
                    const meetingItem = createMeetingItem(
                        meeting, 
                        `meetingsearch-${title.replace(/[()]/g, '').replace(/ /g, '-')}`, 
                        index, 
                        meeting.account
                    );
                    sectionDiv.appendChild(meetingItem);
                });
                
                return sectionDiv;
            }
            return null;
        }

        // 使用輔助函數顯示各類會議
        const sections = [
            { title: '進行中', meetings: ongoingMeetings },
            { title: '即將開始 (半小時內)', meetings: upcomingMeetings },
            { title: '等待中', meetings: waitingMeetings },
            { title: '已結束', meetings: endedMeetings }
        ];

        sections.forEach(({ title, meetings }) => {
            const section = createMeetingSection(title, meetings);
            if (section) {
                resultDiv.appendChild(section);
            }
        });

        // 如果沒有任何會議
        if (resultDiv.children.length === 0) {
            // 新增判斷是否未登入
            const token = localStorage.getItem('firebase_id_token');
            if (!token) {
                resultDiv.textContent = '請先登入。';
            } else {
                resultDiv.textContent = '今日沒有會議安排。';
            }
        }

    } catch (error) {
        console.error('處理會議資料時發生錯誤:', error);
        const errorDiv = document.getElementById('meetingsearch-error');
        const resultDiv = document.getElementById('meetingsearch-account-results');
        if (errorDiv) {
            errorDiv.textContent = `請求失敗：${error.message}`;
        }
        // 清空所有會議列表和顯示區域
        ongoingMeetings = [];
        upcomingMeetings = [];
        waitingMeetings = [];
        endedMeetings = [];
        if (resultDiv) {
            // 新增判斷是否未登入
            const token = localStorage.getItem('firebase_id_token');
            if (!token) {
                resultDiv.innerHTML = '請先登入。';
            } else {
                resultDiv.innerHTML = '載入會議資料時發生錯誤';
            }
        }
    }
}

// 添加時間格式化輔助函數
function formatTimeRange(startTime, endTime) {
    return `${startTime.replace(':', '')}-${endTime.replace(':', '')}`;
}

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
    toggleButton.className = 'meeting-toggle-btn'; // 添加類名以便樣式設定

    // 改進按鈕點擊事件處理
    toggleButton.onclick = function(event) {
        event.stopPropagation();
        
        // 切換按鈕文本
        this.textContent = this.textContent === '+' ? '-' : '+';
        
        // 使用 closest 找到父元素中的 meetingsearch-info
        const infoDiv = this.closest('.meetingsearch-meeting-item').querySelector('.meetingsearch-info');
        if (infoDiv) {
            infoDiv.style.display = infoDiv.style.display === 'none' ? 'block' : 'none';
        }
    };
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

    // 格式化時間顯示
    const formattedApiTime = formatTimeRange(meeting.startTime, meeting.endTime);
    
    // 確保 meetingsearch-info div 正確設置
    const infoDiv = document.createElement('div');
    infoDiv.className = 'meetingsearch-info';
    infoDiv.id = `info-${uniqueId}`;
    infoDiv.style.display = 'none'; // 初始狀態為隱藏

    // 添加內容到 infoDiv
    infoDiv.innerHTML = `
        <div class="meeting-info-content">
            <table class="meeting-info-table">
                <tr>
                    <td>Google表單時間：</td>
                    <td>${meeting.gsStartTime || '無資料'}</td>
                </tr>
            </table>
            <div class="meeting-info-divider"></div>
            <div style="font-size: 12px; color: #666; margin-top: 8px;">
                會議資訊：
            </div>
            <div style="font-size: 12px; color: #333; margin-top: 4px; line-height: 1.4;">
                ${meeting.info.replace(/\n/g, '<br>')}
            </div>
            <div style="margin-top: 8px; font-size: 12px;" id="account-span-container-${uniqueId}">
                <!-- 帳號複製按鈕會插入這裡 -->
            </div>
        </div>
    `;
    // 插入可複製帳號元素
    const accountContainer = infoDiv.querySelector(`#account-span-container-${uniqueId}`);
    accountContainer.appendChild(createCopyableAccountElement(accountid));

    // 將 infoDiv 添加到 meetingDiv
    meetingDiv.appendChild(infoDiv);

    return meetingDiv;
}

// 創建可複製的 account 資訊元素的函數
// 創建可複製的 account 資訊元素的函數
function createCopyableAccountElement(accountid) {
    const accountSpan = document.createElement('span');
    accountSpan.textContent = accountid;
    accountSpan.className = 'meeting-now-account-span';
    accountSpan.style.cursor = 'pointer';
    accountSpan.style.color = 'gray';

    // 取得對應的 email
    const emailToCopy = ZVaccountEmailMap[accountid] || accountid;

    // 懸停變色效果
    accountSpan.addEventListener('mouseover', function() {
        accountSpan.style.color = 'blue';
    });
    accountSpan.addEventListener('mouseout', function() {
        accountSpan.style.color = 'gray';
    });

    // 點擊複製功能
    accountSpan.addEventListener('click', async function() {
        try {
            // 複製 email 而非顯示的 accountid
            await navigator.clipboard.writeText(emailToCopy);
            accountSpan.style.color = 'green';
            accountSpan.textContent = accountid + ' (已複製)';
            setTimeout(() => {
                accountSpan.style.color = 'gray';
                accountSpan.textContent = accountid;
            }, 1000);
        } catch (err) {
            accountSpan.textContent = accountid + ' (複製失敗)';
            accountSpan.style.color = 'red';
            setTimeout(() => {
                accountSpan.style.color = 'gray';
                accountSpan.textContent = accountid;
            }, 1000);
        }
    });

    return accountSpan;
}

async function fetchCourses(status, startAt, endAt) {
    const NETLIFY_SITE_URL = "https://stirring-pothos-28253d.netlify.app";
    let retryCount = 0;
    const maxRetries = 2;
    
    // Validate inputs before making the request
    if (!status || !startAt || !endAt) {
        console.warn('fetchCourses: Missing required parameters', { status, startAt, endAt });
        return []; // Return empty array if parameters are invalid
    }
    
    // 取得 Firebase token
    const token = localStorage.getItem('firebase_id_token');
    if (!token) {
        console.warn('fetchCourses: 尚未登入，無法取得 token');
        return [];
    }
    
    while (retryCount <= maxRetries) {
        try {
            const requestBody = {
                token, // <--- 加入 token
                action: 'fetchCourses',
                courseStatus: status,
                startAt: startAt,
                endAt: endAt
            };
            
            console.log(`Attempt ${retryCount + 1}: Fetching ${status} courses`, requestBody);
            
            const response = await fetch(`${NETLIFY_SITE_URL}/.netlify/functions/zoomclass`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            // Log detailed response info for debugging
            console.log(`Response status for ${status} courses:`, response.status);
            
            if (!response.ok) {
                // For 400 errors, try to get the response body for more details
                let errorDetails = '';
                try {
                    const errorBody = await response.text();
                    errorDetails = `: ${errorBody}`;
                } catch (e) { /* Ignore if can't read body */ }
                
                throw new Error(`API 請求失敗: ${response.status}${errorDetails}`);
            }

            const data = await response.json();
            const courses = data?.data?.courses || [];
            console.log(`Successfully fetched ${courses.length} ${status} courses`);
            return courses;
        } catch (error) {
            console.error(`獲取${status}課程失敗 (嘗試 ${retryCount + 1}/${maxRetries + 1}):`, error);
            
            // If we've reached max retries, return empty array instead of throwing
            if (retryCount === maxRetries) {
                console.warn(`已達到最大重試次數，返回空數組`);
                return [];
            }
            
            // Exponential backoff: wait longer between each retry
            const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            await new Promise(resolve => setTimeout(resolve, delay));
            retryCount++;
        }
    }
    
    return []; // Fallback return
}
export async function refreshMeetingPanel() {
    const now = new Date();
    const taiwanOffset = 8 * 60;
    const localTime = new Date(now.getTime() + (taiwanOffset * 60 * 1000));
    const currentDate = localTime.toISOString().split('T')[0];
    const currentTime = localTime.toTimeString().split(' ')[0].slice(0, 5);
    await meetingsearchFetchMeetings(currentDate, currentTime, localTime);
}