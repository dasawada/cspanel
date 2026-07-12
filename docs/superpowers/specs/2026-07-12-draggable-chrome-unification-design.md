# 第八期設計：把手詞彙元件化（draggable chrome 單一來源）

> 📌 brainstorming 核可後的設計，尚未實作。動任何畫布/面板前先讀 `docs/CANVAS.md`。
> 本期完成後需同步改寫 CANVAS.md §7.6 並於 §4.7 增列把手詞彙（見 §6）。

---

## 0. 背景與動機

panel_all.html 同一畫面存在**兩種視窗語彙**：

1. **代課罐頭生產器**（`script/dragb_msg_pnl.js`，經 `draggable.js`）：把手是一條粗體字窄帶
   （透明底、31px 高），拖曳中套 draggable.js 注入的漸層。
2. **分頁視窗管理器**（`script/window-manager.js` + `style/v2/window-manager.css`，三、四期）：
   `.wm-tabbar` 標題列色帶（`--bg-soft` 底 + `--border` 分隔線、36px 高）+ 藥丸 tab。

使用者判定此雙語彙造成混淆，定調**往 draggable 方向統一**——draggable.js 本就朝 component
方向開發，本期把它的把手視覺抽成單一來源，讓 wm 與所有 `makeDraggable` 消費者共用。

### 現況事實（實作前已盤點）

- draggable.js 是**行為元件**：視覺只有 runtime 注入的兩段 CSS 字串——基礎把手
  （`draggable.js:19-49`）與 `options.color` 的 per-color accent 漸層 class
  （`draggable.js:58-77`，帶 `!important`）。基礎漸層為**硬編碼灰階** `#f0f0f0/#d6d6d6`（非 token）。
- `makeDraggable` 消費者：`dragb_msg_pnl.js`（罐頭，`color:'accent'`）、`canvas-engine.js:255`
  （編輯模式把手，persist:false）、`fusearch-panel.js`＋`新增資料夾/轉單小工具.html`（轉單頁）。
- **window-manager.js 不用 makeDraggable**（自實作拖曳），只共用 `gl-dragging` 材質鉤子
  （window-manager.js:320）與事件盾 z 白名單值 2147483647。
- `dragb_msg_pnl.js` 的 `PANEL_CSS` 留有硬編碼色債：`#ccc/#ddd/#fff/#333/#f9f9f9/#eee/#e0e0e0/
  #4CAF50/red/#f5f5f5/#666`（七期 migrate-on-touch 長尾，本期 touch 到即償還）。

### 已否決的替代方案（記錄，避免未來重議）

- **罐頭面板改穿 wm chrome 詞彙**：曾完整設計後由使用者否決——方向相反，使用者要的是
  draggable 成為統一基準。
- **只調 wm-tabbar 視覺（不動架構）**：畫面統一但把手樣式仍散在兩處、灰階硬編碼續留。
- **draggable 注入樣式原地升格為標準**：不如抽檔徹底，且 runtime 字串注入不利審閱與覆用。
- **維持現狀（雙語彙視為刻意）**：不解決混淆。

---

## 1. 概念

比照六期「表面以下詞彙」（capsule.css、scrollbar.css 各是一個單一輪子），新增第三個輪子：

> **把手詞彙 `style/v2/draggable-chrome.css`**——全站「可拖的帶子」只有一種視覺，來源只有一份檔案。
> draggable.js 續當行為元件，不再內嵌視覺。

「統一」統一的是**帶子的視覺處理**（底、高度、分隔線、hover/拖曳回饋）；帶內內容本就不同、
維持不同：wm 帶裝藥丸 tab（分頁語義），罐頭帶裝標題文字。

---

## 2. 統一後的視覺基準（draggable 基因，token 化）

