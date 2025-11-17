import { makeDraggable } from './draggable.js'; // ← 修正路徑

// ===== 1. CSS 動態插入 =====
const PANEL_CSS = `
.canned-panel {
  position: absolute;
  touch-action: none;
  user-select: none;
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1), 0 6px 20px rgba(0,0,0,0.1);
  margin: 0;
  margin-bottom: 20px;
  z-index: 1005;
  will-change: transform;
  width: 400px;
  min-width: 350px;
  font-family: Arial, sans-serif;
  color: #333;
  border: 1px solid #ccc;
}
.canned-panel-handle {
  padding: 5px 10px;
  border-radius: 10px 10px 0 0;
  text-align: left;
  font-weight: bold;
  cursor: grab;
  height: 19px;
  user-select: none;
}
.canned-panel-handle:active { cursor: grabbing; }
.canned-panel-search-bar {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
}
.canned-panel-search-bar .canned-panel-search-input {
  width: 90%;
  border: 1px solid #ccc;
  border-radius: 9999px;
  padding: 5px 30px 5px 10px;
  font-size: 13px;
  box-sizing: border-box;
  background: #fff;
  color: #333;
  transition: width 0.2s;
}
.canned-panel-clear-btn {
  position: absolute;
  right: 42px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  width: 24px;
  height: 24px;
  text-align: center;
  color: #999;
  font-size: 24px;
  display: none;
  z-index: 1004;
}
.canned-panel-clear-btn::before { content: '×'; }
.canned-panel-tab-container {
  display: flex;
  border: 1px solid #ddd;
  border-radius: 10px;
  background: #fff;
  margin-top: 10px;
}
.canned-panel-tab-menu {
  width: 70px;
  border-right: 1px solid #ddd;
  background: #f9f9f9;
  border-radius: 10px 0 0 10px;
}
.canned-panel-tab-menu ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.canned-panel-tab-menu li {
  padding: 10px 5px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
  font-size: 13px;
  TEXT-ALIGN: CENTER;
}
.canned-panel-tab-menu li.active {
  background: #e0e0e0;
  font-weight: bold;
}
.canned-panel-tab-content {
  flex: 1;
  padding: 10px;
  overflow-y: auto;
}
.canned-panel-tab-item { display: none; }
.canned-panel-tab-item.active { display: block; }
.canned-panel-tab-item textarea {
  width: 100%;
  height: 180px;
  font-size: 13px;
  padding: 10px;
  box-sizing: border-box;
  resize: vertical;
}
.canned-panel-tab-item textarea:disabled {
  background-color: #f5f5f5;
  color: #666;
  cursor: not-allowed;
}
.canned-panel-btn-group {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
  margin-top: 10px; 
  }
.canned-panel-btn-group button {
  padding: 5px 8px;
  margin-right: 10px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s ease;
}
.canned-panel-btn-group button.copied {
  background-color: #4CAF50;
  color: white;
}
.canned-panel-warning {
  color: red;
  font-weight: bold;
  margin-top: 10px;
}
.canned-panel-tab-menu li:first-child {
  border-top-left-radius: 10px;
}
.canned-panel-tab-menu li:last-child {
  border-bottom-left-radius: 10px;
}
.canned-panel-search-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #b1cbdb;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-left: 8px;
  vertical-align: middle;
}
@keyframes spin {
  0% { transform: rotate(0deg);}
  100% { transform: rotate(360deg);}
`;

function injectStyle() {
  if (!document.getElementById('canned-panel-style')) {
    const style = document.createElement('style');
    style.id = 'canned-panel-style';
    style.textContent = PANEL_CSS;
    document.head.appendChild(style);
  }
}

// ===== 2. 預設訊息內容 =====
const defaultTexts = {
  "tab1": `親愛的家長您好：

學員姓名：
課程時間：
課程標籤：

老師因故無法出席，為讓孩子的學習不間斷，
我們已安排代課老師，感謝您的理解與支持！`,
  "tab2": `親愛的家長您好：

以下課程老師因故無法授課，課程將取消，
如需安排代課，請您聯繫輔導老師為您服務，
謝謝您的理解與配合。

學員姓名：
課程時間：`,
  "tab3": `親愛的家長您好：

學員姓名：
課程時間：
課程標籤：

因老師們正忙碌中，尚無師資接任課程，
故課程將取消，後續將由輔導老師與您溝通補課事宜，謝謝您。`,
  "tab4": `老師請假，請於授課提醒內完成學生狀況交接

1、學員姓名：
2、課程時間：
3、`
};

