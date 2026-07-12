// 統一動態疊序管理器（第四期）。
//
// 所有 surface（有 rootSelector 的面板 + 每個 tab 視窗）共用一套疊序：點擊置頂、
// 名次正規化為 0..N-1、跨 reload 持久化。面板可蓋過 tab 視窗、反之亦然。
//
// z-index 不寫 inline——改設 CSS 自訂屬性 `--stack-rank`（純整數），z-index 由
// `.gl-stack-surface` / `.gl-stack-pane`（style/v2/stack.css）以
// `calc(var(--layer-panel) + var(--stack-rank)*2[+1])` 供給。這樣 `:focus-within`
// / `.small-size` / 拖曳中提升等「狀態提升」的 CSS 規則（特異度 ≥ 或改用
// --layer-panel-active 更高帶）仍能覆蓋 resting 疊序，兩者互不打架。
//
// 對外：`stack.register/unregister/raise/reset/setCanvasId`，並掛 window.CanvasStack。

// 九期A：頁級旗標 window.CSPANEL_ENGINE_V2（<head> 最早的 inline script 設定，
// 模組載入時必已可讀）選 v1/v2 儲存命名空間。未設旗標（production panel_all.html
// 現況）→ 恆 v1，key 與改動前逐位元相同。
const STORE_VER = (typeof window !== 'undefined' && window.CSPANEL_ENGINE_V2) ? 'v2' : 'v1';
const KEY = (id) => `cspanel.stack.${id}.${STORE_VER}`;

let canvasId = 'cs';
const surfaces = new Map(); // key -> { el, pane, levels, _initialRank }
let order = [];             // key[]（由下往上；最後者最上層）
// 「還原目標」快照：頁面載入時的存檔順序只讀一次並快取。register 每註冊一筆就
// persist()，會覆寫 localStorage；若每次 register 都重讀 localStorage，第一筆的
// persist 就把還原目標洗成部分順序，後續 register 讀到殘缺順序 → 還原失敗。
// 改為對「頁載當下的存檔」取一次快照，所有 register 都對這份不變快照還原。
let savedSnapshot; // undefined=尚未讀；null=無存檔；array=存檔順序

function readOrder() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(canvasId)));
    return (raw && Array.isArray(raw.order)) ? raw.order.filter((k) => typeof k === 'string') : null;
  } catch (e) { return null; }
}
function savedOrderSnapshot() {
  if (savedSnapshot === undefined) savedSnapshot = readOrder();
  return savedSnapshot;
}
function persist() {
  try { localStorage.setItem(KEY(canvasId), JSON.stringify({ order: order.slice() })); } catch (e) { /* 吞錯，不阻斷互動 */ }
}
function applyRanks() {
  // 最上層 surface 標記 is-stack-top（第五期材質層的鉤子：高度可讀/聚焦表現吃它；
  // 預設樣式全關，標記本身零視覺變化）。
  const topKey = order.length ? order[order.length - 1] : null;
  order.forEach((key, rank) => {
    const s = surfaces.get(key);
    if (!s) return;
    // 以「目前 surface 集合」為 class 權威，每次都補回 class（idempotent add）。這樣即使
    // 同一 render pass 內 pane 換手（surface A 認養某 pane、surface B 因 stale existing.pane
    // 又把它的 class 移掉，審查 #1/#2），applyRanks 會替仍擁有該 pane 的 A 重新加回，
    // 不留下「有 --stack-rank 卻無 class → z-index:auto、藏到視窗框後」的隱形 pane。
    s.el.classList.add('gl-stack-surface');
    s.el.style.setProperty('--stack-rank', String(rank));
    s.el.classList.toggle('is-stack-top', key === topKey);
    if (s.pane) {
      s.pane.classList.add('gl-stack-pane');
      s.pane.style.setProperty('--stack-rank', String(rank));
      s.pane.classList.toggle('is-stack-top', key === topKey);
    }
  });
}

