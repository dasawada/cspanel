// B1 回歸：#gl-edit-bar 進場動畫「進行中」也要保持水平置中（不可先右偏）。
// 需本機 server；node tools/editbar-center-test.mjs
import { chromium } from 'playwright';
import { installAccessFixture } from './access-test-fixture.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1800, height: 1200 } });
await installAccessFixture(p);
await p.route('**/api/order-tool-api', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":false}' }));
await p.goto('http://localhost:8123/panel_all.html');
await p.waitForFunction(() => document.documentElement.classList.contains('auth-active'), { timeout: 15000 });
await p.waitForTimeout(2000);
await p.evaluate(() => window.CanvasEdit.enter());
await p.waitForTimeout(120); // 動畫進行中取樣
const r = await p.evaluate(() => { const el = document.getElementById('gl-edit-bar'); const b = el.getBoundingClientRect(); return { center: b.left + b.width / 2, vw: window.innerWidth }; });
await b.close();
const off = Math.abs(r.center - r.vw / 2);
console.log('bar center offset from viewport center =', off.toFixed(1), 'px');
if (off > 4) { console.error('EDITBAR CENTER FAIL (載入右偏)'); process.exit(1); }
console.log('EDITBAR CENTER OK');
