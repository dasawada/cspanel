# 十期：低階機流暢化（真毛玻璃保留）設計文件

日期：2026-07-19
狀態：使用者已逐節核准設計方向（四節全數通過），待書面審閱
範圍：panel_all_v2.html 及其 v2 樣式／腳本體系
分支：phase10-lowend-perf

## 1. 背景與目標

2026-07-18 的五項效能稽核（多代理原始碼比對，關鍵結論經對抗性覆核）確認：
內顯 Windows 文書機上的卡頓來自五個戰線——毛玻璃重算、動畫空轉、重複初始化、
背景計時器、iframe 批次掛載。本案目標：**公司文書機（4–8GB RAM、Intel 內顯、
Chrome/Edge）流暢操作，且真毛玻璃視覺完整保留**。

### 1.1 核心洞察（本設計的物理基礎）

Chromium 是損傷驅動（damage-based）渲染：畫面無變動時合成器不產新幀，
backdrop-filter 面板靜置成本為零。每幀 readback＋blur 只發生在「玻璃背後的內容
正在變動」時。本頁的問題不是玻璃貴，是**有東西永遠在玻璃背後晃**：

- 12+ 個 infinite 動畫永不停止（過場 overlay 的 6 組動畫＋6 顆粒子以
  `opacity:0` 隱藏後永久空轉；ip-search-spinner 以 `visibility:hidden` 隱藏後
  仍旋轉），每幀弄髒所有玻璃的取樣範圍。
- 重複初始化與 60 秒強制換發 token 的輪詢讓 CPU 持續醒著。

輔助事實：拖曳時 stack-manager 先置頂，最上層面板不在任何玻璃的取樣範圍內，
每幀只有被拖面板自身重模糊（1 個 pass）；Skia 對大 sigma 先降採樣再模糊，
blur(20px) 成本近乎與半徑無關；`saturate()` 疊加成本 <5%。
**結論：殺掉背景變動源之後，真毛玻璃在內顯機上就是流暢的。**

### 1.2 明確不做

- 不縮 blur 半徑、不拔任何面板的 backdrop-filter、不做共用模糊層／mask 工法、
  不做假玻璃配方替代。
- 不做 iframe 閒置預熱（YAGNI）。
- 不動拖曳 16ms setTimeout 鏈（僅手勢期間存在、有 A/B 實測註解、正確拆除）。
- 不做效能模式的使用者介面（本期只留 class 鉤子）。

## 2. 不變契約

1. **quirks mode 不動**：panel_all_v2.html 無 DOCTYPE 是刻意契約（CANVAS.md §7、§9.10）。
   本案所有 CSS 手段（token 覆蓋、狀態 class、display 切換）不依賴 standards mode。
2. **Firestore 相關 class 名不動**（如 `.ip-search-spinner`，ipsearch_css.css:52-53
   註記之既定契約）：只改樣式規則結構，不改名。
3. **伺服器注入 markup 不要求改動**：netlify tabsHTML 照收，惰性化只在客戶端
   （adoptTabs）處理，且無 iframe 時 no-op 容錯。
4. **視覺 parity**：blur 值、玻璃配方（--glass-bg／border／shadow／saturate）一字不改；
   token 化是集中權威，不是降級。
5. **零重載鐵律語意保留**（window-manager.js:6-11）：iframe 首次載入後永不動 src、
   永不 re-parent；本案改變的只有「首載時機」從登入瞬間延到首次可見。

## 3. 設計

### 3.1 渲染層：動畫生命週期（狀態 class 綁定）

原則：**animation 宣告只准掛在「可見狀態」選擇器下**，基底 class 永不帶動畫，
使「隱藏仍空轉」在結構上不可表達。

- 過場 overlay（ui-conductor-v2.js 注入的 CSS）：6 組 keyframes 的 animation 宣告
  全部改綁 `#ui-transition-overlay.active` 後代；退場（revealContent／finalizeLogout）
  在 `transitionend` 後補 `display:none`，進場（beginTransition 等）前移除。
  雙保險：任一漏接都不空轉。粒子 spawn 邏輯不動（下次過場 innerHTML 汰換）。
- `.ip-search-spinner`（IP_search.js 建立、`visibility:hidden` 佔位防 reflow）：
  `animation` 宣告移到 `.ip-search-spinner.is-visible` 底下；`visibility` 佔位機制不動。
- 已正確走 `display:none` 的（blinkIcon、canned 膠囊 spinner、meeting-spin）：不動。
- 可見的功能／裝飾動畫（gl-gradient-flow 流動字、meeting blink ●）：保留 infinite，
  因其父層已由 display 切換控制（panels.css:285-291），列入回歸工具白名單。
