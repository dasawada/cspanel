# cspanel 畫布引擎化 Implementation Plan

> 📌 歷史快照：已執行並上線（PR #2，2026-07-07 併入 main）。現行契約以 `docs/CANVAS.md` 為準。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把客服畫布重構為「canvas-engine + manifest 實例」：座標與面板清單資料化、z-index 歸帶、編輯模式自訂佈局，未來部門畫布 = 一份新 manifest。

**Architecture:** 兩階段。階段一（Task 0-5）純搬運：mediator 邏輯原樣移入引擎、幾何從 CSS/inline 移入 manifest 由引擎注入、z-index 歸層帶——以佈局視差 harness（headless Chrome 量測 rect + 疊序）保證與現況等價。階段二（Task 6-7）增能：編輯模式、佈局持久化、重設、擴充契約文件。

**Tech Stack:** 純 HTML/CSS/vanilla JS（ES modules，無 build）。驗證用 `npx playwright`（headless Chromium 量測）+ node 腳本。

**Spec:** `docs/superpowers/specs/2026-07-06-canvas-engine-design.md`（已核可）

## Global Constraints

- 工作目錄 `/Users/jianmingxiu/cspanel_clone/cspanel`；工作分支 **`canvas-engine`（自 `redesign/liquid-glass` 分出）**。不得 push、不得 merge。
- **行為契約不可破壞**：`firework-login-success`/`firework-logout-success`/`fw-auth-state-change`/`firework-force-logout` 事件名與時序；`html.auth-active` 防閃爍；`window.verifyFireworkAuth`、localStorage `firebase_id_token`；14 個面板模組的 init/clear 簽名（模組檔案本身除明列者外不修改）；話術面板隨時可拖；quirks mode（panel_all.html 不加 DOCTYPE）。
- **階段一硬驗收線**：`tools/layout-parity.mjs` 對照 baseline，所有追蹤元素的 `getBoundingClientRect` 逐值相等（tolerance 0px）、全域疊序（pairwise 相對順序）不變。
- 座標只准出現在 manifest（`script/canvases/cs.js`）；z-index 只准引用 `--layer-*` 層帶——例外白名單：`draggable.js` 拖曳遮罩 2147483647、`ui-conductor-v2.js` 轉場遮罩、`snowfall.js`/`rippleEffect.js` 特效、各面板內部的局部堆疊值（標 ★ 於盤點表者）。
- 每 Task 一 commit（或計畫指明的多 commit），訊息尾加 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 本機 server：`python3 -m http.server 8123`（repo 根）。無測試框架：本計畫的 parity harness + grep 斷言即測試。

## 盤點事實（各 Task 共用，來源：2026-07-06 萃取）

**A. 疊序現況**（全域競爭者，值高→低）：dragOverlay 2147483647 ｜ 三 modal 999691 ｜ theme picker 99990 ｜ ip-tooltip-portal、toast 10000 ｜ 登入列、snowfall、轉場遮罩 9999 ｜ 預遮罩 9998 ｜ fudausearch 互動提升 1200 ｜ canned 1005 ｜ small-size/assist 1000 ｜ idsearch 998 ｜ ClassLog 997 ｜ roof/IPsearch 996 ｜ DT 994(!important) ｜ tool_zip_dl/consultant 993 ｜ panel-tabs-container 800。

**B. 幾何載體五形態**：CSS class（多數）；模板 inline（fusearch-panel.js:11 `left:0px;top:130px`、toggle-panels.js:10 `z-index:0`、toggle-panels.js:169 `top:0px`）；initArgs+localStorage（canned：`{left:1300,top:75}`＋key `draggable:<path>:canned-panel-main`）；伺服器 markup class（.idsearchpanel/.ClassLogpanel/.panel-tabs-container/.IPsearch_in_panelALL）；runtime 高度（IP_search.js 寫 inline height）。

**C. 異常**：`.ClassLogpanel` 是唯一 `position:fixed`；`.consultantlistgooglesheet` left:636+right:20 雙宣告（right 無效）；`.DT_panel` z-index 994 `!important`（為壓模板 inline 0）；`.fudausearch-suggestions` `left: 4` 缺單位（無效宣告）；`.temp2`/`.board`/`.appicon`/Excalidraw 區塊為死樣式（DOM 不存在）。

**D. 無 slot 的三個邏輯模組**：meeting-now-includefetch、meeting-match-check、meeting-all-module 綁進 MeetingSearchPanel 注入的 DOM，manifest 標 `slot: null`。

---

### Task 0: 分支、parity harness 與 baseline

**Files:**
- Create: `tools/layout-parity.mjs`
- Create: `tools/parity-selectors.json`
- Create: `tools/parity-baseline.json`（由 harness 產出後 commit）

**Interfaces:**
- Produces: `node tools/layout-parity.mjs capture <outfile>`（量測目前頁面）與 `node tools/layout-parity.mjs compare <baseline> <current>`（比對，exit 0=等價）。後續 Task 4/5/6 都用它當驗收閘。

- [ ] **Step 1: 建分支**

```bash
cd /Users/jianmingxiu/cspanel_clone/cspanel
git checkout redesign/liquid-glass && git checkout -b canvas-engine
```

- [ ] **Step 2: 寫入 tools/parity-selectors.json**（追蹤清單：所有全域定位元素）

