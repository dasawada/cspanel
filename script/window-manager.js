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
//   - 視窗座標存於 localStorage['cspanel.windows.<canvasId>.v1']（唯一權威）。
//   - z-index 只引用 --layer-panel 層帶：視窗 = calc(var(--layer-panel) + z*2)、
//     其作用中 pane = calc(var(--layer-panel) + z*2 + 1)（pane 疊在自己的視窗
//     之上，才看得到 iframe 且可互動）；z 為 0..n-1 的視窗堆疊名次，提升時
//     重新正規化，永不無限增長、恆在層帶內。
//
// 對外：mountWindowManager(host, opts) 回傳 { destroy, reset, syncPanes }，並掛
// window.WindowManager 供引擎 resetLayout 呼叫（CanvasEdit.reset 一併回預設）。

const SHIELD_Z = '2147483647'; // 與 draggable.js:142 同一個全螢幕事件盾（白名單）
const MIN_W = 240;
const MIN_H = 160;
const DRAG_THRESHOLD = 6; // px，未超過視為點擊（切換 tab）而非拖曳

export function mountWindowManager(host, opts = {}) {
  if (!host) return null;
  const canvasId = opts.canvasId || 'cs';
  const WKEY = `cspanel.windows.${canvasId}.v1`;

  const tabsContainer = host.querySelector('.panel-tabs-container');
  if (!tabsContainer) {
    // 沒有可管理的 markup（例如伺服器回傳空內容）——安靜退場，回無操作管理器。
    console.warn('WindowManager: 找不到 .panel-tabs-container，略過');
    return { destroy() {}, reset() {}, syncPanes() {} };
  }

  // ===== 1. 探索 tab（id / 標題 / 內容元素） =====
  const discovered = discoverTabs(tabsContainer);
  if (!discovered.length) {
    console.warn('WindowManager: 未探索到任何 tab，略過');
    return { destroy() {}, reset() {}, syncPanes() {} };
  }
  const tabOrder = discovered.map((d) => d.id);
  const tabMeta = Object.fromEntries(discovered.map((d) => [d.id, { title: d.title }]));
  const defaultRect = readContainerRect(tabsContainer);

  // ===== 2. 常駐池 + pane：把內容「一次性」搬進來 =====
  const pool = document.createElement('div');
  pool.className = 'wm-pool';
  host.appendChild(pool);

  const panes = {}; // tabId -> paneEl
  for (const d of discovered) {
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
  }

  // ===== 3. 丟棄伺服器 chrome =====
  tabsContainer.remove();

  // ===== 4. 視窗層 =====
  const layer = document.createElement('div');
  layer.className = 'wm-layer';
  host.appendChild(layer);

  // ===== 5. 狀態 =====
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
          pane.style.zIndex = `calc(var(--layer-panel) + ${win.z * 2 + 1})`;
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

  // ---- z 序 ----
  function topZ() { return windows.reduce((m, w) => Math.max(m, w.z), -1); }
  function normalizeZ() {
    [...windows].sort((a, b) => a.z - b.z).forEach((w, i) => { w.z = i; });
  }
  function applyZ() {
    for (const w of windows) if (w.el) w.el.style.zIndex = `calc(var(--layer-panel) + ${w.z * 2})`;
    syncPanes();
  }
  function raise(win) {
    if (windows.length <= 1) return;
    if (win.z === topZ() && windows.filter((w) => w.z === win.z).length === 1) return;
    win.z = topZ() + 1;
    normalizeZ();
    applyZ();
    persist();
  }

  // ---- 持久化 ----
  function persist() {
    try {
      const data = {
        windows: windows.map((w) => ({
          id: w.id, tabs: w.tabs.slice(), active: w.active,
          x: w.x, y: w.y, w: w.w, h: w.h, z: w.z,
        })),
      };
      localStorage.setItem(WKEY, JSON.stringify(data));
    } catch (e) { /* localStorage 失敗吞掉，不阻斷互動 */ }
  }

  function newId() { return 'w' + Math.random().toString(36).slice(2, 8); }
  function defaultWindow() {
    return { id: newId(), tabs: tabOrder.slice(), active: tabOrder[0],
      x: defaultRect.x, y: defaultRect.y, w: defaultRect.w, h: defaultRect.h, z: 0 };
  }

  function loadWindows() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(WKEY)); } catch (e) { raw = null; }
    let wins = (raw && Array.isArray(raw.windows) && raw.windows.length) ? raw.windows : null;
    if (!wins) return [defaultWindow()];

    // 淨化 + 只保留已知 tab
    wins = wins.map((w, i) => ({
      id: typeof w.id === 'string' ? w.id : newId(),
      tabs: Array.isArray(w.tabs) ? w.tabs.filter((t) => tabOrder.includes(t)) : [],
      active: w.active,
      x: num(w.x, defaultRect.x), y: num(w.y, defaultRect.y),
      w: Math.max(MIN_W, num(w.w, defaultRect.w)), h: Math.max(MIN_H, num(w.h, defaultRect.h)),
      z: num(w.z, i),
    }));
    // 跨視窗 tab 去重（第一次出現者勝）
    const seen = new Set();
    for (const win of wins) win.tabs = win.tabs.filter((t) => (seen.has(t) ? false : (seen.add(t), true)));
    wins = wins.filter((w) => w.tabs.length > 0);
    if (!wins.length) return [defaultWindow()];
    // 補齊遺漏的已知 tab（塞進第一個視窗），確保每個 tab 恰好出現一次
    const missing = tabOrder.filter((t) => !seen.has(t));
    if (missing.length) wins[0].tabs.push(...missing);
    // active 合法化
    for (const win of wins) if (!win.tabs.includes(win.active)) win.active = win.tabs[0];
    // z 正規化為 0..n-1
    [...wins].sort((a, b) => a.z - b.z).forEach((w, i) => { w.z = i; });
    return wins;
  }

  // ---- 渲染（重建視窗框；pane 池不動 → iframe 不重載） ----
  function render() {
    layer.innerHTML = '';
    for (const win of windows) {
      const el = document.createElement('div');
      el.className = 'wm-window';
      el.style.left = win.x + 'px';
      el.style.top = win.y + 'px';
      el.style.width = win.w + 'px';
      el.style.height = win.h + 'px';
      el.style.zIndex = `calc(var(--layer-panel) + ${win.z * 2})`;

      const bar = document.createElement('div');
      bar.className = 'wm-tabbar';
      for (const tabId of win.tabs) {
        const tab = document.createElement('div');
        tab.className = 'wm-tab' + (tabId === win.active ? ' is-active' : '');
        tab.dataset.tab = tabId;
        tab.textContent = tabMeta[tabId] ? tabMeta[tabId].title : tabId;
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
    }
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
    beginPointerDrag({
      cursor: 'grabbing',
      onMove: (ev) => {
        win.x = Math.round(ox + (ev.clientX - sx));
        win.y = Math.round(oy + (ev.clientY - sy));
        win.el.style.left = win.x + 'px';
        win.el.style.top = win.y + 'px';
        syncPanes();
      },
      onEnd: () => { persist(); },
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
    for (const win of windows) {
      const bar = win.el && win.el.querySelector('.wm-tabbar');
      if (!bar) continue;
      const r = bar.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        const tabs = [...bar.querySelectorAll('.wm-tab')];
        let index = tabs.length;
        for (let i = 0; i < tabs.length; i++) {
          const tr = tabs[i].getBoundingClientRect();
          if (x < tr.left + tr.width / 2) { index = i; break; }
        }
        return { win, index };
      }
    }
    return null;
  }

  function applyTabDrop(srcWin, tabId, ev) {
    const target = tabBarAt(ev.clientX, ev.clientY);
    const clamp = (i, lo, hi) => Math.max(lo, Math.min(hi, i));

    if (target && target.win === srcWin) {
      // 同視窗內重排
      srcWin.tabs = srcWin.tabs.filter((t) => t !== tabId);
      srcWin.tabs.splice(clamp(target.index, 0, srcWin.tabs.length), 0, tabId);
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
      windows.push({
        id: newId(), tabs: [tabId], active: tabId,
        x: Math.round(ev.clientX - cb.left - 40),
        y: Math.round(ev.clientY - cb.top - 12),
        w: srcWin.w, h: srcWin.h, z: topZ() + 1,
      });
    }
    // 移除空視窗、正規化 z、重繪、存檔
    windows = windows.filter((w) => w.tabs.length > 0);
    normalizeZ();
    persist();
    render();
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
    if (pool.parentNode) pool.remove();
    if (layer.parentNode) layer.remove();
    if (window.WindowManager === api) window.WindowManager = null;
  }

  function reset() {
    try { localStorage.removeItem(WKEY); } catch (e) { /* noop */ }
    windows = [defaultWindow()];
    render();
  }

  const api = { destroy, reset, syncPanes };
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
  return {
    x: Math.round(r.left - cb.left) || 410,
    y: Math.round(r.top - cb.top) || 160,
    w: Math.round(r.width) || 500,
    h: Math.round(r.height) || 600,
  };
}
