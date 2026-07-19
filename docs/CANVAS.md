# 畫布引擎擴充契約（Canvas Engine Extension Contract）

本文件是**機器可讀規則文件**：任何 AI session（或工程師）要在 cspanel 新增面板、新增部門畫布，
或調整疊層／佈局行為，**照本文件字面規則執行即可正確**，不需要重新考古歷史 commit。
若本文件與程式碼行為不一致，以程式碼（`script/canvas-engine.js`、`script/canvases/cs.js`、
`style/v2/tokens.css`）為準，並回頭修正本文件。

每一節都給實際值、實際檔案路徑、實際指令，不留空白佔位文字。

---

## 1. 概念模型（四構件）

| 構件 | 檔案 | 是什麼 |
|---|---|---|
| **Canvas Engine** | `script/canvas-engine.js` | 泛化自 `firework-mediator.js` 的通用引擎。職責：讀 manifest 生成插槽（slot div）、把 manifest 座標／zOrder 注入成 `<style id="canvas-geometry">`、依 manifest 的 `init`/`clear` 呼叫面板模組、承接 access-client 發出的登入／清場生命週期、管理受管排程與編輯模式（`enterEditMode`/`exitEditMode`/`resetLayout`）及 `window.CanvasEdit`。它不判定身份或權限。 |
| **Canvas Manifest** | `script/canvases/<id>.js`（目前唯一實例：`cs.js`） | 一個畫布的完整宣告：`{ id, name, visibility, sharedGeometryCss, panels: [...] }`，`export default`。**座標與 z 序的唯一權威來源**——CSS 檔案本身不再留任何座標或魔術 z-index。 |
| **層級註冊表（層帶）** | `style/v2/tokens.css` 的 `--layer-*` 變數 | 全站疊層的六個語意帶，見第 4.2 節實際數值。manifest 的 `zOrder` 只在 `--layer-panel` 帶內做相對排序，不可能跨帶。 |
| **表面階層（配方）** | 分散於 `style/v2/panels.css`／`style/v2/overlays.css`／`script/theme.js`／`script/fireworkeffect.js` | `panel`／`dropdown`／`modal`／`toast` 四種固定視覺語彙（毛玻璃深淺、背景色、陰影），見第 4.4 節配方對應表。 |

目前唯一的畫布實例入口：`panel_all.html`（薄殼）→

```html
<script type="module">
    import { loadCanvas } from './script/canvas-engine.js';
    import cs from './script/canvases/cs.js';
    loadCanvas(cs);
</script>
```

---

## 2. 新增面板 SOP

新增一個面板 = **面板模組本身**（`init(slotId)`/`clear(slotId)`，通常已存在或照現有面板模組風格新寫）
＋ **在畫布 manifest 的 `panels[]` 加一筆物件**。引擎按 manifest 描述去 import、呼叫、定位，面板模組不需要認識引擎、不需要認識其他面板。

### 2.1 步驟

1. 面板模組（`script/<your-module>.js`）匯出兩個具名函式：
   - `init(slotId)`：拿到插槽 id 後自行 `document.getElementById(slotId)` 掛內容、綁事件。若不需要引擎生成插槽（例如綁定伺服器既有 DOM、或像話術面板自行掛到 `document.body`），`init` 可以忽略傳入的參數，manifest 對應把 `slot` 設為 `null` 並用 `initArgs` 自行指定引數。
   - `clear(slotId)`：卸除自己掛的事件監聽器與定期任務；若面板自己擁有一塊容器，通常也要在這裡清空該容器內容（`container.innerHTML = ''` 之類），因為引擎的 `clearAllModules()` 只是逐一呼叫 `clear`，不會幫你清 DOM。
2. 在對應畫布的 manifest（例如 `script/canvases/cs.js`）的 `panels` 陣列尾端（或依第 2.3 節順序契約決定的位置）加一筆物件，欄位見第 2.2 節欄位表。
3. 若面板需要拖曳：
   - `geometryCss` 內的 `rootSelector` 對應規則要有 `position: absolute`（見第 4.5 節「幾何規則」）。
   - `behaviors: ['draggable']`；若面板要「不受編輯模式管制、隨時可拖」則改用 `alwaysDraggable: true`（此時面板模組自己要負責呼叫 `makeDraggable`，`alwaysDraggable` 只是告訴引擎「編輯模式進出時不要對它掛/卸把手」）。
4. 驗證（見第 2.4 節）。

### 2.2 Manifest 面板欄位表（完整 16 欄，型別＋一句話說明＋來自 `cs.js` 的真實範例值）

| 欄位 | 型別 | 說明 | 範例值（`script/canvases/cs.js`） |
|---|---|---|---|
| `id` | `string`（必填） | 面板在該畫布內的唯一識別字；引擎用它當 `mods` Map 的 key、驗證重複、佈局/疊序存檔的 key。 | `'optitle'` |
| `label` | `string`（可省略，第四期新增） | 面板的人類可讀業務名稱；編輯把手顯示 `label \|\| id`。純顯示用途，引擎不以它做任何索引。 | `'標題生成'` |
| `module` | `string`（必填） | ES module 路徑，引擎以 `await import(p.module)` 動態載入。**路徑是相對於 `script/canvas-engine.js` 所在目錄解析，不是相對於 manifest 檔案！** `import()` 的相對路徑永遠以「執行 import 陳述式的模組」為基準，執行者是 `canvas-engine.js`（位於 `script/`），不是 `cs.js`（位於 `script/canvases/`）。因此即使 `cs.js` 深一層目錄，`'./optitleGG.js'` 仍正確指向 `script/optitleGG.js`。新增畫布若把面板模組放進子目錄，路徑要用 `script/canvas-engine.js` 的相對深度去寫（例如 `'./hr/panelA.js'` 對應 `script/hr/panelA.js`），**不要**用 manifest 檔案的相對深度去寫。 | `'./optitleGG.js'` |
| `init` | `string`（必填） | 模組匯出的初始化函式**名稱字串**（不是函式參照）；登入後引擎以 `m[p.init](...(p.initArgs||[]))` 呼叫。 | `'initOptitlePanel'` |
| `clear` | `string`（必填） | 模組匯出的清理函式名稱字串；登出時引擎以 `m[p.clear](...(p.clearArgs||[]))` 呼叫。 | `'clearOptitlePanel'` |
| `initArgs` | `array`（可省略，預設等同 `[]`） | 呼叫 `init` 時展開傳入的參數陣列。 | `['optitle-placeholder']` |
| `clearArgs` | `array`（可省略，預設等同 `[]`） | 呼叫 `clear` 時展開傳入的參數陣列。 | `['optitle-placeholder']` |
| `slot` | `string \| null` | 引擎要生成/標記的插槽 div id：引擎會在 `.panel_all_container` 內找該 id 的既有元素並加上 `gl-canvas-slot` class，不存在則新建一個 `<div id="..." class="gl-canvas-slot">`。`null` 表示這個面板不需要引擎生成插槽（例如綁定伺服器渲染的既有 DOM，或像話術面板自己掛到 `document.body`）。 | `'optitle-placeholder'`；`null`（`meeting-now`／`canned`） |
| `extraSlots` | `array<string>`（可省略） | 除了 `slot` 外，該面板還需要引擎生成的額外插槽 id 清單，處理方式與 `slot` 相同。 | `['auth-protected-ip-placeholder']`（`protected` 面板） |
| `rootSelector` | `string`（可省略） | 面板渲染後根元素的 CSS selector。引擎用它做三件事：(a) 寫入 `zOrder` 對應的 `z-index`；(b) 編輯模式判斷要不要對它掛拖曳把手；(c) 讀寫使用者拖曳後存檔的 `left`/`top`。沒有 `rootSelector` 的面板（如 `protected`）不受編輯模式與 zOrder 機制管轄，幾何完全交給 `sharedGeometryCss` 或伺服器 markup。 | `'.optitlepanel'` |
| `geometryCss` | `string`（可省略） | 該面板專屬的幾何/外觀 CSS 逐字字串，由引擎注入到 `<style id="canvas-geometry">`。**內容嚴禁出現 `z-index`**（z-index 一律由 `zOrder` 欄位供給，見第 4.6 節）。 | `'.optitlepanel { padding: 10px; width: 400px; height: 120px; box-sizing: border-box; position: absolute; top: 0px; left: 0px; }'` |
| `zOrder` | `number`（可省略） | 面板在 `--layer-panel` 帶內的相對排序；引擎寫入 `z-index: calc(var(--layer-panel) + zOrder)`。只有同時具備 `rootSelector` 才會生效。數值只是「同帶內誰蓋誰」，換帶要換 `--layer-*`，不要把 `zOrder` 當全域魔術數字亂加大。 | `4`（`dt` 面板，即 `z-index: calc(var(--layer-panel) + 4)`） |
| `behaviors` | `array<string>`（可省略，預設等同 `[]`） | 面板行為清單。目前唯一定義值是 `'draggable'`：編輯模式進入時，引擎對其 `rootSelector` 元素掛 `makeDraggable` 把手；退出時卸除。 | `['draggable']` |
| `alwaysDraggable` | `boolean`（可省略，預設 `false`） | `true` 時面板不受編輯模式管制：引擎的 `panelRoots()` 會排除它，編輯模式進出時**不會**對它掛/卸把手，因為它的拖曳能力已經由面板模組自己呼叫 `makeDraggable` 提供、且應隨時可拖。目前唯一使用者是話術面板。 | `true`（`canned`） |
| `syncInit` | `boolean`（可省略，預設 `false`） | `true` 時該面板的 `init` 會在其餘面板以 `Promise.allSettled` 並行初始化**之前**、同步先行執行（原 `firework-mediator.js:99` 既有時序）。目前唯一使用者是 `meeting-shell`，因為 `meeting-now`/`meeting-match`/`meeting-all` 的邏輯依賴它先建好容器 DOM。此欄位只影響 **init** 的先後，不影響 clear 的順序（clear 順序由 manifest 陣列順序決定，見第 2.3 節）。 | `true`（`meeting-shell`） |
| `quirks` | `array<string>`（可省略） | 自由文字標記，記錄該面板偏離「標準模式」的既知例外，供人類/AI 閱讀理解；**引擎本身不消費此欄位**（純文件用途）。已知值：`'server-markup'`（幾何由伺服器渲染的 class 提供，不在 `geometryCss`，見 `sharedGeometryCss` 內的「伺服器注入 markup 的幾何」區塊）、`'body-mounted'`（面板元素由模組自行 `appendChild` 到 `document.body`，不經過引擎的 slot 機制）、`'self-persisted'`（面板自己用 `draggable.js` 的 per-panel localStorage key 管理位置，不是統一 layout 存檔——僅話術面板如此，且已在 `loadCanvas` 內做過一次性遷移，見第 5 節）。 | `['server-markup']`（`protected`）；`['body-mounted', 'self-persisted']`（`canned`） |