```json
{
  "rects": [
    ".roofbutton", ".tool_zip_dl", ".optitlepanel", ".fudausearch-container",
    ".linkout", ".DT_panel", ".consultantlistgooglesheet", ".assist_googlesheet",
    ".meeting-search-panel-menu", ".canned-panel", ".panel_all_container",
    "#firebase-login-bar", ".update-header"
  ],
  "zorder": [
    ".canned-panel", ".assist_googlesheet", ".DT_panel", ".consultantlistgooglesheet",
    ".tool_zip_dl", ".roofbutton", ".optitlepanel", ".fudausearch-container",
    ".linkout", ".meeting-search-panel-menu", "#firebase-login-bar"
  ],
  "note": "伺服器注入元素（.idsearchpanel/.ClassLogpanel/.IPsearch_in_panelALL/.panel-tabs-container）需登入取得，不在自動 harness 內；其幾何值以 manifest 逐字搬運 + Task 8 人工驗收覆蓋"
}
```

- [ ] **Step 3: 寫入 tools/layout-parity.mjs（完整內容）**

```js
// 佈局視差 harness：stub Firebase 觸發登入流程，量測面板 rect 與全域疊序。
// 用法：node tools/layout-parity.mjs capture out.json
//       node tools/layout-parity.mjs compare baseline.json current.json
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const [, , cmd, a, b] = process.argv;
const SELECTORS = JSON.parse(readFileSync(new URL('./parity-selectors.json', import.meta.url)));
const URL_ = process.env.PARITY_URL || 'http://localhost:8123/panel_all.html';

async function capture(outfile) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
  await page.addInitScript(() => {
    localStorage.setItem('firebase_id_token', 'parity-stub');
    localStorage.setItem('cspanel.theme.v1', 'olive');
    const fakeUser = { getIdToken: async () => 'parity-stub' };
    window.firebase = {
      apps: [{}],
      initializeApp: () => {},
      auth: () => ({
        onAuthStateChanged: (cb) => setTimeout(() => cb(fakeUser), 50),
        currentUser: fakeUser,
        signOut: async () => {},
        signInWithEmailAndPassword: async () => ({ user: fakeUser }),
      }),
      firestore: () => ({}),
    };
    window.verifyFireworkAuth = async () => true;
  });
  await page.goto(URL_);
  await page.waitForFunction(() => document.documentElement.classList.contains('auth-active'), { timeout: 15000 });
  await page.waitForTimeout(2500); // allSettled + reveal stagger 完成
  const data = await page.evaluate((S) => {
    const out = { rects: {}, zorder: [] };
    for (const sel of S.rects) {
      const el = document.querySelector(sel);
      if (!el) { out.rects[sel] = null; continue; }
      const r = el.getBoundingClientRect();
      out.rects[sel] = { x: r.x, y: r.y, w: r.width, h: r.height };
    }
    const zs = S.zorder
      .map((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        return { sel, z: parseInt(getComputedStyle(el).zIndex, 10) || 0 };
      })
      .filter(Boolean)
      .sort((p, q) => q.z - p.z)
      .map((e) => e.sel);
    out.zorder = zs;
    return out;
  }, SELECTORS);
  writeFileSync(outfile, JSON.stringify(data, null, 2));
  await browser.close();
  console.log(`captured -> ${outfile}`);
}

function compare(basefile, curfile) {
  const base = JSON.parse(readFileSync(basefile, 'utf8'));
  const cur = JSON.parse(readFileSync(curfile, 'utf8'));
  let fail = 0;
  for (const [sel, br] of Object.entries(base.rects)) {
    const cr = cur.rects[sel];
    if (JSON.stringify(br) !== JSON.stringify(cr)) {
      console.error(`RECT DIFF ${sel}: base=${JSON.stringify(br)} cur=${JSON.stringify(cr)}`);
      fail++;
    }
  }
  if (JSON.stringify(base.zorder) !== JSON.stringify(cur.zorder)) {
    console.error(`ZORDER DIFF:\n  base=${base.zorder.join(' > ')}\n  cur =${cur.zorder.join(' > ')}`);
    fail++;
  }
  if (fail) { console.error(`FAIL: ${fail} diffs`); process.exit(1); }
  console.log('PARITY OK');
}

if (cmd === 'capture') await capture(a);
else if (cmd === 'compare') compare(a, b);
else { console.error('usage: capture <out> | compare <base> <cur>'); process.exit(2); }
```

- [ ] **Step 4: 確保 playwright 可用 + 擷取 baseline**

```bash
npx playwright install chromium 2>&1 | tail -1
(python3 -m http.server 8123 >/dev/null 2>&1 &); sleep 1
node tools/layout-parity.mjs capture tools/parity-baseline.json
node tools/layout-parity.mjs compare tools/parity-baseline.json tools/parity-baseline.json
```
Expected: `captured -> ...` 且 `PARITY OK`。檢查 baseline JSON：`rects` 中除伺服器注入者外不得為 null（`.canned-panel` 必須有值；若 null 代表 stub 登入未生效，先修 harness 再前進）。

- [ ] **Step 5: Commit**

```bash
git add tools/
git commit -m "test(canvas): 佈局視差 harness 與 baseline"
```

---

### Task 1: 層帶 tokens

**Files:**
- Modify: `style/v2/tokens.css`（:root 尾端追加）

**Interfaces:**
- Produces: `--layer-panel:100`、`--layer-panel-active:200`、`--layer-dropdown:300`、`--layer-bar:400`、`--layer-modal:500`、`--layer-toast:600`。本 Task 只定義不使用（零視覺變化）。

