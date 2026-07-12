# 九期A「面板視窗化基座」實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在平行預覽頁 panel_all_v2.html 上實現「全面板隨時可拖」基座：hover 浮現把手、即時佈局持久化（v2 命名空間隔離）、編輯模式停用；production（panel_all.html）行為零變化。

**Architecture:** 共用模組＋設定參數化：`loadCanvas(manifest, config)` 新增 config（`{ pageEngine, storageVersion }`）；儲存命名空間由頁級旗標 `window.CSPANEL_ENGINE_V2` 供 stack-manager／window-manager 選 key（它們的 init 深埋在 auth 流程內，旗標比穿線設定務實）。hover 把手＝「頂緣熱區＋把手帶」雙元素（熱區常駐可互動、把手帶 hover 才浮現），視覺全用第八期把手詞彙。

**Tech Stack:** 原生 ES module＋CSS custom properties；Playwright headless 回歸（`tools/*.mjs`，server：repo 根 `python3 -m http.server 8123`）。

**Spec:** `docs/superpowers/specs/2026-07-12-phase9-page-engine-design.md`（§4、§6、§7 為本期範圍）
**契約:** `docs/CANVAS.md` §4 鐵律

## Global Constraints

- repo `~/cspanel_clone/cspanel/`、分支 `phase9-page-engine`。絕不 `git add -A`；絕不 add `.superpowers/`/scratchpad。
- **production 零變化鐵律**：panel_all.html 不傳 config、不設旗標 → 所有既有行為與儲存 key 完全不變；全套既有回歸（v1 頁）必須全綠。
- **儲存隔離鐵律**：v2 頁絕不讀寫任何 `.v1` 結尾／既有 key（`cspanel.layout.cs.v1`、`cspanel.windows.cs.v1`、`cspanel.stack.cs.v1`、`draggable:<path>:*`）；一律 `.v2` 新 key。
- 新 CSS 不裸寫尺寸 px（§4.8，`var(--x, npx)` fallback 除外）；z-index 只引用 `--layer-*`（§4.2）；把手視覺一律 `.draggable-handle` 詞彙（§4.7），不自寫把手視覺。
- panel_all_v2.html 保留無 DOCTYPE quirks 契約（自 panel_all.html 逐字複製再改）。
- draggable.js 零改動；wm 藥丸 tab 與 a11y 零改動。
- 編輯模式**停用而非拆檔**（物理拆除屬九期C 定版）；v1 頁編輯模式原樣可用。
- 測試伺服器 http://localhost:8123 已服務 repo 根；死了就在 repo 根重啟（背景）。
- commit 訊息尾行：`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 本期完成推 main 供線上預覽（使用者已授權此推版）；**不動 panel_all.html 的行為**。

---

### Task 1: 引擎設定參數化＋儲存命名空間

**Files:**
- Modify: `script/canvas-engine.js`（LAYOUT_KEY:7、resetLayout:275-300、loadCanvas:321）
- Modify: `script/stack-manager.js`（storage key 推導處——先 grep `cspanel.stack` 定位）
- Modify: `script/window-manager.js`（`cspanel.windows.cs.v1` key 常數處——先 grep 定位）
- Test: `tools/page-engine-a-test.mjs`（本 Task 先建骨架＋隔離斷言，後續 Task 增補）
- Create: `tools/page-engine-fixture-note.md` 不需要——直接用 panel_all_v2.html（Task 2 產出）；因此本 Task 的測試 Step 與 Task 2 有先後依賴，見 Step 順序。

**Interfaces:**
- Produces: `loadCanvas(manifest, config = {})`，`config = { pageEngine: false, storageVersion: 'v1' }` 預設；`activeCanvas.config` 供後續 Task 讀。`LAYOUT_KEY(canvasId, ver)` → `cspanel.layout.${canvasId}.${ver}`。頁級旗標 `window.CSPANEL_ENGINE_V2 === true` 時 stack-manager／window-manager 的 key 尾碼由 `.v1` → `.v2`。
- Consumes: 現有 readLayout/saveLayoutEntry/resetLayout 呼叫鏈。

- [ ] **Step 1: 改 canvas-engine.js 簽名與 key**

`LAYOUT_KEY` 改為：

```js
const LAYOUT_KEY = (canvasId, ver = 'v1') => `cspanel.layout.${canvasId}.${ver}`;
```

`loadCanvas(manifest)` → `loadCanvas(manifest, config = {})`；正規化：

```js
  const engineConfig = { pageEngine: false, storageVersion: 'v1', ...config };
