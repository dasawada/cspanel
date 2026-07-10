// 子專案 B 回歸測試：以 tools/wm-fixture.html（真實伺服器 markup）headless
// 驗證分頁視窗管理器：常駐池、切 tab、撕離、合併、重排、縮放對位、display:none
// 不重載、持久化還原、重設回預設。需本機 server（repo 根）：
//   python3 -m http.server 8123
//   node tools/wm-test.mjs
import { chromium } from 'playwright';

const URL_ = process.env.WM_URL || 'http://localhost:8123/tools/wm-fixture.html';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
const fails = [];
const assert = (cond, msg) => { if (!cond) { fails.push(msg); console.error('  ✗ ' + msg); } else { console.log('  ✓ ' + msg); } };

async function ready() {
  await page.waitForSelector('.wm-window', { timeout: 10000 });
  await page.waitForFunction(() => window.__wmReady === true, { timeout: 10000 });
  await page.waitForTimeout(700); // 讓初次 iframe 載入落定
}
const snapshot = () => page.evaluate(() =>
  [...document.querySelectorAll('.wm-window')].map((win) => {
    const r = win.getBoundingClientRect();
    const act = win.querySelector('.wm-tab.is-active');
    return {
      tabs: [...win.querySelectorAll('.wm-tab')].map((t) => t.dataset.tab),
      active: act ? act.dataset.tab : null,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    };
  }));
const loadSum = () => page.evaluate(() =>
  [...document.querySelectorAll('.wm-pane iframe')].reduce((s, f) => s + (+f.dataset.loads || 0), 0));
const paneCount = () => page.evaluate(() => document.querySelectorAll('.wm-pane').length);
const visiblePanes = () => page.evaluate(() =>
  [...document.querySelectorAll('.wm-pane')].filter((p) => p.style.display !== 'none').map((p) => p.dataset.tab));
