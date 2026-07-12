# 第八期「把手詞彙元件化」實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全站「可拖帶子」視覺收斂為單一來源 `style/v2/draggable-chrome.css`，draggable.js 退為純行為元件，wm-tabbar 與罐頭面板結構性共用同一詞彙。

**Architecture:** 比照六期膠囊/捲軸「單一輪子」模式：新 CSS 檔為把手詞彙唯一來源（token＋自帶 fallback），draggable.js 由 runtime 注入 `<link>`（冪等）取代 CSS 字串注入；wm-tabbar 直接掛 `.draggable-handle` class；罐頭面板讓位並償還 token 色債。

**Tech Stack:** 原生 ES module＋CSS custom properties；回歸測試 Playwright headless（`tools/*.mjs`，需 `python3 -m http.server 8123` 於 repo 根）。

**Spec:** `docs/superpowers/specs/2026-07-12-draggable-chrome-unification-design.md`（先讀）
**契約:** `docs/CANVAS.md`（先讀 §4 鐵律）

## Global Constraints

- 一律在 repo `~/cspanel_clone/cspanel/`、分支 `phase8-draggable-chrome` 工作。
- **絕不 `git add -A`**（六期教訓：曾夾帶使用者未追蹤工作檔）；逐檔 `git add <path>`。
- 新 CSS 不得裸寫尺寸 px（CANVAS.md §4.8）；`var(--x, 8px)` 的 **fallback 值除外**（capsule.css 先例）。
- z-index 只引用 `--layer-*` 層帶（§4.2）；本期新 CSS **完全不寫 z-index**。
- panel_all.html **無 DOCTYPE 是刻意契約**，不可修正；iframe 不可 re-parent（§7.2）。
- draggable.js 的**行為**（拖曳、邊界回彈、事件盾 2147483647、persist、cleanup、+18px 修）零改動。
- wm 的藥丸 tab（`.wm-tab` 全部規則）與 a11y（role/aria/roving tabindex）零改動。
- 把手詞彙**不設 `font-weight` / `color`（常態）/ `text-align`**——會繼承進 wm 藥丸 tab（全 bold 回歸）；字樣式歸各消費者。
- 測試伺服器：`cd ~/cspanel_clone/cspanel && python3 -m http.server 8123`（若 port 已被本 session 的背景 server 佔用則直接沿用）。
- 使用者已授權：實作完畢、回歸全綠後 merge --no-ff 至 main 並 push origin main（Task 6）。
- commit 訊息尾行：`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。

---

### Task 1: 把手詞彙單一來源＋draggable.js 切換

**Files:**
- Create: `style/v2/draggable-chrome.css`
- Create: `tools/handle-chrome-fixture.html`
- Create: `tools/handle-chrome-test.mjs`
- Modify: `style/v2/tokens.css:99` 之後（元件映射層，`--control-radius` 那行後面加 `--handle-h`）
- Modify: `script/draggable.js`（JSDoc 5-13、注入段 18-49、color 段 51-77、範例 404-420）
- Modify: `script/dragb_msg_pnl.js:915`（移除 `color: 'accent'` 一行）
- Modify: `script/canvas-engine.js:256`（移除 `color: 'accent'` 一行）
- Modify: `新增資料夾/轉單小工具.html:492`（移除 `color: '#a9bcc7'`）
- Modify: `panel_all.html:28` 之後（scrollbar.css link 下一行加靜態 link）

**Interfaces:**
- Produces: `.draggable-handle`（常態/hover/:active）與 `.draggable-dragging`（面板浮起＋把手 accent 漸層）兩組 class 的視覺，由 `style/v2/draggable-chrome.css` 供給；`<link data-draggable-chrome>` 為冪等鍵。後續 Task 依賴：`--handle-h`（36px）、把手上緣圓角 `--radius-md`。
- Consumes: tokens.css 既有 `--space-2/--space-4/--radius-md/--fg/--accent/--accent-hover`。

- [ ] **Step 1: 寫失敗測試（fixture＋suite）**

`tools/handle-chrome-fixture.html`（刻意**不載** tokens.css——同時驗證 fallback 路徑，即轉單頁情境）：

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>handle-chrome fixture</title>
<style>
  body { margin: 0; height: 1200px; }
  .pnl { position: absolute; width: 300px; background: #eee; }
</style>
</head><body>
<div id="pnl" class="pnl" style="left:40px; top:40px;">
  <div id="h">把手A</div>
  <div>內容</div>
</div>
<div id="pnl2" class="pnl" style="left:400px; top:40px;">
  <div id="h2">把手B</div>
</div>
<script type="module">
  import { makeDraggable } from '/script/draggable.js';
  makeDraggable(document.getElementById('pnl'), document.getElementById('h'), { persist: false });
  makeDraggable(document.getElementById('pnl2'), document.getElementById('h2'), { persist: false });
  window.__fixtureReady = true;
</script>
</body></html>
```