驗證完整性可跑：
```bash
node --input-type=module -e "import('./script/canvases/cs.js').then(m=>console.log([...new Set(m.default.panels.flatMap(p=>Object.keys(p)))].join(',')))"
```
目前輸出：`id,module,init,clear,slot,label,initArgs,clearArgs,syncInit,rootSelector,geometryCss,zOrder,behaviors,extraSlots,quirks,alwaysDraggable`——與上表 16 欄一一對應。

### 2.3 順序契約（一般化規則）

`clearAllModules()` 是**依 `manifest.panels` 陣列順序、同步 for 迴圈**依序呼叫每個面板的 `clear`
（沒有 `Promise.allSettled` 並行，因為 clear 之間可能有 DOM 依賴）。

> **一般化規則**：若面板 A 的 `clear` 會清空／破壞一群其他面板 B₁…Bₙ 賴以掛載事件監聽器的共用容器 DOM
> （例如對容器呼叫 `container.innerHTML = ''`），則 manifest 陣列中 **A 必須排在 B₁…Bₙ 之後**，
> 讓 B₁…Bₙ 先在容器還完整時卸除自己的監聽器，A 最後再清空容器本體。
> 這條規則**只約束 clear 的相對順序**；init 的先後與陣列順序無關，改由 `syncInit` 旗標決定（見第 2.2 節）。

`cs.js` 的具體案例（`meeting-shell` 的 `clearMeetingSearchPanel` 會對 `meeting-search-panel-placeholder`
容器做 `container.innerHTML = ''`）：

```js
// 順序契約：meeting-shell 的 clear 會清空容器，必須排在 meeting-now/meeting-match/meeting-all
// 之後（三者需先拆容器內監聽器）；init 不受影響（syncInit 獨立先行）
```

新增面板時若你的 `clear` 會清空一個其他面板也掛載內容的共用容器，套用同一條規則決定插入位置。

### 2.4 驗證指令

```bash
node --check script/canvases/cs.js   # 語法檢查（改到哪個 manifest 檔就檢查哪個）
node --check script/<your-module>.js # 新面板模組語法檢查
python3 -m http.server 8123 &        # 本機起 server（repo 根目錄）
node tools/layout-parity.mjs capture /tmp/after.json
node tools/layout-parity.mjs compare tools/parity-baseline.json /tmp/after.json
```
預期：既有面板的 `PARITY OK`（新面板尚未列入 `tools/parity-selectors.json`，不影響既有比對）。
若這是一個要長期存在的新面板，把它的 `rootSelector`（與需要追蹤疊序的話）加進
`tools/parity-selectors.json` 的 `rects`／`zorder` 陣列後，重新 capture 覆蓋
`tools/parity-baseline.json`，讓它從此納入回歸保護。

**已知限制（zorder 驗收盲區）——第四期後實質解除**：`tools/layout-parity.mjs` 的 `capture()` 對 z 值
用 stable sort 排序，「相同 z 值」元素之間的順序只會照抄 `parity-selectors.json` 的陣列原序，不是實際
DOM 疊序——這在二、三期（多面板共享同一 `zOrder`，見第 4.2 節 tie）是真實盲區。**第四期起** resting
疊序由 stack-manager 給每個 surface **distinct** 的連續名次（`--stack-rank` 0..N-1，無 tie），harness
量到的 z 全部相異、排序即真實疊序，盲區不再發生於面板。仍要注意：capture 是在「乾淨 stack 存檔」
（stub 環境無 `cspanel.stack.*`）下量測初始序；若你在有殘留存檔的環境手動 capture，量到的是該存檔的
疊序而非 manifest 初始序。

---

## 3. 新增畫布 SOP

新增一個部門畫布 = **一份新 manifest**＋**一個薄殼 html 頁**（複製 `panel_all.html`，只改兩行 import）。
引擎、視覺語彙、編輯模式全部共用，不需要複製或修改 `script/canvas-engine.js`。

### 3.1 步驟

1. 建立 `script/canvases/<dept>.js`，`export default { id: '<dept>', name: '...', visibility: 'all', sharedGeometryCss: '...', panels: [...] }`。`id` 必須是全站唯一（它是 localStorage 佈局 key 的一部分，見第 5 節）。
2. 複製 `panel_all.html` → `<dept>.html`（或依專案慣例命名），只改下面兩行：
   ```html
   <script type="module">
       import { loadCanvas } from './script/canvas-engine.js';
       import <dept> from './script/canvases/<dept>.js';
       loadCanvas(<dept>);
   </script>
   ```
   其餘 `<head>` 內的共用樣式表（`tokens.css`／`base.css`／`panels.css`／`controls.css`／`overlays.css`／`canvas-edit.css`）與 `fireworkeffect.js`／`ui-conductor-v2.js` 一律保留不動，確保視覺語彙與登入/編輯模式一致；該部門專屬的 `style/v2/features/*.css` 才依需要增減 `<link>`。
3. 上線前跑 parity harness，**為這個新畫布建立自己的 baseline**（不要覆蓋 `tools/parity-baseline.json`，那是 `cs` 畫布專用）：
   ```bash
   python3 -m http.server 8123 &
   PARITY_URL=http://localhost:8123/<dept>.html node tools/layout-parity.mjs capture /tmp/<dept>-baseline.json
   ```
   `PARITY_URL` 環境變數（`tools/layout-parity.mjs:9`：`process.env.PARITY_URL || 'http://localhost:8123/panel_all.html'`）決定 harness 打開哪個頁面，未設定時預設打 `panel_all.html`（也就是 `cs` 畫布），新增畫布**一定要帶這個環境變數**指到新頁面，否則會量測到錯的畫布。
4. `tools/parity-selectors.json` 目前是寫死給 `cs` 畫布用的選擇器清單（`rects`/`zorder` 兩個陣列，比對用）。若新畫布的面板 class 名稱與 `cs` 完全不同，harness 目前**不支援多畫布參數化**（`SELECTORS` 是從相鄰的 `parity-selectors.json` 讀死路徑，見 `tools/layout-parity.mjs:8`），需要：
   - 暫時把 `tools/parity-selectors.json` 的 `rects`/`zorder` 改成新畫布的選擇器，跑完 capture 後把輸出另存為 `/tmp/<dept>-baseline.json`（或專案內約定的 baseline 路徑），再把 `parity-selectors.json` 改回 `cs` 版本，避免誤蓋 `cs` 的 baseline；
   - 或者將 harness 擴充成可傳入選擇器檔案路徑的參數化版本（屬已知待辦，若要長期維護多畫布建議做這步，本次不強制）。
5. 之後每次改動該畫布，比照第 2.4 節指令、把 `PARITY_URL` 換成該畫布的頁面即可回歸驗證。

