import { callGoogleSheetBatchAPI } from './googleSheetAPI.js';

// ===== 模組內部變數 =====
let navEventHandlers = [];
let zvModalHandler = null;
let zvModalBgHandler = null;
let vvgglshtModalHandler = null;
let allMeetingInputHandler = null;
let allMeetingResultHandler = null;
let meetingCheckClickHandler = null;
let meetingCheckMouseoverHandler = null;
let meetingCheckMouseoutHandler = null;

// ===== 衝堂檢查器（整合版） =====
let meetingConflictInterval = null; // interval id
const CONFLICT_CHECK_INTERVAL = 15 * 60 * 1000; // 15 分鐘

function parseTime(input) {
    if (!input) return null;
    const timePattern1 = /(\d{2})(\d{2})/; // 0000
    const timePattern2 = /(\d{2}):(\d{2})/; // 00:00
    let match = input.match(timePattern1);
    if (match) return `${match[1]}:${match[2]}`;
    match = input.match(timePattern2);
    if (match) return `${match[1]}:${match[2]}`;
    return null;
}
function timeStringToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
}
function getDayOfWeek(date) {
    const dayMap = {0:'日',1:'一',2:'二',3:'三',4:'四',5:'五',6:'六'};
    return dayMap[date.getDay()];
}
function allMeetingCompareIsSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}
function dateRangesOverlap(s1,e1,s2,e2) { return (s1 <= e2) && (s2 <= e1); }
function isSameMeetingDay(m1,m2) {
    if (!dateRangesOverlap(m1.startDate, m1.endDate, m2.startDate, m2.endDate)) return false;
    const r1 = m1.repeatPattern || [], r2 = m2.repeatPattern || [];
    if (r1.length>0 && r2.length>0) return r1.some(d=>r2.includes(d));
    if (r1.length>0 && r2.length===0) return r1.includes(getDayOfWeek(m2.startDate));
    if (r1.length===0 && r2.length>0) return r2.includes(getDayOfWeek(m1.startDate));
    return allMeetingCompareIsSameDay(m1.startDate, m2.startDate);
}

async function fetchCombinedMeetingRows() {
    const ranges = ['「騰訊會議(長週期)」!A:K','「騰訊會議(短週期)」!A:K'];
    try {
        const data = await callGoogleSheetBatchAPI({ ranges });
        const longVals = data.valueRanges[0]?.values || [];
        const shortVals = data.valueRanges[1]?.values || [];
        return [...longVals, ...shortVals];
    } catch (e) {
        console.error('ConflictChecker(fetch): sheet fetch failed', e);
        return [];
    }
}

function processRowsToAccounts(rows) {
    const accountResults = {};
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 11) continue;
        const meetingName = row[0] || '';
        const startDate = row[1] ? new Date(row[1]) : null; if (startDate) startDate.setHours(0,0,0,0);
        const endDate = row[7] ? new Date(row[7]) : null; if (endDate) endDate.setHours(0,0,0,0);
        const meetingTimeRange = row[4] ? row[4].split('-') : null;
        const accountid = row[5] || '';
        const repeatPattern = row[2] ? row[2].split(',') : [];
        const meetingLink = row[10] || '';
        if (!meetingName || !startDate || !endDate || !meetingTimeRange || !accountid) continue;
        if (!accountResults[accountid]) accountResults[accountid] = { meetings: [] };
        accountResults[accountid].meetings.push({
            name: meetingName,
            startDate,
            endDate,
            timeRange: `${meetingTimeRange[0]}-${meetingTimeRange[1]}`,
            repeatPattern,
            link: meetingLink
        });
    }
    return accountResults;
}

function checkConflictsInAccount(meetings) {
    const conflicts = [];
    if (!meetings || meetings.length === 0) return conflicts;
    for (let i=0;i<meetings.length;i++){
        for (let j=i+1;j<meetings.length;j++){
            const m1 = meetings[i], m2 = meetings[j];
            if (!isSameMeetingDay(m1,m2)) continue;
            const s1 = parseTime(m1.timeRange.split('-')[0]);
            const e1 = parseTime(m1.timeRange.split('-')[1]);
            const s2 = parseTime(m2.timeRange.split('-')[0]);
            const e2 = parseTime(m2.timeRange.split('-')[1]);
            if (!s1||!e1||!s2||!e2) continue;
            const m1S = timeStringToMinutes(s1), m1E = timeStringToMinutes(e1), m2S = timeStringToMinutes(s2), m2E = timeStringToMinutes(e2);
            if (m1E > m2S && m1S < m2E) conflicts.push({meeting1:m1, meeting2:m2});
        }
    }
    return conflicts;
}

