// 九期A 起家的引擎回歸；十一期合併定版改版——v1/v2 儲存分流「退役」的回歸：
// 任何呼叫形狀（單參數／殘留 storageVersion config／殘留頁旗標）都只讀寫 .v1，
// .v2 殘留 key 不讀不寫。後段為 production 頁（panel_all.html）真實貫穿斷言。
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

// ===== 1. canvas-engine：storageVersion 分流退役——任何 config 形狀恆走 .v1 =====
console.log('— canvas-engine：storageVersion 退役，恆讀寫 cspanel.layout.<id>.v1 —');
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

// 1b. 殘留 config={storageVersion:'v2'}（十一期退役）→ 忽略：仍讀 .v1，.v2 殘留位元不變
await p.goto(`${FIX}?ver=v2`);
await p.waitForFunction(() => window.__loaded === true);
pos = await probePos();
A(pos.left === '11px' && pos.top === '22px', `殘留 storageVersion='v2' 被忽略，仍讀 .v1 (11,22)（got ${JSON.stringify(pos)}）`);
let v2After = await p.evaluate((k) => localStorage.getItem(k), V2_KEY);
A(v2After === JSON.stringify({ probe: { x: 33, y: 44 } }), `.v2 殘留 key 不讀不寫、位元不變（got ${v2After}）`);

// 1d. resetLayout 恆清 .v1；.v2 殘留不碰
await p.evaluate(() => window.CanvasEdit.reset());
const v1AfterReset = await p.evaluate((k) => localStorage.getItem(k), V1_KEY);
const v2AfterReset = await p.evaluate((k) => localStorage.getItem(k), V2_KEY);
A(v1AfterReset === null, `resetLayout 清除 .v1 key（got ${v1AfterReset}）`);
A(v2AfterReset === JSON.stringify({ probe: { x: 33, y: 44 } }), `resetLayout 不碰 .v2 殘留（got ${v2AfterReset}）`);

// ===== 2. stack-manager：頁旗標退役——即使殘留旗標仍恆走 .v1 =====
console.log('— stack-manager：旗標退役，恆走 cspanel.stack.<id>.v1 —');
const STACK_V1 = 'cspanel.stack.cs.v1';
const STACK_V2 = 'cspanel.stack.cs.v2';
await p.goto('http://localhost:8123/tools/stack-fixture.html');
await p.evaluate(({ k1, k2 }) => {
  localStorage.setItem(k1, JSON.stringify({ order: ['sentinel-v1'] }));
  localStorage.removeItem(k2);
}, { k1: STACK_V1, k2: STACK_V2 });

await p.addInitScript(() => { window.CSPANEL_ENGINE_V2 = true; }); // 殘留旗標（退役後應無任何效果）
await p.reload();
await p.waitForFunction(() => !!window.__z);
await p.waitForTimeout(100);
const stackV1b = await p.evaluate((k) => localStorage.getItem(k), STACK_V1);
A(!!stackV1b && JSON.parse(stackV1b).order.length > 0, `殘留旗標下 stack-manager 仍寫 .v1 key（got ${stackV1b}）`);
const stackV2Untouched = await p.evaluate((k) => localStorage.getItem(k), STACK_V2);
A(stackV2Untouched === null, `殘留旗標下 .v2 key 從未被建立（got ${stackV2Untouched}）`);

// ===== 3. window-manager：同旗標殘留（沿用同一 page）→ 仍恆走 .v1 ====
console.log('— window-manager：旗標退役，恆走 cspanel.windows.<id>.v1 —');
const WIN_V1 = 'cspanel.windows.cs.v1';
const WIN_V2 = 'cspanel.windows.cs.v2';
await p.goto('http://localhost:8123/tools/wm-fixture.html');
await p.waitForSelector('.wm-window', { timeout: 10000 });
await p.waitForFunction(() => window.__wmReady === true, { timeout: 10000 });
await p.waitForTimeout(300);
await p.evaluate(({ k2 }) => {
  localStorage.removeItem(k2);
}, { k2: WIN_V2 });
await clickTab(p, 'classlog'); // 觸發 win.active 變更 → persist()

