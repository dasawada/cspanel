# 第四期設計：統一動態疊序 + 把手標籤 + 編輯模式修正

> 📌 已實作完成（分支 `phase4-dynamic-stacking`，含對抗式審查修正與視窗 chrome 打磨；未 merge，交使用者）。現行契約以 `docs/CANVAS.md` 為準。

> 承接第三期（`2026-07-08-phase3-edit-mode-robustness-HANDOFF.md`）。動任何畫布/面板前先讀
> `docs/CANVAS.md` 與 `2026-07-06-canvas-engine-design.md`。本文為 brainstorming 核可後的設計。

---

## 0. 現況與背景

第二期已把面板 z-index 從魔術數字解耦成 `calc(var(--layer-panel) + zOrder)`，但 `zOrder` 仍是
**每面板寫死的靜態名次**（`tie 疊序 = manifest panels[] 陣列順序`，見 CANVAS.md §4.2）。第三期在
分頁視窗管理器內做了「點擊置頂」的**動態 z**，但只作用於 tab 視窗。

使用者於真登入測試回報三件事，並定調本期方向（brainstorming 已核可）：

1. **`#gl-edit-bar` 載入先右偏一下才置中**（bug）。
2. **所有 draggable 面板，第一次點一下（沒移動）再放開，`left/top` 各 +~18px**（bug）。
3. **所有面板的 z-index 要比照圖形化介面「管理視窗」的邏輯**——點誰誰置頂，跟靜態魔術名次解耦。

使用者已定案的決策：
- **保留面板外觀**（不「視窗化」每個面板），只加動態 z + 編輯把手顯性標籤。
- **統一堆疊管理器**：面板與 tab 視窗**同一套**疊序（面板可蓋過 tab 視窗、反之亦然）。
- 點擊置頂後的堆疊順序**跨 reload 持久化**。

---

## 1. 本期範圍（四項，一次做）

| # | 項目 | 規模 | 說明 |
|---|---|---|---|
| S | 統一堆疊管理器 `stack-manager.js` | 大 | 全站 `--layer-panel` 帶內所有 surface 的動態 z（點擊置頂 + 持久化） |
| W | window-manager 併入 | 中 | tab 視窗的 z 改由 stack-manager 供給，達成「面板 ↔ 視窗」統一疊序 |
| L | 把手顯性標籤 | 小 | manifest 新增 `label` 欄位，編輯把手文字改讀它 |
| B1 | `#gl-edit-bar` 右偏修正 | 小 | 專屬 keyframe 保留 `translateX(-50%)` |
| B2 | draggable.js 點擊 +18px 修正 | 小 | `elementX/Y` 座標系對齊（附存檔污染處理） |

---

## 2. 子專案 S — 統一堆疊管理器（`script/stack-manager.js`）

### 2.1 概念

一個 ES module 單例，管理 `--layer-panel` 帶內所有 **surface** 的相對疊序。surface =
**每個有 `rootSelector` 的面板**（`cs.js` 目前 11 個：meeting-shell / protected(IPsearch) /
optitle / fudausearch / shrturl / dt / consultant / assist / canned / roof / tooldl；含話術、IPsearch，
不限是否 draggable——點擊置頂對任何定位面板都成立）＋**每個 tab 視窗**。無 `rootSelector` 的邏輯模組
（meeting-now/match/all，`slot:null`）不是 surface。

### 2.2 對外 API

```js
export const stack = {
  register(key, el, opts),   // opts: { levels=1, initialRank=0, pane=null }
  unregister(key),
  raise(key),                // 提到最上層 + 正規化 + 重寫 z + 持久化
  reset(),                   // 清持久化、回 initialRank 序
  setCanvasId(id),           // 決定持久化 key（預設 'cs'）
};
```

- `key`：面板用 manifest `id`（穩定）；tab 視窗用其 window id（存於 `cspanel.windows.cs.v1`）。
- `levels`：該 surface 需要的 z 槽數。一般面板 `1`；tab 視窗 `2`（視窗本體 + pane）。
- `pane`：tab 視窗傳入其 pane 元素，管理器一併寫 pane 的名次。
- `register` 會替 `el` 加上 `.gl-stack-surface` class（`opts.pane` 則替 pane 加 `.gl-stack-pane`），
  z-index 一律由這兩個 class 的 CSS 規則供給（見 §2.3）；`unregister` 移除 class 與 `--stack-rank`。

### 2.3 z 配置（沿用鐵律：z-index 只引用 `--layer-panel`）

**不寫 inline `z-index`**（inline 會蓋掉 `:focus-within`／`.small-size` 等狀態提升的 CSS 規則）。
改為在 surface 元素上設 **CSS 自訂屬性** `--stack-rank`（純整數），z-index 由 CSS class 供給：

```css
.gl-stack-surface { z-index: calc(var(--layer-panel) + var(--stack-rank, 0) * 2); }
.gl-stack-pane    { z-index: calc(var(--layer-panel) + var(--stack-rank, 0) * 2 + 1); }
```

