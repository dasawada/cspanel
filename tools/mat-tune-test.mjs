// 材質調校面板回歸：?tune=1 顯示面板、檔位即時生效、spec 輸出、跨 reload 保留、
// 無 ?tune 時完全不套用（即使 localStorage 有存檔）。
// 需本機 server；node tools/mat-tune-test.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1800, height: 1200 } });
const fails = []; const A = (c, m) => { if (!c) { fails.push(m); console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
await p.addInitScript(() => {
  localStorage.setItem('firebase_id_token', 'x'); localStorage.setItem('cspanel.theme.v1', 'olive');
  const u = { getIdToken: async () => 'x' };
  window.firebase = { apps: [{}], initializeApp: () => {}, auth: () => ({ onAuthStateChanged: (cb) => setTimeout(() => cb(u), 50), currentUser: u, signOut: async () => {}, signInWithEmailAndPassword: async () => ({ user: u }) }), firestore: () => ({}) };
  window.verifyFireworkAuth = async () => true;
});
await p.route('**/api/order-tool-api', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":false}' }));
const ready = async () => { await p.waitForFunction(() => document.documentElement.classList.contains('auth-active'), { timeout: 15000 }); await p.waitForTimeout(2500); };
const probe = () => p.evaluate(() => {
  const surfaces = [...document.querySelectorAll('.gl-stack-surface')];
  const top = surfaces.find((s) => s.classList.contains('is-stack-top'));
  const nonTop = surfaces.find((s) => !s.classList.contains('is-stack-top'));
  return {
    panel: !!document.getElementById('mat-tune-panel'),
    surfaces: surfaces.length,
    hasTop: !!top,
    topShadow: top ? getComputedStyle(top).boxShadow.slice(0, 120) : null,
    nonTopOpacity: nonTop ? getComputedStyle(nonTop).opacity : null,
    motionAttr: document.documentElement.hasAttribute('data-mat-motion'),
    motionMs: getComputedStyle(document.documentElement).getPropertyValue('--mat-motion-ms').trim(),
  };
});

console.log('— ?tune=1：面板出現、預設全關 —');
await p.goto('http://localhost:8123/panel_all.html?tune=1');
await p.evaluate(() => localStorage.removeItem('cspanel.mat-tune.v1'));
await p.reload();
await ready();
let s = await probe();
A(s.panel, '調校面板存在');
A(s.hasTop && s.surfaces >= 8, `is-stack-top 已標記（surfaces=${s.surfaces}）`);
A(s.nonTopOpacity === '1', `預設非最上層不透明度=1 (${s.nonTopOpacity})`);
A(!s.motionAttr, '預設無 data-mat-motion');
const noGates = await p.evaluate(() => ['data-mat-elevation', 'data-mat-focus', 'data-mat-lift'].every((a) => !document.documentElement.hasAttribute(a)));
A(noGates, '預設無任何 data-mat-* 閘門屬性');

console.log('— 按「劇場」總預設：即時生效 —');
await p.click('.mt-preset[data-preset="theater"]');
await p.waitForTimeout(400);
s = await probe();
A(s.topShadow && s.topShadow.includes('72px'), `最上層影子換劇場檔 (${s.topShadow ? s.topShadow.slice(0, 48) : null}…)`);
A(Math.abs(parseFloat(s.nonTopOpacity) - 0.88) < 0.02, `非最上層退後至 0.88 (${s.nonTopOpacity})`);
A(s.motionAttr && s.motionMs === '260ms', `運動啟用 260ms (attr=${s.motionAttr}, ms=${s.motionMs})`);
const theaterExtras = await p.evaluate(() => {
  const top = [...document.querySelectorAll('.gl-stack-surface')].find((el) => el.classList.contains('is-stack-top'));
  // 審查 #5/#9：motion 開啟時 .wm-window 不得有幾何 transition（合成探針）
  const w = document.createElement('div');
  w.className = 'wm-window gl-stack-surface';
  document.body.appendChild(w);
  const wTrans = getComputedStyle(w).transitionProperty;
  w.remove();
  return {
    gates: ['data-mat-elevation', 'data-mat-focus', 'data-mat-lift', 'data-mat-motion'].every((a) => document.documentElement.hasAttribute(a)),
    topOutlineWidth: top ? getComputedStyle(top).outlineWidth : null,
    wmTransHasGeometry: /(^|, )(left|top|width|height)($|,)/.test(wTrans),
    wmTrans: wTrans,
  };
});
A(theaterExtras.gates, '劇場檔四個 data-mat-* 閘門全開');
A(theaterExtras.topOutlineWidth === '2px', `最上層聚焦外圈 2px（outline 模型）(${theaterExtras.topOutlineWidth})`);
A(!theaterExtras.wmTransHasGeometry, `.wm-window 無幾何 transition（#5/#9）(${theaterExtras.wmTrans})`);

console.log('— 輸出 spec —');
await p.click('.mt-export');
await p.waitForTimeout(200);
const spec = JSON.parse(await p.evaluate(() => document.querySelector('.mt-json').value));
A(spec['materiality-spec'] === 'v1', 'spec 版本 v1');
A(spec.elevation === 'theater' && spec.motion.ms === 260 && spec.focus === 'accent' && spec.lift === 'marked', `spec 內容正確 (${spec.elevation}/${spec.motion.ms}/${spec.focus}/${spec.lift})`);
A(spec.resolved && typeof spec.resolved['--mat-shadow-top'] === 'string', 'spec 含 resolved 實值');
A(spec.resolved['--mat-motion-ms'] === '260ms' && spec.resolved['--mat-motion-ease'].includes('cubic-bezier'), `resolved 含 motion 實值（#12）(${spec.resolved['--mat-motion-ms']})`);
A(spec.motion.easingCss && spec.motion.easingCss.includes('cubic-bezier'), `motion.easingCss 為合法 CSS（#12）`);
A(spec.resolved.gates && spec.resolved.gates['data-mat-elevation'] === true, 'resolved 含閘門狀態');

console.log('— reload（仍 ?tune=1）：調校保留 —');
await p.reload();
await ready();
s = await probe();
A(Math.abs(parseFloat(s.nonTopOpacity) - 0.88) < 0.02, `reload 後仍劇場檔 (opacity=${s.nonTopOpacity})`);

console.log('— 無 ?tune：面板不出現、調校不套用（存檔仍在也一樣）—');
await p.goto('http://localhost:8123/panel_all.html');
await ready();
s = await probe();
A(!s.panel, '面板不存在');
A(s.nonTopOpacity === '1', `調校未套用 (opacity=${s.nonTopOpacity})`);
A(!s.motionAttr, '無 data-mat-motion');
// 審查 #1：無 ?tune 時，置頂「本來無影」的 .meeting-search-panel-menu 不得憑空長出影子
const meetingShadow = await p.evaluate(() => {
  const m = document.querySelector('.meeting-search-panel-menu');
  m.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  return new Promise((res) => setTimeout(() => res({
    isTop: m.classList.contains('is-stack-top'),
    shadow: getComputedStyle(m).boxShadow,
  }), 120));
});
A(meetingShadow.isTop && meetingShadow.shadow === 'none', `置頂後 meeting 選單仍無影（#1）(top=${meetingShadow.isTop}, shadow=${meetingShadow.shadow})`);
// 審查 #2：無 ?tune 時，材質層對拖曳中元素零規則命中（合成探針：無任何 mat 影子）
const dragProbe = await p.evaluate(() => {
  const d = document.createElement('div');
  d.className = 'gl-stack-surface gl-dragging';
  document.body.appendChild(d);
  const shadow = getComputedStyle(d).boxShadow;
  d.remove();
  return shadow;
});
A(dragProbe === 'none', `無 ?tune 時 gl-dragging 無材質影（#2）(${dragProbe})`);

await b.close();
if (fails.length) { console.error(`MAT TUNE TEST FAIL (${fails.length})`); process.exit(1); }
console.log('MAT TUNE TEST OK');
