# cspanel Liquid Glass 設計移植 — 設計文件

日期：2026-07-05
狀態：已由使用者核可（brainstorming 階段）
來源設計：noisy-waterfall-6ca5（Tarkka）的 Liquid Glass 設計系統
目標專案：cspanel（https://github.com/dasawada/cspanel，GitHub Pages 部署於 https://dasawada.github.io/cspanel/）

## 1. 目標與範圍

把 Tarkka 的 Liquid Glass 設計系統移植到 cspanel 主控台，讓 cspanel 具備與 Tarkka、cspanel_netlify 的 course_debug.html 一致的視覺語言：磨砂玻璃面板浮在三點 mesh gradient 背景上，配 62+1 組可切換配色主題。

此設計語言並非外來——Tarkka 的 DESIGN.md 明言其玻璃 tokens 對照 course_debug.html 制定，本次移植是「把已存在於同生態的語言推廣到 cspanel 全站」。

### 已定案的範圍決策

| 決策點 | 定案 |
|---|---|
| 佈局 | **只換皮**：保留 min-width:1700px、全部面板絕對定位座標、DOM 結構不動 |
| 主題 | **搬 62 組主題切換器**（theme.js），另新增第 63 組「Olive」palette（accent #8d9c00）設為預設 |
| 頁面範圍 | **本期僅 panel_all.html 主控台**（含登入列、轉場、toast、全部面板）；board/、gotogo、DT_report、ggsheet、轉單小工具等 12 個獨立頁排第二期 |
| 跨 repo | **cspanel_netlify 僅允許改注入區塊**（tabsHTML/ipHTML 的 markup 加 class，不動邏輯）；TESTwhosthere 等 netlify 使用者頁排第二期 |
| 實作策略 | **平行重寫、一次切換**：在 `redesign/liquid-glass` 分支重建 style/v2/ 全新樣式組並改寫 JS 內嵌樣式，驗證通過後一次合併 main 上線 |

### 不在範圍內

- 響應式佈局、面板座標調整
- render.css/render.js/rich-render.js（聊天訊息渲染器，cspanel 無此場景）
- doc-manager 暖紙系統、admin-shell 磚紅系統（DESIGN.md：三套語彙不可混搭，cspanel 只採 Liquid Glass）
- 暗色模式（來源系統明訂 light only）
- Font Awesome / Google Fonts CDN 依賴的內嵌化
- 主題偏好的跨裝置同步（GitHub Pages 無後端；theme.js 的 server 同步靜默失敗、退化為 localStorage-only）

## 2. 視覺語彙（來源 → 目標對應）

### 2.1 Tokens（直接複製自 tarkka.html :root 行 31-73）

- 玻璃：`--glass-bg` rgba(255,255,255,0.60)、`--glass-bg-hover` 0.78、`--glass-border` rgba(255,255,255,0.50)、`--glass-shadow`（0 2px 24px rgba(0,0,0,0.06) + inset 白 hairline）、`--glass-blur`（面板卡 20px、modal 40px）
- 文字階層：`--fg` #1d1d1f、`--fg-2` #6e6e73、`--muted` #8e8e93、`--muted-2` #aeaeb2；hairline `--border` rgba(0,0,0,0.07)、`--border-2` 0.12
- 語義色：`--accent` / `--accent-hover` / `--accent-2` / `--accent-tint`(12%) / `--accent-ring`(28%) / `--selection-bg`(20%)、`--success` / `--warning` / `--danger`（實際值由 theme.js 隨主題覆寫）
- 尺度：圓角 8/12/16/20px（膠囊 999px）、`--spring: 0.35s cubic-bezier(0.34,1.3,0.64,1)`
- 字型：`--sans: "IBM Plex Sans", "Noto Sans TC", sans-serif`、`--mono: "IBM Plex Mono", monospace`

### 2.2 語彙置換

