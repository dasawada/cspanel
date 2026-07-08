# 第三期交接規格：編輯模式健壯化 + 分頁視窗管理器

> **給接手的 Fable（Copilot）**：這份文件是自足的實作交接。你可以冷啟動照它派工。
> 已由使用者在 brainstorming 階段核可設計方向；本文含**只有登入態才拿得到的真實 markup** 與**已重現確認的 bug 根因**——這些你自己拿不到，務必以本文為準。

---

## 0. 現況（Current State）

- **Repo**：`dasawada/cspanel`（GitHub Pages，`https://dasawada.github.io/cspanel/`，**無 build、純靜態、ES modules**）。工作目錄 `/Users/jianmingxiu/cspanel_clone/cspanel`。
- **Git**：`main` 乾淨、與 `origin/main` 同步。前兩期已全部上線（PR #1 Liquid Glass 美學、PR #2 畫布引擎化）。
- **已上線的成果與文件**：
  - `docs/superpowers/specs/2026-07-05-liquid-glass-migration-design.md`、`docs/superpowers/plans/2026-07-05-liquid-glass-migration.md`（第一期）
  - `docs/superpowers/specs/2026-07-06-canvas-engine-design.md`、`docs/superpowers/plans/2026-07-06-canvas-engine.md`（第二期）
  - **`docs/CANVAS.md`** — 畫布引擎的擴充契約（層帶表、manifest schema、白名單、SOP）。**動任何畫布/面板前先讀它。**
  - **`tools/layout-parity.mjs`** + `tools/parity-baseline.json` + `tools/parity-selectors.json` — 佈局視差 harness（stub 登入、量 rect + 疊序，`compare` tolerance 0px）。是階段性硬驗收閘。
- **關鍵架構事實**（改動前必懂）：
  - `script/canvas-engine.js`：`loadCanvas(manifest)` 生成 slot、注入幾何（`<style id="canvas-geometry">`）、調度 init/clear、編輯模式（`window.CanvasEdit = {toggle,enter,exit,reset}`）。認證邏輯逐字移植自舊 mediator。
  - `script/canvases/cs.js`：客服畫布 manifest。**座標唯一權威在此**（CSS 不留幾何）；**z-index 只准引用 `--layer-*` 層帶**（`--layer-panel:100`/`panel-active:200`/`dropdown:300`/`bar:400`/`modal:500`/`toast:600`，定義於 `style/v2/tokens.css`）。
  - 編輯模式：登入列「編排」鈕進入，可拖面板浮現把手（`.gl-edit-handle`）、佈局存 `localStorage['cspanel.layout.cs.v1'] = {panelId:{x,y}}`。可拖面板 = manifest 條目有 `rootSelector` + `behaviors:['draggable']` + 非 `alwaysDraggable`。
  - 行為契約（不可破壞）：事件 `firework-login-success`/`firework-logout-success`/`fw-auth-state-change`/`firework-force-logout`；`html.auth-active` 防閃爍；`window.verifyFireworkAuth`、localStorage `firebase_id_token`；面板模組 init/clear 簽名；**`panel_all.html` quirks mode——不可加 DOCTYPE**。
  - **不得 push / merge main**，交由使用者。小改可直上 main、大改走分支+PR（使用者偏好）。

---

## 1. 本期範圍（三個子專案，一次做）

| # | 子專案 | 規模 | 說明 |
|---|---|---|---|
| A | fudausearch 熱修 | 小 | 修 `新增資料夾/轉單小工具.html` 的雙層嵌套 + 拖不動（活工具回歸） |
| B | 分頁視窗管理器 | 大 | `panel-tabs-container` 的四個 tab 做成 Chrome 式撕離/重排/合併/縮放 |
| C | 編輯模式收尾 | 小 | 會議 nav 讓位 + IPsearch 可拖 + 清死樣式 |

**使用者已定案的決策**：tab 管理**隨時可拖**（像 Chrome，不需進編輯模式）；撕出的視窗**可定位＋可縮放**；iframe **保住狀態**（常駐池、零重載）；`.ClassLogpanel`（若出現）**改 absolute**；三者**綁一起一次做**、一起上線。

---

## 2. 子專案 A — fudausearch 熱修

### 已重現確認的根因