---

## 4. 鐵律

### 4.1 座標鐵律

**座標（位置/尺寸）只准出現在 manifest**（`geometryCss`/`sharedGeometryCss`，或伺服器 markup 本就固定的既知例外）。
新增/修改面板時不要在共用 CSS 檔（`panels.css` 等）裡加新的 `left`/`top`/`width`/`height`——那些屬於「舊時代逐字搬運」的既有遺產，新面板一律走 manifest。

### 4.2 z-index 鐵律 + 層帶表

**z-index 只准引用 `--layer-*`**（或透過 manifest 的 `zOrder` 由引擎 `calc()` 組出）。
六個層帶（`style/v2/tokens.css`）：

| 變數 | 值 | 用途 |
|---|---|---|
| `--layer-panel` | `100` | 面板本體（manifest `zOrder` 的基準） |
| `--layer-panel-active` | `200` | 互動中浮起（拖曳中、`focus-within` 提升） |
| `--layer-dropdown` | `300` | 下拉/建議選單/tooltip portal |
| `--layer-bar` | `400` | 登入列等常駐 chrome、編輯模式浮動列 |
| `--layer-modal` | `500` | modal 與 scrim |
| `--layer-toast` | `600` | toast |

**（第四期）帶內排序改為「統一動態疊序」**：面板與 tab 視窗的 resting z-index 不再由 `emitGeometry()`
以 `calc(var(--layer-panel) + zOrder)` 靜態寫入，改由 **`script/stack-manager.js`** 動態管理——
點擊任一 surface（有 `rootSelector` 的面板，或 tab 視窗）即提到最上層，名次正規化為 0..N-1 並持久化
（見第 5 節 `cspanel.stack.<id>.v1`）。z-index 仍只引用 `--layer-panel`：由 `style/v2/stack.css` 的
`.gl-stack-surface { z-index: calc(var(--layer-panel) + var(--stack-rank)*2) }`（tab 視窗的作用中 pane
用 `.gl-stack-pane`，`+ ...*2 + 1`）供給，`--stack-rank` 為管理器寫入的整數名次。**`emitGeometry()` 不再
注入任何 `${rootSelector} { z-index }`**（若注入，其 canvas-geometry `<style>` 排在 stack.css 之後、特異度
相同，會靜默遮蔽 `.gl-stack-surface` 使動態疊序失效）。**`manifest.zOrder` 降級為「初始名次來源」**：
`registerPanelStack()` 依 `(zOrder 升冪、同值依 panels[] 陣列序)` 換算成連續 `initialRank`，讓**初始**疊序
等同舊 zOrder 相對高低與下方 tie 規則；之後由互動決定、存檔還原。

**tie 疊序（相同 `zOrder`）——僅適用初始**：兩個以上面板 `zOrder` 數值相同時，算出來的 z-index 也相同，實際畫面上
誰蓋誰不是由引擎決定，而是瀏覽器對「z-index 相同」元素的預設規則——DOM 後出現者蓋過先出現者。面板
根元素的 DOM 生成序，對有 `slot` 的面板來說等於 `buildSlots()` 依 `manifest.panels[]` 陣列順序建立插槽
div 的順序（見第 2.1 節、`buildSlots()` 實作）；因此 **tie 疊序 = manifest `panels[]` 陣列順序（陣列中
排在後面的蓋過排在前面的）**。`cs.js` 目前實際存在的兩組 tie：`meeting-shell`／`optitle`／
`fudausearch`／`shrturl`（皆 `zOrder: 0`）、`consultant`／`tooldl`（皆 `zOrder: 3`）。要調整某個 tie 面板
蓋過另一個，須調整它們在 `panels[]` 陣列中的相對位置，只改 `zOrder` 數值本身（不打破 tie）不會改變疊序。

### 4.3 白名單特例表（不受第 4.2 節管轄，逐項列出檔案與值）

| 值 | 檔案:行 | 說明 |
|---|---|---|
| `2147483647` | `script/draggable.js:142` | 拖曳中的全螢幕事件盾（`dragOverlay`）。語義上必須高於任何東西，不歸帶。 |
| `9998` | `script/ui-conductor-v2.js:33` | 登入後立即插入的防閃爍預遮罩（`immediateOverlayCheck`），先於主轉場遮罩出現。 |
| `9999` | `script/ui-conductor-v2.js:66` | 轉場主遮罩 `#ui-transition-overlay`。 |
| `0` / `10` | `script/ui-conductor-v2.js:87,93` | `.ui-overlay-decoration`／`.ui-loader-container`，只在轉場遮罩內部相對排序，非全域競爭。 |
<!-- snowfall.js(9999) / rippleEffect.js(-1) 兩列已隨檔案於第五期倉庫清理刪除（孤兒特效檔，見 §9 清理記錄） -->
| `801` / `800` | `style/v2/panels.css:228,245` | `nav a` / `nav .animation`（`vvgglesht` iframe modal 內部的 tab 動畫底），僅相對彼此排序，與全域層帶無關。 |
| `999` | `style/v2/panels.css:587` | `.fudausearch-suggestions`。沿襲舊值的局部堆疊，與相鄰面板的全域比較無關（其父層 `.fudausearch-container` 已用 `--layer-panel-active` 在 hover/focus-within 時整體提升）。 |
| `2` | `style/v2/panels.css:40` | `.update-header`，相對其自身覆蓋範圍的局部值，非全域競爭。 |
| `2` | `style/v2/panels.css:549` | `vvgglesht` modal 內關閉鈕相對 iframe 的局部值。 |
<!-- capsuleinput.js(2) 一列已隨檔案於第五期倉庫清理刪除（孤兒模組，見 §9 清理記錄） -->
| `900` | `style/v2/features/DT_CSS.css:15` | `.DTV_iframe`（DT_report 頁內部 iframe 遮擋修正），非畫布面板局部值。 |
| `897` / `896` | `style/v2/features/all-meeting.css:13,60` | 會議搜尋框／結果清單的局部堆疊。 |
| `1004` | `script/dragb_msg_pnl.js:76` | `.canned-panel-clear-btn` 相對 `.canned-panel` 內部子元素的局部值（`.canned-panel` 本身的全域 z-index 一律由 `zOrder:15` 供給，即 `calc(var(--layer-panel) + 15)`；模組注入的 `PANEL_CSS` 不再帶 `.canned-panel` 的 `z-index` 宣告——原本兩處同時宣告、數值恰好都是 15 的雙重權威已於審查中移除，`zOrder` 自此為唯一來源，同 `.DT_panel` 的處理方式。此 `1004` 值只在該面板內部的 stacking context 生效，不影響跨面板比較）。 |
| `1000` | `script/toggle-panels.js:159` | `#generateReportButton` 表單提交鈕的局部堆疊值。 |

### 4.4 表面階層 → 配方對應表

| 階層 | 配方 | 依據 |
|---|---|---|
| **panel** | `background: var(--glass-bg)` + `backdrop-filter: blur(20px) saturate(1.6)` | `style/v2/panels.css` 統一面板規則；`--glass-blur: 20px`（`tokens.css`） |
| **dropdown** | `background: var(--elevated)` + `backdrop-filter: blur(20px) saturate(1.6)` | 如 `.fudausearch-suggestions`、IP tooltip（`style/v2/features/ipsearch_css.css`） |
| **modal** | `background: var(--glass-bg-hover)`（`rgba(255,255,255,0.90)`）+ `backdrop-filter: blur(40px) saturate(1.8)` + scrim（modal 外層 `rgba(15,18,20,0.45)` + `blur(6px)`） | `#modal-content`（`style/v2/panels.css:316-320` 等三處同構）；`--glass-bg-hover`（`tokens.css`） |
| **toast** | `background: var(--elevated)` + 8px 圓點色點（`::before`，依 `success`/`error`/`warning`/`info` 對應 `--success`/`--danger`/`--warning`/`--accent`） | `script/fireworkeffect.js` 的 `.firework-toast` |

### 4.5 幾何規則：draggable 面板必須 `position: absolute`

`behaviors: ['draggable']` 或 `alwaysDraggable: true` 的面板，其 `rootSelector` 對應元素**必須**在
`geometryCss`（或面板模組自行注入的 CSS）中宣告 `position: absolute`。

原因：編輯模式呼叫 `makeDraggable(el, handle, { persist: false, ... })`（`script/canvas-engine.js`
`enterEditMode()`）；`draggable.js` 在 `persist === false` 時會**提早 return、跳過自動設定
`position/left/top` 的初始化區塊**（`script/draggable.js:372`）。若面板本身沒有 `position: absolute`，
把手仍會顯示，但拖曳時 `left`/`top` 在 static/relative 定位語境下不會產生預期的視覺位移。

