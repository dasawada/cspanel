# 第九期設計：圖形化視窗管理引擎（面板分組成 page）

> 📌 brainstorming 核可後的設計。交付走 **panel_all_v2.html 平行預覽頁**（§6）：
> 推上 main 供線上預覽，雙方確認後才定版合併進 panel_all.html。
> 動任何畫布/面板前先讀 `docs/CANVAS.md`。

---

## 0. 背景與動機

使用者構想：多個面板可自定義拖曳分組成一個「page」（複合頁），page 可拖進既有
wm 視窗成為其中一個 tab——例如 a、b、c 三個小面板各佔一個 tab 太浪費，讓它們
組成一頁、拉進視窗，實現「真正的圖形化視窗管理」。

### 關鍵洞察：wm 常駐池機制就是答案的原型

現行 wm 的 tab 從來不是 DOM 巢狀在視窗裡——pane 住在常駐池，作用中由
`syncPanes()` **定位貼合**視窗內容區、非作用中 `display:none`
（window-manager.js:103-121），永不 re-parent，iframe 不重載。
「page」＝把 pane 概念從**單一元素**推廣為**成員集合＋頁內佈局**。

### 已否決的替代架構（記錄，避免重議）

- **真 DOM 容器**（成組時把面板搬進 page div）：re-parent 會重載內嵌 iframe
  （consultant/assist 面板實測內嵌 SA_iframe.html／assist_list_scale.html，
  toggle-panels.js:175,188），違反 §7.2 契約。否決。
- **page 為巢狀 iframe 小畫布**：成員與主頁 JS 跨 frame 隔離（API、theme 事件
  全斷），推翻常駐池架構。否決。

---

## 1. 決策記錄（brainstorming 逐項核可）

| 問題 | 決策 |
|---|---|
| 操作模型 | **全部隨時可拖**（Chrome 式），不分編輯模式 |
| 面板視窗化程度 | **hover 浮現把手**（常態隱形不佔空間）；**編輯模式退役** |
| 成組手勢 | **拖重疊即成組**（懸停確認＋預覽框護欄） |
| 頁內佈局 | **依拖進順序垂直排列**為預設；開放**自由排列（田字型）** |
| 參與範圍 | **全面板可組（含 quirks：罐頭、IPsearch）**；既有 iframe tab 維持單元素、**不混組** |
| 交付方式 | **panel_all_v2.html 平行頁**線上預覽 → 雙方確認 → 定版合併 |

---

## 2. 視覺與互動基準

- 把手視覺**一律**用第八期把手詞彙（`style/v2/draggable-chrome.css`，§4.7 契約），
  不另造視覺；中文標籤沿四期 manifest `label` 欄語義。
- hover 浮現＝`opacity` 狀態切換（常態 `opacity:0; pointer-events:none`，面板
  hover 時 `opacity:1; pointer-events:auto`），合五期 materiality「無運動」精神；
  把手 **overlay 疊蓋**在面板頂部，不推擠內容。
- 成組預覽：拖曳重疊目標面積 ≥40% 且懸停 ≥500ms → 目標高亮＋「組成一頁」預覽框；
  放開成組、拖離或 Esc 取消。護欄使短暫路過不誤觸。
- 浮動 page＝一個 wm 視窗（既有視窗 chrome：把手帶＋內容區＋縮放把手）；
  page 名稱自動串接成員標籤（日後可重命名，首版不做重命名 UI——YAGNI）。

---

## 3. 架構：複合 pane 泛化

### 3.1 資料模型

```js
page = {
  id: 'pg-<nanoid>',
  name: '<成員標籤自動串接>',
  members: [ { panelId, rect: {x, y, w, h} } ],  // rect 相對頁原點
  layoutMode: 'stack' | 'free',
}
```

- 成組初始 `stack`：依拖進順序垂直排列、成員維持原寬、內容區 `overflow:auto`。
- 使用者頁內拖動任一成員 → 轉 `free`（rect 生效，可排田字型）。
- `stack` 模式下 rect 由引擎每次重算；`free` 模式下 rect 為權威。