| 狀態 | 視覺 | 來源 |
|---|---|---|
| 常態 | 透明底、融入面板玻璃，無色帶、無分隔線 | draggable 現貌 |
| hover | `color-mix(in srgb, var(--fg) 7%, transparent)` 微加深 + `cursor: grab` | 自 wm 吸收的「可拖暗示」，統一後全站把手皆有 |
| 拖曳中 | accent 系 color-mix 漸層（原 `options.color` 規則**升為預設**）＋既有 0.95 透明度/陰影＋`gl-dragging` 玻璃特效 | draggable（token 化）；`gl-dragging` 鉤子兩邊本已共用，不動 |
| 高度 | `--handle-h: 36px`（tokens.css 元件映射層新增，遵七期 §4.8） | 罐頭 31px 與 wm 36px 取齊 |
| 圓角 | 上緣 `var(--radius-md) var(--radius-md) 0 0` | 原 draggable 注入的 10px 升 token |

- **高度與圓角的所有權歸詞彙**：`draggable-chrome.css` 宣告 `height: var(--handle-h)` 與上緣
  圓角；`.wm-tabbar` 移除自身 `height: 36px`，罐頭把手移除自身 `height: 19px`。
- 硬編碼灰階漸層 `#f0f0f0/#d6d6d6` **廢除**——被 accent 系取代，跟隨 63 組主題。
- 材質層遵五期 materiality-spec v1（無運動）：hover/拖曳皆為狀態變化，非動畫。

---

## 3. 各檔改動

### 3.1 `style/v2/draggable-chrome.css`（新檔）

把手詞彙單一來源：`.draggable-handle` 常態/hover/active、`.draggable-dragging` 的把手漸層與
面板陰影/透明度。只用 token（§4.8），不寫 z-index（§4.2）。

### 3.2 `script/draggable.js`（行為零改動，只換樣式供給）

- 移除兩段 runtime CSS 字串注入，改為以 `import.meta.url` 解析並注入指向
  `style/v2/draggable-chrome.css` 的 `<link>`（冪等、只注入一次）。
  **理由**：轉單小工具頁等未載 v2 樣式的獨立頁自動跟上，不必逐頁補 link。
- `options.color` 參數廢除（統一漸層後失去意義），呼叫端同步移除，共三處：
  `dragb_msg_pnl.js:915`（`'accent'`）、`canvas-engine.js:256`（`'accent'`）、
  `新增資料夾/轉單小工具.html:492`（硬編碼 `'#a9bcc7'`）。

### 3.3 `script/window-manager.js` + `style/v2/window-manager.css`

- `render()` 建 tabbar 時 class 改為 `wm-tabbar draggable-handle`——**結構性共用**同一條規則，
  不是複製配方。
- 視窗拖曳中在 `win.el` 加 `draggable-dragging`（現只加 `gl-dragging`），拖曳視覺自動統一。
- `.wm-tabbar` 只留佈局宣告（flex、gap、padding、overflow）；底色/分隔線/cursor/hover 讓位給
  把手詞彙。**藥丸 tab 與 a11y 鍵盤導航原樣保留**。

### 3.4 `script/dragb_msg_pnl.js`

- `.canned-panel-handle` 縮減為排版宣告（字級 token；`height: 19px` 移除，高度歸詞彙），
  視覺讓位給詞彙。
- 罐頭面板外框圓角 `10px` → `var(--radius-md)`（12px），與把手詞彙上緣圓角銜接、
  與 `.wm-window` 一致。
- `makeDraggable` 呼叫（dragb_msg_pnl.js:912）移除 `color: 'accent'`。
- 償還色彩 token 債：

| 現值 | 換成 | 語義 |
|---|---|---|
| `#ccc`（input 邊框）、`#ddd`（容器邊框） | `--border-2` | 可見描邊 |
| `#fff` / `#333`（input 底/字） | `--elevated` / `--fg` | 浮起表面 |
| `#f9f9f9`（tab 選單底） | `--bg-soft` | 第二中性層 |
| `#eee`（tab 分隔線） | `--border` | 分隔線 |
| `#e0e0e0`（active tab） | `--accent-tint` 底＋`--accent-hover` 字 | 呼應選中語義；**不改藥丸**，直排結構與操作位置不變 |
| `#4CAF50`（copied 鈕） | `--success` | 狀態色 |
| `red`（warning） | `--danger` | 狀態色 |
| `#f5f5f5` / `#666`（disabled textarea） | `--bg-soft` / `--muted` | 停用態 |