（歷史）`.ClassLogpanel` 曾用 `position: fixed`（唯一 fixed 例外）不受此規則約束。第三期連同 `.idsearchpanel`
一起被判定為**死樣式**（實測伺服器不再注入該 markup，真實伺服器 markup 只有 `.panel-tabs-container` 與
`.IPsearch_in_panelALL` 兩根，見第 7、8 節）而自 `sharedGeometryCss` 移除，目前畫布已無 `position: fixed` 的面板。

### 4.6 `geometryCss`／`sharedGeometryCss` 的 z-index 規則

- **每面板的 `geometryCss` 嚴禁出現 `z-index`**——面板疊序一律用 `zOrder` 欄位表達，由引擎組出
  `calc(var(--layer-panel) + zOrder)` 字串注入。
- **`sharedGeometryCss` 允許帶內 calc z-index，但僅限「無 `rootSelector` 的伺服器注入面板與共用狀態類」**：
  第四期後目前僅剩 `.panel-tabs-container`（伺服器注入，其幾何是分頁視窗管理器初始視窗位置的來源，
  見第 7 節）一處（`cs.js`）。**第四期變更**：`.small-size` 的 `z-index: calc(var(--layer-panel) + 10)`
  已移除——它會蓋掉 stack-manager 的 `--stack-rank`，使「最小化的面板點擊也無法置頂」（動態疊序失效）；
  移除後最小化面板與其他面板一樣走統一疊序、可點擊置頂。它們沒有對應的 `panels[]` 條目可承載 `zOrder`，
  寫在 `sharedGeometryCss` 裡的 `calc(var(--layer-panel) + n)` 是它們進入層帶的唯一途徑。**第三期變更**：
  `.idsearchpanel`／`.ClassLogpanel` 為死樣式已整組移除；
  `.IPsearch_in_panelALL` 的 z-index 已遷至 `protected` 面板的 `zOrder: 5`——`protected` 現在帶
  `rootSelector: '.IPsearch_in_panelALL'`（讓 IPsearch 在編輯模式可拖、佈局存於 `layout['protected']`），
  依本規則不得再於 `sharedGeometryCss` 為它宣告 z-index。
- **`sharedGeometryCss` 不得對「有 `rootSelector` 的面板」宣告 `z-index`**：這種宣告若以較高特異度
  selector 寫成（例如 `.DT_panel:not(.small-size)`，特異度 0-2-0），會永久遮蔽引擎依 `zOrder` 注入的
  `.DT_panel { z-index: ... }`（0-1-0）——之後改 manifest 的 `zOrder` 會靜默無效。前例：`cs.js` 的
  `.DT_panel:not(.small-size)` 曾夾帶 `z-index: calc(var(--layer-panel) + 4)`，與 `dt` 面板 `zOrder: 4`
  的注入值恰好相同因此未被察覺，後於審查中移除（本節規則的直接動機），`zOrder` 自此為真正權威。
- 已知取捨：現有 `geometryCss` 為了逐字保留遷移前的 CSS 語意，會夾帶少數非幾何屬性（例如 `color`、
  `overflow`、`transition`），這是「先搬運、後增能」兩階段策略下的刻意妥協；新增面板不必比照此
  包山包海的作法，但也不強制拆分，只要遵守上列 z-index 規則即符合鐵律。

### 4.7 表面以下的詞彙：膠囊輸入與捲軸（第六期鐵律）

**膠囊輸入（`style/v2/capsule.css`）**：任何「意圖放在 input 內」的動作元素（clear 鈕、輸入中
spinner…）**不得自造定位**，一律組合詞彙——wrapper 加 `.gl-capsule`（唯一定位權威）、尾端動作加
`.gl-capsule__end`（第二槽 `__end-2`）、spinner 外觀加 `.gl-capsule__spinner`（in-flow，勿與槽同
元素合用——rotate 會蓋掉置中 translate）。機制唯一、參數走 token：`--capsule-inset`／
`--capsule-slot-w`／`--capsule-fg(-hover)`（tokens.css 供權威值；capsule.css 自帶 fallback，可被
不載 tokens 的頁面獨立引用）。實例可**局部覆寫 token 值**（如 canned 的 `--capsule-inset: 42px`，
因 input 僅佔 90% 寬）——調參不算破例，換機制才是。已遷移實例：fudausearch（panel_all 模板／
轉單頁／fu_s_popup 三處）、canned（clear + spinner）。`.ip-search-spinner`（Firestore markup，
class 不可改）與 `.gl-capsule__spinner` **完全同配方同尺寸**（第七期起皆為 `var(--icon-md)` 20px、
2px 邊框、`--border-2`/`--accent` 雙色、1s linear 旋轉、reduced-motion 同步降速 2.5s）。
改配方時兩處同步——尺寸要變就改 `--icon-md`，全站 spinner 一起變（§4.8）。

**捲軸（`style/v2/scrollbar.css`）**：全站單一權威，**只用標準屬性**（`scrollbar-width: thin` +
`scrollbar-color` token）——Chrome 121+ 設了標準屬性即忽略 `::-webkit-scrollbar`，故**禁止再寫任何
webkit 捲軸私有語法**（本期已拆除全站六處，含 cspanel_netlify 兩頁）。Safari 回退系統原生。
cspanel 全部頁面已掛 link；cspanel_netlify 頁面以完整網址熱連本檔（跨 repo 單一輪子，部署順序
cspanel 先於 netlify）。

**白名單（非 input 內嵌，不受本節管轄）**：`.clearIcon`（optitle 面板角落垃圾桶）、
`.ui-spinner`（轉場遮罩）、`.meeting-loading-spinner`（區塊級 loading）、
`.fudausearch-fixed-button`（區塊按鈕）。捲軸唯一例外：`.meetingsearch-info` 的
`scrollbar-width: none`（meeting-now-css.css，刻意隱藏捲軸，需高於全域 `*` 的特異度）——
除「隱藏」外不得有其他局部捲軸宣告。

- **把手（第八期）**：全站「可拖帶子」視覺唯一來源 `style/v2/draggable-chrome.css`
  （`.draggable-handle` 常態/hover、`.draggable-dragging` 拖曳態）。新可拖面板不得自寫
  把手視覺——掛 class 即得（`makeDraggable` 會自動掛）。詞彙**不設字重/常態字色/對齊**
  （會繼承進 wm 藥丸 tab），字樣式歸各消費者。token 皆帶 fallback，未載 tokens.css
  的獨立頁亦可用。draggable.js 以 `<link data-draggable-chrome>` 冪等注入本檔；
  panel_all.html 另有靜態 link（同 data 屬性）先行。高度 token `--handle-h`。
  編輯模式把手 `.gl-edit-handle` 為刻意例外（特異度較高的專屬樣式，漸層配方與
  詞彙拖曳態同源），不受本詞彙管轄。

### 4.8 尺寸鐵律：階梯 + 元件映射（第七期）

尺寸單一權威在 `style/v2/tokens.css`，分兩層：

- **階梯（原始值層）**：字級 `--text-3xs…4xl`（9/10/11/12/13/14/15/16/18/20/24px）、圖示
  `--icon-sm/md/lg`（16/**20**/24px，20px 為全站 spinner/圖示標準）、間距 `--space-1…10`
  （2/4/6/8/10/12/14/16/20/24px）。
- **元件映射（未來唯一要改的那一處）**：`--control-font`／`--control-line`／`--control-pad-y/x`／
  `--control-radius`（button 基底）、`--input-pad-y/x`／`--input-radius`／`--input-pad-compact-y/x`
  （輸入框基底）。調整映射即全站表單/輸入/按鈕一起變；controls.css 的全域 recipe 只准引用映射。

**鐵律**：新 CSS 的字級、圖示/spinner 尺寸、間距、控制件內距/圓角**不得裸寫 px**，一律引用階梯或
元件映射；值不在階梯內是「先擴階梯再用」而不是裸寫的理由。**不受管轄**：面板佈局幾何（manifest
的領域，§4.1）、border 寬度、box-shadow、`--capsule-slot-w` 等既有詞彙參數、白名單檔
（ui-conductor-v2.js）。**範圍**：v2 系統的字級/圖示/控制件基底已全量遷移（第七期，268 處等值代換 + 逐檔 diff 稽核）；
間距遷移主流階梯值，**長尾殘值刻意留原樣**（5px/3px 舊格網、定位偏移、含 `%`/`0` 的 shorthand、
`22px` 佈局契約值等——清單見第七期 commit 訊息），它們屬 legacy 排版細節、非控制元素尺寸，
migrate-on-touch。legacy 三檔（body/button/font.css，DT_report 與 fu_s_popup 用）凍結不回填；
netlify 頁自有樣式不納入（僅共用捲軸）。

---

## 5. 佈局持久化格式與重設語義