- ui-conductor-v2.js 注入的 CSS 補 `prefers-reduced-motion` 分支（全庫唯一缺席處）。

驗收語意：閒置時 `document.getAnimations()` 為空（或全部 idle/paused）。

### 3.2 渲染層：玻璃衛生

- **死 selector 清理**：自 panels.css:2-13 的 17-selector 玻璃規則移除
  `.idsearchpanel`／`.ClassLogpanel`（cs.js:16-18 載明伺服器已不注入）與
  `.temp2`／`.board`（repo 全域查無 markup 來源）。比照 §9.11 倉庫清理慣例
  記錄查證方式。
- **`.hover-overlay` 查明項**（controls.css:295-311，常駐 opacity:1＋寫死 blur(20px)）：
  實作期第一步查明用途。決策準則：純裝飾疊層→改狀態綁定或非 blur 實作；
  功能必要→保留並在 CANVAS.md 記錄理由。不在設計期預判。
- **blur 值全面 token 化**（值一律不變）：tokens.css 新增
  `--glass-blur-modal: 40px`（modal 內容）、`--glass-blur-scrim: 6px`（全視窗遮罩）、
  `--glass-blur-chrome: 28px`（登入列／編輯列）、`--glass-blur-bar: 8px`（update-header）。
  10 個 CSS 寫死點（panels/overlays/canvas-edit/controls/window-manager/ipsearch）
  全改引用；4 個 JS 注入點（theme.js、fireworkeffect.js、dragb_msg_pnl.js）改掛
  class 消費 token，不再 inline 寫死。
- **降級保險絲（預設不啟動）**：兩個入口、同一份覆蓋——
  `@media (prefers-reduced-transparency: reduce)`（Chrome/Edge 118+，直接跟隨
  Windows「設定 > 個人化 > 色彩 > 透明效果」）與 `html.perf-mode` 手動 class。
  覆蓋內容：全部 `--glass-blur*` 歸零＋玻璃底色改 `--glass-bg-solid:
  rgba(252,253,250,0.97)`（對齊既有 @supports fallback 值，panels.css:23-32）。
  本期不做 UI，class 鉤子供 console 或未來設定頁使用。

### 3.3 行為層：初始化冪等＋觸發源收斂

- **冪等**：canvas-engine.js 的 `initAllModules` 改 promise 單例——
  `initPromise ??= doInitAllModules()`；`clearAllModules`（登出）時 `initPromise = null`
  允許下次登入重 init。任何數量的呼叫者從此安全（未來新增觸發路徑也不會出事）。
- **觸發源收斂為一**：移除 checkExistingAuth（canvas-engine.js:1391-1413）對
  `initAllModules()` 的呼叫；唯一觸發源＝`firework-login-success` 事件
  （fireworkeffect.js:353，Firebase local persistence 下重載必發，且發出時
  `currentUser` 已就緒）。此舉順帶消滅覆核發現的競態：路徑 A 搶快贏了發雙倍請求、
  輸了面板短暫 NOT_LOGGED_IN。checkExistingAuth 其餘副作用實作時確認，無其他
  用途則整段移除。既有 wmMountClaimed 旗標保留（與冪等不衝突，屬第三道防線）。
- **同源症狀修正**：每次重載誤彈「登入成功」toast（fireworkeffect.js:352）——
  `onAuthStateChanged` 區分「新登入」（popup 流程中）與「session 恢復」（重載），
  恢復不彈 toast、不重播煙火。實作手段（流程旗標）由 plan 決定。
- meeting-now 的 setupAutoRefresh setTimeout 洩漏（meeting-now-includefetch.js:117）
  由 3.4 的受管排程器結構性吸收，不另打補丁。

### 3.4 行為層：受管排程器

模組契約補上缺席的可見性掛鉤，讓「裸 setInterval」從此不必要：

- canvas-engine 提供 `engine.schedule({ every, alignTo, onTick, immediate })`
  → 回傳 handle。語意：
  - 自動登記於引擎；`clearAllModules` 全清（**含 alignTo 對齊用的 pending setTimeout**）。
  - `document.hidden` 時跳過 tick；`visibilitychange` 恢復可見時，若期間錯過 tick
    立即補跑一次。
  - `alignTo: 'half-hour'` 支援 meeting-now 的整／半點對齊需求。
