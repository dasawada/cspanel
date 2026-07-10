# 第四期：統一動態疊序 + 把手標籤 + 編輯模式修正 Implementation Plan

> 📌 已執行完畢（分支 `phase4-dynamic-stacking`，全部 Task 完成 + 審查修正 + chrome 打磨）。現行契約以 `docs/CANVAS.md` 為準。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development 或 superpowers:executing-plans 逐工實作。步驟用 checkbox（`- [ ]`）追蹤。

**Goal:** 把畫布所有面板 + tab 視窗的疊序，從「靜態寫死名次」改成「統一動態管理（點擊置頂 + 持久化）」，把編輯把手改顯示中文業務標籤，並修掉 `#gl-edit-bar` 載入右偏與 draggable 點擊 +18px 兩個 bug。

**Architecture:** 新增 `stack-manager.js` 單例：surface（有 rootSelector 的面板 + 每個 tab 視窗）以 CSS 自訂屬性 `--stack-rank` + `.gl-stack-surface`/`.gl-stack-pane` class 取得 `calc(var(--layer-panel)+rank*2[+1])` 的 z-index（不寫 inline z-index，保留 `:focus-within`/`.small-size` 狀態提升）。引擎對面板掛 pointerdown→raise、登入註冊/登出卸除、resetLayout 委派 reset；window-manager 的視窗改向 stack-manager 註冊、raise 委派它。

**Tech Stack:** 純 HTML/CSS/vanilla JS（ES modules，無 build）。驗證：`playwright`（headless）+ 既有 `tools/*.mjs` harness。

## Global Constraints

- 工作目錄 `/Users/jianmingxiu/cspanel_clone/cspanel`；分支 **`phase4-dynamic-stacking`（自 `phase3-edit-mode-robustness` 分出）**。不得 push、不得 merge（交使用者）。
- 座標只准出現在 manifest；**z-index 只准引用 `--layer-*` 層帶**（本期改由 `.gl-stack-surface` 的 `calc(var(--layer-panel)+var(--stack-rank)*2)` 供給；白名單 2147483647 拖曳盾不變）。
- `panel_all.html` **不可加 DOCTYPE**（quirks mode）。
- 事件契約不可破壞：`firework-login-success`/`firework-logout-success`/`fw-auth-state-change`/`firework-force-logout`；`html.auth-active`；`window.verifyFireworkAuth`；面板 init/clear 簽名。
- 每 Task 一 commit，訊息尾加 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 本機 server：`python3 -m http.server 8123`（repo 根）。驗證閘：`tools/layout-parity.mjs`（PARITY OK）、`tools/wm-test.mjs`、`tools/wm-concurrent-test.mjs`、`tools/fudau-repro.mjs` 全綠。

---

### Task 0: 分支 + stack CSS class + panel_all link

**Files:**
- Create: `style/v2/stack.css`
- Modify: `panel_all.html`（head 加 link）

- [ ] **Step 1: 建分支**
```bash
cd /Users/jianmingxiu/cspanel_clone/cspanel
git checkout phase3-edit-mode-robustness && git checkout -b phase4-dynamic-stacking
```

- [ ] **Step 2: 寫入 style/v2/stack.css**
```css
/* ===== 統一動態疊序（第四期）=====
   z-index 只引用 --layer-panel 帶；名次由 stack-manager.js 以 --stack-rank
   自訂屬性供給（非 inline z-index，才不會蓋掉 :focus-within/.small-size 等
   狀態提升的 CSS 規則）。每 surface 配 2 個 z 槽（rank*2、rank*2+1）。 */
.gl-stack-surface { z-index: calc(var(--layer-panel) + var(--stack-rank, 0) * 2); }
.gl-stack-pane    { z-index: calc(var(--layer-panel) + var(--stack-rank, 0) * 2 + 1); }
```

