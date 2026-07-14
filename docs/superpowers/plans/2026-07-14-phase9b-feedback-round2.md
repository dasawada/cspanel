# 九期B 驗收回饋輪 2 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 四項使用者回饋：(1) 成組視窗生成於手勢觸發位置（WYSIWYG）；(2) 移除 theme.js 的 `/api/me` 系死後端呼叫（404 噪音）；(3) 移除 netlify 頁兩個死 module 引用；(4) ui-conductor-v2.js 拔除全部註解與 console。

**Architecture（根因已查明）:**
1. `commitGroup`（canvas-engine.js:1102-1106）panel 分支呼叫 `pgCreate([target.id, dragged])` 未傳 rect → 視窗落預設位置。`pgCreate` 已支援 `opts.rect`（H1 先例）。修法＝commitGroup 計算目標＋拖曳兩面板的聯集 bbox（viewport→容器座標）當 rect。
2. theme.js:76-81（setTheme 內 POST `/api/me/preferences`）與 :85-100（`syncFromServer` fetch `/api/me`，由 :111 onAuthLogin 呼叫）——自 Tarkka（有 Worker 後端）移植殘留；cspanel 無此後端，登入即 404。localStorage（LS_KEY）才是實際持久化。
3. `cspanel_netlify/hhnueyfrsoj1na8pjj.html`:98-106、:108-124 兩個自包含 `<script type="module">` 區塊 import 不存在的 `./script/capsuleinput.js`/`buttonstylepack.js`——import 失敗整塊從未執行過，移除＝零行為變化。
4. ui-conductor-v2.js 443 行、4 個 console 呼叫＋大量註解——使用者指示全拔。

## Global Constraints

- cspanel 部分：repo `~/cspanel_clone/cspanel/`、分支 `phase9-page-engine`；netlify 部分（僅 Task 3）：repo `~/cspanel_clone/cspanel_netlify/`、分支 main（該 repo 慣例小修直改 main，**只 commit 不 push**——push 由控制器統一執行）。
- 絕不 `git add -A`；絕不 add `.superpowers/`/scratchpad。draggable.js 零改動。
- Task 2/4 觸及 v1/v2 共用檔＝**使用者點名的正式頁變更**（404 噪音移除／註解 console 拔除），行為語義不得有其他變化；v1 全套回歸必須綠。
- 測試斷言加 tools/page-engine-b-test.mjs（區段字母接續檔尾）；伺服器 http://localhost:8123。
- 拖曳一律用測試檔既有 `engineDrag`/`sectionGate` helper，不得手刻 mouse 序列。
- commit 尾行：`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。

---

### Task 1: 成組視窗生成於手勢位置

**Files:** Modify `script/canvas-engine.js`（commitGroup）; Test `tools/page-engine-b-test.mjs`

**Interfaces:**
- Produces: commitGroup 的 panel 分支改為：取 `elFor(target.id)` 與 `elFor(draggedPanelId)` 的 `getBoundingClientRect()` 聯集，換算容器座標（減 `.panel_all_container` 的 rect 與 border，比照 window-manager `containingBlockRect()` 數學），構成 `rect = { x: 聯集左上x, y: 聯集左上y, w: max(聯集寬, 240), h: max(聯集高＋60, 160) }`（+60＝tabbar/footer chrome 概算，讓成員不被壓縮；240/160＝wm MIN_W/MIN_H），傳入 `pgCreate([...], { rect })`。tabbar 分支與 page 分支不變。
- 斷言（新區段）：用 engineDrag 把 shrturl 拖疊 roof 成組 → 斷言新 `.wm-window` 的 boundingRect 左上角與成組當下聯集 bbox 左上角差 < 40px（而非預設 410,160）。先紅（現況落預設位）後綠。

### Task 2: theme.js 移除死後端呼叫

**Files:** Modify `script/theme.js`

**Interfaces:**
- 刪除：setTheme 內整個 `fetch('/api/me/preferences', …)` try 塊（含其上兩行 Persist 註解）；`syncFromServer` 整個函式（含其上 On load 註解）；onAuthLogin 內 `syncFromServer();` 呼叫。localStorage 持久化與其餘一字不動。
- 驗證：`grep -c "api/me" script/theme.js` 歸零；`node --check`；跑 handle-chrome-test（含主題切換斷言）＋page-engine-a-test＋panel-stack-test 全綠。無需新斷言（死碼移除）。

### Task 3: netlify 頁移除死 module 引用

**Files:** Modify `~/cspanel_clone/cspanel_netlify/hhnueyfrsoj1na8pjj.html`（**另一個 repo**，分支 main，只 commit 不 push）

**Interfaces:**
- 整塊刪除兩個自包含 `<script type="module">`（import capsuleinput.js 的 :98-106 區塊與 import buttonstylepack.js 的 :108-124 區塊——行號僅供定位，以 import 語句錨定整個 script 元素）。其餘 markup（input、button 本體）不動。
- 驗證：`grep -c "capsuleinput\|buttonstylepack" hhnueyfrsoj1na8pjj.html` 歸零；該檔無其他 `<script type="module">` 被誤刪（diff 只含兩塊）。

### Task 4: ui-conductor-v2.js 拔除全部註解與 console

**Files:** Modify `script/ui-conductor-v2.js`

**Interfaces:**
- 移除全部註解（`//` 行與行尾、`/* */` 塊）與全部 `console.*` 呼叫語句（4 處）。**語義零變化**：不得動任何其他語句；小心字串內的 `//`（URL）不是註解；console 呼叫若為表達式一部分（如 `x || console.log(...)`）需保等價改寫——先 grep 確認 4 處都是獨立語句。
- 驗證：`node --check`；`grep -c "console\." → 0`；diff 審視只有刪除與必要的空行整理；v1/v2 全套（page-engine-a/b、wm-test、handle-chrome、panel-stack）綠。