```

`activeCanvas = { manifest, mods, editing: false, config: engineConfig }`。

所有 `readLayout(x)` / `LAYOUT_KEY(x)` 呼叫點補第二參數（模組層辅助函式 `layoutVer()` 讀 `activeCanvas?.config?.storageVersion || 'v1'`；loadCanvas 內尚未設 activeCanvas 的兩處直接用 `engineConfig.storageVersion`）。`saveLayoutEntry(canvasId, panelId, pos)` 同步走 `layoutVer()`。

`resetLayout` 清 key 同樣走 `layoutVer()`；其中舊 canned per-path key 清理（:282）與 `WindowManager.reset()`／`stack.reset()` 委派**保持原樣**（wm/stack 自己依旗標選 key，reset 自然作用在正確命名空間）。

- [ ] **Step 2: stack-manager／window-manager 旗標選 key**

兩檔各自找到 storage key 字串（`grep -n "cspanel.stack\|cspanel.windows" script/stack-manager.js script/window-manager.js`），把字面 `.v1` 尾碼改為：

```js
const STORE_VER = (typeof window !== 'undefined' && window.CSPANEL_ENGINE_V2) ? 'v2' : 'v1';
```

並以 `` `cspanel.stack.${canvasId}.${STORE_VER}` `` 形式組 key（window-manager 同理 `cspanel.windows.cs.${STORE_VER}`——依實際常數形狀等值改寫）。旗標在頁面 `<head>` 最早的 inline script 設定（Task 2），模組載入時必已可讀。

- [ ] **Step 3: 跑既有全套（v1 頁零變化驗證）**

```bash
node tools/drag-noshift-test.mjs && node tools/wm-test.mjs && node tools/stack-test.mjs && \
node tools/panel-stack-test.mjs && node tools/editbar-center-test.mjs && node tools/handle-chrome-test.mjs && \
node tools/layout-parity.mjs capture /tmp/p9a.json && node tools/layout-parity.mjs compare tools/parity-baseline.json /tmp/p9a.json
```
Expected: 全綠（未設旗標、未傳 config → 一切走 v1 路徑）。

- [ ] **Step 4: Commit**

```bash
git add script/canvas-engine.js script/stack-manager.js script/window-manager.js
git commit -m "feat(engine): loadCanvas config 參數化＋儲存命名空間 v1/v2 選擇（九期A Task 1）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: panel_all_v2.html 平行預覽頁

**Files:**
- Create: `panel_all_v2.html`（自 panel_all.html 複製）
- Create: `style/v2/page-engine.css`（本 Task 先建帶檔頭註解的空殼；Task 3 填實）
- Test: `tools/page-engine-a-test.mjs`（骨架：v2 頁可載入、旗標生效、儲存隔離）

**Interfaces:**
- Produces: 線上路徑 `/panel_all_v2.html`；頁級旗標 `window.CSPANEL_ENGINE_V2 = true`；`loadCanvas(cs, { pageEngine: true, storageVersion: 'v2' })`。
- Consumes: Task 1 的 config 與旗標機制。

- [ ] **Step 1: 複製並改造 v2 頁**

```bash
cp panel_all.html panel_all_v2.html
```

改造點（其餘逐位元不動，**首行不得出現 DOCTYPE**）：
1. `<head>` 內**第一個** `<script>` 之前插入：

```html
<script>window.CSPANEL_ENGINE_V2 = true;</script>
```

2. 既有 `loadCanvas(cs);`（複製後同 :46 附近）改為：

```js
    loadCanvas(cs, { pageEngine: true, storageVersion: 'v2' });
```

3. `style/v2/scrollbar.css` link 之後插入：

```html
<link rel="stylesheet" href="style/v2/page-engine.css">
```

4. `<title>` 尾綴 `（v2 預覽）`。

- [ ] **Step 2: page-engine.css 空殼**

```css
/* ===== 圖形化視窗管理引擎（第九期）v2 頁專屬樣式 =====
   只被 panel_all_v2.html 載入；production 頁不掛本檔。
   把手視覺一律引用把手詞彙（draggable-chrome.css，§4.7），本檔只放
   hover 浮現機制與 page 引擎專屬佈局。不寫 z-index（§4.2）、
   不裸寫尺寸 px（§4.8，var fallback 除外）。 */
```

- [ ] **Step 3: 測試骨架（寫入 tools/page-engine-a-test.mjs）**