- [ ] **Step 3: panel_all.html head 於 window-manager.css 後加 link**（不加 DOCTYPE）
```html
<link rel="stylesheet" href="style/v2/window-manager.css">
<link rel="stylesheet" href="style/v2/stack.css">
```

- [ ] **Step 4: 驗證 + commit**
```bash
head -1 panel_all.html | grep -qi doctype && echo VIOLATION || echo "no doctype ok"
(python3 -m http.server 8123 >/tmp/h.log 2>&1 &); sleep 1
node tools/layout-parity.mjs capture /tmp/p0.json && node tools/layout-parity.mjs compare tools/parity-baseline.json /tmp/p0.json
git add style/v2/stack.css panel_all.html && git commit -m "feat(stack): 動態疊序 CSS class 骨架 + panel_all link"
```
Expected: `no doctype ok`、`PARITY OK`（class 尚未套到任何元素，零視覺變化）。

---

### Task 1: B1 — #gl-edit-bar 右偏修正

**Files:**
- Modify: `style/v2/canvas-edit.css`
- Test: `tools/editbar-center-test.mjs`（新）

**Interfaces:** Produces：`#gl-edit-bar` 動畫全程保持 `translateX(-50%)` 置中。

- [ ] **Step 1: 寫失敗測試 tools/editbar-center-test.mjs**（登入後 enter 編輯、動畫進行中量 bar 中心 vs viewport 中心）
```js
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1800,height:1200} });
await p.addInitScript(() => { localStorage.setItem('firebase_id_token','parity-stub'); localStorage.setItem('cspanel.theme.v1','olive');
  const u={getIdToken:async()=>'x'}; window.firebase={apps:[{}],initializeApp:()=>{},auth:()=>({onAuthStateChanged:cb=>setTimeout(()=>cb(u),50),currentUser:u,signOut:async()=>{},signInWithEmailAndPassword:async()=>({user:u})}),firestore:()=>({})}; window.verifyFireworkAuth=async()=>true; });
await p.route('**/api/order-tool-api', r=>r.fulfill({status:200,contentType:'application/json',body:'{"success":false}'}));
await p.goto('http://localhost:8123/panel_all.html');
await p.waitForFunction(()=>document.documentElement.classList.contains('auth-active'),{timeout:15000});
await p.waitForTimeout(2000);
await p.evaluate(()=>window.CanvasEdit.enter());
// 動畫進行中（~120ms）取樣
await p.waitForTimeout(120);
const r = await p.evaluate(()=>{ const el=document.getElementById('gl-edit-bar'); const b=el.getBoundingClientRect(); return { center:b.left+b.width/2, vw:window.innerWidth }; });
await b.close();
const off = Math.abs(r.center - r.vw/2);
console.log('bar center offset from viewport center =', off.toFixed(1),'px');
if (off > 4) { console.error('EDITBAR CENTER FAIL (右偏)'); process.exit(1); }
console.log('EDITBAR CENTER OK');
```

- [ ] **Step 2: 跑測試確認現在會紅**
```bash
node tools/editbar-center-test.mjs   # 現況借用 gl-modal-rise → 動畫中右偏 → FAIL
```

- [ ] **Step 3: canvas-edit.css 改用專屬 keyframe**（把 `#gl-edit-bar` 的 `animation: gl-modal-rise ...` 換成下方，並在檔案內定義 keyframe）
```css
@keyframes gl-edit-bar-rise {
    0%   { opacity: 0; transform: translateX(-50%) translateY(12px); }
    100% { opacity: 1; transform: translateX(-50%); }
}
```
把 `#gl-edit-bar { ... animation: gl-modal-rise 0.42s ...; }` 改為 `animation: gl-edit-bar-rise 0.42s cubic-bezier(0.22,1,0.36,1);`。`@media (prefers-reduced-motion: reduce) { #gl-edit-bar { animation: none; } }` 沿用。

- [ ] **Step 4: 跑測試確認綠 + parity**
```bash
node tools/editbar-center-test.mjs   # EDITBAR CENTER OK
node tools/layout-parity.mjs capture /tmp/p1.json && node tools/layout-parity.mjs compare tools/parity-baseline.json /tmp/p1.json
```