`tools/handle-chrome-test.mjs`（風格比照 wm-test.mjs：assert 收集、結尾 exit code）：

```js
// 第八期回歸：把手詞彙單一來源（draggable-chrome.css）。
// 需本機 server（repo 根）：python3 -m http.server 8123
//   node tools/handle-chrome-test.mjs
import { chromium } from 'playwright';

const BASE = process.env.HC_URL || 'http://localhost:8123';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const fails = [];
const assert = (cond, msg) => { if (!cond) { fails.push(msg); console.error('  ✗ ' + msg); } else { console.log('  ✓ ' + msg); } };

// ===== A. fixture（無 tokens.css → fallback 路徑）=====
await page.goto(BASE + '/tools/handle-chrome-fixture.html');
await page.waitForFunction(() => window.__fixtureReady === true, { timeout: 10000 });

// A1. <link> 注入恰一次（兩次 makeDraggable 呼叫仍冪等）
const linkCount = await page.evaluate(() =>
  document.querySelectorAll('link[data-draggable-chrome]').length);
assert(linkCount === 1, `詞彙 <link> 恰注入一次（實得 ${linkCount}）`);
await page.waitForFunction(() =>
  [...document.styleSheets].some((s) => s.href && s.href.includes('draggable-chrome.css')), { timeout: 5000 });

// A2. 舊 runtime CSS 字串注入已拆（不再有含 .draggable-dragging 的 <style>）
const legacyStyle = await page.evaluate(() =>
  [...document.querySelectorAll('style')].some((s) => s.textContent.includes('.draggable-dragging')));
assert(!legacyStyle, '舊 CSS 字串注入已移除（無 draggable-dragging <style>）');

// A3. 常態：36px（fallback 生效）、透明底、上緣圓角 12px、grab cursor
const rest = await page.evaluate(() => {
  const cs = getComputedStyle(document.getElementById('h'));
  return { h: cs.height, bg: cs.backgroundColor, bgi: cs.backgroundImage, r: cs.borderTopLeftRadius, cur: cs.cursor, fw: cs.fontWeight };
});
assert(rest.h === '36px', `常態高度 36px（實得 ${rest.h}）`);
assert(rest.bg === 'rgba(0, 0, 0, 0)' && rest.bgi === 'none', `常態透明底（實得 ${rest.bg} / ${rest.bgi}）`);
assert(rest.r === '12px', `上緣圓角 12px（實得 ${rest.r}）`);
assert(rest.cur === 'grab', `cursor: grab（實得 ${rest.cur}）`);
assert(rest.fw === '400', `詞彙不設字重（實得 ${rest.fw}，防 wm 藥丸全 bold）`);

// A4. hover 暗示（自 wm 吸收）：微加深
await page.hover('#h');
const hoverBg = await page.evaluate(() => getComputedStyle(document.getElementById('h')).backgroundColor);
assert(hoverBg !== 'rgba(0, 0, 0, 0)', `hover 微加深（實得 ${hoverBg}）`);

// A5. 拖曳中：面板掛 draggable-dragging＋gl-dragging，把手漸層（accent fallback）
const hb = await page.locator('#h').boundingBox();
await page.mouse.move(hb.x + 50, hb.y + 10);
await page.mouse.down();
await page.mouse.move(hb.x + 150, hb.y + 90, { steps: 5 });
const mid = await page.evaluate(() => ({
  dragging: document.getElementById('pnl').classList.contains('draggable-dragging'),
  gl: document.getElementById('pnl').classList.contains('gl-dragging'),
  bgi: getComputedStyle(document.getElementById('h')).backgroundImage,
}));
assert(mid.dragging && mid.gl, '拖曳中面板掛 draggable-dragging + gl-dragging');
assert(mid.bgi.includes('linear-gradient'), `拖曳中把手 accent 漸層（實得 ${mid.bgi.slice(0, 60)}…）`);
assert(!mid.bgi.includes('240, 240, 240'), '舊硬編碼灰階 #f0f0f0 已廢除');
await page.mouse.up();

// A6. 放開：class 移除、恢復透明、面板有位移（行為未破壞）
const after = await page.evaluate(() => ({
  dragging: document.getElementById('pnl').classList.contains('draggable-dragging'),
  bgi: getComputedStyle(document.getElementById('h')).backgroundImage,
  left: document.getElementById('pnl').style.left,
}));
assert(!after.dragging && after.bgi === 'none', '放開後恢復常態');
assert(parseInt(after.left, 10) > 40, `拖曳行為正常（left=${after.left}）`);

// ===== B. panel_all（quirks mode、有 tokens、登入 stub）=====
// Task 3 會在此區塊追加罐頭面板斷言；本 Task 先驗靜態 link 與 quirks 相容。
await page.addInitScript(() => {
  localStorage.setItem('firebase_id_token', 'parity-stub');
  localStorage.setItem('cspanel.theme.v1', 'olive');
  const fakeUser = { getIdToken: async () => 'parity-stub' };
  window.firebase = {
    apps: [{}], initializeApp: () => {},
    auth: () => ({
      onAuthStateChanged: (cb) => setTimeout(() => cb(fakeUser), 50),
      currentUser: fakeUser, signOut: async () => {},
      signInWithEmailAndPassword: async () => ({ user: fakeUser }),
    }),
    firestore: () => ({}),
  };
  window.verifyFireworkAuth = async () => true;
});
await page.goto(BASE + '/panel_all.html');
await page.waitForSelector('.canned-panel-handle', { timeout: 15000 });
const pa = await page.evaluate(() => ({
  links: document.querySelectorAll('link[data-draggable-chrome]').length,
  handleH: getComputedStyle(document.querySelector('.canned-panel-handle')).height,
}));
assert(pa.links === 1, `panel_all 靜態 link 存在且 runtime 未重複注入（實得 ${pa.links}）`);
assert(pa.handleH === '36px', `quirks mode 下罐頭把手高度 36px（實得 ${pa.handleH}）`);

await browser.close();
if (fails.length) { console.error(`\n${fails.length} 項失敗`); process.exit(1); }
console.log('\nhandle-chrome 全數通過');
```