| 現況（cspanel） | 新語彙（Liquid Glass） |
|---|---|
| 登入後背景 `linear-gradient(135deg,#e4f7dd,#feebeb)`（panel-all.css） | `--bg-base` + 三點 radial-gradient ellipse mesh（20%20% / 80%80% / 60%30%，各 transparent 50%）+ `background-attachment:fixed` |
| 面板卡：白底 + 橄欖綠半透明邊 + border-radius:10px + 雙層陰影 + hover 呼吸燈（body.css 面板選擇器群） | 玻璃配方：`--glass-bg` 底 + `backdrop-filter: blur(20px) saturate(1.6)`（含 -webkit- 前綴）+ 1px 玻璃白邊 + inset hairline；hover 玻璃亮度升 0.78（取代呼吸燈）；附 `@supports not (backdrop-filter…)` 不透明 fallback |
| macOS 灰底按鈕、內陰影輸入框（button.css） | primary 實心 `--accent`、hover `--accent-hover`、active `scale(0.96)` spring；輸入框 rgba(0,0,0,0.04) 底 → focus 白底 + accent 邊 + 3px `--accent-ring` |
| 全站 13px / font-weight 500、Noto Sans TC/Inter | **保留 13px 高密度**（客服工作台資訊密度優先，不採 Tarkka 15px），字族換 `--sans`，文字色改用階層 tokens |
| modal / toast（漸層底色，fireworkeffect.js 注入） | 玻璃 popover/modal（blur 40px + scrim）、tier-rise 式 spring 進場過衝；toast 改玻璃底 + 語義色點 |
| `.yellow-gradient-text` / `.green-gradient-text` 漸層字 | 違反 DESIGN.md「no gradient text」禁令 → 改「語義色點 + 純色文字」（--warning / --success 色點） |
| radio+label 純 CSS tab | 機制保留，視覺換 pill/segmented（--accent-tint 底 + accent 字） |
| 登入/登出雙核反應爐轉場（ui-conductor-v2.js，三根色 color-mix 衍生） | **保留不重寫**，僅將 `--ui-accent`/`--ui-surface`/`--ui-text` 改指 `var(--accent)`/`var(--bg-base)`/`var(--fg-2)`，轉場自動隨主題連動 |

### 2.3 主題引擎

- `web/theme.js` 整檔搬入 cspanel（classic script，僅 setProperty + localStorage，UI 文案已是繁中）
- 新增第 63 組「Olive」palette：accent #8d9c00、mesh 用低飽和橄欖/暖白系，設為預設主題，延續 cspanel 識別色
- localStorage key 定為 `cspanel.theme.v1`（不沿用 `tarkka.theme.v1`，避免與同瀏覽器上的 Tarkka 偏好互相覆寫）
- server 同步（POST /api/me/preferences、GET /api/me）在 GitHub Pages 上 404，theme.js 已包 `.catch(){}` 靜默失敗，行為退化為 localStorage-only——可接受，不改
- 主題切換器入口：登入列旁小按鈕，開玻璃 popover gallery
- **驗收回饋修訂（2026-07-05）**：主題改為登入後才生效——tokens.css 預設值為未登入單色基準（灰階 accent/mesh；success/warning/danger 保留語義色），theme.js 監聽 `firework-login-success` 才套用儲存的配色、登出（含 force-logout）時 `resetTheme()` 還原單色；調色盤按鈕登入後才顯示

### 2.4 設計禁令（承襲 DESIGN.md）

- no gradient text、no side-stripe accents
- 玻璃只用於面板/chrome，不當裝飾
- 全部動效包 `prefers-reduced-motion: reduce` 豁免

## 3. 架構與檔案結構

### 3.1 v2 樣式組（於 redesign/liquid-glass 分支）

```
cspanel/
├─ style/v2/
│  ├─ tokens.css        # :root tokens（含 Olive 預設值，theme.js 載入後覆寫）
│  ├─ base.css          # body mesh 背景、字型引入、全域 reset、auth-active 防閃爍
│  ├─ panels.css        # 統一玻璃面板卡（沿用 body.css 現有面板選擇器清單）
│  ├─ controls.css      # button/input/select/textarea/tab/nav 全域控件
│  ├─ overlays.css      # modal、popover、toast、登入列、主題切換器
│  └─ features/         # DT_CSS、ipsearch、meeting-now、meeting-match、
│                       #   all-meeting、shrturl、report 七檔逐一改寫對齊 tokens
├─ script/theme.js      # 自 Tarkka 搬入 + Olive palette + picker UI
└─ panel_all.html       # 切換日：<link> 整組換 v2、載入 theme.js
```