### 3.2 wm tab 型別擴充

wm 視窗的 `tabs[]` 成員從「pane id」擴充為 **`iframe-pane id ∣ page id`**。
`syncPanes()` 泛化：page tab 作用中時，逐成員計算「視窗內容區原點＋頁內 rect」
寫入面板 inline left/top，`display` 與 z 隨宿主視窗（z＝宿主 stack rank＋帶內
小序，同 pane 現行做法）；非作用中整組 `display:none`。**成員面板 DOM 全程留在
`.panel_all_container`，零 re-parent。**

### 3.3 d&d 協議復用

page 拖進其他視窗 tabbar 成 tab、從 tabbar 撕出成浮動視窗——**復用 wm 既有
撕離/合併協議**（DRAG_THRESHOLD、drag ghost、tab 重排），page id 對協議而言
只是另一種 tab。iframe tab 與 page 可同居一個視窗的 tabbar，但 iframe tab
不可被拖入 page（§1 範圍決策）。

### 3.4 對稱解散

- 成員把手拖出 page 內容區 → 回畫布自由面板，恢復**離組前座標**（記錄於 layout）。
- page 只剩一名成員 → 自動解散（成員回畫布，page 與其 tab 移除）。

### 3.5 疊序

成員不再個別參與 stack-manager 的面板疊序；點擊成員＝置頂宿主視窗（事件冒泡至
視窗既有 pointerdown 置頂邏輯）。離組回畫布後恢復個別面板疊序身分。

---

## 4. 九期A：面板視窗化基座（先行、獨立可交付）

1. **常駐 hover 把手**：canvas-engine 為每面板生成把手（掛 `.draggable-handle`
   詞彙＋`label` 中文標籤），常態隱形、hover 浮現（§2）；`makeDraggable` 隨時
   綁定（不再限編輯模式），`onPositionChange` 即時寫 layout（管線已存在）。
   **已自帶常駐把手的面板（罐頭 `alwaysDraggable`）不重複生成**，其把手即分組
   拖曳表面。
2. **編輯模式退役**：`#gl-edit-bar`、enter/exit 編輯流程、`html.canvas-editing`
   相關樣式與 nav 讓位規則拆除；「重設佈局」入口遷移至登入列。
3. 行為不變項：+18px 修、邊界回彈、事件盾、罐頭 alwaysDraggable 原樣。
4. quirks 面板在 A 期：照常可拖（引擎已接管其把手），成組能力留 B 期。

## 5. 九期B：page 引擎

1. 成組手勢（§2 護欄）＋成組動畫外的即時回饋（toast 級提示可省——預覽框已足）。
2. page 抽象與頁內佈局（§3.1）；頁內成員拖調（同一 makeDraggable，邊界＝頁內容區）。
3. wm 泛化（§3.2/3.3）＋疊序（§3.5）＋對稱解散（§3.4）。
4. **quirks 歸隊**：罐頭入組時其 `draggable:<path>:<id>` per-path 座標權威暫停、
   離組恢復；IPsearch（server-markup）重注入時若持久化記錄其屬某 page，由引擎
   歸隊至該 page 並補齊頁內 rect。
5. meeting-shell 順序契約（cs.js 順序註解）不受影響——成組不觸 init/clear 順序。

---

## 6. 交付策略：panel_all_v2.html 平行預覽頁

- **新頁 `panel_all_v2.html`**：自 panel_all.html 複製（**保留無 DOCTYPE quirks
  契約**——引擎行為必須在同構環境驗證），改掛 v2 引擎設定。
- **共用模組＋設定參數化**：canvas-engine／window-manager 增加初始化設定
  （`{ pageEngine: true, storageSuffix: '.v2' }` 之類，細節屬實作計畫）；
  **panel_all.html 不傳設定 → 行為與現行完全一致**。不 fork 引擎檔案，
  避免雙版本漂移；production 安全由「旗標預設關」＋全套回歸雙頁跑保障。
