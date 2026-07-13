// Canvas Engine — 泛化自 firework-mediator.js（認證調度邏輯原樣保留）。
// 職責：slot 生成、幾何注入（manifest 為唯一座標權威）、init/clear 調度、
//       編輯模式（enter/exitEditMode，Task 6 實作）。
import { makeDraggable } from './draggable.js';
import { stack } from './stack-manager.js';

const LAYOUT_KEY = (canvasId, ver = 'v1') => `cspanel.layout.${canvasId}.${ver}`;
// 九期B Task 3：pages store 固定 `.v1` 尾碼——不比照 layout/windows/stack 隨
// storageVersion 分流。理由：pages 是全新 schema（v1 引擎從未寫過、也不會讀），
// 沒有既有 v1 資料需要隔離；PageEngine 本身即 v2 模式限定（pageEngine 關閉時
// window.PageEngine 的所有函式一律安全 no-op），單一固定 key 已足夠（spec §7）。
const PAGES_KEY = (canvasId) => `cspanel.pages.${canvasId}.v1`;

let activeCanvas = null; // { manifest, mods: Map<panelId, module>, editing: false, config }
// 九期B Task 7 修復：initAllModules() 在同一次頁面載入可能被呼叫兩次——
// checkExistingAuth() 的 IIFE 見到 localStorage 已有 firebase_id_token 會直接呼叫
// 一次；fireworkeffect.js 的 firebase.auth().onAuthStateChanged 之後又會
// dispatchEvent('firework-login-success')，觸發 loadCanvas() 掛的另一個監聽器
// 再呼叫一次（見下方 loadCanvas 內兩處呼叫點）。多數面板 init/registerPanelStack
// 對重入是安全的（joinMember／stack.register 皆有「已存在」的冪等分支），但 v2
// 模式下的 WindowManager 掛載本身沒有這種冪等性——`mountWindowManager()` 每次呼叫
// 都會建一份全新的模組級閉包狀態＋一個新的 DOM layer；下方原本的
// `!window.WindowManager` 檢查與實際指派（發生在 `await import(...)` 之後）之間
// 有一段可被搶入的非同步縫隙：若兩次 initAllModules() 呼叫都在對方完成指派前讀到
// `window.WindowManager` 仍是 undefined，會各自掛載一份，產生兩份重疊的
// `.wm-window` DOM（同一批視窗座標各兩份）——後掛載者覆寫全域 `window.WindowManager`
// 參照，但先掛載者的 DOM／內部監聽器從未被清理，導致「頁 tab 拖曳合併」等操作
// 命中的是舊份實例的 tabBarAt()（看不到新份的視窗），偶發性把合併誤判成撕離
// （page-engine-b-test.mjs H3 區揪出，重載後偶發触發，機率視模組載入時序而定）。
// 用一個同步搶佔旗標關閉這段縫隙：進入掛載分支「當下」（await 之前）就搶佔，
// 第二次呼叫即使 `window.WindowManager` 仍是 undefined 也會被這個旗標擋下。
// 只在 v2（pageEngine）模式使用，登出時對稱重置（見 clearAllModules），v1 模式
// 完全不受影響（該分支本就不會被 v1 進入）。
let wmMountClaimed = false;

// 九期A：儲存版本（v1/v2）一律以 activeCanvas.config.storageVersion 為準（loadCanvas
// 正規化寫入），未設定（尚未 loadCanvas，或呼叫端沒傳 config）預設 'v1' —— production
// （panel_all.html 不傳 config）因此永遠讀寫 .v1 key，行為零變化。
function layoutVer() { return activeCanvas?.config?.storageVersion || 'v1'; }

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
// 回傳「有問題面板」清單，每筆帶 index（在 manifest.panels 陣列中的位置）
// 與人類可讀的 reason，讓呼叫端（loadCanvas）能精準依 index 過濾——
// 重複 id 只丟棄後出現的那幾筆，第一筆（seen 尚未記錄時遇到的那筆）視為
// 合法保留，行為才會跟這裡的警告訊息（「重複」）一致。
function validateManifest(m) {
  const bad = [];
  const seen = new Set();
  (m.panels || []).forEach((p, index) => {
    if (!p.id || seen.has(p.id)) { bad.push({ index, id: p.id, reason: `${p.id || '(no id)'}: id 缺失或重複` }); return; }
    seen.add(p.id);
    if (!p.module || !p.init || !p.clear) bad.push({ index, id: p.id, reason: `${p.id}: module/init/clear 缺失` });
  });
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
function readLayout(canvasId, ver) {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY(canvasId, ver));
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
    // 第四期：不再注入 `${rootSelector} { z-index: calc(--layer-panel + zOrder) }`。
    // 面板疊序改由 stack-manager 以 .gl-stack-surface + --stack-rank 動態供給
    // （見 style/v2/stack.css / stack-manager.js）；zOrder 降級為 registerPanelStack
    // 計算 initialRank 的初始名次來源。若仍在此注入，其 canvas-geometry <style>
    // 排在 stack.css 之後、特異度相同（0-1-0），會靜默遮蔽 .gl-stack-surface，
    // 使動態疊序完全失效（headless 實測抓到：raise 不改 z）。
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
  // 九期B Task 2／九期B 終審 C1 修復：v2 模式下 wm 核心無條件掛載（可零 tab 啟動）；
  // auth-protected-tabs 稍後注入伺服器內容完成時呼叫 WindowManager.adoptTabs()
  // 認養 iframe tabs（見 auth-protected-tabs.js glDecorate 交棒點）。host 與
  // auth-protected-tabs 傳給 mountWindowManager 的是同一個 placeholder（grep 確認）。
  // 【時序鐵律（C1）】本掛載必須在下方 await Promise.allSettled(...) 之「前」完成——
  // 'protected' 面板的 initProtectedTabs 就在該等待集內，其 fetch 成功後的 v2
  // 交棒點假設 window.WindowManager 已存在才能 adoptTabs；掛載若排在 allSettled
  // 之後（原 Task 2 位置），真伺服器路徑（success:true）下交棒點必然撲空、落入
  // fallback 裸掛載（無 canvasId/pageHost/isPageId opts）：isPageId 恆 false 使
  // loadWindows 淨化掉全部 'pg:' tab（下一次 persist 即永久丟失）、pageHost null
  // 使 page tab 淪為裸 id、syncPanes 跳過成員定位——page 引擎生產路徑整組癱瘓。
  // 這正是計畫「v2 核心無條件起」「核心必已由引擎先掛」（plan Task 2）的原意；
  // 掛載時本 placeholder 尚空（伺服器內容未注入）→ 零 tab 啟動，是 Task 2 設計
  // 明文支援的形態。page-engine-b-test.mjs J 區（success:true）覆蓋本時序。
  // 以 !window.WindowManager ＋ wmMountClaimed 同步搶佔防重複掛載（見檔頭
  // wmMountClaimed 註解），clearAllModules 登出時對稱重置。v1 模式
  // （config.pageEngine 恆 false）完全不進這個分支，零變化。
  if (activeCanvas.config.pageEngine) {
    const wmHost = document.getElementById('auth-protected-tabs-placeholder');
    if (wmHost && !window.WindowManager && !wmMountClaimed) {
      wmMountClaimed = true; // 同步搶佔（見上方 wmMountClaimed 檔頭註解）——關掉 await import() 造成的競態縫隙
      try {
        // stack 疊序存檔 key 先對準本畫布：mount 內 render() 會 stack.register
        // 視窗，而 registerPanelStack()（原本的掛載時序中先於 mount）要到
        // allSettled 之後才呼叫 setCanvasId。同 id 重複呼叫為 no-op，不影響快照。
        stack.setCanvasId(activeCanvas.manifest.id);
        const { mountWindowManager } = await import('./window-manager.js');
        // 二次檢查：理論上不會發生（搶佔已同步關閉縫隙），仍防呆——若 await 期間
        // 已有別的路徑完成掛載，不重複 mount，避免蓋掉已認養好 tab 的實例。
        if (!window.WindowManager) {
          // 九期B Task 3：isPageId／pageHost 掛點——isKnownPageId 查 pages store
          // （loadWindows 淨化用）；pageHostImpl 是 getTitle/layout/onPageEmpty 的
          // 引擎端實作（wm 不懂面板，全部經此委派，見 window-manager.js 檔頭註解）。
          mountWindowManager(wmHost, { canvasId: activeCanvas.manifest.id, isPageId: isKnownPageId, pageHost: pageHostImpl });
        }
      } catch (e) { console.error('WindowManager 核心掛載失敗:', e); }
    }
  }
  await Promise.allSettled(
    manifest.panels.filter((p) => !p.syncInit).map((p) => {
      const m = mods.get(p.id);
      if (!m || !m[p.init]) return Promise.resolve();
      return Promise.resolve(m[p.init](...(p.initArgs || [])));
    })
  );
  registerPanelStack();
  if (activeCanvas.config.pageEngine) {
    // 每次登入（含重新整理已登入態）都跑：registerPanelStack() 剛把「目前是
    // page 成員」的面板當成個別 surface 重新註冊過一輪，這裡把持久化 pages
    // store 記得的成員關係重新 joinMember 回去，復原分組疊序不變式。
    // （wm 核心此刻必已掛載——見上方 allSettled 之前的 C1 掛載段。）
    hydratePageJoins();
  }
  attachHoverHandles();
  broadcastAuthState('login-ready');
  console.log('Engine: 所有模組初始化完成 ✅');
  if (activeCanvas.config.pageEngine) {
    const btn = document.getElementById('fw-edit-btn');
    if (btn) { btn.title = '重設佈局'; btn.setAttribute('aria-label', '重設佈局'); }
  }
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
  // 九期B Task 2：對稱 initAllModules 的無條件核心掛載——v2 模式下 wm 生命權在
  // canvas-engine，登出時一併拆除。v1 模式：destroy 仍由 clearProtectedTabs 呼叫
  // 既有的 windowManager 參照（此處 config.pageEngine 恆 false，完全不進這個分支）。
  if (activeCanvas.config.pageEngine) {
    resetPageJoins(); // 卸除入組監聽器（不清 pages store——持久化跨登出保留，見 spec §7）
    if (window.WindowManager) {
      try { window.WindowManager.destroy(); } catch (e) { console.error('WindowManager destroy 失敗:', e); }
    }
    wmMountClaimed = false; // 對稱重置（見上方 wmMountClaimed 檔頭註解）：允許下次登入重新掛載
  }
  detachHoverHandles();
  unregisterPanelStack();
  broadcastAuthState('logout-complete');
  console.log('Engine: 所有模組已清理 🧹');
}