- **三處輪詢全數遷移**：auth 檢查（60s）、衝堂檢查（15 分，
  meeting-search-panel-module.js:16）、會議自動刷新（30 分對齊）。
  背景分頁 API 流量歸零；回前景資料立即補新。
- **auth 輪詢保守優化**：節奏維持 60s，但 `getIdToken(true)` 改 `getIdToken()`
  （讀 SDK 快取、過期自動續期）——去除每分鐘一次的強制網路換發。
  後端判定失效的偵測由既有 setupGlobalAuthInterceptor 的 401 兜底。
  實作時確認 verifyFireworkAuth 下游對 localStorage token 寫回時機的依賴。

### 3.5 iframe：首次可見才掛載

- 本地 iframe：toggle-panels.js 的 SA_iframe.html／assist_list_scale.html 模板、
  meeting-search-panel-module.js 的 ggsheet.html modal——模板中 src 改 `data-src`，
  首次開啟（display 切為可見／modal 開啟）時回填 src。回填後即受零重載鐵律保護。
- netlify tabs（伺服器 markup）：auth-protected-tabs.js 的 adoptTabs 收編時，
  把**非 active** pane 內的 iframe src 摘下存 `data-src`；window-manager 首次切到
  該 tab 時回填。active tab 照常立即載入。pane 無 iframe 時 no-op。
- 效果：登入瞬間 iframe 數 7–8 → 1（active tab），兩個巢狀 Google Sheets 編輯器
  隨宿主頁順延。首開等待以現有 loading 詞彙呈現。
- 登出清理（clearProtectedTabs 等）行為不變。

## 4. 驗收標準（DevTools，CPU 4× throttle，改造前後對照）

1. **閒置 30 秒 trace**：零 long task（>50ms）、無持續合成新幀、
   `document.getAnimations()` 為空或全部非 running。
2. **拖曳 10 秒 trace**（拖一片面板穿越其他面板）：p95 幀時 ≤ 33ms、
   無 >100ms long task。
3. **重載已登入頁**：`MeetingNowPanel: 初始化完成 ✅` 與
   `Engine: 所有模組初始化完成 ✅` 各恰出現一次；processing/preparing/over 課程 API
   與 fusearch loadData 各恰一輪；無「登入成功」toast。
4. **登入瞬間 iframe 計數**：等於 active pane 應載數（1），切過全部 tab 後上升至
   完整數且不再增加（鐵律驗證）。
5. **背景分頁**：切到其他分頁 30 分鐘，網路面板零本頁 API 請求；切回後
   會議資料在一個 tick 內補新。

## 5. 回歸與記錄

- **`tools/perf-hygiene-test.mjs`**（仿 materiality-test.mjs 慣例的靜態 gate）：
  1. `blur(` 字面值只准出現在 tokens.css（其餘檔案必須 `var(--glass-blur*)`）；
  2. `animation:`／`animation-name` 宣告必須位於白名單狀態選擇器下
     （`.active`、`.is-visible`、display 切換父層清單，白名單載於工具檔頭）；
  3. `setInterval(` 禁令：script/ 下僅 engine 排程器實作檔可出現。
- CANVAS.md 新增「第十期刻意變更記錄」：死 selector 查證、hover-overlay 查明結論、
  token 新增清單、保險絲語意（「玻璃不見了」= 使用者系統關閉透明效果，by design）、
  觸發源收斂決策、排程器契約。
- 本案為 cspanel repo 內純前端變更；八期盤點確認 cspanel_netlify 無 draggable.js
  依賴，無跨 repo 部署順序約束。

## 6. 風險與邊界

- **首屏時序**：移除 checkExistingAuth 搶快後，面板初始化改等 session 恢復事件，
  首屏可能晚數百 ms——換得請求恰一輪與無 NOT_LOGGED_IN 閃現。驗收時實測觀察。
- **getIdToken() 語意**：localStorage token 寫回從「每分鐘必寫」變「真換發才寫」；
  實作時清查所有讀取端（auth-fetch.js 等）確認拿到的仍是有效值。
- **adoptTabs 容錯**：伺服器 markup 結構變動（pane 無 iframe、多 iframe）時
  data-src 邏輯 no-op 或逐一處理，不得拋錯中斷收編。
- **overlay display:none 時序**：`transitionend` 在分頁隱藏時可能不觸發，
  需以 timeout 兜底（transition 時長＋緩衝）確保 display:none 落地。
- **保險絲誤中**：已開系統「透明效果關閉」的使用者升級後立即看到不透明面板——
  by design，記錄於 CANVAS.md 以備支援查詢。