- [ ] **Step 1: tokens.css :root 尾端加入**

```css
  /* 疊層層帶（z-index 只准引用層帶；帶內排序由 manifest z 提供） */
  --layer-panel: 100;         /* 面板本體 */
  --layer-panel-active: 200;  /* 互動中浮起（拖曳、focus-within 提升） */
  --layer-dropdown: 300;      /* 下拉/建議/tooltip portal */
  --layer-bar: 400;           /* 登入列等常駐 chrome */
  --layer-modal: 500;         /* modal 與 scrim */
  --layer-toast: 600;         /* toast */
```

- [ ] **Step 2: 驗證零視覺變化 + Commit**

```bash
grep -c "layer-" style/v2/tokens.css   # 期望 ≥ 6
node tools/layout-parity.mjs capture /tmp/p-t1.json && node tools/layout-parity.mjs compare tools/parity-baseline.json /tmp/p-t1.json
git add style/v2/tokens.css && git commit -m "feat(canvas): 疊層層帶 tokens"
```
Expected: `PARITY OK`

---

### Task 2: script/canvases/cs.js — 客服畫布 manifest

**Files:**
- Create: `script/canvases/cs.js`

**Interfaces:**
- Produces: `export default` 一個 manifest 物件，schema 如下；Task 3 引擎按此 schema 消費。欄位：`id/name/panels[]/sharedGeometryCss`；panel 欄位：`id, module, init, clear, initArgs?, slot?, rootSelector?, geometryCss?, zOrder?, behaviors?, alwaysDraggable?, quirks?`。

- [ ] **Step 1: 寫入 cs.js（完整內容——幾何值自 style/v2/panels.css 逐字搬入，來源行號註解保留審計線索）**

```js
// 客服畫布 manifest。座標唯一權威來源（CSS 不留幾何）。
// geometryCss 內禁用 z-index —— 疊序一律由 zOrder（帶內排序）供給。
export default {
  id: 'cs',
  name: '客服小工具',
  visibility: 'all', // 預留：部門權限（本期不實作）

  // 共用狀態幾何（原 panels.css 之 .panel_all_container / .small-size / 展開態，逐字）
  sharedGeometryCss: `
