// Task 4 回歸：登入後面板點擊置頂 + 持久化 + 編輯把手顯示中文標籤。
// 需本機 server；node tools/panel-stack-test.mjs
import { chromium } from 'playwright';
import { installAccessFixture } from './access-test-fixture.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1800, height: 1200 } });
const fails = []; const A = (c, m) => { if (!c) { fails.push(m); console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
// 不清 stack key：reload 要驗證同一 context 的持久化。
await installAccessFixture(p);
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

// 2.5) hover 不得改變疊序（第九期收尾：fudausearch 一期 :hover 置頂補丁移除——
//      pointerdown 置頂（stack-manager）已涵蓋其原始用途；:focus-within 提升保留
//      給鍵盤使用者，屬 stack.css 明文保護的狀態提升）
{
  const fudauRest = await zOf('.fudausearch-container');
  const fb = await p.locator('.fudausearch-container').boundingBox();
  await p.mouse.move(fb.x + fb.width / 2, fb.y + fb.height - 10);
  await p.waitForTimeout(150);
  const fudauHover = await zOf('.fudausearch-container');
  A(fudauHover === fudauRest, `hover 不改 fudausearch z（${fudauRest}→${fudauHover}）`);
  const fudauFocus = await p.evaluate(() => {
    const inp = document.querySelector('.fudausearch-container input');
    inp.focus();
    return parseInt(getComputedStyle(document.querySelector('.fudausearch-container')).zIndex, 10);
  });
  A(fudauFocus === 200, `:focus-within 仍升 --layer-panel-active（實得 ${fudauFocus}）`);
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.mouse.move(10, 1100);
}

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