在 `script/fusearch-panel.js`：`initFudausearchPanel`/`clearFudausearchPanel` 是為 panel_all 的「注入到空占位符」模型設計的。但 `新增資料夾/轉單小工具.html` 有**自帶的靜態 markup**（含拖曳把手 `#fudausearch-drag-handle`），卻把**容器 id 當占位符 id** 傳進去。

序列（headless 重現，三步 DOM 快照）：

| 時點 | 容器數 | 巢狀 | 拖曳把手 |
|---|---|---|---|
| 頁面 `makeDraggable` 綁定後 | 1 | 0 | **1** |
| Firebase 首次 `null` 回呼 → `clearFudausearchPanel` 做 `innerHTML=''` | 1 | 0 | **0**（把手被清） |
| 登入 → `initFudausearchPanel` 注入**自帶容器的模板** | **2** | **1** | 0（雙層） |

- `onAuthStateChanged` 載入時**先回一次 null** → 登出分支 `clearFudausearchPanel('fudausearch-container')` → `innerHTML=''` 洗掉靜態 markup（含把手）→ `makeDraggable` 綁的把手沒了 → **拖不動**。
- 登入後 `initFudausearchPanel` 見容器空 → 注入模板，模板本身又包一層 `.fudausearch-container` → **雙層嵌套**。
- **歸屬**：此 clear/inject 生命週期是更早 commit（`7d2fb8b`）就有的，非前兩期造成；屬潛藏 bug 現在被觸發。

### 修法（`script/fusearch-panel.js`，panel_all 與轉單頁通吃）

1. **`clearFudausearchPanel` 改非破壞式**：只清 `#fudausearch-results`、`#fudausearch-suggestions` 內容、重設 input 值與 `fudausearch_cachedData`，**不動容器結構與把手**（不要 `innerHTML=''`）。
2. **`bindFudausearchEvents` 改冪等**：對 `#fudausearch-input`、`#fudausearch-clear-btn` 先 `removeEventListener(具名handler)` 再 `addEventListener`（handler 已具名：`fudausearch_updateSuggestions`、`fudausearch_clearInput`），避免非破壞式 clear 後重登入重複綁定。
3. `initFudausearchPanel` 的既有 guard（`if (!container.querySelector('#fudausearch-input')) container.innerHTML = template`）保留——非破壞式 clear 後，轉單頁 input 仍在 → 跳過注入 → 無雙層；panel_all 首登入仍注入。

### 驗證

- 把「§2 重現」轉成回歸測試：用下方 fixture（`tools/fudau-repro.html` 之類），headless 跑三步、斷言 `containers===1 && dragHandles===1`（修好後）。
- `node --check script/fusearch-panel.js`。
- panel_all：登入→登出→再登入，fudausearch 面板正常、無重複綁定（輸入一次只觸發一次 suggestion）。parity harness 仍 `PARITY OK`。

### 重現 fixture（給你做回歸測試用）

```html
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<div id="app-container">
  <div class="fudausearch-container" id="fudausearch-container" style="z-index:998;">
    <div class="fudausearch-drag-handle" id="fudausearch-drag-handle">職代是誰</div>
    <button class="fudausearch-fixed-button" id="fudausearch-fixed-button" style="display:none;">學務部</button>
    <div class="fudausearch-input-wrapper">
      <input type="text" id="fudausearch-input" autocomplete="off"/>
      <button class="fudausearch-clear-btn" id="fudausearch-clear-btn">x</button>
      <div id="fudausearch-suggestions" class="fudausearch-suggestions"></div>
    </div>
    <div id="fudausearch-results"></div>
  </div>
</div>
<script type="module">
  import { makeDraggable } from '/script/draggable.js';
  import { initFudausearchPanel, clearFudausearchPanel } from '/script/fusearch-panel.js';
  const panel = document.getElementById('fudausearch-container');
  const handle = panel.querySelector('.fudausearch-drag-handle');
  makeDraggable(panel, handle, { left:300, top:185, color:'#a9bcc7'});
  clearFudausearchPanel('fudausearch-container');   // 模擬 Firebase null-first
  initFudausearchPanel('fudausearch-container');     // 模擬登入
  window.__snap = { containers: document.querySelectorAll('.fudausearch-container').length,
                    dragHandles: document.querySelectorAll('.fudausearch-drag-handle').length };
</script></body></html>
```
修好後 `__snap` 應為 `{containers:1, dragHandles:1}`（目前壞的是 `{containers:2, dragHandles:0}`）。