- 每 surface 配 2 個 z 槽（`rank*2`、`rank*2+1`）。~11 面板 + 至多 4 視窗 = 15 surface，最高偏移
  `14*2+1 = 29`，穩在 `--layer-panel(100)`–`--layer-panel-active(200)` 帶內。
- **狀態提升仍有效**：`.small-size`（+10）、`.fudausearch-container:focus-within`
  （`--layer-panel-active`）、拖曳中提升等既有 CSS 規則特異度 ≥ `.gl-stack-surface`（0-1-0），
  或用更高帶（`--layer-panel-active` 200 > 帶內任何 resting rank），故照常覆蓋——動態 resting 疊序
  與「互動中暫時浮起」互不打架。

### 2.4 點擊置頂與正規化

- 引擎對每個面板根掛 `pointerdown`（capture，早於任何 bubble）→ `stack.raise(key)`。
- tab 視窗沿用它自己的 `raise`，但改成呼叫 `stack.raise(windowKey)`。
- `raise(key)`：把該 key 移到順序最後（最上層）→ 依順序重排所有 surface 的 `--stack-rank` 為
  0..N-1 → 持久化。**不重繪 DOM**（只改自訂屬性），故不會抽換使用者正壓的元素。

### 2.5 初始序

`manifest.zOrder` 降級為**初始名次來源**：引擎把所有面板 surface 依 `(zOrder 升冪，同值依 panels[]
陣列順序)` 排序，換算成**連續**的 `initialRank`（0,1,2,…），首次疊序等同現況（連續化只是把
0/3/4/5/10/15 這種非連續 zOrder 壓成連續名次，相對高低不變）。tab 視窗無 zOrder，register 時
`initialRank = 目前最大名次 + 1`（新建視窗預設在最上層）。**zOrder 不再是最終權威**——存檔的 `order`
若存在則覆蓋 initialRank（見 §2.6）。

### 2.6 持久化與重設

- **key**：`cspanel.stack.${canvasId}.v1`，格式 `{ order: [key, key, ...] }`（由下往上）。
- **寫入**：每次 `raise`／`register`（首次建立順序）後 `JSON.stringify` 整寫（`try/catch` 吞錯）。
- **還原**：register 時，若該 key 在存檔 `order` 內 → 依存檔位置插入；不在 → 依 `initialRank` 插入。
  存檔含已不存在的 key → 調和時略過。壞損（JSON 壞、非陣列）→ 靜默回 initialRank 序。
- **重設**：`stack.reset()` 刪 key + 回 initialRank 序。畫布引擎 `resetLayout()` 一併呼叫它
  （與 `WindowManager.reset()`、layout key 同步清），故「重設佈局」對位置＋疊序＋分頁三者同時生效。
- **tab 視窗 z 移除**：`cspanel.windows.cs.v1` 不再存 `z`（改由 stack-manager 單一權威）；
  windows key 只留 `{id, tabs, active, x, y, w, h}`。

### 2.7 生命週期

- 面板：引擎於 `initAllModules` 後（面板已 render）逐一 `register`；`clearAllModules`（登出）逐一
  `unregister`。
- tab 視窗：`window-manager` mount 建視窗時 `register`、撕離/合併/移除視窗時 register/unregister、
  destroy 時全數 unregister。
- 未登入 / 無面板：stack 為空，安靜無作用。

---

## 3. 子專案 W — window-manager 併入

`window-manager.js` 移除自有的 `z*2` inline z-index 計算與 `windows[].z`，改為：

- 建視窗時 `stack.register(win.id, win.el, { levels: 2, pane: activePaneEl, initialRank: ... })`。
- `raise(win)` → `stack.raise(win.id)`。
- `syncPanes` 只管 pane 的**幾何**（left/top/w/h），pane 的 `--stack-rank` 由 stack-manager 隨視窗
  名次同步（切換 active pane 時更新 pane 指向）。
- 視窗 render 時給 `.gl-stack-surface`、pane 給 `.gl-stack-pane`。

達成：**面板與 tab 視窗在同一疊序空間**，點面板可蓋過視窗、點視窗可蓋過面板。B 期回歸
（`wm-test.mjs` / `wm-concurrent-test.mjs`）沿用；新增「面板 raise 蓋過視窗、視窗 raise 蓋過面板」
的跨類 headless 斷言。

---

## 4. 子專案 L — 把手顯性標籤

- manifest panel 條目新增可選欄位 **`label`**（字串）。編輯把手文字（`canvas-engine.js`
  `enterEditMode` 的 `handle.textContent`）從 `p.id` 改為 `p.label || p.id`。
- 對應表（本期定案）：

| 面板 id | `label` |
|---|---|
| optitle | 標題生成 |
| meeting-shell | 外部會議面板 |
| fudausearch | 職代查詢 |
| shrturl | 短網址 |
| dt | 測試報告生成 |
| consultant | 顧問清單 |
| assist | 輔導班表 |
| roof | 檔次快捷 |
| tooldl | 工具下載 |
| protected（IPsearch）| IP 查詢 |
| canned | 代課回應生成器（純紀錄；canned 本就自管拖曳、不走引擎編輯把手） |

---

## 5. 子專案 B1 — `#gl-edit-bar` 右偏修正

