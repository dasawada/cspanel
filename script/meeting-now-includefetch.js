import { callGoogleSheetBatchAPI } from './googleSheetAPI.js';
import { CSPANEL_API } from './cspanel-api.js';
import { ZVaccountEmailMap } from './ZVaccountEmailMap.js';

// 初始化會議分類數組
let ongoingMeetings = [];
let upcomingMeetings = [];
let waitingMeetings = [];
let endedMeetings = [];

// ===== 靜態資料快取 =====
let cachedMeetingsData = []; // 快取所有處理過的會議資料
let lastFetchTime = null; // 上次 API 呼叫時間

// ===== 模組內部變數 =====
let listModalBtnHandler = null;
let refreshBtnHandler = null;
let filterInputHandler = null;
let autoRefreshIntervalId = null; // 自動刷新計時器

// ===== 初始化函數 - 供 mediator 呼叫 =====
export async function initMeetingNowPanel() {
    // 綁定事件
    bindMeetingNowEvents();
    
    // 執行初始查詢
    await refreshMeetingPanel();
    
    // 設定自動刷新（整點、半點）
    setupAutoRefresh();
    
    console.log('MeetingNowPanel: 初始化完成 ✅');
}

// ===== 清理函數 - 供 mediator 呼叫 =====
export function clearMeetingNowPanel() {
    // 移除事件監聽器
    const listModalBtn = document.getElementById('zv-metting-list-modal-btn');
    if (listModalBtn && listModalBtnHandler) {
        listModalBtn.removeEventListener('click', listModalBtnHandler);
        listModalBtnHandler = null;
    }
    
    const refreshBtn = document.getElementById('meetingsearch-refresh-btn');
    if (refreshBtn && refreshBtnHandler) {
        refreshBtn.removeEventListener('click', refreshBtnHandler);
        refreshBtnHandler = null;
    }
    
    const filterInput = document.getElementById('meetingsearch-filter-input');
    if (filterInput && filterInputHandler) {
        filterInput.removeEventListener('input', filterInputHandler);
        filterInputHandler = null;
    }
    
    // 清除自動刷新計時器
    if (autoRefreshIntervalId) {
        clearInterval(autoRefreshIntervalId);
        autoRefreshIntervalId = null;
    }
    
    // 清空結果區域
    const resultDiv = document.getElementById('meetingsearch-result');
    const errorDiv = document.getElementById('meetingsearch-error');
    const accountResultsDiv = document.getElementById('meetingsearch-account-results');
    if (resultDiv) resultDiv.innerHTML = '';
    if (errorDiv) errorDiv.innerHTML = '';
    if (accountResultsDiv) accountResultsDiv.innerHTML = '';
    
    // 清空會議分類數組和快取
    ongoingMeetings = [];
    upcomingMeetings = [];
    waitingMeetings = [];
    endedMeetings = [];
    cachedMeetingsData = [];
    lastFetchTime = null;
    
    console.log('MeetingNowPanel: 已清理 🧹');
}

// ===== 設定自動刷新（整點、半點）=====
function setupAutoRefresh() {
    // 清除既有的計時器
    if (autoRefreshIntervalId) {
        clearInterval(autoRefreshIntervalId);
    }
    
    // 計算到下一個整點或半點的時間
    function getMillisecondsToNextHalfHour() {
        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        const milliseconds = now.getMilliseconds();
        
        let minutesToNext;
        if (minutes < 30) {
            minutesToNext = 30 - minutes;
        } else {
            minutesToNext = 60 - minutes;
        }
        
        // 計算精確的毫秒數
        return (minutesToNext * 60 * 1000) - (seconds * 1000) - milliseconds;
    }
    
    // 執行自動刷新
    async function autoRefresh() {
        console.log('⏰ 自動刷新觸發 - 整點/半點');
        await refreshMeetingPanel();
    }
    
    // 設定第一次刷新（到下一個整點或半點）
    const msToNext = getMillisecondsToNextHalfHour();
    console.log(`下次自動刷新將在 ${Math.round(msToNext / 1000 / 60)} 分鐘後`);
    
    setTimeout(() => {
        autoRefresh();
        // 之後每 30 分鐘刷新一次
        autoRefreshIntervalId = setInterval(autoRefresh, 30 * 60 * 1000);
    }, msToNext);
}