// ===== 統一動態疊序註冊（第四期）=====
// surface = 有 rootSelector 的面板；點擊該面板任何處（pointerdown capture）即
// stack.raise 提到最上層（面板 ↔ tab 視窗同一套疊序）。initialRank 依
// (zOrder 升冪、同值依 panels[] 陣列序) 換算成連續名次，讓初始疊序等同舊 zOrder
// 相對高低與 §4.2 tie 規則（陣列後者在上）。
const stackRaisers = [];
function registerPanelStack() {
  if (!activeCanvas) return;
  stack.setCanvasId(activeCanvas.manifest.id);
  activeCanvas.manifest.panels
    .map((p, i) => ({ p, i, el: p.rootSelector ? document.querySelector(p.rootSelector) : null }))
    .filter((x) => x.el)
    .sort((a, b) => ((a.p.zOrder || 0) - (b.p.zOrder || 0)) || (a.i - b.i))
    .forEach((x, rank) => {
      stack.register(x.p.id, x.el, { initialRank: rank });
      const handler = () => stack.raise(x.p.id);
      x.el.addEventListener('pointerdown', handler, true);
      stackRaisers.push({ el: x.el, handler, id: x.p.id });
    });
}
function unregisterPanelStack() {
  stackRaisers.forEach(({ el, handler, id }) => {
    el.removeEventListener('pointerdown', handler, true);
    stack.unregister(id, true); // 登出批次拆除：quiet，不 persist（保住使用者的疊序存檔）
  });
  stackRaisers.length = 0;
}

