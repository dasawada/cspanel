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
// 修復（第八期 Task 1 審查 Important #2）：原字串不等式 `hoverBg !== 'rgba(0, 0, 0, 0)'`
// 在 page.hover() 觸發瞬間常採樣到 transition 起點（t≈0，alpha 仍為 0），且該透明值
// 經 color-mix() 轉場插值後瀏覽器以 oklab(...) 序列化——字串上恰好不等於 'rgba(0, 0, 0, 0)'
// 字面，讓斷言僥倖通過而未真的驗證到「變深」。改為：(a) 等待 transition（0.15s）完成再取樣，
// (b) 用 canvas 2D 解析任意 CSS 顏色語法（rgba/oklab/color(...) 皆可）得到真實數值化 alpha，
// 取代字串不等式，才能偵測到「hover 沒變深」的迴歸。
await page.hover('#h');
await page.waitForTimeout(200);
const hoverAlpha = await page.evaluate(() => {
  const bg = getComputedStyle(document.getElementById('h')).backgroundColor;
  const canvas = document.createElement('canvas');
  canvas.width = 1; canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1, 1);
  return { bg, a: ctx.getImageData(0, 0, 1, 1).data[3] };
});
assert(hoverAlpha.a > 0, `hover 微加深，數值化 alpha>0（實得 ${hoverAlpha.bg}，解析 alpha=${hoverAlpha.a}/255）`);

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
// 修復（第八期 Task 1 審查 Important #1）：stub token 在真實後端 .../api/order-tool-api
// 上會收到 401，觸發 script/auth-protected-tabs.js 的「❌ 認證徹底失敗，執行強制登出」，
// 把 .canned-panel-handle 隱藏，且與 page.goto() 等待外部 CDN 資源 load 幾乎同時發生，
// 造成下方 waitForSelector 100% 逾時。比照既有 tools/panel-stack-test.mjs 先例攔截此端點。
await page.route('**/api/order-tool-api', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":false}' }));
try {
  await page.goto(BASE + '/panel_all.html');
  await page.waitForSelector('.canned-panel-handle', { timeout: 15000 });
  const pa = await page.evaluate(() => ({
    links: document.querySelectorAll('link[data-draggable-chrome]').length,
    handleH: getComputedStyle(document.querySelector('.canned-panel-handle')).height,
  }));
  assert(pa.links === 1, `panel_all 靜態 link 存在且 runtime 未重複注入（實得 ${pa.links}）`);
  assert(pa.handleH === '36px', `quirks mode 下罐頭把手高度 36px（實得 ${pa.handleH}）`);
} catch (e) {
  // 優雅降級：B 區若仍因未知原因逾時/例外，回報具名失敗而非讓 process 崩潰
  // （即便本 Task 未能觸及的問題導致此區失敗，A 區與後續任務仍可信任本工具的輸出）。
  fails.push(`B 區例外或逾時（優雅降級，未讓 process 崩潰）：${e.message}`);
  console.error('  ✗ B 區例外或逾時：' + e.message);
}

// ===== C. 罐頭面板：讓位＋token 色債（Task 3）=====
const canned = await page.evaluate(() => {
  const css = document.getElementById('canned-panel-style').textContent;
  const panel = document.querySelector('.canned-panel');
  const handle = document.querySelector('.canned-panel-handle');
  return {
    hexLeft: (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []),
    redLeft: /(^|[^-\w])red\b/.test(css.replace(/border-radius/g, '')),
    radius: getComputedStyle(panel).borderTopLeftRadius,
    handleH: getComputedStyle(handle).height,
    handleFw: getComputedStyle(handle).fontWeight,
  };
});
assert(canned.hexLeft.length === 0, `PANEL_CSS 色債清零（殘留：${canned.hexLeft.join(',') || '無'}）`);
assert(!canned.redLeft, 'PANEL_CSS 無 red 關鍵字（→ --danger）');
assert(canned.radius === '12px', `罐頭外框圓角 --radius-md（實得 ${canned.radius}）`);
assert(canned.handleH === '36px', `罐頭把手高度歸詞彙（實得 ${canned.handleH}）`);
assert(canned.handleFw === '600', `罐頭標題字重 600（實得 ${canned.handleFw}）`);

// ===== D. 主題跟隨：拖曳漸層與 active tab 隨 palette 變 =====
const grad = async () => page.evaluate(() => {
  const p = document.querySelector('.canned-panel');
  p.classList.add('draggable-dragging');
  const g = getComputedStyle(document.querySelector('.canned-panel-handle')).backgroundImage;
  p.classList.remove('draggable-dragging');
  return g;
});
const oliveGrad = await grad();
await page.evaluate(() => window.CspanelTheme.setTheme('copenhagen-harbour'));
await page.waitForTimeout(100);
const chGrad = await grad();
assert(oliveGrad.includes('linear-gradient') && chGrad.includes('linear-gradient') && oliveGrad !== chGrad,
  `拖曳漸層隨主題（olive ≠ copenhagen-harbour）`);
await page.evaluate(() => window.CspanelTheme.setTheme('olive'));

await browser.close();
if (fails.length) { console.error(`\n${fails.length} 項失敗`); process.exit(1); }
console.log('\nhandle-chrome 全數通過');
