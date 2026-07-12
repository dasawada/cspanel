// 分頁視窗管理器（第三期，子專案 B）。
//
// 伺服器把 `.panel-tabs-container`（四個 tab：三 iframe + 一 DOM tools）注入到
// `#auth-protected-tabs-placeholder`。本模組在 auth-protected-tabs.js 的
// glDecorate（注入完成鉤子）交棒後接管：
//   1. iframe 常駐池：把四個 tab 的內容（iframe / .appicon DOM）「一次性」搬進
//      常駐池 .wm-pool（position:absolute），之後永不在 DOM 搬移——搬移=iframe
//      重載；只有這一次移動發生在剛登入 iframe 本就在載入，等於免費。
//   2. 丟棄伺服器的 radio/label/tab chrome，改渲染自家視窗（.wm-window）。
//   3. 每個「作用中 pane」用 getBoundingClientRect 同座標換算貼合其所屬視窗的
//      內容區；非作用中 pane 用 display:none（display:none 不重載 iframe，只有
//      DOM 重新 parent 才重載）。
//
// 互動（隨時可用，像 Chrome，不受編輯模式管轄）：tab 列內重排、撕出成新視窗、
// 拖回別視窗合併、點 tab 切換、拖 tab 列空白處移動視窗、拖右下角縮放、
// 點視窗提到最上層。拖曳/縮放時沿用 draggable.js 那個最高 z（2147483647）
// 透明 shield 防 iframe 吃滑鼠事件。
//
// 幾何 / 疊序鐵律：
//   - 視窗座標存於 localStorage['cspanel.windows.<canvasId>.v1'|'.v2']（唯一權威；
//     九期A 起依頁級旗標 window.CSPANEL_ENGINE_V2 選版本，見 mountWindowManager 內）。
//   - z-index 只引用 --layer-panel 層帶：視窗 = calc(var(--layer-panel) + z*2)、
//     其作用中 pane = calc(var(--layer-panel) + z*2 + 1)（pane 疊在自己的視窗
//     之上，才看得到 iframe 且可互動）；z 為 0..n-1 的視窗堆疊名次，提升時
//     重新正規化，永不無限增長、恆在層帶內。
//
// 對外：mountWindowManager(host, opts) 回傳 { destroy, reset, syncPanes, adoptTabs,
// hasTabs }，並掛 window.WindowManager 供引擎 resetLayout 呼叫（CanvasEdit.reset
// 一併回預設）。
//
// 九期B Task 2：兩段掛載（v2 模式限定；v1 模式下 mount 內仍單段直呼，逐位元不變）。
//   - 核心可在零 iframe tab 狀態下掛載（tabsContainer 缺席也不 no-op），供
//     canvas-engine 在 initAllModules 無條件呼叫，windows 可為空陣列。
//   - api.adoptTabs(tabsContainer) 供 auth-protected-tabs 在伺服器內容注入完成後
//     認養：探索/搬池/丟 chrome（adoptTabsInternal），再依已知 tab 集合重跑
//     loadWindows() 歸位（saved windows 記得的位置優先，其餘塞第一個視窗）。
//     冪等——已認養（tabOrder 已含）的 id 略過，不重複搬移 DOM。

import { stack } from './stack-manager.js';

const SHIELD_Z = '2147483647'; // 與 draggable.js:142 同一個全螢幕事件盾（白名單）
const MIN_W = 240;
const MIN_H = 160;
const DRAG_THRESHOLD = 6; // px，未超過視為點擊（切換 tab）而非拖曳

