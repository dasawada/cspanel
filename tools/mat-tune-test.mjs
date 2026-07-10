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

console.log('— 按「劇場」總預設：即時生效 —');
await p.click('.mt-preset[data-preset="theater"]');
await p.waitForTimeout(400);
s = await probe();
A(s.topShadow && s.topShadow.includes('72px'), `最上層影子換劇場檔 (${s.topShadow ? s.topShadow.slice(0, 48) : null}…)`);
A(Math.abs(parseFloat(s.nonTopOpacity) - 0.88) < 0.02, `非最上層退後至 0.88 (${s.nonTopOpacity})`);
A(s.motionAttr && s.motionMs === '260ms', `運動啟用 260ms (attr=${s.motionAttr}, ms=${s.motionMs})`);

console.log('— 輸出 spec —');
await p.click('.mt-export');
await p.waitForTimeout(200);
const spec = JSON.parse(await p.evaluate(() => document.querySelector('.mt-json').value));
A(spec['materiality-spec'] === 'v1', 'spec 版本 v1');
A(spec.elevation === 'theater' && spec.motion.ms === 260 && spec.focus === 'accent' && spec.lift === 'marked', `spec 內容正確 (${spec.elevation}/${spec.motion.ms}/${spec.focus}/${spec.lift})`);
A(spec.resolved && typeof spec.resolved['--mat-shadow-top'] === 'string', 'spec 含 resolved 實值');

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

await b.close();
if (fails.length) { console.error(`MAT TUNE TEST FAIL (${fails.length})`); process.exit(1); }
console.log('MAT TUNE TEST OK');
