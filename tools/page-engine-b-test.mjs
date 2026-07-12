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

// ===== G. quirks 歸隊：罐頭可入組 ＋ iframe 零重載命門（九期B Task 6）=====
// 字母延續全檔既有序列——F 已被 Task 5 佔用（見該區段標頭：E 已被 Task 4 審查
// 修復追加的「成組＋邊界回彈」區段佔用，F 遞補）；task-6-brief.md「F 區」以其
// 描述的測試意圖為準（iframe 零重載命門＋罐頭入組期間 per-path key 暫停），非
// 字面字母對應，同全檔既有慣例（見 F 區標頭同一說明）。
// IPsearch（server-markup quirk）：stub 環境無伺服器 markup（.IPsearch_in_panelALL
// 由 auth-protected-tabs.js 的 fetchProtectedContentWithRetry 依伺服器回應動態
// 注入，此處 order-tool-api 攔截回傳 {success:false}，該面板從未存在於 DOM），
// 無法在本測試環境驗證；歸隊邏輯（canvas-engine.js hydratePageJoins：每次登入
// 皆重新 joinMember 持久化的 page 成員，elFor() 以 rootSelector 即時查詢、不管
// DOM 節點是否為 clear→init 重新注入的新實例）與罐頭/consultant 共用同一套
// 泛化機制，由下方 G2-G4（罐頭）與 G1（iframe）間接覆蓋，見 task brief 脈絡段
// 「測試以罐頭＋consultant 覆蓋」。
console.log('— G. quirks 歸隊：罐頭可入組 ＋ iframe 零重載命門 —');

// -- G1：iframe 零重載命門——consultant 內嵌 iframe（SA_iframe.html，同源）
//    種 contentWindow canary，成組/解散全程存活＝從未重載（零 re-parent）。--
// iframe 的容器（.small-size 展開態的 #content）預設 display:none（收合狀態），
// waitForSelector 預設等「visible」會逾時——只需等它已掛載（attached），
// display:none 不影響 contentWindow 存在與否／canary 可寫入性。
await page.waitForSelector('.consultantlistgooglesheet iframe', { state: 'attached', timeout: 15000 });
await page.evaluate(() => {
  const ifr = document.querySelector('.consultantlistgooglesheet iframe');
  ifr.contentWindow.__reloadCanary = 'alive';
});
const pg2 = await page.evaluate(() => window.PageEngine.create(['consultant', 'assist']));
A(typeof pg2 === 'string' && pg2.startsWith('pg:'), `G1: consultant+assist 成組（${pg2}）`);
await page.waitForTimeout(300);
A(await page.evaluate(() => {
  const ifr = document.querySelector('.consultantlistgooglesheet iframe');
  return !!ifr && !!ifr.contentWindow && ifr.contentWindow.__reloadCanary === 'alive';
}), 'G1: 成組全程 iframe 零重載（canary 存活）');
await page.evaluate((id) => window.PageEngine.dissolve(id), pg2);
await page.waitForTimeout(200);
A(await page.evaluate(() => {
  const ifr = document.querySelector('.consultantlistgooglesheet iframe');
  return !!ifr && !!ifr.contentWindow && ifr.contentWindow.__reloadCanary === 'alive';
}), 'G1: 解散後 iframe 仍零重載');

