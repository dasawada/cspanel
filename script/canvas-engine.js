// Canvas Engine — 泛化自 firework-mediator.js（認證調度邏輯原樣保留）。
// 職責：slot 生成、幾何注入（manifest 為唯一座標權威）、init/clear 調度、
//       編輯模式（enter/exitEditMode，Task 6 實作）。
import { makeDraggable } from './draggable.js';

const LAYOUT_KEY = (canvasId) => `cspanel.layout.${canvasId}.v1`;

let activeCanvas = null; // { manifest, mods: Map<panelId, module>, editing: false }

// ===== 全域認證狀態管理（原 mediator:20-88 逐字，僅 log 前綴 Mediator→Engine） =====
let globalAuthInterceptor = null;
let authCheckInterval = null;
const AUTH_CHECK_INTERVAL_MS = 60000; // 每 60 秒檢查一次

// ===== 全域點擊攔截器 =====
function setupGlobalAuthInterceptor() {
  if (globalAuthInterceptor) return;

  globalAuthInterceptor = async (e) => {
    const target = e.target;
    const isInteractive = target.closest('button, a, [onclick], [role="button"], .clickable, input[type="submit"], input[type="button"]');

    if (!isInteractive) return;

    if (typeof window.verifyFireworkAuth === 'function') {
      const isValid = await window.verifyFireworkAuth();
      if (!isValid) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log('⛔ [Engine] 全域攔截：帳號已失效，操作被阻止');
        return false;
      }
    }
  };

  document.addEventListener('click', globalAuthInterceptor, true);
  console.log('Engine: 已啟用全域認證攔截器 🛡️');
}

function removeGlobalAuthInterceptor() {
  if (globalAuthInterceptor) {
    document.removeEventListener('click', globalAuthInterceptor, true);
    globalAuthInterceptor = null;
    console.log('Engine: 已移除全域認證攔截器');
  }
}

// ===== 定期背景認證檢查 =====
function startPeriodicAuthCheck() {
  if (authCheckInterval) return;

  authCheckInterval = setInterval(async () => {
    console.log('Engine: 執行定期認證檢查...');
    if (typeof window.verifyFireworkAuth === 'function') {
      const isValid = await window.verifyFireworkAuth();
      if (!isValid) {
        console.log('⛔ [Engine] 定期檢查發現帳號已失效');
        stopPeriodicAuthCheck();
      }
    }
  }, AUTH_CHECK_INTERVAL_MS);

  console.log(`Engine: 已啟動定期認證檢查（每 ${AUTH_CHECK_INTERVAL_MS / 1000} 秒）⏰`);
}

function stopPeriodicAuthCheck() {
  if (authCheckInterval) {
    clearInterval(authCheckInterval);
    authCheckInterval = null;
    console.log('Engine: 已停止定期認證檢查');
  }
}

// ===== 狀態廣播工具 =====
function broadcastAuthState(state) {
  window.dispatchEvent(new CustomEvent('fw-auth-state-change', { detail: { state } }));
}

// ===== manifest 驗證 =====
function validateManifest(m) {
  const bad = [];
  const seen = new Set();
  for (const p of m.panels || []) {
    if (!p.id || seen.has(p.id)) { bad.push(`${p.id || '(no id)'}: id 缺失或重複`); continue; }
    seen.add(p.id);
    if (!p.module || !p.init || !p.clear) bad.push(`${p.id}: module/init/clear 缺失`);
  }
  return bad;
}

// ===== slot 生成 =====
function buildSlots(manifest) {
  const container = document.querySelector('.panel_all_container');
  if (!container) throw new Error('Engine: .panel_all_container 不存在');
  for (const p of manifest.panels) {
    for (const slotId of [p.slot, ...(p.extraSlots || [])]) {
      if (!slotId) continue;
      if (!document.getElementById(slotId)) {
        const div = document.createElement('div');
        div.id = slotId;
        div.className = 'gl-canvas-slot';
        container.appendChild(div);
      } else {
        document.getElementById(slotId).classList.add('gl-canvas-slot');
      }
    }
  }
}

