import { makeDraggable } from './draggable.js';

// ===== 移除 checkAuthBeforeAction 函數 =====
// 驗證已由 API 層的 TokenManager 處理，前端不需要重複檢查

// ===== 1. CSS 動態插入 =====
const PANEL_CSS = `
.canned-panel {
  /* background/border/box-shadow 一律交給 style/v2/panels.css 的統一玻璃
     規則（本 <style> 於 runtime 注入、晚於 v2 樣式表，同特異度下任何
     覆寫都會壓過統一玻璃，勿在此設定這三類屬性） */
  position: absolute;
  touch-action: none;
  user-select: none;
  border-radius: var(--radius-md);
  margin: 0;
  margin-bottom: 20px;
  will-change: transform;
  width: 400px;
  min-width: 350px;
  font-family: var(--sans);
  color: var(--fg);
}
/* 拖曳中近透明玻璃特效（還原自 main 分支 .draggable-dragging 的
   「拖曳時整體 opacity: 0.95」設計意圖；.draggable-dragging 的
   opacity/box-shadow 仍原樣保留、疊加生效，這裡是本面板專屬、於玻璃
   化改版後讓「近透明」重新變得可見的加強層。gl-dragging 由
   draggable.js 於拖曳開始/結束時附加/移除，本樣式表晚於 v2 載入，
   足以覆蓋統一玻璃規則）*/
.canned-panel.gl-dragging {
  background: rgba(255,255,255,0.15);
  backdrop-filter: blur(6px) saturate(1.2);
  -webkit-backdrop-filter: blur(6px) saturate(1.2);
  box-shadow: 0 18px 48px rgba(0,0,0,0.18);
}
.canned-panel-handle {
  /* 帶子視覺（高度/內距/透明底/hover/拖曳漸層/圓角/cursor）歸把手詞彙
     draggable-chrome.css；此處只留本面板的標題字樣式 */
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--fg-2);
}
.canned-panel-search-bar {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  /* 膠囊詞彙實例參數：input 只佔 90% 寬，尾端槽自 wrapper 右緣內縮 42px 才落在
     input 內（capsule.css 的機制唯一、參數走 token） */
  --capsule-inset: 42px;
}
.canned-panel-search-bar .canned-panel-search-input {
  width: 90%;
  border: 1px solid var(--border-2);
  border-radius: 9999px;
  padding: 5px 30px 5px 10px;
  font-size: var(--text-md);
  box-sizing: border-box;
  background: var(--elevated);
  color: var(--fg);
  transition: width 0.2s;
}
.canned-panel-clear-btn {
  /* 定位/色彩/hover 由膠囊詞彙供給（capsule.css .gl-capsule__end）；此處僅實例尺寸與顯示邏輯 */
  width: var(--icon-lg);
  height: var(--icon-lg);
  font-size: var(--text-4xl);
  display: none;
  z-index: 1004;
}
.canned-panel-clear-btn::before { content: '×'; }
.canned-panel-tab-container {
  display: flex;
  border: 1px solid var(--border-2);
  border-radius: 10px;
  background: rgba(255,255,255,0.35);
  margin-top: var(--space-5);
}
.canned-panel-tab-menu {
  width: 70px;
  border-right: 1px solid var(--border-2);
  background: var(--bg-soft);
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
  border-bottom: 1px solid var(--border);
  font-size: var(--text-md);
  text-align: center;
}
.canned-panel-tab-menu li.active {
  background: var(--accent-tint);
  color: var(--accent-hover);
  font-weight: bold;
}
.canned-panel-tab-content {
  flex: 1;
  padding: var(--space-5);
  overflow-y: auto;
}
.canned-panel-tab-item { display: none; }
.canned-panel-tab-item.active { display: block; }
.canned-panel-tab-item textarea {
  width: 100%;
  height: 180px;
  font-size: var(--text-md);
  padding: var(--space-5);
  box-sizing: border-box;
  resize: vertical;
}
.canned-panel-tab-item textarea:disabled {
  background-color: var(--bg-soft);
  color: var(--muted);
  cursor: not-allowed;
}
.canned-panel-btn-group {
  margin-top: var(--space-5);
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-5); 
  }
.canned-panel-btn-group button {
  padding: 5px 8px;
  margin-right: var(--space-5);
  font-size: var(--text-md);
  cursor: pointer;
  transition: all 0.3s ease;
}
.canned-panel-btn-group button.copied {
  background-color: var(--success);
  color: var(--elevated);
}
.canned-panel-warning {
  color: var(--danger);
  font-weight: bold;
  margin-top: var(--space-5);
}
.canned-panel-tab-menu li:first-child {
  border-top-left-radius: 10px;
}
.canned-panel-tab-menu li:last-child {
  border-bottom-left-radius: 10px;
}
.canned-panel-search-spinner {
  /* 外觀配方由膠囊詞彙供給（capsule.css .gl-capsule__spinner）；此處僅實例排版 */
  margin-left: var(--space-4);
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

// ===== 面板實例管理 =====
let cannedPanelInstance = null;

const TAB4_TOTAL_COLUMNS = 13; // A~M
const TAB4_TIMESTAMP_INDEX = 12; // Column N（貼上起點為B欄，故index 12對應N）
const TAB4_URL_PREFIX = 'https://oneclub.backstage.oneclass.com.tw/audition/course/edit/';

function pad2(value) {
  return String(value).padStart(2, '0');
}

function getLocalTimestampForSheet() {
  const now = new Date();
  return `${now.getFullYear()}/${pad2(now.getMonth() + 1)}/${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
}

