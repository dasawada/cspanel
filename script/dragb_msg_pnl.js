(function(global) {
  // ===== 1. CSS 動態插入 =====
  const PANEL_CSS = `
.canned-panel-draggable {
  position: absolute;
  touch-action: none;
  user-select: none;
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1), 0 6px 20px rgba(0,0,0,0.1);
  margin: 0; /* 取消 section 預設 margin，避免偏移 */
  margin-bottom: 20px;
  z-index: 1005;
  will-change: transform;
  width: 400px;
  min-width: 350px;
  font-family: Arial, sans-serif;
  color: #333;
  border: 1px solid #ccc;
}
.canned-panel-drag-handle {
  padding: 5px 10px;
  border-radius: 10px 10px 0 0;
  text-align: left;
  font-weight: bold;
  cursor: grab;
  height: 19px;
  user-select: none;
}
.canned-panel-drag-handle:active { cursor: grabbing; }
.canned-panel-dragging {
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  opacity: 0.95;
  cursor: grabbing;
}
.canned-panel-dragging .canned-panel-drag-handle {
  background: linear-gradient(
    180deg,
    #f0f0f0 0%,   /* top highlight */
    #d6d6d6 40%,  /* mid shade */
    #ffffff 100%  /* bottom soft light */
  );
 box-shadow:
    inset 0 1px 3px rgba(255, 255, 255, 0.8);   /* top inner glow */
  cursor: grabbing;
}
.canned-panel-search-bar {
  position: relative;
  width: 100%;
  max-width: 480px;
}
.canned-panel-search-bar .canned-panel-search-input {
  width: 100%;
  border: 1px solid #ccc;
  border-radius: 9999px;
  padding: 5px 15px 5px 15px;
  font-size: 13px;
  box-sizing: border-box;
  background: #fff;
  color: #333;
}
.canned-panel-clear-btn {
  position: absolute;
  right: 5px;
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
  width: 80px;
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
  padding: 10px 10px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
  font-size: 13px;
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
  function createCannedMessagesPanel(options = {}) {
    injectStyle();

    // 產生唯一ID，避免多個面板衝突
    const panelId = 'canned-panel-' + Math.random().toString(36).slice(2, 10);

    // ===== 3.1. 建立 HTML 結構 =====
    const panel = document.createElement('section');
    panel.className = 'canned-panel-draggable';
    panel.id = panelId;

    panel.innerHTML = `
      <div class="canned-panel-drag-handle">代課罐頭生成器</div>
      <div style="padding:0px 10px 10px 10px">
        <div class="canned-panel-search-bar">
            <input type="text" class="canned-panel-search-input" placeholder="輸入課程ID" />
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
    searchInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') doIdentifyCourse();
    });

    // ===== 3.6. 查詢課程 & 家長資訊 =====
    function doIdentifyCourse() {
      const inputVal = searchInput.value.trim();
      const courseId = extractCourseId(inputVal);
      if (!courseId) {
        courseResultDiv.innerHTML = '<p style="color:red;">無法解析出正確的課程ID，請確認貼上的網址格式</p>';
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
      .then(response => {
        if (!response.ok) throw new Error('家長 API 請求錯誤，狀態碼：' + response.status);
        return response.json();
      })
      .then(parentJson => {
        if (parentJson.status !== 'success') throw new Error('家長 API 回傳非 success: ' + JSON.stringify(parentJson));
        const parentData = parentJson.data;
        const contactId = parentData.contactId;
        if (!contactId) throw new Error('無法取得家長的 contactId');
        const bitrixUrl = `https://oneclass.bitrix24.com/crm/contact/details/${contactId}/`;
        const isNongXiao = tagNames.indexOf("國小自然實作探究") !== -1;
        // 更新 tab2
        apiTexts["tab2"] = `親愛的家長您好：

    以下課程老師因故無法授課，課程將取消，
    如需安排代課，請您聯繫輔導老師為您服務，
    謝謝您的理解與配合。

    學員姓名：${studentNames}
    課程時間：${courseTime}
    課程標籤：${tagNames}`;
        panel.querySelector(`#${panelId}-tab2 textarea`).value = apiTexts["tab2"];
        // 顯示家長 Bitrix 連結與警示
        let warningMsg = '';
        if (isNongXiao) warningMsg = `<p class="canned-panel-warning">【國小自然實作探究】不找代課，直接順延！</p>`;
        courseResultDiv.innerHTML = `
          <p><strong>家長 Bitrix 連結：</strong>
            <a href="${bitrixUrl}" target="_blank">${bitrixUrl}</a>
          </p>
          ${warningMsg}
        `;
        if (isNongXiao) {
          // 只更新 tab2
          panel.querySelector(`#${panelId}-tab1 textarea`).value = defaultTexts["tab1"];
          panel.querySelector(`#${panelId}-tab3 textarea`).value = defaultTexts["tab3"];
          panel.querySelector(`#${panelId}-tab4 textarea`).value = defaultTexts["tab4"];
          apiTexts["tab1"] = defaultTexts["tab1"];
          apiTexts["tab3"] = defaultTexts["tab3"];
          apiTexts["tab4"] = defaultTexts["tab4"];
        } else {
          apiTexts["tab1"] = `親愛的家長您好：

    學員姓名：${studentNames}
    課程時間：${courseTime}
    課程標籤：${tagNames}

    老師因故無法出席，為讓孩子的學習不間斷，
    我們已安排代課老師，感謝您的理解與支持！`;
          apiTexts["tab3"] = `親愛的家長您好：

    學員姓名：${studentNames}
    課程時間：${courseTime}
    課程標籤：${tagNames}

    因老師們正忙碌中，尚無師資接任課程，
    故課程將取消，後續將由輔導老師與您溝通補課事宜，謝謝您。`;
          apiTexts["tab4"] = `老師請假，請於授課提醒內完成學生狀況交接

    1、學員姓名：${studentNames}
    2、課程時間：${courseTime}
    3、https://oneclub.backstage.oneclass.com.tw/audition/course/edit/${courseId}`;
          panel.querySelector(`#${panelId}-tab1 textarea`).value = apiTexts["tab1"];
          panel.querySelector(`#${panelId}-tab3 textarea`).value = apiTexts["tab3"];
          panel.querySelector(`#${panelId}-tab4 textarea`).value = apiTexts["tab4"];
        }
        // leaveOrders 處理
        if (courseData.leaveOrders && courseData.leaveOrders.length > 0) {
          apiTexts["tab1"] = defaultTexts["tab1"];
          apiTexts["tab4"] = defaultTexts["tab4"];
          panel.querySelector(`#${panelId}-tab1 textarea`).value = defaultTexts["tab1"];
          panel.querySelector(`#${panelId}-tab4 textarea`).value = defaultTexts["tab4"];
          if (!panel.querySelector(`#${panelId}-tab1 .canned-panel-warning`)) {
            panel.querySelector(`#${panelId}-tab1`).insertAdjacentHTML('afterbegin', '<p class="canned-panel-warning">請注意：本課程老師已請假，請輸入最新代課網址</p>');
          }
          if (!panel.querySelector(`#${panelId}-tab4 .canned-panel-warning`)) {
            panel.querySelector(`#${panelId}-tab4`).insertAdjacentHTML('afterbegin', '<p class="canned-panel-warning">請注意：本課程老師已請假，請輸入最新代課網址</p>');
          }
        } else {
          const w1 = panel.querySelector(`#${panelId}-tab1 .canned-panel-warning`);
          if (w1) w1.remove();
          const w4 = panel.querySelector(`#${panelId}-tab4 .canned-panel-warning`);
          if (w4) w4.remove();
        }
      })
      .catch(error => {
        courseResultDiv.innerHTML = `<p style="color:red;">辨識失敗：${error.message}</p>`;
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

    // ===== 3.7. 拖曳功能 =====
    (function() {
      const dragHandle = panel.querySelector('.canned-panel-drag-handle');
      const dragState = {
        isDragging: false,
        startX: 0, startY: 0,
        elementX: 0, elementY: 0,
        translateX: 0, translateY: 0,
        currentX: 0, currentY: 0,
        animationFrameId: null,
        bounceAnimation: null
      };
      const BOUNDARY_BUFFER = 20, BOUNCE_DURATION = 300;
      const EXPECTED_WIDTH = 1900;
      const EXPECTED_HEIGHT = 930;

      function handleDragStart(e) {
        e.preventDefault(); e.stopPropagation();
        if (dragState.isDragging) return;
        dragState.isDragging = true;
        if (dragState.bounceAnimation) {
          cancelAnimationFrame(dragState.bounceAnimation);
          dragState.bounceAnimation = null;
        }
        const pageX = (e.touches ? e.touches[0].pageX : e.pageX !== undefined ? e.pageX : e.clientX + window.scrollX);
        const pageY = (e.touches ? e.touches[0].pageY : e.pageY !== undefined ? e.pageY : e.clientY + window.scrollY);
        dragState.startX = pageX;
        dragState.startY = pageY;
        dragState.elementX = panel.style.left
          ? parseInt(panel.style.left, 10)
          : (panel.getBoundingClientRect().left + window.scrollX);
        dragState.elementY = panel.style.top
          ? parseInt(panel.style.top, 10)
          : (panel.getBoundingClientRect().top + window.scrollY);
        panel.style.transition = 'none';
        panel.classList.add('canned-panel-dragging');
        document.addEventListener('pointermove', handleDragMove);
        document.addEventListener('pointerup', handleDragEnd);
        document.addEventListener('pointercancel', handleDragEnd);
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
        document.addEventListener('touchmove', handleDragMove, { passive: false });
        document.addEventListener('touchend', handleDragEnd);
        document.addEventListener('touchcancel', handleDragEnd);
      }
      function handleDragMove(e) {
        if (!dragState.isDragging) return;
        e.preventDefault();
        const pageX = (e.touches ? e.touches[0].pageX : e.pageX !== undefined ? e.pageX : e.clientX + window.scrollX);
        const pageY = (e.touches ? e.touches[0].pageY : e.pageY !== undefined ? e.pageY : e.clientY + window.scrollY);
        dragState.currentX = pageX;
        dragState.currentY = pageY;
        if (!dragState.animationFrameId) {
          dragState.animationFrameId = requestAnimationFrame(updateElementPosition);
        }
      }
      function updateElementPosition() {
        dragState.animationFrameId = null;
        if (!dragState.isDragging) return;
        const dx = dragState.currentX - dragState.startX;
        const dy = dragState.currentY - dragState.startY;
        const newTranslateX = dx, newTranslateY = dy;
        // 使用預計操作範圍
        const viewportWidth = EXPECTED_WIDTH, viewportHeight = EXPECTED_HEIGHT;
        const elementRect = panel.getBoundingClientRect();
        const minLeft = 0 - BOUNDARY_BUFFER, maxLeft = viewportWidth - elementRect.width + BOUNDARY_BUFFER;
        const minTop = 0 - BOUNDARY_BUFFER, maxTop = viewportHeight - elementRect.height + BOUNDARY_BUFFER;
        let newLeft = dragState.elementX + newTranslateX, newTop = dragState.elementY + newTranslateY;
        if (newLeft < minLeft) newLeft = minLeft - (minLeft - newLeft) * 0.3;
        else if (newLeft > maxLeft) newLeft = maxLeft + (newLeft - maxLeft) * 0.3;
        if (newTop < minTop) newTop = minTop - (minTop - newTop) * 0.3;
        else if (newTop > maxTop) newTop = maxTop + (newTop - maxTop) * 0.3;
        dragState.translateX = newLeft - dragState.elementX;
        dragState.translateY = newTop - dragState.elementY;
        panel.style.transform = `translate3d(${dragState.translateX}px, ${dragState.translateY}px, 0)`;
      }
      function handleDragEnd(e) {
        if (!dragState.isDragging) return;
        panel.classList.remove('canned-panel-dragging');
        document.removeEventListener('pointermove', handleDragMove);
        document.removeEventListener('pointerup', handleDragEnd);
        document.removeEventListener('pointercancel', handleDragEnd);
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.removeEventListener('touchmove', handleDragMove);
        document.removeEventListener('touchend', handleDragEnd);
        document.removeEventListener('touchcancel', handleDragEnd);
        if (dragState.animationFrameId) {
          cancelAnimationFrame(dragState.animationFrameId);
          dragState.animationFrameId = null;
        }
        dragState.isDragging = false;
        const elementRect = panel.getBoundingClientRect();
        // 使用預計操作範圍
        const viewportWidth = EXPECTED_WIDTH, viewportHeight = EXPECTED_HEIGHT;
        let finalX = dragState.elementX + dragState.translateX;
        let finalY = dragState.elementY + dragState.translateY;
        let needsBounce = false;
        if (finalX < 0) { finalX = 0; needsBounce = true; }
        else if (finalX + elementRect.width > viewportWidth) { finalX = viewportWidth - elementRect.width; needsBounce = true; }
        if (finalY < 0) { finalY = 0; needsBounce = true; }
        else if (finalY + elementRect.height > viewportHeight) { finalY = viewportHeight - elementRect.height; needsBounce = true; }
        if (needsBounce) {
          panel.style.transition = `transform ${BOUNCE_DURATION}ms cubic-bezier(0.25, 0.1, 0.25, 1.0)`;
          const finalTranslateX = finalX - dragState.elementX;
          const finalTranslateY = finalY - dragState.elementY;
          panel.style.transform = `translate3d(${finalTranslateX}px, ${finalTranslateY}px, 0)`;
          setTimeout(() => {
            panel.style.left = `${finalX}px`;
            panel.style.top = `${finalY}px`;
            panel.style.transform = '';
            panel.style.transition = '';
            dragState.translateX = 0;
            dragState.translateY = 0;
          }, BOUNCE_DURATION);
        } else {
          panel.style.left = `${finalX}px`;
          panel.style.top = `${finalY}px`;
          panel.style.transform = '';
          panel.style.transition = '';
          dragState.translateX = 0;
          dragState.translateY = 0;
        }
      }
      dragHandle.addEventListener('pointerdown', handleDragStart);
      dragHandle.addEventListener('mousedown', handleDragStart);
      dragHandle.addEventListener('touchstart', handleDragStart, { passive: false });
      dragHandle.addEventListener('dragstart', e => e.preventDefault());
      // 提升層級
      panel.addEventListener('mousedown', function(e) {
        if (e.target === dragHandle || dragHandle.contains(e.target)) return;
        document.querySelectorAll('.canned-panel-draggable').forEach(section => {
          if (section !== panel) section.style.zIndex = '1';
        });
        panel.style.zIndex = '1005';
      });
      // 初始定位
      setTimeout(() => {
        panel.style.left = (options.left !== undefined ? options.left : 1300) + 'px';
        panel.style.top = (options.top !== undefined ? options.top : 75) + 'px';
      }, 0);
    })();

    // ===== 3.8. 回傳面板節點 (可選) =====
    return panel;
  }

  // ===== 4. 導出到全域 =====
  global.createCannedMessagesPanel = createCannedMessagesPanel;
})(window);
