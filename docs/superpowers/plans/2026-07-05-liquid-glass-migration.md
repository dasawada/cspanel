# cspanel Liquid Glass 移植 Implementation Plan

> 📌 歷史快照：已執行並上線（PR #1，2026-07-06 併入 main）。現行契約以 `docs/CANVAS.md` 為準。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `redesign/liquid-glass` 分支上以 `style/v2/` 全新樣式組 + JS 樣式收斂，把 Tarkka 的 Liquid Glass 設計系統移植到 cspanel 主控台 panel_all.html，驗收後一次切換上線。

**Architecture:** 純靜態站換皮：新增 tokens/base/panels/controls/overlays 五個 v2 CSS 檔與 theme.js 主題引擎；body.css/button.css/七個 feature CSS 以「複製→逐條轉換」方式改寫進 v2；含視覺樣式的 JS 模組改為 class 或 `var()` 引用。所有面板座標、DOM 結構、事件契約不動。

**Tech Stack:** 純 HTML/CSS/vanilla JS，無 build。CSS custom properties + `backdrop-filter` + `color-mix()`。字型 IBM Plex Sans + Noto Sans TC（Google Fonts CDN）。

**Spec:** `docs/superpowers/specs/2026-07-05-liquid-glass-migration-design.md`（已核可）

## Global Constraints

- 工作目錄：`/Users/jianmingxiu/cspanel_clone/cspanel`（git repo，remote `dasawada/cspanel`）。所有工作在分支 `redesign/liquid-glass` 上，**不得 push、不得 merge 到 main**（最終驗收由使用者把關）。
- **不可改變**：面板 `top/left/z-index/width/height` 座標；DOM 結構與 id/class（新增 class 可以，移除/改名既有 id 不可）；`html.auth-active` 防閃爍機制；事件名 `firework-login-success`/`firework-logout-success`/`fw-auth-state-change`/`firework-force-logout`；`window.verifyFireworkAuth`、localStorage `firebase_id_token`；`html, body { min-width: 1700px }`。
- **字級維持 13px / font-weight 500** 高密度；只換字族與階層色。
- **禁令**（DESIGN.md 承襲）：no gradient text、no side-stripe accents、玻璃只用於面板/chrome；所有進場動效需有 `@media (prefers-reduced-motion: reduce)` 豁免。
- panel_all.html **沒有 `<!DOCTYPE>`（quirks mode）——本期不加**，避免 layout 位移；不要「順手修正」。
- 資源一律相對路徑（GitHub Pages 子路徑 `/cspanel/` 部署）。
- 每個 Task 完成即 commit（訊息格式見各 task），commit 訊息結尾加 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 開發預覽：分支上建立 `panel_all.v2.html`（panel_all.html 的複本改引 v2 樣式），Task 12 切換正式檔時刪除。
- 本機預覽指令（背景執行）：`cd /Users/jianmingxiu/cspanel_clone/cspanel && python3 -m http.server 8123`
- 截圖驗證指令：`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --screenshot=/tmp/gl-check.png --window-size=1800,1200 "http://localhost:8123/panel_all.v2.html"`（登入前只能看到背景與登入列；面板內容需登入後由使用者驗收）
- 無自動化測試框架。每個 task 的「測試」= 明確的 grep 斷言 + 截圖／瀏覽器目視檢查點。

## 全域色彩轉換對應表（所有「複製→轉換」task 共用）

改寫舊 CSS/JS 中的視覺常數時，一律按此表替換。**幾何屬性（width/height/top/left/padding/margin/flex/grid/z-index/position）一律保留原值**。

| 舊值（出現形式） | 新值 |
|---|---|
| 面板卡 `background-color: white` + 橄欖綠邊框 + 雙層陰影（統一面板 block） | 玻璃配方（見 Task 4） |
| 子元素 `background: white` / `#fff`（非表單控件、非 iframe） | `transparent`（在玻璃卡上直接透出）；若為浮出層（下拉建議、tooltip、卡片）→ `var(--elevated)` |
| `#f0f0f0` / `#f1f1f1` / `#f5f5f5` / `#f9f9f9` 填色 | `var(--bg-soft)` |
| 邊框 `#ddd` / `#ccc` / `#e6e6e6` / `#eee` / `#e5e7eb` / `#bfbfbf` | `var(--border)`（細分隔）或 `var(--border-2)`（控件外框） |
| 文字 `#000` / `#333` / `black` | `var(--fg)` |
| 文字 `#4d4d4d` / `#555` / `#666` / `#737373` | `var(--fg-2)` |
| 文字 `#888` / `#8f8f8f` / `#999` / `#aaa` / `#a9a9a9` / `gray` | `var(--muted)` |
| 藍 `#007aff` / `#005fdb` / `#004bb5` / `#2d8cf0` / `#3498db` / `blue` | `var(--accent)`；hover 一律 `var(--accent-hover)` |
| 綠 `#28a745` / `#4caf50` / `#4CAF50` / `#2ecc71` / `#27ae60` / `rgb(34,154,22)` / `green` | `var(--success)` |
| 紅 `#e74c3c` / `#c0392b` / `#ff0000` / `rgb(207,4,4)` / `red` | `var(--danger)` |
| 橘黃 `#f39c12` / `#d68910` / `#FFC107` | `var(--warning)` |
| 陰影 `0 4px 8px rgba(0,0,0,0.1), 0 6px 20px rgb(184 205 215 / 61%)` 或類似厚陰影 | `0 2px 12px rgba(0,0,0,0.06)` |
| 內陰影 `inset 0 1px 4px rgba(0,0,0,0.1)`（輸入框） | 移除（改用 Task 5 輸入框語彙） |
| 淺色狀態底（`#daf5cc` 綠 / `#ffe6d7` 橘 / `#ffecec` 紅 / `#d1fae5` / `#f6fff7`） | `color-mix(in srgb, var(--success|--warning|--danger) 12%, white)` 對應語義 |
| 捲軸 thumb/track 灰階 | thumb `var(--border-2)`、track `transparent` |
| 字族清單 `'Noto Sans TC', 'Inter', ...` | `var(--sans)` |
| **例外：不改** | `.fudausearch-button-special/-paikezu/-kefugon/-groupnumber`（部門色碼，功能性識別）；iframe 內部（管不到）；`cursorspk.js`/`snowfall.js`/`rippleEffect.js` 特效檔 |

**驗收回饋後的框架修正（2026-07-05，第二序變更，優先於上表的逐字替換邏輯）**：對「有設計意圖的效果」——漸層、狀態特效（如拖曳半透明）、動畫——一律採**「效果保留、色彩來源 token 化」**：漸層仍是漸層（stops 由 token/color-mix 調出）、狀態特效保留、動畫強度貼近原版，只有色相來源換成主題變數。禁止把效果壓扁成單一平色。另：「no gradient text」禁令經使用者裁定**對 .gl-chip--\* 解禁**（使用者偏好高於來源專案 DESIGN.md）。

**Task 8 執行後追加的裁定（不可回退）**：(1) ipsearch 的 `.confidence-*` 徽章是「信賴度」語義（high=好），採色相保留（high→success、low→danger），**不套用** low→success 關鍵字表——套用會反轉 UX 語義；(2) 「白字」例外從 accent 底擴大為「任何語義色實底上的白字」（如 `.copy-feedback` 的 success 底、`.ip-info-btn` 的 muted 底）；(3) ipsearch 原有的 `@media (prefers-color-scheme: dark)` 區塊已中性化為同 light tokens（全站無 OS 暗色機制）。

---

### Task 0: 建立分支與預覽環境

**Files:**
- Create: `panel_all.v2.html`（panel_all.html 複本，先不改內容）