async function tabCenter(winIdx, tabId) {
  return page.evaluate(([i, t]) => {
    const win = document.querySelectorAll('.wm-window')[i];
    const tab = win.querySelector(`.wm-tab[data-tab="${t}"]`);
    const r = tab.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, [winIdx, tabId]);
}
async function resizeHandleCenter(winIdx) {
  return page.evaluate((i) => {
    const win = document.querySelectorAll('.wm-window')[i];
    const h = win.querySelector('.wm-resize-se');
    const r = h.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, winIdx);
}
async function drag(from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(120);
}
async function clickTab(winIdx, tabId) {
  const c = await tabCenter(winIdx, tabId);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(120);
}
async function alignment(winIdx) {
  return page.evaluate((i) => {
    const win = document.querySelectorAll('.wm-window')[i];
    const content = win.querySelector('.wm-content').getBoundingClientRect();
    const act = win.querySelector('.wm-tab.is-active').dataset.tab;
    const pane = document.querySelector(`.wm-pane[data-tab="${act}"]`).getBoundingClientRect();
    return {
      dl: Math.abs(content.left - pane.left), dt: Math.abs(content.top - pane.top),
      dw: Math.abs(content.width - pane.width), dh: Math.abs(content.height - pane.height),
    };
  }, winIdx);
}

// 乾淨起點：清持久化 key 後重載成預設
await page.goto(URL_);
await page.evaluate(() => { localStorage.removeItem('cspanel.windows.cs.v1'); localStorage.removeItem('cspanel.stack.cs.v1'); });
await page.reload();
await ready();

console.log('— 初始狀態（常駐池 + 單視窗四 tab）—');
let s = await snapshot();
assert(s.length === 1, `1 window (got ${s.length})`);
assert(JSON.stringify(s[0]?.tabs) === JSON.stringify(['naniclub', 'classlog', 'courselog', 'tools']), `tabs order = ${JSON.stringify(s[0]?.tabs)}`);
assert(s[0]?.active === 'naniclub', `active = ${s[0]?.active}`);
assert((await paneCount()) === 4, `4 panes (got ${await paneCount()})`);
assert(JSON.stringify(await visiblePanes()) === JSON.stringify(['naniclub']), `visible pane = ${JSON.stringify(await visiblePanes())}`);
assert(Math.abs(s[0].rect.x - 410) <= 2 && Math.abs(s[0].rect.y - 160) <= 2, `initial pos ~ (410,160) got (${s[0].rect.x},${s[0].rect.y})`);

const base = await loadSum();
console.log(`  (iframe load baseline = ${base})`);

console.log('— 跨類統一疊序（面板 ↔ tab 視窗，第四期併入）—');
const zc = () => page.evaluate(() => {
  const winZ = parseInt(getComputedStyle(document.querySelector('.wm-window')).zIndex, 10);
  const act = document.querySelector('.wm-window .wm-tab.is-active').dataset.tab;
  const paneZ = parseInt(getComputedStyle(document.querySelector(`.wm-pane[data-tab="${act}"]`)).zIndex, 10);
  const fakeZ = parseInt(getComputedStyle(document.querySelector('.fake-panel')).zIndex, 10);
  return { winZ, paneZ, fakeZ };
});
let zz = await zc();
assert(zz.paneZ > zz.fakeZ, `初始視窗 pane 疊在面板之上 (pane=${zz.paneZ}, fake=${zz.fakeZ})`);
await page.evaluate(() => window.__stack.raise('fake')); // 點面板 → 面板置頂
await page.waitForTimeout(60);
zz = await zc();
assert(zz.fakeZ > zz.winZ && zz.fakeZ > zz.paneZ, `raise 面板後面板蓋過視窗 (fake=${zz.fakeZ}, win=${zz.winZ}, pane=${zz.paneZ})`);
const barPt = await page.evaluate(() => { const b = document.querySelector('.wm-window .wm-tabbar').getBoundingClientRect(); return { x: b.right - 4, y: b.top + b.height / 2 }; });
await page.mouse.move(barPt.x, barPt.y); await page.mouse.down(); await page.mouse.up(); // 點視窗 → 視窗置頂
await page.waitForTimeout(80);
zz = await zc();
assert(zz.winZ > zz.fakeZ && zz.paneZ > zz.fakeZ, `raise 視窗後視窗蓋過面板 (win=${zz.winZ}, pane=${zz.paneZ}, fake=${zz.fakeZ})`);

console.log('— 切 tab（display:none 不重載）—');
await clickTab(0, 'classlog');
s = await snapshot();
assert(s[0].active === 'classlog', `active after switch = ${s[0].active}`);
assert(JSON.stringify(await visiblePanes()) === JSON.stringify(['classlog']), `visible pane = ${JSON.stringify(await visiblePanes())}`);
assert((await loadSum()) === base, `no reload on switch (delta ${await loadSum() - base})`);

console.log('— a11y（tablist 角色 + roving tabindex + 鍵盤切換不重載）—');
const aria = await page.evaluate(() => {
  const bar = document.querySelector('.wm-tabbar');
  const tabs = [...bar.querySelectorAll('.wm-tab')];
  return {
    barRole: bar.getAttribute('role'),
    tabRoles: tabs.every((t) => t.getAttribute('role') === 'tab'),
    selected: tabs.filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.dataset.tab),
    roving: tabs.every((t) => (t.getAttribute('aria-selected') === 'true' ? t.tabIndex === 0 : t.tabIndex === -1)),
  };
});
assert(aria.barRole === 'tablist', `tabbar role=tablist (got ${aria.barRole})`);
assert(aria.tabRoles, `all tabs role=tab`);
assert(aria.selected.length === 1 && aria.selected[0] === 'classlog', `aria-selected 唯一且=active (${JSON.stringify(aria.selected)})`);
assert(aria.roving, `roving tabindex（active=0 其餘 -1）`);
await page.evaluate(() => document.querySelector('.wm-tab.is-active').focus());
await page.keyboard.press('ArrowRight');
await page.keyboard.press('Enter');
await page.waitForTimeout(120);
s = await snapshot();
assert(s[0].active === 'courselog', `方向鍵+Enter 切到下一 tab (active=${s[0].active})`);
assert((await loadSum()) === base, `鍵盤切換不重載 iframe (delta ${await loadSum() - base})`);
const focusRestored = await page.evaluate(() => document.activeElement && document.activeElement.dataset && document.activeElement.dataset.tab);
assert(focusRestored === 'courselog', `重繪後焦點還在同一顆 tab (focus=${focusRestored})`);
await clickTab(0, 'classlog'); // 還原狀態給後續測試

console.log('— 初始對位（作用中 pane 貼合內容區）—');
let a = await alignment(0);
assert(a.dl < 1.5 && a.dt < 1.5 && a.dw < 1.5 && a.dh < 1.5, `pane aligns content ${JSON.stringify(a)}`);

console.log('— 縮放 + 縮放後對位 —');
const rh = await resizeHandleCenter(0);
await drag(rh, { x: rh.x + 90, y: rh.y + 70 });
s = await snapshot();
assert(s[0].rect.w >= 560 && s[0].rect.h >= 640, `window grew to ${s[0].rect.w}x${s[0].rect.h}`);
a = await alignment(0);
assert(a.dl < 1.5 && a.dt < 1.5 && a.dw < 1.5 && a.dh < 1.5, `pane re-aligns after resize ${JSON.stringify(a)}`);
assert((await loadSum()) === base, `no reload on resize (delta ${await loadSum() - base})`);

console.log('— 撕離 courselog 成新視窗 —');
let from = await tabCenter(0, 'courselog');
await drag(from, { x: 1350, y: 880 });
s = await snapshot();
assert(s.length === 2, `2 windows after tear (got ${s.length})`);
const torn = s.find((w) => w.tabs.length === 1 && w.tabs[0] === 'courselog');
assert(!!torn, `torn window has [courselog] (${JSON.stringify(s.map((w) => w.tabs))})`);
assert(!s[0].tabs.includes('courselog'), `source no longer has courselog`);
assert((await loadSum()) === base, `no reload on tear (delta ${await loadSum() - base})`);

console.log('— 拖回合併 —');
const tornIdx = (await snapshot()).findIndex((w) => w.tabs.length === 1 && w.tabs[0] === 'courselog');
from = await tabCenter(tornIdx, 'courselog');
const target = await tabCenter((await snapshot()).findIndex((w) => w.tabs.includes('classlog')), 'classlog');
await drag(from, { x: target.x + 60, y: target.y });
s = await snapshot();
assert(s.length === 1, `1 window after merge (got ${s.length})`);
assert(s[0].tabs.includes('courselog') && s[0].tabs.length === 4, `merged window has 4 tabs (${JSON.stringify(s[0].tabs)})`);
assert((await loadSum()) === base, `no reload on merge (delta ${await loadSum() - base})`);
// 一般 sanity：合併後接手的 active pane 必須可見（有 .gl-stack-pane class、z 疊在自己
// 視窗之上）。（#1/#2 的精確換手觸發由 stack-test 的 paneHandoff 單元測試覆蓋。）
const mp = await page.evaluate(() => {
  const win = document.querySelector('.wm-window');
  const act = win.querySelector('.wm-tab.is-active').dataset.tab;
  const pane = document.querySelector(`.wm-pane[data-tab="${act}"]`);
  return { hasClass: pane.classList.contains('gl-stack-pane'), paneZ: parseInt(getComputedStyle(pane).zIndex, 10), winZ: parseInt(getComputedStyle(win).zIndex, 10) };
});
assert(mp.hasClass && mp.paneZ > mp.winZ, `合併後 active pane 可見(class=${mp.hasClass}, pane z=${mp.paneZ} > win z=${mp.winZ})（審查 #1/#2）`);
// 審查 #4/#6：被清空的來源視窗須從 stack 卸除，order 不得洩漏死 key
const orderLen = await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('cspanel.stack.cs.v1')); return o ? o.order.length : -1; });
assert(orderLen === 2, `合併後 stack order 無死 key 洩漏 (len=${orderLen}, 期望 2=視窗+假面板)（審查 #4/#6）`);