// ===== 幾何注入（manifest 座標 + 使用者佈局覆蓋） =====
function readLayout(canvasId) {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY(canvasId));
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : {};
  } catch (e) { return {}; }
}
function emitGeometry(manifest, layout) {
  const prev = document.getElementById('canvas-geometry');
  if (prev) prev.remove();
  let css = manifest.sharedGeometryCss || '';
  for (const p of manifest.panels) {
    if (p.geometryCss) css += '\n' + p.geometryCss;
    if (p.rootSelector && typeof p.zOrder === 'number') {
      css += `\n${p.rootSelector} { z-index: calc(var(--layer-panel) + ${p.zOrder}); }`;
    }
    const saved = layout[p.id];
    if (saved && p.rootSelector && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      css += `\n${p.rootSelector} { left: ${saved.x}px; top: ${saved.y}px; }`;
    }
  }
  const style = document.createElement('style');
  style.id = 'canvas-geometry';
  style.textContent = css;
  document.head.appendChild(style);
}

// ===== 模組載入與調度 =====
async function loadModules(manifest) {
  const mods = new Map();
  for (const p of manifest.panels) {
    try {
      mods.set(p.id, await import(p.module));
    } catch (e) {
      console.warn(`Engine: 模組載入失敗，跳過面板 ${p.id}`, e);
      if (window.showFireworkToast) window.showFireworkToast(`面板「${p.id}」載入失敗`, 'warning');
    }
  }
  return mods;
}
async function initAllModules() {
  const { manifest, mods } = activeCanvas;
  console.log('Engine: 初始化登入後模組...');
  broadcastAuthState('login-start');
  setupGlobalAuthInterceptor();
  startPeriodicAuthCheck();
  // 同步先行者（原 mediator:99）
  for (const p of manifest.panels) {
    if (!p.syncInit) continue;
    const m = mods.get(p.id);
    if (m && m[p.init]) { try { m[p.init](...(p.initArgs || [])); } catch (e) { console.error(`${p.init} 失敗:`, e); } }
  }
  await Promise.allSettled(
    manifest.panels.filter((p) => !p.syncInit).map((p) => {
      const m = mods.get(p.id);
      if (!m || !m[p.init]) return Promise.resolve();
      return Promise.resolve(m[p.init](...(p.initArgs || [])));
    })
  );
  broadcastAuthState('login-ready');
  console.log('Engine: 所有模組初始化完成 ✅');
}
function clearAllModules() {
  const { manifest, mods } = activeCanvas;
  console.log('Engine: 清理模組...');
  broadcastAuthState('logout-start');
  removeGlobalAuthInterceptor();
  stopPeriodicAuthCheck();
  for (const p of manifest.panels) {
    const m = mods.get(p.id);
    if (!m || !m[p.clear]) continue;
    try { m[p.clear](...(p.clearArgs || [])); } catch (e) { console.error(`${p.clear} 失敗:`, e); }
  }
  broadcastAuthState('logout-complete');
  console.log('Engine: 所有模組已清理 🧹');
}