- [ ] **Step 1: 建分支**

```bash
cd /Users/jianmingxiu/cspanel_clone/cspanel
git checkout -b redesign/liquid-glass
```

- [ ] **Step 2: 建立預覽複本**

```bash
cp panel_all.html panel_all.v2.html
```

- [ ] **Step 3: 啟動本機 server（背景，之後所有 task 共用）**

```bash
python3 -m http.server 8123 &
curl -s -o /dev/null -w "%{http_code}" http://localhost:8123/panel_all.v2.html
```
Expected: `200`

- [ ] **Step 4: Commit**

```bash
git add panel_all.v2.html
git commit -m "chore: v2 開發預覽頁（切換日移除）"
```

---

### Task 1: style/v2/tokens.css — 設計 tokens

**Files:**
- Create: `style/v2/tokens.css`

**Interfaces:**
- Produces: 全部 `--glass-*`、`--bg-*`、`--fg*`、`--muted*`、`--border*`、`--accent*`、`--success/--warning/--danger`、`--sans/--mono`、`--radius*`、`--spring`、`--elevated`、`--bg-soft`、`--selection-bg`、`--link`、`--code-bg/--code-fg`。後續所有 CSS 只准引用這些變數，不准再寫色碼字面值（`color-mix()` 衍生除外）。

- [ ] **Step 1: 寫入 tokens.css（完整內容）**

```css
/* ============================================================
   Liquid Glass design tokens — 移植自 Tarkka (tarkka.html :root)
   預設值為 Olive 主題；theme.js 於 runtime 覆寫主題相關變數。
   ============================================================ */
:root{
  /* 玻璃 */
  --glass-bg:       rgba(255,255,255,0.60);
  --glass-bg-hover: rgba(255,255,255,0.78);
  --glass-border:   rgba(255,255,255,0.50);
  --glass-shadow:   0 2px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.5) inset;
  --glass-blur:     20px; /* 面板卡；modal 用 40px */

  /* 背景 mesh（Olive 預設，theme.js 覆寫） */
  --bg-base:   #f2f3ec;
  --bg-mesh-1: #e9edda;
  --bg-mesh-2: #eef0e3;
  --bg-mesh-3: #e5e9d8;

  /* 表面 */
  --elevated: rgba(255,255,255,0.86);
  --bg-soft:  rgba(0,0,0,0.045);

  /* 文字階層與 hairline */
  --fg:       #1d1d1f;
  --fg-2:     #6e6e73;
  --muted:    #8e8e93;
  --muted-2:  #aeaeb2;
  --border:   rgba(0,0,0,0.07);
  --border-2: rgba(0,0,0,0.12);

  /* 語義色（Olive 預設，theme.js 覆寫） */
  --accent:       #8d9c00;
  --accent-hover: #6f7b00;
  --accent-2:     #aab54c;
  --accent-tint:  rgba(141,156,0,0.12);
  --accent-ring:  rgba(141,156,0,0.28);
  --selection-bg: rgba(141,156,0,0.20);
  --link:    #8d9c00;
  --success: #4E8C6A;
  --warning: #C99A3C;
  --danger:  #C0463C;
  --code-bg: #1a1c14;
  --code-fg: #e8ecdd;

  /* 字型與尺度 */
  --sans: "IBM Plex Sans", "Noto Sans TC", -apple-system, BlinkMacSystemFont,
          "Microsoft JhengHei", system-ui, sans-serif;
  --mono: "IBM Plex Mono", "SF Mono", ui-monospace, Menlo, monospace;
  --radius:    16px;
  --radius-md: 12px;
  --radius-sm: 8px;
  --spring: 0.35s cubic-bezier(0.34, 1.3, 0.64, 1);
}
```

- [ ] **Step 2: 驗證檔案存在且無語法錯**（用瀏覽器載入即驗，先以 grep 斷言關鍵 token）

```bash
grep -c -- "--glass-bg\|--accent\|--spring" style/v2/tokens.css
```
Expected: 數字 ≥ 8

- [ ] **Step 3: Commit**

```bash
git add style/v2/tokens.css
git commit -m "feat(v2): Liquid Glass design tokens"
```

---

### Task 2: script/theme.js — 主題引擎搬入與在地化

**Files:**
- Create: `script/theme.js`（來源：`/Users/jianmingxiu/cspanel_clone/noisy-waterfall-6ca5/web/theme.js`，183 行）

**Interfaces:**
- Produces: `window.CspanelTheme = { palettes, setTheme, openPicker, closePicker, getActiveId }`；CustomEvent `cspanel:themechange`（detail: `{id, name}`）；localStorage key `cspanel.theme.v1`。
- Consumes: Task 1 的 `:root` 變數名（theme.js `setProperty` 的目標）。

- [ ] **Step 1: 複製原檔**

```bash
cp /Users/jianmingxiu/cspanel_clone/noisy-waterfall-6ca5/web/theme.js script/theme.js
```

- [ ] **Step 2: 在地化改造（共 5 處，全部用 Edit 精準替換）**

(a) `const LS_KEY = 'tarkka.theme.v1';` → `const LS_KEY = 'cspanel.theme.v1';`

(b) `const DEFAULT_ID = 'iceland';` → `const DEFAULT_ID = 'olive';`

(c) 在 PALETTES 陣列**最前面**插入 Olive palette（沿用既有物件格式）：

```js
  { id: 'olive', name: 'Olive（經典）', group: 'cspanel 經典',
    bgBase: '#f2f3ec', mesh: ['#e9edda', '#eef0e3', '#e5e9d8'],
    accent: '#8d9c00', accentHover: '#6f7b00',
    success: '#4E8C6A', warning: '#C99A3C', danger: '#C0463C',
    tiers: ['#4E8C6A', '#8d9c00', '#4A6A93', '#C0463C'],
    code: ['#1a1c14', '#e8ecdd'] },
```

(d) 事件名 `'tarkka:themechange'` → `'cspanel:themechange'`（全檔 replace_all）。

(e) 公開 API `window.TarkkaTheme = {...}` → `window.CspanelTheme = {...}`（含檔內任何 `TarkkaTheme` 自我引用，全檔 replace_all）。

**保留不動**：`fetch('/api/me/preferences')` 與 `syncFromServer()`（GitHub Pages 上靜默失敗 → localStorage-only，spec 已定案）；picker 的 `tk-` class 前綴與注入樣式；`loadTheme(); syncFromServer();` 尾端立即執行。

- [ ] **Step 3: 驗證改造完整**

```bash
grep -n "tarkka" script/theme.js
```
Expected: 無輸出（tarkka 字樣全數改掉；若 palette 註解殘留 tarkka 字樣一併清除）

```bash
node --input-type=module -e "
const src = require('fs').readFileSync('script/theme.js','utf8');
new Function(src); console.log('syntax OK');
" 2>/dev/null || node -e "new Function(require('fs').readFileSync('script/theme.js','utf8')); console.log('syntax OK')"
```
Expected: `syntax OK`

- [ ] **Step 4: Commit**

```bash
git add script/theme.js
git commit -m "feat(v2): 主題引擎（62+1 組 palette，Olive 預設）"
```

---

### Task 3: style/v2/base.css — 背景、字型、防閃爍、全域文字

**Files:**
- Create: `style/v2/base.css`
- 參考（不修改）：`style/panel-all.css`（防閃爍選擇器清單）、`style/body.css` 行 14-25（舊全域字體）

**Interfaces:**
- Consumes: Task 1 全部 tokens。
- Produces: `html.auth-active` mesh 背景；placeholder 防閃爍（id 清單與舊檔完全一致）；全域 `body/button/textarea` 字體規則；`h2/h3/hr` 全域規則。