async function runConflictCheckAndUpdateUI() {
    try {
        const rows = await fetchCombinedMeetingRows();
        const accountResults = processRowsToAccounts(rows || []);
        let totalConflicts = 0;
        const conflictDetails = {};
        for (const acc in accountResults) {
            const conflicts = checkConflictsInAccount(accountResults[acc].meetings);
            if (conflicts.length>0) {
                totalConflicts += conflicts.length;
                conflictDetails[acc] = conflicts.map(c=>({m1:c.meeting1, m2:c.meeting2}));
            }
        }

        const settingsButton = document.getElementById('settings-button');
        if (settingsButton) settingsButton.style.display = totalConflicts>0 ? 'inline' : 'none';

        // populate modal if exists
        const modalResults = document.getElementById('modal-meeting-results');
        if (modalResults) {
            if (totalConflicts>0) {
                let html = '';
                for (const acc in conflictDetails) {
                    html += `<div class="account-section"><h4>${acc}</h4>`;
                    conflictDetails[acc].forEach(pair=>{
                        html += `<div class="conflict-card-container"><div class="conflict-card"><div><i class="fa fa-clock"></i> ${pair.m1.timeRange}</div><p>${pair.m1.name}<br>${pair.m1.link||''}</p></div><div class="conflict-card"><div><i class="fa fa-clock"></i> ${pair.m2.timeRange}</div><p>${pair.m2.name}<br>${pair.m2.link||''}</p></div></div>`;
                    });
                    html += `</div><hr>`;
                }
                modalResults.innerHTML = html;
            } else {
                modalResults.innerHTML = '<div style="text-align:center;margin-top:20px;"><i class="fa-regular fa-thumbs-up" style="font-size:48px;color:#4caf50"></i><p>目前還沒有</p></div>';
            }
        }

        console.log('ConflictCheck: accounts=', Object.keys(accountResults).length, 'totalConflicts=', totalConflicts);
        return { accountCount: Object.keys(accountResults).length, totalConflicts, details: conflictDetails };
    } catch (e) {
        console.error('ConflictCheck failed:', e);
        throw e;
    }
}

function startPeriodicConflictCheck() {
    if (meetingConflictInterval) return;
    // run immediately then schedule
    runConflictCheckAndUpdateUI().catch(()=>{});
    meetingConflictInterval = setInterval(()=>{
        runConflictCheckAndUpdateUI().catch(()=>{});
    }, CONFLICT_CHECK_INTERVAL);
    console.log('ConflictChecker: started periodic checks');
}
function stopPeriodicConflictCheck() {
    if (meetingConflictInterval) { clearInterval(meetingConflictInterval); meetingConflictInterval = null; console.log('ConflictChecker: stopped periodic checks'); }
}