- **key**：`` `cspanel.layout.${canvasId}.v1` ``（`script/canvas-engine.js` 的 `LAYOUT_KEY`），每個畫布各自一把
  localStorage key，例如 `cs` 畫布是 `cspanel.layout.cs.v1`。
- **格式**：`{ [panelId]: { x: number, y: number } }`——只存每個面板 id 對應的 `x`/`y`，沒有其他欄位。
- **讀取**（`readLayout(canvasId)`）：`JSON.parse` 失敗、或解出來不是物件時，一律回傳 `{}`（靜默容錯，不拋錯）。
- **套用時機**：`loadCanvas()` 呼叫 `emitGeometry(manifest, layout)` 時，若某 `panelId` 有存檔、
  該面板有 `rootSelector`、且 `x`/`y` 都是 `Number.isFinite`，就在其後追加
  `` `${rootSelector} { left: ${x}px; top: ${y}px; }` ``，覆寫在 `geometryCss` 之後——即「**存檔 > manifest 預設**」。
  存檔壞損（JSON 壞、未知 panelId、座標非數字）：該筆被略過，退回 manifest 預設，不影響其他筆。
- **寫入**：拖曳結束（`makeDraggable` 的 `onPositionChange` 回呼）呼叫 `saveLayoutEntry(canvasId, panelId, pos)`，
  讀出整個既有物件、覆蓋該 `panelId` 一筆、`JSON.stringify` 整個寫回（非局部 patch，`localStorage.setItem`
  失敗時 `try/catch` 吞掉，不阻斷互動）。
- **重設**（`resetLayout()`）：`localStorage.removeItem(LAYOUT_KEY(canvasId))` 刪掉整把存檔 →
  同時 `localStorage.removeItem` 話術面板（canned）的舊版 per-panel key
  `` `draggable:${location.pathname}:canned-panel-main` ``（見下方「舊格式一次性遷移」段落），
  讓「重設」對 canned 也真正生效，不再留下舊 key 讓下次遷移邏輯復活過期座標 → 逐一清空
  每個可拖曳面板的 inline `left`/`top` → （`prefers-reduced-motion: reduce` 時跳過）套用
  `transition: left 0.4s cubic-bezier(0.22,1,0.36,1), top 0.4s cubic-bezier(0.22,1,0.36,1)` 動畫回彈 →
  `emitGeometry(manifest, {})` 以空 layout 重新套用純 manifest 預設值。**已知行為**：`canned` 面板
  本身不在 `panelRoots()` 清單內（`alwaysDraggable: true` 被排除），`resetLayout()` 不會動它目前的
  inline `left`/`top`（那由 `draggable.js` 自己在面板存續期間主導），所以刪 key 這一步在畫面上**不會
  立即**移動 canned；要等下次 `loadCanvas()`（頁面重新載入）才會依清空後的狀態套用預設座標。
- **話術面板（canned）舊格式一次性遷移**：`canned` 面板原本用 `draggable.js` 自己的 per-panel key
  `` `draggable:${location.pathname}:canned-panel-main` ``（`quirks: ['self-persisted']`）。`loadCanvas()`
  第一次執行時，若該畫布的統一 layout 尚無 `canned` 這筆記錄，就讀取舊 key、`saveLayoutEntry` 轉存成新格式
  ——**不刪除舊 key**（保留一版回退）。轉存後，`loadCanvas` 會用讀出的統一 layout 覆寫 `canned` 面板的
  `initArgs` 為 `[null, { left: x, top: y }]`，之後 `canned` 的位置初始化就走這條路徑，不再依賴模組自己
  重讀舊 key。
- **分頁視窗佈局（另一把 key，第三期新增）**：分頁視窗管理器（見第 7 節）用**獨立**的
  `` `cspanel.windows.${canvasId}.v1` `` 存視窗佈局，**不走本節的 layout 機制**（那是面板拖曳位移）。
  `resetLayout()` 除了清本節的 `LAYOUT_KEY`，還會額外委派 `window.WindowManager.reset()`（若已掛載）一併
  把視窗清回預設單視窗，故編輯模式的「重設佈局」對「面板位移」與「分頁視窗」兩套系統同時生效。
  （第四期：`cspanel.windows.*` 不再存 `z`——疊序改由下方 stack key 統一管理。）
- **統一疊序（第三把 key，第四期新增）**：`script/stack-manager.js` 用 `` `cspanel.stack.${canvasId}.v1` ``
  存**所有 surface（面板 + tab 視窗）的相對疊序**，格式 `{ order: [key, ...] }`（由下往上；面板 key = 面板
  `id`，視窗 key = window id）。點擊置頂 = 把該 key 移到 `order` 尾端、名次正規化 0..N-1、整寫回。
  **還原**：頁面載入時對存檔取一次快照（`savedSnapshot`），每個 surface `register` 時依快照相對位置插入；
  不在快照者依 `initialRank`（面板 = zOrder 換算的連續名次；視窗 = 100+i，預設在面板之上）。壞損（JSON 壞、
  非陣列）→ 靜默回 initialRank 序。**重設**：`resetLayout()` 亦委派 `stack.reset()`，故「重設佈局」對
  **面板位移 + 分頁視窗 + 疊序**三套系統同時生效。

---

## 6. 已知刻意變更記錄（第二期：畫布引擎化）

以下五項是遷移過程中**經核可的刻意變更**，不是還原/搬運疏漏，未來比對舊行為時不要誤判為 regression：

1. **toast > modal 疊序修正**：舊碼 toast 魔術數字 `10000` 實際**低於**三個 modal 的 `999691`
   （`10000 < 999691`），是既存缺陷（toast 通知理論上該永遠可見，卻可能被 modal 蓋住）。歸帶後
   `--layer-toast(600)` **高於** `--layer-modal(500)`，是刻意修正而非逐字搬運。`tools/layout-parity.mjs`
   的 `zorder` 追蹤清單刻意不含 toast/modal（兩者都是暫態顯示元素，比對時機抓不準也無意義），不會誤報此差異。
2. **tooltip 相對登入列的相對順序改變**：IP 搜尋 tooltip portal 舊值 `10000` 高於登入列/轉場遮罩的
   `9999`。歸帶後改用 `--layer-dropdown(300)`，**低於** `--layer-bar(400)`。因為 tooltip（依附在 IP 搜尋
   結果列表）與登入列（畫面右下角常駐 chrome）在畫面上無幾何交集，此相對順序變化被判定可接受並記錄在案。
3. **死樣式移除清單**（Task 4，commit `fc72004`，因 DOM 內已不存在對應元素而刪除）：`.temp2`、`.board`
   （含其幾何區塊，原 `style/v2/panels.css` 314-324 行）、`.appicon { ... }` 區塊、`#excalidraw-container`
   與整段 Excalidraw 相關規則（原 404-439 行）。注意：`.appicon img { cursor: pointer; margin: 5px; }`
   **未被移除**，仍存活於 `style/v2/panels.css`（實務上無效——panel_all 頁面不存在 `.appicon` 元素，
   `script/imgcp2bx.js` 仍查詢 `.appicon` 但查無結果），屬沿襲殘留而非已刪項目。
4. **`syncInit` 呼叫加上 `try/catch`**：原始 `firework-mediator.js` 對同步先行面板（`meeting-shell`）的
   `init` 呼叫（`initMeetingSearchPanel('meeting-search-panel-placeholder')`）沒有任何錯誤防護。
   `canvas-engine.js` 泛化時主動替所有 `syncInit` 面板的 `init` 呼叫加上 `try { ... } catch (e) { console.error(...) }`
   （見 `initAllModules()`），避免同步先行面板拋錯就中斷後續（包含它之後的 `Promise.allSettled` 並行初始化）。
   這是比「邏輯原樣搬入」更嚴謹的刻意加固，不是還原疏漏。
5. **`persist: false` 選項**：`draggable.js` 原設計沒有「呼叫端接管初始位置權威」的模式。編輯模式的把手
   若沿用 `draggable.js` 自身的 per-panel `` `draggable:${path}:${id}` `` 存檔機制，會與畫布引擎的統一
   layout 存檔互相打架（例如進入編輯模式瞬間跳位到 `(100,100)` 預設值）。Task 6 執行中發現此衝突後，
   新增 `persist: false` 選項（預設 `true`，向下相容零風險）：`false` 時 `draggable.js` 完全略過自己的
   初始位置讀寫，把位置權威交給呼叫端（畫布引擎的 `onPositionChange` + 統一 layout）。這是預先核可後
   補入的必要修正，屬刻意變更。

---

## 7. 分頁視窗管理器（第三期，子專案 B）

`protected` 面板的伺服器 `tabsHTML`（`.panel-tabs-container`，四個 tab：三 iframe + 一 DOM tools）不再用
radio/label CSS tab 呈現，改由**分頁視窗管理器**渲染成 Chrome 式可拖/可縮放的視窗系統。它是**獨立常駐系統，
不受編輯模式管轄**（隨時可操作，不需進「編排」模式）。

