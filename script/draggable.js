/**
 * 讓指定元素可拖曳，彼此互不影響，並自動套用拖曳樣式
 * @param {HTMLElement} panel  要拖曳的主體元素
 * @param {HTMLElement} handle 拖曳把手（可選，預設整個 panel 可拖曳）
 * @param {Object} options     { left, top, width, height, color, boundaryElement, updateBoundary, disableBoundary, onPositionChange, persist }
 *   color: 若提供，handle 拖曳中會加上主題 class；實際顏色一律套用全域
 *   --accent / --accent-hover token 衍生的漸層（不再依 color 的字面值渲染色相），
 *   color 值僅用來產生穩定的 class 名稱。
 *   onPositionChange({left, top}): 拖曳結束（回彈與直接兩路徑皆會呼叫一次）時的回呼。
 *   persist: 預設 true（未傳等同 true）。false 時略過本模組自身的
 *   per-panel localStorage 初始還原/寫入與初始 inline left/top 設定，交由
 *   呼叫端（例如畫布引擎的統一 layout）作為位置權威——用於避免編輯模式把手
 *   與獨立面板各自的 draggable:<path>:<id> 存檔互相打架。
 */
export function makeDraggable(panel, handle, options = {}) {
  handle = handle || panel;

  // 自動注入通用拖曳樣式（只注入一次）
  if (!window.__draggableStyleInjected) {
    const style = document.createElement('style');
    style.textContent = `
.draggable-handle {
  padding: 5px 10px;
  border-radius: 10px 10px 0 0;
  text-align: left;
  font-weight: bold;
  cursor: grab;
  user-select: none;
}
.draggable-handle:active { cursor: grabbing; }
.draggable-dragging {
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  opacity: 0.95;
  cursor: grabbing;
}
.draggable-dragging .draggable-handle {
  background: linear-gradient(
    180deg,
    #f0f0f0 0%,
    #d6d6d6 40%,
    #ffffff 100%
  );
  box-shadow: inset 0 1px 3px rgba(255,255,255,0.8);
  cursor: grabbing;
}
`;
    document.head.appendChild(style);
    window.__draggableStyleInjected = true;
  }

  // === options.color 僅作為 handle 主題 class 的識別字；實際顏色一律
  // 套用全域 --accent token 衍生的漸層（登入後由 theme.js 主題化，未登入
  // 時為單色基準），不再硬編碼特定色相。
  // 還原自 main:script/draggable.js 的原始把手漸層（拖曳中 180deg、
  // 由飽和色過渡到近透明的直向漸層），僅將色相來源換成 --accent token：
  //   原始： linear-gradient(180deg, ${color} 0%, ${color}22 100%)
  //   現在： linear-gradient(180deg, color-mix(...accent 30%...), color-mix(...accent 14%...))
  if (options.color) {
    const colorCode = String(options.color).replace('#', '').toLowerCase();
    const themeClass = `draggable-handle-theme-${colorCode}`;
    if (!document.querySelector(`style[data-draggable-theme="${themeClass}"]`)) {
      const style = document.createElement('style');
      style.setAttribute('data-draggable-theme', themeClass);
      style.textContent = `
.draggable-dragging .${themeClass} {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--accent) 30%, white),
    color-mix(in srgb, var(--accent) 14%, white)
  ) !important;
  color: var(--accent-hover) !important;
}
`;
      document.head.appendChild(style);
    }
    handle.classList.add(themeClass);
  }
  // ===

  // 自動加上通用 handle 樣式 class
  if (!handle.classList.contains('draggable-handle')) {
    handle.classList.add('draggable-handle');
  }

  const dragState = {
    isDragging: false,
    startX: 0, startY: 0,
    elementX: 0, elementY: 0,
    translateX: 0, translateY: 0,
    pointerOffsetX: 0, pointerOffsetY: 0,
    currentX: 0, currentY: 0,
    animationFrameId: null
  };
  const BOUNDARY_BUFFER = 20; // This will only be used if disableBoundary is false
  const BOUNCE_DURATION = 300;
  let viewportWidth, viewportHeight;
  let boundaryElement = options.boundaryElement;
  let boundaryOffsetX = 0, boundaryOffsetY = 0; // 新增：邊界位移

  function updateBoundary() {
    if (boundaryElement) {
      const boundaryRect = boundaryElement.getBoundingClientRect();
      // 考慮頁面捲動，計算邊界元素的絕對位置
      boundaryOffsetX = boundaryRect.left + window.scrollX;
      boundaryOffsetY = boundaryRect.top + window.scrollY;
      viewportWidth = boundaryRect.width;
      viewportHeight = boundaryRect.height;
    } else {
      // 當沒有指定 boundaryElement 時，邊界從 (0,0) 開始
      boundaryOffsetX = 0;
      boundaryOffsetY = 0;
      // 使用 options.width/height 或整個文件的可捲動區域作為邊界
      viewportWidth = options.width || Math.max(document.documentElement.scrollWidth, window.innerWidth);
      viewportHeight = options.height || Math.max(document.documentElement.scrollHeight, window.innerHeight);
    }
  }

  // 初始化邊界 (即使 disableBoundary 為 true，也先計算一次，以防後續動態切換)
  updateBoundary();

  // 如果設置了 updateBoundary 選項，則監聽視窗大小變化和捲動
  if (options.updateBoundary) {
    window.addEventListener('resize', updateBoundary);
    document.addEventListener('scroll', updateBoundary, true); // 監聽捲動事件
  }

  let dragOverlay = null; // 新增遮罩變數

  function handleDragStart(e) {
    e.preventDefault(); e.stopPropagation();
    if (dragState.isDragging) return;
    dragState.isDragging = true;

    // === 新增：拖曳時加全螢幕透明遮罩，避免 iframe 吃掉事件 ===
    if (!dragOverlay) {
      dragOverlay = document.createElement('div');
      dragOverlay.style.position = 'fixed';
      dragOverlay.style.left = '0';
      dragOverlay.style.top = '0';
      dragOverlay.style.width = '100vw';
      dragOverlay.style.height = '100vh';
      dragOverlay.style.zIndex = '2147483647'; // 保證最高
      dragOverlay.style.pointerEvents = 'auto';
      dragOverlay.style.background = 'rgba(0,0,0,0)';
      document.body.appendChild(dragOverlay);
    }
    // ===

    const pageX = (e.touches ? e.touches[0].pageX : e.pageX !== undefined ? e.pageX : e.clientX + window.scrollX);
    const pageY = (e.touches
      ? e.touches[0].pageY
      : e.pageY !== undefined
        ? e.pageY
        : e.clientY + window.scrollY);
    dragState.startX = pageX;
    dragState.startY = pageY;
    dragState.elementX = panel.style.left
      ? parseInt(panel.style.left, 10)
      : (panel.getBoundingClientRect().left + window.scrollX);
    dragState.elementY = panel.style.top
      ? parseInt(panel.style.top, 10)
      : (panel.getBoundingClientRect().top + window.scrollY);

    // 滑鼠指標相對於元素左上角的位移
    dragState.pointerOffsetX = pageX - dragState.elementX;
    dragState.pointerOffsetY = pageY - dragState.elementY;

    panel.style.transition = 'none';
    panel.classList.add('draggable-dragging');
    // gl-dragging：拖曳中近透明玻璃特效的掛鉤 class（附加、不影響既有
    // draggable-dragging 的透明度/陰影行為），實際視覺由各面板注入的
    // CSS 決定（見 dragb_msg_pnl.js 的 .canned-panel.gl-dragging）
    panel.classList.add('gl-dragging');
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
    let newLeft = dragState.currentX - dragState.pointerOffsetX;
    let newTop = dragState.currentY - dragState.pointerOffsetY;

    if (!options.disableBoundary) { // <<< MODIFICATION: Conditional boundary check
      const elementRect = panel.getBoundingClientRect();
      // 邊界檢查時，要考慮邊界的位移
      const minLeft = boundaryOffsetX - BOUNDARY_BUFFER;
      const maxLeft = boundaryOffsetX + viewportWidth - elementRect.width + BOUNDARY_BUFFER;
      const minTop = boundaryOffsetY - BOUNDARY_BUFFER;
      const maxTop = boundaryOffsetY + viewportHeight - elementRect.height + BOUNDARY_BUFFER;

      if (newLeft < minLeft) newLeft = minLeft - (minLeft - newLeft) * 0.3;
      else if (newLeft > maxLeft) newLeft = maxLeft + (newLeft - maxLeft) * 0.3;
      if (newTop < minTop) newTop = minTop - (minTop - newTop) * 0.3;
      else if (newTop > maxTop) newTop = maxTop + (newTop - maxTop) * 0.3;
    }

    dragState.translateX = newLeft - dragState.elementX;
    dragState.translateY = newTop - dragState.elementY;
    panel.style.transform = `translate3d(${dragState.translateX}px, ${dragState.translateY}px, 0)`;
  }
  function handleDragEnd() {
    if (!dragState.isDragging) return;
    panel.classList.remove('draggable-dragging');
    panel.classList.remove('gl-dragging');
    document.removeEventListener('pointermove', handleDragMove);
    document.removeEventListener('pointerup', handleDragEnd);
    document.removeEventListener('pointercancel', handleDragEnd);
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('touchend', handleDragEnd);
    document.removeEventListener('touchcancel', handleDragEnd);

    // === 新增：拖曳結束移除遮罩 ===
    if (dragOverlay) {
      dragOverlay.remove();
      dragOverlay = null;
    }
    // ===

    if (dragState.animationFrameId) {
      cancelAnimationFrame(dragState.animationFrameId);
      dragState.animationFrameId = null;
    }
    dragState.isDragging = false;
    
    let finalX = dragState.elementX + dragState.translateX;
    let finalY = dragState.elementY + dragState.translateY;
    let needsBounce = false;

    if (!options.disableBoundary) { // <<< MODIFICATION: Conditional boundary check and bounce
      const elementRect = panel.getBoundingClientRect();
      const currentElementWidth = elementRect.width;
      const currentElementHeight = elementRect.height;

      // 回彈計算也要考慮邊界位移
      const boundaryLeft = boundaryOffsetX;
      const boundaryRight = boundaryOffsetX + viewportWidth;
      const boundaryTop = boundaryOffsetY;
      const boundaryBottom = boundaryOffsetY + viewportHeight;

      if (finalX < boundaryLeft) { finalX = boundaryLeft; needsBounce = true; }
      else if (finalX + currentElementWidth > boundaryRight) { finalX = boundaryRight - currentElementWidth; needsBounce = true; }
      if (finalY < boundaryTop) { finalY = boundaryTop; needsBounce = true; }
      else if (finalY + currentElementHeight > boundaryBottom) { finalY = boundaryBottom - currentElementHeight; needsBounce = true; }
    }

    if (needsBounce) { // This will only be true if !options.disableBoundary and a boundary was hit
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
      if (typeof options.onPositionChange === 'function') {
        options.onPositionChange({ left: finalX, top: finalY });
      }
    } else {
      panel.style.left = `${finalX}px`;
      panel.style.top = `${finalY}px`;
      panel.style.transform = '';
      panel.style.transition = '';
      dragState.translateX = 0;
      dragState.translateY = 0;
      if (typeof options.onPositionChange === 'function') {
        options.onPositionChange({ left: finalX, top: finalY });
      }
    }
    const panelId = panel.id || panel.dataset.draggableId;
    if (panelId && options.persist !== false) {
      const storageKey = 'draggable:' + location.pathname + ':' + panelId;
      localStorage.setItem(storageKey, JSON.stringify({ left: finalX, top: finalY }));
    }
  }

  // 將匿名事件處理器定義為具名函數，以便後續移除
  const preventDefaultDragStart = e => e.preventDefault();
  const onVisibilityChange = () => {
    if (document.hidden) {
      // 如果頁面隱藏，也觸發拖曳結束的邏輯
      // handleDragEnd 會處理 isDragging 狀態，所以重複呼叫是安全的
      handleDragEnd();
    }
  };

  function cleanup() {
    // 如果在拖曳過程中元素被移除，確保呼叫 handleDragEnd 來清理拖曳狀態和臨時監聽器
    if (dragState.isDragging) {
      handleDragEnd();
    }

    // 移除添加到 handle 元素的事件監聽器
    handle.removeEventListener('pointerdown', handleDragStart);
    handle.removeEventListener('mousedown', handleDragStart);
    handle.removeEventListener('touchstart', handleDragStart, { passive: false });
    handle.removeEventListener('dragstart', preventDefaultDragStart);

    // 移除添加到 window 和 document 的持久性事件監聽器
    if (options.updateBoundary) {
      window.removeEventListener('resize', updateBoundary);
      document.removeEventListener('scroll', updateBoundary, true); // 移除捲動監聽
    }
    window.removeEventListener('blur', handleDragEnd);
    document.removeEventListener('visibilitychange', onVisibilityChange);

    // dragOverlay 的移除已經包含在 handleDragEnd 中，
    // 如果 isDragging 為 true，則 handleDragEnd 會被呼叫。
    // 如果 isDragging 為 false，dragOverlay 理應為 null。
    // 為保險起見，可以再檢查一次，但通常由 handleDragEnd 處理。
    if (dragOverlay) {
        dragOverlay.remove();
        dragOverlay = null;
    }
  }

  // 在元素被移除時執行清理
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.removedNodes.length) {
        for (const node of mutation.removedNodes) {
          if (node === panel || node.contains(panel)) {
            observer.disconnect(); // 先停止觀察，避免重複觸發
            cleanup();
            break; // 已找到並處理，跳出內部循環
          }
        }
      }
      // 如果 panel 已被移除，外部循環也應考慮中斷（如果 observer.disconnect() 後 mutations 列表不再重要）
      if (!document.body.contains(panel)) break; 
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // 添加持久性事件監聽器
  handle.addEventListener('pointerdown', handleDragStart);
  handle.addEventListener('mousedown', handleDragStart);
  handle.addEventListener('touchstart', handleDragStart, { passive: false });
  handle.addEventListener('dragstart', preventDefaultDragStart);

  window.addEventListener('blur', handleDragEnd);
  document.addEventListener('visibilitychange', onVisibilityChange);

  // 初始定位（支援跨頁面唯一 key）
  setTimeout(() => {
    // persist:false（如畫布編輯模式把手）：初始位置權威來自呼叫端既有的
    // CSS/inline 幾何（例如引擎 emitGeometry 注入的座標），不讀取也不覆寫
    // per-panel 的 localStorage 位置，避免與統一 layout 來源衝突或造成
    // 進入編輯模式瞬間跳位到預設 (100,100)。
    if (options.persist === false) return;
    const panelId = panel.id || panel.dataset.draggableId;
    let saved = null;
    if (panelId) {
      const storageKey = 'draggable:' + location.pathname + ':' + panelId;
      try {
        saved = JSON.parse(localStorage.getItem(storageKey));
      } catch {}
    }
    // 初始位置設定不受 disableBoundary 影響，它只影響拖曳行為
    panel.style.left = (saved?.left !== undefined ? saved.left : (options.left !== undefined ? options.left : 100)) + 'px';
    panel.style.top = (saved?.top !== undefined ? saved.top : (options.top !== undefined ? options.top : 100)) + 'px';
    panel.style.position = 'absolute';
  }, 0);
}

/*
  === 使用範例 ===

  import { makeDraggable } from './script/draggable.js';

  // 啟用邊界限制 (預設行為)
  const panelA = document.getElementById('panelA');
  const handleA = panelA.querySelector('.handleA');
  makeDraggable(panelA, handleA, { left: 100, top: 100, color: 'panelA' });

  // 停用邊界限制，允許自由拖曳（color 只是 class 識別字，實際顏色為 --accent token）
  const panelB = document.getElementById('panelB');
  const handleB = panelB.querySelector('.handleB');
  makeDraggable(panelB, handleB, { left: 400, top: 200, color: 'panelB', disableBoundary: true });

  // 只要呼叫 makeDraggable(你的div, 你的把手)，每個都能獨立拖曳
*/