// ===== HTML 模板 =====
const meetingSearchPanelHTML = `
<div class="meeting-search-panel-menu">
    <nav>
        <a href="#" class="active" data-target="meeting-now-search">今日會議查詢</a>
        <a href="#" data-target="meeting-check-search">
            騰訊衝堂查詢
            <span id="settings-button" class="meeting-check-create-document no-nth-child" style="cursor: pointer; display: none;" title="偵測到衝堂會議">
                <i class="fa-solid fa-triangle-exclamation conflict-warning-icon"></i>
            </span>
        </a>
        <a href="#" data-target="all-meeting-search-panel">所有會議查詢</a>
        <div class="animation start-meeting-now-search"></div>
    </nav>

    <div id="meeting-menu-content">
        <div id="meeting-now-search" class="meeting-menu-content-section active">
            <div class="meeting-now-search">
                <span id="meetingsearch-refresh-btn" style="position: absolute; top: 6; right: 0; padding: 8px 10px; cursor: pointer; font-size: 13px;">
                    <i class="fa-solid fa-arrows-rotate"></i>
                </span>
                <span id="zv-metting-list-modal-btn" style="position: absolute; top: 5; right: 22px; padding: 8px 10px; cursor: pointer; font-size: 15px;">
                    <i class="fa-solid fa-rectangle-list"></i>
                </span>
                <b>[ZOOM、騰訊] 今日會議</b>
                <div id="meetingsearchnow-form-container">
                    <div id="meetingsearch-filter-container">
                        <input type="text" id="meetingsearch-filter-input" placeholder="僅搜尋個別會議">
                    </div>
                    <div id="zv-metting-list-results-modal" style="display:none;">
                        <div id="zv-metting-list-modal-content">
                            <span id="zv-metting-list-close-btn">&times;</span>
                            <h2>MMS會議整理</h2>
                            <textarea id="zv-metting-list-output" rows="10" cols="50"></textarea>
                            <div class="zv-metting-list-btn-group">
                                <button id="zv-metting-list-copy-btn">複製結果</button>
                            </div>
                        </div>
                    </div>
                    <div class="meeting-now-result-flow">
                        <div id="meetingsearch-result"></div>
                        <div id="meetingsearch-error"></div>
                        <div id="meetingsearch-account-results"></div>
                    </div>
                </div>
            </div>
        </div>
        <div id="meeting-check-search" class="meeting-menu-content-section">
            <div class="meeting-check-search">
                <div class="all-meeting-left-top-icon">
                    <i class="fa-solid fa-pencil meeting-check-create-document" id="vvgglesht-open-btn"></i>
                    <div id="vvgglesht_modal">
                        <div id="vvgglesht_modal-content">
                            <span id="vvgglesht_close-btn">&times;</span>
                            <iframe id="vvgglesht_iframe" src="ggsheet.html"></iframe>
                        </div>
                    </div>
                    <a href="https://docs.google.com/document/d/1HF1nKpNAUBMMjcTMvA83cE52Konz-8ejIksisvY7xms/edit#heading=h.i0aa0sgk4vpg" 
                       target="_blank" 
                       title="查看「第三方視訊軟體開設方式」" 
                       class="meeting-check-create-document no-nth-child">
                        <i class="fa-solid fa-glasses"></i>
                    </a>
                </div>
                <div id="results-modal">
                    <div id="modal-content">
                        <span class="close">&times;</span>
                        <h2>現存衝突會議</h2>
                        <hr>
                        <div id="modal-meeting-results"></div>
                    </div>
                </div>
                <b>[騰訊] 衝堂查詢</b>
                <div id="meeting-check-form-container">
                    <form id="meeting-check-form">
                        <div class="meeting-check-form-group">
                            <label for="meeting-check-date">開始日期</label>
                            <input type="date" id="meeting-check-date" name="date" required>
                        </div>
                        <div class="meeting-check-form-group">
                            <label for="meeting-check-end-date">結束日期</label>
                            <input type="date" id="meeting-check-end-date" name="end-date" required>
                        </div>
                        <div class="meeting-check-form-group">
                            <label for="meeting-type">週期</label>
                            <select id="meeting-type" name="meeting-type" required>
                                <option value="長週期" selected>長週期</option>
                                <option value="短週期">短週期</option>
                            </select>
                        </div>
                        <div class="meeting-check-form-group">
                            <input type="text" id="meeting-check-start-time" name="start-time" placeholder="開始時間" required>
                        </div>
                        <div class="meeting-check-form-group">
                            <input type="text" id="meeting-check-end-time" name="end-time" placeholder="結束時間" required>
                        </div>
                        <div class="meeting-check-form-group">
                            <button type="submit" style="width: 100%;">查詢</button>
                        </div>
                    </form>
                    <div id="meeting-check-result-scrollbar">
                        <div id="meeting-check-result"></div>
                        <div id="meeting-check-error"></div>
                        <div id="meeting-check-account-results"></div>
                    </div>
                </div>
            </div>
        </div>
        <div id="all-meeting-search-panel" class="meeting-menu-content-section">
            <div class="all-meeting-search">
                <div id="all-meeting-search-container">
                    <i class="fa fa-search"></i>
                    <input type="text" id="all-meeting-search-input" placeholder="在此搜尋不限時間、所有會議">
                </div>
            </div>
            <div id="all-meeting-result-container"></div>
            <div id="all-meeting-error"></div>
        </div>
    </div>
</div>
`;