### 7.1 檔案與掛載

| 構件 | 檔案 | 職責 |
|---|---|---|
| 視窗管理器 | `script/window-manager.js` | `mountWindowManager(host, opts)`：常駐池、視窗模型/渲染/互動、`syncPanes`、持久化。回傳 `{ destroy, reset, syncPanes }` 並掛 `window.WindowManager`。 |
| 視窗樣式 | `style/v2/window-manager.css` | 視窗玻璃 chrome、tab 列、縮放把手、pane 池。**不寫視窗/pane 的 z-index**（由 JS 注入）。 |
| 交棒點 | `script/auth-protected-tabs.js` | `fetchProtectedContentWithRetry` 注入 `tabsHTML` 且 `glDecorate` 後 `await import('./window-manager.js')` 掛載；`clearProtectedTabs`（登出）先 `windowManager.destroy()` 再清 DOM。 |
| 頁面 | `panel_all.html` | `<head>` 於 `canvas-edit.css` 後加 `window-manager.css`（**無 DOCTYPE 不變**）。 |

掛載失敗（import 失敗等）會 `console.error` 並**保留伺服器原生 radio/label tab**，屬優雅降級。

### 7.2 常駐池與「不重載」契約

掛載時把四個 tab 內容（三 iframe 元素 + tools 的 `.appicon` DOM）**一次性**搬進常駐池 `.wm-pool`，之後
**永不在 DOM 搬移**——re-parent iframe = 重載；這唯一一次移動發生在剛登入 iframe 本就在載入，等於免費。
搬完即 `remove()` 伺服器的 `.panel-tabs-container` chrome。之後：

- **切 tab / 撕離 / 合併 / 重排**：只改「pane 所屬視窗」關係與 `display`，pane 節點不動 → **iframe 不重載**。
- **非作用中 pane** 用 `display: none`（`display:none` 不重載 iframe，只有 DOM 重新 parent 才重載）。
- 回歸測試 `tools/wm-test.mjs` 對每個操作斷言 iframe `load` 事件計數不變（零重載）。

### 7.3 座標系與疊序（鐵律遵循）

- pane 與視窗皆 `position: absolute`，其 containing block = `.panel_all_container`（唯一定位祖先），
  與其他面板**同座標系**（scroll 不分離 pane 與視窗）。`syncPanes()` 以 `getBoundingClientRect` 量測
  每個視窗的 `.wm-content` 內容區，換算成相對 containing block 的 `left/top/width/height` 貼合作用中 pane。
- **z-index 只引用 `--layer-panel` 層帶**：視窗 = `calc(var(--layer-panel) + z*2)`、其作用中 pane =
  `calc(var(--layer-panel) + z*2 + 1)`（pane 疊在自己視窗之上才看得到 iframe 且可互動）。`z` 為 0..n-1 的
  視窗堆疊名次，點擊提升時 `raise()` 重新正規化為連續名次，**永不無限增長、恆在層帶內**（tab 數上限 4 →
  視窗上限 4 → 最高偏移 +7，遠在 `--layer-panel(100)`～`--layer-panel-active(200)` 帶內）。
- 拖曳/縮放時沿用 `draggable.js` 那個最高 z（`2147483647`）**透明 shield** 防 iframe 吃滑鼠事件；拖 tab
  的浮動 ghost 同屬此白名單值。

### 7.4 持久化 schema 與重設

- **key**：`` `cspanel.windows.${canvasId}.v1` ``（`cs` 畫布即 `cspanel.windows.cs.v1`）。
- **格式**：`{ windows: [{ id, tabs, active, x, y, w, h, z }] }`——`tabs` 為該視窗的 tab id 陣列、`active`
  為作用中 tab id、`x/y/w/h` 為幾何、`z` 為堆疊名次。撕出→新視窗、合併→移動 tab id、空視窗→移除。
- **讀取容錯**（`loadWindows`）：JSON 壞、未知 tab、缺 tab、重複 tab、`active` 非法、尺寸過小一律淨化
  （過濾未知 tab、跨視窗去重、把遺漏的已知 tab 補進第一個視窗、`active` 合法化、`z` 正規化、`w/h` 夾最小值），
  確保每個已知 tab 恰好出現一次、至少一個視窗；解不出時退回**預設單視窗**（四 tab、位置尺寸沿用
  `.panel-tabs-container` 的 `left:410,top:160,500×600`）。
- **重設**：`window.WindowManager.reset()` 刪 key 並重建預設單視窗。畫布引擎 `resetLayout()`
  （`CanvasEdit.reset`）會委派呼叫它，故「重設佈局」一併把視窗回預設（見第 5 節）。

### 7.5 生命週期與引擎關係

- 掛載：`glDecorate` 注入完成 → 搬內容進池 → 依存檔（或預設）建視窗 → `render()` + 啟動 `scroll`/`resize`
  同步監聽。
- 拆除：登出 `clearProtectedTabs` → `windowManager.destroy()`（中斷進行中拖曳、移除全域監聽、移除池/視窗層、
  清 `window.WindowManager`）→ 清空 placeholder。
- **併發防護（審查 #1）**：`initProtectedTabs` 帶 in-flight 旗標。access boot 的登入事件與
  canvas-engine 為晚註冊監聽器所做的同源狀態補位可能重疊呼叫 `initAllModules`；若不擋，兩條
  `fetchProtectedContentWithRetry` 各自
  `innerHTML→(await import)→mount/destroy` 交錯，第二輪的 `destroy` 會把第一輪剛搬入常駐池的 iframe 連池
  一起銷毀，最壞落到「分頁整組消失」的空白終態。旗標保證同一時刻只跑一輪 init（登出→再登入屬「循序」
  重入，旗標已歸零，不受影響）。回歸：`tools/wm-concurrent-test.mjs`。
- **`.panel-tabs-container` 不再是普通可拖面板**（它變成初始視窗的幾何來源後即被移除）——**不要**把它加進
  manifest 的 `rootSelector`/`behaviors`；其 `sharedGeometryCss` 幾何**保留**，作為初始視窗位置的來源。

### 7.6 視窗 chrome 與無障礙（第四期打磨）

- **標題帶＝把手詞彙消費者（第八期改）**：`.wm-tabbar` 掛 `.draggable-handle`，視覺
  （透明底、`--handle-h` 高、hover 微加深、拖曳中 accent 漸層）歸 `draggable-chrome.css`；
  自身只留 tab 列佈局（gap/overflow）。四期「`--bg-soft` 色帶＋分隔線」於第八期**刻意
  推翻**——同畫面雙視窗語彙（wm 色帶 vs draggable 透明帶）混淆 > 色帶辨識度，「一眼是
  視窗」改由玻璃框＋陰影＋hover 拖曳暗示承擔。視窗拖曳中同時掛
  `gl-dragging`＋`draggable-dragging`。
- **tab 為藥丸**（沿全站 pill 語彙）：作用中 = `--elevated` 底 + `--accent-hover` 字 + 邊框與微陰影；
  `:focus-visible` 用 `--accent-ring` 外框。
- **縮放把手**：18px、三道斜紋用 `--border-2`。注意勿改回 `--glass-border`——它是 50% 白，疊在白玻璃上
  等於隱形（第四期修正的缺陷）。
- **a11y**：tab 列 `role="tablist"`、每個 tab `role="tab"` + `aria-selected` + roving tabindex（作用中
  =0、其餘 -1）；方向鍵／Home／End 移動焦點、Enter／Space 切換。切換走 `render()`（重繪 chrome、
  pane 池不動 → iframe 不重載），重繪後焦點還原到同一顆 tab。

---

## 8. 第三期刻意變更記錄（編輯模式健壯化 + 分頁視窗管理器）

1. **fudausearch clear 改非破壞式 + bind 冪等**（`script/fusearch-panel.js`）：`clearFudausearchPanel` 不再
   `innerHTML=''`（會洗掉轉單頁自帶把手導致拖不動 + 再登入雙層嵌套），改只重置 results/suggestions/input
   內容與快取；`bindFudausearchEvents` 以具名 handler `removeEventListener→addEventListener` 冪等綁定。
   回歸 fixture：`tools/fudau-repro.html` + `tools/fudau-repro.mjs`（斷言 `containers===1 && dragHandles===1`）。
2. **會議 nav 讓位**（`style/v2/canvas-edit.css`）：`html.canvas-editing .meeting-search-panel-menu nav
   { margin-top: 22px }`，編輯把手佔頂 22px 時 nav 下滑避開，退出復原。選配的 `nav a`(801)/`.animation`(800)
   歸帶**未做**——屬 vvgglesht iframe modal 內部局部堆疊（第 4.3 節白名單，與全域層帶無關），改動有風險且
   無益於讓位目標，故維持白名單現狀。