- [ ] **Step 1: 寫入 base.css（完整內容）**

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Noto+Sans+TC:wght@400;500;700&display=swap');

/* ===== 底盤 ===== */
html, body {
    min-width: 1700px; /* 佈局契約：不可變更 */
    background-color: var(--bg-base); /* 未登入底色，防止閃爍 */
    transition: background 0.8s ease-in-out;
}

/* 登入後 mesh gradient（取代舊綠粉漸層；!important 沿用舊檔壓過度機制） */
html.auth-active, body.auth-active {
    background-color: var(--bg-base) !important;
    background-image:
        radial-gradient(ellipse at 20% 20%, var(--bg-mesh-1) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, var(--bg-mesh-2) 0%, transparent 50%),
        radial-gradient(ellipse at 60% 30%, var(--bg-mesh-3) 0%, transparent 50%) !important;
    background-attachment: fixed !important;
}

/* ===== 全域文字（維持 13px/500 高密度） ===== */
body, button, textarea {
    font-family: var(--sans);
    font-size: 13px;
    position: relative;
    letter-spacing: 0.01em;
    z-index: 1;
    font-weight: 500;
    color: var(--fg);
}

b, h1, h2, h3, h4, h5, h6 { font-family: var(--sans); }

h2 { font-size: 18px; text-align: center; margin-bottom: 15px; }
h3 { margin-top: 0; margin-bottom: 5px; text-align: center; }
hr { border: 0; border-top: 1px solid var(--border); margin: 10px 0; }

::selection { background: var(--selection-bg); }

/* ===== 防閃爍：與舊 panel-all.css 逐字同構，僅搬家 ===== */
#roof-buttons-placeholder,
#tool-download-placeholder,
#optitle-placeholder,
#fudausearch-placeholder,
#auth-protected-tabs-placeholder,
#dt-panel-placeholder,
#consultant-panel-placeholder,
#assist-panel-placeholder,
#shrturl-placeholder,
#auth-protected-ip-placeholder,
#meeting-search-panel-placeholder,
.canned-panel {
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s ease, visibility 0.3s ease;
}

html.auth-active #roof-buttons-placeholder,
html.auth-active #tool-download-placeholder,
html.auth-active #optitle-placeholder,
html.auth-active #fudausearch-placeholder,
html.auth-active #auth-protected-tabs-placeholder,
html.auth-active #dt-panel-placeholder,
html.auth-active #consultant-panel-placeholder,
html.auth-active #assist-panel-placeholder,
html.auth-active #shrturl-placeholder,
html.auth-active #auth-protected-ip-placeholder,
html.auth-active #meeting-search-panel-placeholder,
html.auth-active .canned-panel {
    opacity: 1;
    visibility: visible;
}
```

- [ ] **Step 2: 接上預覽頁試看背景**：把 `panel_all.v2.html` `<head>` 中舊樣式 `<link>` 全組（font.css、body.css、button.css、DT_CSS.css、ipsearch_css.css、meeting-now-css.css、meeting-match-check.css、all-meeting.css、shrturl.css、report.css、panel-all.css）替換為：

```html
<link rel="stylesheet" href="style/v2/tokens.css">
<script src="script/theme.js"></script>
<link rel="stylesheet" href="style/v2/base.css">
```
（Font Awesome CDN 的 link 保留。之後 Task 4-8 逐步在此加回 v2 各檔。）

- [ ] **Step 3: 截圖驗證 mesh 背景**

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --screenshot=/tmp/gl-t3.png --window-size=1800,1200 \
  --virtual-time-budget=5000 \
  "http://localhost:8123/panel_all.v2.html"
```
用 Read 工具看 `/tmp/gl-t3.png`。Expected: 米橄欖色 mesh 漸層背景**不會出現**（未登入 auth-active 不存在，應為純 `--bg-base` 底 + 右下登入列）。再以 DevTools 概念驗證 auth 樣式存在：

```bash
grep -c "auth-active" style/v2/base.css
```
Expected: `26`（1 組背景 2 選擇器 + 12×2 placeholder）——實際數字以 grep 為準，重點是 >20。

- [ ] **Step 4: Commit**

```bash
git add style/v2/base.css panel_all.v2.html
git commit -m "feat(v2): base — mesh 背景、字型、防閃爍"
```

---

### Task 4: style/v2/panels.css — 玻璃面板卡（body.css 複製→轉換）

**Files:**
- Create: `style/v2/panels.css`（以 `style/body.css` 全文為底本複製後轉換）
- Modify: `panel_all.v2.html`（加 `<link rel="stylesheet" href="style/v2/panels.css">` 於 base.css 之後）

**Interfaces:**
- Consumes: tokens。
- Produces: 統一玻璃面板選擇器組；`.gl-chip--success` / `.gl-chip--warning`（Task 10 用）；modal 玻璃樣式（`#results-modal` 等）。

- [ ] **Step 1: 複製底本**

```bash
cp style/body.css style/v2/panels.css
```

- [ ] **Step 2: 逐條轉換（每條都是 Edit 的 old→new；幾何屬性全保留）**

(a) 刪除檔頭 `@import url('https://fonts.googleapis.com/...')` 與 `:root { --bdr-base...}` 區塊及其註解（tokens/base 已接手）。

(b) 刪除 `body, button, textarea {...}` 與 `b, h1, h2...{...}` 兩個字體區塊（base.css 已接手）。同樣刪除檔尾附近的全域 `h2 {...}`、`h3 {...}`、`hr {...}`（base.css 已接手）與全域 `textarea {...}`（Task 5 controls.css 接手）。

(c) **統一面板 block（核心置換）**——原：

```css
.roofbutton,
.tool_zip_dl,
.optitlepanel,
.idsearchpanel, .consultantlistgooglesheet, .ClassLogpanel, .DT_panel, .IPsearch_in_panelALL, .assist_googlesheet,
.linkout,
.temp2,
.board,
.meeting-now-search,
.meeting-check-search,
nav,
.fudausearch-container,
.panel-tab-content {
    background-color: white;
    border: 1px solid rgba(var(--bdr-rgb), 0.3);
    border-radius: 10px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1), 0 6px 20px rgb(184 205 215 / 61%);
    transition: border 0.3s ease, box-shadow 0.3s ease; 
}
```

新（選擇器清單保留並**追加 `.canned-panel`**；nav 移出清單、獨立處理見 (f)）：

```css
.roofbutton,
.tool_zip_dl,
.optitlepanel,
.idsearchpanel, .consultantlistgooglesheet, .ClassLogpanel, .DT_panel, .IPsearch_in_panelALL, .assist_googlesheet,
.linkout,
.temp2,
.board,
.meeting-now-search,
.meeting-check-search,
.fudausearch-container,
.canned-panel,
.panel-tab-content {
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur)) saturate(1.6);
    -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(1.6);
    border: 1px solid var(--glass-border);
    border-radius: 10px;
    box-shadow: var(--glass-shadow);
    transition: background var(--spring), border 0.3s ease, box-shadow 0.3s ease;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .roofbutton, .tool_zip_dl, .optitlepanel,
    .idsearchpanel, .consultantlistgooglesheet, .ClassLogpanel, .DT_panel,
    .IPsearch_in_panelALL, .assist_googlesheet,
    .linkout, .temp2, .board,
    .meeting-now-search, .meeting-check-search,
    .fudausearch-container, .canned-panel, .panel-tab-content {
        background: rgba(252, 253, 250, 0.97);
    }
}
```

(d) **hover 呼吸燈置換**——刪除 `@keyframes border-breathe`；原 hover block 改為：