.panel_all_container { position: relative; width: 100%; height: 100vh; min-height: 800px; overflow: visible; box-sizing: border-box; margin: 0; padding: 10px; gap: 10px; height: auto; position: absolute; left: 0px; top: 0px; border: 10px; padding: 10px; margin: 10px; }
.small-size { position: absolute !important; width: 105px !important; height: 30px !important; min-width: 0px !important; flex-basis: 110px !important; overflow: hidden !important; z-index: calc(var(--layer-panel) + 10); }
.idsearchpanel:not(.small-size) { width: 560px; height: 600px; }
.consultantlistgooglesheet:not(.small-size) { width: 950px; height: 700px; }
.ClassLogpanel:not(.small-size) { width: 560px; height: 700px; }
.DT_panel:not(.small-size) { width: 900px; height: auto; overflow: visible; z-index: calc(var(--layer-panel) + 4); }
.assist_googlesheet:not(.small-size) { width: 800px; height: 600px; }
.idsearchpanel, .consultantlistgooglesheet, .ClassLogpanel, .DT_panel, .IPsearch_in_panelALL, .assist_googlesheet { display: flex; flex-direction: column; position: absolute; transition: all 0.3s ease; box-sizing: border-box; overflow: hidden; }
/* 伺服器注入 markup 的幾何（repo 內無模板，class 為既定契約） */
.idsearchpanel { width: 560px; height: 600px; z-index: calc(var(--layer-panel) + 8); left: 0px; top: 260px; position: absolute; }
.ClassLogpanel { width: 560px; height: 700px; z-index: calc(var(--layer-panel) + 7); position: fixed; left: 0px; top: 300px; } /* 唯一 fixed 例外（原樣保留） */
.IPsearch_in_panelALL { top: 240px; left: 115px; display: flex; flex-direction: column; justify-content: normal; align-items: flex-start; padding: 0px 6px 0px 6px; z-index: calc(var(--layer-panel) + 5); min-height: 42px; width: 285px; overflow: hidden; position: absolute; height: auto; }
.panel-tabs-container { position: absolute; left: 410px; top: 160px; width: 500px; height: 600px; z-index: calc(var(--layer-panel) + 2); }
`,

  panels: [
    { id: 'meeting-shell', module: './meeting-search-panel-module.js',
      init: 'initMeetingSearchPanel', clear: 'clearMeetingSearchPanel',
      initArgs: ['meeting-search-panel-placeholder'], syncInit: true, // mediator:99 原為同步先行
      slot: 'meeting-search-panel-placeholder', rootSelector: '.meeting-search-panel-menu',
      geometryCss: '.meeting-search-panel-menu { height: auto; width: 360px; position: absolute; left: 920px; top: 0px; }', // 原 panels.css:441-447
      zOrder: 0, behaviors: ['draggable'] }, // 執行時修正：原 CSS 無 z-index，與其他 zOrder:0 面板同列（Task 4 parity 迭代發現）

    { id: 'meeting-now', module: './meeting-now-includefetch.js',
      init: 'initMeetingNowPanel', clear: 'clearMeetingNowPanel', slot: null }, // 邏輯模組，綁 meeting-shell DOM

    { id: 'meeting-match', module: './meeting-match-check.js',
      init: 'initMeetingMatchCheck', clear: 'clearMeetingMatchCheck', slot: null },

    { id: 'meeting-all', module: './meeting-all-module.js',
      init: 'initMeetingAll', clear: 'clearMeetingAll', slot: null },

    { id: 'protected', module: './auth-protected-tabs.js',
      init: 'initProtectedTabs', clear: 'clearProtectedTabs',
      slot: 'auth-protected-tabs-placeholder', extraSlots: ['auth-protected-ip-placeholder'],
      quirks: ['server-markup'] }, // 幾何在 sharedGeometryCss（伺服器 class）

    { id: 'optitle', module: './optitleGG.js',
      init: 'initOptitlePanel', clear: 'clearOptitlePanel',
      initArgs: ['optitle-placeholder'], clearArgs: ['optitle-placeholder'],
      slot: 'optitle-placeholder', rootSelector: '.optitlepanel',
      geometryCss: '.optitlepanel { padding: 10px; width: 400px; height: 120px; box-sizing: border-box; position: absolute; top: 0px; left: 0px; }', // panels.css:92-100
      zOrder: 0, behaviors: ['draggable'] },

    { id: 'fudausearch', module: './fusearch-panel.js',
      init: 'initFudausearchPanel', clear: 'clearFudausearchPanel',
      initArgs: ['fudausearch-placeholder'], clearArgs: ['fudausearch-placeholder'],
      slot: 'fudausearch-placeholder', rootSelector: '.fudausearch-container',
      geometryCss: '.fudausearch-container { left: 0px; top: 130px; }', // 原模板 inline（Task 4 移除 inline 後由此供給）
      zOrder: 0, behaviors: ['draggable'] },

    { id: 'shrturl', module: './shrturl.js',
      init: 'initShrtUrlPanel', clear: 'clearShrtUrlPanel',
      initArgs: ['shrturl-placeholder'], clearArgs: ['shrturl-placeholder'],
      slot: 'shrturl-placeholder', rootSelector: '.linkout',
      geometryCss: '.linkout { padding: 5px 8px; height: auto; width: auto; box-sizing: border-box; position: absolute; top: 40px; left: 420px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; }', // panels.css:225-237
      zOrder: 0, behaviors: ['draggable'] },

    { id: 'dt', module: './toggle-panels.js',
      init: 'initDTPanel', clear: 'clearDTPanel',
      initArgs: ['dt-panel-placeholder'], clearArgs: ['dt-panel-placeholder'],
      slot: 'dt-panel-placeholder', rootSelector: '.DT_panel',
      geometryCss: '.DT_panel { position: absolute; top: 0; left: 523px; transition: all 0.3s ease; }', // panels.css:190-196（z 移入 zOrder；!important 廢除——模板 inline z 同步移除）
      zOrder: 4, behaviors: ['draggable'] },

    { id: 'consultant', module: './toggle-panels.js',
      init: 'initConsultantPanel', clear: 'clearConsultantPanel',
      initArgs: ['consultant-panel-placeholder'], clearArgs: ['consultant-panel-placeholder'],
      slot: 'consultant-panel-placeholder', rootSelector: '.consultantlistgooglesheet',
      geometryCss: '.consultantlistgooglesheet { position: absolute; height: 700px; width: 950px; top: 0px; left: 636px; }', // panels.css:198-206；right:20px 雙宣告本無效，不搬（盤點異常 C）；z 由 zOrder 供給
      zOrder: 3, behaviors: ['draggable'] },

    { id: 'assist', module: './toggle-panels.js',
      init: 'initAssistPanel', clear: 'clearAssistPanel',
      initArgs: ['assist-panel-placeholder'], clearArgs: ['assist-panel-placeholder'],
      slot: 'assist-panel-placeholder', rootSelector: '.assist_googlesheet',
      geometryCss: '.assist_googlesheet { position: absolute; top: 0px; left: 410px; height: 600px; width: 800px; vertical-align: middle; }', // panels.css:180-188
      zOrder: 10, behaviors: ['draggable'] },

    { id: 'canned', module: './dragb_msg_pnl.js',
      init: 'initCannedMessagesPanel', clear: 'clearCannedMessagesPanel',
      initArgs: [null, { left: 1300, top: 75 }],
      slot: null, rootSelector: '.canned-panel',
      zOrder: 15, alwaysDraggable: true, quirks: ['body-mounted', 'self-persisted'] },

    { id: 'roof', module: './roof-buttons.js',
      init: 'initRoofButtons', clear: 'clearRoofButtons',
      initArgs: ['roof-buttons-placeholder'], clearArgs: ['roof-buttons-placeholder'],
      slot: 'roof-buttons-placeholder', rootSelector: '.roofbutton',
      geometryCss: '.roofbutton { width: 110px; height: auto; font-size: 12px; padding: 10px; box-sizing: border-box; position: absolute; left: 0px; top: 240px; gap: 10px; display: flex; flex-wrap: nowrap; flex-direction: column; }', // panels.css:67-82
      zOrder: 5, behaviors: ['draggable'] },

    { id: 'tooldl', module: './tool-download-panel.js',
      init: 'initToolDownloadPanel', clear: 'clearToolDownloadPanel',
      initArgs: ['tool-download-placeholder'], clearArgs: ['tool-download-placeholder'],
      slot: 'tool-download-placeholder', rootSelector: '.tool_zip_dl',
      geometryCss: '.tool_zip_dl { color: var(--fg-2); padding: 5px 10px 5px 10px; box-sizing: border-box; position: absolute; left: 1290px; top: 0px; }', // panels.css:83-91
      zOrder: 3, behaviors: ['draggable'] },
  ],
};
```

