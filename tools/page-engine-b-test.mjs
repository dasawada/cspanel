// 九期B 回歸套件：page 引擎（成組、wm 泛化、quirks 歸隊、持久化）。
// 骨架比照 page-engine-a-test.mjs 的 stub/攔截/A() 收集器/收尾 exit code 結構——
// 全程走 v2 頁（panel_all_v2.html）＋登入 stub＋**/api/order-tool-api 攔截。
// 各 Task 依序增補區段（A、B、C、D…），本檔案為累積套件、每次 commit 前完整跑一次。
// 需本機 server（repo 根）：python3 -m http.server 8123
// 用法：node tools/page-engine-b-test.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch();
const fails = [];
const A = (c, m) => { if (!c) { fails.push(m); console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

const BASE = process.env.PE_URL || 'http://localhost:8123';
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });

// 登入 stub（同 page-engine-a-test.mjs）＋ order-tool-api 攔截
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
await page.route('**/api/order-tool-api', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":false}' }));

await page.goto(BASE + '/panel_all_v2.html');
await page.waitForSelector('.canned-panel-handle', { timeout: 15000 });

// ===== A. 零位移點擊不寫 layout（DRAG_THRESHOLD 泛化，九期A 審查歸位）=====
console.log('— A. 零位移點擊不寫 layout ＋ 實際拖曳仍寫 layout —');
const opt = '.optitlepanel';
await page.waitForSelector(opt + ' .gl-hover-hot', { timeout: 15000 });
await page.evaluate(() => localStorage.removeItem('cspanel.layout.cs.v2'));
const b = await page.locator(opt).boundingBox();
await page.mouse.move(b.x + b.width / 2, b.y + 4);
await page.mouse.down(); await page.mouse.up();           // 熱區點一下，零位移
await page.waitForTimeout(100);
A(await page.evaluate(() => {
  const raw = localStorage.getItem('cspanel.layout.cs.v2');
  return !raw || !JSON.parse(raw).optitle;
}), '零位移點擊不寫 layout');
await page.mouse.move(b.x + b.width / 2, b.y + 4);
await page.mouse.down();
await page.mouse.move(b.x + b.width / 2 + 40, b.y + 44, { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(100);
A(await page.evaluate(() => !!JSON.parse(localStorage.getItem('cspanel.layout.cs.v2') || '{}').optitle),
  '實際拖曳仍寫 layout');

// ===== B. wm 兩段掛載：核心先起、adoptTabs 認養 =====
console.log('— B. wm 兩段掛載：核心先起、adoptTabs 認養 —');
A(await page.evaluate(() => !!window.WindowManager && typeof window.WindowManager.adoptTabs === 'function'),
  'v2 模式 WindowManager 核心已掛載且有 adoptTabs');
// protected 注入完成後 iframe tabs 已被認養（stub 環境有 server markup 經 Firestore stub？
// ——parity stub 不含 protectedContent，故此處斷言為「零 tab 啟動不炸」＋ hasTabs() 反映實況）
A(await page.evaluate(() => typeof window.WindowManager.hasTabs === 'function'), 'hasTabs API 存在');

// ===== C. page 資料流（API 驅動；手勢在 D 區）=====
console.log('— C. page 資料流（API 驅動）—');
const pgId = await page.evaluate(() => window.PageEngine.create(['optitle', 'fudausearch']));
A(typeof pgId === 'string' && pgId.startsWith('pg:'), `PageEngine.create 回 pg: id（${pgId}）`);
await page.waitForTimeout(200);
const c1 = await page.evaluate((id) => {
  const win = [...document.querySelectorAll('.wm-window')].find((w) =>
    [...w.querySelectorAll('.wm-tab')].some((t) => t.dataset.tab === id));
  const content = win.querySelector('.wm-content').getBoundingClientRect();
  const o = document.querySelector('.optitlepanel').getBoundingClientRect();
  const f = document.querySelector('.fudausearch-container').getBoundingClientRect();
  return {
    title: win.querySelector(`.wm-tab[data-tab="${CSS.escape(id)}"]`).textContent,
    optIn: o.top >= content.top - 1 && o.left >= content.left - 1,
    stackBelow: f.top >= o.bottom - 1, // 垂直依序
    persisted: JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]').length === 1,
  };
}, pgId);
A(c1.title.includes('標題生成') && c1.title.includes('職代查詢'), `page tab 標題串接（${c1.title}）`);
A(c1.optIn, '成員定位進視窗內容區');
A(c1.stackBelow, 'stack 模式垂直依序排列');
A(c1.persisted, 'pages store 持久化');
// 切走 tab（若同視窗有其他 tab）→ 成員隱藏；此 stub 環境 page 視窗只有一顆 tab，
// 改驗 dissolve：
await page.evaluate((id) => window.PageEngine.dissolve(id), pgId);
await page.waitForTimeout(200);
A(await page.evaluate(() =>
  getComputedStyle(document.querySelector('.optitlepanel')).display !== 'none' &&
  JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]').length === 0),
  'dissolve：成員回畫布、store 清空');

// ===== D. 成組手勢 =====
console.log('— D. 成組手勢（拖重疊＋懸停預覽）—');
// 把 shrturl 拖到 roof 上懸停 600ms → 成組
const s = await page.locator('.linkout').boundingBox();
const r = await page.locator('.roofbutton').boundingBox();
await page.mouse.move(s.x + s.width / 2, s.y + 4);
await page.mouse.down();
await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2, { steps: 8 });
await page.waitForSelector('.gl-group-preview', { timeout: 3000 });
A(true, '重疊懸停浮現成組預覽');
await page.waitForTimeout(600);
await page.mouse.up();
await page.waitForTimeout(300);
const d1 = await page.evaluate(() => {
  const pgs = JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]');
  return { n: pgs.length, members: pgs[0] ? pgs[0].members.map((m) => m.panelId) : [] };
});
A(d1.n === 1 && d1.members.includes('shrturl') && d1.members.includes('roof'),
  `放開成組（members=${d1.members.join(',')}）`);