- [ ] **Step 5: commit**
```bash
git add style/v2/canvas-edit.css tools/editbar-center-test.mjs
git commit -m "fix(canvas): #gl-edit-bar 專屬 keyframe 保留 translateX(-50%)（不再載入右偏）"
```

---

### Task 2: B2 — draggable.js 點擊 +18px 修正

**Files:**
- Modify: `script/draggable.js:157-162`（`handleDragStart` 的 elementX/Y 初始化）
- Test: `tools/drag-noshift-test.mjs` + `tools/drag-noshift-fixture.html`（新）

**Interfaces:** Produces：`persist:false` 面板 pointerdown→pointerup（不移動）時 `left/top` 位移 0。

- [ ] **Step 1: fixture tools/drag-noshift-fixture.html**（模擬 app：`.panel_all_container` 有 margin/padding，內含一個 CSS 定位、無 inline left 的可拖面板）
```html
<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><title>drag noshift fixture</title>
<style>
  html,body{margin:8px;} /* 模擬 body 預設 margin */
  .panel_all_container{position:absolute;left:0;top:0;margin:10px;padding:10px;}
  #pnl{position:absolute;left:200px;top:120px;width:150px;height:80px;background:#cde;}
  #h{height:20px;background:#9ab;cursor:grab;}
</style></head><body>
<div class="panel_all_container"><div id="pnl"><div id="h">handle</div>body</div></div>
<script type="module">
  import { makeDraggable } from '/script/draggable.js';
  const pnl=document.getElementById('pnl'), h=document.getElementById('h');
  // persist:false 模擬編輯把手（初始不設 inline left/top）
  makeDraggable(pnl, h, { persist:false });
  window.__rect = () => { const r=pnl.getBoundingClientRect(); return {l:Math.round(r.left),t:Math.round(r.top)}; };
</script></body></html>
```

- [ ] **Step 2: 測試 tools/drag-noshift-test.mjs**（在 handle 上 pointerdown→pointerup 不移動，斷言前後 rect 相同）
```js
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1200,height:800} });
await p.goto('http://localhost:8123/tools/drag-noshift-fixture.html');
await p.waitForTimeout(200);
const before = await p.evaluate(()=>window.__rect());
const hb = await p.evaluate(()=>{ const r=document.getElementById('h').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
await p.mouse.move(hb.x,hb.y); await p.mouse.down(); await p.mouse.up();
await p.waitForTimeout(150);
const after = await p.evaluate(()=>window.__rect());
await b.close();
console.log('before',JSON.stringify(before),'after',JSON.stringify(after));
const dx=Math.abs(after.l-before.l), dy=Math.abs(after.t-before.t);
if (dx>1 || dy>1) { console.error(`DRAG NOSHIFT FAIL (+${dx},+${dy})`); process.exit(1); }
console.log('DRAG NOSHIFT OK');
```

- [ ] **Step 3: 跑測試確認現在會紅**
```bash
node tools/drag-noshift-test.mjs   # 現況 elementX 用 getBoundingClientRect → +~18 → FAIL
```

- [ ] **Step 4: 修 draggable.js**（`handleDragStart` 內）
```js
    dragState.elementX = panel.style.left
      ? parseInt(panel.style.left, 10)
      : panel.offsetLeft;
    dragState.elementY = panel.style.top
      ? parseInt(panel.style.top, 10)
      : panel.offsetTop;
```
（原本 `: (panel.getBoundingClientRect().left + window.scrollX)` / top 版本各改成 `panel.offsetLeft` / `panel.offsetTop`。其餘不動。）

- [ ] **Step 5: 跑測試確認綠 + node --check + parity**
```bash
node --check script/draggable.js
node tools/drag-noshift-test.mjs   # DRAG NOSHIFT OK
node tools/layout-parity.mjs capture /tmp/p2.json && node tools/layout-parity.mjs compare tools/parity-baseline.json /tmp/p2.json
```

