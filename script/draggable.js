/**
 * 讓指定元素可拖曳，彼此互不影響，並自動套用拖曳樣式
 * @param {HTMLElement} panel  要拖曳的主體元素
 * @param {HTMLElement} handle 拖曳把手（可選，預設整個 panel 可拖曳）
 * @param {Object} options     { left, top, width, height }
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
  height: 19px;
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

  // 自動加上通用 handle 樣式 class
  if (!handle.classList.contains('draggable-handle')) {
    handle.classList.add('draggable-handle');
  }

  const dragState = {
    isDragging: false,
    startX: 0, startY: 0,
    elementX: 0, elementY: 0,
    translateX: 0, translateY: 0,
    currentX: 0, currentY: 0,
    animationFrameId: null
  };
  const BOUNDARY_BUFFER = 20;
  const BOUNCE_DURATION = 300;
  const viewportWidth = options.width || window.innerWidth;
  const viewportHeight = options.height || window.innerHeight;

  function handleDragStart(e) {
    e.preventDefault(); e.stopPropagation();
    if (dragState.isDragging) return;
    dragState.isDragging = true;
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
    panel.style.transition = 'none';
    panel.classList.add('draggable-dragging');
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
    let newLeft = dragState.elementX + dx;
    let newTop = dragState.elementY + dy;
    const elementRect = panel.getBoundingClientRect();
    const minLeft = 0 - BOUNDARY_BUFFER, maxLeft = viewportWidth - elementRect.width + BOUNDARY_BUFFER;
    const minTop = 0 - BOUNDARY_BUFFER, maxTop = viewportHeight - elementRect.height + BOUNDARY_BUFFER;
    if (newLeft < minLeft) newLeft = minLeft - (minLeft - newLeft) * 0.3;
    else if (newLeft > maxLeft) newLeft = maxLeft + (newLeft - maxLeft) * 0.3;
    if (newTop < minTop) newTop = minTop - (minTop - newTop) * 0.3;
    else if (newTop > maxTop) newTop = maxTop + (newTop - maxTop) * 0.3;
    dragState.translateX = newLeft - dragState.elementX;
    dragState.translateY = newTop - dragState.elementY;
    panel.style.transform = `translate3d(${dragState.translateX}px, ${dragState.translateY}px, 0)`;
  }
  function handleDragEnd() {
    if (!dragState.isDragging) return;
    panel.classList.remove('draggable-dragging');
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
    const panelId = panel.id || panel.dataset.draggableId;
    if (panelId) {
      const storageKey = 'draggable:' + location.pathname + ':' + panelId;
      localStorage.setItem(storageKey, JSON.stringify({ left: finalX, top: finalY }));
    }
  }
  handle.addEventListener('pointerdown', handleDragStart);
  handle.addEventListener('mousedown', handleDragStart);
  handle.addEventListener('touchstart', handleDragStart, { passive: false });
  handle.addEventListener('dragstart', e => e.preventDefault());
  window.addEventListener('blur', handleDragEnd);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) handleDragEnd();
  });
  // 初始定位（支援跨頁面唯一 key）
  setTimeout(() => {
    const panelId = panel.id || panel.dataset.draggableId;
    let saved = null;
    if (panelId) {
      const storageKey = 'draggable:' + location.pathname + ':' + panelId;
      try {
        saved = JSON.parse(localStorage.getItem(storageKey));
      } catch {}
    }
    panel.style.left = (saved?.left !== undefined ? saved.left : (options.left !== undefined ? options.left : 100)) + 'px';
    panel.style.top = (saved?.top !== undefined ? saved.top : (options.top !== undefined ? options.top : 100)) + 'px';
    panel.style.position = 'absolute';
  }, 0);
}

/*
  === 使用範例 ===

  import { makeDraggable } from './script/draggable.js';

  // 讓多個不同區塊都能各自拖曳，互不干擾
  const panelA = document.getElementById('panelA');
  const handleA = panelA.querySelector('.handleA');
  makeDraggable(panelA, handleA, { left: 100, top: 100 });

  const panelB = document.getElementById('panelB');
  const handleB = panelB.querySelector('.handleB');
  makeDraggable(panelB, handleB, { left: 400, top: 200 });

  // 只要呼叫 makeDraggable(你的div, 你的把手)，每個都能獨立拖曳
*/