3. **IPsearch 可拖 + z 遷移**：`protected` 面板加 `rootSelector: '.IPsearch_in_panelALL'` + `zOrder: 5` +
   `behaviors: ['draggable']`；z-index 自 `sharedGeometryCss` 遷至 `zOrder`（遵第 4.6 節），佈局存於
   `layout['protected']`。編輯把手文字顯示面板 id（`protected`）——沿用引擎既有把手機制的既知外觀，非缺陷。
4. **死樣式移除**：`sharedGeometryCss` 移除 `.idsearchpanel`／`.ClassLogpanel` 全部幾何（含 `:not(.small-size)`
   尺寸、共用 flex 群、獨立幾何塊與唯一的 `position: fixed` 例外）。實測伺服器不再注入該 markup，真實伺服器
   markup 只有 `.panel-tabs-container` 與 `.IPsearch_in_panelALL` 兩根。
5. **分頁視窗管理器**（第 7 節）：新增 `window-manager.js` / `window-manager.css`；`auth-protected-tabs.js`
   交棒 + 登出拆除；`canvas-engine.js` `resetLayout` 委派 `WindowManager.reset()`；`panel_all.html` 加
   `window-manager.css`。伺服器面板 parity harness 測不到，改用真實 markup fixture（`tools/wm-fixture.html`
   + `tools/wm-test.mjs`）+ 使用者真登入實測驗收。