// 誤觸護欄：快速掠過不成組
const o2 = await page.locator('.optitlepanel').boundingBox();
const f2 = await page.locator('.fudausearch-container').boundingBox();
await page.mouse.move(o2.x + o2.width / 2, o2.y + 4);
await page.mouse.down();
await page.mouse.move(f2.x + f2.width / 2, f2.y + f2.height / 2, { steps: 3 }); // 掠過
await page.mouse.move(f2.x + f2.width / 2 + 300, f2.y + 200, { steps: 3 });     // <500ms 內離開
await page.mouse.up();
await page.waitForTimeout(200);
A(await page.evaluate(() =>
  JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]').length === 1),
  '快速掠過不成組（護欄）');
// 清場供後續區段
await page.evaluate(() => {
  const pg = JSON.parse(localStorage.getItem('cspanel.pages.cs.v1'))[0];
  window.PageEngine.dissolve(pg.id);
});

// ===== E. 成組＋邊界回彈的視覺回歸（審查追加）=====
// draggable.js 的 handleDragEnd 在 needsBounce 分支（拖出邊界回彈，hover-handle
// 的 makeDraggable 呼叫未關 disableBoundary）會在 onPositionChange 呼叫「之後」
// 排入一顆 BOUNCE_DURATION（300ms）的 setTimeout，無條件把 el.style.left/top
// 覆寫回邊界修正後的落點——commitGroup 剛把面板放進目標 page 視窗（pageHostImpl.
// layout 已寫入頁內座標）的成果會被那顆計時器蓋掉，面板放開 300ms 後彈出目標
// 視窗外，即使 pages store 已正確記錄成員關係。本區段直接重現：把既有 page
// 視窗搬到貼近視窗邊界，拖一顆自由面板到上面觸發「邊界回彈」與「成組」同時
// 發生，驗證放開後面板最終仍留在目標視窗內容區（stack 模式下與內容區左緣
// 對齊），而非停在回彈後的落點座標。
console.log('— E. 成組＋邊界回彈：放開後不應被彈出目標視窗外 —');
const pgId2 = await page.evaluate(() => window.PageEngine.create(['optitle', 'fudausearch']));
await page.waitForTimeout(200);
const cornerRect = await page.evaluate((id) => {
  const win = [...document.querySelectorAll('.wm-window')].find((w) =>
    [...w.querySelectorAll('.wm-tab')].some((t) => t.dataset.tab === id));
  // 直接搬到視窗右下角、貼近邊界（僅供測試建構情境，不經 WindowManager 自身
  // 的拖曳/resize API，不影響其內部狀態的持久化語意）。
  win.style.left = '1300px';
  win.style.top = '800px';
  win.style.width = '550px';
  win.style.height = '400px';
  const content = win.querySelector('.wm-content').getBoundingClientRect();
  return { left: content.left, top: content.top, right: content.right, bottom: content.bottom };
}, pgId2);
const roof2 = await page.locator('.roofbutton').boundingBox();
await page.mouse.move(roof2.x + roof2.width / 2, roof2.y + 4);
await page.mouse.down();
// 落點刻意選在視窗邊界附近（1780,900，viewport 1800x1200）——同時滿足「與目標
// page 視窗重疊 ≥0.4」與「拖曳面板自身觸發 draggable.js 邊界回彈」兩條件。
await page.mouse.move((roof2.x + roof2.width / 2 + 1780) / 2, (roof2.y + 4 + 900) / 2, { steps: 6 });
await page.mouse.move(1780, 900, { steps: 10 });
await page.waitForSelector('.gl-group-preview', { timeout: 3000 });
A(true, 'E: 邊界處仍可浮現成組預覽');
await page.waitForTimeout(600);
await page.mouse.up();
await page.waitForTimeout(300);
const e1 = await page.evaluate((id) => {
  const pgs = JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]');
  const pg = pgs.find((p) => p.id === id);
  return pg ? pg.members.map((m) => m.panelId) : [];
}, pgId2);
A(e1.includes('roof'), `E: 邊界處放開仍成組（members=${e1.join(',')}）`);
// 500ms：跨過 draggable.js 的 BOUNCE_DURATION(300ms) 與本檔修復的重新斷言延遲，
// 讓畫面完全落定（含 CSS transition 播放完畢）後再讀取最終視覺位置。
await page.waitForTimeout(500);
const e2 = await page.evaluate(() => {
  const r = document.querySelector('.roofbutton').getBoundingClientRect();
  return { left: r.left, top: r.top };
});
A(Math.abs(e2.left - cornerRect.left) < 3,
  `E: 300ms 回彈計時器後仍與目標視窗內容區左緣對齊（roofLeft=${e2.left.toFixed(1)}, contentLeft=${cornerRect.left}）`);