- [ ] **Step 2: 驗證（純資料檔語法 + zOrder 與現況疊序等秩）**

```bash
node --input-type=module -e "import('./script/canvases/cs.js').then(m => { const p = m.default.panels; console.log('panels:', p.length); const ids = new Set(p.map(x=>x.id)); if (ids.size !== p.length) throw new Error('dup id'); console.log('OK'); })"
```
Expected: `panels: 14` 與 `OK`。人工核對 zOrder 等秩性：舊值 993(tool/consultant)<994(DT)<996(roof/IP:+5 於 shared)<997(ClassLog:+7 shared)<998(idsearch:+8 shared)<1000(assist/small:+10)<1005(canned:+15) → 新 order 3<4<5<7<8<10<15 保持嚴格遞增 ✅（meeting-shell 原無 z（auto）→ zOrder 1、optitle/fudau/shrturl 原無 z → 0，維持「無 z 者最低」關係）。

- [ ] **Step 3: Commit**

```bash
git add script/canvases/cs.js
git commit -m "feat(canvas): 客服畫布 manifest（幾何與疊序資料化）"
```

---

### Task 3: script/canvas-engine.js — 引擎

**Files:**
- Create: `script/canvas-engine.js`

**Interfaces:**
- Consumes: manifest schema（Task 2）；`./draggable.js` 的 `makeDraggable`（Task 6 才用）；`window.showFireworkToast`。
- Produces: `export async function loadCanvas(manifest)`；`export function enterEditMode()` / `exitEditMode(save)`（Task 6 實作本體，本 Task 先輸出空殼 no-op 以固定介面）。內部：`emitGeometry(manifest, layoutOverrides)` 重建 `<style id="canvas-geometry">`。

- [ ] **Step 1: 寫入 canvas-engine.js（完整內容；認證/調度區塊自 firework-mediator.js **原樣搬入**，僅將硬編碼模組清單改為 manifest 迴圈）**

```js
// Canvas Engine — 泛化自 firework-mediator.js（認證調度邏輯原樣保留）。
// 職責：slot 生成、幾何注入（manifest 為唯一座標權威）、init/clear 調度、
//       編輯模式（enter/exitEditMode，Task 6 實作）。
const LAYOUT_KEY = (canvasId) => `cspanel.layout.${canvasId}.v1`;

let activeCanvas = null; // { manifest, mods: Map<panelId, module>, editing: false }

// ===== 全域認證狀態管理（原 mediator:20-88 逐字） =====
let globalAuthInterceptor = null;
let authCheckInterval = null;
const AUTH_CHECK_INTERVAL_MS = 60000;

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

// ===== 編輯模式（Task 6 實作；先固定介面） =====
export function enterEditMode() { /* Task 6 */ }
export function exitEditMode(save = true) { /* Task 6 */ }

// ===== 入口 =====
export async function loadCanvas(manifest) {
  const problems = validateManifest(manifest);
  if (problems.length) {
    console.warn('Engine: manifest 異常，問題面板將被跳過', problems);
    manifest = { ...manifest, panels: manifest.panels.filter((p) => p.id && p.module && p.init && p.clear) };
  }
  buildSlots(manifest);
  emitGeometry(manifest, readLayout(manifest.id));
  const mods = await loadModules(manifest);
  activeCanvas = { manifest, mods, editing: false };

  window.addEventListener('firework-login-success', () => { initAllModules(); });
  window.addEventListener('firework-logout-success', () => { clearAllModules(); });

  // 原 mediator checkExistingAuth（行 161-184）逐字語義：等 firebase 就緒後看既有 token
  broadcastAuthState('init-logged-out');
  (function checkExistingAuth() {
    const t = setInterval(async () => {
      if (window.firebase && window.firebase.auth) {
        clearInterval(t);
        if (localStorage.getItem('firebase_id_token')) {
          await initAllModules();
        }
      }
    }, 50);
  })();
}
```

**移植忠實度要求**：攔截器/定期檢查/broadcast 三段必須與 `script/firework-mediator.js` 現行文字逐字一致（僅 log 前綴 Mediator→Engine 可改）；`checkExistingAuth` 的節奏（50ms 輪詢、有 token 即 init）不可改。實作前先 `cat -n script/firework-mediator.js` 對照，發現本計畫引文與實檔有出入時**以實檔為準**並在報告註記。

- [ ] **Step 2: 語法驗證 + Commit**

```bash
node --check script/canvas-engine.js
git add script/canvas-engine.js
git commit -m "feat(canvas): canvas-engine（mediator 邏輯原樣移植 + manifest 調度）"
```

---

### Task 4: 切換與幾何抽離（階段一驗收閘）

**Files:**
- Modify: `panel_all.html`（薄殼化）
- Modify: `style/v2/panels.css`（幾何抽離）
- Modify: `script/fusearch-panel.js:11`（移除模板 inline left/top）
- Modify: `script/toggle-panels.js:10`（移除模板 inline `z-index: 0;`）
- Delete: `script/firework-mediator.js`

- [ ] **Step 1: panel_all.html 薄殼化**——body 內 11 個 placeholder div 全部移除（引擎生成），`.panel_all_container` 空容器保留；head 的 `<script type="module" src="script/firework-mediator.js"></script>` 替換為：

