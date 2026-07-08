// 審查 #1 回歸：併發雙 initProtectedTabs 不得把分頁視窗弄消失。
// in-flight 守衛應讓第二個併發呼叫在 fetch 前 return（fetch 只一次），最終仍有
// 單一視窗 + 四 tab + 四 pane，且 window.WindowManager 已設、.panel-tabs-container 已移除。
// 需本機 server（repo 根）：python3 -m http.server 8123；node tools/wm-concurrent-test.mjs
import { chromium } from 'playwright';

const URL_ = process.env.WMC_URL || 'http://localhost:8123/tools/wm-concurrent-fixture.html';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
const fails = [];
const assert = (cond, msg) => { if (!cond) { fails.push(msg); console.error('  ✗ ' + msg); } else { console.log('  ✓ ' + msg); } };

await page.goto(URL_);
await page.waitForFunction(() => window.__concurrentDone === true, { timeout: 10000 });
await page.waitForTimeout(400);

const st = await page.evaluate(() => ({
  fetchCount: window.__fetchCount,
  windows: document.querySelectorAll('.wm-window').length,
  tabs: document.querySelectorAll('.wm-window .wm-tab').length,
  panes: document.querySelectorAll('.wm-pane').length,
  wmSet: !!window.WindowManager,
  leftoverContainer: document.querySelectorAll('.panel-tabs-container').length,
}));
await browser.close();

console.log('state =', JSON.stringify(st));
assert(st.fetchCount === 1, `fetch 只一次（in-flight 守衛生效）got ${st.fetchCount}`);
assert(st.windows === 1, `恰一個視窗（未被雙掛載銷毀）got ${st.windows}`);
assert(st.tabs === 4, `四個 tab 完整 got ${st.tabs}`);
assert(st.panes === 4, `四個常駐 pane got ${st.panes}`);
assert(st.wmSet, `window.WindowManager 已設（非 null）`);
assert(st.leftoverContainer === 0, `.panel-tabs-container 已移除（交棒完成）got ${st.leftoverContainer}`);

if (fails.length) { console.error(`\nWM CONCURRENT TEST FAIL (${fails.length})`); process.exit(1); }
console.log('\nWM CONCURRENT TEST OK');