// 冪等性檢查：settled 狀態應已等於 canonical layout 輸出——手動再補跑一次
// syncPanes() 不該再改變位置。若本檔修復失效（回彈計時器蓋掉座標後未被
// 重新斷言），e2 會停在錯誤的落點值，這裡手動 syncPanes() 校正後的 e3
// 會與 e2 出現落差，直接暴露 e2 當下是錯的。
const e3 = await page.evaluate(() => {
  window.WindowManager.syncPanes();
  const r = document.querySelector('.roofbutton').getBoundingClientRect();
  return { left: r.left, top: r.top };
});
A(Math.abs(e2.left - e3.left) < 1 && Math.abs(e2.top - e3.top) < 1,
  `E: settled 位置已是 canonical layout，無需再手動 syncPanes 才正確（Δ=(${(e2.left - e3.left).toFixed(1)},${(e2.top - e3.top).toFixed(1)})）`);
// 清場
await page.evaluate((id) => window.PageEngine.dissolve(id), pgId2);

// ===== F. 頁內互動：自由佈局、拖出退組、剩一解散（九期B Task 5）=====
// 字母延續全檔既有序列——E 已被 Task 4 審查修復追加的「成組＋邊界回彈」區段
// 佔用（見上方標頭），本區段依檔案既有慣例遞補下一個字母；task-5-brief.md
// 「E 區」以其描述的測試意圖為準（成組三員→頁內拖一員 free 化→拖出一員退組→
// 再拖出剩一解散），非字面字母對應，同 brief 開頭「行號僅供定位，以實際內容
// 錨定」同一精神。三名成員選用未被前面區段觸碰過、幾何尺寸小、無 quirks 的
// 面板（roof/shrturl/tooldl），確保頁內拖曳的重疊/邊界判定乾淨可控。
console.log('— F. 頁內互動：自由佈局、拖出退組、剩一解散 —');
const pgId3 = await page.evaluate(() => window.PageEngine.create(['roof', 'shrturl', 'tooldl']));
A(typeof pgId3 === 'string' && pgId3.startsWith('pg:'), `F: 成組三員（${pgId3}）`);
await page.waitForTimeout(200);

const content3 = await page.evaluate((id) => {
  const win = [...document.querySelectorAll('.wm-window')].find((w) =>
    [...w.querySelectorAll('.wm-tab')].some((t) => t.dataset.tab === id));
  const c = win.querySelector('.wm-content').getBoundingClientRect();
  return { left: c.left, top: c.top, width: c.width, height: c.height };
}, pgId3);
const others0 = await page.evaluate(() => {
  const r = (sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { left: b.left, top: b.top }; };
  return { shrturl: r('.linkout'), tooldl: r('.tool_zip_dl') };
});