- [ ] **Step 6: commit**
```bash
git add script/draggable.js tools/drag-noshift-fixture.html tools/drag-noshift-test.mjs
git commit -m "fix(drag): 點擊不移動不再 +18px（elementX/Y 改 offsetLeft/Top 對齊座標系）"
```

---

### Task 3: stack-manager.js（核心）

**Files:**
- Create: `script/stack-manager.js`
- Test: `tools/stack-fixture.html` + `tools/stack-test.mjs`（新）

**Interfaces:**
- Produces: `export const stack = { register(key, el, opts), unregister(key), raise(key), reset(), setCanvasId(id) }`；`opts = { levels=1, initialRank=0, pane=null }`；register 加 `.gl-stack-surface`（pane 加 `.gl-stack-pane`）並設 `--stack-rank`；持久化 key `cspanel.stack.<id>.v1` 格式 `{ order:[key,...] }`（下→上）。

- [ ] **Step 1: 寫入 script/stack-manager.js（完整）**
```js
// 統一動態疊序管理器（第四期）。所有 surface（有 rootSelector 的面板 + 每個
// tab 視窗）共用一套疊序：點擊置頂、名次正規化為 0..N-1、跨 reload 持久化。
// z-index 不寫 inline，改設 CSS 自訂屬性 --stack-rank，由 .gl-stack-surface /
// .gl-stack-pane（style/v2/stack.css）以 calc(var(--layer-panel)+rank*2[+1]) 供給，
// 讓 :focus-within / .small-size 等狀態提升的 CSS 規則仍能覆蓋。
const KEY = (id) => `cspanel.stack.${id}.v1`;

let canvasId = 'cs';
const surfaces = new Map(); // key -> { el, pane, levels }
let order = [];             // key[]（由下往上，最後者最上層）

function readOrder() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(canvasId)));
    return (raw && Array.isArray(raw.order)) ? raw.order.filter((k) => typeof k === 'string') : null;
  } catch (e) { return null; }
}
function persist() {
  try { localStorage.setItem(KEY(canvasId), JSON.stringify({ order: order.slice() })); } catch (e) {}
}
function applyRanks() {
  order.forEach((key, rank) => {
    const s = surfaces.get(key);
    if (!s) return;
    s.el.style.setProperty('--stack-rank', String(rank));
    if (s.pane) s.pane.style.setProperty('--stack-rank', String(rank));
  });
}

export const stack = {
  setCanvasId(id) { canvasId = id || 'cs'; },

  register(key, el, opts = {}) {
    if (!key || !el) return;
    const levels = opts.levels || 1;
    surfaces.set(key, { el, pane: opts.pane || null, levels });
    el.classList.add('gl-stack-surface');
    if (opts.pane) opts.pane.classList.add('gl-stack-pane');
    if (!order.includes(key)) {
      const saved = readOrder();
      const savedIdx = saved ? saved.indexOf(key) : -1;
      if (savedIdx !== -1) {
        // 依存檔相對位置插入：找到 order 中「存檔排在我前面且已註冊」的最後一個之後
        let insertAt = 0;
        for (let i = 0; i < order.length; i++) {
          if (saved.indexOf(order[i]) !== -1 && saved.indexOf(order[i]) < savedIdx) insertAt = i + 1;
        }
        order.splice(insertAt, 0, key);
      } else {
        // 無存檔位置：依 initialRank 插入（大者在上）
        const rank = Number.isFinite(opts.initialRank) ? opts.initialRank : order.length;
        let insertAt = order.length;
        for (let i = 0; i < order.length; i++) {
          const s = surfaces.get(order[i]);
          if (s && Number.isFinite(s._initialRank) && s._initialRank > rank) { insertAt = i; break; }
        }
        surfaces.get(key)._initialRank = rank;
        order.splice(insertAt, 0, key);
      }
    }
    applyRanks();
    persist();
  },

  unregister(key) {
    const s = surfaces.get(key);
    if (s) {
      s.el.classList.remove('gl-stack-surface');
      s.el.style.removeProperty('--stack-rank');
      if (s.pane) { s.pane.classList.remove('gl-stack-pane'); s.pane.style.removeProperty('--stack-rank'); }
    }
    surfaces.delete(key);
    order = order.filter((k) => k !== key);
    applyRanks();
    persist();
  },

  raise(key) {
    if (!surfaces.has(key)) return;
    const idx = order.indexOf(key);
    if (idx === order.length - 1) return; // 已在最上
    if (idx !== -1) order.splice(idx, 1);
    order.push(key);
    applyRanks();
    persist();
  },

  reset() {
    try { localStorage.removeItem(KEY(canvasId)); } catch (e) {}
    // 依各 surface 的 _initialRank 重排（無者維持現序）
    order.sort((a, b) => {
      const ra = surfaces.get(a)?._initialRank ?? 0;
      const rb = surfaces.get(b)?._initialRank ?? 0;
      return ra - rb;
    });
    applyRanks();
    persist();
  },
};
```

