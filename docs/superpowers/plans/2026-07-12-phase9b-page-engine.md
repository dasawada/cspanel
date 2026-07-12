# 九期B「page 引擎」實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 panel_all_v2.html 實現完整 page 引擎：面板拖重疊成組為 page、page 成為 wm 視窗的 tab（拖進/撕出/重排復用既有協議）、頁內垂直/自由佈局、對稱解散、quirks 歸隊、持久化——全程零 re-parent（iframe 不重載）。

**Architecture:**
1. **wm 兩段掛載**：v2 模式下 `mountWindowManager` 由 canvas-engine 於 initAllModules 無條件呼叫（可零 iframe tab 啟動）；auth-protected-tabs 的注入完成鉤子改呼叫 `WindowManager.adoptTabs(tabsContainer)` 認養 iframe tabs。v1 模式維持現行單段路徑逐位元不變。
2. **pageHost 委派介面**：wm 不懂面板。page tab 的標題、成員定位/隱藏、空頁通知全部經 `opts.pageHost = { getTitle(pageId), layout(pageId, contentRect|null, hostWin), onPageEmpty(pageId) }` 委派給 canvas-engine。page tab 在 wm 內只是 `'pg:'` 前綴的 tab id。
3. **成員永不 re-parent**：成員面板 DOM 留在原處（含 body-mounted 罐頭），引擎以座標差值定位到視窗內容區（generic 數學：目標視口座標－目前 getBoundingClientRect ＋目前 offset，對任何 containing block 都成立）。
4. 成組手勢（拖重疊 40%＋懸停 500ms＋預覽框＋Esc）在引擎側實作於 hover 把手拖曳管線上；DRAG_THRESHOLD 泛化（零位移點擊不寫 layout）一併收（九期A 審查歸位項）。

**Tech Stack:** 同九期A。Server http://localhost:8123。

**Spec:** `docs/superpowers/specs/2026-07-12-phase9-page-engine-design.md`（§2/§3/§5/§7 為本期）
**Ledger 歸位項:** `.superpowers/sdd/progress.md` 九期B 待辦段

## Global Constraints

