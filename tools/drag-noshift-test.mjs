// B2 回歸：handle 上 pointerdown→pointerup（不移動）不該讓面板位移。
// 需本機 server；node tools/drag-noshift-test.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto('http://localhost:8123/tools/drag-noshift-fixture.html');
await p.waitForTimeout(200);
const before = await p.evaluate(() => window.__rect());
const hb = await p.evaluate(() => { const r = document.getElementById('h').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await p.mouse.move(hb.x, hb.y);
await p.mouse.down();
await p.mouse.up();
await p.waitForTimeout(150);
const after = await p.evaluate(() => window.__rect());
console.log('點擊不移動: before', JSON.stringify(before), 'after', JSON.stringify(after));
const dx = Math.abs(after.l - before.l), dy = Math.abs(after.t - before.t);
let fail = false;
if (dx > 1 || dy > 1) { console.error(`  ✗ 點擊零位移 FAIL (+${dx},+${dy})`); fail = true; } else console.log('  ✓ 點擊零位移');

// 真實拖曳（+60,+40）仍須正確移動——確認座標系修正沒把拖曳弄壞
const hb2 = await p.evaluate(() => { const r = document.getElementById('h').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await p.mouse.move(hb2.x, hb2.y);
await p.mouse.down();
await p.mouse.move(hb2.x + 30, hb2.y + 20, { steps: 4 });
await p.mouse.move(hb2.x + 60, hb2.y + 40, { steps: 4 });
await p.mouse.up();
await p.waitForTimeout(150);
const moved = await p.evaluate(() => window.__rect());
await b.close();
console.log('真實拖曳(+60,+40): from', JSON.stringify(after), 'to', JSON.stringify(moved));
const mdx = moved.l - after.l, mdy = moved.t - after.t;
if (Math.abs(mdx - 60) > 3 || Math.abs(mdy - 40) > 3) { console.error(`  ✗ 拖曳位移不正確 (got +${mdx},+${mdy}, want +60,+40)`); fail = true; } else console.log('  ✓ 拖曳位移正確');

if (fail) { console.error('DRAG TEST FAIL'); process.exit(1); }
console.log('DRAG TEST OK');
