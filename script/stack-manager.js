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

const KEY = (id) => `cspanel.stack.${id}.v1`;

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
  order.forEach((key, rank) => {
    const s = surfaces.get(key);
    if (!s) return;
    s.el.style.setProperty('--stack-rank', String(rank));
    if (s.pane) s.pane.style.setProperty('--stack-rank', String(rank));
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

  unregister(key) {
    const s = surfaces.get(key);
    if (s) {
      s.el.classList.remove('gl-stack-surface');
      s.el.style.removeProperty('--stack-rank');
      if (s.pane) { s.pane.classList.remove('gl-stack-pane'); s.pane.style.removeProperty('--stack-rank'); }
    }
    surfaces.delete(key);
    order = order.filter((k) => k !== key);
    applyRanks();
    persist();
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
