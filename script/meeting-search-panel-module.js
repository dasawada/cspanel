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
    
    console.log('✅ MeetingSearchPanel 已初始化');
}

// ===== 清除面板函數 (登出時呼叫) =====
export function clearMeetingSearchPanel(containerId = 'meeting-search-panel-placeholder') {
    const container = document.getElementById(containerId);
    
    // 移除所有事件監聽器
    removeAllEventListeners();
    
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