// ===== 九期B Task 3：page 模型＋pageHost 介面 =====
// pages store：純資料陣列，讀寫皆走 PAGES_KEY（固定 .v1，見上）。v2 模式限定
// （pageEngineOn() 為 false 時所有 PageEngine 函式安全 no-op，不讀寫此 key）。
function readPages(canvasId) {
  try {
    const raw = localStorage.getItem(PAGES_KEY(canvasId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function writePages(canvasId, pages) {
  try { localStorage.setItem(PAGES_KEY(canvasId), JSON.stringify(pages)); } catch (e) { /* 吞錯，不阻斷互動 */ }
}
let pageIdSeq = 0;
function genPageId() {
  pageIdSeq += 1;
  return 'pg:' + Date.now().toString(36) + pageIdSeq.toString(36) + Math.random().toString(36).slice(2, 6);
}
function pageEngineOn() { return !!activeCanvas?.config?.pageEngine; }
function getPage(pageId) {
  if (!activeCanvas) return null;
  return readPages(activeCanvas.manifest.id).find((pg) => pg.id === pageId) || null;
}
function isKnownPageId(id) { return !!getPage(id); }
function removePageFromStore(pageId) {
  if (!activeCanvas) return null;
  const canvasId = activeCanvas.manifest.id;
  const pages = readPages(canvasId);
  const idx = pages.findIndex((pg) => pg.id === pageId);
  if (idx === -1) return null;
  const [page] = pages.splice(idx, 1);
  writePages(canvasId, pages);
  return page;
}
function labelFor(panelId) {
  const p = activeCanvas?.manifest?.panels.find((x) => x.id === panelId);
  return (p && (p.label || p.id)) || panelId;
}
function computeTitle(memberIds) { return memberIds.map(labelFor).join('・'); }
function elFor(panelId) {
  const p = activeCanvas?.manifest?.panels.find((x) => x.id === panelId);
  return p && p.rootSelector ? document.querySelector(p.rootSelector) : null;
}
function spaceGapPx() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--space-4');
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 8; // 8px 為 tokens.css --space-4 現值，供 token 讀取失敗時降級
}

// 成員入組期間：自 stack-manager 個別疊序身分退場（拆 registerPanelStack 掛的
// pointerdown raiser＋stack.unregister），改掛「點擊＝置頂宿主視窗」監聽器。
// hostWinId 僅為初始值——raiseHandler 每次觸發都透過 WindowManager.findWindowForTab
// 動態查目前所屬視窗（頁可能已被拖去合併/撕離，Task 4/7 場景），避免存活期間
// 積累的 stale 參照。panelId -> { el, raiseHandler, pageId }。
const pageJoins = new Map();
// 九期B Task 6：quirks 歸隊——detachedRect（spec §7：「面板畫布座標＋
// detachedRect（離組恢復用）」）。panelId -> {left, top}，入組「當下」（尚未被
// pageHost.layout 接管改寫之前）捕捉一次，退組時原樣寫回（含 body-mounted 罐頭
// 同樣成立——captureDetachedRect 只讀 inline style／offsetLeft/Top，不管
// containing block）。純記憶體狀態（不持久化）：跨登出/reload 後若面板已是
// page 成員，hydratePageJoins 重新 joinMember 時不會補捕（它本就不是「即將
// 退組」的操作），該次退組會安全落回舊行為（清 inline style、回 CSS 幾何）。
const detachedRects = new Map();
function captureDetachedRect(panelId) {
  const el = elFor(panelId);
  if (!el) return null;
  const left = el.style.left ? parseFloat(el.style.left) : el.offsetLeft;
  const top = el.style.top ? parseFloat(el.style.top) : el.offsetTop;
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
  return { left, top };
}
// 九期B Task 6：quirks 歸隊——self-persisted 面板（目前僅罐頭）入組期間暫停其
// 自身 per-path 儲存寫入（見 dragb_msg_pnl.js setSelfPersistPaused 檔頭註解），
// 退組時恢復。經 manifest quirks 掛點動態尋找模組匯出的 setSelfPersistPaused，
// 泛化於「任何 quirks 含 self-persisted 且匯出同名函式」的面板，非寫死罐頭
// 字面（目前唯一符合者是罐頭）。
function setQuirkPersistPaused(panelId, paused) {
  const entry = activeCanvas?.manifest?.panels.find((p) => p.id === panelId);
  if (!entry || !(entry.quirks || []).includes('self-persisted')) return;
  const mod = activeCanvas.mods.get(panelId);
  if (mod && typeof mod.setSelfPersistPaused === 'function') mod.setSelfPersistPaused(paused);
}
function joinMember(panelId, pageId, hostWinId) {
  const el = elFor(panelId);
  if (!el) return;
  setQuirkPersistPaused(panelId, true);
  const existing = pageJoins.get(panelId);
  if (existing) el.removeEventListener('pointerdown', existing.raiseHandler, true); // 防呆：重複 join（addMember 冪等路徑）
  const raiserIdx = stackRaisers.findIndex((r) => r.id === panelId);
  if (raiserIdx !== -1) {
    const r = stackRaisers[raiserIdx];
    r.el.removeEventListener('pointerdown', r.handler, true);
    stackRaisers.splice(raiserIdx, 1);
  }
  stack.unregister(panelId);
  // 九期B 回饋輪 Task 1：抑制入組期間的 CSS transition——sharedGeometryCss／
  // dt geometryCss 的 transition:all 0.3s ease（cs.js 字面不動，v1 頁沿用）讓
  // pageHost.layout 每幀寫入的 inline left/top 被動畫追趕，拖曳頁視窗移動時
  // 成員視覺「慢一拍」。inline transition:none 勝過所有樣式表，退組時還原。
  // 記錄原始 inline 值（通常空字串）於 pageJoins entry，供 leaveMember 還原；
  // 冪等重入（existing 已存在，例：hydratePageJoins 在同一 session 重複登入時
  // 對「仍是同一 DOM 節點」的面板重新 joinMember）沿用舊值，避免把「上次入組
  // 已被覆寫成 none」的髒值誤記成原始值。
  const transitionBefore = existing ? existing.transitionBefore : el.style.transition;
  el.style.transition = 'none';
  const raiseHandler = () => {
    const wm = window.WindowManager;
    const winId = (wm && typeof wm.findWindowForTab === 'function' && wm.findWindowForTab(pageId)) || hostWinId;
    if (winId) stack.raise(winId);
    // 成員自身的 --stack-rank 不隨 stack.raise 自動更新（它不是 stack-manager
    // 認得的 pane 參照——一個宿主視窗對多名成員，非 1:1）；raise 後立即重跑
    // syncPanes()（同步、非 rAF 節流）讓 pageHost.layout 重新讀取宿主最新
    // rank 蓋回成員，點擊成員置頂才會「看起來」也置頂。
    if (wm && typeof wm.syncPanes === 'function') wm.syncPanes();
  };
  el.addEventListener('pointerdown', raiseHandler, true);
  pageJoins.set(panelId, { el, raiseHandler, pageId, transitionBefore });
}
// 退組：卸除 join 監聽器＋清成員身上由 layout() 寫入的定位/疊序 inline 樣式，
// 重新掛回個別 stack 疊序身分（比照 registerPanelStack 的註冊形狀）。九期B
// Task 6：若入組當下捕捉過 detachedRect，明確寫回該座標（並同步進統一 layout
// store，spec §7「退組時恢復並以 detachedRect 寫回統一 layout」）——比單純清
// inline style（回落 canvas-geometry，僅在面板入組前從未被拖過時才等價於
// detachedRect）更精確；沒有捕捉到時（例：hydratePageJoins 重新登入路徑）安全
// 落回舊行為。
function leaveMember(panelId) {
  const join = pageJoins.get(panelId);
  if (!join) return;
  join.el.removeEventListener('pointerdown', join.raiseHandler, true);
  pageJoins.delete(panelId);
  setQuirkPersistPaused(panelId, false);
  const el = join.el;
  // 九期B 回饋輪 Task 1：還原 joinMember 記錄的原始 inline transition（通常
  // 空字串——賦值等同 removeProperty，回落 CSS 幾何的 0.3s，v1 語義不變）。
  el.style.transition = join.transitionBefore;
  const detached = detachedRects.get(panelId);
  detachedRects.delete(panelId);
  if (detached) {
    el.style.left = detached.left + 'px';
    el.style.top = detached.top + 'px';
    el.style.removeProperty('display');
    if (activeCanvas) saveLayoutEntry(activeCanvas.manifest.id, panelId, detached);
  } else {
    el.style.removeProperty('left');
    el.style.removeProperty('top');
    el.style.removeProperty('display');
  }
  el.classList.remove('gl-stack-pane', 'is-stack-top');
  el.style.removeProperty('--stack-rank');
  const manifestEntry = activeCanvas?.manifest?.panels.find((p) => p.id === panelId);
  if (manifestEntry && manifestEntry.rootSelector) {
    stack.register(panelId, el, {});
    const handler = () => stack.raise(panelId);
    el.addEventListener('pointerdown', handler, true);
    stackRaisers.push({ el, handler, id: panelId });
  }
}
// 登出：卸除所有入組監聽器（不清 pages store——持久化跨登出保留，見 spec §7）。
function resetPageJoins() {
  pageJoins.forEach((join) => join.el.removeEventListener('pointerdown', join.raiseHandler, true));
  pageJoins.clear();
}
// 重新登入／頁面已登入時：pages store 是持久化的（跨登出保留），但
// registerPanelStack() 每次登入都會把「目前是 page 成員」的面板重新當成
// 個別 surface 註冊一次（它不認得 page membership）。此函式在 wm 掛載後執行，
// 把持久化 pages 的每個成員重新 joinMember（joinMember 內建「先拆個別註冊」
// 的冪等路徑，故重覆呼叫安全），復原「成員不個別參與疊序」不變式。
// 九期B Task 6：quirks 歸隊——IPsearch（'protected'，quirks:['server-markup']）
// 的 rootSelector（.IPsearch_in_panelALL）markup 由 auth-protected-tabs.js 的
// fetchProtectedContentWithRetry 在每次 initAllModules（登入）時 clear→重新
// innerHTML 注入，DOM 節點因此每次登入都是全新實例；本函式呼叫時機（initAllModules
// 內，await Promise.allSettled(...) 之後，即 protected.init 已完成、新 markup
// 已存在）與 elFor()（每次都用 document.querySelector(rootSelector) 即時查
// 詢，不快取節點參照）已足以泛化涵蓋這個情境——若 IPsearch 屬某 page，這裡會
// 對「clear→init 重注入後的新節點」重新 joinMember，交給 pageHost.layout 歸隊，
// 不需要額外程式碼（stub 環境無伺服器 markup，測試以罐頭＋consultant 覆蓋，見
// page-engine-b-test.mjs G 區）。
function hydratePageJoins() {
  if (!activeCanvas) return;
  const pages = readPages(activeCanvas.manifest.id);
  if (!pages.length) return;
  const wm = window.WindowManager;
  for (const page of pages) {
    const winId = wm && typeof wm.findWindowForTab === 'function' ? wm.findWindowForTab(page.id) : null;
    for (const m of page.members) joinMember(m.panelId, page.id, winId);
  }
  if (wm && typeof wm.syncPanes === 'function') wm.syncPanes();
}
// 九期B Task 7 修復：resetLayout()（CanvasEdit.toggle 重設佈局，confirm 接受後
// 呼叫）原本只清 layout／windows／stack 三個 schema，漏了 pages store
// （cspanel.pages.cs.v1）與進行中的 joinMember 監聽器狀態——留下的 page 定義
// 會讓已入組成員維持「退出個別疊序身分」的狀態（joinMember 內
// stack.unregister(panelId) 已把它們踢出 stack-manager），且非作用中 page tab
// 的成員可能停在 display:none（pageHostImpl.layout 對非作用中頁的隱藏），兩者
// 都不符合「面板回 manifest 預設」（spec §8／task-7-brief.md）的重設語意。
// leaveMember() 本就是「單一成員退組回自由面板」的正確逆操作（卸監聽器、清
// display/--stack-rank/.gl-stack-pane、重新掛回個別 stack 疊序身分——見上方
// leaveMember 定義與其「沒有 detachedRect 時安全落回舊行為」分支），對「全域
// 重設」呼叫它即可讓每個成員精確回到「從未入組」的樣子。detachedRects 在呼叫
// 前先清空，確保 leaveMember 一律走「清 inline style、回 CSS 幾何預設」分支，
// 而非誤用殘留的「入組前座標」（全域重設語意上不該套用任何個別歷史座標）。
function resetAllPages() {
  if (!activeCanvas) return;
  detachedRects.clear();
  for (const panelId of [...pageJoins.keys()]) leaveMember(panelId);
  writePages(activeCanvas.manifest.id, []);
}

// pageHost 委派介面（wm 不懂面板，全部經此委派給引擎——見 window-manager.js
// mountWindowManager 的 opts.pageHost）。
const pageHostImpl = {
  getTitle(pageId) {
    const page = getPage(pageId);
    return page ? page.name : '';
  },
  // contentRect：{ left, top, width, height }（viewport 座標，wm 傳作用中視窗
  // .wm-content 的 getBoundingClientRect）｜null（非作用中，全成員隱藏）。
  layout(pageId, contentRect, hostWin) {
    const page = getPage(pageId);
    if (!page) return;
    if (!contentRect) {
      for (const m of page.members) {
        const el = elFor(m.panelId);
        if (el) el.style.display = 'none';
      }
      return;
    }
    const rankRaw = hostWin ? hostWin.style.getPropertyValue('--stack-rank') : '';
    const rank = rankRaw ? rankRaw.trim() : '';
    let y = 0;
    for (const m of page.members) {
      const el = elFor(m.panelId);
      if (!el) continue;
      el.style.display = '';
      el.classList.add('gl-stack-pane');
      if (rank !== '') el.style.setProperty('--stack-rank', rank);
      // 定位數學：目前 offsetLeft/Top（相對 offsetParent，對任何 containing
      // block 皆成立，含 body-mounted 罐頭）＋（目標視口座標－目前 getBoundingClientRect）。
      const rect = el.getBoundingClientRect();
      let targetX, targetY;
      if (page.layoutMode === 'free' && m.rect) {
        targetX = contentRect.left + m.rect.x;
        targetY = contentRect.top + m.rect.y;
      } else {
        // stack 模式：依 members 陣列序垂直排，y 累加成員高度＋var(--space-4) 間距，
        // 成員維持原寬（不寫 width）。
        targetX = contentRect.left;
        targetY = contentRect.top + y;
        y += rect.height + spaceGapPx();
      }
      el.style.left = (el.offsetLeft + (targetX - rect.left)) + 'px';
      el.style.top = (el.offsetTop + (targetY - rect.top)) + 'px';
    }
  },
  onPageEmpty(pageId) {
    const page = removePageFromStore(pageId);
    if (!page) return;
    for (const m of page.members) leaveMember(m.panelId);
  },
};

// ===== window.PageEngine（v2 模式限定；v1 模式下所有函式安全 no-op）=====
function pgCreate(members, opts) {
  if (!pageEngineOn() || !Array.isArray(members)) return null;
  const ids = members.filter((id) => elFor(id) && !pageJoins.has(id));
  if (ids.length < 2) return null; // 至少兩員才成頁（單員無分組意義，呼應 spec §3.4 剩一解散）
  // 九期B Task 6：detachedRect 必須在此刻（尚未 push 進 pages store／尚未
  // wm.createPageWindow）捕捉——createPageWindow 內部 render() 會同步呼叫
  // syncPanes()，屆時 page.members 已存在於 store，pageHostImpl.layout() 會
  // 搶在下方 joinMember() 迴圈之前就把成員定位進頁內容區，晚捕捉會拿到「已被
  // 頁接管改寫」後的座標，不是真正的入組前位置。
  for (const id of ids) {
    const r = captureDetachedRect(id);
    if (r) detachedRects.set(id, r);
  }
  const canvasId = activeCanvas.manifest.id;
  const id = genPageId();
  const page = {
    id,
    name: computeTitle(ids),
    members: ids.map((panelId) => ({ panelId, rect: null })),
    layoutMode: (opts && opts.layoutMode === 'free') ? 'free' : 'stack',
  };
  const pages = readPages(canvasId);
  pages.push(page);
  writePages(canvasId, pages);
  let winId = null;
  const wm = window.WindowManager;
  if (wm && typeof wm.createPageWindow === 'function') {
    winId = wm.createPageWindow(id, opts && opts.rect);
  }
  for (const panelId of ids) joinMember(panelId, id, winId);
  // 九期B Task 5 修復（既有缺口，非本 Task 新增行為）：joinMember 內部
  // stack.unregister(panelId) 會把成員原本個別身分的 --stack-rank inline 樣式
  // 一併移除（見 stack-manager.js unregister）；createPageWindow 內部
  // render()（設好視窗初始 rank）之後緊接呼叫 stack.raise(win.id) 把新視窗提到
  // 最上層——若視窗初始 rank 原本就不是佇列最上層（例：本次登入 session 已有
  // 更早建立、之後又被點擊置頂過的其他視窗/面板，把 initialRank 序列往後推），
  // raise() 會改變其最終 rank；無論是否觸發改變，成員都需要一次 syncPanes()
  // 讀「目前」視窗 rank 蓋回去，否則其 --stack-rank 維持空字串、CSS
  // var(--stack-rank,0) 退回 0，可能矮於視窗本身的 z-index，成員疊在視窗
  // chrome（.wm-content）之下、滑鼠事件被攔截、無法再被拖曳/點擊置頂
  // （headless 實測抓到：hit-test 命中 .wm-content 而非成員本身）。pgAddMember
  // 早已有這行（見下方），pgCreate 當時漏補；補齊使兩條入頁路徑對稱。
  if (wm && typeof wm.syncPanes === 'function') wm.syncPanes();
  return id;
}
function pgAddMember(pageId, panelId) {
  if (!pageEngineOn()) return false;
  const canvasId = activeCanvas.manifest.id;
  const pages = readPages(canvasId);
  const page = pages.find((pg) => pg.id === pageId);
  if (!page) return false;
  if (page.members.some((m) => m.panelId === panelId)) return true; // 已是成員，冪等
  const el = elFor(panelId);
  if (!el) return false;
  // 九期B Task 6：detachedRect 同 pgCreate，必須在 push 進 page.members／
  // writePages 之前捕捉（理由同上）。
  const detached = captureDetachedRect(panelId);
  if (detached) detachedRects.set(panelId, detached);
  page.members.push({ panelId, rect: null });
  page.name = computeTitle(page.members.map((m) => m.panelId));
  writePages(canvasId, pages);
  const wm = window.WindowManager;
  const winId = wm && typeof wm.findWindowForTab === 'function' ? wm.findWindowForTab(pageId) : null;
  joinMember(panelId, pageId, winId);
  if (wm && typeof wm.syncPanes === 'function') wm.syncPanes();
  return true;
}
function pgRemoveMember(pageId, panelId) {
  if (!pageEngineOn()) return false;
  const canvasId = activeCanvas.manifest.id;
  const pages = readPages(canvasId);
  const idx = pages.findIndex((pg) => pg.id === pageId);
  if (idx === -1) return false;
  const page = pages[idx];
  const memberIdx = page.members.findIndex((m) => m.panelId === panelId);
  if (memberIdx === -1) return false;
  page.members.splice(memberIdx, 1);
  if (page.members.length <= 1) {
    // 剩一員（或零）→ 整頁自動解散：連同最後一員一起回畫布、page 與其 tab 移除（spec §3.4）。
    leaveMember(panelId);
    for (const m of page.members) leaveMember(m.panelId);
    pages.splice(idx, 1);
    writePages(canvasId, pages);
    if (window.WindowManager && typeof window.WindowManager.removePageTab === 'function') {
      window.WindowManager.removePageTab(pageId);
    }
    return true;
  }
  page.name = computeTitle(page.members.map((m) => m.panelId));
  writePages(canvasId, pages);
  leaveMember(panelId);
  const wm = window.WindowManager;
  if (wm && typeof wm.syncPanes === 'function') wm.syncPanes();
  return true;
}
function pgDissolve(pageId) {
  if (!pageEngineOn()) return false;
  const page = removePageFromStore(pageId);
  if (!page) return false;
  for (const m of page.members) leaveMember(m.panelId);
  if (window.WindowManager && typeof window.WindowManager.removePageTab === 'function') {
    window.WindowManager.removePageTab(pageId);
  }
  return true;
}
function pgGet(pageId) { return pageEngineOn() ? getPage(pageId) : null; }
function pgList() { return (pageEngineOn() && activeCanvas) ? readPages(activeCanvas.manifest.id) : []; }
window.PageEngine = {
  create: pgCreate, addMember: pgAddMember, removeMember: pgRemoveMember,
  dissolve: pgDissolve, get: pgGet, list: pgList,
};

// ===== 編輯模式 =====
const editState = { detachers: [] };
function panelRoots(manifest) {
  return manifest.panels
    .filter((p) => p.rootSelector && (p.behaviors || []).includes('draggable') && !p.alwaysDraggable)
    .map((p) => ({ p, el: document.querySelector(p.rootSelector) }))
    .filter((x) => x.el);
}
// ver 可選——預設 layoutVer()（讀 activeCanvas.config）；loadCanvas 內 activeCanvas
// 尚未設好前呼叫（canned 舊 key 一次性遷移）需顯式傳 engineConfig.storageVersion，
// 否則會落回預設 'v1'，違反 v2 頁儲存隔離鐵律。
function saveLayoutEntry(canvasId, panelId, pos, ver = layoutVer()) {
  const layout = readLayout(canvasId, ver);
  layout[panelId] = { x: pos.left, y: pos.top };
  try { localStorage.setItem(LAYOUT_KEY(canvasId, ver), JSON.stringify(layout)); } catch (e) {}
}
export function enterEditMode() {
  if (activeCanvas?.config?.pageEngine) return; // 九期A：v2 隨時可拖，編輯模式停用（物理拆除屬九期C）
  if (!activeCanvas || activeCanvas.editing) return;
  activeCanvas.editing = true;
  document.documentElement.classList.add('canvas-editing');
  ensureEditBar();
  for (const { p, el } of panelRoots(activeCanvas.manifest)) {
    el.classList.add('gl-editable');
    const handle = document.createElement('div');
    handle.className = 'gl-edit-handle';
    handle.textContent = p.label || p.id;
    el.appendChild(handle);
    // persist:false —— 編輯把手的位置權威是引擎自身的統一 layout
    // （由 onPositionChange 寫入 LAYOUT_KEY），draggable.js 不應再讀寫
    // 各面板獨立的 draggable:<path>:<id> key（見檔案內註解與任務報告）。
    const detach = makeDraggable(el, handle, {
      persist: false,
      onPositionChange: (pos) => saveLayoutEntry(activeCanvas.manifest.id, p.id, pos),
    });
    // detach()：卸除 makeDraggable 內部掛在 handle/window/document 上的事件
    // 監聽器（原本只在 panel 被移出 DOM 時由其內部 MutationObserver 觸發，
    // 進出編輯模式本身並不會移除 panel，等於每次 enter 都疊加一組新監聽器
    // 而從不回收）。退出編輯模式時連同把手一起主動收掉，避免監聽器洩漏。
    editState.detachers.push(() => { detach(); handle.remove(); el.classList.remove('gl-editable'); });
  }
}
export function exitEditMode() {
  if (!activeCanvas || !activeCanvas.editing) return;
  activeCanvas.editing = false;
  document.documentElement.classList.remove('canvas-editing');
  editState.detachers.forEach((fn) => fn());
  editState.detachers = [];
  emitGeometry(activeCanvas.manifest, readLayout(activeCanvas.manifest.id, layoutVer()));
  for (const { el } of panelRoots(activeCanvas.manifest)) { el.style.left = ''; el.style.top = ''; }
}
export function resetLayout() {
  if (!activeCanvas) return;
  try { localStorage.removeItem(LAYOUT_KEY(activeCanvas.manifest.id, layoutVer())); } catch (e) {}
  // 同時清掉 canned 的舊版 per-panel key，否則「重設」對話術面板不完整
  // （見 loadCanvas 的一次性遷移邏輯）。已知行為：canned 目前畫面位置在
  // 面板存續期間由 draggable.js 自己的 inline left/top 主導，此處刪 key
  // 不會讓它立即跳回預設值，要等下次 loadCanvas（頁面重新載入）才會套用。
  try { localStorage.removeItem(`draggable:${location.pathname}:canned-panel-main`); } catch (e) {}
  // 九期B Task 7 修復：pages store／入組狀態一併回預設，見 resetAllPages() 檔頭
  // 註解。必須在 window.WindowManager.reset() 之前——leaveMember() 只處理面板
  // 自身狀態，不觸碰 wm 的 windows／tabs，執行順序與 wm.reset() 互不相依，這裡
  // 依語意順序（先讓成員退組，再讓視窗回預設）安排。v1 模式（pageEngine 關閉）
  // 完全不進此分支，零變化。
  if (activeCanvas.config.pageEngine) resetAllPages();
  // 分頁視窗管理器是獨立常駐系統（不受編輯模式管轄），但「重設佈局」語義上
  // 應一併把視窗回預設：委派給 window.WindowManager.reset()（清 windows key +
  // 重建預設單視窗）。未掛載（未登入/無 protected 內容）時安靜略過。
  if (window.WindowManager && typeof window.WindowManager.reset === 'function') {
    try { window.WindowManager.reset(); } catch (e) { console.error('WindowManager.reset 失敗:', e); }
  }
  // 統一疊序也回預設（位置 + 分頁 + 疊序三合一，見設計 §2.6）。
  try { stack.reset(); } catch (e) { /* noop */ }
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
  bar.innerHTML = `<span style="font-size:var(--text-sm);color:var(--fg-2)">編排模式</span>
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
  toggle: () => {
    if (activeCanvas?.config?.pageEngine) {
      if (window.confirm('重設佈局？（面板位置、視窗、疊序都會回到預設）')) resetLayout();
      return;
    }
    return activeCanvas && activeCanvas.editing ? exitEditMode() : enterEditMode();
  },
  enter: enterEditMode, exit: exitEditMode, reset: resetLayout,
};

// ===== 九期A：hover 浮現把手（pageEngine 模式；隨時可拖，取代編輯模式）=====
// ===== 九期B Task 1：零位移不寫 layout ＋ dragTelemetry 鉤子 =====
// draggable.js 零改動——位移判定與拖曳遙測全在引擎側計算/記錄。
export const ENGINE_DRAG_THRESHOLD = 6; // px：與拖曳起點位移小於此值視為零位移點擊，不寫 layout。
// 目前拖曳中面板：{ panelId, el } | null。存 el（而非一次性 rect 快照）是刻意
// 選擇——Task 4 的重疊偵測在節流輪詢回呼中自行 el.getBoundingClientRect()，
// 存 el 才能每次讀到「即時」（而非拖曳起點凍結）的 rect；只有一根滑鼠/觸點能
// 同時拖曳，模組級單例狀態足夠，不需 per-panel 隔離。
let dragTelemetry = null;

// ===== 九期B Task 4：成組手勢（拖重疊＋懸停預覽）=====
// 重疊偵測節流輪詢（不依賴 pointermove 事件次數——滑鼠停在原地不動時懸停計時
// 仍要推進），不動 draggable.js；draggable.js 的 updateElementPosition 用 CSS
// transform 即時挪動面板，el.getBoundingClientRect() 每次讀到的正是拖曳中的
// 即時視覺位置（transform 已套用）。
//
// 節流輪詢改用 setTimeout(tick, GROUP_TICK_MS)（原實作用 requestAnimationFrame，
// commit c6ef285 起同開發分支自行以 git stash 對照發現：一旦本 Task 程式碼併入，
// Task 1 既有斷言「實際拖曳仍寫 layout」出現約 1–8%（多輪抽樣不同批次觀察值）
// 間歇性失敗，同條件 stash 回 Task 3 基準 0 失敗——本 Task 4 修復者已用「同一個
// 同步 JS turn 內連續 dispatch pointerdown/pointermove/pointerup（保證事件圈
// 不跑任何一次 rAF）」直接證實根因：draggable.js 的 updateElementPosition 只在
// 第一次 pointermove 時才 requestAnimationFrame 排入，若 pointerup 搶在瀏覽器
// 送出下一個動畫幀之前就處理完，dragState.translateX/Y 停在初始值 0，
// handleDragEnd 算出的 finalX/Y 等於起點，onPositionChange 的
// moved<ENGINE_DRAG_THRESHOLD 判定為真而略過 saveLayoutEntry——此為 draggable.js
// 既有、與 Task 4 無關的潛在計時縫隙，只是機率極低；本 Task 4 新增的 tick() 若也
// 用 requestAnimationFrame，會和 draggable.js 自己的 updateElementPosition 排進
// 同一顆動畫幀、共用同一份「每幀時間預算」，tick() 每幀的 groupTargets() 強制
// 多次 layout reflow 加重了那顆幀的執行成本，統計上加寬了上述賽跑的獲勝窗口
// （draggable.js 零改動鐵律不可觸碰，故只能從本檔這端降低競爭）。setTimeout 排
// 程走獨立的巨集任務佇列，不會佔用/推遲瀏覽器合成器判定「這顆動畫幀何時該送」
// 的時機，16ms 節流粒度仍等效於「每禎」（60Hz）供懸停計時使用，不改變任何對外
// 行為（GROUP_OVERLAP_RATIO/GROUP_DWELL_MS 語義、D 區測試斷言皆不變）。
//
// 誠實揭露（見任務報告「修復驗證」節的完整數據）：這只是「降低競爭」的緩解，
// 不是根除——同一份同步 dispatch 實驗證明，即使完全沒有 Task 4 程式碼，只要
// pointerdown→pointermove→pointerup 快到中間連一次動畫幀都沒發生，
// draggable.js 自身就會出現同樣的 translateX/Y 停在 0 現象；本檔任何改法都無法
// 把機率壓到數學上的 0（那需要動 draggable.js 本身，觸犯零改動鐵律）。同機器
// 同批次 N=150 次全新頁面 A/B 對照：改前（rAF）2/150（1.3%）、改後（setTimeout）
// 1/150（0.7%）——方向一致變好，但仍是機率性緩解而非保證清零，殘餘機率屬
// draggable.js 既有、跨越本 Task 範圍的縫隙。
export const GROUP_OVERLAP_RATIO = 0.4; // 重疊面積 / min(兩者面積) 達此比例才算「疊上」
export const GROUP_DWELL_MS = 500;      // 疊上需連續懸停此毫秒數才觸發成組預覽
const GROUP_TICK_MS = 16;               // 節流輪詢間隔（約等效 60Hz，不與 draggable.js 的 rAF 鏈搶同一顆幀）

// ===== 審查追記（controller 裁定後之修復）：成組＋邊界回彈的視覺回歸 =====
// script/draggable.js 的 handleDragEnd 在 needsBounce 分支（拖出邊界回彈——本
// hover-handle 的 makeDraggable 呼叫未傳 disableBoundary，預設邊界回彈生效）
// 會先排入一顆 BOUNCE_DURATION（該檔私有常數，現行值 300ms）的 setTimeout，
// 排程之後才同步呼叫 onPositionChange。commitGroup 成功時，onPositionChange
// 內已透過 pgAddMember/pgCreate → joinMember → wm.syncPanes → pageHostImpl.layout
// 同步把 el.style.left/top 改寫為目標 page 視窗內容區座標；但 draggable.js 那顆
// 計時器的回呼會在其後（BOUNCE_DURATION 之後）無條件把 el.style.left/top 覆寫
// 回邊界修正後的原始落點——面板因此在放開後被「彈」出目標視窗，即使 pages
// store 已正確記錄其為成員（純視覺回歸，資料模型不受影響）。draggable.js 零
// 改動鐵律不可觸碰（無法讓它得知「這次 drop 已被成組接管」），只能從本檔這端
// 補一次 wm.syncPanes()（既有、冪等——joinMember 的 raiseHandler 亦用同一招式
// 重新讀取宿主最新狀態蓋回成員）在該計時器「必定」已執行完畢之後重新斷言正確
// 位置。GROUP_BOUNCE_REASSERT_MS 必須嚴格大於 draggable.js 的 BOUNCE_DURATION，
// 留出充分餘裕（而非緊貼 300ms）以承受系統負載造成的計時器抖動。
const GROUP_BOUNCE_REASSERT_MS = 500;
// 九期B 終審 I2 修復：回彈重新斷言抽成共用排程器——原本只掛在 commitGroup 成功
// 分支，但 needsBounce 計時器同樣會蓋掉 handleMemberDrop 全部路徑剛寫入的定位
// （頁內 free 拖曳的 syncPanes 定位、拖出退組時 leaveMember 寫回的 detachedRect、
// 罐頭經 cannedOnPositionChange 走的同一路徑）。預設動作是重跑一次 wm.syncPanes()
// （冪等 canonical layout，適用「面板此刻仍是 page 成員」的路徑）；退組路徑（面板
// 已非成員，syncPanes 不再管它）由呼叫端傳入自訂 reassert 回呼。
function reassertAfterBounce(reassert) {
  setTimeout(reassert || (() => {
    const wm = window.WindowManager;
    if (wm && typeof wm.syncPanes === 'function') wm.syncPanes();
  }), GROUP_BOUNCE_REASSERT_MS);
}

function rectOverlapRatio(a, b) {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  const iw = right - left, ih = bottom - top;
  if (iw <= 0 || ih <= 0) return 0;
  const areaA = a.width * a.height, areaB = b.width * b.height;
  const minArea = Math.min(areaA, areaB);
  return minArea > 0 ? (iw * ih) / minArea : 0;
}
// 候選重疊目標：其他獨立面板 root（排除自己與已入組成員——已入組成員的畫面
// 位置即其宿主 page 視窗內容區，重疊判定改由下面的 page 視窗分支涵蓋，不重複
// 列入，避免同一塊螢幕區域被算兩次）＋既有 page 視窗的內容區（.wm-content，
// 取作用中 tab 為 'pg:' 開頭者，即已成頁且該頁正顯示中的視窗）。
function groupTargets(excludePanelId) {
  const targets = [];
  if (activeCanvas) {
    for (const p of activeCanvas.manifest.panels) {
      if (p.id === excludePanelId || pageJoins.has(p.id)) continue;
      const el = elFor(p.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue; // display:none 等不可見面板不參與
      targets.push({ kind: 'panel', id: p.id, rect });
    }
  }
  document.querySelectorAll('.wm-window').forEach((winEl) => {
    const activeTab = winEl.querySelector('.wm-tab.is-active');
    const tabId = activeTab && activeTab.dataset.tab;
    if (!tabId || !tabId.startsWith('pg:')) return; // 只認 page tab（iframe tab 不可被拖入 page，§1 範圍決策）
    const content = winEl.querySelector('.wm-content');
    if (!content) return;
    const rect = content.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    targets.push({ kind: 'page', id: tabId, rect });
  });
  return targets;
}
// 成組預覽框：絕對定位（position:fixed，與 getBoundingClientRect 同視窗座標系）
// 罩在目標矩形上；token 樣式（--accent-ring 外框＋--accent-tint 底）見
// style/v2/page-engine.css .gl-group-preview。同時只會有一個（單一滑鼠/觸點）。
function showGroupPreview(rect) {
  let el = document.querySelector('.gl-group-preview');
  if (!el) {
    el = document.createElement('div');
    el.className = 'gl-group-preview';
    el.textContent = '組成一頁';
    document.body.appendChild(el);
  }
  el.style.left = rect.left + 'px';
  el.style.top = rect.top + 'px';
  el.style.width = rect.width + 'px';
  el.style.height = rect.height + 'px';
}
function hideGroupPreview() {
  const el = document.querySelector('.gl-group-preview');
  if (el) el.remove();
}
// startGroupWatch：面板 pointerdown 時建立（僅限「目前不是任何 page 成員」的
// 面板——成員拖曳的頁內/退組語義屬 Task 5，本 Task 範圍是自由面板互拖）。掛
// setTimeout(GROUP_TICK_MS) 節流輪詢（理由見上方檔頭註解——不用 requestAnimationFrame
// 是為了不與 draggable.js 自己的 rAF 鏈搶同一顆動畫幀）持續檢查與候選目標的重疊
// 比例；達 GROUP_OVERLAP_RATIO 且連續 ≥GROUP_DWELL_MS 才浮現預覽框、鎖定目標。
// Esc（一次性 keydown 監聽，drop 或 Esc 時卸除）取消本次成組意圖——預覽消失，
// 但不中斷拖曳本身，放開仍走正常落位。finish() 供 onPositionChange（drop）呼叫，
// 回傳當下鎖定的目標（{kind,id}｜null）並收尾（停輪詢、拆預覽、卸 Esc 監聽）。
// myTelemetry：呼叫端傳入 onHandleDown 剛指派的 dragTelemetry 物件參照本身（非
// panelId 字串）——guard 用物件恆等比對，同一面板連續兩次拖曳會產生兩個不同的
// dragTelemetry 物件，字串 panelId 相同無法區分「這一輪」與「上一輪」，物件參照
// 恆等才能保證上一輪的殘留 tick 一定自我終止。
function startGroupWatch(panelId, el, myTelemetry) {
  let timer = null;
  let sinceTs = 0;
  let sinceKey = null;
  let locked = null; // 已達懸停門檻、預覽框顯示中的目標 {kind,id}
  let cancelled = false;

  function stopTick() { if (timer) clearTimeout(timer); timer = null; }
  function onKeydown(e) {
    if (e.key !== 'Escape') return;
    cancelled = true;
    locked = null;
    hideGroupPreview();
    stopTick();
  }
  document.addEventListener('keydown', onKeydown);

  function tick() {
    if (cancelled || dragTelemetry !== myTelemetry) { stopTick(); return; }
    const dragRect = el.getBoundingClientRect();
    let best = null;
    for (const t of groupTargets(panelId)) {
      const ratio = rectOverlapRatio(dragRect, t.rect);
      if (ratio >= GROUP_OVERLAP_RATIO && (!best || ratio > best.ratio)) best = { ...t, ratio };
    }
    const now = performance.now();
    const key = best ? best.kind + ':' + best.id : null;
    if (key !== sinceKey) { sinceKey = key; sinceTs = now; } // 目標切換（含變回 null）重新起算懸停計時
    if (best && now - sinceTs >= GROUP_DWELL_MS) {
      locked = { kind: best.kind, id: best.id };
      showGroupPreview(best.rect);
    } else if (locked) {
      locked = null;
      hideGroupPreview();
    }
    timer = setTimeout(tick, GROUP_TICK_MS);
  }
  timer = setTimeout(tick, GROUP_TICK_MS);

  return {
    finish() {
      document.removeEventListener('keydown', onKeydown);
      stopTick();
      hideGroupPreview();
      return cancelled ? null : locked;
    },
  };
}
// 放開時鎖定目標存在 → 成組接管：目標是既有 page 視窗則 addMember 併入，否則
// PageEngine.create([目標id, 拖曳id])（spec §2：目標在前，拖曳面板在後）。
// 回傳是否成組成功——成功時呼叫端不寫畫布 layout（成組即接管，spec §5.1）。
function commitGroup(target, draggedPanelId) {
  if (target.kind === 'page') return !!pgAddMember(target.id, draggedPanelId);
  return !!pgCreate([target.id, draggedPanelId]);
}

// ===== 九期B Task 5：頁內互動——自由佈局、拖出退組、剩一解散 =====
// 已入組成員的把手拖曳與自由面板走完全不同的語義（本節），故 onPositionChange
// wrapper 對其提早分流（不落入上方成組偵測/畫布 layout 路徑——成員本就不啟動
// startGroupWatch，見 onHandleDown 的 pageJoins.has 判斷）。
// 查目前所屬視窗的 .wm-content viewport rect（找不到＝理論不可達：pageJoins
// 有記錄即代表 joinMember 時宿主視窗已建立；查無時安全放棄，不動任何狀態）。
// 沿用 C 區測試已驗證過的「由 tab 反查 .wm-window」寫法，不新增 wm 公開 API
// （findWindowForTab 只回傳 id，非 DOM 元素）。
function pageWinContentRect(pageId) {
  const winEl = [...document.querySelectorAll('.wm-window')].find((w) =>
    [...w.querySelectorAll('.wm-tab')].some((t) => t.dataset.tab === pageId));
  const content = winEl && winEl.querySelector('.wm-content');
  return content ? content.getBoundingClientRect() : null;
}
// 入組成員把手拖曳結束（呼叫端已濾過零位移）：結束位置與宿主內容區的重疊比例
// ≥GROUP_OVERLAP_RATIO（沿用成組手勢同一門檻，語意對稱——都是「這塊區域算不算
// 還在頁內」的判定）視為「仍在內容區內」→ 轉自由佈局；否則視為「拖出內容區」
// →退組回畫布。
//   自由佈局（spec §3.1「使用者頁內拖動任一成員 → 轉 free」）：page.layoutMode
//   首次轉 free 時，先把「目前還沒有 rect」的成員（含 stack 模式下從未被拖過的
//   其他成員）就地凍結——用它們此刻的畫面位置（由 stack 佈局算出、拖曳過程中
//   從未被移動過）換算成內容區相對 rect，讓 layout() 之後用 free 分支重算時
//   算出同一個位置，視覺上「其餘成員不動」。凍結完才覆寫被拖成員自己的 rect，
//   兩者共用同一個 contentRect 快照，換算基準一致。
//   退組（spec §3.4）：直接呼叫既有 pgRemoveMember——它已實作「清除入組期間
//   寫入的 inline left/top/display，回落 canvas-geometry／manifest 座標」
//   （leaveMember），等同「恢復離組前座標（detachedRect）」；剩一員時
//   pgRemoveMember 本身即會連帶最後一員一起自動解散（spec §3.4 對稱解散）。
function handleMemberDrop(panelId, pageId, el) {
  const contentRect = pageWinContentRect(pageId);
  if (!contentRect) return;
  const dragRect = el.getBoundingClientRect();
  if (rectOverlapRatio(dragRect, contentRect) < GROUP_OVERLAP_RATIO) {
    pgRemoveMember(pageId, panelId);
    // 九期B 終審 I2：退組分支的回彈重新斷言——pgRemoveMember → leaveMember 剛把
    // detachedRect 寫回（或清 inline、回 CSS 幾何），draggable.js 的 needsBounce
    // 計時器仍會在 300ms 後把 el.style.left/top 覆寫成回彈落點。syncPanes 這裡
    // 幫不上忙（面板已非任何 page 成員，pageHost.layout 不再管它），改為快照
    // leaveMember 剛寫好的 inline left/top，計時器後原樣重申（空字串＝當時被
    // 清除，重申時同樣移除，維持「回 CSS 幾何」語意）。
    const left = el.style.left, top = el.style.top;
    reassertAfterBounce(() => {
      if (pageJoins.has(panelId)) return; // 重申前又入組：頁語義已接管，不覆寫
      if (left) el.style.left = left; else el.style.removeProperty('left');
      if (top) el.style.top = top; else el.style.removeProperty('top');
    });
    return;
  }
  if (!activeCanvas) return;
  const canvasId = activeCanvas.manifest.id;
  const pages = readPages(canvasId);
  const page = pages.find((pg) => pg.id === pageId);
  if (!page) return;
  if (page.layoutMode !== 'free') {
    for (const m of page.members) {
      if (m.rect) continue;
      const mEl = elFor(m.panelId);
      if (!mEl) continue;
      const r = mEl.getBoundingClientRect();
      m.rect = { x: r.left - contentRect.left, y: r.top - contentRect.top };
    }
    page.layoutMode = 'free';
  }
  const member = page.members.find((m) => m.panelId === panelId);
  if (member) member.rect = { x: dragRect.left - contentRect.left, y: dragRect.top - contentRect.top };
  writePages(canvasId, pages);
  const wm = window.WindowManager;
  if (wm && typeof wm.syncPanes === 'function') wm.syncPanes();
  // 九期B 終審 I2：頁內 free 分支的回彈重新斷言——同 commitGroup 成功分支的既有
  // 修復（見 GROUP_BOUNCE_REASSERT_MS 檔頭註解）：needsBounce 計時器會把上面
  // syncPanes 剛定位好的成員蓋回回彈落點；計時器之後重跑一次 canonical layout
  // （冪等，member.rect 是唯一定位權威）。罐頭經 cannedOnPositionChange 走的
  // 也是本函式，兩條路徑一併涵蓋。
  reassertAfterBounce();
}

// 九期B Task 6：quirks 歸隊——alwaysDraggable 面板（目前僅罐頭）已自帶常駐把手
// （設計 §4.1：「其把手即分組拖曳表面」），不經 attachHoverHandles 生成的
// onPositionChange wrapper（該函式明確跳過 alwaysDraggable，panelRoots 的
// filter 條件）。罐頭的把手拖曳語義改由 initArgs 注入的 onPositionChange 回呼
// 提供（見 loadCanvas），本函式即該回呼：入組期間比照一般成員（handleMemberDrop：
// 內容區內→自由佈局、內容區外→退組），非成員時 no-op（native 拖曳/自身
// self-persist 行為不變，v1/v2 非入組情境零差異）。零位移過濾比照
// ENGINE_DRAG_THRESHOLD 同一泛化，起點由 attachHoverHandles 內建的輕量
// pointerdown 監聽器（cannedDragStart）記錄。
const cannedDragStart = { left: 0, top: 0 };
function cannedOnPositionChange(pos) {
  const join = pageJoins.get('canned');
  if (!join) return; // 非成員：no-op，罐頭自身拖曳/儲存行為不受影響
  const moved = Math.hypot(pos.left - cannedDragStart.left, pos.top - cannedDragStart.top);
  if (moved < ENGINE_DRAG_THRESHOLD) return;
  handleMemberDrop('canned', join.pageId, join.el);
}

const hoverState = { detachers: [] };
function attachHoverHandles() {
  if (!activeCanvas?.config?.pageEngine) return;
  for (const { p, el } of panelRoots(activeCanvas.manifest)) {
    if (el.querySelector('.gl-hover-hot')) continue; // 冪等（登入登出循環）
    const hot = document.createElement('div');
    hot.className = 'gl-hover-hot';
    const handle = document.createElement('div');
    handle.className = 'gl-hover-handle draggable-handle';
    handle.textContent = p.label || p.id;
    el.append(hot, handle);
    // 熱區與把手帶都是拖曳表面：兩者對同一 panel 各綁一次 makeDraggable 會產生
    // 兩份獨立 dragState——改為把 pointerdown 從熱區轉發到把手帶（把手帶為唯一
    // 綁定點），熱區只負責「常駐可按」與浮現觸發。
    // startLeft/startTop：down 時的 offset（與 draggable.js 內部 dragState.elementX/Y
    // 同一座標系、同一取值公式），供 onPositionChange 計算「與拖曳起點位移」用。
    let startLeft = 0, startTop = 0;
    let groupWatch = null; // 九期B Task 4：本次拖曳的成組懸停偵測器（見 startGroupWatch）
    const onHandleDown = () => {
      const myTelemetry = { panelId: p.id, el };
      dragTelemetry = myTelemetry;
      startLeft = el.style.left ? parseInt(el.style.left, 10) : el.offsetLeft;
      startTop = el.style.top ? parseInt(el.style.top, 10) : el.offsetTop;
      // 只有「目前不是任何 page 成員」的自由面板才啟動成組偵測——成員拖曳的
      // 頁內/退組語義屬 Task 5，本 Task 範圍是自由面板互拖成組。myTelemetry：
      // 傳物件參照本身供 tick() 恆等比對（見 startGroupWatch 檔頭註解）。
      groupWatch = pageJoins.has(p.id) ? null : startGroupWatch(p.id, el, myTelemetry);
    };
    handle.addEventListener('pointerdown', onHandleDown);
    const detach = makeDraggable(el, handle, {
      persist: false,
      onPositionChange: (pos) => {
        // 結束時機（回彈與直接兩路徑皆會呼叫一次，涵蓋 blur/visibilitychange
        // 觸發的 handleDragEnd）——dragTelemetry 在此收尾，不留殘留狀態。
        dragTelemetry = null;
        const gw = groupWatch;
        groupWatch = null;
        const moved = Math.hypot(pos.left - startLeft, pos.top - startTop);
        // 九期B Task 5：入組成員的拖曳語義與自由面板完全不同（頁內自由佈局／
        // 拖出退組，見 handleMemberDrop），提早分流——成員從不啟動 groupWatch
        // （見上方 onHandleDown），gw 恆為 null，不會落入下方成組/畫布 layout 路徑。
        // 零位移點擊（moved < ENGINE_DRAG_THRESHOLD）與自由面板同一泛化：只是
        // 置頂/點擊，不觸發頁內語義。
        if (pageJoins.has(p.id)) {
          if (moved >= ENGINE_DRAG_THRESHOLD) handleMemberDrop(p.id, pageJoins.get(p.id).pageId, el);
          return;
        }
        const target = gw ? gw.finish() : null; // 停輪詢、拆預覽、卸 Esc 監聽，回傳鎖定目標｜null
        if (target && commitGroup(target, p.id)) {
          // 見上方 GROUP_BOUNCE_REASSERT_MS／reassertAfterBounce 檔頭註解：
          // draggable.js 的邊界回彈計時器可能在此之後把 el.style.left/top 覆寫回
          // 落點座標，蓋掉 commitGroup 剛寫入的頁內定位。無論本次 drop 是否真的
          // 觸發過回彈都補一次重新斷言——非回彈路徑下這只是重跑一次等效的
          // layout()，冪等、無副作用（不影響「成組後拖曳面板不寫畫布 layout」——
          // 本呼叫只重申既有頁內定位，不寫 saveLayoutEntry／畫布 layout）。
          reassertAfterBounce();
          return; // 成組即接管，不寫畫布 layout
        }
        if (moved < ENGINE_DRAG_THRESHOLD) return; // 零位移點擊不寫 layout（九期A 審查歸位）
        saveLayoutEntry(activeCanvas.manifest.id, p.id, pos);
      },
    });
    const forward = (e) => { handle.dispatchEvent(new PointerEvent('pointerdown', e)); e.preventDefault(); };
    hot.addEventListener('pointerdown', forward);
    hoverState.detachers.push(() => {
      hot.removeEventListener('pointerdown', forward);
      handle.removeEventListener('pointerdown', onHandleDown);
      detach(); hot.remove(); handle.remove();
    });
  }
  // 九期B Task 6：alwaysDraggable 面板（目前僅罐頭）不落入上方 panelRoots 迴圈
  // （filter 排除 alwaysDraggable，見 panelRoots），改在其既有把手（draggable.js
  // 自動補上的 .draggable-handle class，通用發現，不寫死 .canned-panel-handle）
  // 疊掛一顆輕量 pointerdown 監聽器，只記錄拖曳起點（cannedDragStart）供
  // cannedOnPositionChange 判斷零位移——罐頭本身的拖曳/成組手勢（成組偵測、
  // 預覽框）不在本期範圍（brief 唯一測試場景是 API create，非拖曳互疊成組），
  // 故不比照上方 onHandleDown 啟動 startGroupWatch。冪等：dataset 旗標防重複
  // 掛載（登入/登出循環，罐頭 DOM 跨登出存活，見 dragb_msg_pnl.js
  // cannedPanelInstance 重用邏輯）。
  for (const p of activeCanvas.manifest.panels) {
    if (!p.alwaysDraggable || !p.rootSelector) continue;
    const el = document.querySelector(p.rootSelector);
    const bridgeHandle = el && el.querySelector('.draggable-handle');
    if (!bridgeHandle || bridgeHandle.dataset.glBridged) continue;
    bridgeHandle.dataset.glBridged = '1';
    const onBridgeDown = () => {
      cannedDragStart.left = el.style.left ? parseInt(el.style.left, 10) : el.offsetLeft;
      cannedDragStart.top = el.style.top ? parseInt(el.style.top, 10) : el.offsetTop;
    };
    bridgeHandle.addEventListener('pointerdown', onBridgeDown);
    hoverState.detachers.push(() => {
      bridgeHandle.removeEventListener('pointerdown', onBridgeDown);
      delete bridgeHandle.dataset.glBridged;
    });
  }
}
function detachHoverHandles() {
  hoverState.detachers.forEach((fn) => fn());
  hoverState.detachers = [];
}

// ===== 入口 =====
export async function loadCanvas(manifest, config = {}) {
  // 九期A：引擎設定參數化。呼叫端不傳 config（production panel_all.html 現況）→
  // 全走 v1 預設，行為與改動前逐位元相同。storageVersion 決定 layout/stack/windows
  // 三個 schema 的 key 尾碼命名空間（見 layoutVer()、stack-manager.js、window-manager.js）。
  const engineConfig = { pageEngine: false, storageVersion: 'v1', ...config };
  const problems = validateManifest(manifest);
  if (problems.length) {
    console.warn('Engine: manifest 異常，問題面板將被跳過', problems.map((p) => p.reason));
    // 依 validateManifest 回傳的 index 過濾，而不是重新用 id/module/init/clear
    // 是否存在來判斷——後者對「重複 id」無效（重複的第二筆通常 4 個欄位都
    // 齊全，字面上不會被濾掉），會跟警告文字（「重複將被跳過」）自相矛盾。
    const badIndexes = new Set(problems.map((p) => p.index));
    manifest = { ...manifest, panels: manifest.panels.filter((_, i) => !badIndexes.has(i)) };
  }
  buildSlots(manifest);

  // 話術面板（canned）舊版每頁獨立 storage key 一次性遷移入統一 layout
  // （不刪舊 key——canned 自身仍以 quirks:['self-persisted'] 走原本機制）
  const oldCanned = localStorage.getItem(`draggable:${location.pathname}:canned-panel-main`);
  // activeCanvas 尚未賦值（見下方），layoutVer() 此刻無從得知本次 config，故兩處
  // readLayout 呼叫與 saveLayoutEntry 的 ver 皆顯式傳 engineConfig.storageVersion。
  if (oldCanned && !readLayout(manifest.id, engineConfig.storageVersion).canned) {
    try {
      const p = JSON.parse(oldCanned);
      saveLayoutEntry(manifest.id, 'canned', { left: p.left, top: p.top }, engineConfig.storageVersion);
    } catch (e) {}
  }
  const layout = readLayout(manifest.id, engineConfig.storageVersion);
  const cannedPanel = manifest.panels.find((x) => x.id === 'canned');
  if (layout.canned && cannedPanel) {
    cannedPanel.initArgs = [null, { left: layout.canned.x, top: layout.canned.y }];
  }
  // 九期B Task 6：quirks 歸隊——罐頭入組期間的把手拖曳語義（頁內自由佈局／
  // 拖出退組）與一般成員相同，經 initArgs 注入 onPositionChange 回呼
  // （cannedOnPositionChange 對非成員狀態 no-op，見該函式檔頭註解）。v1 模式
  // （engineConfig.pageEngine 恆 false）完全不進這個分支，initArgs 形狀與罐頭
  // 行為逐位元不變。
  if (cannedPanel && engineConfig.pageEngine) {
    const base = (cannedPanel.initArgs && cannedPanel.initArgs[1]) || {};
    cannedPanel.initArgs = [null, { ...base, onPositionChange: cannedOnPositionChange }];
  }

  emitGeometry(manifest, layout);
  const mods = await loadModules(manifest);
  activeCanvas = { manifest, mods, editing: false, config: engineConfig };

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