- [ ] **Step 2: fixture tools/stack-fixture.html**（三個 surface：兩面板 + 一「視窗+pane」）
```html
<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><title>stack fixture</title>
<link rel="stylesheet" href="/style/v2/tokens.css">
<link rel="stylesheet" href="/style/v2/stack.css">
<style>.s{position:absolute;width:120px;height:80px;} #a{left:0;top:0;background:#fcc} #b{left:40px;top:20px;background:#cfc} #w{left:80px;top:40px;background:#ccf} #wp{left:80px;top:60px;width:120px;height:60px;background:#eef}</style>
</head><body>
<div id="a" class="s"></div><div id="b" class="s"></div><div id="w" class="s"></div><div id="wp"></div>
<script type="module">
  import { stack } from '/script/stack-manager.js';
  localStorage.removeItem('cspanel.stack.cs.v1');
  stack.setCanvasId('cs');
  stack.register('a', document.getElementById('a'), { initialRank: 0 });
  stack.register('b', document.getElementById('b'), { initialRank: 1 });
  stack.register('w', document.getElementById('w'), { levels: 2, pane: document.getElementById('wp'), initialRank: 2 });
  window.__stack = stack;
  window.__z = (id) => parseInt(getComputedStyle(document.getElementById(id)).zIndex, 10);
</script></body></html>
```

- [ ] **Step 3: 測試 tools/stack-test.mjs**（初始序、raise 置頂、pane 疊窗上、持久化 reload 還原、reset）
```js
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
const fails=[]; const A=(c,m)=>{ if(!c){fails.push(m);console.error('✗ '+m);} else console.log('✓ '+m); };
await p.goto('http://localhost:8123/tools/stack-fixture.html');
await p.evaluate(()=>localStorage.removeItem('cspanel.stack.cs.v1'));
await p.reload(); await p.waitForFunction(()=>!!window.__z); await p.waitForTimeout(100);
let z = await p.evaluate(()=>({a:__z('a'),b:__z('b'),w:__z('w'),wp:__z('wp')}));
A(z.a<z.b && z.b<z.w, `初始序 a<b<w (${JSON.stringify(z)})`);
A(z.wp===z.w+1, `pane 疊在自己視窗上 (w=${z.w},wp=${z.wp})`);
await p.evaluate(()=>window.__stack.raise('a'));
z = await p.evaluate(()=>({a:__z('a'),b:__z('b'),w:__z('w')}));
A(z.a>z.b && z.a>z.w, `raise(a) 後 a 最上 (${JSON.stringify(z)})`);
await p.reload(); await p.waitForFunction(()=>!!window.__z); await p.waitForTimeout(100);
z = await p.evaluate(()=>({a:__z('a'),b:__z('b'),w:__z('w')}));
A(z.a>z.b && z.a>z.w, `reload 後仍 a 最上（持久化）(${JSON.stringify(z)})`);
await p.evaluate(()=>window.__stack.reset());
z = await p.evaluate(()=>({a:__z('a'),b:__z('b'),w:__z('w')}));
A(z.a<z.b && z.b<z.w, `reset 回初始序 a<b<w (${JSON.stringify(z)})`);
await b.close();
if (fails.length){ console.error(`STACK TEST FAIL (${fails.length})`); process.exit(1);} console.log('STACK TEST OK');
```