// ===== 3. 主函數 =====
export function createCannedMessagesPanel(options = {}) {
  injectStyle();

  const panelId = options.id || 'canned-panel-main';
  const panel = document.createElement('section');
  panel.className = 'canned-panel';
  panel.id = panelId;
  panel.style.display = 'none'; // 預設隱藏，直到登入成功

  panel.innerHTML = `
    <div class="canned-panel-handle">代課罐頭生成器</div>
    <div style="padding:0px 10px 10px 10px">
      <div class="canned-panel-search-bar">
          <input type="text" class="canned-panel-search-input" placeholder="輸入課程ID" />
          <span class="canned-panel-search-spinner" id="canned-panel-search-spinner" style="display:none"></span>
          <span class="canned-panel-clear-btn"></span>
      </div>
      <div class="canned-panel-course-result"></div>
      <div class="canned-panel-tab-container">
          <div class="canned-panel-tab-menu">
          <ul>
              <li data-tab="tab1" class="active">確認搶課</li>
              <li data-tab="tab2">（順延）</li>
              <li data-tab="tab3">搶課失敗</li>
              <li data-tab="tab4">輔導通知</li>
          </ul>
          </div>
          <div class="canned-panel-tab-content">
          <div id="${panelId}-tab1" class="canned-panel-tab-item active">
              <textarea>${defaultTexts.tab1}</textarea>
              <div class="canned-panel-btn-group">
              <button data-copy="tab1">複製</button>
              <button data-restore="tab1">還原</button>
              </div>
          </div>
          <div id="${panelId}-tab2" class="canned-panel-tab-item">
              <textarea>${defaultTexts.tab2}</textarea>
              <div class="canned-panel-btn-group">
              <button data-copy="tab2">複製</button>
              <button data-restore="tab2">還原</button>
              </div>
          </div>
          <div id="${panelId}-tab3" class="canned-panel-tab-item">
              <textarea>${defaultTexts.tab3}</textarea>
              <div class="canned-panel-btn-group">
              <button data-copy="tab3">複製</button>
              <button data-restore="tab3">還原</button>
              </div>
          </div>
          <div id="${panelId}-tab4" class="canned-panel-tab-item">
              <textarea>${defaultTexts.tab4}</textarea>
              <div class="canned-panel-btn-group">
              <button data-copy="tab4">複製</button>
              <button data-restore="tab4">還原</button>
              </div>
          </div>
          </div>
      </div>
    </div>
  `;

  // 插入到指定容器或 body
  (options.container ? document.querySelector(options.container) : document.body).appendChild(panel);

  // ===== 3.2. 狀態管理 =====
  let apiTexts = Object.assign({}, defaultTexts);

  // ===== 3.3. Tab 切換 =====
  const tabMenuLis = panel.querySelectorAll('.canned-panel-tab-menu li');
  const tabItems = panel.querySelectorAll('.canned-panel-tab-item');
  tabMenuLis.forEach(li => {
    li.addEventListener('click', function() {
      tabMenuLis.forEach(item => item.classList.remove('active'));
      tabItems.forEach(item => item.classList.remove('active'));
      this.classList.add('active');
      panel.querySelector(`#${panelId}-${this.dataset.tab}`).classList.add('active');
    });
  });

  // ===== 3.4. 複製/還原功能 =====
  panel.querySelectorAll('button[data-copy]').forEach(btn => {
    btn.addEventListener('click', function() {
      const tab = btn.getAttribute('data-copy');
      const textarea = panel.querySelector(`#${panelId}-${tab} textarea`);
      textarea.removeAttribute('disabled');
      navigator.clipboard.writeText(textarea.value).then(() => {
        textarea.setAttribute('disabled', '');
        btn.classList.add('copied');
        btn.textContent = '已複製';
        setTimeout(() => {
          textarea.removeAttribute('disabled');
          btn.classList.remove('copied');
          btn.textContent = '複製';
        }, 1500);
      });
    });
  });
  panel.querySelectorAll('button[data-restore]').forEach(btn => {
    btn.addEventListener('click', function() {
      const tab = btn.getAttribute('data-restore');
      const textarea = panel.querySelector(`#${panelId}-${tab} textarea`);
      textarea.value = apiTexts[tab] || defaultTexts[tab];
    });
  });

  // ===== 3.5. 搜尋欄位功能 =====
  const searchInput = panel.querySelector('.canned-panel-search-input');
  const clearBtn = panel.querySelector('.canned-panel-clear-btn');
  const courseResultDiv = panel.querySelector('.canned-panel-course-result');
  const searchBar = panel.querySelector('.canned-panel-search-bar');
  const spinner = panel.querySelector('#canned-panel-search-spinner');

  // ===== Latest-Only 全域狀態 =====
  let pendingCount = 0;
  let latestSeq = 0;
  let activeController = null;
  let latestQuery = '';

  // 工具函數：帶重試的 fetch（專門處理 500 錯誤）
  async function fetchWithRetry(url, options, retries = 3) {
    const isInternalApi = url.includes('stirring-pothos-28253d.netlify.app');

    if (isInternalApi) {
        // 使用 TokenManager 處理內部 API
        return await tokenManager.fetchWithAuth(url, options, retries);
    }

    // 外部 API 保持原邏輯
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.status === 500) {
                if (i === retries - 1) {
                    throw new Error(`500 錯誤，重試 ${retries} 次後仍失敗`);
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                continue;
            }
            return response;
        } catch (error) {
            if (error.name === 'AbortError') throw error;
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
  }

  function showSpinnerGuard() {
    if (++pendingCount === 1 && spinner) spinner.style.display = 'inline-block';
  }

  function hideSpinnerGuard() {
    if (pendingCount > 0 && --pendingCount === 0 && spinner) spinner.style.display = 'none';
  }

  // 工具函數保持不變
  function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  function isValidCourseIdFormat(text) {
    return /[0-9a-fA-F]{24}/.test(text);
  }

  function extractCourseId(input) {
    const match = input.match(/([0-9a-fA-F]{24})/);
    return match ? match[1] : null;
  }

  function formatCourseTime(startAt, endAt) {
    let formattedStart = '(無資料)', formattedEnd = '(無資料)';
    if (startAt) {
      const date = new Date(startAt);
      formattedStart = date.toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        weekday: 'short',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      });
    }
    if (endAt) {
      const date = new Date(endAt);
      formattedEnd = date.toLocaleTimeString('zh-TW', {
        timeZone: 'Asia/Taipei',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      });
    }
    return `${formattedStart} - ${formattedEnd}`;
  }

  // 查詢入口（統一）
  function dispatchSearchIfValid() {
    const q = searchInput.value.trim();
    if (!isValidCourseIdFormat(q)) return;

    latestQuery = q;
    
    // 取消舊請求
    if (activeController) activeController.abort();
    activeController = new AbortController();

    // 升級序號
    const seq = ++latestSeq;
    const { signal } = activeController;

    showSpinnerGuard();

    // 直接調用現有的 doIdentifyCourse 邏輯，但加上中止信號
    doIdentifyCourseWithSignal(q, signal, seq)
      .then(() => {
        if (isRenderable(seq, q)) {
          activeController = null;
        }
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        if (!isRenderable(seq, q)) return;
        // 顯示錯誤
        courseResultDiv.innerHTML = `<p style="color:red;">查詢失敗：${err.message}</p>`;
      })
      .finally(() => {
        hideSpinnerGuard();
      });
  }

  // 工具：序號/查詢值雙保險
  function isRenderable(seq, q) {
    return seq === latestSeq && q === latestQuery;
  }

  // 升級版的 doIdentifyCourse（加入中止信號支援）
  async function doIdentifyCourseWithSignal(inputVal, signal, seq) {
    // 1. 每次查詢前，全部重設（保持原有邏輯）
    ['tab1', 'tab2', 'tab3', 'tab4'].forEach(tab => {
      const warning = panel.querySelector(`#${panelId}-${tab} .canned-panel-warning`);
      if (warning) warning.remove();
      const copyBtn = panel.querySelector(`#${panelId}-${tab}-copy-preparing`);
      if (copyBtn) copyBtn.remove();
      panel.querySelector(`#${panelId}-${tab} textarea`).value = defaultTexts[tab];
      apiTexts[tab] = defaultTexts[tab];
    });

    const courseId = extractCourseId(inputVal);
    if (!courseId) {
      throw new Error('無法解析出正確的課程ID，請確認貼上的網址格式');
    }

    const NETLIFY_SITE_URL = "https://stirring-pothos-28253d.netlify.app";
    const courseApiUrl = `${NETLIFY_SITE_URL}/course-info`;
    let courseData, studentNames = '', tagNames = '', courseTime = '';
    let tutorToGroupMap = {};

    // 第一個 API 請求（使用帶重試的 fetch）
    const courseResponse = await fetchWithRetry(courseApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId }),
      signal
    });

    if (!courseResponse.ok) {
      throw new Error('網路請求錯誤，狀態碼：' + courseResponse.status);
    }

    const json = await courseResponse.json();
    if (json.status !== 'success') {
      throw new Error('API 回傳非 success: ' + JSON.stringify(json));
    }

    courseData = json.data;
    tutorToGroupMap = json.tutorToGroupMap || {};
    studentNames = (courseData.students || []).map(s => s.name).join('、') || '(無資料)';
    tagNames = (courseData.tags || []).map(t => t.name).join('、') || '(無資料)';
    courseTime = formatCourseTime(courseData.startAt, courseData.endAt);

    let parentOneClubId = '';
    if (courseData.students && courseData.students.length > 0) {
      parentOneClubId = courseData.students[0].parentOneClubId || '';
    }
    if (!parentOneClubId) {
      throw new Error('無法取得學生的 parentOneClubId');
    }

    // 檢查是否仍為最新請求
    if (!isRenderable(seq, inputVal)) {
      throw new DOMException('stale request', 'AbortError');
    }

    // 第二個 API 請求（改為呼叫安全後端）
    const secureApiUrl = `${NETLIFY_SITE_URL}/.netlify/functions/order-tool-api`;

    const parentResponse = await fetchWithRetry(secureApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getParentInfo',
        parentOneClubId: parentOneClubId
      }),
      signal
    });

    if (!parentResponse.ok) {
      throw new Error('家長 API 代理錯誤: ' + parentResponse.status);
    }

    const parentJson = await parentResponse.json();
    if (!parentJson || typeof parentJson !== 'object' || parentJson.status !== 'success' || !parentJson.data) {
      throw new Error('家長 API 查詢失敗，請確認學生資料完整或稍後再試。');
    }

    const parentData = parentJson.data.data;
    const contactId = parentData && parentData.contactId;
    if (!contactId) {
      throw new Error('查無家長聯絡資訊，請確認學生資料。');
    }

    // 再次檢查是否仍為最新請求
    if (!isRenderable(seq, inputVal)) {
      throw new DOMException('stale request', 'AbortError');
    }

    // Chat API 請求（改為透過後端代理）
    try {
        const secureApiUrl = `${NETLIFY_SITE_URL}/.netlify/functions/order-tool-api`;
        
        const chatResponse = await fetchWithRetry(secureApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'getChatInfo',
                contactId: contactId
            }),
            signal
        });

        if (chatResponse.ok) {
            const chatResult = await chatResponse.json();
            if (chatResult.success && chatResult.data.chats && chatResult.data.portal) {
                const chatCards = chatResult.data.chats.map(chat => `
                    <div class="card ${chat.status}" style="margin-bottom:4px;padding:4px 8px;border-radius:6px;border:1px solid #e5e7eb;cursor:pointer;background:${chat.status==='open'?'#d1fae5':'#e5e7eb'};color:${chat.status==='open'?'#065f46':'#374151'}" onclick="window.open('${chatResult.data.portal}/online/?IM_DIALOG=chat${chat.id}','_blank')">
                        ${chat.title.replace(/[- ]?OneClass體驗接待大廳/g, '')}
                    </div>
                `).join('');
                
                courseResultDiv.innerHTML = `
                    <div><strong>BX對話入口：</strong></div>
                    <div>${chatCards}</div>
                `;
            }
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            courseResultDiv.innerHTML = `<p style="color:red;">查詢 chat 失敗：${e.message}</p>`;
        }
    }

    // 檢查是否仍為最新請求
    if (!isRenderable(seq, inputVal)) {
      throw new DOMException('stale request', 'AbortError');
    }

    // ====== 完全保留原有的課程處理邏輯 ======
    const isNongXiao = tagNames.indexOf("國小自然實作探究") !== -1;
    const teacherLeave = courseData.leaveOrders && courseData.leaveOrders.some(lo => lo.role === 'teacher');
    const isFirstCourse = courseData.name && (courseData.name.includes("首課") || courseData.name.includes("換師"));

    // 先清空所有 warning、搶課按鈕
    ['tab1', 'tab2', 'tab3', 'tab4'].forEach(tab => {
      const warning = panel.querySelector(`#${panelId}-${tab} .canned-panel-warning`);
      if (warning) warning.remove();
      const copyBtn = panel.querySelector(`#${panelId}-${tab}-copy-preparing`);
      if (copyBtn) copyBtn.remove();
    });

    // 預設所有 tab 內容
    apiTexts = Object.assign({}, defaultTexts);

    // 首課特殊處理（完全保留）
    if (teacherLeave && isFirstCourse) {
      // ... 完全保留原有的首課處理邏輯 ...
      ['tab1', 'tab2', 'tab3'].forEach(tab => {
        const tabMenuItem = panel.querySelector(`.canned-panel-tab-menu li[data-tab="${tab}"]`);
        const tabContent = panel.querySelector(`#${panelId}-${tab}`);
        if (tabMenuItem) tabMenuItem.style.display = 'none';
        if (tabContent) tabContent.classList.remove('active');
      });
      
      const tab4MenuItem = panel.querySelector('.canned-panel-tab-menu li[data-tab="tab4"]');
      const tab4Content = panel.querySelector(`#${panelId}-tab4`);
      if (tab4MenuItem) {
        tab4MenuItem.style.display = 'block';
        tab4MenuItem.classList.add('active');
      }
      if (tab4Content) tab4Content.classList.add('active');
      
      panel.querySelector(`#${panelId}-tab4`).insertAdjacentHTML('afterbegin', '<p class="canned-panel-warning" style="font-weight: bold;">此堂為首課，老師請假先不通知家長，<br>請於LINE主表登記通報🥸</p>');
      
      // 取得輔導老師名字（保留原邏輯）
      let tutorNameWithoutSurname = '';
      if (parentData.tutor && typeof parentData.tutor.name === 'string') {
        const name = parentData.tutor.name.trim();
        tutorNameWithoutSurname = name.length === 2 ? name : name.slice(1);
        tutorNameWithoutSurname = tutorNameWithoutSurname.trim();
      }

      // 取得組別（保留原邏輯）
      let groupName = '';
      if (parentData.tutor && typeof parentData.tutor.name === 'string') {
        const name = parentData.tutor.name.trim();
        let tutorNameWithoutSurname = name.length === 2 ? name : name.slice(1);
        tutorNameWithoutSurname = tutorNameWithoutSurname.trim();
        groupName = tutorToGroupMap[tutorNameWithoutSurname] || tutorToGroupMap[name] || '';
      }

      // 取得時間資訊（保留原邏輯）
      const date = new Date(courseData.startAt);
      const mmdd = `${date.getMonth() + 1}`.padStart(2, '0') + '/' + `${date.getDate()}`.padStart(2, '0');
      const startTime = date.toLocaleTimeString('zh-TW', {
        timeZone: 'Asia/Taipei',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      });
      const endTime = new Date(courseData.endAt).toLocaleTimeString('zh-Taipei', {
        timeZone: 'Asia/Taipei',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      });
      const mmddTime = `【${mmdd}】 ${startTime} - ${endTime}`;

      // 台灣時區日期
      const localDate = new Date();
      const taipeiDate = new Date(localDate.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
      const taipeiMMDD = `${String(taipeiDate.getMonth() + 1).padStart(2, '0')}/${String(taipeiDate.getDate()).padStart(2, '0')}`;

      // 首課專用格式
      apiTexts.tab4 = `行政\t\t${taipeiMMDD}\t請假與補課\t\t${studentNames}\t${mmddTime} 首課老師請假，未安排代課\thttps://oneclub.backstage.oneclass.com.tw/audition/course/edit/${courseId}\tTRUE\tTRUE\tFALSE\t老師假單`;
      panel.querySelector(`#${panelId}-tab4 textarea`).value = apiTexts.tab4;
      
      return; // 首課處理完畢，直接返回
    }

    // 恢復所有tab顯示（非首課時）
    ['tab1', 'tab2', 'tab3', 'tab4'].forEach(tab => {
      const tabMenuItem = panel.querySelector(`.canned-panel-tab-menu li[data-tab="${tab}"]`);
      if (tabMenuItem) tabMenuItem.style.display = 'block';
    });

    // 1. 老師沒請假（完全保留原邏輯）
    if (!teacherLeave) {
      apiTexts.tab1 = `親愛的家長您好：

    學員姓名：${studentNames}
    課程時間：${courseTime}
    課程標籤：${tagNames}

    老師因故無法出席，為讓孩子的學習不間斷，
    我們已安排代課老師，感謝您的理解與支持！`;

      const date = new Date(courseData.startAt);
      const mmdd = `${date.getMonth() + 1}`.padStart(2, '0') + '/' + `${date.getDate()}`.padStart(2, '0');
      const startTime = date.toLocaleTimeString('zh-TW', {
        timeZone: 'Asia/Taipei',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      });
      const endTime = new Date(courseData.endAt).toLocaleTimeString('zh-Taipei', {
        timeZone: 'Asia/Taipei',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      });
      const mmddTime = `【${mmdd}】 ${startTime} - ${endTime}`;

      let tutorNameWithoutSurname = '';
      if (parentData.tutor && typeof parentData.tutor.name === 'string') {
        const name = parentData.tutor.name.trim();
        tutorNameWithoutSurname = name.length === 2 ? name : name.slice(1);
        tutorNameWithoutSurname = tutorNameWithoutSurname.trim();
      }

      let groupName = '';
      if (parentData.tutor && typeof parentData.tutor.name === 'string') {
        const name = parentData.tutor.name.trim();
        let tutorNameWithoutSurname = name.length === 2 ? name : name.slice(1);
        tutorNameWithoutSurname = tutorNameWithoutSurname.trim();
        groupName = tutorToGroupMap[tutorNameWithoutSurname] || tutorToGroupMap[name] || '';
      }

      const localDate = new Date();
      const taipeiDate = new Date(localDate.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
      const taipeiMMDD = `${String(taipeiDate.getMonth() + 1).padStart(2, '0')}/${String(taipeiDate.getDate()).padStart(2, '0')}`;

      apiTexts.tab4 = `行政\t\t${taipeiMMDD}\t請假與補課\t\t${studentNames}\t${mmddTime} 老師請假，已排代課\thttps://oneclub.backstage.oneclass.com.tw/audition/course/edit/${courseId}\tTRUE\tTRUE\tFALSE\t老師假單`;
      panel.querySelector(`#${panelId}-tab4 textarea`).value = apiTexts.tab4;

      ['tab2', 'tab3'].forEach(tab => {
        panel.querySelector(`#${panelId}-${tab}`).insertAdjacentHTML('afterbegin', '<p class="canned-panel-warning">課程未請假</p>');
      });
    }
    // 2. 老師有請假（完全保留原邏輯）
    else {
      if (isNongXiao) {
        apiTexts.tab2 = `親愛的家長您好：

    以下課程老師因故無法授課，課程將取消，
    如需安排代課，請您聯繫輔導老師為您服務，
    謝謝您的理解與配合。

    學員姓名：${studentNames}
    課程時間：${courseTime}
    課程標籤：${tagNames}`;

        ['tab1', 'tab4'].forEach(tab => {
          panel.querySelector(`#${panelId}-${tab}`).insertAdjacentHTML('afterbegin', '<p class="canned-panel-warning">國小自然實作要順延哦🥑</p>');
        });
      } else {
        // 非自然實作（完全保留原邏輯）
        apiTexts.tab2 = `親愛的家長您好：
    以下課程老師因故無法授課，課程將取消，
    如需安排代課，請您聯繫輔導老師為您服務，
    謝謝您的理解與配合。

    學員姓名：${studentNames}
    課程時間：${courseTime}
    課程標籤：${tagNames}`;

        apiTexts.tab3 = `親愛的家長您好：

    學員姓名：${studentNames}
    課程時間：${courseTime}
    課程標籤：${tagNames}

    因老師們正忙碌中，尚無師資接任課程，
    故課程將取消，後續將由輔導老師與您溝通補課事宜，謝謝您。`;

        ['tab1', 'tab4'].forEach(tab => {
          panel.querySelector(`#${panelId}-${tab}`).insertAdjacentHTML('afterbegin', '<p class="canned-panel-warning">請注意：本課程老師已請假</p>');
        });

        // 查詢準備中課程（保留完整原邏輯，但加入 signal）
        const startAt = courseData.startAt;
        const endAt = courseData.endAt;
        const studentName = (courseData.students && courseData.students.length > 0) ? courseData.students[0].name : '';
        
        try {
          const preparingResponse = await fetchWithRetry(courseApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              checkPreparing: {
                startAt,
                endAt,
                studentName,
                courseStatus: 'preparing',
                isBelong: 'false',
                isAudition: 'false',
                haveLeaveOrder: false,
                skip: 0,
                limit: 5,
                orderBy: 'desc',
                'transferCourseType[]': [
                  'individualLiveCourse',
                  'groupLiveCourse',
                  'individualCambridge',
                  'publicLiveStreamingCourse',
                  'publicReplayStreamingCourse'
                ]
              }
            }),
            signal
          });

          const preparingJson = await preparingResponse.json();
          let preparingCourses = [];
          let total = 0;
          if (preparingJson?.data && Array.isArray(preparingJson.data.courses)) {
            preparingCourses = preparingJson.data.courses;
            total = typeof preparingJson.data.total === 'number' ? preparingJson.data.total : preparingCourses.length;
          } else if (preparingJson?.preparingCourses?.data && Array.isArray(preparingJson.preparingCourses.data.courses)) {
            preparingCourses = preparingJson.preparingCourses.data.courses;
            total = typeof preparingJson.preparingCourses.data.total === 'number' ? preparingJson.preparingCourses.data.total : preparingCourses.length;
          }

          if (preparingJson && preparingJson.status === 'success' && total === 0) {
            // 無課，顯示「複製搶課」按鈕
            ['tab1', 'tab4'].forEach(tab => {
              const warning = panel.querySelector(`#${panelId}-${tab} .canned-panel-warning`);
              if (warning && !panel.querySelector(`#${panelId}-${tab}-copy-preparing`)) {
                warning.insertAdjacentHTML('beforeend', ` <button id="${panelId}-${tab}-copy-preparing" style="margin-left:8px;padding:2px 8px;font-size:12px;cursor:pointer;">複製搶課</button>`);
                const copyBtn = panel.querySelector(`#${panelId}-${tab}-copy-preparing`);
                copyBtn.addEventListener('click', () => {
                  const url = `https://oneclub.backstage.oneclass.com.tw/audition/courseclaim/formal/copy/${courseData.id}`;
                  navigator.clipboard.writeText(url).then(() => {
                    copyBtn.textContent = '已複製';
                    copyBtn.classList.add('copied');
                    setTimeout(() => {
                      copyBtn.textContent = '複製搶課';
                      copyBtn.classList.remove('copied');
                    }, 1200);
                  });
                });
              }
            });
          } else if (preparingJson && preparingJson.status === 'success' && total > 0) {
            // 有課，紅字提示
            ['tab1', 'tab4'].forEach(tab => {
              let warning = panel.querySelector(`#${panelId}-${tab} .canned-panel-warning`);
              if (warning && !warning.textContent.includes('請輸入最新代課網址')) {
                warning.textContent = warning.textContent.trimEnd() + '，請輸入最新代課網址';
              }
            });
          }
        } catch (e) {
          if (e.name !== 'AbortError') {
            console.error('查詢準備中課程失敗:', e);
          }
        }
      }
    }

    // 寫入所有 tab textarea
    ['tab1', 'tab2', 'tab3', 'tab4'].forEach(tab => {
      panel.querySelector(`#${panelId}-${tab} textarea`).value = apiTexts[tab];
    });
  }

  // 修改原有的事件處理
  const debouncedDispatch = debounce(dispatchSearchIfValid, 300);

  // 替換原有的 input 事件處理
  searchInput.addEventListener('input', () => {
    const currentValue = searchInput.value.trim();
    clearBtn.style.display = currentValue ? 'block' : 'none';
    
    if (!currentValue) {
      // 重置面板
      latestQuery = '';
      latestSeq++;
      if (activeController) activeController.abort();
      activeController = null;
      
      for (let key in defaultTexts) {
        panel.querySelector(`#${panelId}-${key} textarea`).value = defaultTexts[key];
      }
      apiTexts = Object.assign({}, defaultTexts);
      courseResultDiv.innerHTML = '';
      hideSpinnerGuard();
      return;
    }
    
    if (isValidCourseIdFormat(currentValue)) {
      debouncedDispatch();
    }
  });

  // 替換原有的 paste 事件處理
  searchInput.addEventListener('paste', () => {
    setTimeout(() => {
      const pastedValue = searchInput.value.trim();
      clearBtn.style.display = pastedValue ? 'block' : 'none';
      
      if (pastedValue && isValidCourseIdFormat(pastedValue)) {
        debouncedDispatch.cancel?.();
        dispatchSearchIfValid();
      }
    }, 50);
  });

  // 替換原有的 keyup 事件處理
  searchInput.addEventListener('keydown', (e) => {
    if (!e.isComposing && e.key === 'Enter') {
      e.preventDefault();
      debouncedDispatch.cancel?.();
      dispatchSearchIfValid();
    }
  });

  // 替換原有的 clear 事件處理
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    latestQuery = '';
    latestSeq++;
    if (activeController) activeController.abort();
    activeController = null;
    
    for (let key in defaultTexts) {
      panel.querySelector(`#${panelId}-${key} textarea`).value = defaultTexts[key];
    }
    apiTexts = Object.assign({}, defaultTexts);
    courseResultDiv.innerHTML = '';
    
    // 清除所有警告和按鈕
    ['tab1', 'tab2', 'tab3', 'tab4'].forEach(tab => {
      const warning = panel.querySelector(`#${panelId}-${tab} .canned-panel-warning`);
      if (warning) warning.remove();
      const copyBtn = panel.querySelector(`#${panelId}-${tab}-copy-preparing`);
      if (copyBtn) copyBtn.remove();
    });
    
    hideSpinnerGuard();
  });

  // ===== 3.7. 拖曳功能（改用 makeDraggable） =====
  const dragHandle = panel.querySelector('.canned-panel-handle');
  makeDraggable(panel, dragHandle, {
    // 在此設定此面板的預設值
    left: 1300,
    top: 75,
    color: '#a2c6de', // 您也可以在這裡設定預設顏色
    // 使用展開語法，將外部傳入的 options 覆盖並擴充預設值
    // 這樣 panel_all.html 中的 left, top, disableBoundary, width, height 等設定都能生效
    ...options
  });

  // ===== 3.8. 監聽登入/登出事件 =====
  window.addEventListener('firework-login-success', () => {
    panel.style.display = 'block';
  });
  window.addEventListener('firework-logout-success', () => {
    panel.style.display = 'none';
  });

  // ===== 3.9. 回傳面板節點 =====
  return panel;
}