---

## 3. 子專案 B — 分頁視窗管理器

### 真實伺服器 markup（登入態擷取，唯一權威來源）

`auth-protected-tabs.js` 從 Firestore 取回、注入這兩塊。**注意：`.idsearchpanel`/`.ClassLogpanel` 不在其中——是死樣式。實際只有兩個根：`.panel-tabs-container` 與 `.IPsearch_in_panelALL`。**

**注入到 `#auth-protected-tabs-placeholder`**（四個 tab，三 iframe + 一 DOM）：
```html
<div class="panel-tabs-container">
  <div class="panel-tabs">
    <input type="radio" id="panel-tab-naniclub" name="panel-tab" checked>
    <label for="panel-tab-naniclub">🗝️帳號搜尋</label>
    <div class="panel-tab-content"><iframe class="responsive-iframe" src="https://stirring-pothos-28253d.netlify.app/7pc55uah1trppaw7ny.html"></iframe></div>
    <input type="radio" name="panel-tab" id="panel-tab-classlog">
    <label for="panel-tab-classlog">📊教室LOG</label>
    <div class="panel-tab-content"><iframe class="responsive-iframe" src="https://stirring-pothos-28253d.netlify.app/xu7fwfh93rbyorxkds.html"></iframe></div>
    <input type="radio" name="panel-tab" id="panel-tab-courselog">
    <label for="panel-tab-courselog">📝課程日誌</label>
    <div class="panel-tab-content"><iframe class="responsive-iframe" src="https://stirring-pothos-28253d.netlify.app/hhnueyfrsoj1na8pjj.html"></iframe></div>
    <input type="radio" name="panel-tab" id="panel-tab-tools">
    <label for="panel-tab-tools">🚀快捷貼圖</label>
    <div class="panel-tab-content"><div class="appicon"><!-- 圖片複製工具，純 DOM，非 iframe --></div></div>
  </div>
</div>
```

**注入到 `#auth-protected-ip-placeholder`**：
```html
<div class="IPsearch_in_panelALL" style="transition:none; height:36px;">
  <div id="ip_search_form_container"><form id="ip_search_form">
    <label for="ip_input">IP：</label>
    <input type="text" id="ip_input" placeholder="請輸入 IP" autocomplete="off">
    <span id="ip_search_spinner" class="ip-search-spinner"></span>
  </form></div>
  <div id="ip_result_container">
    <p id="ip_country"></p><p id="ip_org"></p><p id="ip_hostname"></p>
  </div>
  <a href="https://rpki.tw/stats/valid.html" class="IP_info-button" target="_blank">?</a>
</div>
```

### 設計

- **iframe 常駐池**：`auth-protected-tabs.js` 的 `glDecorate`（注入後鉤子）觸發視窗管理器：把三個 iframe + tools 的 `.appicon` **一次性搬進常駐池**（`position:absolute`，與視窗同座標空間），**之後永不在 DOM 搬移**（搬移=重載；只有這一次移動，發生在剛登入 iframe 本就在載入，等於免費）。丟棄伺服器的 radio/label/tab chrome，改渲染自家視窗。
- **Pane**：四個內容（`naniclub`/`classlog`/`courselog` iframe、`tools` DOM）。作用中 pane 對位到所屬視窗內容區（`getBoundingClientRect` 同座標換算）、非作用中 `display:none`（**注意：`display:none` 不重載 iframe；只有 DOM 重新 parent 才重載**）。
- **Window**：可拖可縮放的框 + tab 列 + 內容區 + `{位置x,y, 尺寸w,h, tabs[], active, z}`。初始一個視窗裝四 tab、位置尺寸沿用 `panel-tabs-container`（`left:410,top:160,w:500,h:600`）、外觀同現在。
- **互動（隨時可用，像 Chrome）**：tab 列內重排、撕出成新視窗、拖回別視窗合併、點 tab 切換、拖 tab 列空白處移動視窗、拖邊角縮放（含最小尺寸）、點視窗提到最上層。拖曳/縮放時**沿用 `draggable.js` 那個最高 z（2147483647）透明 shield** 防 iframe 吃滑鼠事件。
- **幾何對位**：每次 drag/resize/raise/scroll 觸發 `syncPanes()` 更新作用中 pane 的 `left/top/width/height` 貼合視窗內容區。pane 池與視窗同一 containing block、同座標系（避免 fixed+scroll 分離）。
- **持久化**：新 key `localStorage['cspanel.windows.cs.v1'] = {windows:[{id,tabs,active,x,y,w,h,z}]}`。撕出→新視窗、合併→移動 tab id、空視窗移除。DOM 由此重建，跨重注入還原。編輯模式「重設佈局」（`CanvasEdit.reset`）一併清此 key 回預設。
- **生命週期**：glDecorate 注入完成 → 搬內容進池 → 依存檔（或預設單視窗）建視窗 → 啟動 sync。登出（`clearProtectedTabs`）→ 拆池與視窗。
- **與引擎關係**：tab 視窗是**獨立常駐系統，不受編輯模式管轄**。`panel-tabs-container` **不再是普通可拖面板**（它變成初始視窗）——所以**不要**把它加進 manifest 的 dragRoots。

