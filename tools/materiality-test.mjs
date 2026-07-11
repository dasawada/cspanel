// 材質層（已烘焙 materiality-spec v1）回歸：清晰高度 + 邊框微亮 + 微浮 + 無運動。
// 驗證烘焙後的恆真行為與審查定案的排除條款。需本機 server；node tools/materiality-test.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1800, height: 1200 } });
const fails = []; const A = (c, m) => { if (!c) { fails.push(m); console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
await p.addInitScript(() => {
  localStorage.setItem('firebase_id_token', 'x'); localStorage.setItem('cspanel.theme.v1', 'olive');
  localStorage.removeItem('cspanel.stack.cs.v1');
  const u = { getIdToken: async () => 'x' };
  window.firebase = { apps: [{}], initializeApp: () => {}, auth: () => ({ onAuthStateChanged: (cb) => setTimeout(() => cb(u), 50), currentUser: u, signOut: async () => {}, signInWithEmailAndPassword: async () => ({ user: u }) }), firestore: () => ({}) };
  window.verifyFireworkAuth = async () => true;
});
await p.route('**/api/order-tool-api', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":false}' }));
await p.goto('http://localhost:8123/panel_all.html');
await p.waitForFunction(() => document.documentElement.classList.contains('auth-active'), { timeout: 15000 });
await p.waitForTimeout(2500);

console.log('— 烘焙行為：置頂面板拿清晰影 + 微亮框，其餘退 0.93 —');
await p.evaluate(() => document.querySelector('.optitlepanel').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
await p.waitForTimeout(150);
let s = await p.evaluate(() => {
  const top = document.querySelector('.optitlepanel');
  const other = document.querySelector('.linkout');
  return {
    topIsTop: top.classList.contains('is-stack-top'),
    topShadow: getComputedStyle(top).boxShadow.slice(0, 80),
    topOutline: getComputedStyle(top).outlineWidth,
    otherOpacity: getComputedStyle(other).opacity,
  };
});
A(s.topIsTop, '點擊的面板成為 is-stack-top');
A(s.topShadow.includes('48px'), `置頂面板影子=清晰檔 (${s.topShadow.slice(0, 44)}…)`);
A(s.topOutline === '1px', `置頂面板邊框微亮 1px (${s.topOutline})`);
A(Math.abs(parseFloat(s.otherOpacity) - 0.93) < 0.02, `非置頂面板退後 0.93 (${s.otherOpacity})`);

console.log('— 排除條款仍守 —');
// meeting 選單（透明無影容器）置頂不得長影/框
const meeting = await p.evaluate(() => {
  const m = document.querySelector('.meeting-search-panel-menu');
  m.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  return new Promise((res) => setTimeout(() => res({
    isTop: m.classList.contains('is-stack-top'),
    shadow: getComputedStyle(m).boxShadow,
    outline: getComputedStyle(m).outlineStyle,
  }), 120));
});
A(meeting.isTop && meeting.shadow === 'none' && meeting.outline === 'none', `meeting 選單置頂仍無影無框 (shadow=${meeting.shadow}, outline=${meeting.outline})`);
// hover 豁免：滑過非置頂面板 → 不退暗
await p.hover('.fudausearch-container');
await p.waitForTimeout(80);
const hovered = await p.evaluate(() => getComputedStyle(document.querySelector('.fudausearch-container')).opacity);
A(hovered === '1', `hover 中的非置頂面板不退暗 (${hovered})`);
await p.mouse.move(10, 900); // 移開
// 拖曳浮起：合成 gl-dragging → 微浮影（44px）
const drag = await p.evaluate(() => {
  const d = document.createElement('div');
  d.className = 'gl-stack-surface gl-dragging';
  document.body.appendChild(d);
  const shadow = getComputedStyle(d).boxShadow;
  d.remove();
  return shadow;
});
A(drag.includes('44px'), `gl-dragging 拿微浮影 (${drag.slice(0, 44)}…)`);

console.log('— 運動軸=無、面板已退役 —');
const off = await p.evaluate(() => ({
  attrs: ['data-mat-elevation', 'data-mat-focus', 'data-mat-lift', 'data-mat-motion'].some((a) => document.documentElement.hasAttribute(a)),
  panel: !!document.getElementById('mat-tune-panel'),
}));
A(!off.attrs, '無任何 data-mat-* 屬性（閘門已烘焙為恆真/移除）');
A(!off.panel, '調校面板已退役');

await b.close();
if (fails.length) { console.error(`MATERIALITY TEST FAIL (${fails.length})`); process.exit(1); }
console.log('MATERIALITY TEST OK');