export const stack = {
  setCanvasId(id) {
    const next = id || 'cs';
    if (next !== canvasId) { canvasId = next; savedSnapshot = undefined; } // 換畫布 → 重讀快照
  },

  register(key, el, opts = {}) {
    if (!key || !el) return;
    const existing = surfaces.get(key);
    if (existing) {
      // 同 key 再註冊 = 更新元素/pane 指向（例：tab 視窗切換 active pane），
      // 不動疊序、不重新持久化 order。
      if (existing.pane && existing.pane !== (opts.pane || null)) {
        existing.pane.classList.remove('gl-stack-pane');
        existing.pane.style.removeProperty('--stack-rank');
      }
      existing.el = el;
      existing.pane = opts.pane || null;
      el.classList.add('gl-stack-surface');
      if (existing.pane) existing.pane.classList.add('gl-stack-pane');
      applyRanks();
      return;
    }

    const rank = Number.isFinite(opts.initialRank) ? opts.initialRank : order.length;
    surfaces.set(key, { el, pane: opts.pane || null, levels: opts.levels || 1, _initialRank: rank });
    el.classList.add('gl-stack-surface');
    if (opts.pane) opts.pane.classList.add('gl-stack-pane');

    const saved = savedOrderSnapshot();
    const savedIdx = saved ? saved.indexOf(key) : -1;
    if (savedIdx !== -1) {
      // 依存檔相對位置插入：排在「存檔位置比我前面且已註冊」的最後一個之後。
      let insertAt = 0;
      for (let i = 0; i < order.length; i++) {
        const oi = saved.indexOf(order[i]);
        if (oi !== -1 && oi < savedIdx) insertAt = i + 1;
      }
      order.splice(insertAt, 0, key);
    } else {
      // 無存檔位置：依 initialRank 插入（大者在上）。
      let insertAt = order.length;
      for (let i = 0; i < order.length; i++) {
        const s = surfaces.get(order[i]);
        if (s && s._initialRank > rank) { insertAt = i; break; }
      }
      order.splice(insertAt, 0, key);
    }
    applyRanks();
    persist();
  },

  // quiet=true：批次拆除（登出/destroy）用——不 persist。若每筆都 persist，登出逐一
  // unregister 會把 order 一路縮小、最後覆寫存檔成殘缺/空，抹掉使用者已持久化的點擊
  // 置頂順序（同屬持久化的 layout/windows key 登出時都保留不變）（審查 #3）。
  // quiet=false（預設）：單筆移除（合併/撕離空視窗）用——要 persist 把死 key 從存檔
  // 去除，否則存檔累積死 key（審查 #4/#6）。
  unregister(key, quiet) {
    const s = surfaces.get(key);
    if (s) {
      s.el.classList.remove('gl-stack-surface', 'is-stack-top');
      s.el.style.removeProperty('--stack-rank');
      if (s.pane) { s.pane.classList.remove('gl-stack-pane', 'is-stack-top'); s.pane.style.removeProperty('--stack-rank'); }
    }
    surfaces.delete(key);
    order = order.filter((k) => k !== key);
    applyRanks();
    // 全部拆除（登出，surfaces 清空）時重置快照，讓下一輪（同頁再登入）重讀「最新」
    // 存檔而非沿用頁載當時的舊快照（審查 #5）。
    if (surfaces.size === 0) savedSnapshot = undefined;
    if (!quiet) persist();
  },

  raise(key) {
    if (!surfaces.has(key)) return;
    const idx = order.indexOf(key);
    if (idx === order.length - 1) return; // 已在最上層
    if (idx !== -1) order.splice(idx, 1);
    order.push(key);
    applyRanks();
    persist();
  },

  reset() {
    try { localStorage.removeItem(KEY(canvasId)); } catch (e) { /* noop */ }
    savedSnapshot = null; // 已清存檔，之後 register 走 initialRank

    // 依各 surface 的初始名次重排回預設。
    order.sort((a, b) => ((surfaces.get(a) && surfaces.get(a)._initialRank) || 0) - ((surfaces.get(b) && surfaces.get(b)._initialRank) || 0));
    applyRanks();
    persist();
  },
};

if (typeof window !== 'undefined') window.CanvasStack = stack;