// ===== 初始化函數 (供 mediator 呼叫) =====
export function initMeetingSearchPanel(containerId = 'meeting-search-panel-placeholder') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`initMeetingSearchPanel: 找不到容器 #${containerId}`);
        return;
    }
    
    // 注入 HTML
    container.innerHTML = meetingSearchPanelHTML;
    
    // 綁定所有事件
    bindNavEvents();
    bindZvListingEvents();
    bindVvgglshtEvents();
    bindMeetingCheckAccountEvents();

    // 綁定 settings-button 行為（打開 modal 並顯示結果）
    const settingsButton = document.getElementById('settings-button');
    if (settingsButton) {
        settingsButton.addEventListener('click', async function() {
            const modal = document.getElementById('results-modal');
            modal.style.display = 'block';
            document.getElementById('modal-meeting-results').innerHTML = '';
            await runConflictCheckAndUpdateUI();
        });
    }

    // 啟動週期性檢查
    startPeriodicConflictCheck();

    console.log('✅ MeetingSearchPanel 已初始化');
}

// ===== 清除面板函數 (登出時呼叫) =====
export function clearMeetingSearchPanel(containerId = 'meeting-search-panel-placeholder') {
    const container = document.getElementById(containerId);
    
    // 移除所有事件監聽器
    removeAllEventListeners();

    // 停止衝堂檢查
    stopPeriodicConflictCheck();
    
    // 清空容器
    if (container) {
        container.innerHTML = '';
    }
    
    console.log('🧹 MeetingSearchPanel 已清除');
}

// ===== 移除所有事件監聽器 =====
function removeAllEventListeners() {
    // 移除導航事件
    navEventHandlers.forEach(({ element, handler }) => {
        element.removeEventListener('click', handler);
    });
    navEventHandlers = [];
    
    // 移除 zv-listing 事件
    const zvModal = document.getElementById('zv-metting-list-results-modal');
    if (zvModal && zvModalBgHandler) {
        zvModal.removeEventListener('click', zvModalBgHandler);
    }
    zvModalBgHandler = null;
    
    // 移除 vvgglesht 事件
    const vvModal = document.getElementById('vvgglesht_modal');
    if (vvModal && vvgglshtModalHandler) {
        vvModal.removeEventListener('click', vvgglshtModalHandler);
    }
    vvgglshtModalHandler = null;
    
    // 移除 meeting-check-account 事件
    const accountResults = document.getElementById('meeting-check-account-results');
    if (accountResults) {
        if (meetingCheckClickHandler) accountResults.removeEventListener('click', meetingCheckClickHandler);
        if (meetingCheckMouseoverHandler) accountResults.removeEventListener('mouseover', meetingCheckMouseoverHandler);
        if (meetingCheckMouseoutHandler) accountResults.removeEventListener('mouseout', meetingCheckMouseoutHandler);
    }
    meetingCheckClickHandler = null;
    meetingCheckMouseoverHandler = null;
    meetingCheckMouseoutHandler = null;
}

// ===== 綁定導航事件 =====
function bindNavEvents() {
    const navLinks = document.querySelectorAll('.meeting-search-panel-menu nav a');
    
    navLinks.forEach(item => {
        const handler = function(e) {
            e.preventDefault();
            
            document.querySelectorAll('.meeting-menu-content-section').forEach(section => {
                section.classList.remove('active');
            });
            document.querySelectorAll('.meeting-search-panel-menu nav a').forEach(link => {
                link.classList.remove('active');
            });

            const target = this.getAttribute('data-target');
            const targetSection = document.getElementById(target);
            if (targetSection) {
                targetSection.classList.add('active');
            }
            this.classList.add('active');
        };
        
        item.addEventListener('click', handler);
        navEventHandlers.push({ element: item, handler: handler });
    });
}