**根因**：`#gl-edit-bar`（`canvas-edit.css`）用 `transform: translateX(-50%)` 置中，又掛
`animation: gl-modal-rise`；該 keyframe（`panels.css`）每格都寫 `transform`（`translateY()...` 到
`transform: none`），動畫期間整個蓋掉 `translateX(-50%)` → bar 左緣停在 `left:50%`（右偏半寬），
動畫結束才彈回置中。

**修法**：`canvas-edit.css` 內給浮動列專屬 keyframe，每格保留置中位移：

```css
@keyframes gl-edit-bar-rise {
  0%   { opacity: 0; transform: translateX(-50%) translateY(12px); }
  100% { opacity: 1; transform: translateX(-50%); }
}
#gl-edit-bar { animation: gl-edit-bar-rise 0.42s cubic-bezier(0.22,1,0.36,1); }
```

`prefers-reduced-motion` 分支沿用（animation: none）。

---

## 6. 子專案 B2 — draggable.js 點擊 +18px 修正

**根因**（`script/draggable.js` `handleDragStart`）：面板無 inline `left` 時，`elementX` 取
`getBoundingClientRect().left + scrollX`（**視窗座標**），放開時 `handleDragEnd` 又寫回
`panel.style.left`（**相對 containing block 的座標**）。兩者差 containing block 的視窗偏移
（body margin 8 + `.panel_all_container` margin/padding ≈ 18px），故即使沒移動，第一次點放也把面板
推 ~18px；之後 inline 已設就不再累加。編輯把手是 `persist:false`、初始不設 inline，故「所有編輯態面板
第一次點都中招」。（第三期我自寫的視窗拖曳用 delta 位移，點擊 delta=0 不動，故無此問題——是 draggable.js
既有座標系錯位。）

**修法**：`elementX/Y` 初始化改用與 `style.left` 同座標系的值：

```js
dragState.elementX = panel.style.left ? parseInt(panel.style.left, 10) : panel.offsetLeft;
dragState.elementY = panel.style.top  ? parseInt(panel.style.top, 10)  : panel.offsetTop;
```

`offsetLeft/offsetTop` 相對 `offsetParent`（= containing block），與 `left:` 語意一致。邊界計算
（`boundaryOffset` 系列仍用 getBoundingClientRect）不受影響——那是拖曳中的邊界，非初始位置權威。

**存檔污染處理**：既有使用者的 `cspanel.layout.cs.v1` / `draggable:<path>:<id>` 可能已被舊 bug 每點
+18 污染。提供說明：在瀏覽器 console 執行 `localStorage.removeItem('cspanel.layout.cs.v1')`
（或編輯模式按「重設佈局」）即回 manifest 預設。不寫自動遷移（污染量因人而異、無法可靠回推）。

**回歸**：headless fixture，對一個 `persist:false` 的 draggable 面板做 pointerdown→pointerup
（不 move），斷言 `left/top` 位移為 0。

---

## 7. 契約影響（CANVAS.md 更新，隨實作一起改）

- **§4.2 z-index 鐵律**：新增「動態疊序」段——resting 疊序由 `stack-manager` 動態管理（點擊置頂 +
  持久化），`manifest.zOrder` 降級為初始名次；`tie 疊序 = panels[] 陣列順序` 僅適用於**初始**、
  之後由互動決定。`z-index 只引用 --layer-*` 不變（改由 `.gl-stack-surface` 的
  `calc(var(--layer-panel) + var(--stack-rank)*2)` 供給）。
- **§5 持久化**：新增 `cspanel.stack.${canvasId}.v1` schema 與重設語義；註明 `cspanel.windows.*` 移除 `z`。
- **§7（視窗管理器）**：註明 z 改由 stack-manager 供給。
- **新增 §9 第四期刻意變更記錄**。

---

## 8. 驗證策略

- **stack-manager**：headless fixture（`tools/stack-fixture.html` + `tools/stack-test.mjs`）——註冊多
  surface、raise 正規化、跨類（面板 vs 視窗）疊序、持久化 reload 還原、reset 回初始、壞存檔容錯。
- **B1**：headless 量測動畫首格（0%）時 `#gl-edit-bar` 的 `getBoundingClientRect().left` 是否已置中
  （中心 ≈ viewport 中心），而非右偏。
- **B2**：headless 點擊零位移斷言（見 §6）。
- **既有回歸全綠**：`layout-parity.mjs`（PARITY OK）、`wm-test.mjs`、`wm-concurrent-test.mjs`、
  `fudau-repro.mjs`。
- **使用者真登入實測**：點擊置頂跨面板/視窗、reload 還原、編輯把手顯示中文標籤、reset、
  #1/#2 目視確認。

---

## 9. 範圍外（記錄）

- 面板「視窗化」（常駐標題列）——本期明確不做，只加動態 z + 編輯把手標籤。
- 面板 resize（沿第三期，仍只做位置 + 疊序）。
- 跨畫布的 stack 參數化（目前僅 `cs`）。
- draggable.js 舊存檔的自動污染回推（改為手動 reset 說明）。