- [ ] **Step 2: 跑測試確認失敗**

```bash
cd ~/cspanel_clone/cspanel
# 背景 server 若未在跑：python3 -m http.server 8123 &
node tools/handle-chrome-test.mjs
```
Expected: FAIL（`link[data-draggable-chrome]` 為 0——詞彙檔與注入尚不存在）。

- [ ] **Step 3: tokens.css 加 `--handle-h`**

在 `style/v2/tokens.css` 的 `--control-radius: 9px;` 行後加：

```css
  --handle-h: 36px;                 /* 可拖把手帶高度（draggable-chrome.css 唯一消費者） */
```

- [ ] **Step 4: 建 `style/v2/draggable-chrome.css`**

```css
/* ===== 把手詞彙（第八期）=====
   全站「可拖帶子」視覺唯一來源（比照 capsule.css / scrollbar.css 單一輪子；
   契約見 CANVAS.md §4.7）。行為歸 script/draggable.js——本檔由它 runtime 注入
   <link>（data-draggable-chrome 為冪等鍵），panel_all 另有靜態 link 先行。
   token 皆帶 fallback：未載 tokens.css 的獨立頁（新增資料夾/轉單小工具.html）
   亦可用。本檔不寫 z-index（§4.2）、不設字重/字色/對齊（歸消費者——
   否則會繼承進 wm 藥丸 tab）。 */

.draggable-handle {
    box-sizing: border-box;
    height: var(--handle-h, 36px);
    display: flex;
    align-items: center;
    padding: var(--space-2, 4px) var(--space-4, 8px);
    border-radius: var(--radius-md, 12px) var(--radius-md, 12px) 0 0;
    background: transparent;
    cursor: grab;
    user-select: none;
    transition: background 0.15s ease-out; /* 沿 wm-tabbar 既有節奏（四期上線先例） */
}
.draggable-handle:hover {
    background: color-mix(in srgb, var(--fg, #1d1d1f) 7%, transparent); /* wm 的「可拖暗示」升為全站 */
}
.draggable-handle:active { cursor: grabbing; }

/* 拖曳中：面板浮起（原 draggable.js 注入樣式逐字），把手 accent 漸層
   （原 options.color 那條 per-color 規則升為預設；配方同 canvas-edit.css
   的 .gl-edit-handle——兩者刻意同源）。 */
.draggable-dragging {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    opacity: 0.95;
    cursor: grabbing;
}
.draggable-dragging .draggable-handle {
    background: linear-gradient(180deg,
        color-mix(in srgb, var(--accent, #3a3a3c) 30%, white),
        color-mix(in srgb, var(--accent, #3a3a3c) 14%, white));
    color: var(--accent-hover, #1d1d1f);
    cursor: grabbing;
}
```

- [ ] **Step 5: draggable.js 切換樣式供給**

(a) 檔頭 JSDoc（1-14 行）改為（移除 color/其兩段說明，加 link 注入說明）：