// 取得精簡課程資訊 (依賴既有 fetchCompleteClassInfo / formatCustomDateRange)
function shortenTutorName(name) {
  if (!name) return '(無資料)';
  const trimmed = name.trim();
  // 若為正好三個連續中文字 -> 去掉第一個，顯示後兩個
  if (/^[\u4e00-\u9fa5]{3}$/.test(trimmed)) {
    return trimmed.slice(1);
  }
  return trimmed; // 其他長度不處理
}

function simplifyCourseInfo(completeInfo) {
  if (!completeInfo || !completeInfo.rawData) {
    return null;
  }
  const courseData = completeInfo.rawData.courseData || {};
  const students = completeInfo.rawData.students || [];
  const firstStudent = students[0] || {};
  const typeLabels = {
    individualLiveCourse: "（家教）",
    individualLearningBarPlusCourse: "（學霸）",
    groupLiveCourse: "（家教團）",
    individualTutorialCenterPlusCourse: "（補教）",
    groupTutorialCenterPlusCourse: "（補教團）",
    groupLearningBarPlusCourse: "（學霸團）"
  };
  const courseTypeLabel = courseData.isAudition
    ? "（試聽）"
    : (typeLabels[courseData.type] || "（不明）");

  return {
    courseId: courseData.id || '',
    startAt: courseData.startAt || '',
    endAt: courseData.endAt || '',
    timeRange: formatCustomDateRange(courseData.startAt, courseData.endAt),
    courseType: courseTypeLabel,
    studentName: firstStudent.name || '(無資料)',
    teacherName: (courseData.teacher && courseData.teacher.fullName) || '(無資料)',
    tutorName: shortenTutorName(completeInfo.tutorName),
    tutorNameFull: completeInfo.tutorName || '(無資料)'
  };
}

