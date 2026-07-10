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

// #1/#2：同一 render pass 內 pane 換手——render 依序重註冊 v1、v2（v1 陣列較前）；
// v1 認養 paneP、v2 因 stale existing.pane=paneP 又把它 class 移除。applyRanks 必須替
// 仍擁有 paneP 的 v1 補回 class，否則 paneP 變 z-index:auto 藏到視窗框後（隱形 iframe）。
const paneHandoff = await p.evaluate(() => {
  const mk = (id) => { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); return d; };
  const v1 = mk('v1'), v2 = mk('v2'), paneP = mk('paneP'), paneQ = mk('paneQ');
  const s = window.__stack;
  s.register('v2', v2, { levels: 2, pane: paneP, initialRank: 200 }); // v2 認養 paneP
  s.register('v1', v1, { levels: 2, pane: paneQ, initialRank: 201 }); // v1 認養 paneQ
  // 模擬合併後的 render 重註冊（順序 v1→v2）：paneP 換手給 v1、v2 換到 paneQ
  s.register('v1', v1, { levels: 2, pane: paneP });
  s.register('v2', v2, { levels: 2, pane: paneQ });
  const ok = paneP.classList.contains('gl-stack-pane');
  s.unregister('v1'); s.unregister('v2'); // 非 quiet：persist 掉 v1/v2，還原 localStorage 給後續斷言
  ['v1', 'v2', 'paneP', 'paneQ'].forEach((id) => document.getElementById(id).remove());
  return ok;
});
A(paneHandoff, `pane 換手後接手 surface 的 pane 仍有 gl-stack-pane class（審查 #1/#2）`);

// #3/#5：批次 unregister（quiet，模擬登出——引擎/視窗管理器登出時都傳 quiet=true）
// 不抹存檔 + 快照重置；重註冊（再登入）還原疊序
await p.evaluate(() => ['a', 'b', 'w'].forEach((k) => window.__stack.unregister(k, true)));
const lsLogout = await p.evaluate(() => localStorage.getItem('cspanel.stack.cs.v1'));
A(lsLogout && JSON.parse(lsLogout).order.length > 0, `登出（unregister 全部）不抹存檔 (${lsLogout})`);
await p.evaluate(() => {
  window.__stack.register('a', document.getElementById('a'), { initialRank: 0 });
  window.__stack.register('b', document.getElementById('b'), { initialRank: 1 });
  window.__stack.register('w', document.getElementById('w'), { levels: 2, pane: document.getElementById('wp'), initialRank: 2 });
});
z = await p.evaluate(() => ({ a: __z('a'), b: __z('b'), w: __z('w') }));
A(z.a > z.b && z.a > z.w, `再登入（重註冊）後仍 a 最上（登出不抹存檔 + 快照重置）(${JSON.stringify(z)})`);

await p.evaluate(() => window.__stack.reset());
z = await p.evaluate(() => ({ a: __z('a'), b: __z('b'), w: __z('w') }));
A(z.a < z.b && z.b < z.w, `reset 回初始序 a<b<w (${JSON.stringify(z)})`);

await b.close();
if (fails.length) { console.error(`STACK TEST FAIL (${fails.length})`); process.exit(1); }
console.log('STACK TEST OK');