6. **whole-branch 對抗式審查修正**（審查後回圈，7 項確認缺陷全數修復並補回歸）：
   (#1, high) `initProtectedTabs` 併發雙初始化會弄消失分頁 → 加 in-flight 守衛（第 7.5 節）+
   `tools/wm-concurrent-test.mjs`；(#2, med) 同視窗 tab 向右重排 off-by-one → 移除被拖 tab 後補償插入索引
   + wm-test 精確落點斷言；(#3, med) fudau-repro 未覆蓋重登入循環 → 擴充多輪 clear→init + input dispatch；
   (#4, low) `tabBarAt` 取陣列首個命中而非最上層 → 改取 z 最大；(#5, low) `readContainerRect` 的
   `|| fallback` 誤判合法 0 座標 → 改 `Number.isFinite`/正值判斷；(#6, low) 攔截器用新閉包
   `removeEventListener`（no-op）致累積 → 改卸「舊」`currentInterceptor` 參照；(#7, low) wm-test 持久化未驗
   幾何 → 加 x/y/w/h 跨 reload 還原斷言。

---

## 9. 第四期刻意變更記錄（統一動態疊序 + 把手標籤 + 編輯模式修正）

1. **統一動態疊序（`stack-manager.js`）**：面板與 tab 視窗的 resting z 從「靜態 `calc(--layer-panel+zOrder)`」
   改為「點擊置頂的動態名次 + 持久化」（見第 4.2、5、7 節）。z-index 改由 `.gl-stack-surface`/`.gl-stack-pane`
   （`style/v2/stack.css`）配 `--stack-rank` 供給，仍只引用 `--layer-panel` 帶。`emitGeometry()` 不再注入
   `${rootSelector} { z-index }`（否則遮蔽 stack.css，動態疊序失效）。`zOrder` 降級為初始名次來源。
2. **`.small-size` z-index 移除**：原 `calc(--layer-panel+10)` 會蓋掉 `--stack-rank`，使最小化面板點擊無法
   置頂；移除後最小化面板走統一疊序。
3. **parity baseline 重擷取**：ties 由「同 z（harness §2.4 盲區）」變「distinct z」＝真實 §4.2 陣列序疊序；
   `rects` 零變動，僅 `zorder` 反映真實疊序（`tools/parity-baseline.json`）。
4. **把手顯性標籤**：manifest panel 新增 `label` 欄位，編輯把手 `textContent = p.label || p.id`；11 面板
   標籤見 `cs.js`（標題生成 / 外部會議面板 / 職代查詢 / 短網址 / 測試報告生成 / 顧問清單 / 輔導班表 /
   檔次快捷 / 工具下載 / IP 查詢 / 代課回應生成器）。
5. **`#gl-edit-bar` 右偏修正**：改用專屬 keyframe `gl-edit-bar-rise`（每格保留 `translateX(-50%)`），不再借用
   會清掉置中位移的 `gl-modal-rise`。回歸 `tools/editbar-center-test.mjs`。
6. **draggable.js 點擊 +18px 修正**：`handleDragStart` 的 `elementX/Y` 無 inline left 時改用 `offsetLeft/
   offsetTop`（與 `style.left` 同座標系），不用 `getBoundingClientRect`（視窗座標）。既有使用者若佈局存檔
   已被舊 bug 污染，需手動 `localStorage.removeItem('cspanel.layout.cs.v1')` 或按「重設佈局」一次。回歸
   `tools/drag-noshift-test.mjs`（點擊零位移 + 真實拖曳正確）。
7. **回歸測試新增**：`tools/stack-test.mjs`（stack-manager）、`tools/panel-stack-test.mjs`（引擎整合：點擊
   置頂/持久化/中文標籤）、`tools/editbar-center-test.mjs`、`tools/drag-noshift-test.mjs`；`wm-test.mjs` 加
   跨類（面板↔視窗）疊序斷言。
8. **視窗 chrome 打磨**（見第 7.6 節）：標題列色帶、藥丸 tab、可見縮放把手（`--border-2` 取代隱形的
   `--glass-border`）、`role="tablist"` + roving tabindex + 鍵盤切換。使用者回饋「看起來不像視窗」的
   直接修正——症狀是視覺層（chrome 太含蓄），非 DOM 結構問題。
9. **材質層（第五期，已定案烘焙 2026-07-11）**：`style/v2/materiality.css` 供給畫布的物質性，
   鉤子為 stack-manager 維護的 `is-stack-top` 與 `gl-dragging`（面板與 tab 視窗同語彙）。
   使用者以調校面板（暫時態工具，已退役，git 歷史 `3c4e39d`/`fdc6ade` 可考）選定
   **materiality-spec v1**：高度可讀=清晰（置頂影 `0 18px 48px @.14`、其餘退 `0.93`）、
   聚焦=邊框微亮（`outline 1px rgba(255,255,255,.9)` inset）、拖曳浮起=微浮（`0 16px 44px @.16`，
   **刻意取代** draggable.js 的 `.draggable-dragging` 深影）、**運動=無**（不引入任何 transition）。
   排除條款不可移除：`.meeting-search-panel-menu`（透明無影容器）不吃影/框；`.gl-editable` 的
   虛線 outline 不被聚焦框覆蓋；`:hover`/`:focus-within` 的面板不退暗。
   歷史教訓（審查 12 項共同根因）：**「預設全關」須以「零規則命中」實作，不可用「預設值視覺
   等值」**——後者隱含「所有 surface 靜置影都是 `--glass-shadow`」的錯誤假設。
   回歸：`tools/materiality-test.mjs`。
10. **「新殼」另案撤案（2026-07-10 決策記錄）**：第二期設計 §9 曾預留「SaaS 式左選單新殼與工作區切換」
   另案。經四期演進（manifest 擴充路徑、編輯模式、統一動態疊序、分頁視窗管理器）後，使用者決議**撤案**：
   新增部門工作區的正式路徑就是第 3 節（新 manifest + 薄殼頁），不再維持「整體重寫的新殼」為待辦專案。
   **重啟條件**（屆時重新 brainstorm、勿沿用舊構想）：出現 manifest 模型裝不下的部門工作區需求，或
   「任意面板拖進分頁群組」成為日常用法。屆時可帶走的 primitive：iframe 常駐池（第 7.2 節）與 stack-manager
   （第 4.2、5 節）；新殼應為獨立 standards-mode 頁面，不受 panel_all 的 quirks 契約束縛。
11. **倉庫清理記錄（2026-07-11）**：刪除 9 個全域零引用的孤兒 script（`DTcheckfuction.js`／
    `assist_issue.js`／`buttonstylepack.js`／`capsuleinput.js`／`cursorspk.js`／`github.js`／
    `meeting-search-panel.js`（已被 `-module` 版取代）／`snowfall.js`／`rippleEffect.js`，皆自
    2025-12-23 未動、repo + board + 轉單頁 + cspanel_netlify 全查無引用；git 歷史可考）與被追蹤的
    `新增資料夾/.DS_Store`；§4.3 白名單同步移除三列。**刻意保留**：`img/` 全部（話術面板 innerHTML
    渲染 Sheet 內容，瀏覽器教學截圖可能活在話術或客服外發連結中，repo 內無法證死）；`tool_zip/*.zip`
    （tool-download-panel 以完整網址熱連）；`新增資料夾/` 目錄名（醜但是線上 URL 的一部分，改名即斷鏈）；
    12 個獨立頁（頁面存活）。**style/ 盤點（同日）**：刪除 8 個被 v2/features 取代的孤兒舊樣式
    （`DT_CSS`／`all-meeting`／`ipsearch_css`／`meeting-match-check`／`meeting-now-css`／`panel-all`／
    `report`／`shrturl`.css，精確路徑查證——注意舊檔名是 v2 路徑的子字串，basename grep 會假陽性）；
    保留 `body.css`／`button.css`／`font.css`（DT_report 與 fu_s_popup 仍引用）與 `favicon.ico`。
    style/ 自此僅剩「3 個活舊頁樣式 + v2 現行系統」。

---

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

---

## 11. 第十期刻意變更記錄（低階機流暢化：真毛玻璃保留）

設計文件：`docs/superpowers/specs/2026-07-19-lowend-performance-design.md`。
核心決策：**真毛玻璃一片不拔**——Chromium 損傷驅動渲染下，backdrop-filter 靜置
成本為零，卡頓元凶是「玻璃背後永不停止的變動源」；本期殺變動源，不動玻璃。
以下變更同時作用於 panel_all.html（v1）與 panel_all_v2.html（共用引擎），
惟 iframe 惰性掛載以 `window.CSPANEL_ENGINE_V2` 閘控、v1 逐位元不變。

1. **initAllModules 冪等＋觸發源收斂**：promise 單例（`initPromise`，失敗歸零可重試、
   登出歸零允許重 init）；不讀 local token hint。Firebase 恢復 identity 後必須先由
   `AccessClient.boot()` 取得當下 server grant，成功才發 `firework-login-success`。
   **漏接補位鐵律**：loadCanvas 要 await 十餘個模組動態 import 後才掛
   `firework-login-success` 監聽器，事件可能先發而漏接（舊搶快路徑恰好蓋住此窗口）
   ——fireworkeffect 於廣播「前」設置 runtime 旗標 `window.fireworkAuthReady`，
   loadCanvas 掛好監聽器後讀旗標補呼一次；旗標與事件同源，非第二判定來源。
   移除補位即回歸「重載後面板全空」，headless 全套會抓到（materiality-test 起步即卡）。
   附帶修正：session 恢復（重載）不再誤彈「登入成功」toast（`pendingLoginToast`
   旗標，僅使用者主動送出帳密才立）。`wmMountClaimed` 保留作第三道防線。
2. **受管排程器 `engineSchedule`**（canvas-engine.js export）：畫布模組週期工作的唯一合法管道
   ——自動登記、`document.hidden` 跳過 tick、恢復可見錯過即補跑、`alignTo: 'half-hour'`
   供整/半點對齊（timeout 受追蹤），登出時模組 clear 各自 cancel＋引擎
   `cancelAllScheduledTasks()` 兜底全清。兩處 UI 輪詢全數遷移：衝堂 15 分、
   會議自動刷新 30 分——背景分頁 API 流量歸零。授權心跳屬共享 `AccessClient`，不由畫布引擎管理。
   舊 meeting-now 的對齊 setTimeout
   未追蹤洩漏（登出後重建無人持有的 interval）由此結構性消滅。
3. **授權心跳集中化**：共享 `AccessClient` 每 60 秒以 `HEAD /api/session` 驗證 Firebase identity、
   帳號狀態、compiled grant 與 `X-Grant-Revision`。每一支 business request 也重做相同 server gate；
   任何 stale revision 或拒絕先同步派發 `cspanel:access-kill` 清空 UI，再依語意 reload 或 sign-out。
4. **動畫一律綁可見狀態**：ui-conductor 過場 overlay 的 6 組 infinite 動畫改綁
   `#ui-transition-overlay.active` 後代、退場 transitionend 後補 `display:none`
   （進場前 `showOverlay()` 解除並強制 reflow 保過渡）；`.ip-search-spinner` 動畫
   移入 `.is-visible`（class 名不動——Firestore 契約；visibility 佔位防 reflow 機制
   不變）。overlay 注入 CSS 補 `prefers-reduced-motion` 分支（原全庫唯一缺席處）。
   「隱藏仍空轉」自此結構上不可表達。
5. **玻璃衛生**：panels.css 統一面板規則移除 4 個死 selector（`.idsearchpanel`/
   `.ClassLogpanel`＝cs.js 載明伺服器不再注入；`.temp2`/`.board`＝repo 查無 markup
   來源，togglelayer.js/DT_fuction_confirm.js 殘留字串引用對不存在元素 no-op）。
   blur 值全面 token 化（值一字不改）：`--glass-blur-modal: 40px`／`--glass-blur-scrim:
   6px`／`--glass-blur-chrome: 28px`／`--glass-blur-bar: 8px` 入 tokens.css，10 個 CSS
   規則點＋4 個 JS 注入點（theme/fireworkeffect/dragb_msg_pnl 帶 fallback 形式
   `var(--glass-blur, 20px)`）全改引用；`--glass-bg-solid` 統一 @supports 回退底色。
   `.hover-overlay` 查明結論：工具分頁 app 圖示上的 70×70 磨砂標籤，面積小、
   pane 非作用中即 display:none 零成本——**保留**，僅 token 化。
6. **降級保險絲（預設不啟動）**：tokens.css 檔尾——`@media (prefers-reduced-transparency:
   reduce)`（跟隨 Windows「設定>個人化>色彩>透明效果」，Chromium 118+）與
   `html.perf-mode` 手動 class（本期只留鉤子、無 UI），命中時玻璃底退
   `--glass-bg-solid`＋universal `backdrop-filter: none !important`（蓋得到 JS 注入樣式）。
   支援查詢：「玻璃不見了」＝此開關命中，by design。
7. **iframe 首次可見才掛載**（僅 v2）：零重載鐵律語意不變（首載後永不動 src、
   永不 re-parent），改變的只有首載時機。三個注入點統一手法「detached 解析→摘
   src 存 data-src→首次可見回填」：`createTabsStaging(…, lazyIframes)`（netlify tabs，
   摘除必須在 filterDiaryTab 之後、接進 live DOM 之前）→ wm `syncPanes` 作用中 pane
   回填；toggle-panels `injectPanelHTML`（SA_iframe/assist）→ 首次展開回填；
   meeting 模組模板（ggsheet）→ 首次開 vvgglesht modal 回填。登入瞬間 iframe
   7–8 個（含兩個巢狀 Google Sheets 編輯器）→ 1 個（active tab）。
8. **回歸**：新增 `tools/perf-hygiene-test.mjs` 靜態 gate 三規則——blur 字面值只准
   tokens.css（@supports 探針 blur(1px) 豁免）、infinite 動畫必須位於可見狀態白名單
   選擇器下（白名單載於工具內）、script/ 裸 `setInterval` 禁令（僅 canvas-engine.js
   排程器實作豁免）。既有 11 套 headless 全綠後收工。
9. **審查修正（多代理對抗性審查，11 項覆核成立全數處理）**：
   - **開機鎖死（high，最重要）**：ui-conductor 開機一律 fail closed 顯示全螢幕 overlay；
     Firebase 無 identity 或 server grant boot 失敗時，fireworkeffect 發
     `fw-auth-state-change: session-absent` 撤下 overlay、露出登入列，但不初始化任何模組。
   - **跨帳號殘留（medium）**：`AccessClient` 把 grant 綁定 Firebase UID；boot、request 與 heartbeat
     都先比對 UID，變更時同步 access-kill。`wasLoggedIn` 再確保 Firebase 跨分頁登出會完整拆場，
     `initPromise` 歸零後新帳號才可重新初始化。
   - **in-flight init × 登出交錯（low，舊碼同型）**：`initGeneration` 世代計數——
     clearAllModules 前進世代，doInitAllModules 的 allSettled 後驗世代，已登出即
     放棄尾段（不重掛 stack/hover、不廣播 login-ready）。殘餘窗口（個別面板 init
     於登出後才 resolve 時的模組內部排程註冊）有界且下輪必收，完整取消另案。
   - **overlay 淡出首幀跳變（low）**：動畫宣告搬回基底 class＋`animation-play-state:
     paused`，`.active` 只切 running——淡出期間凍結當前姿態而非跳回初始；paused
     不逐幀運算，效能等同無動畫。perf-hygiene R2 同步承認 paused-by-default 豁免。
   - **reduced-motion 涵蓋不足（low）**：path-beam/path-data/粒子全停用，僅外圈
     公轉降速 12s 作載入回饋。
   - **hideOverlayWhenFaded 殘留 transitionend（low）**：改固定延時（淡出全長＋150ms）
     ＋落地前驗 `opacity === '0'`，不再誤吃淡入的 transitionend 截斷淡出。
   - **保險絲漏網（low）**：`.canned-panel.gl-dragging` 的字面 15% 白底在保險絲下
     以 `html` 前綴特異度（0,2,1）蓋回 `--glass-bg-solid`。