- 本期 touch 到的宣告若含裸尺寸一併換 `--space-*`/`--text-*`（§4.8）；未動到的行不硬掃。

### 3.5 `style/v2/tokens.css`

元件映射層新增 `--handle-h: 36px`。

### 3.6 不改程式碼的消費者

- `fusearch-panel.js`／轉單頁 makeDraggable 呼叫端：樣式來源切換後自動統一（轉單頁
  額外移除 `color: '#a9bcc7'` 參數）。
- **編輯模式把手（實作時修正原設計敘述）**：`canvas-edit.css` 的
  `html.canvas-editing .gl-edit-handle`（特異度 0-2-1）高於詞彙（0-1-0），且其漸層配方
  與詞彙拖曳態同源（accent 30%/14% color-mix）——編輯把手**刻意維持**四期專屬樣貌，
  不受詞彙覆蓋，視覺無回歸。
- 實作前盤點結果：cspanel_netlify 無任何 draggable.js 使用，無部署順序約束。

---

## 4. 明確不變項

- draggable.js 全部**行為**：拖曳、邊界回彈、事件盾、persist、cleanup、四期 +18px 修。
- wm 的撕離/合併/重排/縮放/a11y、iframe 常駐池零重載契約（§7.2）。
- 罐頭面板 DOM 結構、localStorage key（self-persisted quirk）、manifest `canned` 條目、
  預設位置（1300,75）與寬度 400px。
- 膠囊/捲軸詞彙已接的部分。
- z-index 層帶與 stack-manager 疊序（§4.2）。

---

## 5. 已知刻意視覺 diff（parity 測試預期不齊、屬本期意圖）

1. wm 標題帶失去色帶與分隔線（改透明底＋hover 暗示）。
2. 罐頭把手增高至 36px。
3. 拖曳中把手漸層由硬編碼灰階變 accent 系（隨主題）；轉單頁把手失去專屬色 `#a9bcc7`。
4. 罐頭面板內部色彩 token 化後隨主題（原為固定淺灰系）。
5. 罐頭面板外框圓角 10px → 12px（`--radius-md`）。

---

## 6. 契約與文件更新（CANVAS.md）

- **§7.6 改寫**：「標題列色帶」決策刻意推翻——「一眼是視窗」改由玻璃框＋陰影＋統一把手
  hover 暗示承擔。記錄推翻原因：同畫面雙語彙混淆 > 色帶辨識度。
- **§4.7 增列第三個詞彙**：把手——新可拖面板不得自寫把手視覺，一律 `.draggable-handle`
  （draggable-chrome.css 為單一來源）。
- 新增第八期刻意變更記錄一節。

---

## 7. 風險與驗證

- **實作前盤點**：cspanel_netlify 各頁是否也用 draggable.js（複製版或熱連）；若有熱連
  draggable-chrome.css，比照六期部署順序鐵律：**cspanel 先上、netlify 後上**。
- 回歸（tools/ 九套 headless 相關項＋手動）：
  - wm：撕離/合併/tab 重排/縮放/點擊置頂/a11y 鍵盤導航（切 tab 不重載 iframe）。
  - 編輯模式：進出、把手拖曳（+18px 修不可回歸）、persist:false 不跳位。
  - 罐頭：拖曳（含拖過 iframe 上方，事件盾）、重整位置還原（key 未變）、`gl-dragging` 特效。
  - 轉單頁／獨立頁：把手樣式經 `<link>` 注入正常載入（相對路徑以 draggable.js 位置解析）。
  - 主題：切數組 palette 驗把手漸層、罐頭內部 token 色。
- quirks mode（panel_all 無 DOCTYPE 契約）：color-mix 等現代 CSS 不受 quirks 影響，v2 既有
  先例，無新風險。