// ===== 編輯模式 =====
const editState = { detachers: [] };
function panelRoots(manifest) {
  return manifest.panels
    .filter((p) => p.rootSelector && (p.behaviors || []).includes('draggable') && !p.alwaysDraggable)
    .map((p) => ({ p, el: document.querySelector(p.rootSelector) }))
    .filter((x) => x.el);
}
function saveLayoutEntry(canvasId, panelId, pos) {
  const layout = readLayout(canvasId);
  layout[panelId] = { x: pos.left, y: pos.top };
  try { localStorage.setItem(LAYOUT_KEY(canvasId), JSON.stringify(layout)); } catch (e) {}
}
export function enterEditMode() {
  if (!activeCanvas || activeCanvas.editing) return;
  activeCanvas.editing = true;
  document.documentElement.classList.add('canvas-editing');
  ensureEditBar();
  for (const { p, el } of panelRoots(activeCanvas.manifest)) {
    el.classList.add('gl-editable');
    const handle = document.createElement('div');
    handle.className = 'gl-edit-handle';
    handle.textContent = p.id;
    el.appendChild(handle);
    // persist:false —— 編輯把手的位置權威是引擎自身的統一 layout
    // （由 onPositionChange 寫入 LAYOUT_KEY），draggable.js 不應再讀寫
    // 各面板獨立的 draggable:<path>:<id> key（見檔案內註解與任務報告）。
    makeDraggable(el, handle, {
      color: 'accent',
      persist: false,
      onPositionChange: (pos) => saveLayoutEntry(activeCanvas.manifest.id, p.id, pos),
    });
    editState.detachers.push(() => { handle.remove(); el.classList.remove('gl-editable'); });
  }
}
export function exitEditMode() {
  if (!activeCanvas || !activeCanvas.editing) return;
  activeCanvas.editing = false;
  document.documentElement.classList.remove('canvas-editing');
  editState.detachers.forEach((fn) => fn());
  editState.detachers = [];
  emitGeometry(activeCanvas.manifest, readLayout(activeCanvas.manifest.id));
  for (const { el } of panelRoots(activeCanvas.manifest)) { el.style.left = ''; el.style.top = ''; }
}
export function resetLayout() {
  if (!activeCanvas) return;
  try { localStorage.removeItem(LAYOUT_KEY(activeCanvas.manifest.id)); } catch (e) {}
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const { el } of panelRoots(activeCanvas.manifest)) {
    if (!reduced) {
      el.style.transition = 'left 0.4s cubic-bezier(0.22,1,0.36,1), top 0.4s cubic-bezier(0.22,1,0.36,1)';
      setTimeout(() => { el.style.transition = ''; }, 450);
    }
    el.style.left = ''; el.style.top = '';
  }
  emitGeometry(activeCanvas.manifest, {});
}
function ensureEditBar() {
  if (document.getElementById('gl-edit-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'gl-edit-bar';
  bar.innerHTML = `<span style="font-size:12px;color:var(--fg-2)">編排模式</span>
    <button type="button" class="gl-edit-reset">重設佈局</button>
    <button type="button" class="gl-edit-done">完成</button>`;
  document.body.appendChild(bar);
  bar.querySelector('.gl-edit-done').addEventListener('click', () => exitEditMode());
  bar.querySelector('.gl-edit-reset').addEventListener('click', () => resetLayout());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeCanvas && activeCanvas.editing) exitEditMode();
  });
}
window.CanvasEdit = {
  toggle: () => (activeCanvas && activeCanvas.editing ? exitEditMode() : enterEditMode()),
  enter: enterEditMode, exit: exitEditMode, reset: resetLayout,
};

// ===== 入口 =====
export async function loadCanvas(manifest) {
  const problems = validateManifest(manifest);
  if (problems.length) {
    console.warn('Engine: manifest 異常，問題面板將被跳過', problems);
    manifest = { ...manifest, panels: manifest.panels.filter((p) => p.id && p.module && p.init && p.clear) };
  }
  buildSlots(manifest);

  // 話術面板（canned）舊版每頁獨立 storage key 一次性遷移入統一 layout
  // （不刪舊 key——canned 自身仍以 quirks:['self-persisted'] 走原本機制）
  const oldCanned = localStorage.getItem(`draggable:${location.pathname}:canned-panel-main`);
  if (oldCanned && !readLayout(manifest.id).canned) {
    try {
      const p = JSON.parse(oldCanned);
      saveLayoutEntry(manifest.id, 'canned', { left: p.left, top: p.top });
    } catch (e) {}
  }
  const layout = readLayout(manifest.id);
  const cannedPanel = manifest.panels.find((x) => x.id === 'canned');
  if (layout.canned && cannedPanel) {
    cannedPanel.initArgs = [null, { left: layout.canned.x, top: layout.canned.y }];
  }

  emitGeometry(manifest, layout);
  const mods = await loadModules(manifest);
  activeCanvas = { manifest, mods, editing: false };

  window.addEventListener('firework-login-success', () => { initAllModules(); });
  window.addEventListener('firework-logout-success', () => { exitEditMode(); clearAllModules(); });

  // 原 mediator checkExistingAuth（mediator.js:163-185 逐字搬入）
  (async function checkExistingAuth() {
    broadcastAuthState('init-logged-out');

    const waitForFirebase = () => {
      return new Promise((resolve) => {
        const check = () => {
          if (window.firebase?.auth) {
            resolve();
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });
    };

    await waitForFirebase();

    const token = localStorage.getItem('firebase_id_token');
    if (token) {
      await initAllModules();
    }
  })();
}