- [ ] **Step 4: 跑 + commit**
```bash
node --check script/stack-manager.js
node tools/stack-test.mjs   # STACK TEST OK
git add script/stack-manager.js tools/stack-fixture.html tools/stack-test.mjs
git commit -m "feat(stack): stack-manager 單例（register/raise/reset/持久化）+ headless 測"
```

---

### Task 4: 引擎整合 + 把手標籤（L）

**Files:**
- Modify: `script/canvas-engine.js`（import stack、register/unregister、pointerdown-raise、resetLayout 委派、把手讀 label）
- Modify: `script/canvases/cs.js`（11 面板加 `label`；移除 `zOrder` 為初始名次來源—保留 zOrder 值供 initialRank）

**Interfaces:**
- Consumes: `stack`（Task 3）。
- Produces: 登入後每個 rootSelector 面板 `stack.register(id, el, {initialRank})` + 掛 pointerdown→`stack.raise(id)`；登出 `stack.unregister`；`resetLayout()` 呼叫 `stack.reset()`；`enterEditMode` 把手 `textContent = p.label || p.id`。

- [ ] **Step 1: cs.js 每個有 rootSelector 的面板加 label**（值見設計 §4 對應表）
optitle→'標題生成'、meeting-shell→'外部會議面板'、fudausearch→'職代查詢'、shrturl→'短網址'、dt→'測試報告生成'、consultant→'顧問清單'、assist→'輔導班表'、roof→'檔次快捷'、tooldl→'工具下載'、protected→'IP 查詢'、canned→'代課回應生成器'。

- [ ] **Step 2: canvas-engine.js 匯入 stack + 面板註冊/卸除 + 點擊置頂**
在檔案頂 import：`import { stack } from './stack-manager.js';`。
新增輔助（surface = 有 rootSelector 的面板；依 zOrder 升冪、同值依陣列序給 initialRank）：
```js
function stackSurfaces(manifest) {
  return manifest.panels
    .map((p, i) => ({ p, i, el: p.rootSelector ? document.querySelector(p.rootSelector) : null }))
    .filter((x) => x.el)
    .sort((a, b) => ((a.p.zOrder || 0) - (b.p.zOrder || 0)) || (a.i - b.i));
}
const stackRaisers = []; // { el, handler }
function registerStack() {
  stack.setCanvasId(activeCanvas.manifest.id);
  stackSurfaces(activeCanvas.manifest).forEach((x, rank) => {
    stack.register(x.p.id, x.el, { initialRank: rank });
    const handler = () => stack.raise(x.p.id);
    x.el.addEventListener('pointerdown', handler, true);
    stackRaisers.push({ el: x.el, handler, id: x.p.id });
  });
}
function unregisterStack() {
  stackRaisers.forEach(({ el, handler, id }) => { el.removeEventListener('pointerdown', handler, true); stack.unregister(id); });
  stackRaisers.length = 0;
}
```
在 `initAllModules()` 尾（`broadcastAuthState('login-ready')` 前）呼叫 `registerStack()`；在 `clearAllModules()`（`broadcastAuthState('logout-complete')` 前）呼叫 `unregisterStack()`。

- [ ] **Step 3: resetLayout 委派 + 把手讀 label**
`resetLayout()` 內（`WindowManager.reset()` 呼叫旁）加：`try { stack.reset(); } catch (e) {}`。
`enterEditMode()` 內把手：`handle.textContent = p.label || p.id;`。

