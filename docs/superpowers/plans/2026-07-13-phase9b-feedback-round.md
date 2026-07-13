# 九期B 驗收回饋輪實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修復使用者於 v2 預覽頁驗收回報的三項問題：(1) IPsearch 等帶 transition 的面板入組後移動慢一拍；(2) toggle 類大面板（dt/consultant/assist）排除於成組、僅可拖進視窗 tabbar 成為單獨分頁；(3) 拖出退組落點所見即所得。

**Architecture:** 三項皆已完成根因調查（systematic-debugging Phase 1-2）：
1. `.IPsearch_in_panelALL`／`.DT_panel` 等帶 `transition: all 0.3s ease`（cs.js sharedGeometryCss:15、dt geometryCss:78）——成員每幀被 pageHost.layout 寫 inline left/top，transition 動畫追趕即「慢一拍」。修法＝入組期間 inline `transition:none`（inline 勝所有樣式表；**不動 sharedGeometryCss**——v1 契約字面）。
2. groupTargets()（canvas-engine.js:880）為候選集組成點；新增 manifest 欄位 `pageSolo: true`（dt/consultant/assist）＋新目標型別「wm tabbar」（指標落點判定，非面積重疊——tabbar 僅 36px 高，面積比永遠達不到 0.4）。
3. handleMemberDrop 拖出分支（:1024-1038）→ leaveMember 無條件恢復 detachedRect（:444-448）蓋掉 draggable 已寫好的落點。修法＝leaveMember 加 `opts.keepPosition`。

**Spec 依據:** docs/superpowers/specs/2026-07-12-phase9-page-engine-design.md；本輪為其驗收回饋修正（比照一期 Task 14 慣例）。

## Global Constraints

- repo `~/cspanel_clone/cspanel/`、分支 `phase9-page-engine`。絕不 `git add -A`；絕不 add `.superpowers/`/scratchpad。
- production 零變化鐵律（v1 模式行為與 key 逐位元不變）；儲存隔離鐵律（v2 絕不讀寫 .v1 key）；iframe 零 re-parent；draggable.js 零改動；新 CSS 鐵律（§4.8/§4.2/§4.7）。
- **cs.js 的 sharedGeometryCss／geometryCss 字面不動**（transition 抑制走 inline，v1 頁的 0.3s 動畫行為保留）。
- 測試走 v2 頁＋登入 stub＋order-tool-api 攔截，斷言加進 tools/page-engine-b-test.mjs（區段字母接續現況，開工先看檔尾用到哪個字母）。
- 測試伺服器 http://localhost:8123；commit 尾行 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 完成後推 main 屬控制器職責，不在任務範圍。

---

### Task 1: 入組成員抑制 transition（修「慢一拍」）

**Files:**
- Modify: `script/canvas-engine.js`（joinMember/leaveMember）
- Test: `tools/page-engine-b-test.mjs`

**Interfaces:**
- Produces: `joinMember` 時記錄 `el.style.transition` 原 inline 值（通常空字串）後設 `el.style.transition = 'none'`；`leaveMember` 還原原 inline 值（空字串＝removeProperty，回落 CSS 幾何的 0.3s——v1 語義不變）。記錄存於 pageJoins entry（join 物件加欄位），不另開 Map。
- Consumes: 既有 joinMember/leaveMember/pageJoins。

- [ ] **Step 1: 失敗斷言**——成組 `['dt','optitle']`（dt 帶 transition，stub 環境存在）後：`getComputedStyle(document.querySelector('.DT_panel')).transitionDuration === '0s'`；PageEngine.dissolve 後恢復 `0.3s`。先跑確認紅（現況入組後仍 0.3s）。
- [ ] **Step 2: 實作**（依 Interfaces）。
- [ ] **Step 3: 綠燈＋回歸**：page-engine-b-test 全區＋page-engine-a-test＋panel-stack-test。
- [ ] **Step 4: Commit**（`fix(page): 入組成員抑制 transition——IPsearch/DT 等移動慢一拍（回饋輪 1）`）

---

### Task 2: pageSolo 面板——排除成組、拖進 tabbar 成單獨分頁

**Files:**
- Modify: `script/canvases/cs.js`（dt/consultant/assist 加 `pageSolo: true`）
- Modify: `script/canvas-engine.js`（groupTargets 排除、tabbar 目標、pointer 追蹤、commitGroup 分流、PageEngine.create opts.targetWindowId）
- Modify: `style/v2/page-engine.css`（預覽框文案變體所需樣式若有）
- Test: `tools/page-engine-b-test.mjs`