```css
.idsearchpanel:hover, .consultantlistgooglesheet:hover, .ClassLogpanel:hover, .DT_panel:hover,
.IPsearch_in_panelALL:hover,.assist_googlesheet:hover,.optitlepanel:hover,
.fudausearch-container:hover,.roofbutton:hover,.meeting-check-search:hover,
.meeting-now-search:hover,.tool_zip_dl:hover,.linkout:hover,.canned-panel:hover{
    background: var(--glass-bg-hover);
    border-color: color-mix(in srgb, var(--accent) 35%, var(--glass-border));
}
```

(e) **gradient text 置換**（禁令）——刪除 `.yellow-gradient-text`、`.green-gradient-text`、`.gradient-text:hover`、`@keyframes gradient-animation` 四段，原位置寫入：

```css
/* 語義色點 + 純色文字（取代漸層字；DESIGN.md: no gradient text） */
.gl-chip--success, .gl-chip--warning {
    color: var(--fg);
    font-weight: 600;
}
.gl-chip--success::before, .gl-chip--warning::before {
    content: "";
    display: inline-block;
    width: 7px; height: 7px;
    border-radius: 50%;
    margin-right: 4px;
    vertical-align: 1px;
}
.gl-chip--success::before { background: var(--success); }
.gl-chip--warning::before { background: var(--warning); }
.gl-chip--success:hover, .gl-chip--warning:hover { color: var(--accent-hover); }
```

(f) **nav（會議三頁籤）**——`nav {...}` 內 `background-color: fff;` 改 `background: transparent; border: none; box-shadow: none;`（nav 已移出統一玻璃清單）；`nav a` 的 `color: #90a8b680` → `color: var(--muted)`；`nav a.active` 的 `color: black` → `color: var(--fg)`；三個 `.start-*` / `.active~.animation` 的 `background-color: #ffffff; box-shadow: inset 0 0 8px rgba(0,0,0,0.3);` 全改 `background: var(--elevated); box-shadow: 0 1px 4px rgba(0,0,0,0.08);`。

(g) **panel-tabs（受保護頁籤）**——`.panel-tabs label` 改：

```css
.panel-tabs label {
    padding: 5px 10px;
    color: var(--muted);
    background: color-mix(in srgb, var(--glass-bg) 55%, transparent);
    border: 1px solid var(--glass-border);
    border-bottom: none;
    border-radius: 10px 10px 0px 0px;
    cursor: pointer;
    order: 0;
    transition: background var(--spring), color 0.15s;
}
.panel-tabs label:hover { background: var(--glass-bg-hover); color: var(--fg-2); }
.panel-tabs input[type="radio"]:checked + label {
    color: var(--accent-hover);
    background: var(--glass-bg-hover);
    border: 1px solid var(--glass-border);
    border-bottom: none;
    box-shadow: none;
    font-weight: 600;
}
```
（原 label 的 `box-shadow: 0 4px 8px...` 移除；`:checked + label + .panel-tab-content { display: block; }` 機制保留不動。）

(h) **modal 三組**——`#results-modal`、`#zv-metting-list-results-modal`、`#vvgglesht_modal` 的 scrim 統一改 `background-color: rgba(15,18,20,0.45); backdrop-filter: blur(6px);`（原 0.7/blur5px）；`#modal-content`、`#zv-metting-list-modal-content`、`#vvgglesht_modal-content` 的實底改玻璃：

```css
    background: var(--glass-bg-hover);
    backdrop-filter: blur(40px) saturate(1.8);
    -webkit-backdrop-filter: blur(40px) saturate(1.8);
    border: 1px solid var(--glass-border);
    border-radius: 20px;
    box-shadow: 0 30px 80px rgba(0,0,0,0.3);
```
（各自的 margin/width/max-width/height/overflow 保留原值；`#modal-content` 原 `border-radius: 8px` 與 `#zv...` 原 `10px` 一律升為 `20px`——圓角是表皮不是幾何。）modal 進場動畫改 spring：`animation: slideIn 0.2s ease` → `animation: gl-modal-rise 0.42s cubic-bezier(0.22,1,0.36,1)`，並新增：

```css
@keyframes gl-modal-rise {
    0%   { opacity: 0; transform: translateY(12px) scale(0.95); }
    62%  { opacity: 1; transform: translateY(-1.8px) scale(1.017); }
    100% { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
    #modal-content, #zv-metting-list-modal-content, #vvgglesht_modal-content { animation: none; }
}
```

(i) **zv 藍色按鈕**——`#zv-metting-list-format-btn, #zv-metting-list-copy-btn` 區塊：`background-color: #007aff` → `background: var(--accent)`；`border-radius: 12px` 保留；`box-shadow` → `0 1px 3px var(--accent-ring)`；`transition` → `background var(--spring), transform var(--spring)`；hover `#005fdb` → `var(--accent-hover)`（陰影行刪除）；active `#004bb5` block → `transform: scale(0.96);`。

(j) **其餘散點**（按全域對應表）：`.update-header`（`color:#888888`→`var(--muted)`；`background: rgba(255,255,255,0.5)`→`var(--glass-bg)`，加 `backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-radius: 0 0 0 10px;`）；`#copyMessage` `#ff0000`→`var(--danger)`；`#optitleoutput` `#737373`→`var(--fg-2)`；`.appicon` `background-color: white`→`background: transparent`；`.conflict` 系列 `#ffecec`/`#f5c6cb`→`color-mix(in srgb, var(--danger) 10%, white)` / `color-mix(in srgb, var(--danger) 30%, white)`、內文 `#555`→`var(--fg-2)`；`.conflict-card` `#f9f9f9`/`#ddd`/陰影→`var(--bg-soft)`/`var(--border)`/`0 2px 12px rgba(0,0,0,0.06)`；`.fudausearch-suggestions` `#fff`/`#ccc`→`var(--elevated)`/`var(--border-2)` 加 `border-radius: 10px; backdrop-filter: blur(20px) saturate(1.6); -webkit-backdrop-filter: blur(20px) saturate(1.6);`；`.fudausearch-suggestion-item:hover` `#f0f0f0`→`var(--accent-tint)`；`.zv-metting-list:hover` `#bdbdbd`→`var(--muted)`；`.close`/`#zv-metting-list-close-btn`/`#vvgglesht_close-btn` 的 `#333`→`var(--fg-2)`、hover `#000`/`#ff0000`→`var(--fg)`/`var(--danger)`；Excalidraw 區塊（`.layer-ui__wrapper__footer-left` 等）原樣保留。

- [ ] **Step 3: 掛上預覽頁並截圖**：`panel_all.v2.html` 的 base.css link 後加 `<link rel="stylesheet" href="style/v2/panels.css">`，重跑 Task 3 Step 3 截圖指令（輸出 `/tmp/gl-t4.png`）並 Read 檢查無爆版。

- [ ] **Step 4: grep 斷言無殘留舊語彙**

```bash
grep -n "bdr-rgb\|bdr-base\|border-breathe\|gradient-text\|#007aff\|184 205 215" style/v2/panels.css
```
Expected: 無輸出

- [ ] **Step 5: Commit**

```bash
git add style/v2/panels.css panel_all.v2.html
git commit -m "feat(v2): panels — 玻璃面板卡、tabs、nav、modals"
```

---

### Task 5: style/v2/controls.css — 控件語彙（button.css 複製→轉換）

**Files:**
- Create: `style/v2/controls.css`（以 `style/button.css` 為底本）
- Modify: `panel_all.v2.html`（panels.css 後加 link）

**Interfaces:**
- Consumes: tokens。
- Produces: 全域 `button`/`input`/`select`/`textarea` 新語彙（伺服器注入內容的保底樣式）。