```js
/**
 * 讓指定元素可拖曳，彼此互不影響。視覺由 style/v2/draggable-chrome.css
 * （把手詞彙單一來源，第八期）供給——本模組只確保該樣式表已載入
 * （注入 <link data-draggable-chrome>，冪等），自身不再內嵌任何 CSS。
 * @param {HTMLElement} panel  要拖曳的主體元素
 * @param {HTMLElement} handle 拖曳把手（可選，預設整個 panel 可拖曳）
 * @param {Object} options     { left, top, width, height, boundaryElement, updateBoundary, disableBoundary, onPositionChange, persist }
 *   onPositionChange({left, top}): 拖曳結束（回彈與直接兩路徑皆會呼叫一次）時的回呼。
 *   persist: 預設 true（未傳等同 true）。false 時略過本模組自身的
 *   per-panel localStorage 初始還原/寫入與初始 inline left/top 設定，交由
 *   呼叫端（例如畫布引擎的統一 layout）作為位置權威——用於避免編輯模式把手
 *   與獨立面板各自的 draggable:<path>:<id> 存檔互相打架。
 */
```

(b) 把 18-49 行（`// 自動注入通用拖曳樣式` 整段含 `__draggableStyleInjected`）**與** 51-78 行（`// === options.color …` 整段含 theme class 注入與 `handle.classList.add(themeClass)`）刪除，原位換成：

```js
  // 確保把手詞彙樣式表已載入（單一來源：style/v2/draggable-chrome.css）。
  // 以 import.meta.url 解析——不論頁面在哪個目錄（tools/、新增資料夾/）皆正確。
  // panel_all.html 已靜態 link（帶同一 data 屬性），此處查無才注入，冪等。
  if (!document.querySelector('link[data-draggable-chrome]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../style/v2/draggable-chrome.css', import.meta.url);
    link.setAttribute('data-draggable-chrome', '');
    document.head.appendChild(link);
  }
```

（80-83 行 `handle.classList.add('draggable-handle')` 一段**保留**——它是詞彙的掛載點。）

(c) 檔尾使用範例（404-420 行）中兩處 `color: 'panelA'` / `color: 'panelB', ` 參數與「（color 只是 class 識別字…）」註解刪除。

- [ ] **Step 6: 三處呼叫端移除 color**

`script/dragb_msg_pnl.js:912-917` 改為：

```js
  makeDraggable(panel, dragHandle, {
    left: 1300,
    top: 75,
    ...options
  });
```

`script/canvas-engine.js:255-259` 改為：

```js
    const detach = makeDraggable(el, handle, {
      persist: false,
      onPositionChange: (pos) => saveLayoutEntry(activeCanvas.manifest.id, p.id, pos),
    });
```

`新增資料夾/轉單小工具.html:492` 改為：

```js
  makeDraggable(panel, handle, { left: 300, top: 185});
```

- [ ] **Step 7: panel_all.html 加靜態 link**

`panel_all.html:28`（`scrollbar.css` link）下一行插入：

```html
<link rel="stylesheet" href="style/v2/draggable-chrome.css" data-draggable-chrome>
```

- [ ] **Step 8: 跑測試確認通過＋行為回歸**

```bash
node tools/handle-chrome-test.mjs   # Expected: 全數 ✓
node tools/drag-noshift-test.mjs    # Expected: PASS（+18px 修不可回歸）
```

- [ ] **Step 9: Commit**

```bash
cd ~/cspanel_clone/cspanel
git add style/v2/draggable-chrome.css style/v2/tokens.css script/draggable.js \
  script/dragb_msg_pnl.js script/canvas-engine.js 新增資料夾/轉單小工具.html \
  panel_all.html tools/handle-chrome-fixture.html tools/handle-chrome-test.mjs
git commit -m "feat(handle): 把手詞彙單一來源 draggable-chrome.css——draggable.js 退為純行為元件（第八期）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: window-manager 接上把手詞彙

**Files:**
- Modify: `script/window-manager.js:196`（tabbar class）、`:317-332`（startWindowMove）
- Modify: `style/v2/window-manager.css:45-60`（.wm-tabbar 讓位）
- Modify: `tools/wm-test.mjs`（追加兩斷言）

**Interfaces:**
- Consumes: Task 1 的 `.draggable-handle` / `.draggable-dragging`（class 掛上即得視覺）。
- Produces: 無（終端消費者）。`.wm-tab` 與 a11y 一概不動。

- [ ] **Step 1: 寫失敗斷言**

`tools/wm-test.mjs` 中 `ready()` 首次呼叫完成後（第一組 assert 附近）追加：

```js
// ===== 第八期：把手詞彙 =====
assert(await page.$eval('.wm-tabbar', (el) => el.classList.contains('draggable-handle')),
  'tabbar 掛 .draggable-handle 詞彙 class');
{
  const bar = await page.locator('.wm-tabbar').first().boundingBox();
  // 抓 tab 列「空白處」（最右端內縮 8px）壓住拖 20px，途中驗 draggable-dragging
  await page.mouse.move(bar.x + bar.width - 8, bar.y + bar.height / 2);
  await page.mouse.down();
  await page.mouse.move(bar.x + bar.width - 8 + 20, bar.y + bar.height / 2 + 20, { steps: 3 });
  assert(await page.$eval('.wm-window', (el) => el.classList.contains('draggable-dragging')),
    '視窗拖曳中掛 .draggable-dragging（拖曳視覺與 draggable 統一）');
  await page.mouse.up();
  assert(await page.$eval('.wm-window', (el) => !el.classList.contains('draggable-dragging')),
    '放開後 .draggable-dragging 移除');
}
```

- [ ] **Step 2: 跑測試確認新斷言失敗**

```bash
node tools/wm-test.mjs
```
Expected: 既有斷言 PASS，新三條 FAIL。

- [ ] **Step 3: window-manager.js 兩處改動**

`:196` 改為：

```js
      bar.className = 'wm-tabbar draggable-handle';