**Interfaces:**
- Produces:
  - manifest 欄位 `pageSolo: true`（語義：不參與面板↔面板成組；可被拖到 wm 視窗 **tabbar** 成為單獨分頁）。
  - `groupTargets(excludePanelId)`：(a) 排除 `pageSolo` 面板作為目標；(b) 拖曳來源為 pageSolo 時，面板與 page 內容區目標全排除；(c) 新目標型別 `{ kind: 'tabbar', winId, rect }`（所有 `.wm-window` 的 `.wm-tabbar` rect）——**命中判定用指標座標 in-rect**（startGroupWatch 掛 document pointermove（passive）記 lastPointer，teardown 移除），懸停門檻同 `GROUP_DWELL_MS`；預覽框罩 tabbar、文案「成為分頁」。所有面板（含一般面板）皆可用 tabbar 目標。
  - drop 於 tabbar → `PageEngine.create([panelId], { targetWindowId })`：建單員 page 後 `wm.addPageTab(targetWindowId, pageId)` 並置頂該視窗（不 createPageWindow）。**單員 page 不觸發自動解散**（自動解散僅存在於 removeMember 剩一路徑——實作時驗證並加斷言）。
  - 成組後（tabbar 路徑）同樣不寫畫布 layout、走既有 GROUP_BOUNCE_REASSERT 防護。
- Consumes: Task 1 無依賴；既有 dragTelemetry/startGroupWatch/commitGroup/PageEngine。

- [ ] **Step 1: 失敗斷言**：(a) 拖 dt 疊上 optitle 懸停 700ms **不**出現 `.gl-group-preview`（pageSolo 來源排除）；(b) 拖 optitle 疊上 dt 同樣不出現（pageSolo 目標排除）；(c) 先 API 建一個 page 視窗，拖 dt 使**指標**進入其 tabbar 懸停 → 預覽（文案含「成為分頁」）→ 放開 → 該視窗多一顆 tab、標題「測試報告生成」、dt 定位進內容區、pages store 多一筆單員 page 且不自動解散；(d) reload 後單員 page tab 存活。
- [ ] **Step 2: 實作**。
- [ ] **Step 3: 綠燈＋回歸**（page-engine-b 全區＋a-test＋wm-test＋panel-stack-test）。
- [ ] **Step 4: Commit**（`feat(page): pageSolo 面板——toggle 大面板排除成組、拖 tabbar 成單獨分頁（回饋輪 2）`）

---

### Task 3: 拖出退組落點所見即所得

**Files:**
- Modify: `script/canvas-engine.js`（leaveMember opts、handleMemberDrop 拖出分支、pgRemoveMember 傳遞）
- Test: `tools/page-engine-b-test.mjs`

**Interfaces:**
- Produces: `leaveMember(panelId, { keepPosition = false } = {})`——`keepPosition:true` 時**不**套 detachedRect：保留當下 inline left/top（draggable 已寫好的落點）、`saveLayoutEntry` 存落點（v2 layout store 同步）、其餘清理（stack 重註冊、quirk persist 恢復、class/rank 清除）照舊。呼叫鏈：handleMemberDrop 拖出分支 → `pgRemoveMember(pageId, panelId, { keepPosition: true })` → leaveMember 傳遞。**API `PageEngine.dissolve`／`removeMember`（無 opts）與剩一自動解散維持 detachedRect 語義不變**。既有 I2 reassert 快照（handleMemberDrop:1032-1037）本來就重申「leaveMember 剛寫好的 inline」——keepPosition 下即落點，無需改。罐頭（body-mounted）同路徑成立（inline 值本就是其 containing block 座標）。
- Consumes: Task 1/2 無依賴。

- [ ] **Step 1: 失敗斷言**：成組兩員 → 把成員拖出內容區、放開在畫布上某點 → 斷言面板 computed left/top ≈ 放開時面板位置（±3px）且 **≠** detachedRect（先確保入組前先把面板拖離原位，使 detachedRect 與落點必然不同）；layout store `.v2` 記錄落點；剩一自動解散的最後一員仍回 detachedRect（對照斷言）。
- [ ] **Step 2: 實作**。
- [ ] **Step 3: 綠燈＋回歸**（page-engine-b 全區＋a-test）。
- [ ] **Step 4: Commit**（`fix(page): 拖出退組落點所見即所得（回饋輪 3）`）