```js
// 九期A 回歸：v2 平行頁（hover 把手基座）。
// python3 -m http.server 8123 → node tools/page-engine-a-test.mjs
import { chromium } from 'playwright';

const BASE = process.env.PE_URL || 'http://localhost:8123';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
const fails = [];
const assert = (cond, msg) => { if (!cond) { fails.push(msg); console.error('  ✗ ' + msg); } else { console.log('  ✓ ' + msg); } };

// 登入 stub（同 handle-chrome-test B 區）＋ order-tool-api 攔截
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
await page.route('**/api/order-tool-api', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":false}' }));

// ===== A. v2 頁載入與旗標 =====
await page.goto(BASE + '/panel_all_v2.html');
await page.waitForSelector('.canned-panel-handle', { timeout: 15000 });
assert(await page.evaluate(() => window.CSPANEL_ENGINE_V2 === true), 'v2 旗標生效');
assert(await page.evaluate(() => document.compatMode === 'BackCompat'), 'quirks mode 契約保留（無 DOCTYPE）');

// ===== B. 儲存隔離：v2 頁操作不觸 v1 keys =====
const v1Snapshot = await page.evaluate(() =>
  JSON.stringify(['cspanel.layout.cs.v1', 'cspanel.windows.cs.v1', 'cspanel.stack.cs.v1']
    .map((k) => [k, localStorage.getItem(k)])));
// （Task 3 會在此之後插入「拖曳一個面板」操作；骨架階段先驗載入本身不寫 v1）
const v1After = await page.evaluate(() =>
  JSON.stringify(['cspanel.layout.cs.v1', 'cspanel.windows.cs.v1', 'cspanel.stack.cs.v1']
    .map((k) => [k, localStorage.getItem(k)])));
assert(v1Snapshot === v1After, 'v1 keys 位元不變（隔離鐵律）');

await browser.close();
if (fails.length) { console.error(`\n${fails.length} 項失敗`); process.exit(1); }
console.log('\npage-engine-a 全數通過');
```

- [ ] **Step 4: 跑測試**

```bash
node tools/page-engine-a-test.mjs   # Expected: 全綠
node tools/layout-parity.mjs capture /tmp/p9a2.json && node tools/layout-parity.mjs compare tools/parity-baseline.json /tmp/p9a2.json  # v1 頁 parity 仍零 diff
```

- [ ] **Step 5: Commit**

```bash
git add panel_all_v2.html style/v2/page-engine.css tools/page-engine-a-test.mjs
git commit -m "feat(v2page): panel_all_v2.html 平行預覽頁＋儲存隔離骨架（九期A Task 2）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: hover 浮現把手＋隨時可拖（v2 模式）

**Files:**
- Modify: `script/canvas-engine.js`（initAllModules/clearAllModules 掛卸點；新函式 attach/detachHoverHandles）
- Modify: `style/v2/page-engine.css`（熱區＋浮現規則）
- Test: `tools/page-engine-a-test.mjs`（增補 C 區）

**Interfaces:**
- Produces: v2 模式下每個 `panelRoots()` 面板（排除 `alwaysDraggable`）擁有 `.gl-hover-hot`（頂緣熱區，常駐可互動）＋`.gl-hover-handle.draggable-handle`（把手帶，hover 浮現）；拖曳即時寫 `cspanel.layout.cs.v2`。
- Consumes: Task 1 config；第八期把手詞彙；既有 `makeDraggable`／`saveLayoutEntry`。

- [ ] **Step 1: 先寫失敗斷言（page-engine-a-test.mjs 增補 C 區，插在 B 區快照對之間——拖曳操作要包進 v1 隔離驗證窗）**

把 B 區兩次快照中間（註解標記處）填入：

```js
// ===== C. hover 把手：浮現、可拖、即時持久化 =====
const opt = '.optitlepanel'; // 標題生成面板：一般面板代表
await page.waitForSelector(opt, { timeout: 10000 });
const hotCount = await page.evaluate((sel) =>
  document.querySelector(sel).querySelectorAll('.gl-hover-hot').length, opt);
assert(hotCount === 1, `一般面板有頂緣熱區（實得 ${hotCount}）`);
assert(await page.evaluate(() =>
  document.querySelector('.canned-panel .gl-hover-hot') === null), '罐頭不重複生成（自帶把手）');

// 常態：把手帶隱形且不吃事件
const restState = await page.evaluate((sel) => {
  const h = document.querySelector(sel + ' .gl-hover-handle');
  const cs = getComputedStyle(h);
  return { op: cs.opacity, pe: cs.pointerEvents, cls: h.classList.contains('draggable-handle') };
}, opt);
assert(restState.op === '0' && restState.pe === 'none', `常態隱形不佔互動（op=${restState.op} pe=${restState.pe}）`);
assert(restState.cls, '把手帶掛 .draggable-handle 詞彙');