// ===== 顯示載入動畫 =====
function showLoadingIndicator() {
    const resultDiv = document.getElementById('meetingsearch-account-results');
    const errorDiv = document.getElementById('meetingsearch-error');
    
    if (errorDiv) errorDiv.innerHTML = '';
    
    if (resultDiv) {
        resultDiv.innerHTML = `
            <div class="meeting-loading-container">
                <div class="meeting-loading-spinner"></div>
                <div class="meeting-loading-text">正在載入會議資料...</div>
            </div>
        `;
    }
    
    // 添加 CSS 樣式（如果尚未添加）
    if (!document.getElementById('meeting-loading-styles')) {
        const style = document.createElement('style');
        style.id = 'meeting-loading-styles';
        style.textContent = `
            .meeting-loading-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px 20px;
                color: #666;
            }
            .meeting-loading-spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                animation: meeting-spin 1s linear infinite;
                margin-bottom: 16px;
            }
            @keyframes meeting-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .meeting-loading-text {
                font-size: 14px;
                color: #666;
            }
            .meeting-error-container {
                padding: 20px;
                background-color: #fff3f3;
                border: 1px solid #ffcdd2;
                border-radius: 8px;
                margin: 10px 0;
            }
            .meeting-error-title {
                color: #c62828;
                font-weight: bold;
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .meeting-error-message {
                color: #666;
                font-size: 13px;
                line-height: 1.5;
            }
            .meeting-error-retry {
                margin-top: 12px;
            }
            .meeting-error-retry button {
                background-color: #1976d2;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
            }
            .meeting-error-retry button:hover {
                background-color: #1565c0;
            }
            .meeting-last-update {
                font-size: 11px;
                color: #999;
                text-align: right;
                padding: 4px 8px;
                margin-bottom: 8px;
            }
        `;
        document.head.appendChild(style);
    }
}

// ===== 顯示錯誤訊息 =====
function showErrorMessage(errorType, errorDetails = '') {
    const resultDiv = document.getElementById('meetingsearch-account-results');
    
    let errorTitle = '載入失敗';
    let errorMessage = '';
    
    switch (errorType) {
        case 'NOT_LOGGED_IN':
            errorTitle = '⚠️ 尚未登入';
            errorMessage = '請先登入以查看會議資料。';
            break;
        case 'NETWORK_ERROR':
            errorTitle = '🌐 網路連線異常';
            errorMessage = `無法連接到伺服器，請檢查您的網路連線。<br><small>錯誤詳情：${errorDetails}</small>`;
            break;
        case 'API_ERROR':
            errorTitle = '⚠️ API 請求失敗';
            errorMessage = `伺服器回應異常，請稍後再試。<br><small>錯誤詳情：${errorDetails}</small>`;
            break;
        case 'TIMEOUT':
            errorTitle = '⏱️ 請求逾時';
            errorMessage = '伺服器回應時間過長，請檢查網路狀態或稍後再試。';
            break;
        case 'GOOGLE_SHEET_ERROR':
            errorTitle = '📊 Google Sheets 連線異常';
            errorMessage = `無法取得 Google Sheets 資料。<br><small>錯誤詳情：${errorDetails}</small>`;
            break;
        default:
            errorTitle = '❌ 發生未知錯誤';
            errorMessage = `請重新整理頁面或聯繫技術支援。<br><small>錯誤詳情：${errorDetails}</small>`;
    }
    
    if (resultDiv) {
        resultDiv.innerHTML = `
            <div class="meeting-error-container">
                <div class="meeting-error-title">${errorTitle}</div>
                <div class="meeting-error-message">${errorMessage}</div>
                <div class="meeting-error-retry">
                    <button onclick="window.dispatchEvent(new CustomEvent('meeting-retry-fetch'))">
                        重新載入
                    </button>
                </div>
            </div>
        `;
    }
    
    // 監聽重試事件
    window.addEventListener('meeting-retry-fetch', async function retryHandler() {
        window.removeEventListener('meeting-retry-fetch', retryHandler);
        await refreshMeetingPanel();
    }, { once: true });
}