```

`startWindowMove`（317-332）的 add/remove 兩行改為：

```js
    win.el.classList.add('gl-dragging', 'draggable-dragging'); // 材質鉤子＋把手詞彙拖曳態（第八期統一）
```

```js
      onEnd: () => { win.el.classList.remove('gl-dragging', 'draggable-dragging'); persist(); },
```

- [ ] **Step 4: window-manager.css `.wm-tabbar` 讓位**

45-60 行整段換成（只留佈局；底/分隔線/高度/內距/cursor/hover/transition 歸詞彙）：

```css
/* 標題帶＝把手詞彙消費者（render() 掛 .draggable-handle，視覺歸
   draggable-chrome.css：透明底、--handle-h 高、hover 微加深、拖曳中 accent
   漸層）。第八期刻意推翻四期「色帶＋分隔線」——見 CANVAS.md §7.6。
   此處只留 tab 列自身佈局。 */
.wm-tabbar {
    flex: 0 0 auto;
    gap: var(--space-2);
    overflow: hidden;
}
```

（`display:flex`/`align-items`/`box-sizing`/`height`/`padding`/`background`/`border-bottom`/`cursor`/`transition` 及 `:hover`/`:active` 兩行皆刪——由詞彙供給；`padding: 5px 8px` 的裸 px 長尾隨之償清。`.wm-tab` 起的所有規則不動。）

- [ ] **Step 5: 跑 wm 全套確認通過**

```bash
node tools/wm-test.mjs             # Expected: 全數 ✓（含新三條）
node tools/wm-concurrent-test.mjs  # Expected: PASS
```

- [ ] **Step 6: Commit**

```bash
git add script/window-manager.js style/v2/window-manager.css tools/wm-test.mjs
git commit -m "feat(wm): tabbar 結構性共用把手詞彙，拖曳態掛 draggable-dragging（第八期）

刻意推翻四期標題列色帶（§7.6 將於契約更新任務改寫）：同畫面雙視窗語彙
混淆 > 色帶辨識度。藥丸 tab 與 a11y 零改動。

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 罐頭面板讓位＋token 色債＋parity 基線

**Files:**
- Modify: `script/dragb_msg_pnl.js`（PANEL_CSS 7-160 內多處，見下）
- Modify: `tools/handle-chrome-test.mjs`（B 區追加罐頭斷言）
- Modify: `tools/parity-baseline.json`（`.canned-panel` h 刻意 diff 重建）

**Interfaces:**
- Consumes: Task 1 詞彙（把手視覺、`--handle-h`）；tokens `--border/--border-2/--elevated/--fg/--bg-soft/--accent-tint/--accent-hover/--success/--danger/--muted/--radius-md/--text-sm`。
- Produces: 無（終端消費者）。DOM 結構、localStorage key、manifest 條目、預設位置 (1300,75)、寬 400px 不動。

- [ ] **Step 1: 寫失敗斷言（handle-chrome-test.mjs B 區尾端追加）**

```js
// ===== C. 罐頭面板：讓位＋token 色債（Task 3）=====
const canned = await page.evaluate(() => {
  const css = document.getElementById('canned-panel-style').textContent;
  const panel = document.querySelector('.canned-panel');
  const handle = document.querySelector('.canned-panel-handle');
  return {
    hexLeft: (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []),
    redLeft: /(^|[^-\w])red\b/.test(css.replace(/border-radius/g, '')),
    radius: getComputedStyle(panel).borderTopLeftRadius,
    handleH: getComputedStyle(handle).height,
    handleFw: getComputedStyle(handle).fontWeight,
  };
});
assert(canned.hexLeft.length === 0, `PANEL_CSS 色債清零（殘留：${canned.hexLeft.join(',') || '無'}）`);
assert(!canned.redLeft, 'PANEL_CSS 無 red 關鍵字（→ --danger）');
assert(canned.radius === '12px', `罐頭外框圓角 --radius-md（實得 ${canned.radius}）`);
assert(canned.handleH === '36px', `罐頭把手高度歸詞彙（實得 ${canned.handleH}）`);
assert(canned.handleFw === '600', `罐頭標題字重 600（實得 ${canned.handleFw}）`);
```