// 熱區 hover → 浮現
const optBox = await page.locator(opt).boundingBox();
await page.mouse.move(optBox.x + optBox.width / 2, optBox.y + 4); // 頂緣熱區內
await page.waitForFunction((sel) =>
  getComputedStyle(document.querySelector(sel + ' .gl-hover-handle')).opacity === '1', opt, { timeout: 3000 });
assert(true, '熱區 hover 浮現把手');

// 拖曳：從熱區壓下拖 60,40 → 面板位移且寫入 v2 layout
await page.mouse.down();
await page.mouse.move(optBox.x + optBox.width / 2 + 60, optBox.y + 4 + 40, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(100);
const afterDrag = await page.evaluate((sel) => ({
  left: document.querySelector(sel).style.left,
  v2: localStorage.getItem('cspanel.layout.cs.v2'),
}), opt);
assert(parseInt(afterDrag.left, 10) > 0, `拖曳移動面板（left=${afterDrag.left}）`);
assert(afterDrag.v2 && JSON.parse(afterDrag.v2).optitle, 'v2 layout 即時持久化（optitle 條目存在）');

// reload 還原
await page.reload();
await page.waitForSelector(opt + ' .gl-hover-hot', { timeout: 15000 });
const restored = await page.evaluate((sel) => {
  const saved = JSON.parse(localStorage.getItem('cspanel.layout.cs.v2')).optitle;
  const el = document.querySelector(sel);
  return { saved, actualLeft: parseInt(getComputedStyle(el).left, 10) };
}, opt);
assert(Math.abs(restored.saved.x - restored.actualLeft) < 2,
  `reload 後 v2 佈局還原（saved.x=${restored.saved.x} vs computed left=${restored.actualLeft}）`);
```

Run: `node tools/page-engine-a-test.mjs` — Expected: C 區 FAIL（熱區不存在）。

- [ ] **Step 2: canvas-engine 掛 hover 把手**

新增（編輯模式區塊之後）：

```js
// ===== 九期A：hover 浮現把手（pageEngine 模式；隨時可拖，取代編輯模式）=====
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
    const detach = makeDraggable(el, handle, {
      persist: false,
      onPositionChange: (pos) => saveLayoutEntry(activeCanvas.manifest.id, p.id, pos),
    });
    const forward = (e) => { handle.dispatchEvent(new PointerEvent('pointerdown', e)); e.preventDefault(); };
    hot.addEventListener('pointerdown', forward);
    hoverState.detachers.push(() => {
      hot.removeEventListener('pointerdown', forward);
      detach(); hot.remove(); handle.remove();
    });
  }
}
function detachHoverHandles() {
  hoverState.detachers.forEach((fn) => fn());
  hoverState.detachers = [];
}
```

`initAllModules()` 的 `registerPanelStack();` 之後加 `attachHoverHandles();`；
`clearAllModules()` 的 `unregisterPanelStack();` 之前加 `detachHoverHandles();`。

注意 `panelRoots()` 既有過濾條件已排除 `alwaysDraggable`（罐頭）——直接複用。

- [ ] **Step 3: page-engine.css 填實**

```css
/* 頂緣熱區：常駐可互動的隱形窄帶（拖曳起點＋浮現觸發）。高度刻意窄於把手帶，
   避免吃掉面板頂部內容的點擊。 */
.gl-hover-hot {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: var(--space-5, 10px);
    cursor: grab;
}
/* 把手帶：常態隱形、不佔互動；熱區或自身 hover 時浮現（opacity 狀態切換，
   非動畫——遵 materiality v1）。視覺全由把手詞彙供給。 */
.gl-hover-handle {
    position: absolute;
    top: 0; left: 0; right: 0;
    opacity: 0;
    pointer-events: none;
}
.gl-hover-hot:hover ~ .gl-hover-handle,
.gl-hover-handle:hover,
.gl-hover-handle.is-dragging {
    opacity: 1;
    pointer-events: auto;
}
```

（`is-dragging`：makeDraggable 拖曳中面板掛 `draggable-dragging`——把手浮現要跟住，補一條 `.draggable-dragging .gl-hover-handle { opacity: 1; pointer-events: auto; }` 取代 `is-dragging` 假想 class——實作時以此為準，不要真的發明新 class。）

- [ ] **Step 4: 跑測試至全綠＋v1 頁全套**

```bash
node tools/page-engine-a-test.mjs
node tools/drag-noshift-test.mjs && node tools/handle-chrome-test.mjs && node tools/panel-stack-test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add script/canvas-engine.js style/v2/page-engine.css tools/page-engine-a-test.mjs
git commit -m "feat(engine): hover 浮現把手＋隨時可拖（九期A Task 3，v2 模式限定）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 編輯模式停用（v2 模式）＋重設佈局入口遷移