// ===== 綁定事件 =====
function bindMeetingNowEvents() {
    // 清單圖示按鈕事件
    const listModalBtn = document.getElementById('zv-metting-list-modal-btn');
    if (listModalBtn) {
        listModalBtnHandler = async function() {
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
                    .filter(Boolean)
                    .sort()
                    .join('\n');

                // 更新並顯示 Modal
                const outputTextarea = document.getElementById('zv-metting-list-output');
                if (outputTextarea) outputTextarea.value = formattedMeetings;

                // 顯示 Modal
                const modal = document.getElementById('zv-metting-list-results-modal');
                if (modal) modal.style.display = 'block';
            } catch (error) {
                console.error('獲取會議列表失敗:', error);
            }
        };
        listModalBtn.addEventListener('click', listModalBtnHandler);
    }

    // 刷新按鈕事件 - 重新打 API
    const refreshBtn = document.getElementById('meetingsearch-refresh-btn');
    if (refreshBtn) {
        refreshBtnHandler = async function() {
            // 清空搜尋框
            const filterInput = document.getElementById('meetingsearch-filter-input');
            if (filterInput) filterInput.value = '';

            // 重新撈取會議（打 API）
            await refreshMeetingPanel();
        };
        refreshBtn.addEventListener('click', refreshBtnHandler);
    }

    // 自動監聯輸入框 - 只對靜態資料篩選，不打 API
    const filterInput = document.getElementById('meetingsearch-filter-input');
    if (filterInput) {
        filterInputHandler = function() {
            const filterText = this.value.toLowerCase().trim();
            // 使用快取資料進行篩選，不重新打 API
            filterAndDisplayMeetings(filterText);
        };
        filterInput.addEventListener('input', filterInputHandler);
    }
}

// ===== 對快取資料進行篩選並顯示 =====
function filterAndDisplayMeetings(filterText = '') {
    const resultDiv = document.getElementById('meetingsearch-account-results');
    if (!resultDiv) return;
    
    // 清空分類陣列
    ongoingMeetings = [];
    upcomingMeetings = [];
    waitingMeetings = [];
    endedMeetings = [];
    
    const currentTime = new Date();
    
    // 從快取資料重新分類
    cachedMeetingsData.forEach(meeting => {
        // 如果有篩選文字，檢查是否匹配
        if (filterText) {
            const matchName = meeting.name.toLowerCase().includes(filterText);
            const matchInfo = meeting.info.toLowerCase().includes(filterText);
            const matchAccount = meeting.account.toLowerCase().includes(filterText);
            if (!matchName && !matchInfo && !matchAccount) {
                return; // 不匹配，跳過
            }
        }
        
        const startTime = meeting.actualStartTime;
        const endTime = meeting.actualEndTime;
        
        // 根據當前時間重新分類
        if (currentTime >= startTime && currentTime < endTime) {
            ongoingMeetings.push(meeting);
        } else if (currentTime < startTime) {
            const timeDifferenceInHours = (startTime - currentTime) / (1000 * 60 * 60);
            if (timeDifferenceInHours <= 0.5) {
                upcomingMeetings.push(meeting);
            } else {
                waitingMeetings.push(meeting);
            }
        } else if (currentTime >= endTime) {
            endedMeetings.push(meeting);
        }
    });
    
    // 排序
    const sortMeetingsAsc = (a, b) => a.actualStartTime - b.actualStartTime;
    ongoingMeetings.sort(sortMeetingsAsc);
    upcomingMeetings.sort(sortMeetingsAsc);
    waitingMeetings.sort(sortMeetingsAsc);
    endedMeetings.sort(sortMeetingsAsc);
    
    // 顯示結果
    displayMeetingResults(resultDiv);
}

