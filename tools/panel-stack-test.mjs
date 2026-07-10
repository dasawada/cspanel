// Task 4 回歸：登入後面板點擊置頂 + 持久化 + 編輯把手顯示中文標籤。
// 需本機 server；node tools/panel-stack-test.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1800, height: 1200 } });
const fails = []; const A = (c, m) => { if (!c) { fails.push(m); console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
await p.addInitScript(() => {
  localStorage.setItem('firebase_id_token', 'x'); localStorage.setItem('cspanel.theme.v1', 'olive');
  // 不在 addInitScript 清 stack key——它每次導覽（含 reload）都會跑，會洗掉持久化
  // 的置頂順序使持久化測試失真。Playwright 新 context 首載本就乾淨（空 localStorage）。
  const u = { getIdToken: async () => 'x' };
  window.firebase = { apps: [{}], initializeApp: () => {}, auth: () => ({ onAuthStateChanged: (cb) => setTimeout(() => cb(u), 50), currentUser: u, signOut: async () => {}, signInWithEmailAndPassword: async () => ({ user: u }) }), firestore: () => ({}) };
  window.verifyFireworkAuth = async () => true;
});
await p.route('**/api/order-tool-api', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":false}' }));
async function ready() { await p.waitForFunction(() => document.documentElement.classList.contains('auth-active'), { timeout: 15000 }); await p.waitForTimeout(2500); }
const maxZ = () => p.evaluate(() => ['.canned-panel', '.assist_googlesheet', '.DT_panel', '.roofbutton', '.optitlepanel', '.fudausearch-container', '.linkout', '.meeting-search-panel-menu'].reduce((m, s) => { const el = document.querySelector(s); return el ? Math.max(m, parseInt(getComputedStyle(el).zIndex, 10) || 0) : m; }, 0));
const zOf = (s) => p.evaluate((sel) => parseInt(getComputedStyle(document.querySelector(sel)).zIndex, 10), s);

await p.goto('http://localhost:8123/panel_all.html');
await ready();

// 1) 點擊置頂：meeting 初始最底，點它 → 變全場最高
const before = await zOf('.meeting-search-panel-menu');
await p.evaluate(() => document.querySelector('.meeting-search-panel-menu').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
await p.waitForTimeout(100);
const after = await zOf('.meeting-search-panel-menu');
const top = await maxZ();
A(after > before, `點擊 meeting 後 z 上升 (${before}→${after})`);
A(after === top, `meeting 成為全場最高 (${after}===max ${top})`);

// 2) 持久化：reload 後 meeting 仍最高
await p.reload();
await ready();
const afterReload = await zOf('.meeting-search-panel-menu');
const topReload = await maxZ();
A(afterReload === topReload, `reload 後 meeting 仍最高（持久化）(${afterReload}===${topReload})`);

// 3) 編輯把手顯示中文標籤（非原始 id）
await p.evaluate(() => window.CanvasEdit.enter());
await p.waitForTimeout(150);
const labels = await p.evaluate(() => [...document.querySelectorAll('.gl-edit-handle')].map((h) => h.textContent.trim()));
A(labels.includes('標題生成'), `把手含「標題生成」(${JSON.stringify(labels.slice(0, 12))})`);
A(labels.includes('外部會議面板'), `把手含「外部會議面板」`);
A(!labels.includes('optitle') && !labels.includes('meeting-shell'), `把手不再顯示原始 id`);

await b.close();
if (fails.length) { console.error(`PANEL STACK TEST FAIL (${fails.length})`); process.exit(1); }
console.log('PANEL STACK TEST OK');
