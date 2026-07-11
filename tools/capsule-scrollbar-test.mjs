// 第六期回歸：膠囊輸入詞彙（單一定位機制、垂直置中）+ 捲軸單一權威（標準屬性）。
// 需本機 server；node tools/capsule-scrollbar-test.mjs
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

const centered = (btnSel, refSel) => p.evaluate(([bs, rs]) => {
  const btn = document.querySelector(bs), ref = document.querySelector(rs);
  if (!btn || !ref) return { err: `missing ${!btn ? bs : rs}` };
  const br = btn.getBoundingClientRect(), rr = ref.getBoundingClientRect();
  const cs = getComputedStyle(btn);
  return {
    mech: cs.position === 'absolute' && cs.top === '50%'.replace('%','%') ? 'abs' : cs.position,
    position: cs.position,
    dCenter: Math.abs((br.top + br.height / 2) - (rr.top + rr.height / 2)),
    inRef: br.right <= rr.right + 1 && br.left >= rr.left - 1,
  };
}, [btnSel, refSel]);

console.log('— panel_all：fudausearch clear（膠囊機制 + 置中）—');
await p.goto('http://localhost:8123/panel_all.html');
await p.waitForFunction(() => document.documentElement.classList.contains('auth-active'), { timeout: 15000 });
await p.waitForTimeout(2500);
let r = await centered('#fudausearch-clear-btn', '#fudausearch-input');
A(!r.err && r.position === 'absolute', `clear 鈕走 absolute 機制 (${r.err || r.position})`);
A(r.dCenter <= 2, `clear 鈕垂直置中於輸入框 ±2px (Δ=${r.dCenter && r.dCenter.toFixed(1)})`);
A(r.inRef, `clear 鈕落在輸入框水平範圍內`);

console.log('— panel_all：canned clear（同一機制、局部 inset token）—');
await p.evaluate(() => { const el = document.querySelector('.canned-panel-clear-btn'); el.style.display = 'flex'; });
await p.waitForTimeout(80);
r = await centered('.canned-panel-clear-btn', '.canned-panel-search-input');
A(!r.err && r.position === 'absolute', `canned clear 走 absolute 機制 (${r.err || r.position})`);
A(r.dCenter <= 2, `canned clear 垂直置中 ±2px (Δ=${r.dCenter && r.dCenter.toFixed(1)})`);
A(r.inRef, `canned clear 落在輸入框水平範圍內（--capsule-inset:42px 局部參數）`);
const cannedInset = await p.evaluate(() => getComputedStyle(document.querySelector('.canned-panel-clear-btn')).getPropertyValue('inset-inline-end') || getComputedStyle(document.querySelector('.canned-panel-clear-btn')).right);
A(parseInt(cannedInset, 10) === 42, `canned inset token 生效 (${cannedInset})`);

console.log('— 捲軸單一權威（標準屬性）—');
const sb = await p.evaluate(() => ({
  width: getComputedStyle(document.documentElement).scrollbarWidth,
  color: getComputedStyle(document.documentElement).scrollbarColor,
}));
A(sb.width === 'thin', `scrollbar-width=thin (${sb.width})`);
A(sb.color && sb.color !== 'auto', `scrollbar-color 已設 (${String(sb.color).slice(0, 40)})`);

console.log('— 轉單頁：同一詞彙 —');
await p.goto('http://localhost:8123/' + encodeURI('新增資料夾/轉單小工具.html'));
await p.waitForTimeout(800);
await p.evaluate(() => { document.getElementById('app-container').style.display = 'block'; document.getElementById('login-container').style.display = 'none'; });
await p.waitForTimeout(200);
r = await centered('#fudausearch-clear-btn', '#fudausearch-input');
A(!r.err && r.position === 'absolute' && r.dCenter <= 2, `轉單頁 clear 同機制且置中 (Δ=${r.dCenter && r.dCenter.toFixed(1)})`);
const zsb = await p.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth);
A(zsb === 'thin', `轉單頁捲軸也走單一權威 (${zsb})`);

await b.close();
if (fails.length) { console.error(`CAPSULE/SCROLLBAR TEST FAIL (${fails.length})`); process.exit(1); }
console.log('CAPSULE/SCROLLBAR TEST OK');