// ===== 顯示會議結果 =====
function displayMeetingResults(resultDiv) {
    resultDiv.innerHTML = '';
    
    // 顯示上次更新時間
    if (lastFetchTime) {
        const updateTimeDiv = document.createElement('div');
        updateTimeDiv.className = 'meeting-last-update';
        updateTimeDiv.textContent = `上次更新：${lastFetchTime.toLocaleTimeString('zh-TW', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        })}`;
        resultDiv.appendChild(updateTimeDiv);
    }
    
    // 創建顯示會議的輔助函數
    function createMeetingSection(title, meetings) {
        if (meetings.length > 0) {
            const sectionDiv = document.createElement('div');
            sectionDiv.className = `meeting-section meetingsearch-${title.replace(/[()]/g, '').replace(/ /g, '-')}`;
            
            const titleElement = document.createElement('strong');
            titleElement.textContent = title;
            sectionDiv.appendChild(titleElement);
            
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
    if (ongoingMeetings.length === 0 && 
        upcomingMeetings.length === 0 && 
        waitingMeetings.length === 0 && 
        endedMeetings.length === 0) {
        
        const filterInput = document.getElementById('meetingsearch-filter-input');
        const hasFilter = filterInput && filterInput.value.trim();
        
        if (hasFilter) {
            resultDiv.innerHTML += '<div style="padding: 20px; color: #666;">沒有符合搜尋條件的會議。</div>';
        } else {
            const token = localStorage.getItem('firebase_id_token');
            if (!token) {
                resultDiv.innerHTML += '<div style="padding: 20px; color: #666;">請先登入。</div>';
            } else {
                resultDiv.innerHTML += '<div style="padding: 20px; color: #666;">今日沒有會議安排。</div>';
            }
        }
    }
}

// 更新時間解析函數，加入更嚴格的驗證
function parseTime(input, currentDate) {
    if (!input || typeof input !== 'string') {
        return null;
    }

    input = input.replace(/\s+/g, '');

    const timePattern1 = /^(\d{2})(\d{2})$/;
    const timePattern2 = /^(\d{2}):(\d{2})$/;

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

    const hoursNum = parseInt(hours, 10);
    const minutesNum = parseInt(minutes, 10);

    if (hoursNum < 0 || hoursNum > 23 || minutesNum < 0 || minutesNum > 59) {
        return null;
    }

    hours = hours.padStart(2, '0');
    minutes = minutes.padStart(2, '0');

    const dateTimeString = `${currentDate}T${hours}:${minutes}:00`;
    const dateObj = new Date(dateTimeString);

    if (isNaN(dateObj.getTime())) {
        return null;
    }

    return {
        original: input,
        formatted: `${hours}:${minutes}`,
        date: dateObj
    };
}

function handleMeetingData(row) {
    const timeData = row[4];
    const timeAsString = String(timeData);
    const parsedTime = parseTime(timeAsString);
    console.log(parsedTime);
}

function getTodayUTCTimeRange() {
    const now = new Date();

    const twDateString = now.toLocaleDateString('zh-TW', { 
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).split('/').join('-');

    const startTW = new Date(`${twDateString}T00:00:00+08:00`);
    const endTW = new Date(`${twDateString}T23:59:59.999+08:00`);

    const startAt = startTW.toISOString();
    const endAt = endTW.toISOString();

    return { startAt, endAt };
}

function normalizeDateString(dateStr) {
    return dateStr.replace(/\//g, '-');
}

function isDateInRange(targetDate, startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) return false;
    const start = new Date(normalizeDateString(startDateStr));
    const end = new Date(normalizeDateString(endDateStr));
    const target = new Date(normalizeDateString(targetDate));
    return target >= start && target <= end;
}

function getDayOfWeekChinese(date) {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return days[date.getDay()];
}

function compareTimeStrings(time1, time2) {
    const formatTime = (time) => {
        if (time.includes(':')) return time;
        return `${time.substring(0, 2)}:${time.substring(2)}`;
    };
    return formatTime(time1) === formatTime(time2);
}

function formatTaiwanTime(utcTimeString) {
    const utcDate = new Date(utcTimeString);
    
    const taiwanTime = new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(utcDate);

    const weekday = new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        weekday: 'short'
    }).format(utcDate).replace('週', '').replace('星期', '');

    return {
        weekday,
        time: taiwanTime.replace(':', '')
    };
}

function isTimeOverlap(courseStart, courseEnd, sheetTimeRange, utcStartTime) {
    if (!sheetTimeRange || !sheetTimeRange.includes('-')) return false;

    const [sheetStart, sheetEnd] = sheetTimeRange.split('-').map(t => t.trim());

    const courseStartNum = parseInt(courseStart.time);
    const courseEndNum = parseInt(courseEnd.time);
    const sheetStartNum = parseInt(sheetStart);
    const sheetEndNum = parseInt(sheetEnd);

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

    return courseStartNum === sheetStartNum && courseEndNum <= sheetEndNum;
}

function findMatchingSheetData(course, sheetsData, currentDate) {
    const studentName = course.students?.[0]?.name?.toLowerCase();
    if (!studentName) return null;

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

            const sheetStudentName = row[0]?.trim()?.toLowerCase();
            if (!sheetStudentName || !sheetStudentName.includes(studentName)) continue;

            if (!isDateInRange(currentDate, row[1], row[7])) continue;

            if (!row[2]?.includes(courseStart.weekday)) continue;

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
    const errorDiv = document.getElementById('meetingsearch-error');
    const resultDiv = document.getElementById('meetingsearch-account-results');
    
    try {
        // 顯示載入動畫
        showLoadingIndicator();

        // 清除錯誤訊息
        if (errorDiv) errorDiv.innerHTML = '';

        // Reset meeting arrays
        ongoingMeetings = [];
        upcomingMeetings = [];
        waitingMeetings = [];
        endedMeetings = [];
        cachedMeetingsData = []; // 清空快取

        // 檢查登入狀態
        const token = localStorage.getItem('firebase_id_token');
        if (!token) {
            showErrorMessage('NOT_LOGGED_IN');
            return;
        }

        // Get today's time range (UTC)
        const { startAt, endAt } = getTodayUTCTimeRange();
        
        // Fetch all courses and Google Sheets data in parallel
        let processingCourses, preparingCourses, overCourses, sheetsData;
        
        try {
            [processingCourses, preparingCourses, overCourses, sheetsData] = await Promise.all([
                fetchCourses('processing', startAt, endAt),
                fetchCourses('preparing', startAt, endAt),
                fetchCourses('over', startAt, endAt),
                callGoogleSheetBatchAPI({ 
                    ranges: [
                        '「US版Zoom學員名單(5/15)」!A:K',
                        '「騰訊會議(長週期)」!A:K',
                        '「騰訊會議(短週期)」!A:K'
                    ]
                }).catch(err => {
                    console.error('Google Sheets API 錯誤:', err);
                    throw { type: 'GOOGLE_SHEET_ERROR', message: err.message };
                })
            ]);
        } catch (fetchError) {
            if (fetchError.type === 'GOOGLE_SHEET_ERROR') {
                showErrorMessage('GOOGLE_SHEET_ERROR', fetchError.message);
            } else if (fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('NetworkError')) {
                showErrorMessage('NETWORK_ERROR', fetchError.message);
            } else {
                showErrorMessage('API_ERROR', fetchError.message);
            }
            return;
        }

        // Combine all courses
        const allCourses = [...processingCourses, ...preparingCourses, ...overCourses];

        // 更新上次撈取時間
        lastFetchTime = new Date();

        // Process each course and store in cache
        allCourses.forEach(course => {
            const studentName = course.students?.[0]?.name;
            if (!studentName) return;

            const startTime = new Date(course.startAt);
            const endTime = new Date(course.endAt);
            const currentTimeInLoop = new Date();

            const sheetData = findMatchingSheetData(course, sheetsData, currentDate);

            const meeting = {
                name: `${studentName} - ${course.tags.map(t => t.name).join(', ')}`,
                actualStartTime: startTime,
                actualEndTime: endTime, // 新增：儲存結束時間用於篩選
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

            // 存入快取
            cachedMeetingsData.push(meeting);

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

        // Apply filter if provided (for initial load with filter)
        if (filterText) {
            const filter = (meetings) => meetings.filter(m => 
                m.name.toLowerCase().includes(filterText.toLowerCase()) || 
                m.info.toLowerCase().includes(filterText.toLowerCase()) ||
                m.account.toLowerCase().includes(filterText.toLowerCase())
            );
            ongoingMeetings = filter(ongoingMeetings);
            upcomingMeetings = filter(upcomingMeetings);
            waitingMeetings = filter(waitingMeetings);
            endedMeetings = filter(endedMeetings);
        }

        // Sort meetings in ascending order
        const sortMeetingsAsc = (a, b) => a.actualStartTime - b.actualStartTime; 
        ongoingMeetings.sort(sortMeetingsAsc);
        upcomingMeetings.sort(sortMeetingsAsc);
        waitingMeetings.sort(sortMeetingsAsc);
        endedMeetings.sort(sortMeetingsAsc);

        // 顯示結果
        displayMeetingResults(resultDiv);

    } catch (error) {
        console.error('處理會議資料時發生錯誤:', error);
        
        // 判斷錯誤類型
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
            showErrorMessage('NETWORK_ERROR', error.message);
        } else if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
            showErrorMessage('TIMEOUT', error.message);
        } else {
            showErrorMessage('UNKNOWN', error.message);
        }
        
        // 清空所有會議列表
        ongoingMeetings = [];
        upcomingMeetings = [];
        waitingMeetings = [];
        endedMeetings = [];
        cachedMeetingsData = [];
    }
}

function formatTimeRange(startTime, endTime) {
    return `${startTime.replace(':', '')}-${endTime.replace(':', '')}`;
}

function createMeetingItem(meeting, className, index, accountid) {
    const meetingDiv = document.createElement('div');
    const uniqueId = `meeting-${className}-${index}`;
    meetingDiv.className = `meetingsearch-meeting-item ${className}`;
    meetingDiv.id = uniqueId;

    const meetingRowDiv = document.createElement('div');
    meetingRowDiv.className = 'meeting-now-row';

    const toggleButtonDiv = document.createElement('div');    
    toggleButtonDiv.className = 'meeting-now-div1';
    const toggleButton = document.createElement('button');
    toggleButton.textContent = '+';
    toggleButton.style.marginRight = '10px';
    toggleButton.className = 'meeting-toggle-btn';

    toggleButton.onclick = function(event) {
        event.stopPropagation();
        
        this.textContent = this.textContent === '+' ? '-' : '+';
        
        const infoDiv = this.closest('.meetingsearch-meeting-item').querySelector('.meetingsearch-info');
        if (infoDiv) {
            infoDiv.style.display = infoDiv.style.display === 'none' ? 'block' : 'none';
        }
    };
    toggleButtonDiv.appendChild(toggleButton);

    const meetingContentDiv = document.createElement('div');
    meetingContentDiv.className = 'meeting-now-div2';
    const meetingContent = document.createElement('span');
    meetingContent.innerHTML = `${meeting.name}（${meeting.startTime}~${meeting.endTime}）`;
    meetingContentDiv.appendChild(meetingContent);

    const iconLinkDiv = document.createElement('div');
    iconLinkDiv.className = 'meeting-now-div3';
    const accountIdPrefix = accountid.slice(0, 4).toLowerCase();
    let meetingType = '';

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
    iconImg.className = 'meeting-icon';
    iconLink.appendChild(iconImg);
    iconLinkDiv.appendChild(iconLink);

    meetingRowDiv.appendChild(toggleButtonDiv);
    meetingRowDiv.appendChild(meetingContentDiv);
    meetingRowDiv.appendChild(iconLinkDiv);

    meetingDiv.appendChild(meetingRowDiv);

    const formattedApiTime = formatTimeRange(meeting.startTime, meeting.endTime);
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'meetingsearch-info';
    infoDiv.id = `info-${uniqueId}`;
    infoDiv.style.display = 'none';

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
            </div>
        </div>
    `;
    const accountContainer = infoDiv.querySelector(`#account-span-container-${uniqueId}`);
    accountContainer.appendChild(createCopyableAccountElement(accountid));

    meetingDiv.appendChild(infoDiv);

    return meetingDiv;
}

function createCopyableAccountElement(accountid) {
    const accountSpan = document.createElement('span');
    accountSpan.textContent = accountid;
    accountSpan.className = 'meeting-now-account-span';
    accountSpan.style.cursor = 'pointer';
    accountSpan.style.color = 'gray';

    const emailToCopy = ZVaccountEmailMap[accountid] || accountid;

    accountSpan.addEventListener('mouseover', function() {
        accountSpan.style.color = 'blue';
    });
    accountSpan.addEventListener('mouseout', function() {
        accountSpan.style.color = 'gray';
    });

    accountSpan.addEventListener('click', async function() {
        try {
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
    let retryCount = 0;
    const maxRetries = 2;
    
    if (!status || !startAt || !endAt) {
        console.warn('fetchCourses: Missing required parameters', { status, startAt, endAt });
        return [];
    }
    
    // 優先刷新 Firebase Token，避免過期導致 401
    let token = localStorage.getItem('firebase_id_token');
    try {
        const user = window.firebase?.auth?.currentUser;
        if (user) {
            token = await user.getIdToken(true); // 強制刷新
            localStorage.setItem('firebase_id_token', token);
        }
    } catch (e) {
        console.warn('fetchCourses: 無法刷新 token，改用 localStorage', e);
    }

    if (!token) {
        console.warn('fetchCourses: 尚未登入，無法取得 token');
        throw new Error('NO_TOKEN');
    }
    
    while (retryCount <= maxRetries) {
        try {
            const requestBody = {
                action: 'fetchCourses',
                courseStatus: status,
                startAt: startAt,
                endAt: endAt,
                // 兼容後端 body.token 解析（以防某些環境過濾 Authorization header）
                token
            };
            
            console.log(`Attempt ${retryCount + 1}: Fetching ${status} courses`, requestBody);
            
            // 添加 timeout 控制
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 秒超時
            
            const response = await fetch(CSPANEL_API.orderTool, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            console.log(`Response status for ${status} courses:`, response.status);
            
            if (!response.ok) {
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
            // 檢查是否為超時錯誤
            if (error.name === 'AbortError') {
                console.error(`獲取${status}課程超時 (嘗試 ${retryCount + 1}/${maxRetries + 1})`);
                throw new Error('請求逾時，請檢查網路連線');
            }
            
            console.error(`獲取${status}課程失敗 (嘗試 ${retryCount + 1}/${maxRetries + 1}):`, error);
            
            if (retryCount === maxRetries) {
                console.warn(`已達到最大重試次數，返回空數組`);
                return [];
            }
            
            const delay = Math.pow(2, retryCount) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            retryCount++;
        }
    }
    
    return [];
}

export async function refreshMeetingPanel() {
    const now = new Date();
    const taiwanOffset = 8 * 60;
    const localTime = new Date(now.getTime() + (taiwanOffset * 60 * 1000));
    const currentDate = localTime.toISOString().split('T')[0];
    const currentTime = localTime.toTimeString().split(' ')[0].slice(0, 5);
    await meetingsearchFetchMeetings(currentDate, currentTime, localTime);
}