- [ ] **Step 2: 跑測試確認 C 區失敗**

```bash
node tools/handle-chrome-test.mjs
```
Expected: A/B 區 PASS，C 區 FAIL（hex 殘留、radius 10px）。

- [ ] **Step 3: PANEL_CSS 改寫**

對 `script/dragb_msg_pnl.js` 的 PANEL_CSS 逐塊修改：

`.canned-panel`（8-23 行）：`border-radius: 10px;` → `border-radius: var(--radius-md);`（其餘不動）。

`.canned-panel-handle` 與 `:active`（36-45 行）兩條規則整段換成（視覺歸詞彙，只留字樣式）：

```css
.canned-panel-handle {
  /* 帶子視覺（高度/內距/透明底/hover/拖曳漸層/圓角/cursor）歸把手詞彙
     draggable-chrome.css；此處只留本面板的標題字樣式 */
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--fg-2);
}
```

`.canned-panel-search-bar .canned-panel-search-input`（55-65 行）：
- `border: 1px solid #ccc;` → `border: 1px solid var(--border-2);`
- `background: #fff;` → `background: var(--elevated);`
- `color: #333;` → `color: var(--fg);`

`.canned-panel-tab-container`（75-81 行）：`border: 1px solid #ddd;` → `border: 1px solid var(--border-2);`（`background: rgba(255,255,255,0.35)` 非本期色債表項目，不動）。

`.canned-panel-tab-menu`（82-87 行）：`border-right: 1px solid #ddd;` → `var(--border-2)`；`background: #f9f9f9;` → `background: var(--bg-soft);`。

`.canned-panel-tab-menu li`（93-99 行）：`border-bottom: 1px solid #eee;` → `var(--border)`；順手把 `TEXT-ALIGN: CENTER;` 正規化為 `text-align: center;`。

`.canned-panel-tab-menu li.active`（100-103 行）：

```css
.canned-panel-tab-menu li.active {
  background: var(--accent-tint);
  color: var(--accent-hover);
  font-weight: bold;
}
```

`.canned-panel-tab-item textarea:disabled`（119-123 行）：`background-color: #f5f5f5;` → `var(--bg-soft)`；`color: #666;` → `var(--muted)`。

`.canned-panel-btn-group button.copied`（137-140 行）：

```css
.canned-panel-btn-group button.copied {
  background-color: var(--success);
  color: var(--elevated);
}
```

`.canned-panel-warning`（141-145 行）：`color: red;` → `color: var(--danger);`。

- [ ] **Step 4: 跑測試確認通過**

```bash
node tools/handle-chrome-test.mjs
```
Expected: A/B/C 全數 ✓。

- [ ] **Step 5: parity 基線重建（刻意 diff 只在 .canned-panel 高度）**

```bash
node tools/layout-parity.mjs capture /tmp/parity-current.json
node tools/layout-parity.mjs compare tools/parity-baseline.json /tmp/parity-current.json || true
```
Expected: 差異**僅** `.canned-panel` 的 `h`（約 326 → 333±，把手 29px→36px 所致）；若出現其他 selector 或 x/y/w 漂移，**停下修正，不得直接覆蓋基線**。確認後：

```bash
cp /tmp/parity-current.json tools/parity-baseline.json
node tools/layout-parity.mjs compare tools/parity-baseline.json /tmp/parity-current.json
```
Expected: PASS（零 diff）。

- [ ] **Step 6: Commit**

```bash
git add script/dragb_msg_pnl.js tools/handle-chrome-test.mjs tools/parity-baseline.json
git commit -m "feat(canned): 罐頭面板讓位把手詞彙＋償還 token 色債（第八期）

把手視覺歸 draggable-chrome.css（高度 29→36px，parity 基線同步重建、
刻意 diff 僅 .canned-panel 高度）；外框圓角 10→12px 對齊 wm-window；
內部硬編碼色全數 token 化，自此跟隨 63 組主題。

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 全套回歸＋主題驗證＋視覺快照

**Files:**
- Modify: `tools/handle-chrome-test.mjs`（尾端追加主題切換斷言）
- 產出（不入 repo）：截圖至 session scratchpad

**Interfaces:**
- Consumes: 前三個 Task 的全部改動。

- [ ] **Step 1: 追加主題斷言（handle-chrome-test.mjs C 區之後）**

```js
// ===== D. 主題跟隨：拖曳漸層與 active tab 隨 palette 變 =====
const grad = async () => page.evaluate(() => {
  const p = document.querySelector('.canned-panel');
  p.classList.add('draggable-dragging');
  const g = getComputedStyle(document.querySelector('.canned-panel-handle')).backgroundImage;
  p.classList.remove('draggable-dragging');
  return g;
});
const oliveGrad = await grad();
await page.evaluate(() => window.CspanelTheme.setTheme('copenhagen-harbour'));
await page.waitForTimeout(100);
const chGrad = await grad();
assert(oliveGrad.includes('linear-gradient') && chGrad.includes('linear-gradient') && oliveGrad !== chGrad,
  `拖曳漸層隨主題（olive ≠ copenhagen-harbour）`);