export function mountWindowManager(host, opts = {}) {
  if (!host) return null;
  const canvasId = opts.canvasId || 'cs';
  // Task 3 注入：'pg:' 開頭的 tab id 是否存在於 pages store（本 Task 先留掛點，
  // 預設一律 false——v1 永遠不會有 'pg:' id，不受影響）。
  const isPageId = typeof opts.isPageId === 'function' ? opts.isPageId : () => false;
  // 九期A：同 stack-manager.js——頁級旗標 window.CSPANEL_ENGINE_V2 選 v1/v2 儲存
  // 命名空間；未設旗標恆 v1，key 與改動前逐位元相同。
  const STORE_VER = (typeof window !== 'undefined' && window.CSPANEL_ENGINE_V2) ? 'v2' : 'v1';
  const isV2 = STORE_VER === 'v2';
  const WKEY = `cspanel.windows.${canvasId}.${STORE_VER}`;

  const tabsContainer = host.querySelector('.panel-tabs-container');
  // v1 路徑鐵律：tabsContainer 必在，否則安靜退場，回無操作管理器（行為逐位元
  // 不變）。v2 路徑：核心不需要 tabsContainer 就能掛載（零 tab 啟動），稍後由
  // api.adoptTabs() 認養伺服器注入的 iframe tabs。
  if (!isV2 && !tabsContainer) {
    console.warn('WindowManager: 找不到 .panel-tabs-container，略過');
    return { destroy() {}, reset() {}, syncPanes() {} };
  }

  // ===== 可變閉包狀態（Task 2：原本探索完立刻定案的一次性 const，改為 adoptTabs
  // 可持續擴充的狀態——v1 仍只會被填一次，行為不變）=====
  const tabOrder = [];
  const tabMeta = {};
  const panes = {}; // tabId -> paneEl
  let defaultRect = null;
  let pool = null; // 常駐池：懶建立，首次有 tab 可搬時才建（與舊行為一致——零 tab 早退路徑不留空池）

  // 淨化（loadWindows）用的合法 id 判定：iframe 已認養集合 ∪ 'pg:' 開頭且經
  // isPageId 認可（Task 3 注入 pages store 查詢）。
  function isKnownTab(id) {
    if (tabOrder.includes(id)) return true;
    return typeof id === 'string' && id.startsWith('pg:') ? !!isPageId(id) : false;
  }

  function ensurePool() {
    if (!pool) { pool = document.createElement('div'); pool.className = 'wm-pool'; host.appendChild(pool); }
    return pool;
  }

  // ===== 探索/搬池/丟 chrome（原 mountWindowManager 步驟 1-3，抽成可重入的認養
  // 函式）：v1 mount 內直呼一次；v2 由 api.adoptTabs 呼叫。冪等——回傳「這次新
  // 認養」的 tab 描述陣列，已知 id（tabOrder 已含）略過，全數已知則整段 no-op
  // （含不移除 container——冪等定義為「同 id 再 adopt 忽略」，非清場）。
  function adoptTabsInternal(container) {
    if (!container) return [];
    const discovered = discoverTabs(container);
    const newOnes = discovered.filter((d) => !tabOrder.includes(d.id));
    if (!newOnes.length) return [];
    if (!defaultRect) defaultRect = readContainerRect(container);
    ensurePool();
    for (const d of newOnes) {
      const pane = document.createElement('div');
      pane.className = 'wm-pane';
      pane.dataset.tab = d.id;
      pane.style.display = 'none';
      pool.appendChild(pane);
      if (d.contentEl) {
        // 搬「內容元素的子節點」（iframe 或 .appicon）進 pane。這是唯一一次
        // DOM 移動；之後 pane 永遠留在池中，切 tab / 撕離 / 合併都只改「所屬視窗」
        // 關係與 display，不再 re-parent，故 iframe 不再重載。
        while (d.contentEl.firstChild) pane.appendChild(d.contentEl.firstChild);
      }
      panes[d.id] = pane;
      tabMeta[d.id] = { title: d.title };
      tabOrder.push(d.id);
    }
    // 丟棄伺服器 chrome
    container.remove();
    return newOnes;
  }

  if (isV2) {
    adoptTabsInternal(tabsContainer); // tabsContainer 可能為 null（零 tab 啟動）——no-op
  } else {
    // v1：mount 內直接呼叫，行為不變（tabsContainer 已由上方鐵律保證存在）。
    adoptTabsInternal(tabsContainer);
    if (!tabOrder.length) {
      console.warn('WindowManager: 未探索到任何 tab，略過');
      return { destroy() {}, reset() {}, syncPanes() {} };
    }
  }

  // ===== 視窗層 =====
  const layer = document.createElement('div');
  layer.className = 'wm-layer';
  host.appendChild(layer);

  // ===== 狀態 =====
  let windows = loadWindows();
  let activeDrag = null; // { teardown } —— 供 destroy 中斷進行中的拖曳
  let syncRaf = 0;

  // ---- 幾何工具 ----
  function containingBlockRect() {
    // pane / 視窗皆 position:absolute，其 containing block = 最近的定位祖先，
    // 即 .panel_all_container（position:absolute）。兩者同一 containing block，
    // 才能用「內容區 rect - containing block rect」的差值定位 pane（scroll 不變）。
    const el = document.querySelector('.panel_all_container') || host;
    const r = el.getBoundingClientRect();
    // clientLeft/Top = border 寬度；絕對定位原點在 padding 邊，需自 border 邊加回。
    return { left: r.left + (el.clientLeft || 0), top: r.top + (el.clientTop || 0) };
  }

  function syncPanes() {
    const cb = containingBlockRect();
    for (const win of windows) {
      const contentEl = win.el && win.el.querySelector('.wm-content');
      if (!contentEl) continue;
      const cr = contentEl.getBoundingClientRect();
      for (const tabId of win.tabs) {
        const pane = panes[tabId];
        if (!pane) continue;
        if (tabId === win.active) {
          pane.style.display = 'block';
          pane.style.left = (cr.left - cb.left) + 'px';
          pane.style.top = (cr.top - cb.top) + 'px';
          pane.style.width = cr.width + 'px';
          pane.style.height = cr.height + 'px';
          // pane 的 z-index 由 stack-manager 經 .gl-stack-pane + --stack-rank 供給
          // （第四期併入統一疊序）；此處只負責幾何與 display。
        } else {
          pane.style.display = 'none';
        }
      }
    }
  }

  function scheduleSync() {
    if (syncRaf) return;
    syncRaf = requestAnimationFrame(() => { syncRaf = 0; syncPanes(); });
  }

  // ---- z 序（第四期併入統一疊序管理器）----
  // 視窗與 pane 的 z-index 完全交給 stack-manager（面板 ↔ 視窗同一套疊序）。
  function raise(win) { stack.raise(win.id); }

  // ---- 持久化 ----
  function persist() {
    try {
      const data = {
        windows: windows.map((w) => ({
          id: w.id, tabs: w.tabs.slice(), active: w.active,
          x: w.x, y: w.y, w: w.w, h: w.h, // z 已移除：疊序改由 stack-manager 單一權威
        })),
      };
      localStorage.setItem(WKEY, JSON.stringify(data));
    } catch (e) { /* localStorage 失敗吞掉，不阻斷互動 */ }
  }

  function newId() { return 'w' + Math.random().toString(36).slice(2, 8); }
  // 零 tab 時不預建（v2 核心可在零 iframe tab 狀態掛載）——tabOrder 空代表尚無
  // 任何已知 tab（且此刻也沒有已知 page，opts.isPageId 本 Task 預設恆 false），
  // 回 null 由呼叫端決定要不要塞進陣列。v1 恆有 tabOrder（早退鐵律保證），行為不變。
  function defaultWindow() {
    if (!tabOrder.length) return null;
    return { id: newId(), tabs: tabOrder.slice(), active: tabOrder[0],
      x: defaultRect.x, y: defaultRect.y, w: defaultRect.w, h: defaultRect.h };
  }

  function loadWindows() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(WKEY)); } catch (e) { raw = null; }
    let wins = (raw && Array.isArray(raw.windows) && raw.windows.length) ? raw.windows : null;
    if (!wins) { const dw = defaultWindow(); return dw ? [dw] : []; }

    // 幾何 fallback：v1 mount 時 defaultRect 恆已算好（早退鐵律保證）；v2 零 tab
    // 啟動時可能尚無任何 rect 依據（Task 3 的純 page 視窗會另有 rect 來源），
    // 這裡退回 readContainerRect 原本使用的同一組硬編碼預設值。
    const fx = defaultRect || { x: 410, y: 160, w: 500, h: 600 };
    // 淨化 + 只保留已知 tab（isKnownTab 泛化：iframe 已認養集合 ∪ 'pg:' 開頭經 isPageId 認可）
    wins = wins.map((w, i) => ({
      id: typeof w.id === 'string' ? w.id : newId(),
      tabs: Array.isArray(w.tabs) ? w.tabs.filter((t) => isKnownTab(t)) : [],
      active: w.active,
      x: num(w.x, fx.x), y: num(w.y, fx.y),
      w: Math.max(MIN_W, num(w.w, fx.w)), h: Math.max(MIN_H, num(w.h, fx.h)),
    }));
    // 跨視窗 tab 去重（第一次出現者勝）
    const seen = new Set();
    for (const win of wins) win.tabs = win.tabs.filter((t) => (seen.has(t) ? false : (seen.add(t), true)));
    wins = wins.filter((w) => w.tabs.length > 0);
    if (!wins.length) { const dw = defaultWindow(); return dw ? [dw] : []; }
    // 補齊遺漏的已知 iframe tab（塞進第一個視窗），確保每個 tab 恰好出現一次
    // （'pg:' id 的補齊屬 Task 3 pages store 自己的職責，不在 tabOrder 掃描範圍）
    const missing = tabOrder.filter((t) => !seen.has(t));
    if (missing.length) wins[0].tabs.push(...missing);
    // active 合法化
    for (const win of wins) if (!win.tabs.includes(win.active)) win.active = win.tabs[0];
    // 疊序不再存於 windows；由 stack-manager 的 cspanel.stack.cs.v1 統一管理。
    return wins;
  }

  // ===== api.adoptTabs：Task 2 兩段掛載的第二段——auth-protected-tabs 於伺服器
  // 內容注入完成後呼叫，認養剛出現的 iframe tabs。冪等：adoptTabsInternal 內部
  // 已濾掉已知 id，若這次完全沒有新 tab 就安靜返回，不重繪。 =====
  function adoptTabs(container) {
    const newOnes = adoptTabsInternal(container);
    if (!newOnes.length) return;
    windows = loadWindows(); // 依擴充後的 tabOrder 重新歸位（saved windows 記得的位置優先，其餘塞第一個視窗）
    render();
  }

  function hasTabs() { return tabOrder.length > 0; }

  // ---- 渲染（重建視窗框；pane 池不動 → iframe 不重載） ----
  function render() {
    layer.innerHTML = '';
    windows.forEach((win, i) => {
      const el = document.createElement('div');
      el.className = 'wm-window';
      el.style.left = win.x + 'px';
      el.style.top = win.y + 'px';
      el.style.width = win.w + 'px';
      el.style.height = win.h + 'px';
      // z-index 由 stack-manager 經 .gl-stack-surface + --stack-rank 供給（見迴圈尾 register）。

      const bar = document.createElement('div');
      bar.className = 'wm-tabbar draggable-handle';
      bar.setAttribute('role', 'tablist');
      bar.setAttribute('aria-label', '分頁視窗');
      for (const tabId of win.tabs) {
        const tab = document.createElement('div');
        const isActive = tabId === win.active;
        tab.className = 'wm-tab' + (isActive ? ' is-active' : '');
        tab.dataset.tab = tabId;
        tab.textContent = tabMeta[tabId] ? tabMeta[tabId].title : tabId;
        // roving tabindex：只有作用中 tab 可被 Tab 鍵聚焦，方向鍵在列內移動
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.tabIndex = isActive ? 0 : -1;
        bar.appendChild(tab);
      }

      const content = document.createElement('div');
      content.className = 'wm-content';
      const footer = document.createElement('div');
      footer.className = 'wm-footer';
      const resize = document.createElement('div');
      resize.className = 'wm-resize wm-resize-se';
      resize.title = '拖曳縮放';
      footer.appendChild(resize);

      el.append(bar, content, footer);
      win.el = el;
      layer.appendChild(el);

      wireWindow(win, el, bar, resize);
      // 併入統一疊序：視窗本體 .gl-stack-surface、作用中 pane .gl-stack-pane（同一 rank）。
      // 新視窗 initialRank 給高值（100+i）→ 預設疊在面板之上（面板 initialRank 0..N）；
      // 存檔的 stack 順序若存在則覆蓋（stack-manager savedSnapshot）。重繪時同 key 再
      // register 只更新 el/pane 指向、不動疊序。
      stack.register(win.id, el, { levels: 2, pane: panes[win.active], initialRank: 100 + i });
    });
    syncPanes();
  }

  function wireWindow(win, el, bar, resize) {
    // 提到最上層：capture 階段，先於任何 bubble handler（不重繪，故不會把使用者
    // 正壓著的元素抽換掉；只改 inline z-index）。
    el.addEventListener('pointerdown', () => raise(win), true);
    // tab 列空白處拖曳 = 移動視窗；點在 tab 上則交給 tab 自己處理。
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.wm-tab')) return;
      startWindowMove(win, e);
    });
    // 每個 tab：拖曳（重排 / 撕離 / 合併）或點擊（切換）。
    bar.querySelectorAll('.wm-tab').forEach((tabEl) => {
      tabEl.addEventListener('pointerdown', (e) => startTabDrag(win, tabEl.dataset.tab, e));
    });
    // 鍵盤（WAI-ARIA tabs，手動觸發模式）：方向鍵移動焦點、Home/End 到頭尾、
    // Enter/Space 切換到聚焦的 tab。切換走 render（重繪 chrome、pane 池不動 →
    // iframe 不重載），重繪後把焦點還給新 DOM 裡的同一顆 tab。
    bar.addEventListener('keydown', (e) => {
      const tabs = [...bar.querySelectorAll('.wm-tab')];
      const focused = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.wm-tab') : null;
      if (!tabs.length || !focused || !bar.contains(focused)) return;
      const i = tabs.indexOf(focused);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        next.focus();
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        tabs[e.key === 'Home' ? 0 : tabs.length - 1].focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const tabId = focused.dataset.tab;
        if (win.active !== tabId) {
          win.active = tabId;
          persist();
          render();
          const nt = win.el && win.el.querySelector(`.wm-tab[data-tab="${CSS.escape(tabId)}"]`);
          if (nt) nt.focus();
        }
      }
    });
    // 右下角縮放。
    resize.addEventListener('pointerdown', (e) => startResize(win, e));
  }

  // ---- 拖曳核心（透明 shield + rAF 節流 + per-frame 回呼） ----
  function beginPointerDrag({ cursor, onMove, onEnd }) {
    if (activeDrag) return; // 同時只允許一個拖曳
    const shield = document.createElement('div');
    Object.assign(shield.style, {
      position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh',
      zIndex: SHIELD_Z, background: 'rgba(0,0,0,0)', cursor: cursor || 'grabbing',
    });
    document.body.appendChild(shield);

    let raf = 0;
    let lastEvent = null;
    const flush = () => { raf = 0; if (lastEvent) onMove(lastEvent); };
    const move = (e) => { lastEvent = e; if (!raf) raf = requestAnimationFrame(flush); };
    const finish = (e) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', finish);
      document.removeEventListener('pointercancel', finish);
      if (raf) cancelAnimationFrame(raf);
      if (shield.parentNode) shield.remove();
      activeDrag = null;
      onEnd(e);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', finish);
    document.addEventListener('pointercancel', finish);
    activeDrag = {
      teardown() {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', finish);
        document.removeEventListener('pointercancel', finish);
        if (raf) cancelAnimationFrame(raf);
        if (shield.parentNode) shield.remove();
        activeDrag = null;
      },
    };
  }

  function startWindowMove(win, e) {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, ox = win.x, oy = win.y;
    win.el.classList.add('gl-dragging', 'draggable-dragging'); // 材質鉤子＋把手詞彙拖曳態（第八期統一）
    beginPointerDrag({
      cursor: 'grabbing',
      onMove: (ev) => {
        win.x = Math.round(ox + (ev.clientX - sx));
        win.y = Math.round(oy + (ev.clientY - sy));
        win.el.style.left = win.x + 'px';
        win.el.style.top = win.y + 'px';
        syncPanes();
      },
      onEnd: () => { win.el.classList.remove('gl-dragging', 'draggable-dragging'); persist(); },
    });
  }

  function startResize(win, e) {
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, ow = win.w, oh = win.h;
    beginPointerDrag({
      cursor: 'nwse-resize',
      onMove: (ev) => {
        win.w = Math.max(MIN_W, Math.round(ow + (ev.clientX - sx)));
        win.h = Math.max(MIN_H, Math.round(oh + (ev.clientY - sy)));
        win.el.style.width = win.w + 'px';
        win.el.style.height = win.h + 'px';
        syncPanes();
      },
      onEnd: () => { persist(); },
    });
  }

  function startTabDrag(win, tabId, e) {
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;
    let dragging = false;
    let ghost = null;
    beginPointerDrag({
      cursor: 'grabbing',
      onMove: (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        if (!dragging) {
          dragging = true;
          ghost = document.createElement('div');
          ghost.className = 'wm-drag-ghost';
          ghost.textContent = tabMeta[tabId] ? tabMeta[tabId].title : tabId;
          document.body.appendChild(ghost);
        }
        ghost.style.left = (ev.clientX + 8) + 'px';
        ghost.style.top = (ev.clientY + 8) + 'px';
      },
      onEnd: (ev) => {
        if (ghost && ghost.parentNode) ghost.remove();
        if (!dragging) {
          // 點擊：切換該視窗的作用中 tab
          if (win.active !== tabId) { win.active = tabId; persist(); render(); }
          return;
        }
        applyTabDrop(win, tabId, ev);
      },
    });
  }

  // 命中哪個視窗的 tab 列，以及插入索引（用已知 tab 列 rect 幾何命中，不用
  // elementFromPoint——shield 蓋在最上層會攔截 elementFromPoint）。
  function tabBarAt(x, y) {
    let best = null;
    for (const win of windows) {
      const bar = win.el && win.el.querySelector('.wm-tabbar');
      if (!bar) continue;
      const r = bar.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      // tab 列在畫面上重疊時，取「最上層」的視窗才與使用者所見一致，不是陣列順序的
      // 第一個命中者（審查 #4）。z 已交給 stack-manager，改以它寫入的 --stack-rank
      // 判定誰在上（rank 大者在上）。
      const myRank = parseInt(win.el.style.getPropertyValue('--stack-rank'), 10) || 0;
      const bestRank = best ? (parseInt(best.win.el.style.getPropertyValue('--stack-rank'), 10) || 0) : -1;
      if (best && myRank <= bestRank) continue;
      const tabs = [...bar.querySelectorAll('.wm-tab')];
      let index = tabs.length;
      for (let i = 0; i < tabs.length; i++) {
        const tr = tabs[i].getBoundingClientRect();
        if (x < tr.left + tr.width / 2) { index = i; break; }
      }
      best = { win, index };
    }
    return best;
  }

  function applyTabDrop(srcWin, tabId, ev) {
    const target = tabBarAt(ev.clientX, ev.clientY);
    const clamp = (i, lo, hi) => Math.max(lo, Math.min(hi, i));
    let tornWinId = null;

    if (target && target.win === srcWin) {
      // 同視窗內重排。target.index 是在「仍含被拖 tab」的 tab 列上算出的；移除被拖
      // tab 後其原位置之後的索引全部左移一格，故若原索引 < target.index 需 -1 補償，
      // 否則向右重排到中段會多插一格（審查 #2；左移與拖到最尾 clamp 不受影響）。
      const origIdx = srcWin.tabs.indexOf(tabId);
      let idx = target.index;
      if (origIdx !== -1 && origIdx < idx) idx -= 1;
      srcWin.tabs = srcWin.tabs.filter((t) => t !== tabId);
      srcWin.tabs.splice(clamp(idx, 0, srcWin.tabs.length), 0, tabId);
      srcWin.active = tabId;
    } else if (target) {
      // 合併到別的視窗
      srcWin.tabs = srcWin.tabs.filter((t) => t !== tabId);
      if (srcWin.active === tabId) srcWin.active = srcWin.tabs[0] || null;
      target.win.tabs = target.win.tabs.filter((t) => t !== tabId);
      target.win.tabs.splice(clamp(target.index, 0, target.win.tabs.length), 0, tabId);
      target.win.active = tabId;
      raise(target.win);
    } else {
      // 撕離成新視窗（落點附近）
      srcWin.tabs = srcWin.tabs.filter((t) => t !== tabId);
      if (srcWin.active === tabId) srcWin.active = srcWin.tabs[0] || null;
      const cb = containingBlockRect();
      const nw = {
        id: newId(), tabs: [tabId], active: tabId,
        x: Math.round(ev.clientX - cb.left - 40),
        y: Math.round(ev.clientY - cb.top - 12),
        w: srcWin.w, h: srcWin.h,
      };
      windows.push(nw);
      tornWinId = nw.id; // render 後提到最上層（新開視窗在最上）
    }
    // 移除空視窗（合併/撕離後可能有視窗被清空）：先記下再 filter，並對被移除的視窗
    // stack.unregister，否則 stack 的 order/surfaces 會累積死 key、--stack-rank 灌水、
    // cspanel.stack.cs.v1 無限增長（審查 #4/#6）。
    const removedWins = windows.filter((w) => w.tabs.length === 0);
    windows = windows.filter((w) => w.tabs.length > 0);
    removedWins.forEach((w) => stack.unregister(w.id));
    persist();
    render();
    if (tornWinId) stack.raise(tornWinId);
  }

  // ---- 生命週期 ----
  const onScroll = () => scheduleSync();
  const onResize = () => scheduleSync();
  window.addEventListener('resize', onResize);
  document.addEventListener('scroll', onScroll, true);

  function destroy() {
    if (activeDrag) activeDrag.teardown();
    window.removeEventListener('resize', onResize);
    document.removeEventListener('scroll', onScroll, true);
    if (syncRaf) cancelAnimationFrame(syncRaf);
    document.querySelectorAll('.wm-drag-ghost').forEach((g) => g.remove());
    windows.forEach((w) => stack.unregister(w.id, true)); // 登出批次拆除：quiet，不動 stack 存檔
    if (pool && pool.parentNode) pool.remove(); // v2 零 tab 全程未認養時 pool 從未建立
    if (layer.parentNode) layer.remove();
    if (window.WindowManager === api) window.WindowManager = null;
  }

  function reset() {
    try { localStorage.removeItem(WKEY); } catch (e) { /* noop */ }
    windows.forEach((w) => stack.unregister(w.id)); // 卸除舊視窗的疊序條目
    const dw = defaultWindow(); // v2 零 tab 時 dw 為 null——回空陣列，不是 [null]
    windows = dw ? [dw] : [];
    render(); // 註冊新的預設視窗
  }

  const api = { destroy, reset, syncPanes, adoptTabs, hasTabs };
  window.WindowManager = api;

  // 初次渲染 + 佈局穩定後再同步一次（字型/reflow 落定）
  render();
  setTimeout(syncPanes, 60);

  return api;
}