- **儲存命名空間隔離（關鍵風險）**：`cspanel.windows.cs.v1`／`cspanel.stack.cs.v1`
  ／layout key **不含路徑**，v1/v2 兩頁同 origin 共用 localStorage——v2 頁一律
  用**新 schema 新 key**（§7），絕不讀寫 v1 keys，預覽期間正式頁狀態零汙染。
- **推版即預覽**：v2 頁與旗標化引擎改動推上 main（GitHub Pages 只服務 main，
  分支無 URL）→ 線上網址 `…/panel_all_v2.html` 直接試用。使用者已授權此推版。
- **定版程序（獨立九期C，需雙方確認後才動）**：panel_all.html 改掛 v2 設定
  （或旗標預設翻轉）、v2 頁移除、CANVAS.md 契約更新（編輯模式章節改寫、page
  契約新章）、v1 舊 keys 清理策略。**未經使用者確認不得合併進 panel_all.html。**
  新 key 不含路徑 → v2 頁調好的佈局在定版後由 panel_all.html 無縫繼承。

---

## 7. 持久化 schema

- `cspanel.pages.cs.v1`：page 定義陣列（§3.1 模型）。
- `cspanel.windows.cs.v2`：wm 視窗（tab 型別擴充版）；淨化比照現行（未知 id
  過濾、tab 恰出現一次、page 成員 panelId 恰屬一個 page）。
- `cspanel.layout.cs.v2`：面板畫布座標＋`detachedRect`（離組恢復用）＋
  page membership。罐頭座標權威在入組期間由此 schema 接管（§5.4）。
- `cspanel.stack.cs.v2`：疊序（page 成員不在列，宿主視窗在列）。

---

## 8. 明確不變項

- **iframe 零重載契約（§7.2）**：全程零 re-parent；成組/切 tab/撕出/定位皆純
  style 變更。回歸套件以 consultant/assist 內嵌 iframe 為命門斷言。
- 把手視覺單一來源（§4.7 把手詞彙）；z-index 只引用 `--layer-*`（§4.2）；
  新 CSS 不裸寫尺寸 px（§4.8）；panel_all 系頁面無 DOCTYPE 契約。
- wm 既有 iframe tab 行為與 a11y、四期 +18px 修、meeting-shell clear 順序契約。
- production（panel_all.html）在定版前行為零變化。

## 9. 已知刻意變更（對既往契約的推翻）

1. **編輯模式退役**（v2 引擎下）：四期「保留面板外觀、位置只在編輯模式調」推翻
   ——面板隨時可拖、hover 浮現把手。定版時 CANVAS.md 相關章節改寫。
2. 面板入組後不再個別參與疊序（跟隨宿主視窗）。
3. 罐頭 per-path 座標權威在入組期間讓位給統一 layout schema。

## 10. 風險與驗證

- **成組誤觸**：40% 面積＋500ms 懸停＋預覽框＋Esc；回歸套件含「短暫路過不成組」
  斷言。閾值若手感不佳，預覽期間可調（token 化為引擎常數）。
- **儲存互汙**：v2 新 key 隔離（§6）；回歸斷言「v2 頁操作後 v1 keys 位元不變」。
- **共用模組旗標風險**：panel_all.html 不傳設定即舊行為；全套既有回歸（v1 頁）
  ＋新套件（v2 頁）雙軌全綠才推版。
- **v2 頁 protected content**：同 origin 同 runtime 注入（Firestore
  `protectedContent/tabsAndIP`），auth-protected-tabs.js 照常運作；驗證項。
- 新回歸套件 `tools/page-engine-test.mjs`（v2 頁）：成組/解散/撕出/持久化還原/
  iframe 零重載/懸停護欄/儲存隔離。

## 11. 分期

- **九期A**：基座（hover 把手、隨時拖、編輯模式退役——皆在 v2 頁生效）
- **九期B**：page 引擎全量（成組、wm 泛化、quirks 歸隊、持久化、回歸套件）
- **九期C（定版，需使用者確認）**：合併進 panel_all.html、契約改寫、清理

A 完成即推 main 供預覽；B 完成再推；C 等雙方確認。
