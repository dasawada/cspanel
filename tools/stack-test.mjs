// stack-manager 回歸：初始序、raise 置頂、pane 疊窗上、持久化 reload 還原、reset。
// 需本機 server；node tools/stack-test.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
const fails = []; const A = (c, m) => { if (!c) { fails.push(m); console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

await p.goto('http://localhost:8123/tools/stack-fixture.html');
await p.evaluate(() => localStorage.removeItem('cspanel.stack.cs.v1'));
await p.reload();
await p.waitForFunction(() => !!window.__z);
await p.waitForTimeout(100);

let z = await p.evaluate(() => ({ a: __z('a'), b: __z('b'), w: __z('w'), wp: __z('wp') }));
A(z.a < z.b && z.b < z.w, `初始序 a<b<w (${JSON.stringify(z)})`);
A(z.wp === z.w + 1, `pane 疊在自己視窗上 (w=${z.w}, wp=${z.wp})`);

await p.evaluate(() => window.__stack.raise('a'));
z = await p.evaluate(() => ({ a: __z('a'), b: __z('b'), w: __z('w') }));
A(z.a > z.b && z.a > z.w, `raise(a) 後 a 最上 (${JSON.stringify(z)})`);

await p.reload();
await p.waitForFunction(() => !!window.__z);
await p.waitForTimeout(100);
z = await p.evaluate(() => ({ a: __z('a'), b: __z('b'), w: __z('w') }));
A(z.a > z.b && z.a > z.w, `reload 後仍 a 最上（持久化）(${JSON.stringify(z)})`);

await p.evaluate(() => window.__stack.reset());
z = await p.evaluate(() => ({ a: __z('a'), b: __z('b'), w: __z('w') }));
A(z.a < z.b && z.b < z.w, `reset 回初始序 a<b<w (${JSON.stringify(z)})`);

await b.close();
if (fails.length) { console.error(`STACK TEST FAIL (${fails.length})`); process.exit(1); }
console.log('STACK TEST OK');