// ===== 純工具 =====
function num(v, fallback) { return Number.isFinite(v) ? v : fallback; }

function discoverTabs(tabsContainer) {
  const inputs = [...tabsContainer.querySelectorAll('input[type="radio"][name="panel-tab"]')];
  const out = [];
  for (const inp of inputs) {
    const id = inp.id.replace(/^panel-tab-/, '');
    if (!id) continue;
    const label = tabsContainer.querySelector(`label[for="${CSS.escape(inp.id)}"]`);
    // 內容區 = label 之後的 .panel-tab-content（markup 順序 input→label→content）
    let content = label ? label.nextElementSibling : inp.nextElementSibling;
    if (content && !content.classList.contains('panel-tab-content')) {
      // 保險：往後找第一個 .panel-tab-content
      let n = content;
      while (n && !n.classList.contains('panel-tab-content')) n = n.nextElementSibling;
      content = n;
    }
    out.push({ id, title: label ? label.textContent.trim() : id, contentEl: content || null });
  }
  return out;
}

function readContainerRect(el) {
  const cbEl = document.querySelector('.panel_all_container') || el.offsetParent || document.body;
  const cb = cbEl.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  // 用有限性/正值判斷，讓合法的 0 座標通過（審查 #5）——`top:0`／`left:0` 是重排
  // 常見值，若用 `0 || 160` 會被誤判成缺值而靜默替換成硬編碼預設造成偏移。
  const x = Math.round(r.left - cb.left);
  const y = Math.round(r.top - cb.top);
  return {
    x: Number.isFinite(x) ? x : 410,
    y: Number.isFinite(y) ? y : 160,
    w: r.width > 0 ? Math.round(r.width) : 500,
    h: r.height > 0 ? Math.round(r.height) : 600,
  };
}
