# 第六期設計：膠囊輸入語彙 + 全站捲軸單一權威（跨 cspanel / cspanel_netlify）

> 📌 依對話中核可的方向撰寫（第二序：不是逐顆修一致，是補齊「表面以下」的設計系統詞彙
> 並以契約強制，讓不一致無法再生）。範圍含 cspanel_netlify（使用者定案）。

## 0. 第二序依據

- 反例實證：`capsuleinput.js` 曾是同目的的共用模組，因無契約強制淪為孤兒（第五期清理時刪除）。
  **建共用檔是第一序；讓「不用共用檔」違規才是第二序。**
- 本專案已兩次驗證的模式：層帶 tokens（z-index）、manifest（座標）——「單一權威檔 + CANVAS.md
  鐵律 + 遷移既有實例 + 白名單」。本期為同手勢第三次應用，向下延伸到表面以下的詞彙。

## 1. 現況盤點（實測）

**input 內嵌元素（capsule 詞彙的遷移對象）**：
| 實例 | 樣式來源 | 定位法 |
|---|---|---|
| fudausearch clear（panel_all 模板） | controls.css | absolute; right:5px |
| fudausearch clear（轉單頁靜態 markup） | 頁內 inline CSS | 第二份複製 |
| fudausearch clear（fu_s_popup） | 舊 button.css | 第三份複製 |
| canned clear + **search-spinner** | dragb_msg_pnl.js 注入 CSS | absolute; right:42px; top:50% |
| IP spinner（Firestore markup，class 固定） | ipsearch_css.css | 第五種 |

**排除**：`.clearIcon`（optitle 面板角落垃圾桶，非 input 內嵌）、`.fudausearch-fixed-button`
（區塊按鈕）、`meeting-loading-spinner`／`ui-spinner`（區塊級 loading，非 input 內嵌）→ 白名單。

**scrollbar：六個獨立輪子**：cspanel 4 個 v2 feature css 各刻 `::-webkit-scrollbar`；netlify 的
course_debug（2 處）與 zvmeetingsearchall（1 處）。無 token、不隨 63 組主題、Firefox 無管理。

## 2. 詞彙設計

### 2.1 `style/v2/capsule.css`——膠囊輸入（`gl-` 前綴慣例）

- `.gl-capsule`：wrapper，唯一定位權威（`position:relative`）。
- `.gl-capsule__end`：主要尾端動作（clear 鈕）——`absolute; inset-inline-end: var(--capsule-inset);
  top:50%; translateY(-50%)`；`.gl-capsule__end-2`：第二尾端槽（再往內一格，canned 的 spinner+clear 用）。
- `.gl-capsule__spinner`：輸入中 spinner 配方（尺寸/邊框色/旋轉動畫），`.is-visible` 顯示。
- 尺寸用 em（跟隨輸入框字級）；**所有色彩 token 帶 fallback**（`var(--muted, #8e8e93)` 式），
  讓不載 tokens.css 的頁（轉單頁、fu_s_popup、netlify）也能獨立引用——詞彙檔自足。
- 相容區：`.ip-search-spinner` 映射同配方（Firestore markup class 不可改，契約既定）。

### 2.2 `style/v2/scrollbar.css`——捲軸單一權威

- **只用標準屬性**（單一機制）：`* { scrollbar-width: thin; scrollbar-color:
  var(--scrollbar-thumb, …fallback) transparent; }`，thumb 色 `color-mix(var(--fg) 25%, transparent)`
  隨主題連動。**不寫 `::-webkit-scrollbar`**——Chrome 121+ 一旦設標準屬性即忽略 webkit 私有語法，
  兩者並存等於維護死碼。Safari 不支援標準屬性 → 回退系統原生 overlay（macOS 本就好看）。
- 已知視覺變更（刻意）：Windows Chrome 從 17px 傳統捲軸變 thin 有色；netlify 舊 5-8px webkit
  捲軸改為 thin。

### 2.3 CANVAS.md 契約

- §4.4 詞彙表加 `capsule`／`scroll` 兩列（配方 + 檔案）。
- 新增 §4.7 鐵律：input 內嵌動作不得自造定位（一律組合 `.gl-capsule` 詞彙）；scrollbar 不得局部
  自刻（`scrollbar.css` 單一權威，含 netlify 熱連）。白名單：`.clearIcon`（面板角落動作）、
  `ui-spinner`／`meeting-loading-spinner`（區塊級 loading）。

## 3. 遷移與範圍

**cspanel**（分支 `capsule-scrollbar`）：
1. tokens.css 加 `--capsule-*`／`--scrollbar-*`；新增 capsule.css / scrollbar.css；panel_all 加 link。
2. 遷移：fusearch-panel.js 模板加 capsule class、controls.css 刪手刻塊；dragb_msg_pnl.js markup
   加 class、PANEL_CSS 刪手刻塊；轉單頁加 link + class、刪 inline 複製；fu_s_popup 加 link + class、
   button.css 刪複製；ipsearch_css 的 spinner 改吃 capsule token。
3. 刪 4 個 feature css 的 `::-webkit-scrollbar` 區塊。

**cspanel_netlify**（5 頁）：三個 tab iframe 頁 + course_debug + zvmeetingsearchall 加
`<link href="https://dasawada.github.io/cspanel/style/v2/scrollbar.css">`（跨 repo 單一輪子），
刪各自的 webkit 區塊。**部署順序：cspanel 先上（檔案存在）→ netlify 後上**；熱連失敗時優雅回退
系統捲軸。

## 4. 驗證

- 新回歸 `tools/capsule-scrollbar-test.mjs`：fudausearch/canned clear 鈕垂直置中於輸入框（±2px）
  且同一定位機制；`scrollbar-width` computed=thin；v2 features 無 webkit-scrollbar 殘留（grep 級）；
  轉單頁同斷言。
- 既有九套 + parity + 全站 12 頁掃描；netlify 5 頁本地載入掃描（熱連 404 前優雅）。
- 對抗式審查（多 lens + refute-by-default）→ 修復 → 交驗。

## 5. 範圍外

- `.clearIcon` 面板角落動作的詞彙化（另一個 pattern，需求出現再做）。
- netlify 頁的 input 元素（實測不存在 input 內嵌動作，只有區塊級 spinner）。