- [ ] **Step 1: 複製底本**

```bash
cp style/button.css style/v2/controls.css
```

- [ ] **Step 2: 逐條轉換**

(a) 刪除 `:root {...}` 區塊。

(b) **全域 button**——原 macOS 灰底整段改為：

```css
button {
    background: rgba(255,255,255,0.55);
    color: var(--fg);
    padding: 3px 8px;
    border: 1px solid var(--border-2);
    border-radius: 9px;
    cursor: pointer;
    transition: background var(--spring), border-color 0.15s, transform var(--spring);
    line-height: 1.5;
    font-size: 13px;
}
button:hover {
    background: var(--glass-bg-hover);
    border-color: var(--accent);
}
button:active {
    background: var(--accent-tint);
    color: var(--fg);
    transform: scale(0.96);
}
@media (prefers-reduced-motion: reduce) {
    button, button:active { transform: none; }
}
```

(c) **輸入框家族**（`input[type=text|password|email]`、`input[type=date]`、`input[type=datetime-local]`、`select`、`textarea`——含 button.css 與 body.css 的 textarea 合併於此）統一語彙，保留各自的 width/padding/margin/display 幾何：

```css
/* 以 input[type=text] 為例；date/datetime-local/select/textarea 同樣置換色彩部分 */
input[type=text], input[type=password], input[type=email] {
    color: var(--fg);
    width: 100%;
    padding: 4px 8px;
    margin: 0;
    display: inline-block;
    border: 1px solid rgba(0,0,0,0.1);
    border-radius: 8px;
    box-sizing: border-box;
    background: rgba(0,0,0,0.04);
    line-height: 1.5;
    font-family: var(--sans);
    font-size: 13px;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}
input[type=text]:focus, input[type=password]:focus, input[type=email]:focus {
    background: #fff;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-ring);
    color: var(--fg);
    outline: none;
}
```
規則：原 `color:#8f8f8f`→`var(--fg)`（placeholder 交給 `::placeholder`，補一條 `::placeholder { color: var(--muted); }`）；原 `border:#e6e6e6`→`rgba(0,0,0,0.1)`；原 `box-shadow: inset...`→移除；原 focus `border #949494 !important`→上述 accent ring（`!important` 全部移除）；`border-radius: 4px`→`8px`。`select` 與 `textarea`、`date`、`datetime-local` 比照辦理（保留 `resize: vertical`、`::-webkit-datetime-edit` 區塊改 `color: var(--muted)`、`filter: invert(0.5)` 保留）。

(d) **語義按鈕**——`.DienMing`：`background-color:#daf5cc`→`background: color-mix(in srgb, var(--success) 14%, white)`、`border:#bfbfbf`→`1px solid color-mix(in srgb, var(--success) 35%, white)`、hover `#93d470`→`color-mix(in srgb, var(--success) 28%, white)`、active `#9cba8c`→`color-mix(in srgb, var(--success) 40%, white)`；`.deactiveDienMing`（兩處定義都改）：`#ffe6d7`→`color-mix(in srgb, var(--warning) 14%, white)`、hover `#f2b794`→`color-mix(in srgb, var(--warning) 28%, white)`、active `#c7a18b`→`color-mix(in srgb, var(--warning) 40%, white)`；button.css 內重複的第二個 `.DienMing` 定義區塊刪除（原檔就重複）。

(e) **其餘散點**：`.fudausearch-button.copied` `#28a745`→`var(--success)`；`.IP_info-button` `#949494`→`var(--muted)`、hover `#5c5c5c`→`var(--fg-2)`；`.fudausearch-clear-btn` `#aaa`→`var(--muted)`、hover `#000`→`var(--fg)`；`#meetingsearch-refresh-btn:hover` `#bdbdbd`→`var(--muted)`；`.hover-overlay` `rgba(255,255,255,0.5)`→`var(--glass-bg)`（其 `backdrop-filter: blur(20px)` 已有，保留）；部門色按鈕四組（special/paikezu/kefugon/groupnumber）**原樣不動**。

- [ ] **Step 3: 掛上預覽頁 + grep 斷言**

```bash
grep -n "bdr-rgb\|#f0f0f0\|#949494\|inset 0 1px 4px\|!important" style/v2/controls.css
```
Expected: 無輸出

- [ ] **Step 4: Commit**

```bash
git add style/v2/controls.css panel_all.v2.html
git commit -m "feat(v2): controls — 按鈕/輸入框 Liquid Glass 語彙"
```

---

### Task 6: overlays.css + fireworkeffect.js — 登入列、toast、主題入口

**Files:**
- Create: `style/v2/overlays.css`
- Modify: `script/fireworkeffect.js`（登入列 class 化、toast tokens 化、加主題按鈕）
- Modify: `panel_all.v2.html`（controls.css 後加 overlays.css link）

**Interfaces:**
- Consumes: tokens；`window.CspanelTheme.openPicker`（Task 2）。
- Produces: `.fw-bar` / `.fw-bar-content` / `.fw-bar.logged-in` class 組；toast 樣式仍由 JS 注入但只引用 tokens。
- **行為契約**：既有元素 id 全部保留（`firebase-login-bar`、`firebase-login-bar-content`、`firebase-login-bar-email`…）；`updateUIState` 的 display 切換邏輯保留；事件 dispatch 順序不動。

- [ ] **Step 1: 寫入 overlays.css（完整內容）**

```css
/* ===== 登入列（fireworkeffect.js 注入的 DOM；樣式自 inline 收斂至此） ===== */
#firebase-login-bar {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 9999;
}
#firebase-login-bar-content {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--glass-bg-hover);
    backdrop-filter: blur(28px) saturate(1.8);
    -webkit-backdrop-filter: blur(28px) saturate(1.8);
    border: 1px solid var(--glass-border);
    border-radius: 999px;
    padding: 8px 16px;
    box-shadow: var(--glass-shadow);
    transition: background var(--spring), border-color 0.3s, box-shadow 0.3s, padding 0.3s;
}
#firebase-login-bar.logged-in #firebase-login-bar-content {
    background: color-mix(in srgb, var(--success) 10%, rgba(255,255,255,0.82));
    border-color: color-mix(in srgb, var(--success) 30%, var(--glass-border));
    justify-content: center;
    padding: 8px 12px;
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    #firebase-login-bar-content { background: rgba(252,253,250,0.97); }
}
#firebase-login-bar-status { flex: 1; color: var(--fg-2); font-size: 15px; }
#firebase-login-bar input[type=email],
#firebase-login-bar input[type=password] {
    font-size: 13px;
    padding: 2px 6px;
    border-radius: 8px;
    width: 110px;
}
#firebase-login-bar input[type=password] { width: 80px; }
#firebase-login-bar-btn {
    font-size: 18px;
    color: var(--accent);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, transform var(--spring);
}
#firebase-login-bar-btn:hover { color: var(--accent-hover); }
#firebase-login-bar-btn:active { transform: scale(0.92); }
#firebase-logout-bar-btn {
    font-size: 18px;
    color: var(--muted);
    cursor: pointer;
    align-items: center;
    justify-content: center;
    transition: color 0.15s;
}
#firebase-logout-bar-btn:hover { color: var(--danger); }
#fw-theme-btn {
    font-size: 15px;
    color: var(--muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, transform var(--spring);
}
#fw-theme-btn:hover { color: var(--accent); }
#fw-theme-btn:active { transform: scale(0.92); }
.fw-status-ok { color: var(--success); }
@media (prefers-reduced-motion: reduce) {
    #firebase-login-bar-btn:active, #fw-theme-btn:active { transform: none; }
}
```