// ===== 綁定 zv-listing 事件 (原 zv-listing-script.js) =====
function bindZvListingEvents() {
    // 關閉 modal 按鈕
    const closeBtn = document.getElementById('zv-metting-list-close-btn');
    if (closeBtn) {
        closeBtn.onclick = function() {
            document.getElementById('zv-metting-list-results-modal').style.display = 'none';
        };
    }
    
    // 點擊背景關閉 modal
    const modal = document.getElementById('zv-metting-list-results-modal');
    if (modal) {
        zvModalBgHandler = function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
        modal.addEventListener('click', zvModalBgHandler);
    }
    
    // 複製按鈕
    const copyBtn = document.getElementById('zv-metting-list-copy-btn');
    if (copyBtn) {
        copyBtn.onclick = function() {
            const outputTextarea = document.getElementById('zv-metting-list-output');
            navigator.clipboard.writeText(outputTextarea.value).then(() => {
                copyBtn.style.backgroundColor = '#4CAF50';
                copyBtn.style.color = 'white';
                copyBtn.innerText = '已複製!';
                setTimeout(() => {
                    copyBtn.style.backgroundColor = '';
                    copyBtn.style.color = '';
                    copyBtn.innerText = '複製結果';
                }, 2000);
            }).catch(err => {
                console.error('複製失敗:', err);
            });
        };
    }
}

// ===== 綁定 vvgglesht 事件 (原 vvgglsht-listing-script.js) =====
function bindVvgglshtEvents() {
    // 開啟 modal
    const openBtn = document.getElementById('vvgglesht-open-btn');
    if (openBtn) {
        openBtn.onclick = function() {
            document.getElementById('vvgglesht_modal').style.display = 'block';
        };
    }
    
    // 關閉 modal
    const closeBtn = document.getElementById('vvgglesht_close-btn');
    if (closeBtn) {
        closeBtn.onclick = function() {
            document.getElementById('vvgglesht_modal').style.display = 'none';
        };
    }
    
    // 點擊背景關閉
    const modal = document.getElementById('vvgglesht_modal');
    if (modal) {
        vvgglshtModalHandler = function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
        modal.addEventListener('click', vvgglshtModalHandler);
    }
}

// ===== 綁定 meeting-check 帳號相關事件 (原 meeting-match-check.js 底部) =====
function bindMeetingCheckAccountEvents() {
    const accountEmailMap = {
        "Zoom 01": "oneclasszoomit01@gmail.com",
        "Zoom 02": "oneclasszoomit02@gmail.com",
        "Zoom 03": "oneclasszoomit03@gmail.com",
        "Zoom 04": "oneclasszoomit04@oneclass.tw",
        "VooV 05": "oneclassservice05@gmail.com",
        "VooV 06": "oneclassservice06@gmail.com",
        "VooV it01": "oneclassit01@gmail.com",
        "VooV 客服用": "service@oneclass.tw",
        "VooV 客服用01": "service01@oneclass.tw",
        "VooV 客服用02": "service02@oneclass.tw",
        "VooV 客服用03": "service03@oneclass.tw"
    };
    
    const accountResults = document.getElementById('meeting-check-account-results');
    if (!accountResults) return;
    
    // 點擊複製事件
    meetingCheckClickHandler = function(event) {
        const targetAccountSpan = event.target.closest('.meeting-now-account-span');
        if (targetAccountSpan) {
            const accountName = targetAccountSpan.textContent.trim();
            const email = accountEmailMap[accountName];
            if (email) {
                navigator.clipboard.writeText(email)
                    .then(function() {
                        targetAccountSpan.style.color = 'green';
                        setTimeout(function() {
                            targetAccountSpan.style.color = 'gray';
                        }, 1000);
                    })
                    .catch(function(error) {
                        console.error('複製失敗', error);
                        targetAccountSpan.style.color = 'red';
                        setTimeout(function() {
                            targetAccountSpan.style.color = 'gray';
                        }, 1000);
                    });
            }
        }
    };
    accountResults.addEventListener('click', meetingCheckClickHandler);
    
    // 懸停變色
    meetingCheckMouseoverHandler = function(event) {
        const targetAccountSpan = event.target.closest('.meeting-now-account-span');
        if (targetAccountSpan) {
            targetAccountSpan.style.color = 'blue';
        }
    };
    accountResults.addEventListener('mouseover', meetingCheckMouseoverHandler);
    
    // 移開恢復
    meetingCheckMouseoutHandler = function(event) {
        const targetAccountSpan = event.target.closest('.meeting-now-account-span');
        if (targetAccountSpan) {
            targetAccountSpan.style.color = 'gray';
        }
    };
    accountResults.addEventListener('mouseout', meetingCheckMouseoutHandler);
}