```html
<script type="module">
    import { loadCanvas } from './script/canvas-engine.js';
    import cs from './script/canvases/cs.js';
    loadCanvas(cs);
</script>
```
（其餘 head/body 內容——含 update-header、三個 body 尾 script——一律不動。）

- [ ] **Step 2: panels.css 幾何抽離**。對照 Task 2 manifest 的來源行號註解，把以下 block 中的**幾何屬性**（position/top/left/right/width/height/min-*/z-index/flex-basis/display:flex 佈局群）移除，**視覺屬性**（padding 內距類保留於 manifest geometryCss 已搬者則整條刪除；玻璃/色彩/圓角/陰影留在 CSS）：
  - `.roofbutton`(67-82)、`.tool_zip_dl`(83-91)、`.optitlepanel`(92-100)、`.small-size`(126-134)、五個 `:not(.small-size)` 尺寸(136-161)、`.idsearchpanel/.ClassLogpanel/.assist_googlesheet/.DT_panel/.consultantlistgooglesheet/.IPsearch_in_panelALL` 幾何(163-222)、`.linkout`(225-237)、`.meeting-search-panel-menu`(441-447)、`.panel-tabs-container` 幾何(847-858 的 position/left/top/width/height/z-index)
  - 共用 flex 宣告區塊(102-109)與 `.panel_all_container`(48-66) 整段移除（已入 sharedGeometryCss）
  - `.DT_panel` 的 `z-index: 994 !important` 刪除（zOrder 接手；同 Step 3 移除模板 inline 後不再需要）
  - **死樣式清除**：`.temp2`、`.board`、`.appicon`、`#excalidraw-container` 與 Excalidraw 系列(404-439)、`.board` 幾何(314-324) 整段刪除
  - `.fudausearch-suggestions` 的無效宣告 `left: 4;` 刪除（無單位、本無效果）
  - 保留：`.fudausearch-container` 的 w/h/padding 幾何**移除**（已在 manifest？——注意：manifest 的 fudausearch geometryCss 只含 left/top；把 panels.css:802-811 的 `width:400px; height:105px; position:absolute; padding/box-sizing/gap` 中幾何項合併進 manifest 的 geometryCss 再刪 CSS 版），`:hover/:focus-within` 提升改 `z-index: var(--layer-panel-active);`
- [ ] **Step 3: 模板 inline 清理**：`fusearch-panel.js:11` 移除 `style="left:0px;top:130px;"`；`toggle-panels.js:10` 移除 `style="z-index: 0;"`（保留其餘屬性）。`node --check` 兩檔。
- [ ] **Step 4: 刪 mediator + parity 驗收（不過就修到過）**

```bash
git rm script/firework-mediator.js
node tools/layout-parity.mjs capture /tmp/p-t4.json
node tools/layout-parity.mjs compare tools/parity-baseline.json /tmp/p-t4.json
```
Expected: `PARITY OK`。任何 RECT/ZORDER DIFF 都要回頭修 manifest/CSS 抽離遺漏，直到 OK 才准 commit。同時 grep 斷言：