console.log('— 同視窗重排：精確落點（off-by-one 防護，審查 #2）—');
// 先 reset 取乾淨預設序 [naniclub,classlog,courselog,tools]
await page.evaluate(() => window.WindowManager.reset());
await page.waitForTimeout(150);
// 拖 naniclub 到 courselog 左半 → 應插在 classlog 與 courselog「之間」，不是之後
from = await tabCenter(0, 'naniclub');
const dropLeftOfCourse = await page.evaluate(() => {
  const t = document.querySelector('.wm-window .wm-tab[data-tab="courselog"]').getBoundingClientRect();
  return { x: t.left + t.width * 0.25, y: t.top + t.height / 2 };
});
await drag(from, dropLeftOfCourse);
let ord = (await snapshot())[0].tabs;
assert(JSON.stringify(ord) === JSON.stringify(['classlog', 'naniclub', 'courselog', 'tools']),
  `mid 重排精確落點 = ${JSON.stringify(ord)}`);
// 拖到最右端 → 落在最後
from = await tabCenter(0, 'classlog');
const barRight = await page.evaluate(() => {
  const bar = document.querySelector('.wm-window .wm-tabbar').getBoundingClientRect();
  return { x: bar.right - 6, y: bar.top + bar.height / 2 };
});
await drag(from, barRight);
ord = (await snapshot())[0].tabs;
assert(ord[ord.length - 1] === 'classlog' && ord.length === 4 && new Set(ord).size === 4,
  `末端重排 = ${JSON.stringify(ord)}`);