function normalizeTab4SheetText(text) {
  const cols = String(text || '').split('\t');

  if (cols.length < TAB4_TOTAL_COLUMNS) {
    cols.push(...new Array(TAB4_TOTAL_COLUMNS - cols.length).fill(''));
  } else if (cols.length > TAB4_TOTAL_COLUMNS) {
    cols.length = TAB4_TOTAL_COLUMNS;
  }

  cols[TAB4_TIMESTAMP_INDEX] = getLocalTimestampForSheet();
  return cols.join('\t');
}

function buildTab4SheetText({ owner, dateText, studentNames, messageText, courseId }) {
  const cols = new Array(TAB4_TOTAL_COLUMNS).fill('');
  cols[0] = owner || '';
  cols[1] = '';
  cols[2] = dateText || '';
  cols[3] = '請假與補課';
  cols[4] = '';
  cols[5] = studentNames || '';
  cols[6] = messageText || '';
  cols[7] = `${TAB4_URL_PREFIX}${courseId}`;
  cols[8] = 'TRUE';
  cols[9] = 'TRUE';
  cols[10] = 'FALSE';
  cols[11] = '老師假單';
  cols[12] = getLocalTimestampForSheet();
  return cols.join('\t');
}

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
      <div class="canned-panel-search-bar gl-capsule">
          <input type="text" class="canned-panel-search-input" placeholder="輸入課程ID" autocomplete="off" data-form-type="other" data-lpignore="true" data-1p-ignore="true" />
          <span class="canned-panel-search-spinner gl-capsule__spinner" id="canned-panel-search-spinner" style="display:none"></span>
          <span class="canned-panel-clear-btn gl-capsule__end"></span>
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
      // 移除認證檢查 - 純 UI 操作不需要
      tabMenuLis.forEach(item => item.classList.remove('active'));
      tabItems.forEach(item => item.classList.remove('active'));
      this.classList.add('active');
      panel.querySelector(`#${panelId}-${this.dataset.tab}`).classList.add('active');
    });
  });

  // ===== 3.4. 複製/還原功能 =====
  panel.querySelectorAll('button[data-copy]').forEach(btn => {
    btn.addEventListener('click', function() {
      // 移除認證檢查 - 純本地剪貼簿操作
      const tab = btn.getAttribute('data-copy');
      const textarea = panel.querySelector(`#${panelId}-${tab} textarea`);
      textarea.removeAttribute('disabled');
      let valueToCopy = textarea.value;
      if (tab === 'tab4' && valueToCopy.includes('\t')) {
        valueToCopy = normalizeTab4SheetText(valueToCopy);
        textarea.value = valueToCopy;
        apiTexts.tab4 = valueToCopy;
      }
      navigator.clipboard.writeText(valueToCopy).then(() => {
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
      // 移除認證檢查 - 純本地還原操作
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
    const debouncedFn = function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
    debouncedFn.cancel = () => clearTimeout(timeoutId);
    return debouncedFn;
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

  // 查詢入口（統一）- 移除前端認證檢查，API 層已處理
  async function dispatchSearchIfValid() {
    // 移除 checkAuthBeforeAction - API 透過 TokenManager 處理驗證
    
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
        courseResultDiv.innerHTML = `<p style="color:var(--danger);">查詢失敗：${err.message}</p>`;
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
    const bundleApiUrl = `${NETLIFY_SITE_URL}/course-bundle`;
    let courseData, studentNames = '', tagNames = '', courseTime = '';
    let tutorToGroupMap = {};
    let preparingJson = null;

    // 單一聚合 API 請求（使用帶重試的 fetch）
    const courseResponse = await fetchWithRetry(bundleApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, checkPreparing: 'auto', includeParent: true, includeChat: true }),
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
    preparingJson = json.preparingCourses || null;
    studentNames = (courseData.students || []).map(s => s.name).join('、') || '(無資料)';
    tagNames = (courseData.tags || []).map(t => t.name).join('、') || '(無資料)';
    courseTime = formatCourseTime(courseData.startAt, courseData.endAt);

    const parentJson = json.parent;
    const parentData = parentJson?.data?.data || parentJson?.data || null;
    const contactId = parentData && parentData.contactId;
    if (!contactId) {
      throw new Error('查無家長聯絡資訊，請確認學生資料。');
    }

    // 檢查是否仍為最新請求
    if (!isRenderable(seq, inputVal)) {
      throw new DOMException('stale request', 'AbortError');
    }

    // Chat 資訊（由聚合 API 直接提供）
    try {
        const chatResult = json.chat;
        if (chatResult && chatResult.chats && chatResult.portal) {
            const chatCards = chatResult.chats.map(chat => `
                <div class="card ${chat.status}" style="margin-bottom:var(--space-2);padding:var(--space-2) var(--space-4);border-radius:6px;border:1px solid var(--border-2);cursor:pointer;background:${chat.status==='open'?'color-mix(in srgb, var(--success) 14%, white)':'var(--bg-soft)'};color:${chat.status==='open'?'var(--success)':'var(--fg-2)'}" onclick="window.open('${chatResult.portal}/online/?IM_DIALOG=chat${chat.id}','_blank')">
                    ${chat.title.replace(/[- ]?OneClass體驗接待大廳/g, '')}
                </div>
            `).join('');
            
            courseResultDiv.innerHTML = `
                <div><strong>BX對話入口：</strong></div>
                <div>${chatCards}</div>
            `;
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            courseResultDiv.innerHTML = `<p style="color:var(--danger);">查詢 chat 失敗：${e.message}</p>`;
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

    // 首課特殊處理
    if (teacherLeave && isFirstCourse) {
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

      const localDate = new Date();
      const taipeiDate = new Date(localDate.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
      const taipeiMMDD = `${String(taipeiDate.getMonth() + 1).padStart(2, '0')}/${String(taipeiDate.getDate()).padStart(2, '0')}`;

      apiTexts.tab4 = buildTab4SheetText({
        owner: tutorNameWithoutSurname,
        dateText: taipeiMMDD,
        studentNames,
        messageText: `${mmddTime} 首課老師請假，未安排代課`,
        courseId
      });
      panel.querySelector(`#${panelId}-tab4 textarea`).value = apiTexts.tab4;
      
      return;
    }

    // 恢復所有tab顯示（非首課時）
    ['tab1', 'tab2', 'tab3', 'tab4'].forEach(tab => {
      const tabMenuItem = panel.querySelector(`.canned-panel-tab-menu li[data-tab="${tab}"]`);
      if (tabMenuItem) tabMenuItem.style.display = 'block';
    });

    // 1. 老師沒請假
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

      apiTexts.tab4 = buildTab4SheetText({
        owner: '行政',
        dateText: taipeiMMDD,
        studentNames,
        messageText: `${mmddTime} 老師請假，已排代課`,
        courseId
      });
      panel.querySelector(`#${panelId}-tab4 textarea`).value = apiTexts.tab4;

      ['tab2', 'tab3'].forEach(tab => {
        panel.querySelector(`#${panelId}-${tab}`).insertAdjacentHTML('afterbegin', '<p class="canned-panel-warning">課程未請假</p>');
      });
    }
    // 2. 老師有請假
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

        const startAt = courseData.startAt;
        const endAt = courseData.endAt;
        const studentName = (courseData.students && courseData.students.length > 0) ? courseData.students[0].name : '';
        
        try {
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
            ['tab1', 'tab4'].forEach(tab => {
              const warning = panel.querySelector(`#${panelId}-${tab} .canned-panel-warning`);
              if (warning && !panel.querySelector(`#${panelId}-${tab}-copy-preparing`)) {
                warning.insertAdjacentHTML('beforeend', ` <button id="${panelId}-${tab}-copy-preparing" style="margin-left:var(--space-4);padding:var(--space-1) var(--space-4);font-size:var(--text-sm);cursor:pointer;">複製搶課</button>`);
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
  searchInput.addEventListener('input', async () => {
    const currentValue = searchInput.value.trim();
    clearBtn.style.display = currentValue ? 'flex' : 'none'; // flex＝膠囊詞彙的置中機制（capsule.css）
    
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
    setTimeout(async () => {
      const pastedValue = searchInput.value.trim();
      clearBtn.style.display = pastedValue ? 'flex' : 'none'; // flex＝膠囊詞彙的置中機制
      
      if (pastedValue && isValidCourseIdFormat(pastedValue)) {
        debouncedDispatch.cancel?.();
        dispatchSearchIfValid();
      }
    }, 50);
  });

  // 替換原有的 keyup 事件處理
  searchInput.addEventListener('keydown', async (e) => {
    if (!e.isComposing && e.key === 'Enter') {
      e.preventDefault();
      debouncedDispatch.cancel?.();
      dispatchSearchIfValid();
    }
  });

  // 替換原有的 clear 事件處理（加入認證檢查）
  clearBtn.addEventListener('click', async () => {
    // 清除操作不需要認證檢查，因為這是重置操作
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
    left: 1300,
    top: 75,
    ...options
  });

  // ===== 3.8. 不再自行監聽登入/登出事件，改由 mediator 管理 =====
  // 移除原有的事件監聽器

  // ===== 3.9. 儲存面板實例並回傳 =====
  cannedPanelInstance = panel;
  return panel;
}

// ===== 供 mediator 使用的 init/clear 函數 =====
export function initCannedMessagesPanel(containerId, options = {}) {
  // 檢查是否已存在
  if (cannedPanelInstance && document.body.contains(cannedPanelInstance)) {
    cannedPanelInstance.style.display = 'block';
    console.log('CannedMessagesPanel 已顯示 ✅');
    return cannedPanelInstance;
  }
  
  const container = containerId ? document.getElementById(containerId) : null;
  
  const panel = createCannedMessagesPanel({
    container: container ? `#${containerId}` : null,
    ...options
  });
  
  panel.style.display = 'block';
  console.log('CannedMessagesPanel 已初始化 ✅');
  return panel;
}

export function clearCannedMessagesPanel() {
  if (cannedPanelInstance) {
    // 隱藏面板
    cannedPanelInstance.style.display = 'none';
    
    // 清空搜尋欄位和結果
    const searchInput = cannedPanelInstance.querySelector('.canned-panel-search-input');
    const courseResultDiv = cannedPanelInstance.querySelector('.canned-panel-course-result');
    const clearBtn = cannedPanelInstance.querySelector('.canned-panel-clear-btn');
    
    if (searchInput) searchInput.value = '';
    if (courseResultDiv) courseResultDiv.innerHTML = '';
    if (clearBtn) clearBtn.style.display = 'none';
    
    // 重置所有 textarea 為預設值
    ['tab1', 'tab2', 'tab3', 'tab4'].forEach(tab => {
      const textarea = cannedPanelInstance.querySelector(`#canned-panel-main-${tab} textarea`);
      if (textarea) textarea.value = defaultTexts[tab];
      
      // 清除警告和按鈕
      const warning = cannedPanelInstance.querySelector(`#canned-panel-main-${tab} .canned-panel-warning`);
      if (warning) warning.remove();
      const copyBtn = cannedPanelInstance.querySelector(`#canned-panel-main-${tab}-copy-preparing`);
      if (copyBtn) copyBtn.remove();
    });
    
    console.log('CannedMessagesPanel 已清理 🧹');
  }
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

// ===== Token 管理工具 =====
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

            if (response.status === 401 && attempt < retries - 1) {
                console.log('Token 可能過期,嘗試更新...');
                const newToken = await window.firebase.auth().currentUser.getIdToken(true);
                localStorage.setItem('firebase_id_token', newToken);
                return makeRequest(newToken, attempt + 1);
            }
            if (response.status === 401 && attempt >= retries - 1) {
                window.dispatchEvent(new Event('firework-force-logout'));
            }

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
