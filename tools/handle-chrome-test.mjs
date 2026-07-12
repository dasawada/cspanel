// 第八期回歸：把手詞彙單一來源（draggable-chrome.css）。
// 需本機 server（repo 根）：python3 -m http.server 8123
//   node tools/handle-chrome-test.mjs
import { chromium } from 'playwright';

const BASE = process.env.HC_URL || 'http://localhost:8123';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const fails = [];
const assert = (cond, msg) => { if (!cond) { fails.push(msg); console.error('  ✗ ' + msg); } else { console.log('  ✓ ' + msg); } };

// ===== A. fixture（無 tokens.css → fallback 路徑）=====
await page.goto(BASE + '/tools/handle-chrome-fixture.html');
await page.waitForFunction(() => window.__fixtureReady === true, { timeout: 10000 });

// A1. <link> 注入恰一次（兩次 makeDraggable 呼叫仍冪等）
const linkCount = await page.evaluate(() =>
  document.querySelectorAll('link[data-draggable-chrome]').length);
assert(linkCount === 1, `詞彙 <link> 恰注入一次（實得 ${linkCount}）`);
await page.waitForFunction(() =>
  [...document.styleSheets].some((s) => s.href && s.href.includes('draggable-chrome.css')), { timeout: 5000 });

// A2. 舊 runtime CSS 字串注入已拆（不再有含 .draggable-dragging 的 <style>）
const legacyStyle = await page.evaluate(() =>
  [...document.querySelectorAll('style')].some((s) => s.textContent.includes('.draggable-dragging')));
assert(!legacyStyle, '舊 CSS 字串注入已移除（無 draggable-dragging <style>）');

// A3. 常態：36px（fallback 生效）、透明底、上緣圓角 12px、grab cursor
const rest = await page.evaluate(() => {
  const cs = getComputedStyle(document.getElementById('h'));
  return { h: cs.height, bg: cs.backgroundColor, bgi: cs.backgroundImage, r: cs.borderTopLeftRadius, cur: cs.cursor, fw: cs.fontWeight };
});
assert(rest.h === '36px', `常態高度 36px（實得 ${rest.h}）`);
assert(rest.bg === 'rgba(0, 0, 0, 0)' && rest.bgi === 'none', `常態透明底（實得 ${rest.bg} / ${rest.bgi}）`);
assert(rest.r === '12px', `上緣圓角 12px（實得 ${rest.r}）`);
assert(rest.cur === 'grab', `cursor: grab（實得 ${rest.cur}）`);
assert(rest.fw === '400', `詞彙不設字重（實得 ${rest.fw}，防 wm 藥丸全 bold）`);

// A4. hover 暗示（自 wm 吸收）：微加深
await page.hover('#h');
const hoverBg = await page.evaluate(() => getComputedStyle(document.getElementById('h')).backgroundColor);
assert(hoverBg !== 'rgba(0, 0, 0, 0)', `hover 微加深（實得 ${hoverBg}）`);

// A5. 拖曳中：面板掛 draggable-dragging＋gl-dragging，把手漸層（accent fallback）
const hb = await page.locator('#h').boundingBox();
await page.mouse.move(hb.x + 50, hb.y + 10);
await page.mouse.down();
await page.mouse.move(hb.x + 150, hb.y + 90, { steps: 5 });
const mid = await page.evaluate(() => ({
  dragging: document.getElementById('pnl').classList.contains('draggable-dragging'),
  gl: document.getElementById('pnl').classList.contains('gl-dragging'),
  bgi: getComputedStyle(document.getElementById('h')).backgroundImage,
}));
assert(mid.dragging && mid.gl, '拖曳中面板掛 draggable-dragging + gl-dragging');
assert(mid.bgi.includes('linear-gradient'), `拖曳中把手 accent 漸層（實得 ${mid.bgi.slice(0, 60)}…）`);
assert(!mid.bgi.includes('240, 240, 240'), '舊硬編碼灰階 #f0f0f0 已廢除');
await page.mouse.up();

// A6. 放開：class 移除、恢復透明、面板有位移（行為未破壞）
const after = await page.evaluate(() => ({
  dragging: document.getElementById('pnl').classList.contains('draggable-dragging'),
  bgi: getComputedStyle(document.getElementById('h')).backgroundImage,
  left: document.getElementById('pnl').style.left,
}));
assert(!after.dragging && after.bgi === 'none', '放開後恢復常態');
assert(parseInt(after.left, 10) > 40, `拖曳行為正常（left=${after.left}）`);

// ===== B. panel_all（quirks mode、有 tokens、登入 stub）=====
// Task 3 會在此區塊追加罐頭面板斷言；本 Task 先驗靜態 link 與 quirks 相容。
await page.addInitScript(() => {
  localStorage.setItem('firebase_id_token', 'parity-stub');
  localStorage.setItem('cspanel.theme.v1', 'olive');
  const fakeUser = { getIdToken: async () => 'parity-stub' };
  window.firebase = {
    apps: [{}], initializeApp: () => {},
    auth: () => ({
      onAuthStateChanged: (cb) => setTimeout(() => cb(fakeUser), 50),
      currentUser: fakeUser, signOut: async () => {},
      signInWithEmailAndPassword: async () => ({ user: fakeUser }),
    }),
    firestore: () => ({}),
  };
  window.verifyFireworkAuth = async () => true;
});
await page.goto(BASE + '/panel_all.html');
await page.waitForSelector('.canned-panel-handle', { timeout: 15000 });
const pa = await page.evaluate(() => ({
  links: document.querySelectorAll('link[data-draggable-chrome]').length,
  handleH: getComputedStyle(document.querySelector('.canned-panel-handle')).height,
}));
assert(pa.links === 1, `panel_all 靜態 link 存在且 runtime 未重複注入（實得 ${pa.links}）`);
assert(pa.handleH === '36px', `quirks mode 下罐頭把手高度 36px（實得 ${pa.handleH}）`);

await browser.close();
if (fails.length) { console.error(`\n${fails.length} 項失敗`); process.exit(1); }
console.log('\nhandle-chrome 全數通過');
