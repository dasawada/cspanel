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

  // 固定 id，讓 localStorage 能記住位置
  const panelId = options.id || 'canned-panel-main';
  const panel = document.createElement('section');
  panel.className = 'canned-panel';
  panel.id = panelId;

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

  searchInput.addEventListener('input', () => {
    clearBtn.style.display = searchInput.value ? 'block' : 'none';
  });
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    for (let key in defaultTexts) {
      panel.querySelector(`#${panelId}-${key} textarea`).value = defaultTexts[key];
    }
    apiTexts = Object.assign({}, defaultTexts);
    courseResultDiv.innerHTML = '';
  });

  // 只在真正執行搜尋時顯示 spinner
  searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      showSearchSpinner();
      doIdentifyCourse();
    }
  });

  function showSearchSpinner() {
    if (spinner) spinner.style.display = 'inline-block';
  }
  function removeSearchSpinner() {
    if (spinner) spinner.style.display = 'none';
  }

  // ===== 3.6. 查詢課程 & 家長資訊 =====
  function doIdentifyCourse() {
    showSearchSpinner(); // 確保搜尋開始時顯示 spinner
    // 1. 每次查詢前，全部重設
    ['tab1', 'tab2', 'tab3', 'tab4'].forEach(tab => {
      // 清除 warning
      const warning = panel.querySelector(`#${panelId}-${tab} .canned-panel-warning`);
      if (warning) warning.remove();
      // 清除複製搶課按鈕
      const copyBtn = panel.querySelector(`#${panelId}-${tab}-copy-preparing`);
      if (copyBtn) copyBtn.remove();
      // textarea 重設
      panel.querySelector(`#${panelId}-${tab} textarea`).value = defaultTexts[tab];
      apiTexts[tab] = defaultTexts[tab];
    });

    const inputVal = searchInput.value.trim();
    const courseId = extractCourseId(inputVal);
    if (!courseId) {
      courseResultDiv.innerHTML = '<p style="color:red;">無法解析出正確的課程ID，請確認貼上的網址格式</p>';
      removeSearchSpinner();
      return;
    }
    const NETLIFY_SITE_URL = "https://stirring-pothos-28253d.netlify.app"
    const courseApiUrl = `${NETLIFY_SITE_URL}/.netlify/functions/course-info`;
    let courseData, studentNames = '', tagNames = '', courseTime = '';
    fetch(courseApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ courseId })
    })
    .then(response => {
      if (!response.ok) throw new Error('網路請求錯誤，狀態碼：' + response.status);
      return response.json();
    })
    .then(json => {
      if (json.status !== 'success') throw new Error('API 回傳非 success: ' + JSON.stringify(json));
      courseData = json.data;
      studentNames = (courseData.students || []).map(s => s.name).join('、') || '(無資料)';
      tagNames = (courseData.tags || []).map(t => t.name).join('、') || '(無資料)';
      courseTime = formatCourseTime(courseData.startAt, courseData.endAt);
      let parentOneClubId = '';
      if (courseData.students && courseData.students.length > 0) {
        parentOneClubId = courseData.students[0].parentOneClubId || '';
      }
      if (!parentOneClubId) throw new Error('無法取得學生的 parentOneClubId');
      const parentApiUrl = `https://api.oneclass.co/staff/customers/${parentOneClubId}`;
      return fetch(parentApiUrl, { method: 'GET', headers: { 'Accept': 'application/json, text/plain, */*' } });
    })
    .then(parentRes => parentRes.json())
    .then(parentJson => {
      if (!parentJson || typeof parentJson !== 'object' || parentJson.status !== 'success') {
        courseResultDiv.innerHTML = `<p style="color:red;">家長 API 查詢失敗，請確認學生資料完整或稍後再試。</p>`;
        removeSearchSpinner();
        return;
      }
      const parentData = parentJson.data;
      const contactId = parentData && parentData.contactId;
      if (!contactId) {
        courseResultDiv.innerHTML = `<p style="color:red;">查無家長聯絡資訊，請確認學生資料。</p>`;
        removeSearchSpinner();
        return;
      }
      // 顯示家長所有 Chat 入口
      fetch(`https://stirring-pothos-28253d.netlify.app/.netlify/functions/classbxopchfetch?id=${encodeURIComponent(contactId)}`)
        .then(res => {
          if (!res.ok) throw new Error('Chat API 請求錯誤，狀態碼：' + res.status);
          return res.json();
        })
        .then(data => {
          if (!data.chats || !data.portal) throw new Error('查無任何 Chat');
          const chatCards = data.chats.map(chat => `
            <div class="card ${chat.status}" style="margin-bottom:4px;padding:4px 8px;border-radius:6px;border:1px solid #e5e7eb;cursor:pointer;background:${chat.status==='open'?'#d1fae5':'#e5e7eb'};color:${chat.status==='open'?'#065f46':'#374151'}" onclick="window.open('${data.portal}/online/?IM_DIALOG=chat${chat.id}','_blank')">
              ${chat.title.replace(/[- ]?OneClass體驗接待大廳/g, '')}
            </div>
          `).join('');
          courseResultDiv.innerHTML = `
            <div><strong>BX對話入口：</strong></div>
            <div>${chatCards}</div>
          `;
        })
        .catch(e => {
          courseResultDiv.innerHTML = `<p style="color:red;">查詢 chat 失敗：${e.message}</p>`;
        });

      // ====== 統一流程開始 ======
      const isNongXiao = tagNames.indexOf("國小自然實作探究") !== -1;
      const teacherLeave = courseData.leaveOrders && courseData.leaveOrders.some(lo => lo.role === 'teacher');

      // 先清空所有 warning、搶課按鈕
      ['tab1', 'tab2', 'tab3', 'tab4'].forEach(tab => {
        const warning = panel.querySelector(`#${panelId}-${tab} .canned-panel-warning`);
        if (warning) warning.remove();
        const copyBtn = panel.querySelector(`#${panelId}-${tab}-copy-preparing`);
        if (copyBtn) copyBtn.remove();
      });

      // 預設所有 tab 內容
      apiTexts = Object.assign({}, defaultTexts);

      // 1. 老師沒請假
      if (!teacherLeave) {
        // tab1, tab4 帶入學生資訊
        apiTexts.tab1 = `親愛的家長您好：

    學員姓名：${studentNames}
    課程時間：${courseTime}
    課程標籤：${tagNames}

    老師因故無法出席，為讓孩子的學習不間斷，
    我們已安排代課老師，感謝您的理解與支持！`;
        apiTexts.tab4 = `老師請假，請於授課提醒內完成學生狀況交接

    1、學員姓名：${studentNames}
    2、課程時間：${courseTime}
    3、https://oneclub.backstage.oneclass.com.tw/audition/course/edit/${courseId}`;

        // tab2, tab3 維持預設
        // tab2, tab3 顯示紅字「課程未請假」
        ['tab2', 'tab3'].forEach(tab => {
          panel.querySelector(`#${panelId}-${tab}`).insertAdjacentHTML('afterbegin', '<p class="canned-panel-warning">課程未請假</p>');
        });
      }
      // 2. 老師有請假
      else {
        if (isNongXiao) {
          // 國小自然實作：tab2 帶入學生資訊，其餘預設
          apiTexts.tab2 = `親愛的家長您好：

    以下課程老師因故無法授課，課程將取消，
    如需安排代課，請您聯繫輔導老師為您服務，
    謝謝您的理解與配合。

    學員姓名：${studentNames}
    課程時間：${courseTime}
    課程標籤：${tagNames}`;

          // tab1, tab4 顯示紅字「國小自然實作要順延哦」
          ['tab1', 'tab4'].forEach(tab => {
            panel.querySelector(`#${panelId}-${tab}`).insertAdjacentHTML('afterbegin', '<p class="canned-panel-warning">國小自然實作要順延哦🥑</p>');
          });
        } else {
          // 非自然實作：tab2, tab3 帶入學生資訊，tab1, tab4 預設
          apiTexts.tab2 = `親愛的家長您好：
    以下課程老師因故無法授課，課程將取消，如需安排代課，請您聯繫輔導老師為您服務，謝謝您的理解與配合。

    學員姓名：${studentNames}
    課程時間：${courseTime}
    課程標籤：${tagNames}`;
          apiTexts.tab3 = `親愛的家長您好：

    學員姓名：${studentNames}
    課程時間：${courseTime}
    課程標籤：${tagNames}

    因老師們正忙碌中，尚無師資接任課程，
    故課程將取消，後續將由輔導老師與您溝通補課事宜，謝謝您。`;

          // tab1, tab4 顯示紅字「請注意：本課程老師已請假」
          ['tab1', 'tab4'].forEach(tab => {
            panel.querySelector(`#${panelId}-${tab}`).insertAdjacentHTML('afterbegin', '<p class="canned-panel-warning">請注意：本課程老師已請假</p>');
          });

          // 查詢準備中課程，決定是否顯示搶課按鈕或「請輸入最新代課網址」紅字
          const NETLIFY_SITE_URL = "https://stirring-pothos-28253d.netlify.app";
          const courseApiUrl = `${NETLIFY_SITE_URL}/.netlify/functions/course-info`;
          const startAt = courseData.startAt;
          const endAt = courseData.endAt;
          const studentName = (courseData.students && courseData.students.length > 0) ? courseData.students[0].name : '';
          fetch(courseApiUrl, {
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
            })
          })
          .then(res => res.json())
          .then(preparingJson => {
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
              // 有課，紅字提示「請注意：本課程老師已請假，請輸入最新代課網址」
              ['tab1', 'tab4'].forEach(tab => {
                let warning = panel.querySelector(`#${panelId}-${tab} .canned-panel-warning`);
                if (warning && !warning.textContent.includes('請輸入最新代課網址')) {
                  warning.textContent = warning.textContent.trimEnd() + '，請輸入最新代課網址';
                }
              });
            }
          });
        }
      }

      // 寫入所有 tab textarea
      ['tab1', 'tab2', 'tab3', 'tab4'].forEach(tab => {
        panel.querySelector(`#${panelId}-${tab} textarea`).value = apiTexts[tab];
      });
    })
    .finally(() => {
      removeSearchSpinner(); // 不論成功或失敗都移除 spinner
    });
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
  function extractCourseId(input) {
    const match = input.match(/([0-9a-fA-F]{24})/);
    return match ? match[1] : null;
  }

  // ===== 3.7. 拖曳功能（改用 makeDraggable） =====
  const dragHandle = panel.querySelector('.canned-panel-handle');
  makeDraggable(panel, dragHandle, {
    left: options.left !== undefined ? options.left : 1300,
    top: options.top !== undefined ? options.top : 75
  });

  // ===== 3.8. 回傳面板節點 (可選) =====
  return panel;
}