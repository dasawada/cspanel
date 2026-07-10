# cspanel 畫布模式引擎化（Canvas Engine）— 設計文件

> 📌 歷史快照：已上線（PR #2，2026-07-07 併入 main）。現行契約以 `docs/CANVAS.md` 為準（含三、四期後續演進：分頁視窗管理器、統一動態疊序）。§9 範圍外的「SaaS 式左選單新殼」已於 2026-07-10 撤案（見 CANVAS.md §9）。

日期：2026-07-06
狀態：已由使用者核可（brainstorming 階段）
前置條件：第一期 Liquid Glass 分支（redesign/liquid-glass）驗收合併後，本期疊在其上
關聯記憶／文件：docs/superpowers/specs/2026-07-05-liquid-glass-migration-design.md（第一期 spec）

## 0. 需求背景（使用者定調）

- **驅動力**：作品典藏與傳承、維護與治理。現有畫布是「純客服語意」的第一件作品，要像 Blaschka 玻璃花——原貌保留，但以工程手段變成可維護、可再製的資產。
- **未來擴展**：可預見多個部門語意的工作區（業務、後勤、會計、行銷、風控），由**使用者 + AI 協作**開發——因此擴充契約必須機器可讀、規則明確，讓任何 AI session 照規則就能正確新增。
- **本期不做**：SaaS 式左選單新殼（使用者：「要想個更簡潔先進的方式，以後再想」）、部門權限控管（註冊表留欄位、不實作）。

## 1. 目標與範圍

把客服畫布從「一次性頁面」重構為「**畫布引擎 + manifest 實例**」：未來任何部門畫布 = 一份新 manifest + 該部門的面板模組；引擎、視覺語彙、佈局編輯全部共用。同時導入**層級註冊表**根治 z-index 魔術數字，並提供**編輯模式**讓使用者自訂面板佈局（含持久化與重設）。

### 已定案的決策

| 決策點 | 定案 |
|---|---|
| 引擎化深度 | **C：manifest 驅動引擎 + 使用者自訂佈局**（使用者明確選擇，含拖排與 localStorage 持久化） |
| 把手 UX | **編輯模式切換**：平時全面板鎖定、外觀不變；「編排」鈕進入編輯態才浮現把手 |
| 例外 | 話術面板保留「隨時可拖」既有習慣（manifest 標 `alwaysDraggable: true`） |
| legacy 共存 | 客服畫布本身就是引擎的第一個 manifest 實例，URL（panel_all.html）不變；未來 SaaS 殼另案 |
| 擴充契約 | `docs/CANVAS.md` 為機器可讀規則文件，供未來 AI session 直接遵循 |

## 2. 概念模型（四構件）

### 2.1 Canvas Engine（script/canvas-engine.js）

firework-mediator.js 的泛化版，職責：

1. `loadCanvas(manifest)`：生成面板插槽（slot div，沿用原 placeholder id + 通用 class `gl-canvas-slot`）→ 依 manifest 座標定位（inline style 由引擎寫入）→ 登入後調度各面板 init、登出調度 clear
2. 自 mediator **原樣搬入**（邏輯零改動）：`firework-login-success`/`firework-logout-success` 監聽、`fw-auth-state-change` 廣播、全域點擊攔截器（capture 階段 verifyFireworkAuth）、60 秒定期驗證、checkExistingAuth 輪詢
3. 行為掛載：manifest `behaviors` 含 `draggable` 者，編輯模式進入時以 makeDraggable 掛把手、退出時卸除；`alwaysDraggable` 者常駐
4. 編輯模式狀態機與佈局存取（見 2.4）
5. manifest 驗證：id 唯一、模組可 import、pos 完整；壞一筆跳過該面板、console.warn + toast 提示，不整頁失敗

### 2.2 Canvas Manifest（script/canvases/cs.js）