- repo `~/cspanel_clone/cspanel/`、分支 `phase9-page-engine`。絕不 `git add -A`；絕不 add `.superpowers/`/scratchpad。
- **production 零變化鐵律**：v1 模式（未設旗標/未傳 config）所有行為與儲存 key 逐位元不變；v1 頁全套既有回歸全綠。
- **儲存隔離鐵律**：v2 頁絕不讀寫 `.v1`／既有 key。
- **iframe 零重載鐵律（§7.2）**：任何 tab/page/成員操作皆純 style/所屬關係變更；pane 池與成員面板永不 re-parent。回歸套件以 iframe `contentWindow` 標記存活為命門斷言。
- draggable.js 零改動。wm 既有 iframe tab 的 a11y／藥丸 tab 規則零改動（page tab 沿用同一套 `.wm-tab` 與 roving tabindex——它就是一顆 tab）。
- 新 CSS 鐵律同前（§4.8/§4.2/§4.7）。
- page id 一律 `'pg:'` 前綴（與 iframe tab id 命名空間隔離；iframe tab id 來自伺服器 radio id，不含冒號）。
- 測試一律走 v2 頁＋登入 stub＋`**/api/order-tool-api` 攔截（比照 page-engine-a-test.mjs）。
- commit 尾行：`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 本期完成推 main 供線上預覽（已授權）；**定版合併進 panel_all.html 屬九期C，需使用者確認，本期絕不做**。

---

### Task 1: 引擎側拖曳管線強化——零位移不寫 layout＋拖曳遙測鉤子

**Files:**
- Modify: `script/canvas-engine.js`（attachHoverHandles 內 onPositionChange wrapper）
- Test: `tools/page-engine-b-test.mjs`（新檔骨架＋A 區）

**Interfaces:**
- Produces: 引擎側 wrapper：`onPositionChange` 只在「與拖曳起點位移 ≥ 6px」時寫 layout（閾值常數 `ENGINE_DRAG_THRESHOLD = 6` 匯出供測試/後續 Task 引用）；同時引擎記錄「目前拖曳中的面板 id 與即時 rect」到模組級 `dragTelemetry`（`{ panelId, rect } | null`，Task 4 成組偵測消費）。draggable.js 零改動——位移判定用「down 時 rect vs 結束 pos」在引擎側計算。
- Consumes: 九期A 的 attachHoverHandles／makeDraggable 管線。

- [ ] **Step 1: 失敗測試（page-engine-b-test.mjs 新檔）**

骨架複製 page-engine-a-test.mjs 的 stub/攔截/assert 器結構（同一套 A() 收集器與收尾 exit code），A 區：

```js
// ===== A. 零位移點擊不寫 layout（DRAG_THRESHOLD 泛化，九期A 審查歸位）=====
const opt = '.optitlepanel';
await page.waitForSelector(opt + ' .gl-hover-hot', { timeout: 15000 });
await page.evaluate(() => localStorage.removeItem('cspanel.layout.cs.v2'));
const b = await page.locator(opt).boundingBox();
await page.mouse.move(b.x + b.width / 2, b.y + 4);
await page.mouse.down(); await page.mouse.up();           // 熱區點一下，零位移
await page.waitForTimeout(100);
A(await page.evaluate(() => {
  const raw = localStorage.getItem('cspanel.layout.cs.v2');
  return !raw || !JSON.parse(raw).optitle;
}), '零位移點擊不寫 layout');
await page.mouse.move(b.x + b.width / 2, b.y + 4);
await page.mouse.down();
await page.mouse.move(b.x + b.width / 2 + 40, b.y + 44, { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(100);
A(await page.evaluate(() => !!JSON.parse(localStorage.getItem('cspanel.layout.cs.v2') || '{}').optitle),
  '實際拖曳仍寫 layout');
```

Run `node tools/page-engine-b-test.mjs` → Expected: 第一條 FAIL（現況零位移也寫）。

- [ ] **Step 2: 實作 wrapper 與 dragTelemetry**

attachHoverHandles 內，makeDraggable 呼叫改為：面板 pointerdown（熱區/把手）時記 `startRect = el.getBoundingClientRect()` 與 `dragTelemetry = { panelId: p.id, el }`；`onPositionChange(pos)` 時計算 `Math.hypot(pos.left - startLeft, pos.top - startTop)`（startLeft/Top 取自 down 時 offset）——`< ENGINE_DRAG_THRESHOLD` 則 return 不寫；結束時 `dragTelemetry = null`。dragTelemetry 供 Task 4 的重疊偵測在 pointermove 節流回呼中讀取（本 Task 先建狀態，未消費）。

- [ ] **Step 3: 綠燈＋回歸**

```bash
node tools/page-engine-b-test.mjs && node tools/page-engine-a-test.mjs && node tools/drag-noshift-test.mjs
```

- [ ] **Step 4: Commit**（`feat(engine): 拖曳零位移不寫 layout＋dragTelemetry 鉤子（九期B Task 1）`）

---

### Task 2: wm 兩段掛載重構（v2 無條件核心＋adoptTabs 認養）

**Files:**
- Modify: `script/window-manager.js`（mountWindowManager 拆核心；新 `adoptTabs`；known-id 淨化泛化）
- Modify: `script/auth-protected-tabs.js`（glDecorate 交棒點：v2 模式改走 adoptTabs——先 grep `mountWindowManager` 定位呼叫點）
- Modify: `script/canvas-engine.js`（initAllModules 內 v2 模式無條件 mount；clearAllModules 對稱 destroy）
- Test: `tools/page-engine-b-test.mjs`（B 區）

**Interfaces:**
- Produces:
  - `mountWindowManager(host, opts)`：v2 路徑下 `tabsContainer` 可不存在——不再 early-return no-op，以零 tab 啟動（`windows` 可為空陣列，render 空 layer）。
  - `api.adoptTabs(tabsContainer)`：探索 tabs、建 pane 搬池、丟棄伺服器 chrome；saved windows 中記得的 tab 歸位，其餘塞入第一個視窗（無視窗則建預設視窗）。**冪等**（同 id 再 adopt 忽略）。
  - `api.hasTabs()`：回傳是否已有任何 tab/視窗（測試用）。
  - 淨化泛化：`loadWindows` 的合法 id 判定從閉包 `tabOrder` 改為 `isKnownTab(id)`（iframe 已認養集合 ∪ `'pg:'` 開頭且存在於 pages store——Task 3 注入，本 Task 先留 `opts.isPageId` 可選回呼、預設 `() => false`）。
  - **v1 路徑鐵律**：v1 模式下 auth-protected-tabs 照舊呼叫單段 mount（tabsContainer 必在）、行為逐位元不變——用旗標分流，不動 v1 呼叫形狀。
- Consumes: Task 1 無依賴（平行安全，但按序執行）。

- [ ] **Step 1: 失敗測試（B 區）**

```js
// ===== B. wm 兩段掛載：核心先起、adoptTabs 認養 =====
A(await page.evaluate(() => !!window.WindowManager && typeof window.WindowManager.adoptTabs === 'function'),
  'v2 模式 WindowManager 核心已掛載且有 adoptTabs');
// protected 注入完成後 iframe tabs 已被認養（stub 環境有 server markup 經 Firestore stub？
// ——parity stub 不含 protectedContent，故此處斷言為「零 tab 啟動不炸」＋ hasTabs() 反映實況）
A(await page.evaluate(() => typeof window.WindowManager.hasTabs === 'function'), 'hasTabs API 存在');
```

（stub 環境無 protected markup——正好驗「零 tab 啟動」路徑；iframe 認養的完整驗證走既有 wm-fixture 系測試：v1 路徑 wm-test/wm-concurrent 必須全綠即為認養等價性證據，因 v1 仍走單段。另補一條 v2 fixture 斷言見 Step 3。）

- [ ] **Step 2: 實作**

`mountWindowManager` 拆分：探索/搬池/丟 chrome 三段抽成 `adoptTabsInternal(tabsContainer)`；`tabOrder`/`tabMeta`/`panes`/`defaultRect` 改可變閉包狀態。v1 模式（`!window.CSPANEL_ENGINE_V2`）：mount 內直接呼叫 `adoptTabsInternal`（行為不變）。v2 模式：mount 不需 tabsContainer；`api.adoptTabs` 公開。`defaultWindow()` 在零 tab 時不預建；`loadWindows` 空 saved＋零 tab → `[]`。auth-protected-tabs 交棒點：v2 時 `window.WindowManager.adoptTabs(container)`（核心必已由引擎先掛——若尚未，fallback 原路徑 mount，防呆）。canvas-engine `initAllModules`：v2 模式在 `registerPanelStack()` 後 `mountWindowManager(hostEl, { canvasId, isPageId })`（host 取 `#auth-protected-tabs-placeholder` 或 `.panel_all_container`——以現行 auth-protected-tabs 傳入的同一 host 為準，實作時 grep 確認）；`clearAllModules` 對稱 `WindowManager.destroy()`。

- [ ] **Step 3: 綠燈＋雙軌回歸**

```bash
node tools/page-engine-b-test.mjs && node tools/page-engine-a-test.mjs && \
node tools/wm-test.mjs && node tools/wm-concurrent-test.mjs && node tools/panel-stack-test.mjs && node tools/stack-test.mjs
```
（wm-fixture 系測試走 v1 單段路徑——全綠即 production 零變化證據。）

- [ ] **Step 4: Commit**（`refactor(wm): 兩段掛載——v2 核心無條件起、adoptTabs 認養 iframe tabs（九期B Task 2）`）

---

### Task 3: page 模型＋pageHost 介面＋wm page-tab 支援

**Files:**
- Modify: `script/canvas-engine.js`（pages store、pageHost 實作、成員定位數學）
- Modify: `script/window-manager.js`（page tab：tabMeta 委派 getTitle、syncPanes 委派 layout、applyTabDrop 空頁 onPageEmpty、`api.createPageWindow(pageId, rect)`／`api.addPageTab(winId, pageId)`）
- Test: `tools/page-engine-b-test.mjs`（C 區——用程式 API 先驗資料流，手勢屬 Task 4）

**Interfaces:**
- Produces:
  - 引擎：`pages` store（`cspanel.pages.cs.v1` 讀寫；模型見 spec §3.1，id 帶 `'pg:'` 前綴）；`window.PageEngine = { create(members, opts), addMember(pageId, panelId), removeMember(pageId, panelId), dissolve(pageId), get(pageId), list() }`（v2 模式限定；`create` 回 pageId 並呼叫 wm `createPageWindow`；`removeMember` 即退組（Task 5 拖出手勢的程式入口），剩一員時自動 dissolve）。
  - 引擎 pageHost 實作：
    - `getTitle(pageId)`：成員 label 以「・」串接。
    - `layout(pageId, contentRect|null, hostWin)`：null → 全成員 `display:none`；rect → stack 模式垂直排（`y 累加成員高度＋var(--space-4) 間距`，成員維持原寬）、free 模式按 member.rect；成員定位數學＝`目前 offsetLeft + (目標視口x − 目前 getBoundingClientRect().x)`（對 body-mounted 罐頭同樣成立）；同時設成員 `--stack-rank` 同宿主、掛 `.gl-stack-pane`（比照 wm pane 疊序做法）。
    - `onPageEmpty(pageId)`：清 store。
  - wm：tabs[] 接受 `'pg:'` id；render 的 tab title 對 pg id 走 `opts.pageHost.getTitle`；syncPanes 對 pg tab 呼 `pageHost.layout(id, 作用中 ? contentRect : null, win)`；`isKnownTab` 接上 `opts.isPageId`；空視窗移除邏輯照舊。
  - 成員入組期間：引擎將該面板自 stack-manager unregister、掛 `pointerdown → stack.raise(hostWinId)`；退組時逆轉。
- Consumes: Task 2 的 adoptTabs 架構與 `isPageId` 掛點。

- [ ] **Step 1: 失敗測試（C 區，程式 API 驅動）**

```js
// ===== C. page 資料流（API 驅動；手勢在 D 區）=====
const pgId = await page.evaluate(() => window.PageEngine.create(['optitle', 'fudausearch']));
A(typeof pgId === 'string' && pgId.startsWith('pg:'), `PageEngine.create 回 pg: id（${pgId}）`);
await page.waitForTimeout(200);
const c1 = await page.evaluate((id) => {
  const win = [...document.querySelectorAll('.wm-window')].find((w) =>
    [...w.querySelectorAll('.wm-tab')].some((t) => t.dataset.tab === id));
  const content = win.querySelector('.wm-content').getBoundingClientRect();
  const o = document.querySelector('.optitlepanel').getBoundingClientRect();
  const f = document.querySelector('.fudausearch-container').getBoundingClientRect();
  return {
    title: win.querySelector(`.wm-tab[data-tab="${CSS.escape(id)}"]`).textContent,
    optIn: o.top >= content.top - 1 && o.left >= content.left - 1,
    stackBelow: f.top >= o.bottom - 1, // 垂直依序
    persisted: JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]').length === 1,
  };
}, pgId);
A(c1.title.includes('標題生成') && c1.title.includes('職代查詢'), `page tab 標題串接（${c1.title}）`);
A(c1.optIn, '成員定位進視窗內容區');
A(c1.stackBelow, 'stack 模式垂直依序排列');
A(c1.persisted, 'pages store 持久化');
// 切走 tab（若同視窗有其他 tab）→ 成員隱藏；此 stub 環境 page 視窗只有一顆 tab，
// 改驗 dissolve：
await page.evaluate((id) => window.PageEngine.dissolve(id), pgId);
await page.waitForTimeout(200);
A(await page.evaluate(() =>
  getComputedStyle(document.querySelector('.optitlepanel')).display !== 'none' &&
  JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]').length === 0),
  'dissolve：成員回畫布、store 清空');
```

- [ ] **Step 2: 實作**（依 Interfaces；wm 端與引擎端可同 commit）
- [ ] **Step 3: 綠燈＋雙軌回歸**（B 測試＋A 測試＋wm 兩套＋stack 兩套＋layout-parity v1 零 diff）
- [ ] **Step 4: Commit**（`feat(page): page 模型＋pageHost 委派＋wm page-tab（九期B Task 3）`）

---

### Task 4: 成組手勢（拖重疊＋懸停預覽）

**Files:**
- Modify: `script/canvas-engine.js`（拖曳中重疊偵測、懸停計時、預覽框、drop 決策）
- Modify: `style/v2/page-engine.css`（`.gl-group-preview` 預覽框）
- Test: `tools/page-engine-b-test.mjs`（D 區）

**Interfaces:**
- Produces: 拖曳面板（dragTelemetry 進行中）時，每 rAF 節流檢查與其他面板 root／既有 page 視窗內容區的重疊：`重疊面積 / min(兩者面積) ≥ 0.4` 持續 `≥ 500ms`（常數 `GROUP_OVERLAP_RATIO`/`GROUP_DWELL_MS` 匯出）→ 顯示 `.gl-group-preview`（絕對定位罩在目標上，token 樣式：`--accent-ring` 外框＋`--accent-tint` 底＋居中「組成一頁」字樣）；此時放開 → `PageEngine.create([目標id, 拖曳id])`（目標已是 page 視窗則 `addMember`）；拖離重疊或按 Esc → 預覽消失、正常落位。**成組後拖曳面板不寫畫布 layout**（成組即接管）。
- Consumes: Task 1 dragTelemetry、Task 3 PageEngine/pageHost。

- [ ] **Step 1: 失敗測試（D 區）**

```js
// ===== D. 成組手勢 =====
// 把 shrturl 拖到 roof 上懸停 600ms → 成組
const s = await page.locator('.linkout').boundingBox();
const r = await page.locator('.roofbutton').boundingBox();
await page.mouse.move(s.x + s.width / 2, s.y + 4);
await page.mouse.down();
await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2, { steps: 8 });
await page.waitForSelector('.gl-group-preview', { timeout: 3000 });
A(true, '重疊懸停浮現成組預覽');
await page.waitForTimeout(600);
await page.mouse.up();
await page.waitForTimeout(300);
const d1 = await page.evaluate(() => {
  const pgs = JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]');
  return { n: pgs.length, members: pgs[0] ? pgs[0].members.map((m) => m.panelId) : [] };
});
A(d1.n === 1 && d1.members.includes('shrturl') && d1.members.includes('roof'),
  `放開成組（members=${d1.members.join(',')}）`);
// 誤觸護欄：快速掠過不成組
const o2 = await page.locator('.optitlepanel').boundingBox();
const f2 = await page.locator('.fudausearch-container').boundingBox();
await page.mouse.move(o2.x + o2.width / 2, o2.y + 4);
await page.mouse.down();
await page.mouse.move(f2.x + f2.width / 2, f2.y + f2.height / 2, { steps: 3 }); // 掠過
await page.mouse.move(f2.x + f2.width / 2 + 300, f2.y + 200, { steps: 3 });     // <500ms 內離開
await page.mouse.up();
await page.waitForTimeout(200);
A(await page.evaluate(() =>
  JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]').length === 1),
  '快速掠過不成組（護欄）');
// 清場供後續區段
await page.evaluate(() => {
  const pg = JSON.parse(localStorage.getItem('cspanel.pages.cs.v1'))[0];
  window.PageEngine.dissolve(pg.id);
});
```

- [ ] **Step 2: 實作**（重疊偵測掛在引擎自己的 pointermove rAF——不動 draggable.js；Esc 用 keydown 一次性監聽）
- [ ] **Step 3: 綠燈＋B 全區＋A 測試**
- [ ] **Step 4: Commit**（`feat(page): 拖重疊懸停成組手勢＋預覽框（九期B Task 4）`）

---

### Task 5: 頁內互動——自由佈局、拖出退組、剩一解散

**Files:**
- Modify: `script/canvas-engine.js`
- Test: `tools/page-engine-b-test.mjs`（E 區）

**Interfaces:**
- Produces: 入組成員的把手拖曳語義切換：拖曳結束位置**在宿主內容區內** → 更新 member.rect、`layoutMode='free'`（可排田字）；**在內容區外** → 退組回畫布（恢復 detachedRect），page 剩一員自動 dissolve。成員 hover 把手在入組期間照常運作（同一 makeDraggable，onPositionChange wrapper 分流）。
- Consumes: Task 3/4。

- [ ] **Step 1: 失敗測試（E 區）**：成組三員（API create）→ 頁內拖一員到右側（結束仍在內容區）→ 斷言 `layoutMode==='free'` 且該員 rect 更新、其餘兩員不動；把一員拖出內容區 → 斷言退組（畫布可見、pages store 少一員）；再拖出一員 → 剩一自動解散（store 清空、最後成員回畫布）。斷言程式碼比照 C/D 區風格撰寫（實作者依此意圖寫具體斷言，數值容差 ±2px）。
- [ ] **Step 2: 實作**
- [ ] **Step 3: 綠燈＋B 全區＋A 測試＋隔離斷言仍綠**
- [ ] **Step 4: Commit**（`feat(page): 頁內自由佈局＋拖出退組＋剩一解散（九期B Task 5）`）

---

### Task 6: quirks 歸隊＋iframe 零重載命門驗證

**Files:**
- Modify: `script/canvas-engine.js`（罐頭/IPsearch 歸隊）
- Modify: `script/dragb_msg_pnl.js`（若需：罐頭入組期間停用 self-persist 寫入——優先在引擎側攔，避免動罐頭）
- Test: `tools/page-engine-b-test.mjs`（F 區）

**Interfaces:**
- Produces: 罐頭可入組：入組期間其 per-path key 寫入暫停（引擎在 layout 接管時對其 makeDraggable 的 onPositionChange 分流——罐頭的 makeDraggable 在 dragb_msg_pnl 內部，攔法：入組時引擎對 `.canned-panel` 的位置以 pageHost.layout 為權威，退組時恢復並以 detachedRect 寫回統一 layout）。IPsearch：clear→init 重注入後，引擎檢查 membership、若屬 page 則直接交 pageHost.layout 歸隊。consultant（內嵌 iframe）成組全程 iframe 零重載。
- Consumes: Task 3/5。

- [ ] **Step 1: 失敗測試（F 區）**

核心斷言（iframe 零重載命門）：

```js
// consultant 面板內嵌 iframe 標記存活法：成組前往 iframe contentWindow 種標記，
// 成組/切位/解散後標記仍在 ＝ 從未重載
await page.evaluate(() => {
  const ifr = document.querySelector('.consultantlistgooglesheet iframe');
  ifr.contentWindow.__reloadCanary = 'alive';
});
const pg2 = await page.evaluate(() => window.PageEngine.create(['consultant', 'assist']));
await page.waitForTimeout(300);
A(await page.evaluate(() => {
  const ifr = document.querySelector('.consultantlistgooglesheet iframe');
  return ifr.contentWindow.__reloadCanary === 'alive';
}), '成組全程 iframe 零重載（canary 存活）');
await page.evaluate((id) => window.PageEngine.dissolve(id), pg2);
A(await page.evaluate(() => {
  const ifr = document.querySelector('.consultantlistgooglesheet iframe');
  return ifr.contentWindow.__reloadCanary === 'alive';
}), '解散後 iframe 仍零重載');
```

（SA_iframe.html 同源，canary 可行；若 stub 環境 consultant iframe src 跨域載入失敗，fallback：改用 `performance.getEntriesByType('resource')` 計數該 src 只出現一次——實作者擇一并記錄。）
罐頭：API create(['canned','optitle']) → 罐頭定位進內容區、`draggable:/panel_all_v2.html:canned-panel-main` 在入組期間拖動後**不更新**；dissolve 後罐頭回 detachedRect。

- [ ] **Step 2: 實作**
- [ ] **Step 3: 綠燈＋雙軌全套**
- [ ] **Step 4: Commit**（`feat(page): quirks 歸隊（罐頭/IPsearch）＋iframe 零重載命門斷言（九期B Task 6）`）

---

### Task 7: 持久化整合終驗——reload 還原＋撕出合併＋推版前全套

**Files:**
- Test: `tools/page-engine-b-test.mjs`（G 區）
- Modify: 無預期（若 G 區揪出缺陷，修在對應檔）

**Interfaces:** 端到端驗收，無新介面。

- [ ] **Step 1: G 區斷言**：成組兩頁（一頁含兩員、一頁含一員經 addMember 擴充）→ reload → 斷言視窗/tab/成員定位/layoutMode 全還原；page tab 拖到另一視窗 tabbar 合併（滑鼠模擬，比照 wm-test 的拖 tab 手法）→ 撕出 → 全程 v1 keys 位元不變；最後 `CanvasEdit.toggle`（confirm 接受）重設 → pages/windows/layout `.v2` 全清、面板回 manifest 預設。
- [ ] **Step 2: 綠燈後控制器（非子代理）執行推版**：雙軌全套（A/B 測試＋既有 11 項）→ merge --no-ff → push → curl 驗 `/panel_all_v2.html` 200。
- [ ] **Step 3: ledger 更新＋九期C 檢核清單增補**