載入順序契約：tokens.css → base.css → panels.css → controls.css → overlays.css → features/*，theme.js 在 tokens.css 之後執行（runtime 覆寫 :root）。

### 3.2 JS 內嵌樣式的收斂

9 個含 inline style / CSS 字串的 JS 模組在分支上改為 class 引用，樣式進 v2 CSS：

- `fireworkeffect.js`（登入列 inline style、toast CSS 字串）
- `ui-conductor-v2.js`（僅改三個根色變數指向，其餘不動）
- `toggle-panels.js`、`optitleGG.js`、`dragb_msg_pnl.js`、meeting 系列等其餘模組的 HTML 模板 inline style

JS 檔無法像 CSS 一樣新舊並存，因此這些改動只存在分支上——這是選「分支隔離」而非「同目錄並存」的原因。

### 3.3 必須保留的行為契約（換皮不可破壞）

1. `html.auth-active` class 切換 + placeholder `opacity:0` 防閃爍機制（panel-all.css 行 13-46 的等價邏輯需在 base.css 重現）
2. `firework-login-success` / `firework-logout-success` / `fw-auth-state-change` 事件名與時序
3. `.ui-reveal-item` 每 80ms stagger 揭示
4. 全域點擊攔截器（capture 階段 async 驗證）的互動行為
5. 所有面板 `top/left/z-index` 座標、radio+label tab 機制、toggle-panels 的 small-size 收合邏輯
6. `firebase_id_token` localStorage、`window.verifyFireworkAuth`、`window.CSPANEL_API_BASE` 等既有介面

### 3.4 cspanel_netlify 連動（僅注入區塊）

> **執行時修訂**：實查發現 tabsHTML/ipHTML 存於 Firestore、由 edge function 原樣回傳，程式碼無 markup 生成處。實際做法改為 cspanel 端 `auth-protected-tabs.js` 注入後動態補 class（`gl-injected`/`gl-table`），cspanel_netlify 零修改，下述部署順序問題隨之消失。

- `order-tool-api` edge function 回傳的 `tabsHTML` / `ipHTML`：markup 加上 v2 class（如 `gl-tab`、`gl-table`），不動資料與邏輯
- **部署順序：netlify 先上**——新 class 在 main 的舊 CSS 下無匹配規則、無視覺影響（無害），cspanel 之後切換即生效。兩 repo 不需同時上線
- cspanel 端 controls.css 的全域元素選擇器（button/input/table）為注入內容提供保底樣式，v2 class 提供精修

## 4. 切換、預覽與回滾

- 開發：`redesign/liquid-glass` 分支 + 本機 `python3 -m http.server` 預覽（ES modules 需 http，不能 file://）
- 驗證：見第 6 節清單，逐項通過後才切換
- 切換：分支合併 main → push → GitHub Pages 自動上線（無 build 步驟）
- 回滾：`git revert` 合併 commit 一次退回整組（big-bang 策略的安全網）

## 5. 相容性與錯誤處理

- `backdrop-filter`、`color-mix()`、`oklch()`：需新版 Chromium。現行 ui-conductor-v2.js 已在生產使用 `color-mix()`，證明使用者環境支援。仍為玻璃配方附 `@supports` 不透明 fallback（fallback 時面板為近白不透明卡 + hairline 邊）
- 資源路徑：GitHub Pages 子路徑 `/cspanel/` 部署，一律相對路徑
- theme.js server 同步靜默失敗（`.catch(){}`）→ localStorage-only
- 字型：IBM Plex Sans 無繁中字符，`"IBM Plex Sans", "Noto Sans TC"` 配對載入（Google Fonts CDN，維持現狀）

## 6. 驗證清單（切換前逐項通過）

1. 登入 → 轉場 → 面板 stagger 揭示全流程；token 過期強制登出（`firework-force-logout`）路徑
2. 十多個面板逐一目視 + 互動抽測：拖曳面板（dragb_msg_pnl）、tab 切換、modal（#results-modal、#vvgglesht_modal）、toast 四型（success/error/warning/info）
3. Google Sheet 大表格（consultantlistgooglesheet 950×700、assist_googlesheet）在玻璃卡上的可讀性——已知高風險點，必要時表格區局部改高不透明底（rgba 0.92+）
4. 受保護區塊：登入後 tabsHTML / ipHTML 注入內容樣式正確（需 netlify 端先部署）
5. 主題：62+1 組抽測至少 5 組（必含 Olive 預設與 Iceland）；切換後 mesh、玻璃、按鈕、轉場、Mermaid 無殘留舊色；重新整理後主題自 localStorage 恢復
6. `prefers-reduced-motion: reduce` 下動效全部停用
7. 本機 http.server 與 GitHub Pages 部署後各驗一輪（子路徑資源載入）

## 7. 風險登記

| 風險 | 緩解 |
|---|---|
| big-bang 切換出問題難定位 | 分支上逐面板驗證 + git revert 一鍵回滾 |
| 玻璃上密集表格可讀性差 | 驗證清單第 3 項專項檢查；局部高不透明底方案備案 |
| 伺服器注入 markup 改動與 cspanel 切換時序 | netlify 先上（無害部署），cspanel 後切 |
| 全域元素選擇器互相干擾 | v2 全新重寫、載入順序契約固定；不與舊 CSS 並存 |
| 全域點擊攔截器 preventDefault 影響新互動元件 | 新元件（主題 popover）沿用既有面板互動模式，驗證清單覆蓋 |
| 改錯檔（ui-conductor.js / v2 / v3 並存） | 實際使用為 v2；本期順手刪除未引用的舊版檔案 |

## 8. 第二期（本期不做，先記錄）

- 12 個獨立頁逐頁套用 v2（board/、gotogo、ggsheet、DT_report、zvmeetingsearchall、ua-debug、SA_iframe、bxtextareamodle、fu_s_popup、assist_list_scale、轉單小工具）
- cspanel_netlify 使用者頁（TESTwhosthere、tutor-schedule 等）對齊
- 主題偏好跨裝置同步（接 Firestore 或 netlify function）
