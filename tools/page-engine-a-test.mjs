// 九期A Task 1 回歸：loadCanvas config 參數化 ＋ 儲存命名空間 v1/v2 隔離。
// 骨架＋隔離斷言（Task 1 範圍：此時尚無 v2 頁——panel_all_v2.html 是 Task 2 產出——
// 這裡直接對 canvas-engine / stack-manager / window-manager 三個模組的版本選擇機制
// 本身做端對端斷言；後續 Task 於 panel_all_v2.html 增補真實頁面貫穿斷言）。
// 需本機 server（repo 根）：python3 -m http.server 8123
// 用法：node tools/page-engine-a-test.mjs
import { chromium } from 'playwright';
import { installAccessFixture } from './access-test-fixture.mjs';

const browser = await chromium.launch();
const fails = [];
const A = (c, m) => { if (!c) { fails.push(m); console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

async function clickTab(page, tabId) {
  const el = await page.$(`.wm-tab[data-tab="${tabId}"]`);
  const box = await el.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(150);
}

// ===== 1. canvas-engine：loadCanvas config → layout key 版本正確、v1/v2 互不污染 =====
console.log('— canvas-engine：loadCanvas config → cspanel.layout.<id>.<ver> —');
const p = await browser.newPage();
const FIX = 'http://localhost:8123/tools/page-engine-a-fixture.html';
const V1_KEY = 'cspanel.layout.p9a-probe.v1';
const V2_KEY = 'cspanel.layout.p9a-probe.v2';

await p.goto(FIX);
await p.evaluate(({ v1Key, v2Key }) => {
  localStorage.setItem(v1Key, JSON.stringify({ probe: { x: 11, y: 22 } }));
  localStorage.setItem(v2Key, JSON.stringify({ probe: { x: 33, y: 44 } }));
}, { v1Key: V1_KEY, v2Key: V2_KEY });

const probePos = () => p.evaluate(() => {
  const r = getComputedStyle(document.querySelector('.probe-el'));
  return { left: r.left, top: r.top };
});

// 1a. 不傳 config（loadCanvas(manifest) 單參數——逐字對應 production panel_all.html
// 的 loadCanvas(cs) 呼叫）→ 正規化預設 storageVersion:'v1' → 讀 .v1 key
await p.reload();
await p.waitForFunction(() => window.__loaded === true);
let pos = await probePos();
A(pos.left === '11px' && pos.top === '22px', `不傳 config（單參數呼叫）預設走 v1 key，讀到 (11,22)（got ${JSON.stringify(pos)}）`);

// 1b. config={storageVersion:'v2'} → 讀 .v2 key，且不動 .v1 key
await p.goto(`${FIX}?ver=v2`);
await p.waitForFunction(() => window.__loaded === true);
pos = await probePos();
A(pos.left === '33px' && pos.top === '44px', `config.storageVersion='v2' 讀到 v2 key，(33,44)（got ${JSON.stringify(pos)}）`);
let v1After = await p.evaluate((k) => localStorage.getItem(k), V1_KEY);
A(v1After === JSON.stringify({ probe: { x: 11, y: 22 } }), `v2 頁載入後 .v1 key 位元不變（got ${v1After}）`);

// 1c. 顯式 config={storageVersion:'v1'} → 仍讀 .v1 key（與省略 config 等價）
await p.goto(`${FIX}?ver=v1`);
await p.waitForFunction(() => window.__loaded === true);
pos = await probePos();
A(pos.left === '11px' && pos.top === '22px', `顯式 config.storageVersion='v1' 讀到 v1 key，(11,22)（got ${JSON.stringify(pos)}）`);

// 1d. resetLayout 走正確命名空間：v2 頁 reset 只清 .v2 key，不動 .v1 key
await p.goto(`${FIX}?ver=v2`);
await p.waitForFunction(() => window.__loaded === true);
await p.evaluate(() => window.CanvasEdit.reset());
const v1AfterReset = await p.evaluate((k) => localStorage.getItem(k), V1_KEY);
const v2AfterReset = await p.evaluate((k) => localStorage.getItem(k), V2_KEY);
A(v1AfterReset === JSON.stringify({ probe: { x: 11, y: 22 } }), `resetLayout（v2 頁）不動 .v1 key（got ${v1AfterReset}）`);
A(v2AfterReset === null, `resetLayout（v2 頁）清除 .v2 key（got ${v2AfterReset}）`);

// ===== 2. stack-manager：頁級旗標 window.CSPANEL_ENGINE_V2 → cspanel.stack.<id>.v2 =====
console.log('— stack-manager：window.CSPANEL_ENGINE_V2 → cspanel.stack.<id>.<ver> —');
const STACK_V1 = 'cspanel.stack.cs.v1';
const STACK_V2 = 'cspanel.stack.cs.v2';
await p.goto('http://localhost:8123/tools/stack-fixture.html');
await p.evaluate(({ k1, k2 }) => {
  localStorage.setItem(k1, JSON.stringify({ order: ['sentinel-v1'] }));
  localStorage.removeItem(k2);
}, { k1: STACK_V1, k2: STACK_V2 });

await p.addInitScript(() => { window.CSPANEL_ENGINE_V2 = true; }); // 套用到此 page 之後所有導覽
await p.reload();
await p.waitForFunction(() => !!window.__z);
await p.waitForTimeout(100);
const stackV2 = await p.evaluate((k) => localStorage.getItem(k), STACK_V2);
A(!!stackV2 && JSON.parse(stackV2).order.length > 0, `CSPANEL_ENGINE_V2=true 時 stack-manager 寫入 .v2 key（got ${stackV2}）`);
const stackV1Untouched = await p.evaluate((k) => localStorage.getItem(k), STACK_V1);
A(stackV1Untouched === JSON.stringify({ order: ['sentinel-v1'] }), `CSPANEL_ENGINE_V2=true 時 .v1 key 位元不變（got ${stackV1Untouched}）`);

// ===== 3. window-manager：同旗標（沿用同一 page，addInitScript 已生效）→ cspanel.windows.<id>.v2 ====
console.log('— window-manager：window.CSPANEL_ENGINE_V2 → cspanel.windows.<id>.<ver> —');
const WIN_V1 = 'cspanel.windows.cs.v1';
const WIN_V2 = 'cspanel.windows.cs.v2';
await p.goto('http://localhost:8123/tools/wm-fixture.html');
await p.waitForSelector('.wm-window', { timeout: 10000 });
await p.waitForFunction(() => window.__wmReady === true, { timeout: 10000 });
await p.waitForTimeout(300);
await p.evaluate(({ k1, k2 }) => {
  localStorage.setItem(k1, JSON.stringify({ sentinel: 'v1' }));
  localStorage.removeItem(k2);
}, { k1: WIN_V1, k2: WIN_V2 });
await clickTab(p, 'classlog'); // 觸發 win.active 變更 → persist()

const winV2 = await p.evaluate((k) => localStorage.getItem(k), WIN_V2);
A(!!winV2 && winV2 !== JSON.stringify({ sentinel: 'v1' }), `CSPANEL_ENGINE_V2=true 時 window-manager 寫入 .v2 key（got ${winV2}）`);
const winV1Untouched = await p.evaluate((k) => localStorage.getItem(k), WIN_V1);
A(winV1Untouched === JSON.stringify({ sentinel: 'v1' }), `CSPANEL_ENGINE_V2=true 時 .v1 key 位元不變（got ${winV1Untouched}）`);

// ===== 4. 旗標關閉（production 現況，全新分頁避免沿用 addInitScript）：全走 .v1 ====
console.log('— 未設旗標（production 現況）：stack/window-manager 仍走 .v1 —');
const p2 = await browser.newPage();
await p2.goto('http://localhost:8123/tools/wm-fixture.html');
await p2.evaluate(({ k1, k2 }) => { localStorage.removeItem(k1); localStorage.removeItem(k2); }, { k1: WIN_V1, k2: WIN_V2 });
await p2.reload();
await p2.waitForSelector('.wm-window', { timeout: 10000 });
await p2.waitForFunction(() => window.__wmReady === true, { timeout: 10000 });
await p2.waitForTimeout(300);
await clickTab(p2, 'classlog');
const win1b = await p2.evaluate((k) => localStorage.getItem(k), WIN_V1);
const win2b = await p2.evaluate((k) => localStorage.getItem(k), WIN_V2);
A(!!win1b, `未設旗標時 window-manager 仍寫 .v1 key（got ${win1b}）`);
A(win2b === null, `未設旗標時 .v2 key 從未被建立（got ${win2b}）`);

// ===== 5. panel_all_v2.html：v2 頁載入、旗標、quirks、儲存隔離（真實頁面貫穿斷言）=====
// 九期A 回歸：v2 平行頁（hover 把手基座）。
console.log('— panel_all_v2.html：v2 旗標／quirks／儲存隔離 —');
const BASE = process.env.PE_URL || 'http://localhost:8123';
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });

// 新 access session fixture＋order-tool-api business response。
await installAccessFixture(page);
await page.route('**/api/order-tool-api', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":false}' }));

// ===== A. v2 頁載入與旗標 =====
await page.goto(BASE + '/panel_all_v2.html');
await page.waitForSelector('.canned-panel-handle', { timeout: 15000 });
A(await page.evaluate(() => window.CSPANEL_ENGINE_V2 === true), 'v2 旗標生效');
A(await page.evaluate(() => document.compatMode === 'BackCompat'), 'quirks mode 契約保留（無 DOCTYPE）');

// ===== B. 儲存隔離：v2 頁操作不觸 v1 keys =====
const v1Snapshot = await page.evaluate(() =>
  JSON.stringify(['cspanel.layout.cs.v1', 'cspanel.windows.cs.v1', 'cspanel.stack.cs.v1']
    .map((k) => [k, localStorage.getItem(k)])));
// ===== C. 常駐標題把手（十一期：hover 浮現退役）：版位預留、可拖、即時持久化 =====
const opt = '.optitlepanel'; // 標題生成面板：一般面板代表
await page.waitForSelector(opt, { timeout: 10000 });
const handleCount = await page.evaluate((sel) =>
  document.querySelector(sel).querySelectorAll('.gl-panel-handle').length, opt);
A(handleCount === 1, `一般面板有常駐標題把手（實得 ${handleCount}）`);
A(await page.evaluate(() =>
  document.querySelector('.canned-panel .gl-panel-handle') === null), '罐頭不重複生成（自帶把手）');

// 常態：把手常駐可見、可互動、標題＝manifest label、版位已預留（padding-top ＋36）
const restState = await page.evaluate((sel) => {
  const el = document.querySelector(sel);
  const h = el.querySelector('.gl-panel-handle');
  const cs = getComputedStyle(h);
  return {
    op: cs.opacity, pe: cs.pointerEvents, cls: h.classList.contains('draggable-handle'),
    text: h.textContent, padTop: getComputedStyle(el).paddingTop,
  };
}, opt);
A(restState.op === '1' && restState.pe !== 'none', `常駐可見且可互動（op=${restState.op} pe=${restState.pe}）`);
A(restState.cls, '把手帶掛 .draggable-handle 詞彙');
A(restState.text === '標題生成', `標題＝manifest label（${restState.text}）`);
A(restState.padTop === '36px', `版位預留：padding-top 取代為 --handle-h 36px（回饋輪 2：帶下不留原 padding 空隙，got ${restState.padTop}）`);

// 回饋輪 3④：會議 nav 就地改建 segtab strip——strip 即拖曳面（handleSelector）
const meetSel = '.meeting-search-panel-menu';
const meetState = await page.evaluate((sel) => {
  const el = document.querySelector(sel);
  const strip = el.querySelector('.gl-segtab');
  const cs = strip ? getComputedStyle(strip) : null;
  return {
    band: !!el.querySelector('.gl-panel-handle'),
    navGone: !el.querySelector('nav'),
    stripBound: strip ? strip.dataset.glHandleBound : null,
    padTop: getComputedStyle(el).paddingTop,
    cursor: cs && cs.cursor,
    // 方角根因回歸：makeDraggable 不得把把手詞彙 class 掛上 strip（handleChrome:false）
    chromeLeak: strip ? strip.classList.contains('draggable-handle') : null,
    radiusBL: cs && cs.borderBottomLeftRadius,
    thumbFirst: strip ? strip.firstElementChild?.classList.contains('gl-segtab__thumb') : null,
    tabs: strip ? [...strip.querySelectorAll('.gl-segtab__tab')].map((b) => b.dataset.target) : [],
    badgeInTab: !!el.querySelector('.gl-segtab__tab #settings-button.gl-segtab__badge'),
  };
}, meetSel);
A(!meetState.band, '會議面板不生成標題帶（自帶 strip）');
A(meetState.navGone, 'nav 結構已退役（v2 就地改建）');
A(meetState.stripBound === '1', `strip 已綁定為拖曳面（got ${meetState.stripBound}）`);
A(meetState.padTop === '0px', `會議面板不佔版位（padding-top=${meetState.padTop}）`);
A(meetState.cursor === 'grab', `strip 帶 grab cursor（got ${meetState.cursor}）`);
A(meetState.chromeLeak === false, '把手詞彙 class 未滲入 strip（handleChrome:false——方角根因回歸）');
A(meetState.radiusBL === '10px', `軌道下緣圓角完整（border-bottom-left-radius=${meetState.radiusBL}）`);
A(meetState.thumbFirst === true, 'thumb 為 strip 首子節點（DOM 序分層）');
A(JSON.stringify(meetState.tabs) === JSON.stringify(['meeting-now-search', 'meeting-check-search', 'all-meeting-search-panel']),
  `三分頁齊備（got ${meetState.tabs}）`);
A(meetState.badgeInTab, '衝堂警示 ⚠️ 移入分頁 badge 槽');
// 拖 strip 空白處（右緣內縮 8px，分頁 button 靠左、右側為空白）→ 面板位移並寫入 v2 layout
const meetBox = await page.locator(meetSel + ' .gl-segtab').boundingBox();
await page.mouse.move(meetBox.x + meetBox.width - 8, meetBox.y + meetBox.height / 2);
await page.mouse.down();
await page.mouse.move(meetBox.x + meetBox.width - 8 - 50, meetBox.y + meetBox.height / 2 + 30, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(150);
const meetAfter = await page.evaluate(() => ({
  left: document.querySelector('.meeting-search-panel-menu').style.left,
  saved: JSON.parse(localStorage.getItem('cspanel.layout.cs.v2') || '{}')['meeting-shell'] || null,
}));
A(!!meetAfter.left && !!meetAfter.saved, `拖 strip 移動會議面板並持久化（left=${meetAfter.left} saved=${JSON.stringify(meetAfter.saved)}）`);
// 互動子元素防護：分頁 button 點擊仍是點擊（不觸發拖曳、不被事件盾吃掉）＋ thumb 滑移
const meetPosBefore = await page.evaluate(() => ({
  left: document.querySelector('.meeting-search-panel-menu').style.left,
  thumbX: document.querySelector('.meeting-search-panel-menu .gl-segtab').style.getPropertyValue('--segtab-thumb-x'),
}));
await page.click('.meeting-search-panel-menu .gl-segtab__tab[data-target="meeting-check-search"]');
await page.waitForTimeout(650);
const stripClick = await page.evaluate(() => {
  const strip = document.querySelector('.meeting-search-panel-menu .gl-segtab');
  const active = strip.querySelector('.gl-segtab__tab.is-active');
  return {
    active: document.querySelector('#meeting-check-search')?.classList.contains('active') || false,
    left: document.querySelector('.meeting-search-panel-menu').style.left,
    thumbX: strip.style.getPropertyValue('--segtab-thumb-x'),
    thumbCovers: Math.abs(parseFloat(strip.style.getPropertyValue('--segtab-thumb-x')) - active.offsetLeft) < 1,
    activeTarget: active.dataset.target,
  };
});
A(stripClick.active && stripClick.activeTarget === 'meeting-check-search', '分頁 button 點擊切換 section（互動防護生效）');
A(stripClick.left === meetPosBefore.left, `分頁點擊不位移面板（${meetPosBefore.left} → ${stripClick.left}）`);
A(stripClick.thumbX !== meetPosBefore.thumbX && stripClick.thumbCovers, `thumb 滑移到新分頁（${meetPosBefore.thumbX} → ${stripClick.thumbX}）`);

// 拖曳：從把手帶壓下拖 60,40 → 面板位移且寫入 v2 layout
const optBox = await page.locator(opt).boundingBox();
await page.mouse.move(optBox.x + optBox.width / 2, optBox.y + 4); // 把手帶內（absolute 貼頂）
await page.mouse.down();
await page.mouse.move(optBox.x + optBox.width / 2 + 60, optBox.y + 4 + 40, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(100);
const afterDrag = await page.evaluate((sel) => ({
  left: document.querySelector(sel).style.left,
  v2: localStorage.getItem('cspanel.layout.cs.v2'),
}), opt);
A(parseInt(afterDrag.left, 10) > 0, `拖曳移動面板（left=${afterDrag.left}）`);
A(afterDrag.v2 && JSON.parse(afterDrag.v2).optitle, 'v2 layout 即時持久化（optitle 條目存在）');

// reload 還原
await page.reload();
await page.waitForSelector(opt + ' .gl-panel-handle', { timeout: 15000 });
const restored = await page.evaluate((sel) => {
  const saved = JSON.parse(localStorage.getItem('cspanel.layout.cs.v2')).optitle;
  const el = document.querySelector(sel);
  return { saved, actualLeft: parseInt(getComputedStyle(el).left, 10) };
}, opt);
A(Math.abs(restored.saved.x - restored.actualLeft) < 2,
  `reload 後 v2 佈局還原（saved.x=${restored.saved.x} vs computed left=${restored.actualLeft}）`);

// ===== D. 編輯模式停用＋重設入口 =====
await page.evaluate(() => window.CanvasEdit.enter());
A(await page.evaluate(() =>
  !document.documentElement.classList.contains('canvas-editing')), 'v2 模式 enterEditMode 為 no-op');
page.once('dialog', (d) => d.dismiss()); // toggle 觸發 confirm → 取消
await page.evaluate(() => window.CanvasEdit.toggle());
A(await page.evaluate(() =>
  !document.documentElement.classList.contains('canvas-editing')), 'toggle 不進編輯模式（改重設 confirm）');

// ===== E. 登出→再登入：常駐標題把手冪等重建（真實 lifecycle 事件路徑）=====
const afterLogout = await page.evaluate(() => {
  window.dispatchEvent(new CustomEvent('firework-logout-success'));
  // 面板 DOM 隨模組 clear 一併消滅（版位歸還的 inline padding 還原只對「跨登出
  // 存活的 DOM」有意義，而這類面板不經引擎把手）——只驗把手歸零
  return document.querySelectorAll('.gl-panel-handle').length;
});
A(afterLogout === 0, `登出清空標題把手（實得 ${afterLogout}）`);
await page.evaluate(() => window.dispatchEvent(new CustomEvent('firework-login-success')));
await page.waitForFunction(() => document.querySelectorAll('.gl-panel-handle').length > 0, { timeout: 10000 });
const dup = await page.evaluate(() =>
  [...document.querySelectorAll('.gl-panel-handle')].some((h) => h.parentElement.querySelectorAll('.gl-panel-handle').length !== 1));
A(!dup, '再登入冪等重建（每面板恰一組把手，無重複掛載）');
A(await page.evaluate(() => getComputedStyle(document.querySelector('.optitlepanel')).paddingTop) === '36px',
  '再登入版位重新預留（padding-top 回 36px，無累加）');

// 最終隔離快照刻意放在 E 區之後：登出/登入整輪擾動也不得觸 v1 keys
const v2PageV1After = await page.evaluate(() =>
  JSON.stringify(['cspanel.layout.cs.v1', 'cspanel.windows.cs.v1', 'cspanel.stack.cs.v1']
    .map((k) => [k, localStorage.getItem(k)])));
A(v1Snapshot === v2PageV1After, 'v1 keys 位元不變（隔離鐵律，含登出登入循環後）');

await page.close();

const anyFail = fails.length > 0;
await browser.close();
if (anyFail) { console.error(`\n${fails.length} FAILURES`); process.exit(1); }
console.log('\nPAGE-ENGINE-A TEST OK');