// -- G2：罐頭（body-mounted/alwaysDraggable/self-persisted quirks）可入組——
//    API create(['canned','optitle']) → 罐頭定位進視窗內容區。--
// 先種一個 sentinel 值到罐頭自己的 per-path key，讓 G3 的「拖動後不更新」斷言
// 有一個非空、已知的比較基準（避免僅靠「兩者皆 null」這種較弱的等價性）。
const CANNED_KEY_SENTINEL = JSON.stringify({ left: 1300, top: 75 });
await page.evaluate((sentinel) => {
  localStorage.setItem(`draggable:${location.pathname}:canned-panel-main`, sentinel);
}, CANNED_KEY_SENTINEL);
const cannedPreJoin = await page.evaluate(() => {
  const r = document.querySelector('.canned-panel').getBoundingClientRect();
  return { left: r.left, top: r.top };
});
const pg3 = await page.evaluate(() => window.PageEngine.create(['canned', 'optitle']));
A(typeof pg3 === 'string' && pg3.startsWith('pg:'), `G2: 罐頭成組（${pg3}）`);
await page.waitForTimeout(200);
const g2a = await page.evaluate((id) => {
  const win = [...document.querySelectorAll('.wm-window')].find((w) =>
    [...w.querySelectorAll('.wm-tab')].some((t) => t.dataset.tab === id));
  const content = win.querySelector('.wm-content').getBoundingClientRect();
  const c = document.querySelector('.canned-panel').getBoundingClientRect();
  return { inside: c.top >= content.top - 1 && c.left >= content.left - 1 };
}, pg3);
A(g2a.inside, 'G2: 罐頭定位進視窗內容區');