```bash
grep -n "position: absolute\|position: fixed\|top:\|left:" style/v2/panels.css | grep -v "modal\|toast\|update-header\|tooltip\|suggestions\|animation\|clearIcon\|close\|::" | head
```
Expected: 幾何殘留為零（輸出空；白名單：modal/浮出層等非畫布面板元素）。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(canvas): panel_all 薄殼化、幾何入 manifest、mediator 除役（parity 驗證通過）"
```

---

### Task 5: 全站 z-index 歸帶

**Files:**
- Modify: `style/v2/overlays.css`（登入列 9999 → `var(--layer-bar)`；toast 容器樣式若在此）
- Modify: `script/fireworkeffect.js`（toastStyles 內 10000 → `var(--layer-toast)`）
- Modify: `style/v2/panels.css`（三 modal 999691 → `var(--layer-modal)`）
- Modify: `script/theme.js`（picker 99990 → `calc(var(--layer-modal) + 10)`）
- Modify: `style/v2/features/ipsearch_css.css`（tooltip portal 10000 → `var(--layer-dropdown)`）
- Modify: `script/dragb_msg_pnl.js`（`.canned-panel` 注入 CSS 的 `z-index: 1005` → `calc(var(--layer-panel) + 15)`）

**白名單不動**：draggable 遮罩 2147483647、ui-conductor 9998/9999、snowfall 9999、ripple -1、面板內部局部值（nav 800/801、suggestions 999、DTV_iframe 900、all-meeting 896/897、其餘 ★ 項）。

- [ ] **Step 1: 逐項替換**（僅上列六處；层帶值換算驗證：bar 400 < modal 500 < toast 600 對應舊 9999 < 999691 < 10000 ✕——注意！舊 toast 10000 **低於** modal 999691？否：10000 < 999691，toast 在 modal 之下。歸帶後 toast 600 > modal 500 會反轉！**修正**：toast 歸 `calc(var(--layer-modal) - 10)`＝490？不可——層帶語義應為 toast 最高（通知永遠可見）。裁定：**toast 歸 --layer-toast(600)，屬刻意修正**（通知被 modal 蓋住是舊缺陷），在報告與 CANVAS.md 記錄此一有意的疊序變更；parity harness 的 zorder 清單不含 toast/modal（都是暫態元素），不會誤報。）ip-tooltip-portal 舊 10000 高於面板低於 modal → `--layer-dropdown`(300) 仍高於面板帶(100-200) ✅、低於 bar/modal ✅、但舊值高於登入列 9999——tooltip 與登入列（右下角）無幾何交集，接受此相對變化並記錄。
- [ ] **Step 2: 驗證**

```bash
node tools/layout-parity.mjs capture /tmp/p-t5.json && node tools/layout-parity.mjs compare tools/parity-baseline.json /tmp/p-t5.json
grep -rn "z-index" style/v2/ script/*.js | grep -vE "var\(--layer|2147483647|9998|9999|snowfall|ripple|-1|calc\(var" | grep -vE "panels.css:(4[0-9]{2}|5[0-9]{2}|6[0-9]{2}|7[0-9]{2}|8[0-9]{2})" | head -20
```
Expected: parity OK；grep 殘留僅白名單局部值（逐筆在報告說明歸類）。三個歷史場景手測（登入後）：主題 picker 蓋過話術面板、fudausearch 建議選單浮於相鄰面板上、拖曳遮罩最高。

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(canvas): 全站 z-index 歸層帶（toast/tooltip 相對序修正已記錄）"
```

---

### Task 6: 編輯模式（階段二）

**Files:**
- Modify: `script/canvas-engine.js`（實作 enterEditMode/exitEditMode/reset + 把手 + 存檔）
- Modify: `script/draggable.js`（新增 `onPositionChange` 回呼選項，預設行為不變）
- Create: `style/v2/canvas-edit.css`
- Modify: `panel_all.html`（head 加 canvas-edit.css link，於 overlays.css 之後）
- Modify: `script/fireworkeffect.js`（登入列加「編排」鈕 `#fw-edit-btn`，比照 `#fw-theme-btn` 模式：inline display:none、updateUIState 切換、click+keydown 呼叫 `window.CanvasEdit.toggle()`）

**Interfaces:**
- Produces: `window.CanvasEdit = { toggle, enter, exit, reset }`（engine 掛出）；localStorage `cspanel.layout.cs.v1` 格式 `{ [panelId]: {x,y} }`。
- draggable.js 新選項：`makeDraggable(panel, handle, { ..., onPositionChange: (pos {left,top}) => void })`——拖曳結束回呼；未傳時行為與現在完全相同。

- [ ] **Step 1: draggable.js 加回呼**——在拖曳結束寫回 inline left/top 與 localStorage 的兩個路徑（回彈分支與直接分支）之後各加：

```js
      if (typeof options.onPositionChange === 'function') {
        options.onPositionChange({ left: finalX, top: finalY });
      }
```

- [ ] **Step 2: canvas-edit.css（完整內容）**

```css
/* ===== 畫布編輯模式 ===== */
.gl-canvas-slot { /* 通用 slot 標記（防閃爍由 base.css 既有 id 規則供給；此處僅供未來畫布） */ }

html.canvas-editing .gl-edit-handle {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 22px;
    border-radius: 10px 10px 0 0;
    background: linear-gradient(180deg,
        color-mix(in srgb, var(--accent) 30%, white),
        color-mix(in srgb, var(--accent) 14%, white));
    color: var(--accent-hover);
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    z-index: var(--layer-panel-active);
    user-select: none;
    letter-spacing: 0.1em;
}
html.canvas-editing .gl-edit-handle:active { cursor: grabbing; }
.gl-edit-handle { display: none; }
html.canvas-editing .gl-edit-handle { display: flex; }