### 檔案
- 新增 `script/window-manager.js`（模型 + 渲染 + 互動 + 持久化 + syncPanes）、`style/v2/window-manager.css`（視窗 chrome、tab 列、縮放把手、pane 池）。
- 改 `script/auth-protected-tabs.js`：`glDecorate` 交棒視窗管理器（注入完成即建視窗）；登出清理。
- 可複用 `script/draggable.js` 的拖曳機制與 shield；縮放可能需小 helper。

### 驗證（關鍵）
- 視窗管理器操作的是 **parity harness 會 stub 掉的伺服器內容**——harness 測不到它。改用**上方真實 markup 做 fixture**，headless 自動測：撕離→新視窗、合併→回單視窗、重排 tab、縮放後 pane 對位、`display:none` 不重載（檢查 iframe 未 reload：比對 iframe 的 `contentWindow` 身分或載入計數）、持久化（reload 後還原）。
- parity harness 仍須 `PARITY OK`（證明其他面板不受影響）。
- 使用者真登入實測。

---

## 4. 子專案 C — 編輯模式收尾

- **會議 nav 讓位**：`style/v2/canvas-edit.css` 加 `html.canvas-editing .meeting-search-panel-menu nav { margin-top: 22px; }`（把手佔頂 22px、nav 滑其下，退出復原）。順手把 `nav a`(801)/`.animation`(800) 魔術數字收進層帶（選配）。
- **IPsearch 可拖**：`cs.js` 的 `protected` 條目加 dragRoot（或給 IPsearch 獨立處理）——`{selector:'.IPsearch_in_panelALL', id:'ipsearch', zOrder:5}`，把它的 z-index 從 `sharedGeometryCss` 遷到 zOrder 供給（同 DT 手法，遵守 CANVAS.md §4.6：有 rootSelector 者不得在 sharedGeometryCss 宣告 z-index）。
- **清死樣式**：`cs.js` 的 `sharedGeometryCss` 移除 `.idsearchpanel`、`.ClassLogpanel` 幾何（實測不存在）。

---

## 5. 建議分階段（一個 spec、計畫分階段，每階段可獨立驗收/上線）

1. **A** fudausearch 熱修（含回歸 fixture）
2. **C** nav 讓位 + IPsearch 可拖 + 清死樣式（parity 驗收）
3. **B1** 視窗骨架：iframe 池 + 單視窗渲染（外觀同現在）+ 撕離/重排/合併
4. **B2** 視窗縮放 + z 序 + 持久化 + 重注入還原
5. **契約文件**：`docs/CANVAS.md` 加視窗管理器章節（層帶、SOP、白名單、已知刻意變更）

---

## 6. 給 Fable 的派工提醒

- **先讀** `docs/CANVAS.md` 與 `docs/superpowers/plans/2026-07-06-canvas-engine.md`（懂 manifest/層帶/parity 契約）再動手。
- 每階段以 **parity harness** 為非伺服器面板的硬驗收；**伺服器面板（B、IPsearch）harness 測不到，改用本文 markup 做 fixture + 使用者真登入實測**。
- 遵守：座標只在 manifest、z-index 只引用 `--layer-*`、quirks mode 不加 DOCTYPE、事件契約不動、**不 push/merge 由使用者**。
- 建議沿用「每任務實作→獨立審查→ledger 記帳」的節奏；大功能（B）先出可獨立驗收的骨架再疊縮放/持久化。