// -- G3：入組期間拖動罐頭把手 → per-path key 不更新（引擎暫停其 self-persist
//    寫入，見 dragb_msg_pnl.js setSelfPersistPaused／canvas-engine.js
//    setQuirkPersistPaused）。--
const cannedBeforeDrag = await page.evaluate(() => {
  const r = document.querySelector('.canned-panel').getBoundingClientRect();
  return { left: r.left, top: r.top };
});
const cannedHandleBox = await page.locator('.canned-panel-handle').boundingBox();
await page.mouse.move(cannedHandleBox.x + cannedHandleBox.width / 2, cannedHandleBox.y + cannedHandleBox.height / 2);
await page.mouse.down();
await page.mouse.move(cannedHandleBox.x + 50, cannedHandleBox.y + 50, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(200);
const cannedKeyAfterDrag = await page.evaluate(() =>
  localStorage.getItem(`draggable:${location.pathname}:canned-panel-main`));
A(cannedKeyAfterDrag === CANNED_KEY_SENTINEL,
  `G3: 入組期間拖動罐頭 per-path key 不更新（after=${cannedKeyAfterDrag}）`);
// 拖動本身仍應產生可見位移（確認上面的「不更新」不是因為根本沒拖動到）。
const cannedAfterDrag = await page.evaluate(() => {
  const r = document.querySelector('.canned-panel').getBoundingClientRect();
  return { left: r.left, top: r.top };
});
const cannedDragMoved = Math.hypot(cannedAfterDrag.left - cannedBeforeDrag.left, cannedAfterDrag.top - cannedBeforeDrag.top);
A(cannedDragMoved > 20, `G3: 拖動確實產生位移（Δ=${cannedDragMoved.toFixed(1)}px）`);

// -- G4：dissolve 後罐頭回 detachedRect（入組前座標）。--
await page.evaluate((id) => window.PageEngine.dissolve(id), pg3);
await page.waitForTimeout(200);
const cannedPostDissolve = await page.evaluate(() => {
  const r = document.querySelector('.canned-panel').getBoundingClientRect();
  return { left: r.left, top: r.top };
});
A(Math.abs(cannedPostDissolve.left - cannedPreJoin.left) < 2 && Math.abs(cannedPostDissolve.top - cannedPreJoin.top) < 2,
  `G4: dissolve 後罐頭回 detachedRect（pre=(${cannedPreJoin.left.toFixed(1)},${cannedPreJoin.top.toFixed(1)}), post=(${cannedPostDissolve.left.toFixed(1)},${cannedPostDissolve.top.toFixed(1)})）`);
// 退組後 self-persist 已恢復——之後再拖動應正常寫回 per-path key（對稱驗證，
// 避免「暫停」的旗標卡死在關閉狀態、遺留成永久停用）。
const cannedHandleBox2 = await page.locator('.canned-panel-handle').boundingBox();
await page.mouse.move(cannedHandleBox2.x + cannedHandleBox2.width / 2, cannedHandleBox2.y + cannedHandleBox2.height / 2);
await page.mouse.down();
await page.mouse.move(cannedHandleBox2.x + 30, cannedHandleBox2.y + 30, { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(200);
const cannedKeyAfterLeaveDrag = await page.evaluate(() =>
  localStorage.getItem(`draggable:${location.pathname}:canned-panel-main`));
A(cannedKeyAfterLeaveDrag !== CANNED_KEY_SENTINEL,
  `G4: 退組後 self-persist 恢復，拖動再次寫回 per-path key（after=${cannedKeyAfterLeaveDrag}）`);

// ===== H. 持久化整合終驗：reload 全還原＋撕出合併＋推版前全套（九期B Task 7）=====
// 字母延續全檔既有序列——G 已被 Task 6 佔用（見該區段標頭與 task-6-report.md
// 「疑慮 1」的明文交接：Task 7 應遞補為 H）；task-7-brief.md「G 區」以其描述的
// 測試意圖為準（成組兩頁→reload 全還原→page tab 拖到另一視窗 tabbar 合併→撕
// 出→v1 keys 位元不變→CanvasEdit.toggle 重設全清），非字面字母對應，同 F/G 區
// 標頭一貫精神。
console.log('— H. 持久化整合終驗：reload 還原＋撕出合併＋推版前全套 —');

// v1 keys 快照（比照 page-engine-a-test.mjs 的 v1Snapshot 慣例）：整個 H 區操作
// （成組→頁內拖曳→reload→合併→撕出→最終重設）全程都不得使 production（v1）
// 儲存 key 出現任何一次寫入，逐點重新比對同一份快照。
const hV1Snapshot = () => page.evaluate(() =>
  JSON.stringify(['cspanel.layout.cs.v1', 'cspanel.windows.cs.v1', 'cspanel.stack.cs.v1']
    .map((k) => [k, localStorage.getItem(k)])));
const hV1Base = await hV1Snapshot();

const hWinSnapshot = (tabId) => page.evaluate((id) => {
  const win = [...document.querySelectorAll('.wm-window')].find((w) =>
    [...w.querySelectorAll('.wm-tab')].some((t) => t.dataset.tab === id));
  if (!win) return null;
  const r = win.getBoundingClientRect();
  const act = win.querySelector('.wm-tab.is-active');
  return {
    tabs: [...win.querySelectorAll('.wm-tab')].map((t) => t.dataset.tab),
    active: act ? act.dataset.tab : null,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
  };
}, tabId);
const hContentRect = (tabId) => page.evaluate((id) => {
  const win = [...document.querySelectorAll('.wm-window')].find((w) =>
    [...w.querySelectorAll('.wm-tab')].some((t) => t.dataset.tab === id));
  const c = win.querySelector('.wm-content').getBoundingClientRect();
  return { left: c.left, top: c.top, width: c.width, height: c.height };
}, tabId);
const hMemberRects = () => page.evaluate(() => {
  const r = (sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { left: Math.round(b.left), top: Math.round(b.top) }; };
  return {
    roof: r('.roofbutton'), shrturl: r('.linkout'), optitle: r('.optitlepanel'),
    fudausearch: r('.fudausearch-container'), tooldl: r('.tool_zip_dl'),
  };
});
const hPagesStore = () => page.evaluate(() => JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]'));
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// -- H1：成組兩頁——頁一兩員（roof+shrturl）、頁二經 addMember 擴充第三員
//    （optitle+fudausearch 建頁，再 addMember('tooldl')）。兩頁各自建立時明確
//    傳入分開的 rect（畫布下半左右各一塊），避免兩者都落在同一組預設 rect
//    （410,160,500,600）而完全疊在同一個像素區塊——那樣一來兩顆單 tab 視窗的
//    tabbar 會像素對像素重疊，之後「拖某頁 tab 到另一視窗 tabbar」的滑鼠座標
//    會失去對象意義（點下去分不出打中哪一顆），與 wm-test 既有拖 tab 測試手法
//    的可靠性前提（來源/目標視窗幾何互不重疊）一致。 --
console.log('  — H1: 成組兩頁（頁一兩員、頁二經 addMember 擴充第三員）—');
const pgH1 = await page.evaluate(() =>
  window.PageEngine.create(['roof', 'shrturl'], { rect: { x: 60, y: 700, w: 480, h: 380 } }));
A(typeof pgH1 === 'string' && pgH1.startsWith('pg:'), `H1: 頁一（兩員）建立（${pgH1}）`);
await page.waitForTimeout(200);
const pgH2 = await page.evaluate(() =>
  window.PageEngine.create(['optitle', 'fudausearch'], { rect: { x: 700, y: 700, w: 480, h: 380 } }));
A(typeof pgH2 === 'string' && pgH2.startsWith('pg:'), `H1: 頁二種子（兩員）建立（${pgH2}）`);
await page.waitForTimeout(200);
const h1AddOk = await page.evaluate((id) => window.PageEngine.addMember(id, 'tooldl'), pgH2);
A(h1AddOk === true, 'H1: 頁二經 addMember 擴充第三員（tooldl）');
await page.waitForTimeout(200);
const h1SeedPages = await hPagesStore();
const h1Seed2 = h1SeedPages.find((p) => p.id === pgH2);
A(!!h1Seed2 && h1Seed2.members.length === 3 && h1Seed2.members.some((m) => m.panelId === 'tooldl'),
  `H1: 頁二成員數與內容正確（members=${h1Seed2 && h1Seed2.members.map((m) => m.panelId).join(',')}）`);

// 把頁一其中一員（roof）拖往其宿主視窗內容區右側、結束仍在內容區內
// → layoutMode 轉 free（手法比照 F1）。頁二維持預設 stack 模式，兩頁涵蓋
// reload 需還原的兩種 layoutMode。
const h1Content = await hContentRect(pgH1);
const hRoofBox = await page.locator('.roofbutton').boundingBox();
const h1TargetX = h1Content.left + h1Content.width * 0.6;
const h1TargetY = h1Content.top + 30;
await page.mouse.move(hRoofBox.x + hRoofBox.width / 2, hRoofBox.y + 4);
await page.mouse.down();
await page.mouse.move(h1TargetX, h1TargetY, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(200);
const h1PageAfterDrag = (await hPagesStore()).find((p) => p.id === pgH1);
A(!!h1PageAfterDrag && h1PageAfterDrag.layoutMode === 'free',
  `H1: 頁一頁內拖曳後 layoutMode 轉 free（${h1PageAfterDrag && h1PageAfterDrag.layoutMode}）`);

// -- H2：reload → 斷言視窗/tab/成員定位/layoutMode 全還原 --
console.log('  — H2: reload → 視窗/tab/成員定位/layoutMode 全還原 —');
const hPreReload = {
  win1: await hWinSnapshot(pgH1),
  win2: await hWinSnapshot(pgH2),
  pages: await hPagesStore(),
  rects: await hMemberRects(),
};
A(!!hPreReload.win1 && !!hPreReload.win2, 'H2: reload 前兩頁視窗皆存在（前置檢查）');

await page.reload();
await page.waitForSelector('.canned-panel-handle', { timeout: 15000 });
await page.waitForTimeout(500); // wm 兩段掛載＋hydratePageJoins＋syncPanes 落定

const hPostReload = {
  win1: await hWinSnapshot(pgH1),
  win2: await hWinSnapshot(pgH2),
  pages: await hPagesStore(),
  rects: await hMemberRects(),
};
A(!!hPostReload.win1 && !!hPostReload.win2, 'H2: reload 後兩頁視窗皆還原');
for (const [label, pre, post] of [['頁一', hPreReload.win1, hPostReload.win1], ['頁二', hPreReload.win2, hPostReload.win2]]) {
  if (!pre || !post) continue;
  A(near(pre.rect.x, post.rect.x, 2) && near(pre.rect.y, post.rect.y, 2) &&
    near(pre.rect.w, post.rect.w, 2) && near(pre.rect.h, post.rect.h, 2),
    `H2: ${label}視窗幾何跨 reload 還原（pre=${JSON.stringify(pre.rect)} post=${JSON.stringify(post.rect)}）`);
  A(JSON.stringify(pre.tabs) === JSON.stringify(post.tabs) && pre.active === post.active,
    `H2: ${label} tab 組成／作用中 tab 還原（tabs=${JSON.stringify(post.tabs)}, active=${post.active}）`);
}
const h2PageAfterReload = hPostReload.pages.find((p) => p.id === pgH1);
const h2Page2AfterReload = hPostReload.pages.find((p) => p.id === pgH2);
A(!!h2PageAfterReload && h2PageAfterReload.layoutMode === 'free' &&
  h2PageAfterReload.members.length === 2 && h2PageAfterReload.members.every((m) => ['roof', 'shrturl'].includes(m.panelId)),
  `H2: 頁一成員與 layoutMode（free）還原（${JSON.stringify(h2PageAfterReload)}）`);
A(!!h2Page2AfterReload && h2Page2AfterReload.layoutMode === 'stack' &&
  h2Page2AfterReload.members.length === 3 && h2Page2AfterReload.members.some((m) => m.panelId === 'tooldl'),
  `H2: 頁二成員（含 addMember 擴充的 tooldl）與 layoutMode（stack）還原（${JSON.stringify(h2Page2AfterReload)}）`);
for (const key of ['roof', 'shrturl', 'optitle', 'fudausearch', 'tooldl']) {
  const p = hPreReload.rects[key], q = hPostReload.rects[key];
  A(near(p.left, q.left, 3) && near(p.top, q.top, 3),
    `H2: 成員 ${key} 定位跨 reload 還原（pre=(${p.left},${p.top}) post=(${q.left},${q.top})）`);
}
A(await hV1Snapshot() === hV1Base, 'H2: v1 keys 位元不變（reload 後）');

// -- H3：page tab 拖到另一視窗 tabbar 合併（滑鼠模擬，比照 wm-test 拖 tab 手
//    法：mousedown 於來源 tab → 移動穿越門檻 → 落在目標視窗 tabbar 範圍內 →
//    mouseup）→ 再撕出 --
console.log('  — H3: page tab 拖到另一視窗 tabbar 合併 → 撕出 —');
const hTabCenter = (tabId) => page.evaluate((id) => {
  const tab = document.querySelector(`.wm-tab[data-tab="${CSS.escape(id)}"]`);
  const r = tab.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}, tabId);
const hTabBarEdge = (tabId) => page.evaluate((id) => {
  const win = [...document.querySelectorAll('.wm-window')].find((w) =>
    [...w.querySelectorAll('.wm-tab')].some((t) => t.dataset.tab === id));
  const b = win.querySelector('.wm-tabbar').getBoundingClientRect();
  return { x: b.right - 6, y: b.top + b.height / 2 };
}, tabId);
// window-manager.js 的 beginPointerDrag（Task 7 未改動、第三期既有）用
// requestAnimationFrame 節流 pointermove→onMove（見 window-manager.js:402-405
// 的 move/flush）：只有排入的那顆動畫幀真正觸發過一次 onMove，wm 的
// startTabDrag 才會把 dragging 標記為 true。若 pointerup 在瀏覽器送出「這次拖
// 曳的第一顆動畫幀」之前就已處理完（headless 環境、尤其是本檔案跑到 H 區已
// 累積大量 DOM/監聽器時偶發），dragging 全程停在 false，放開會被誤判為「點擊
// 切換 tab」而非「拖曳」，applyTabDrop 從未被呼叫——與九期B Task 4 A 區「實際
// 拖曳仍寫 layout」偶發性 flaky 同一計時縫隙成因（見該區與 task-6-report.md
// 「疑慮 3」），非本 Task 引入的新缺陷，亦非 page 專屬（iframe tab 拖曳同樣的
// 拖法理論上一樣會踩）。修法比照該處既有共識——不動 window-manager.js 這個
// 各類拖曳共用的第三期既有原語（改動影響面過大，超出本 Task「只修 G/H 區揪出
// 的缺陷」範圍），改為在測試這端墊一次顯式等待，讓瀏覽器有機會在 pointerup 前
// 先送出至少一顆動畫幀（真人手動拖曳的物理時間跨度本就遠超一顆動畫幀，這裡只
// 是把該保證做顯式，不改變任何被測行為）。分 4 段移動、每段之間都留一次動畫幀
// 空檔（而不只在起手式留一次）：一來確保 dragging 標記在往目標移動的全程都跟得
// 上（不只是「翻成 true」那一瞬間），二來讓最終落點在 mouseup 前有一次額外落定
// 機會，避免 tabBarAt() 命中判定用到還在過渡中的座標。
const hDrag = async (from, to) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const segs = 4;
  for (let i = 1; i <= segs; i++) {
    const x = from.x + (to.x - from.x) * (i / segs);
    const y = from.y + (to.y - from.y) * (i / segs);
    await page.mouse.move(x, y, { steps: 3 });
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(200);
};
const hWinTabs = () => page.evaluate(() => [...document.querySelectorAll('.wm-window')].map((w) => ({
  tabs: [...w.querySelectorAll('.wm-tab')].map((t) => t.dataset.tab),
  active: (w.querySelector('.wm-tab.is-active') || {}).dataset && w.querySelector('.wm-tab.is-active').dataset.tab,
})));

const fromH1Tab = await hTabCenter(pgH1);
const toH2BarEdge = await hTabBarEdge(pgH2);
await hDrag(fromH1Tab, toH2BarEdge);
const hMerged = await hWinTabs();
A(hMerged.length === 1, `H3: 合併後只剩 1 個視窗（${hMerged.length}）`);
A(!!hMerged[0] && hMerged[0].tabs.includes(pgH1) && hMerged[0].tabs.includes(pgH2) && hMerged[0].active === pgH1,
  `H3: 合併視窗含兩頁 tab、剛拖入者作用中（tabs=${hMerged[0] && hMerged[0].tabs.join(',')}, active=${hMerged[0] && hMerged[0].active}）`);
const hVisMerged = await page.evaluate(() => ({
  roof: getComputedStyle(document.querySelector('.roofbutton')).display,
  shrturl: getComputedStyle(document.querySelector('.linkout')).display,
  optitle: getComputedStyle(document.querySelector('.optitlepanel')).display,
  fudausearch: getComputedStyle(document.querySelector('.fudausearch-container')).display,
  tooldl: getComputedStyle(document.querySelector('.tool_zip_dl')).display,
}));
A(hVisMerged.roof !== 'none' && hVisMerged.shrturl !== 'none', 'H3: 合併後作用中頁（頁一）成員可見');
A(hVisMerged.optitle === 'none' && hVisMerged.fudausearch === 'none' && hVisMerged.tooldl === 'none',
  'H3: 合併後非作用中頁（頁二）成員隱藏（display:none，非重載）');

// 撕出：把剛併入的頁一 tab 拖離任何視窗 tabbar 範圍 → 落回獨立新視窗。
const fromMergedTab = await hTabCenter(pgH1);
await hDrag(fromMergedTab, { x: 1600, y: 1050 });
const hAfterTear = await hWinTabs();
A(hAfterTear.length === 2, `H3: 撕出後恢復 2 個視窗（${hAfterTear.length}）`);
const hTornWin = hAfterTear.find((w) => w.tabs.length === 1 && w.tabs[0] === pgH1);
const hOtherWin = hAfterTear.find((w) => w.tabs.includes(pgH2));
A(!!hTornWin, `H3: 撕出視窗只含頁一 tab（${JSON.stringify(hAfterTear.map((w) => w.tabs))}）`);
A(!!hOtherWin && hOtherWin.tabs.length === 1 && hOtherWin.tabs[0] === pgH2 && hOtherWin.active === pgH2,
  'H3: 原視窗恢復只剩頁二 tab 且作用中');
const hVisTorn = await page.evaluate(() => ({
  roof: getComputedStyle(document.querySelector('.roofbutton')).display,
  optitle: getComputedStyle(document.querySelector('.optitlepanel')).display,
}));
A(hVisTorn.roof !== 'none' && hVisTorn.optitle !== 'none', 'H3: 撕出後兩頁成員皆可見（各自視窗作用中 tab）');
A(await hV1Snapshot() === hV1Base, 'H3: v1 keys 位元不變（合併/撕出後）');

// -- H4：最後 CanvasEdit.toggle（confirm 接受）重設 → pages/windows/layout .v2
//    全清、面板回 manifest 預設 --
console.log('  — H4: CanvasEdit.toggle（confirm 接受）重設 → 全清＋面板回預設 —');
page.once('dialog', (d) => d.accept()); // toggle 觸發 confirm → 接受（比照 page-engine-a-test.mjs 的 dismiss 分支，這裡走 accept）
await page.evaluate(() => window.CanvasEdit.toggle());
await page.waitForTimeout(500);

const hAfterReset = await page.evaluate(() => ({
  pages: localStorage.getItem('cspanel.pages.cs.v1'),
  windowsKey: localStorage.getItem('cspanel.windows.cs.v2'),
  layoutKey: localStorage.getItem('cspanel.layout.cs.v2'),
  stackOrder: JSON.parse(localStorage.getItem('cspanel.stack.cs.v2') || '{"order":[]}').order,
}));
A(!hAfterReset.pages || JSON.parse(hAfterReset.pages).length === 0, `H4: pages store 全清（${hAfterReset.pages}）`);
A(hAfterReset.windowsKey === null, 'H4: windows .v2 key 全清');
A(hAfterReset.layoutKey === null, 'H4: layout .v2 key 全清');
// stack key 不比照 pages/windows/layout 要求「全清為 null」——stack-manager.js 的
// reset() 語意是「回到各 surface 的預設名次」，removeItem 後緊接著對仍註冊中的
// surface（一般面板／視窗本體）重新 persist 一份新的預設 order，這是既有正確
// 行為（wm-test.mjs「重設回預設」區段同樣不檢查 key 是否為 null）。這裡只驗證
// 「疊序回預設」不留殘影：不再有任何 page id（'pg:' 前綴）或視窗 id（重設後
// windows 已清空，不應殘留任何 'w' 開頭的視窗疊序條目）留在 order 內。
A(hAfterReset.stackOrder.every((k) => !k.startsWith('pg:')) &&
  hAfterReset.stackOrder.every((k) => !/^w[0-9a-z]+$/.test(k)),
  `H4: 疊序回預設，無殘留 page/視窗 id（order=${JSON.stringify(hAfterReset.stackOrder)}）`);
A((await page.evaluate(() => window.PageEngine.list())).length === 0, 'H4: PageEngine.list() 為空');

const hResetVisual = await page.evaluate(() => {
  const chk = (sel) => {
    const el = document.querySelector(sel);
    return { left: el.style.left, top: el.style.top, display: getComputedStyle(el).display, joined: el.classList.contains('gl-stack-pane') };
  };
  return {
    roof: chk('.roofbutton'), shrturl: chk('.linkout'), optitle: chk('.optitlepanel'),
    fudausearch: chk('.fudausearch-container'), tooldl: chk('.tool_zip_dl'),
  };
});
for (const key of ['roof', 'shrturl', 'optitle', 'fudausearch', 'tooldl']) {
  const v = hResetVisual[key];
  A(v.left === '' && v.top === '', `H4: ${key} inline left/top 回 manifest 預設（left="${v.left}" top="${v.top}"）`);
  A(v.display !== 'none', `H4: ${key} 重設後可見（display=${v.display}）`);
  A(!v.joined, `H4: ${key} 已脫離頁疊序身分（無 .gl-stack-pane）`);
}
const hWinsAfterReset = await page.evaluate(() =>
  [...document.querySelectorAll('.wm-window')].map((w) => [...w.querySelectorAll('.wm-tab')].map((t) => t.dataset.tab)));
A(hWinsAfterReset.every((tabs) => tabs.every((t) => !t.startsWith('pg:'))), 'H4: 重設後無殘留 page tab');
A(await hV1Snapshot() === hV1Base, 'H4: v1 keys 位元不變（CanvasEdit.toggle 重設後，全程終驗）');

await page.close();

const anyFail = fails.length > 0;
await browser.close();
if (anyFail) { console.error(`\n${fails.length} FAILURES`); process.exit(1); }
console.log('\nPAGE-ENGINE-B TEST OK');