**Files:**
- Modify: `script/canvas-engine.js`（enterEditMode 守門、window.CanvasEdit v2 語義）
- Test: `tools/page-engine-a-test.mjs`（增補 D 區）

**Interfaces:**
- Produces: v2 模式下 `enterEditMode()` 直接 return（編輯模式永不啟動）；`window.CanvasEdit.toggle` 在 v2 模式改為「confirm 後 resetLayout」；`#fw-edit-btn` 的 title/aria-label 由引擎在 v2 模式改為「重設佈局」。v1 頁一切原樣。
- Consumes: 既有 resetLayout（Task 1 已 v2-key 化）。

- [ ] **Step 1: 失敗斷言（D 區，插在 C 區之後、B 區第二快照之前）**

```js
// ===== D. 編輯模式停用＋重設入口 =====
await page.evaluate(() => window.CanvasEdit.enter());
assert(await page.evaluate(() =>
  !document.documentElement.classList.contains('canvas-editing')), 'v2 模式 enterEditMode 為 no-op');
page.once('dialog', (d) => d.dismiss()); // toggle 觸發 confirm → 取消
await page.evaluate(() => window.CanvasEdit.toggle());
assert(await page.evaluate(() =>
  !document.documentElement.classList.contains('canvas-editing')), 'toggle 不進編輯模式（改重設 confirm）');
```

Run → Expected: FAIL（enter 仍會進編輯）。

- [ ] **Step 2: 實作**

`enterEditMode()` 開頭加：

```js
  if (activeCanvas?.config?.pageEngine) return; // 九期A：v2 隨時可拖，編輯模式停用（物理拆除屬九期C）
```

`window.CanvasEdit` 定義改為 getter 式判斷（保持 v1 語義不變）：

```js
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
```

並在 `initAllModules()` 尾端（v2 模式）重標按鈕：

```js
  if (activeCanvas.config.pageEngine) {
    const btn = document.getElementById('fw-edit-btn');
    if (btn) { btn.title = '重設佈局'; btn.setAttribute('aria-label', '重設佈局'); }
  }
```

- [ ] **Step 3: 跑測試全綠＋editbar 回歸（v1 頁）**

```bash
node tools/page-engine-a-test.mjs && node tools/editbar-center-test.mjs
```

- [ ] **Step 4: Commit**

```bash
git add script/canvas-engine.js tools/page-engine-a-test.mjs
git commit -m "feat(engine): v2 模式編輯模式停用、fw-edit-btn 轉重設佈局入口（九期A Task 4）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 全套終驗＋推版（線上預覽）

**Files:** 無新改動；驗證＋git 操作＋ledger。

- [ ] **Step 1: 雙軌全套**

```bash
node tools/page-engine-a-test.mjs && \
node tools/handle-chrome-test.mjs && node tools/drag-noshift-test.mjs && \
node tools/wm-test.mjs && node tools/wm-concurrent-test.mjs && \
node tools/stack-test.mjs && node tools/panel-stack-test.mjs && \
node tools/editbar-center-test.mjs && node tools/materiality-test.mjs && \
node tools/capsule-scrollbar-test.mjs && node tools/fudau-repro.mjs && \
node tools/layout-parity.mjs capture /tmp/p9af.json && \
node tools/layout-parity.mjs compare tools/parity-baseline.json /tmp/p9af.json
```
Expected: 全綠。任何紅燈修到綠。

- [ ] **Step 2: 由控制器（非子代理）merge 至 main 並 push**

```bash
git checkout main && git pull --ff-only origin main && \
git merge --no-ff phase9-page-engine -m "merge: 九期A——面板視窗化基座（panel_all_v2.html 線上預覽）" && \
git push origin main && git checkout phase9-page-engine && git rebase main
```

（merge 訊息尾行加 Co-Authored-By。production panel_all.html 行為零變化——merge 內容僅新增 v2 頁與旗標化引擎。）

- [ ] **Step 3: 線上驗證**

```bash
curl -sI https://dasawada.github.io/cspanel/panel_all_v2.html | head -1   # HTTP/2 200
```