```js
export default {
  id: 'cs',
  name: '客服小工具',
  panels: [
    { id: 'optitle',
      module: '../optitleGG.js',
      init: 'initOptitlePanel', clear: 'clearOptitlePanel',
      slot: 'optitle-placeholder',            // 沿用既有 id（防閃爍/模組相容）
      pos: { x: 0, y: 0, w: 400, h: 120 },    // 自 body.css/panels.css 原座標逐字搬入
      z: 10,                                   // 帶內排序（--layer-panel + z）
      behaviors: ['draggable'] },
    { id: 'canned',
      module: '../dragb_msg_pnl.js',
      init: 'initCannedMessagesPanel', clear: 'clearCannedMessagesPanel',
      initArgs: [null, { left: 1300, top: 75 }],
      alwaysDraggable: true,                   // 保留既有隨時可拖
      behaviors: ['draggable'] },
    // …共 14 個面板，座標與現況逐像素等價
  ],
  visibility: 'all',   // 預留：未來部門權限用，本期不實作
}
```

規則：**座標只准出現在 manifest**（CSS 幾何區塊移除）；**z-index 只准引用層帶**。模組的 init/clear 簽名不變，既有面板模組零修改（引擎按 manifest 的 init/clear 名 import 呼叫，等價於 mediator 現在做的事）。

### 2.3 層級註冊表（tokens.css 擴充 + 全站歸帶）

```css
--layer-panel: 100;         /* 面板本體（現 900-1005 群） */
--layer-panel-active: 200;  /* 互動中浮起：拖曳中、focus-within 提升 */
--layer-dropdown: 300;      /* 下拉/建議選單/tooltip（現 fudausearch 999 等） */
--layer-bar: 400;           /* 登入列（現 9999）、常駐 chrome */
--layer-modal: 500;         /* modal 與 scrim（現 999691、theme picker 99990） */
--layer-toast: 600;         /* toast（現 10000） */
```

- 面板間相對疊序 = `calc(var(--layer-panel) + manifest z)`，由引擎寫入
- 既有魔術數字全部歸帶（含第一期 hack：picker 99990、fudausearch 1200 → `--layer-panel-active`）
- 拖曳 overlay（2147483647）保留為唯一例外（拖曳期間的全螢幕事件盾，語義上高於一切）
- 表面階層綁定：panel（blur 20/glass-bg）、dropdown（elevated + blur 20）、modal（blur 40/0.90 + scrim）、toast（elevated + 色點）各為固定語彙，已存在於第一期 CSS，本期把「階層 → 配方」的對應寫進 docs/CANVAS.md 成為明文契約

### 2.4 編輯模式（使用者自訂佈局）

- 進入：登入列新增「編排」icon 鈕（登入後才顯示，與調色盤鈕並列）
- 編輯態：所有 `behaviors: ['draggable']` 面板頂緣浮現玻璃把手（accent 漸層、沿用 draggable.js 既有把手語彙）、可拖曳；拖曳中沿用 `gl-dragging` 近透明效果與慣性回彈；畫面頂部中央出現「完成／重設佈局」玻璃浮動列（`--layer-bar`）
- 退出：「完成」儲存並卸除把手；Esc 等同完成
- 持久化：`localStorage['cspanel.layout.<canvasId>.v1'] = { panelId: {x, y}, ... }`；引擎載入時以「存檔 > manifest 預設」合成實際座標
- 重設：刪除存檔 key、面板動畫回 manifest 預設位（有 `prefers-reduced-motion` 豁免）
- 存檔壞損（JSON 壞/未知 panelId/座標超界）→ 靜默丟棄該筆回預設
- 話術面板：常駐可拖（不受編輯模式管制），其拖曳存檔遷移至統一佈局存檔（原 draggable.js 的獨立存檔 key 讀取一次後轉存新格式）

## 3. 檔案結構

```
script/
├─ canvas-engine.js       ← 新增（mediator 泛化；firework-mediator.js 移除）
├─ canvases/cs.js         ← 新增（客服畫布 manifest）
├─ draggable.js            ← 不動（引擎複用）
└─ 各面板模組               ← 不動（init/clear 簽名維持）
style/v2/
├─ tokens.css              ← 擴充 --layer-* 層帶
├─ panels.css              ← 移除幾何區塊（座標進 manifest）；視覺語彙保留；魔術 z-index 歸帶
└─ canvas-edit.css         ← 新增（編輯態把手、完成/重設浮動列、.gl-canvas-slot 通用防閃爍）
panel_all.html             ← 薄殼化：載入引擎 + cs manifest（URL、head 樣式組不變）
docs/CANVAS.md             ← 新增（機器可讀擴充契約）
```