- [ ] **Step 2: 改寫 fireworkeffect.js 登入列模板（行 93-111 的 `panelHtml`）**——inline style 全移除、加主題按鈕：

```javascript
  const panelHtml = `
    <div id="firebase-login-bar">
      <form id="firebase-login-form" autocomplete="on">
        <div id="firebase-login-bar-content">
          <div id="firebase-login-bar-status">
            <span id="firebase-login-bar-message"><i class="fa-solid fa-right-to-bracket"></i></span>
          </div>
          <input type="email" id="firebase-login-bar-email" name="email" placeholder="Email" autocomplete="username">
          <input type="password" id="firebase-login-bar-password" name="password" placeholder="密碼" autocomplete="current-password">
          <button type="submit" id="firebase-login-bar-submit" style="display:none;" aria-hidden="true"></button>
          <i id="firebase-login-bar-btn" class="fa-solid fa-play" role="button" tabindex="0" aria-label="登入"></i>
          <i id="firebase-logout-bar-btn" class="fa-solid fa-right-to-bracket" style="display:none;" role="button" tabindex="0" aria-label="登出"></i>
          <i id="fw-theme-btn" class="fa-solid fa-palette" role="button" tabindex="0" aria-label="配色主題" title="配色主題"></i>
        </div>
      </form>
    </div>
  `;
```
（`display:none` 的兩處保留——那是行為不是視覺。）並在 `insertAdjacentHTML` 之後綁定主題按鈕：

```javascript
  const themeBtn = document.getElementById('fw-theme-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => { window.CspanelTheme && window.CspanelTheme.openPicker(); });
  }
```

- [ ] **Step 3: 改寫 `updateUIState(isLoggedIn)`（行 144-191）**——刪除所有外觀類 `.style.*` 寫入（background/borderColor/boxShadow/minWidth/maxWidth/justifyContent/padding/position/right/bottom/zIndex），改為 class 切換；**保留** display/flex 切換與 statusMsg 內容：

```javascript
  function updateUIState(isLoggedIn) {
    const bar = document.getElementById('firebase-login-bar');
    const barContent = document.getElementById('firebase-login-bar-content');
    const barStatus = document.getElementById('firebase-login-bar-status');
    const emailInput = document.getElementById('firebase-login-bar-email');
    const pwdInput = document.getElementById('firebase-login-bar-password');
    const loginBtn = document.getElementById('firebase-login-bar-btn');
    const logoutBtn = document.getElementById('firebase-logout-bar-btn');
    const statusMsg = document.getElementById('firebase-login-bar-message');
    if (!bar || !barContent) return;
    bar.classList.toggle('logged-in', !!isLoggedIn);
    if (isLoggedIn) {
      emailInput.style.display = 'none';
      pwdInput.style.display = 'none';
      loginBtn.style.display = 'none';
      logoutBtn.style.display = '';
      statusMsg.innerHTML = '<i class="fa-solid fa-circle-check fw-status-ok"></i>';
      statusMsg.style.display = '';
      barStatus.style.display = '';
      barStatus.style.flex = '1';
    } else {
      emailInput.style.display = '';
      pwdInput.style.display = '';
      loginBtn.style.display = '';
      logoutBtn.style.display = 'none';
      statusMsg.style.display = 'none';
      barStatus.style.display = 'none';
      barStatus.style.flex = '0';
    }
  }
```
另外行 268/275 的 `loginBtn.style.color = '#2d8cf0'` → `''`（清空回 CSS 值）、`'#e74c3c'` → `'var(--danger)'`。

- [ ] **Step 4: 改寫 toast 樣式字串（行 3-45 `toastStyles`）**——注入機制保留，內容 tokens 化：

```javascript
  const toastStyles = `
    #firework-toast-container {
      position: fixed;
      left: 20px;
      bottom: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column-reverse;
      gap: 8px;
      pointer-events: none;
    }
    .firework-toast {
      background: var(--elevated);
      backdrop-filter: blur(20px) saturate(1.6);
      -webkit-backdrop-filter: blur(20px) saturate(1.6);
      color: var(--fg);
      padding: 12px 20px;
      border-radius: 12px;
      border: 1px solid var(--glass-border);
      font-size: 14px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      opacity: 0;
      transform: translateX(-20px);
      transition: opacity var(--spring), transform var(--spring);
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .firework-toast.show {
      opacity: 1;
      transform: translateX(0);
    }
    .firework-toast::before {
      content: "";
      width: 8px; height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--accent);
    }
    .firework-toast.success::before { background: var(--success); }
    .firework-toast.error::before   { background: var(--danger); }
    .firework-toast.warning::before { background: var(--warning); }
    .firework-toast.info::before    { background: var(--accent); }
    @media (prefers-reduced-motion: reduce) {
      .firework-toast { transition: opacity 0.2s ease; transform: none; }
    }
  `;
```

- [ ] **Step 5: 截圖驗證登入列**（重跑截圖指令輸出 `/tmp/gl-t6.png`，Read 檢查：膠囊玻璃登入列 + 調色盤圖示）；grep 斷言：

```bash
grep -n "2d8cf0\|#b7f5c2\|#d2f5e3\|linear-gradient(135deg, #2ecc71" script/fireworkeffect.js
```
Expected: 無輸出

- [ ] **Step 6: Commit**

```bash
git add style/v2/overlays.css script/fireworkeffect.js panel_all.v2.html
git commit -m "feat(v2): 登入列/toast 玻璃化、主題切換入口"
```

---

### Task 7: ui-conductor-v2.js 主題對接 + 清理舊版

**Files:**
- Modify: `script/ui-conductor-v2.js`（行 18-19、行 121-124 附近）
- Delete: `script/ui-conductor.js`、`script/ui-conductor-v3.js`（未被任何頁面引用；先 grep 確認）

- [ ] **Step 1: 確認舊版無引用**

```bash
grep -rn "ui-conductor\.js\|ui-conductor-v3" --include="*.html" --include="*.js" . | grep -v "ui-conductor-v2" | grep -v "^\./script/ui-conductor"
```
Expected: 無輸出（若有輸出，保留該檔並記錄，不刪）

- [ ] **Step 2: 三根色對接 tokens**——`initUIInfrastructure` CSS 字串內：

原：
```css
      --ui-accent: #642800;   /* 主色：Spinner / 光束 / 粒子 */
      --ui-surface: #f0f5f1;  /* 底色：遮罩背景基調     */
      --ui-text:    #8b6464;  /* 文字：狀態文字色        */
```
新：
```css
      --ui-accent: var(--accent, #8d9c00);   /* 主色：跟隨主題 */
      --ui-surface: var(--bg-base, #f2f3ec); /* 底色：跟隨主題 */
      --ui-text:    var(--fg-2, #6e6e73);    /* 文字：跟隨主題 */
```

- [ ] **Step 3: 預遮罩底色**——行 18-19：

```javascript
const OVERLAY_BACKGROUND = 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)';
```
改為（CSS 變數尚未保證載入前的安全中性值，與 Olive bg-base 同調）：

```javascript
const OVERLAY_BACKGROUND = 'linear-gradient(135deg, #f6f7f1 0%, #eceee3 100%)';
```

- [ ] **Step 4: 刪除舊版檔案 + Commit**

```bash
git rm script/ui-conductor.js script/ui-conductor-v3.js
git add script/ui-conductor-v2.js
git commit -m "feat(v2): 登入轉場對接主題三根色；移除未引用的 conductor v1/v3"
```

---

### Task 8: style/v2/features/ — 七個面板 CSS 複製→轉換