// -- F1: 拖一員（roof）到宿主內容區右側、結束仍在內容區內 → layoutMode 轉
//    free、該員 rect 更新、其餘兩員（shrturl/tooldl）不動 --
const roofBox = await page.locator('.roofbutton').boundingBox();
const targetX = content3.left + content3.width * 0.6;
const targetY = content3.top + 30;
await page.mouse.move(roofBox.x + roofBox.width / 2, roofBox.y + 4);
await page.mouse.down();
await page.mouse.move(targetX, targetY, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(200);

const g1 = await page.evaluate((id) => {
  const pg = JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]').find((p) => p.id === id);
  const roof = document.querySelector('.roofbutton').getBoundingClientRect();
  const shrturl = document.querySelector('.linkout').getBoundingClientRect();
  const tooldl = document.querySelector('.tool_zip_dl').getBoundingClientRect();
  return {
    layoutMode: pg ? pg.layoutMode : null,
    memberCount: pg ? pg.members.length : 0,
    roofRect: pg ? pg.members.find((m) => m.panelId === 'roof').rect : null,
    roof: { left: roof.left, top: roof.top },
    shrturl: { left: shrturl.left, top: shrturl.top },
    tooldl: { left: tooldl.left, top: tooldl.top },
  };
}, pgId3);
A(g1.layoutMode === 'free', `F1: 頁內拖曳後 layoutMode 轉 free（${g1.layoutMode}）`);
A(g1.memberCount === 3, 'F1: 拖曳未改變成員數');
const roofMoved = Math.hypot(g1.roof.left - roofBox.x, g1.roof.top - roofBox.y);
A(roofMoved > 20, `F1: 拖曳成員畫面位置確實改變（Δ=${roofMoved.toFixed(1)}px）`);
A(!!g1.roofRect &&
  Math.abs((content3.left + g1.roofRect.x) - g1.roof.left) < 2 &&
  Math.abs((content3.top + g1.roofRect.y) - g1.roof.top) < 2,
  `F1: 該員 member.rect 與畫面位置一致（rect=(${g1.roofRect && g1.roofRect.x.toFixed(1)},${g1.roofRect && g1.roofRect.y.toFixed(1)})）`);
A(Math.abs(g1.shrturl.left - others0.shrturl.left) < 2 && Math.abs(g1.shrturl.top - others0.shrturl.top) < 2,
  `F1: 其餘成員（shrturl）位置不動（Δ=(${(g1.shrturl.left - others0.shrturl.left).toFixed(1)},${(g1.shrturl.top - others0.shrturl.top).toFixed(1)})）`);
A(Math.abs(g1.tooldl.left - others0.tooldl.left) < 2 && Math.abs(g1.tooldl.top - others0.tooldl.top) < 2,
  `F1: 其餘成員（tooldl）位置不動（Δ=(${(g1.tooldl.left - others0.tooldl.left).toFixed(1)},${(g1.tooldl.top - others0.tooldl.top).toFixed(1)})）`);

// -- F2: 把 tooldl 拖出內容區外 → 退組回畫布（pages store 少一員、面板可見） --
const tooldlBox = await page.locator('.tool_zip_dl').boundingBox();
await page.mouse.move(tooldlBox.x + tooldlBox.width / 2, tooldlBox.y + 4);
await page.mouse.down();
await page.mouse.move(20, content3.top + 10, { steps: 8 }); // 遠離內容區左側
await page.mouse.up();
await page.waitForTimeout(200);
const g2 = await page.evaluate((id) => {
  const pgs = JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]');
  const pg = pgs.find((p) => p.id === id);
  return {
    pageExists: !!pg,
    memberCount: pg ? pg.members.length : 0,
    tooldlVisible: getComputedStyle(document.querySelector('.tool_zip_dl')).display !== 'none',
  };
}, pgId3);
A(g2.pageExists && g2.memberCount === 2, `F2: 拖出內容區退組（memberCount=${g2.memberCount}）`);
A(g2.tooldlVisible, 'F2: 退組面板回畫布可見');

// -- F3: 再把剩兩員之一（shrturl）拖出內容區外 → 剩一自動解散
//    （store 清空、最後成員與被拖成員皆回畫布） --
const shrturlBox = await page.locator('.linkout').boundingBox();
await page.mouse.move(shrturlBox.x + shrturlBox.width / 2, shrturlBox.y + 4);
await page.mouse.down();
await page.mouse.move(20, content3.top + 10, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(200);
const g3 = await page.evaluate(() => {
  const pgs = JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]');
  return {
    n: pgs.length,
    roofVisible: getComputedStyle(document.querySelector('.roofbutton')).display !== 'none',
    shrturlVisible: getComputedStyle(document.querySelector('.linkout')).display !== 'none',
  };
});
A(g3.n === 0, `F3: 剩一自動解散，store 清空（n=${g3.n}）`);
A(g3.roofVisible && g3.shrturlVisible, 'F3: 最後成員與被拖成員皆回畫布可見');

await page.close();

const anyFail = fails.length > 0;
await browser.close();
if (anyFail) { console.error(`\n${fails.length} FAILURES`); process.exit(1); }
console.log('\nPAGE-ENGINE-B TEST OK');