## 4. 遷移策略：「先搬運、後增能」兩階段

**階段一（行為零變的純重構）**：mediator → engine、座標 CSS → manifest、z-index → 層帶、slot 生成。驗收線：登入前/後畫面與現況**逐像素等價**（截圖 diff），全部面板互動抽測通過。防閃爍：`.gl-canvas-slot` class 規則與既有 id 清單規則並行（引擎生成的 slot 沿用原 id），無破壞。

**階段二（增能）**：編輯模式、佈局持久化、重設、話術面板存檔遷移。獨立 commits 可單獨回滾。

## 5. 行為契約

**沿用（不可破壞）**：`firework-login-success`/`firework-logout-success`/`fw-auth-state-change`/`firework-force-logout` 事件名與時序；`html.auth-active` 防閃爍；`window.verifyFireworkAuth`、localStorage `firebase_id_token`；面板模組 init/clear 簽名；話術面板隨時可拖；quirks mode（無 DOCTYPE）維持。

**新增（寫入 docs/CANVAS.md，給未來 AI session 的規則）**：
1. 新增面板 = 面板模組實作 `init(slotId)`/`clear(slotId)` + 該畫布 manifest 加一筆（id/module/pos/z/behaviors）
2. 新增畫布 = `script/canvases/<dept>.js` 新 manifest + 薄殼 html 頁（複製 panel_all.html 改 manifest 引用）
3. 座標只准出現在 manifest；z-index 只准引用 `--layer-*` 層帶；玻璃/陰影/動效只准引用表面階層語彙
4. 表面階層 → 配方對應表（panel/dropdown/modal/toast）

## 6. 錯誤處理

- manifest 壞筆：跳過該面板 + console.warn + toast（`showFireworkToast` warning 型），其餘面板正常
- 佈局存檔壞損：靜默丟棄回 manifest 預設
- 模組 import 失敗（網路/路徑）：同壞筆處理；引擎整體以 `Promise.allSettled` 調度（沿用 mediator 現行模式）

## 7. 驗證清單

1. 階段一：登入前/後截圖與重構前 diff（逐像素等價）；14 面板互動全數抽測；`grep` 斷言 CSS 無殘留座標與魔術 z-index
2. 階段二：編輯模式進出、拖排、儲存、重整後恢復、重設回預設、Esc 完成；話術面板常駐拖曳 + 舊存檔遷移
3. 層帶回歸：picker vs 話術面板、fudausearch 建議選單、拖曳 overlay 三個歷史 stacking bug 場景
4. `prefers-reduced-motion`：編輯態動效與重設回位動畫停用
5. 本機 http.server + GitHub Pages 部署後各一輪

## 8. 風險登記

| 風險 | 緩解 |
|---|---|
| 座標搬遷抄錯 → 佈局位移 | 階段一逐像素截圖 diff 為硬驗收線；座標從 CSS 逐字搬、附來源行號註解 |
| z-index 歸帶改變相對疊序 | 現況疊序先盤點成對照表，歸帶後逐項比對；三個歷史 bug 場景回歸 |
| 引擎泛化破壞登入調度時序 | mediator 邏輯「原樣搬入」不重寫；事件契約 grep + 登入/登出/token 過期全流程實測 |
| 編輯模式與全域點擊攔截器互踩 | 把手拖曳不經過攔截器攔的元素類型；編輯態全流程在登入後（攔截器活躍）實測 |
| 話術面板存檔遷移遺失使用者位置 | 讀舊 key 一次性轉存新格式，轉存前不刪舊 key（保留一版回退） |

## 9. 範圍外（記錄）

- SaaS 式左選單新殼與工作區切換（使用者要求以後用「更簡潔先進的方式」另案設計）
- 部門權限/visibility 的實際控管（manifest 留欄位）
- 12 個獨立頁的 v2 套版（仍屬第一期規劃的第二期清單）
- 面板尺寸調整（resize）——本期只做位置編排