- [ ] **Step 4: 驗證**
```bash
node --check script/canvas-engine.js && node --check script/canvases/cs.js
node -e "import('./script/canvases/cs.js').then(m=>{const bad=m.default.panels.filter(p=>p.rootSelector&&!p.label);console.log('rootSelector 面板缺 label:',bad.map(p=>p.id).join(',')||'(無)')})" --input-type=module
node tools/layout-parity.mjs capture /tmp/p4.json && node tools/layout-parity.mjs compare tools/parity-baseline.json /tmp/p4.json
```
Expected: 語法過；缺 label 為「(無)」；**PARITY OK**——關鍵：登入後面板 rect 不變（`--stack-rank` 只改 z 不改位置），且 zorder 追蹤清單的相對序須與 baseline 一致（初始名次 = 舊 zOrder 相對序，等秩）。若 zorder DIFF，檢查 initialRank 排序是否等秩於舊 zOrder。

- [ ] **Step 5: headless 冒煙**（登入後點 A 面板→其 z 變最高；enter 編輯→把手顯示中文）
```bash
# 用 stub 登入，evaluate：點 .optitlepanel 後比較它與 .DT_panel 的 computed z；enter 後查某把手 textContent 含「標題生成」
```
（沿用 editbar-center-test 的 stub；斷言 raise 生效 + 把手中文。）

- [ ] **Step 6: commit**
```bash
git add script/canvas-engine.js script/canvases/cs.js
git commit -m "feat(stack): 引擎註冊面板到 stack-manager、點擊置頂、reset 委派、把手中文標籤"
```

---

### Task 5: window-manager 併入共用管理器（W）

**Files:**
- Modify: `script/window-manager.js`（移除自有 z*2 inline 計算與 windows[].z 存檔；改 stack.register/raise/unregister）
- Test: `tools/wm-test.mjs`（更新持久化不再依賴 z）、新增跨類斷言（面板 vs 視窗）

**Interfaces:**
- Consumes: `stack`（Task 3）。
- Produces: 每視窗 `stack.register(win.id, win.el, {levels:2, pane:activePaneEl, initialRank})`；`raise(win)`→`stack.raise(win.id)`；render 時視窗給 `.gl-stack-surface`（由 register）、active pane 指到 stack（切 active 時更新 pane 指向並重設 rank）。

- [ ] **Step 1: window-manager.js 改 z 來源**
- import：`import { stack } from './stack-manager.js';`
- 移除 `applyZ()` 內 `el.style.zIndex=...` 與 syncPanes 內 `pane.style.zIndex=...`；改為在 render 後對每個 win 呼叫 `stack.register(win.id, win.el, { levels:2, pane: panes[win.active], initialRank: topInitial++ })`（新視窗預設在上）。
- `raise(win)` → `stack.raise(win.id)`。
- `syncPanes` 只設 pane 幾何；active pane 變更時呼叫 `stack.register(win.id, win.el, { levels:2, pane: panes[win.active] })`（更新 pane 指向，rank 由 stack 維持）——即 register 對已存在 key 只更新 pane/class 不改序。
- persist()：windows 陣列不再寫 `z`；loadWindows 忽略舊 `z`。
- destroy()：對每個 win `stack.unregister(win.id)`。

需微調 register 讓「重複 register 同 key」只更新 pane 指向（不改 order）：在 stack-manager register 開頭，若 `surfaces.has(key)`，更新 el/pane/class 後 `applyRanks()` 即 return（不動 order、不 persist 位置）。

- [ ] **Step 2: 更新 stack-manager register 支援「同 key 更新 pane」**（Task 3 檔案）
```js
  register(key, el, opts = {}) {
    if (!key || !el) return;
    const existing = surfaces.get(key);
    if (existing) { // 更新 pane 指向（切 active pane）——不動疊序
      if (existing.pane && existing.pane !== (opts.pane||null)) { existing.pane.classList.remove('gl-stack-pane'); existing.pane.style.removeProperty('--stack-rank'); }
      existing.el = el; existing.pane = opts.pane || null;
      el.classList.add('gl-stack-surface');
      if (opts.pane) opts.pane.classList.add('gl-stack-pane');
      applyRanks(); return;
    }
    // ...（原新增邏輯）
  }
```