#gl-edit-bar {
    position: fixed;
    top: 14px; left: 50%;
    transform: translateX(-50%);
    z-index: var(--layer-bar);
    display: none;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border-radius: 999px;
    background: var(--glass-bg-hover);
    backdrop-filter: blur(28px) saturate(1.8);
    -webkit-backdrop-filter: blur(28px) saturate(1.8);
    border: 1px solid var(--glass-border);
    box-shadow: var(--glass-shadow);
    animation: gl-modal-rise 0.42s cubic-bezier(0.22,1,0.36,1);
}
html.canvas-editing #gl-edit-bar { display: flex; }
#gl-edit-bar button {
    padding: 5px 14px;
    border-radius: 999px;
}
#gl-edit-bar .gl-edit-done { background: var(--accent); color: #fff; border-color: transparent; }
#gl-edit-bar .gl-edit-done:hover { background: var(--accent-hover); }
html.canvas-editing .gl-editable { outline: 1px dashed var(--accent-ring); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
    #gl-edit-bar { animation: none; }
}
```

- [ ] **Step 3: engine 編輯模式實作**——取代 Task 3 的兩個空殼（含 reset 與位移動畫）：

```js
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
    makeDraggable(el, handle, {
      color: 'accent',
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
```
併同：`exitEditMode(save)` 介面簡化為無參數（拖曳結束即存，無 dirty state）——`window.CanvasEdit` 為對外正式介面。話術面板存檔遷移：`loadCanvas` 內加一段——`const old = localStorage.getItem(\`draggable:\${location.pathname}:canned-panel-main\`); if (old && !readLayout(manifest.id).canned) { try { const p = JSON.parse(old); saveLayoutEntry(manifest.id, 'canned', { left: p.left, top: p.top }); } catch(e){} }`（不刪舊 key）；canned 的 initArgs 於 loadCanvas 時以 unified layout 覆蓋：`const l = readLayout(manifest.id); const cp = manifest.panels.find(x=>x.id==='canned'); if (l.canned && cp) cp.initArgs = [null, { left: l.canned.x, top: l.canned.y }];`

- [ ] **Step 4: fireworkeffect.js 編排鈕**——panelHtml 在 `#fw-theme-btn` 後加：

```html
          <i id="fw-edit-btn" class="fa-solid fa-up-down-left-right" style="display:none;" role="button" tabindex="0" aria-label="編排佈局" title="編排佈局"></i>
```
綁定（theme 鈕綁定旁）：click 與 keydown(Enter/Space) 呼叫 `window.CanvasEdit && window.CanvasEdit.toggle()`；updateUIState 登入 `''`／登出 `'none'`（登出同時若在編輯態，engine 的 clearAllModules 前不動編輯態——補：`window.addEventListener('firework-logout-success', ...)` 於 engine loadCanvas 中先 `exitEditMode()` 再 clear）。overlays.css 加 `#fw-edit-btn` 樣式（比照 `#fw-theme-btn` 整組複製改 id）。

- [ ] **Step 5: 驗證**

```bash
node --check script/canvas-engine.js && node --check script/draggable.js && node --check script/fireworkeffect.js
node tools/layout-parity.mjs capture /tmp/p-t6.json && node tools/layout-parity.mjs compare tools/parity-baseline.json /tmp/p-t6.json
```
Expected: 語法全過；**parity 仍 OK**（編輯模式未啟用時零影響）。headless 冒煙：用 harness 的 stub 環境跑一段 evaluate：`window.CanvasEdit.enter()` 後查 `document.querySelectorAll('.gl-edit-handle').length`（期望 ≥ 8）、`window.CanvasEdit.exit()` 後為 0（display none 但節點移除）。

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(canvas): 編輯模式——把手、佈局持久化、重設、編排鈕"
```

---

### Task 7: docs/CANVAS.md 擴充契約

**Files:**
- Create: `docs/CANVAS.md`

- [ ] **Step 1: 寫入契約文件**，必含章節（每節給實際值，不留 TBD）：
  1. 概念：引擎/manifest/層帶/表面階層 各是什麼、檔案在哪
  2. **新增面板 SOP**：模組實作 `init(slotId)`/`clear(slotId)` → manifest panels[] 加一筆（欄位表：id/module/init/clear/initArgs/slot/rootSelector/geometryCss/zOrder/behaviors）→ 驗證指令
  3. **新增畫布 SOP**：`script/canvases/<dept>.js` + 複製 panel_all.html 改兩行 import → 上線前跑 parity harness 建該畫布 baseline
  4. **鐵律**：座標只在 manifest；z-index 只引用 `--layer-*`（附層帶表 + 白名單特例：dragOverlay/conductor/snowfall/ripple/局部 ★ 值）；表面階層 → 配方對應表（panel: blur20/glass-bg；dropdown: elevated+blur20；modal: blur40/0.90+scrim；toast: elevated+色點）
  5. 佈局持久化格式與 key（`cspanel.layout.<canvasId>.v1`）、重設語義
  6. 已知刻意變更記錄（toast>modal 疊序修正、tooltip 相對登入列變化、死樣式移除清單）
- [ ] **Step 2: Commit**

```bash
git add docs/CANVAS.md && git commit -m "docs(canvas): 擴充契約（AI/工程師 SOP、層帶表、白名單）"
```

---

### Task 8: 最終驗證與交付

- [ ] **Step 1: parity 總驗收**（capture + compare = OK）＋未登入截圖正常
- [ ] **Step 2: grep 總斷言**：`grep -rn "firework-mediator" --include="*.html" --include="*.js" .` 無輸出；panels.css 幾何殘留斷言（Task 4 Step 4 那條）無輸出
- [ ] **Step 3: 使用者人工驗收清單產出**（登入流程、14 面板、編輯模式全流程、重設、重整恢復、話術面板遷移、三歷史 z-index 場景、reduced-motion）
- [ ] **Step 4: whole-branch review（最強模型）** → 修復回圈 → 驗收報告呈交使用者
- [ ] **Step 5（使用者核可後）**：合併順序 `canvas-engine` → `redesign/liquid-glass` → main → push

---

## Self-Review 紀錄

- Spec 覆蓋：§2.1 引擎→Task 3；§2.2 manifest→Task 2/4；§2.3 層帶→Task 1/5；§2.4 編輯模式→Task 6；§4 兩階段→Task 0-5/6-7；§5 契約→Global Constraints+Task 7；§6 錯誤處理→Task 3（validate/loadModules）；§7 驗證→Task 0 harness+Task 8；§8 風險→parity 硬閘+原樣移植要求。
- 命名一致性：`loadCanvas`/`emitGeometry`/`readLayout`/`LAYOUT_KEY`（Task 3 定義、Task 6 消費）；`window.CanvasEdit`（Task 6 定義、fireworkeffect 消費）；`onPositionChange`（draggable Task 6 Step 1 定義、Step 3 消費）；`gl-canvas-slot`/`gl-edit-handle`/`#gl-edit-bar`（CSS/JS 對齊）。
- 已知取捨（記錄非缺陷）：伺服器注入面板幾何不在自動 harness（Task 0 selectors note 已載明，由 Task 8 人工覆蓋）；toast/tooltip 疊序屬刻意修正（Task 5 內文裁定並要求記錄於 CANVAS.md）。