console.log('— 持久化：撕離後重載還原（含幾何 x/y/w/h，非只拓樸）—');
from = await tabCenter(0, 'tools');
await drag(from, { x: 1300, y: 300 });
const pre = await snapshot();
assert(pre.length === 2, `2 windows before reload`);
const tornPre = pre.find((w) => w.tabs.length === 1 && w.tabs[0] === 'tools');
assert(!!tornPre, `torn 'tools' window exists before reload`);
await page.reload();
await ready();
s = await snapshot();
assert(s.length === 2, `2 windows restored after reload (got ${s.length})`);
const tornPost = s.find((w) => w.tabs.length === 1 && w.tabs[0] === 'tools');
assert(!!tornPost, `torn 'tools' window restored`);
if (tornPre && tornPost) {
  const dx = Math.abs(tornPre.rect.x - tornPost.rect.x);
  const dy = Math.abs(tornPre.rect.y - tornPost.rect.y);
  const dw = Math.abs(tornPre.rect.w - tornPost.rect.w);
  const dh = Math.abs(tornPre.rect.h - tornPost.rect.h);
  assert(dx <= 2 && dy <= 2 && dw <= 2 && dh <= 2,
    `torn window 幾何跨 reload 還原(≤2px): pre=${JSON.stringify(tornPre.rect)} post=${JSON.stringify(tornPost.rect)}`);
}

console.log('— 重設回預設 —');
await page.evaluate(() => window.WindowManager.reset());
await page.waitForTimeout(150);
s = await snapshot();
assert(s.length === 1, `1 window after reset (got ${s.length})`);
assert(s[0].tabs.length === 4, `reset window has 4 tabs (${JSON.stringify(s[0].tabs)})`);

await browser.close();
if (fails.length) { console.error(`\nWM TEST FAIL (${fails.length})`); process.exit(1); }
console.log('\nWM TEST OK');