- [ ] **Step 3: 更新 wm-test.mjs**：持久化段不依賴 z；新增「面板 raise 蓋過視窗、視窗 raise 蓋過面板」跨類斷言（需在 wm-fixture 內也 import stack + 放一個假面板 surface，或在 panel_all stub 環境測）。最小作法：在 wm-fixture.html 加一個 `.fake-panel` 用 `stack.register('fake', el, {initialRank:99})`，測 tab 視窗 raise 後 window z > fake，fake raise 後 fake z > window。

- [ ] **Step 4: 跑全部視窗測試**
```bash
node --check script/window-manager.js
node tools/wm-test.mjs            # WM TEST OK
node tools/wm-concurrent-test.mjs # WM CONCURRENT TEST OK
node tools/stack-test.mjs         # STACK TEST OK
```

- [ ] **Step 5: commit**
```bash
git add script/window-manager.js script/stack-manager.js tools/wm-test.mjs tools/wm-fixture.html
git commit -m "feat(stack): window-manager 併入共用管理器（面板↔視窗統一疊序）"
```

---

### Task 6: CANVAS.md 契約更新

**Files:**
- Modify: `docs/CANVAS.md`

- [ ] **Step 1:** §4.2 加「動態疊序」段（resting 疊序由 stack-manager 動態管理 + 持久化；zOrder 降級初始名次；tie=陣列序僅初始）；§5 加 `cspanel.stack.<id>.v1` schema 與 reset 三合一；§7 註明視窗 z 改由 stack-manager；新增 §9 第四期刻意變更（含 `--stack-rank` class 手法、windows key 移除 z、#1/#2 修法、把手標籤）。
- [ ] **Step 2: commit**
```bash
git add docs/CANVAS.md && git commit -m "docs(canvas): CANVAS.md 補統一動態疊序契約 + 第四期變更"
```

---

### Task 7: 最終驗證 + 對抗式審查

- [ ] **Step 1: 全套回歸綠**
```bash
node tools/layout-parity.mjs capture /tmp/pf.json && node tools/layout-parity.mjs compare tools/parity-baseline.json /tmp/pf.json
for t in editbar-center drag-noshift stack wm-test wm-concurrent fudau-repro; do node tools/$t*.mjs 2>&1 | tail -1; done
```
- [ ] **Step 2: 鐵律 grep**：panel_all 無 DOCTYPE；`grep z-index style/v2/stack.css` 只有 `calc(var(--layer-panel)...)`；window-manager.js 不再 inline zIndex。
- [ ] **Step 3: whole-branch 對抗式審查**（Workflow：多 lens 找缺陷 → refute-by-default 驗證 → 修復回圈）。
- [ ] **Step 4: 驗收報告 + 使用者真登入清單**（點擊置頂跨面板/視窗、reload 還原、把手中文、reset 三合一、#1/#2 目視）。

---

## Self-Review 紀錄
- Spec 覆蓋：§2 S→Task 3/4；§3 W→Task 5；§4 L→Task 4；§5 B1→Task 1；§6 B2→Task 2；§7 契約→Task 6；§8 驗證→各 Task 測 + Task 7。
- 命名一致：`stack`（Task 3 定義、4/5 消費）、`.gl-stack-surface`/`.gl-stack-pane`/`--stack-rank`（Task 0 CSS、3 JS、5 window）、`cspanel.stack.<id>.v1`（Task 3 定義、4 reset、6 文件）。
- 已知取捨：#2 舊存檔污染不自動遷移（手動 reset，設計 §6/§9 記錄）；zorder parity 等秩性為 Task 4 硬驗收點。