**Files:**
- Create: `style/v2/features/DT_CSS.css`、`ipsearch_css.css`、`meeting-now-css.css`、`meeting-match-check.css`、`all-meeting.css`、`shrturl.css`、`report.css`（各以 `style/` 同名檔為底本）
- Modify: `panel_all.v2.html`（overlays.css 後依原順序加 7 個 link）

**Interfaces:**
- Consumes: tokens + 全域色彩轉換對應表。

- [ ] **Step 1: 複製七檔**

```bash
mkdir -p style/v2/features
for f in DT_CSS ipsearch_css meeting-now-css meeting-match-check all-meeting shrturl report; do
  cp "style/$f.css" "style/v2/features/$f.css"
done
```

- [ ] **Step 2: 逐檔按全域對應表轉換**。每檔處理方式相同：找出所有色彩/陰影/字族字面值 → 按表替換；幾何屬性不動。特別點名：
  - `meeting-now-css.css`：`.meetingsearch-進行中 strong::before` 等四個狀態圓點——進行中→`var(--success)`、即將開始→`var(--warning)`、等待中→`var(--muted)`、已結束→`var(--muted-2)`（若原檔語義色與此不同，以語義對應為準，不逐字保留原色）。
  - `all-meeting.css`：`#all-meeting-search-container` `background-color:#f1f1f1; border-radius:20px` → `background: var(--bg-soft); border-radius: 999px;`（搜尋膠囊）。
  - `ipsearch_css.css`（786 行、最大檔）：`.ip-badge--low/medium/high/unknown`、`.confidence-*`、`.access-type-*`、`.ip-tag--*` 等語義徽章按語義對應：low/normal→`var(--success)`、medium/mobile→`var(--warning)`、high/vpn/datacenter→`var(--danger)`、unknown→`var(--muted)`（一律用 `color-mix(in srgb, <語義色> 14%, white)` 做底、語義色原色做字）；tooltip 浮層底色→`var(--elevated)` + `border: 1px solid var(--border-2)` + `backdrop-filter: blur(20px) saturate(1.6)`（含 -webkit-）。
  - `DT_CSS.css`：`.error` 紅字→`var(--danger)`；`.output`/`.copy-feedback` 綠字→`var(--success)`；捲軸樣式按表。
  - `report.css`（18 行）：只有 font-size，無色彩——原樣複製即可。

- [ ] **Step 3: grep 斷言（逐檔跑）**

```bash
grep -rn "#ddd\|#ccc\|#f0f0f0\|#f1f1f1\|#007aff\|#4caf50\|#28a745" style/v2/features/
```
Expected: 無輸出

- [ ] **Step 4: 掛上預覽頁（7 個 link）+ 截圖確認無爆版 + Commit**

```bash
git add style/v2/features/ panel_all.v2.html
git commit -m "feat(v2): 七個面板 CSS 對齊 tokens"
```

---

### Task 9: JS 模組視覺樣式收斂

**Files:**
- Modify: `script/dragb_msg_pnl.js`、`script/meeting-match-check.js`、`script/meeting-now-includefetch.js`、`script/meeting-search-panel-module.js`、`script/zv-listing-script.js`、`script/cpcast.js`、`script/toggle-panels.js`、`script/shrturl.js`、`script/optitleGG.js`（僅視覺常數；display/position 切換一律不動）

**原則：** `.style.xxx = '<色碼>'` → `.style.xxx = 'var(--token)'`（最小侵入）；模板字串內 `style="...色碼..."` 同樣改為 `var()`。**只改下列清單，其餘 inline style 一律不碰**：

- [ ] **Step 1: 逐項替換（檔:行 → 改法）**

| 位置 | 原 | 新 |
|---|---|---|
| dragb_msg_pnl.js:491,579 | `<p style="color:red;">` | `<p style="color:var(--danger);">` |
| dragb_msg_pnl.js:567 | `border:1px solid #e5e7eb` 與 `background:${chat.status==='open'?'#d1fae5':'#e5e7eb'};color:${chat.status==='open'?'#065f46':'#374151'}` | `border:1px solid var(--border-2)`；background 三元 → `'color-mix(in srgb, var(--success) 14%, white)'` : `'var(--bg-soft)'`；color 三元 → `'var(--success)'` : `'var(--fg-2)'` |
| meeting-match-check.js:227 | `resultDiv.style.color = 'green'` | `'var(--success)'` |
| meeting-match-check.js:304-310 | 白字紅底/綠框 labelElement | 紅組：`color='#fff'`→保留、`backgroundColor='rgb(207,4,4)'`→`'var(--danger)'`、`border='1px solid rgb(207, 4, 4)'`→`'1px solid var(--danger)'`；綠組：`color`→`'var(--success)'`、`border`→`'1px solid var(--success)'` |
| meeting-match-check.js:339 | `hr.style.border = '1px solid #ccc'` | `'1px solid var(--border)'` |
| meeting-match-check.js:392 | `accountSpan.style.color = 'gray'` | `'var(--muted)'` |
| meeting-now-includefetch.js:466-472 | `color: #666` ×3 | `color: var(--fg-2)` |
| meeting-now-includefetch.js:922,925 | `color: #666` / `color: #333` | `var(--fg-2)` / `var(--fg)` |
| meeting-now-includefetch.js:944-969 | accountSpan `gray/blue/green/red` | `'var(--muted)'` / `'var(--accent)'` / `'var(--success)'` / `'var(--danger)'` |
| meeting-search-panel-module.js:138 | `color:#4caf50` | `color:var(--success)` |
| meeting-search-panel-module.js:427,500-530 | `#4CAF50`/`green`/`red`/`blue`/`gray` | `var(--success)`/`var(--success)`/`var(--danger)`/`var(--accent)`/`var(--muted)` |
| zv-listing-script.js:53 | `'#4CAF50'` | `'var(--success)'` |
| cpcast.js:29 | `'#4caf50'` | `'var(--success)'` |
| toggle-panels.js:50,114 | `style="background: white;"` | `style="background: var(--elevated);"` |
| shrturl.js（模板內若有灰字色碼） | 按對應表 | 按對應表 |

- [ ] **Step 2: grep 驗證清單內色碼歸零**

```bash
grep -n "rgb(207, 4, 4)\|rgb(34, 154, 22)\|'#4caf50'\|'#4CAF50'\|color:red\|= 'gray'\|= 'blue'\|= 'green'\|= 'red'" script/dragb_msg_pnl.js script/meeting-match-check.js script/meeting-now-includefetch.js script/meeting-search-panel-module.js script/zv-listing-script.js script/cpcast.js
```
Expected: 無輸出

- [ ] **Step 3: Commit**

```bash
git add script/
git commit -m "feat(v2): JS 模組視覺常數改用 design tokens"
```

---

### Task 10: 漸層字置換（optitleGG.js → 語義色點 chip）

**Files:**
- Modify: `script/optitleGG.js:411,422`（class 名替換；`.gl-chip--*` 樣式已於 Task 4 (e) 建立）

- [ ] **Step 1: 兩處 className 替換**

```js
// 行 411 原:
consultantSpan.className = 'green-gradient-text copyable-text';
// 改:
consultantSpan.className = 'gl-chip--success copyable-text';

// 行 422 原:
leaderSpan.className = 'yellow-gradient-text copyable-text';
// 改:
leaderSpan.className = 'gl-chip--warning copyable-text';
```

- [ ] **Step 2: 全 repo 斷言漸層字歸零（v2 範圍）**

```bash
grep -rn "gradient-text" script/ style/v2/
```
Expected: 無輸出

- [ ] **Step 3: Commit**

```bash
git add script/optitleGG.js
git commit -m "feat(v2): 漸層字改語義色點（no gradient text）"
```