async function getMinimalCourseInfo({ courseId }) {
  try {
    const full = await fetchCompleteClassInfo({ courseId });
    if (!full.success) {
      return { success: false, error: full.error || 'fetch failed' };
    }
    const simplified = simplifyCourseInfo(full.data);
    if (!simplified) {
      return { success: false, error: 'simplify failed' };
    }
    return { success: true, data: simplified };
  } catch (e) {
    console.error('getMinimalCourseInfo error:', e);
    return { success: false, error: e.message || 'unknown error' };
  }
}

// ===== 在檔案開頭新增 Token 管理工具 =====
class TokenManager {
    async getValidToken() {
        if (!window.firebase?.auth) {
            throw new Error('Firebase 未初始化');
        }
        
        const user = window.firebase.auth().currentUser;
        if (!user) {
            throw new Error('用戶未登入');
        }

        try {
            // false = 使用緩存,除非過期
            return await user.getIdToken(false);
        } catch (error) {
            console.error('Token 取得失敗,嘗試強制更新:', error);
            return await user.getIdToken(true);
        }
    }

    async fetchWithAuth(url, options = {}, retries = 3) {
        const token = await this.getValidToken();
        
        const makeRequest = async (currentToken, attempt = 0) => {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...options.headers,
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                }
            });

            // 401 錯誤且不是最後一次重試
            if (response.status === 401 && attempt < retries - 1) {
                console.log('Token 可能過期,嘗試更新...');
                const newToken = await window.firebase.auth().currentUser.getIdToken(true);
                localStorage.setItem('firebase_id_token', newToken);
                return makeRequest(newToken, attempt + 1);
            }

            // 500 錯誤重試
            if (response.status === 500 && attempt < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                return makeRequest(currentToken, attempt + 1);
            }

            return response;
        };

        return await makeRequest(token);
    }
}

const tokenManager = new TokenManager();