const winV1w = await p.evaluate((k) => localStorage.getItem(k), WIN_V1);
A(!!winV1w, `殘留旗標下 window-manager 仍寫 .v1 key（got ${winV1w}）`);
const winV2Untouched = await p.evaluate((k) => localStorage.getItem(k), WIN_V2);
A(winV2Untouched === null, `殘留旗標下 .v2 key 從未被建立（got ${winV2Untouched}）`);

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

// ===== 5. panel_all.html：合併定版後的 production 頁真實貫穿斷言 =====
console.log('— panel_all.html：quirks／常駐標題把手／.v1 持久化 —');
const BASE = process.env.PE_URL || 'http://localhost:8123';
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });

// 新 access session fixture＋order-tool-api business response。
await installAccessFixture(page);
await page.route('**/api/order-tool-api', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":false}' }));

// ===== A. 頁載入 =====
await page.goto(BASE + '/panel_all.html');
await page.waitForSelector('.canned-panel-handle', { timeout: 15000 });
A(await page.evaluate(() => window.CSPANEL_ENGINE_V2 === undefined), '頁旗標已退役（不再設置）');
A(await page.evaluate(() => document.compatMode === 'BackCompat'), 'quirks mode 契約保留（無 DOCTYPE）');
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
A(restState.padTop === '46px', `版位預留：padding-top＝原 10px ＋ --handle-h 36px（got ${restState.padTop}）`);

// 拖曳：從把手帶壓下拖 60,40 → 面板位移且寫入 .v1 layout
const optBox = await page.locator(opt).boundingBox();
await page.mouse.move(optBox.x + optBox.width / 2, optBox.y + 4); // 把手帶內（absolute 貼頂）
await page.mouse.down();
await page.mouse.move(optBox.x + optBox.width / 2 + 60, optBox.y + 4 + 40, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(100);
const afterDrag = await page.evaluate((sel) => ({
  left: document.querySelector(sel).style.left,
  v1: localStorage.getItem('cspanel.layout.cs.v1'),
}), opt);
A(parseInt(afterDrag.left, 10) > 0, `拖曳移動面板（left=${afterDrag.left}）`);
A(afterDrag.v1 && JSON.parse(afterDrag.v1).optitle, '.v1 layout 即時持久化（optitle 條目存在）');

// reload 還原
await page.reload();
await page.waitForSelector(opt + ' .gl-panel-handle', { timeout: 15000 });
const restored = await page.evaluate((sel) => {
  const saved = JSON.parse(localStorage.getItem('cspanel.layout.cs.v1')).optitle;
  const el = document.querySelector(sel);
  return { saved, actualLeft: parseInt(getComputedStyle(el).left, 10) };
}, opt);
A(Math.abs(restored.saved.x - restored.actualLeft) < 2,
  `reload 後 .v1 佈局還原（saved.x=${restored.saved.x} vs computed left=${restored.actualLeft}）`);

// ===== D. 編輯模式物理拆除＋重設入口 =====
A(await page.evaluate(() =>
  window.CanvasEdit.enter === undefined && window.CanvasEdit.exit === undefined &&
  typeof window.CanvasEdit.toggle === 'function' && typeof window.CanvasEdit.reset === 'function'),
  'CanvasEdit 只剩 toggle/reset（enter/exit 隨編輯模式物理拆除）');
page.once('dialog', (d) => d.dismiss()); // toggle 觸發 confirm → 取消
await page.evaluate(() => window.CanvasEdit.toggle());
A(await page.evaluate(() =>
  !document.documentElement.classList.contains('canvas-editing') && !document.getElementById('gl-edit-bar')),
  'toggle＝重設 confirm（取消後無任何編輯模式痕跡）');

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
A(await page.evaluate(() => getComputedStyle(document.querySelector('.optitlepanel')).paddingTop) === '46px',
  '再登入版位重新預留（padding-top 回 46px，無累加）');

// 合併定版：.v2 殘留 keys 全程不被建立（分流退役的頁級終驗）
A(await page.evaluate(() =>
  ['cspanel.layout.cs.v2', 'cspanel.windows.cs.v2', 'cspanel.stack.cs.v2']
    .every((k) => localStorage.getItem(k) === null)),
  '.v2 keys 全程未被建立（分流退役終驗）');

await page.close();

const anyFail = fails.length > 0;
await browser.close();
if (anyFail) { console.error(`\n${fails.length} FAILURES`); process.exit(1); }
console.log('\nPAGE-ENGINE-A TEST OK');