await page.evaluate(() => window.CspanelTheme.setTheme('olive'));
```

（API 已確認：`script/theme.js:189-193` 公開 `window.CspanelTheme.setTheme`；`copenhagen-harbour` 為實存 palette id、`olive` 為預設。）

- [ ] **Step 2: 全套九件回歸**

```bash
node tools/handle-chrome-test.mjs
node tools/drag-noshift-test.mjs
node tools/wm-test.mjs
node tools/wm-concurrent-test.mjs
node tools/stack-test.mjs
node tools/panel-stack-test.mjs
node tools/editbar-center-test.mjs
node tools/materiality-test.mjs
node tools/capsule-scrollbar-test.mjs
node tools/fudau-repro.mjs
node tools/layout-parity.mjs capture /tmp/p.json && node tools/layout-parity.mjs compare tools/parity-baseline.json /tmp/p.json
```
Expected: 全部 PASS。任何 FAIL 都要修到綠——不得帶紅推版。

- [ ] **Step 3: 視覺快照（人工檢視用，存 scratchpad 不入 repo）**

寫一次性腳本（放 scratchpad，勿入 repo）`snap.mjs`，登入 stub 抄 handle-chrome-test.mjs B 區 `addInitScript` 整段：

```js
import { chromium } from 'playwright';
const OUT = process.env.SNAP_DIR; // 執行時以環境變數指到 session scratchpad
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
await page.addInitScript(() => { /* ← 抄 handle-chrome-test.mjs B 區 stub 整段 */ });
await page.goto('http://localhost:8123/panel_all.html');
await page.waitForSelector('.canned-panel-handle', { timeout: 15000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/panel_all-overview.png`, fullPage: false });
await page.locator('.canned-panel').screenshot({ path: `${OUT}/canned-rest.png` });
await page.evaluate(() => document.querySelector('.canned-panel').classList.add('draggable-dragging', 'gl-dragging'));
await page.locator('.canned-panel').screenshot({ path: `${OUT}/canned-dragging.png` });
await page.evaluate(() => document.querySelector('.canned-panel').classList.remove('draggable-dragging', 'gl-dragging'));
const wm = page.locator('.wm-window').first();
if (await wm.count()) await wm.screenshot({ path: `${OUT}/wm-window.png` });
await browser.close();
```

Run: `SNAP_DIR=<scratchpad> node <scratchpad>/snap.mjs`（`.wm-window` 需伺服器注入 markup，登入 stub 下若不存在則略過該張——canned/全景兩張為必要產物）。任務報告附各圖路徑。

- [ ] **Step 4: Commit**

```bash
git add tools/handle-chrome-test.mjs
git commit -m "test(handle): 主題跟隨斷言——拖曳漸層隨 palette（第八期）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 契約與文件更新

**Files:**
- Modify: `docs/CANVAS.md`（§4.7、§7.6、新增第八期記錄一節）
- Modify: `docs/superpowers/specs/2026-07-12-draggable-chrome-unification-design.md`（§3.6 修正＋盤點結果補記）

**Interfaces:**
- Consumes: 已實作事實（Task 1-4）。

- [ ] **Step 1: CANVAS.md §4.7 增列把手詞彙**

在 §4.7 既有膠囊/捲軸條目之後追加：

```markdown
- **把手（第八期）**：全站「可拖帶子」視覺唯一來源 `style/v2/draggable-chrome.css`
  （`.draggable-handle` 常態/hover、`.draggable-dragging` 拖曳態）。新可拖面板不得自寫
  把手視覺——掛 class 即得（`makeDraggable` 會自動掛）。詞彙**不設字重/字色/對齊**
  （會繼承進 wm 藥丸 tab），字樣式歸各消費者。token 皆帶 fallback，未載 tokens.css
  的獨立頁亦可用。draggable.js 以 `<link data-draggable-chrome>` 冪等注入本檔；
  panel_all.html 另有靜態 link（同 data 屬性）先行。高度 token `--handle-h`。
  編輯模式把手 `.gl-edit-handle` 為刻意例外（特異度較高的專屬樣式，漸層配方與
  詞彙拖曳態同源），不受本詞彙管轄。
```

- [ ] **Step 2: CANVAS.md §7.6 改寫標題列條目**

§7.6 第一個 bullet（標題列色帶）換成：

```markdown
- **標題帶＝把手詞彙消費者（第八期改）**：`.wm-tabbar` 掛 `.draggable-handle`，視覺
  （透明底、`--handle-h` 高、hover 微加深、拖曳中 accent 漸層）歸 `draggable-chrome.css`；
  自身只留 tab 列佈局（gap/overflow）。四期「`--bg-soft` 色帶＋分隔線」於第八期**刻意
  推翻**——同畫面雙視窗語彙（wm 色帶 vs draggable 透明帶）混淆 > 色帶辨識度，「一眼是
  視窗」改由玻璃框＋陰影＋hover 拖曳暗示承擔。視窗拖曳中同時掛
  `gl-dragging`＋`draggable-dragging`。
```

- [ ] **Step 3: CANVAS.md 新增「第八期刻意變更記錄」一節**（比照 §8/§9 格式，置於 §9 之後）

```markdown
## 10. 第八期刻意變更記錄（把手詞彙元件化）

1. **draggable.js 不再內嵌 CSS**：runtime 字串注入（基礎把手＋per-color accent 漸層
   class）整段移除，改冪等注入 `<link data-draggable-chrome>` 指向
   `style/v2/draggable-chrome.css`（以 `import.meta.url` 解析，獨立頁不需自行加 link）。
   `options.color` 參數廢除，三處呼叫端（dragb_msg_pnl / canvas-engine / 轉單小工具）
   同步移除。行為零改動。
2. **wm 標題列色帶推翻**（§7.6）：tabbar 結構性共用把手詞彙；藥丸 tab 與 a11y 不動。
   `padding: 5px 8px` 裸 px 長尾隨讓位償清。
3. **罐頭面板**：把手視覺歸詞彙（高 29→36px，parity 基線重建、刻意 diff 僅
   `.canned-panel` 高度）；外框圓角 10→12px（`--radius-md`）對齊 wm-window；內部硬編碼
   色（#ccc/#ddd/#fff/#333/#f9f9f9/#eee/#e0e0e0/#4CAF50/red/#f5f5f5/#666）全數 token 化。
4. **編輯模式把手刻意不統一**：`.gl-edit-handle` 專屬樣式特異度較高（0-2-1）、漸層配方
   本就與詞彙拖曳態同源，維持四期樣貌。附帶修正：詞彙的 `box-sizing: border-box` 使
   編輯把手渲染高度從 32px（舊注入 padding 外加）回到 canvas-edit.css 宣告的 22px，
   與「nav 讓位 margin-top: 22px」自此精確對齊。
5. **盤點記錄**：cspanel_netlify 全站無 draggable.js 使用——本期無跨 repo 部署順序約束。
6. **回歸**：tools/handle-chrome-test.mjs 新套（詞彙注入冪等/fallback/拖曳態/色債清零/
   主題跟隨）；全套 headless 綠燈後上線。
```

- [ ] **Step 4: spec §3.6 修正補記**

`docs/superpowers/specs/2026-07-12-draggable-chrome-unification-design.md` §3.6 段落改為：

```markdown
### 3.6 不改程式碼的消費者

- `fusearch-panel.js`／轉單頁 makeDraggable 呼叫端：樣式來源切換後自動統一（轉單頁
  額外移除 `color: '#a9bcc7'` 參數）。
- **編輯模式把手（實作時修正原設計敘述）**：`canvas-edit.css` 的
  `html.canvas-editing .gl-edit-handle`（特異度 0-2-1）高於詞彙（0-1-0），且其漸層配方
  與詞彙拖曳態同源（accent 30%/14% color-mix）——編輯把手**刻意維持**四期專屬樣貌，
  不受詞彙覆蓋，視覺無回歸。
- 實作前盤點結果：cspanel_netlify 無任何 draggable.js 使用，無部署順序約束。
```

- [ ] **Step 5: Commit**

```bash
git add docs/CANVAS.md docs/superpowers/specs/2026-07-12-draggable-chrome-unification-design.md
git commit -m "docs(contract): §4.7 增列把手詞彙、§7.6 色帶決策推翻、第八期刻意變更記錄

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 推版（使用者已授權）

**Files:** 無新改動；git 操作。

- [ ] **Step 1: 終驗**

```bash
cd ~/cspanel_clone/cspanel
git status --short          # Expected: 乾淨（無未追蹤夾帶）
node tools/handle-chrome-test.mjs && node tools/wm-test.mjs && \
node tools/layout-parity.mjs capture /tmp/p.json && \
node tools/layout-parity.mjs compare tools/parity-baseline.json /tmp/p.json
```
Expected: 全綠。

- [ ] **Step 2: merge --no-ff 並 push**

```bash
git checkout main
git pull --ff-only origin main
git merge --no-ff phase8-draggable-chrome -m "merge: 第八期——把手詞彙元件化（draggable chrome 單一來源）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 3: 線上驗證**

```bash
sleep 90 && curl -sI https://dasawada.github.io/cspanel/style/v2/draggable-chrome.css | head -1
```
Expected: `HTTP/2 200`（GitHub Pages 部署完成；若 404 等 1-2 分鐘重試）。