---

### Task 11: cspanel_netlify 注入區塊加 class（跨 repo，僅 markup）

> **執行時裁定（取代本 task 原做法）**：實查發現 tabsHTML/ipHTML 存於 Firestore `protectedContent/tabsAndIP`，由 order-tool-api 原樣回傳，程式碼中無 markup 生成處。故改為 **cspanel 端注入後動態補 class**：`script/auth-protected-tabs.js` 在 `innerHTML` 賦值後，對注入容器加 `gl-injected`、其內 `table` 加 `gl-table`（`querySelectorAll` 迴圈），token/fetch/401 重試邏輯不動。cspanel_netlify **零修改**，部署順序問題消失。Step 3 的 .gl-injected CSS 照常加入 panels.css。

**Files:**
- Modify: `/Users/jianmingxiu/cspanel_clone/cspanel_netlify/netlify/edge-functions/` 中產生 `tabsHTML` / `ipHTML` 的檔案（`order-tool-api` 相關；先以 `grep -rn "tabsHTML\|ipHTML" netlify/` 定位）
- Modify: `style/v2/panels.css`（cspanel 端補 `.gl-injected` 精修樣式）

**約束：只加 `class` 屬性與（若必要）包裹用 `<div class>`，不得動文字內容、資料欄位、邏輯、驗證。** cspanel_netlify 也是 git repo：在該 repo 開分支 `redesign/liquid-glass-classes` 提交，**不 push**（切換日與 cspanel 一起上，netlify 先推）。

- [ ] **Step 1: 定位並閱讀注入 markup 產生處**

```bash
cd /Users/jianmingxiu/cspanel_clone/cspanel_netlify && git checkout -b redesign/liquid-glass-classes
grep -rn "tabsHTML\|ipHTML" netlify/ | head -20
```

- [ ] **Step 2: 在產生的頂層容器與重複單元上加 class**：頂層容器加 `gl-injected`；表格加 `gl-table`；tab 單元加 `gl-tab`。不改其他屬性。若 markup 內有 inline style 色碼，按全域對應表改為 `var()`（值會由 cspanel 頁面的 tokens 提供）。

- [ ] **Step 3: cspanel 端補精修樣式（append 到 style/v2/panels.css 尾端）**

```css
/* ===== 伺服器注入內容（cspanel_netlify tabsHTML/ipHTML）精修 ===== */
.gl-injected { color: var(--fg); }
.gl-injected .gl-table { border-collapse: collapse; width: 100%; }
.gl-injected .gl-table th {
    color: var(--fg-2);
    font-weight: 600;
    border-bottom: 1px solid var(--border-2);
    padding: 4px 8px;
    text-align: left;
}
.gl-injected .gl-table td {
    border-bottom: 1px solid var(--border);
    padding: 4px 8px;
}
.gl-injected .gl-table tr:hover td { background: var(--accent-tint); }
.gl-injected a { color: var(--link); }
```
（實際選擇器以 Step 1 讀到的 markup 結構為準微調；上表為預設結構的樣式。）

- [ ] **Step 4: 兩邊各自 commit**

```bash
cd /Users/jianmingxiu/cspanel_clone/cspanel_netlify && git add -A && git commit -m "feat: 注入 markup 加 Liquid Glass class（樣式由 cspanel v2 提供，舊 CSS 下無視覺影響）"
cd /Users/jianmingxiu/cspanel_clone/cspanel && git add style/v2/panels.css && git commit -m "feat(v2): 伺服器注入內容精修樣式"
```

---

### Task 12: panel_all.html 正式切換

**Files:**
- Modify: `panel_all.html`（head 樣式組替換）
- Delete: `panel_all.v2.html`

- [ ] **Step 1: 替換 head**——舊 11 個 `<link>`（font.css、body.css、button.css、DT_CSS.css、ipsearch_css.css、meeting-now-css.css、meeting-match-check.css、all-meeting.css、shrturl.css、report.css、panel-all.css）整組替換為（Font Awesome CDN link 位置保留原處）：

```html
<link rel="stylesheet" href="style/v2/tokens.css">
<script src="script/theme.js"></script>
<link rel="stylesheet" href="style/v2/base.css">
<link rel="stylesheet" href="style/v2/panels.css">
<link rel="stylesheet" href="style/v2/controls.css">
<link rel="stylesheet" href="style/v2/overlays.css">
<link rel="stylesheet" href="style/v2/features/DT_CSS.css">
<link rel="stylesheet" href="style/v2/features/ipsearch_css.css">
<link rel="stylesheet" href="style/v2/features/meeting-now-css.css">
<link rel="stylesheet" href="style/v2/features/meeting-match-check.css">
<link rel="stylesheet" href="style/v2/features/all-meeting.css">
<link rel="stylesheet" href="style/v2/features/shrturl.css">
<link rel="stylesheet" href="style/v2/features/report.css">
```
注意：**舊 style/*.css 檔案保留不刪**（12 個獨立頁第二期仍引用它們，例如 DT_report.html 用 DT_CSS.css）。

- [ ] **Step 2: 刪預覽頁 + 斷言**

```bash
git rm panel_all.v2.html
grep -n "style/v2\|theme.js" panel_all.html
```
Expected: 13 行 v2 link + 1 行 theme.js

- [ ] **Step 3: Commit**

```bash
git add panel_all.html
git commit -m "feat(v2): panel_all.html 切換至 Liquid Glass 樣式組"
```

---

### Task 13: 驗證清單（spec 第 6 節）與驗收交付

- [ ] **Step 1: 未登入截圖**（`panel_all.html`，1800×1200）：登入列玻璃膠囊、`--bg-base` 底色、無舊漸層。
- [ ] **Step 2: 靜態語彙抽查**：以 headless Chrome 分別加 `?`（無參數）截圖存 `/tmp/gl-final-1.png`；用 Read 檢視。
- [ ] **Step 3: grep 總斷言**

```bash
cd /Users/jianmingxiu/cspanel_clone/cspanel
grep -rn "bdr-rgb\|border-breathe\|gradient-text" style/v2/ script/ panel_all.html
grep -rn "tarkka" script/theme.js
```
Expected: 全部無輸出

- [ ] **Step 4: 產出驗收報告**（截圖 + 變更摘要 + 「使用者需登入後人工驗證」清單：登入轉場、各面板互動、tabsHTML/ipHTML 注入、5 組主題切換、prefers-reduced-motion、Google Sheet iframe 面板可讀性）呈給使用者。
- [ ] **Step 5（使用者核可後才執行）：** push cspanel_netlify 分支合併 main → 確認 netlify 部署 → cspanel `git checkout main && git merge redesign/liquid-glass && git push` → 線上驗證 https://dasawada.github.io/cspanel/ 。

---

## Self-Review 紀錄

- Spec 覆蓋：§2.1-2.4→Task 1/2/4/5/6/10；§3.1→Task 1-8；§3.2→Task 6/9；§3.3 行為契約→Global Constraints + Task 3/6；§3.4→Task 11；§4→Task 0/12/13；§5→tokens fallback + @supports（Task 4/6）；§6→Task 13；§7 風險（改錯檔）→Task 7 刪除 v1/v3。
- 型別/命名一致性：`CspanelTheme`（Task 2 定義、Task 6 消費）；`.gl-chip--success/--warning`（Task 4 定義、Task 10 消費）；`.gl-injected/.gl-table/.gl-tab`（Task 11 兩端對齊）；`logged-in` class（Task 6 CSS 與 JS 對齊）。
- 已知留白：Task 11 的精修選擇器需依實際 markup 微調（步驟內已指示以讀檔為準）；此為刻意設計而非 placeholder。
