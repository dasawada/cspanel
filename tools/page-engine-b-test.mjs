// 九期B 回歸套件：page 引擎（成組、wm 泛化、quirks 歸隊、持久化）。
// 骨架比照 page-engine-a-test.mjs 的 stub/攔截/A() 收集器/收尾 exit code 結構——
// 全程走 v2 頁（panel_all_v2.html）＋登入 stub＋**/api/order-tool-api 攔截。
// 各 Task 依序增補區段（A、B、C、D…），本檔案為累積套件、每次 commit 前完整跑一次。
// 需本機 server（repo 根）：python3 -m http.server 8123
// 用法：node tools/page-engine-b-test.mjs
import { chromium } from 'playwright';
import { installAccessFixture } from './access-test-fixture.mjs';

const browser = await chromium.launch();
const fails = [];
const A = (c, m) => { if (!c) { fails.push(m); console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

const BASE = process.env.PE_URL || 'http://localhost:8123';
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });

// Session/grant fixture＋order-tool-api business response。
await installAccessFixture(page);
await page.route('**/api/order-tool-api', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":false}' }));

await page.goto(BASE + '/panel_all_v2.html');
await page.waitForSelector('.canned-panel-handle', { timeout: 15000 });

// ===== 共用工具（回饋輪收尾：三類結構性 flake 的架構性收斂）=====
// 1) engineDrag：引擎面板拖曳（hover 熱區/把手路徑）統一 helper，取代全檔各處
//    手刻拖曳序列與零星補丁（分段迴圈＋盲等 30ms、M2 收斂等待、L1c retry）。
//    根因：draggable.js 的 handleDragMove 用 requestAnimationFrame 節流
//    pointermove→updateElementPosition——headless 高負載下 pointerup 若搶先於
//    「處理最後一批 pointermove 的那顆動畫幀」，dragState.translateX/Y 停在舊
//    值，位移部分或全部被吞（與 H3 hDrag 檔頭註解的 wm rAF 縫隙同成因）。
//    盲等不可靠，改為全程條件等待：
//    (a) 按下＋小幅越過 ENGINE_DRAG_THRESHOLD，等 .draggable-dragging 掛上
//        （draggable.js handleDragStart 同步掛 class）＝拖曳確定啟動；等不到
//        （熱區合成 pointerdown 轉發偶發未命中，1/12 取證見 L1c 舊註解）放開
//        重按一次，重試仍失敗印 [診斷] 續行、讓後續斷言如實紅。
//    (b) 分段移動（opts.via 途經點各一手、終點前 4 段、每段 steps:3）。
//    (c) 放開前等面板 rect 收斂到預期落點附近（±30px、timeout 3000、逾時印
//        [診斷] 不拋）——pointer 已停在終點，draggable 的 rAF 只要執行任一幀
//        必然收斂；且 waitForFunction 以 rAF 輪詢，其判定式執行的那一幀必然
//        排在 draggable 先排入的更新幀之後，故首次判定即見終值。預期
//        viewport-left ＝ to.x - (from.x - 按下時面板 boundingBox.x)，再複製
//        draggable.js updateElementPosition 的邊界軟阻尼（越界壓縮 0.3）修正
//        ——否則拖出邊界的場景（E/I2/F2/F3）會恆報假診斷。
//    (d) opts.beforeUp（成組懸停/預覽斷言等放開前掛鉤）→ mouse.up() → 等
//        dragging class 移除（timeout 2000）→ settle（opts.settle ?? 200ms，
//        下限 600ms）。settle 下限的取證依據（回饋輪收尾）：drop 的
//        commitGroup/handleMemberDrop 會排入 GROUP_BOUNCE_REASSERT_MS(500ms)
//        計時器（另有 draggable.js BOUNCE_DURATION 300ms）——若它在「下一手
//        拖曳進行中」才觸發，會重寫拖曳中面板的 inline left/top（實測 F1→F2
//        連鎖：tooldl 拖曳中 left 411→593.552 被平移），退組判定與收斂等待
//        雙雙破裂。舊手刻序列靠「在 500ms 前就放開」僥倖避開；統一 helper 的
//        條件等待拉長拖曳時距後必踩。600ms 下限保證兩顆計時器都在下一手
//        開始前出清，這正是「區段間狀態污染連鎖」在拖曳層的同型修法。
async function engineDrag(pg, panelSel, from, to, opts = {}) {
  let grabDX = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const box = await pg.locator(panelSel).boundingBox();
    grabDX = from.x - box.x;
    await pg.mouse.move(from.x, from.y);
    await pg.mouse.down();
    await pg.mouse.move(from.x + 12, from.y + 8, { steps: 2 });
    const started = await pg.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return !!el && el.classList.contains('draggable-dragging');
    }, panelSel, { timeout: 1500 }).then(() => true).catch(() => false);
    if (started) break;
    // 取證：按壓點實際命中的元素（誰攔截了 pointerdown）＋面板當下 box。
    const hit = await pg.evaluate(([x, y, sel]) => {
      const el = document.elementFromPoint(x, y);
      const box = document.querySelector(sel)?.getBoundingClientRect();
      return JSON.stringify({
        hit: el ? `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 2).join('.')}` : 'NONE',
        box: box ? { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) } : null,
      });
    }, [from.x, from.y, panelSel]).catch(() => 'probe-failed');
    console.error(`  [診斷] engineDrag(${panelSel}): 拖曳未啟動（attempt ${attempt + 1}）${attempt === 0 ? '，放開重試' : '，續行讓斷言如實反映'}；press=(${from.x.toFixed(0)},${from.y.toFixed(0)}) ${hit}`);
    if (attempt === 0) { await pg.mouse.up(); await pg.waitForTimeout(150); }
  }
  for (const p of opts.via || []) await pg.mouse.move(p.x, p.y, { steps: 3 });
  const segs = 4;
  for (let i = 1; i <= segs; i++) {
    await pg.mouse.move(from.x + (to.x - from.x) * (i / segs), from.y + (to.y - from.y) * (i / segs), { steps: 3 });
  }
  // 預期落點（viewport-left），複製 draggable.js 邊界軟阻尼：無 boundaryElement
  // 時邊界為 (0,0)～max(scrollWidth, innerWidth)，越界部分乘 0.3 壓縮。
  const expectedLeft = await pg.evaluate(([sel, raw]) => {
    const el = document.querySelector(sel);
    const w = el.getBoundingClientRect().width;
    const BUFFER = 20; // draggable.js BOUNDARY_BUFFER
    const vw = Math.max(document.documentElement.scrollWidth, window.innerWidth);
    const minLeft = -BUFFER, maxLeft = vw - w + BUFFER;
    if (raw < minLeft) return minLeft - (minLeft - raw) * 0.3;
    if (raw > maxLeft) return maxLeft + (raw - maxLeft) * 0.3;
    return raw;
  }, [panelSel, to.x - grabDX]);
  await pg.waitForFunction(([sel, ex]) =>
    Math.abs(document.querySelector(sel).getBoundingClientRect().x - ex) < 30,
    [panelSel, expectedLeft], { timeout: 3000 })
    .catch(() => console.error(`  [診斷] engineDrag(${panelSel}): 放開前 3s 未收斂到預期落點 x≈${expectedLeft.toFixed(1)}（rAF 饑餓）`));
  if (opts.beforeUp) await opts.beforeUp();
  await pg.mouse.up();
  await pg.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return !el || !el.classList.contains('draggable-dragging');
  }, panelSel, { timeout: 2000 })
    .catch(() => console.error(`  [診斷] engineDrag(${panelSel}): 放開後 2s dragging class 未移除`));
  await pg.waitForTimeout(Math.max(opts.settle ?? 200, 600)); // 下限 600ms，見檔頭 (d)
}

// 2) sectionGate：區段前置殘留閘門（H1/L1b 實測有效的模式鋪開到各主要區段）。
//    取證傾印＋dissolve 全部 pages＋等 .wm-window 歸零＋200ms。前段拖曳失敗的
//    殘留 page/視窗會讓後段幾何與前置假設破裂——閘門確定性清場並印 [診斷]
//    留證（這是留給未來的取證儀器，不是掩蓋：斷言本身不因閘門而放寬）。
//    注意：--stack-rank 是 stack-manager 對所有已註冊面板常態設置的疊序值，
//    不是入組痕跡（H1 首輪取證曾誤判為髒污，全綠輪也帶 rank）；髒污判定只看
//    pane class／display:none／pages store／殘留視窗／殘留預覽。rank 留在傾印供參。
const GATE_PROBE = [
  ['roof', '.roofbutton'], ['shrturl', '.linkout'], ['optitle', '.optitlepanel'],
  ['fudausearch', '.fudausearch-container'], ['tooldl', '.tool_zip_dl'],
  ['dt', '.DT_panel'], ['canned', '.canned-panel'],
];
async function sectionGate(pg, label) {
  const residue = await pg.evaluate((probeList) => {
    const probe = {};
    for (const [id, sel] of probeList) {
      const el = document.querySelector(sel);
      probe[id] = el ? { pane: el.classList.contains('gl-stack-pane'), disp: el.style.display, rank: el.style.getPropertyValue('--stack-rank') } : 'MISSING';
    }
    return {
      probe,
      pages: JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]').map((p) => p.id),
      wins: document.querySelectorAll('.wm-window').length,
      preview: !!document.querySelector('.gl-group-preview'),
    };
  }, GATE_PROBE);
  const dirty = residue.pages.length || residue.wins || residue.preview ||
    Object.values(residue.probe).some((v) => v !== 'MISSING' && (v.pane || v.disp === 'none'));
  if (!dirty) return;
  console.error(`  [診斷] ${label} 前置殘留：${JSON.stringify(residue)}`);
  await pg.evaluate(() => {
    for (const p of JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]')) {
      try { window.PageEngine.dissolve(p.id); } catch (e) {}
    }
  });
  await pg.waitForFunction(() => document.querySelectorAll('.wm-window').length === 0, { timeout: 5000 })
    .catch(() => console.error(`  [診斷] ${label} 殘留視窗 5s 內未拆完`));
  await pg.waitForTimeout(200);
}

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
await engineDrag(page, opt, { x: b.x + b.width / 2, y: b.y + 4 }, { x: b.x + b.width / 2 + 40, y: b.y + 44 }, { settle: 100 });
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
await sectionGate(page, 'D');
// 把 shrturl 拖到 roof 上懸停 600ms → 成組
const s = await page.locator('.linkout').boundingBox();
const r = await page.locator('.roofbutton').boundingBox();
await engineDrag(page, '.linkout', { x: s.x + s.width / 2, y: s.y + 4 }, { x: r.x + r.width / 2, y: r.y + r.height / 2 }, {
  settle: 300,
  beforeUp: async () => {
    // 軟性等待（比照 L1c）：逾時不拋、讓斷言如實紅，避免整支腳本中斷。
    const seen = await page.waitForSelector('.gl-group-preview', { timeout: 3000 }).then(() => true).catch(() => false);
    A(seen, '重疊懸停浮現成組預覽');
    await page.waitForTimeout(600);
  },
});
const d1 = await page.evaluate(() => {
  const pgs = JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]');
  return { n: pgs.length, members: pgs[0] ? pgs[0].members.map((m) => m.panelId) : [] };
});
A(d1.n === 1 && d1.members.includes('shrturl') && d1.members.includes('roof'),
  `放開成組（members=${d1.members.join(',')}）`);
// 誤觸護欄：快速掠過不成組（via 途經 fudausearch 中心、不停留，全程 <500ms 離開）
const o2 = await page.locator('.optitlepanel').boundingBox();
const f2 = await page.locator('.fudausearch-container').boundingBox();
await engineDrag(page, opt, { x: o2.x + o2.width / 2, y: o2.y + 4 }, { x: f2.x + f2.width / 2 + 300, y: f2.y + 200 }, {
  via: [{ x: f2.x + f2.width / 2, y: f2.y + f2.height / 2 }], // 掠過
});
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
await sectionGate(page, 'E');
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
// 落點刻意選在視窗邊界附近（1780,900，viewport 1800x1200）——同時滿足「與目標
// page 視窗重疊 ≥0.4」與「拖曳面板自身觸發 draggable.js 邊界回彈」兩條件。
await engineDrag(page, '.roofbutton', { x: roof2.x + roof2.width / 2, y: roof2.y + 4 }, { x: 1780, y: 900 }, {
  settle: 300,
  beforeUp: async () => {
    const seen = await page.waitForSelector('.gl-group-preview', { timeout: 3000 }).then(() => true).catch(() => false);
    A(seen, 'E: 邊界處仍可浮現成組預覽');
    await page.waitForTimeout(600);
  },
});
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
await sectionGate(page, 'F');
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
await engineDrag(page, '.roofbutton', { x: roofBox.x + roofBox.width / 2, y: roofBox.y + 4 }, { x: targetX, y: targetY });

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
await engineDrag(page, '.tool_zip_dl', { x: tooldlBox.x + tooldlBox.width / 2, y: tooldlBox.y + 4 }, { x: 20, y: content3.top + 10 }); // 遠離內容區左側
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
await engineDrag(page, '.linkout', { x: shrturlBox.x + shrturlBox.width / 2, y: shrturlBox.y + 4 }, { x: 20, y: content3.top + 10 });
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
await sectionGate(page, 'G');

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
await engineDrag(page, '.canned-panel',
  { x: cannedHandleBox.x + cannedHandleBox.width / 2, y: cannedHandleBox.y + cannedHandleBox.height / 2 },
  { x: cannedHandleBox.x + 50, y: cannedHandleBox.y + 50 });
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
await engineDrag(page, '.canned-panel',
  { x: cannedHandleBox2.x + cannedHandleBox2.width / 2, y: cannedHandleBox2.y + cannedHandleBox2.height / 2 },
  { x: cannedHandleBox2.x + 30, y: cannedHandleBox2.y + 30 });
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
await sectionGate(page, 'H');

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
// 前置條件取證（H1 間歇 create→null 調查）：pgCreate 回 null 的唯一內部路徑是
// 成員被 elFor 或 pageJoins 濾掉——即前段殘留「未退組」。原地閘門已抽成
// sectionGate（見檔案前段工具區），改在 H 區開頭統一呼叫。
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
await engineDrag(page, '.roofbutton', { x: hRoofBox.x + hRoofBox.width / 2, y: hRoofBox.y + 4 }, { x: h1TargetX, y: h1TargetY });
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
  // 條件等待取代盲等（systematic-debugging condition-based-waiting）：先小幅越過
  // DRAG_THRESHOLD，等 .wm-drag-ghost 出現＝wm 的 dragging 旗標「確定」翻真
  // （ghost 由第一次真正執行的 onMove 建立），徹底關閉「pointerup 搶先於首顆
  // 動畫幀、被誤判為點擊」的 rAF 節流縫隙——盲等 30ms 在 H 區晚期高負載下
  // 仍有 ~20% 機率等不到幀（10 輪實測 2 failures）。
  // 回饋輪收尾補強：pointerdown 偶發未命中 tab（拖曳根本未啟動，ghost 恆不出
  // 現——與 engineDrag (a) 取證的同型縫隙），原 waitForSelector 逾時直接拋出
  // 會讓整支腳本中斷、後段全部無法回報；比照 engineDrag：等不到 ghost 放開重
  // 按一次，重試仍失敗印 [診斷] 續行，讓後續斷言如實紅。單 tab 視窗／作用中
  // tab 情境下，重試的那次 mouse.up 只是「點擊已作用中的 tab」，無狀態副作用。
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 12, from.y + 8, { steps: 2 });
    const started = await page.waitForSelector('.wm-drag-ghost', { state: 'attached', timeout: 2000 })
      .then(() => true).catch(() => false);
    if (started) break;
    console.error(`  [診斷] hDrag: wm tab 拖曳未啟動（attempt ${attempt + 1}）${attempt === 0 ? '，放開重試' : '，續行讓斷言如實反映'}`);
    if (attempt === 0) { await page.mouse.up(); await page.waitForTimeout(150); }
  }
  const segs = 4;
  for (let i = 1; i <= segs; i++) {
    const x = from.x + (to.x - from.x) * (i / segs);
    const y = from.y + (to.y - from.y) * (i / segs);
    await page.mouse.move(x, y, { steps: 3 });
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector('.wm-drag-ghost'), { timeout: 3000 })
    .catch(() => console.error('  [診斷] hDrag: 放開後 3s ghost 未消失'));
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

// ===== I. 邊界回彈重新斷言：handleMemberDrop 全路徑（九期B 終審 I2）=====
// E 區已驗 commitGroup 成功分支的 GROUP_BOUNCE_REASSERT_MS 重新斷言；本區補齊
// handleMemberDrop 的兩條路徑——draggable.js 的 needsBounce 計時器（300ms 後
// 無條件覆寫 el.style.left/top 為回彈落點）同樣會蓋掉：
//   I1（頁內 free 分支）：syncPanes 剛寫入的頁內定位；
//   I2（拖出退組分支）：leaveMember 剛寫回的落點。
// 手法沿用 E 區：把 page 視窗搬到 viewport 右下角貼邊，讓「頁內拖曳落點」與
// 「拖曳面板自身觸發邊界回彈」同時成立。斷言比照 e2/e3 的冪等性檢查（settled
// 位置手動補跑 syncPanes 不應再變）與 G4 的 detachedRect 回復比對。
// 九期B 回饋輪 Task 3 更新：I2 原斷言「roof 回 detachedRect」是回饋輪修復前的
// 舊語意（leaveMember 無條件套 detachedRect，正是使用者回報的落點錯誤本身）。
// keepPosition 修復後，I2 的 roof 是 handleMemberDrop 實際拖曳退組的那個
// panelId，pgRemoveMember 傳 { keepPosition:true }——但 draggable.js 的
// needsBounce 分支下，onPositionChange（連帶 leaveMember/captureDetachedRect）
// 在其自身 300ms setTimeout 寫回 el.style.left/top 之前就已同步執行，此刻讀到
// 的 inline left/top 其實是「這次拖曳開始前」的值（即 I1 落定的頁內 free 位
// 置，非本次拖曳意圖的落點、也不是 detachedRect）——見 leaveMember keepPosition
// 分支與 handleMemberDrop 拖出分支重新斷言區塊的檔頭註解，此為已知、可接受的
// 邊界情況（brief 明文：既有重新斷言快照機制無需為此改動）。新增 shrturl（同
// 頁「被連帶退組的另一員」，未被拖曳、無 opts）作為對照——它應仍精確回到
// detachedRect，呼應 task-3-brief.md Step 1「剩一自動解散的最後一員仍回
// detachedRect」。
console.log('— I. 頁內拖曳/拖出退組 ＋ 邊界回彈：計時器後仍是 canonical 位置 —');
await sectionGate(page, 'I');
const iPreJoin = await page.evaluate(() => {
  const r = document.querySelector('.roofbutton').getBoundingClientRect();
  return { left: r.left, top: r.top };
});
const iShrturlPreJoin = await page.evaluate(() => {
  const r = document.querySelector('.linkout').getBoundingClientRect();
  return { left: r.left, top: r.top };
});
const pgI = await page.evaluate(() => window.PageEngine.create(['roof', 'shrturl']));
A(typeof pgI === 'string' && pgI.startsWith('pg:'), `I: 成組兩員（${pgI}）`);
await page.waitForTimeout(200);
// 視窗搬到右下角貼邊（重用 E 手法）；直接改 style 不經 wm 拖曳 API，補一次
// syncPanes 讓成員跟上新內容區位置。
await page.evaluate((id) => {
  const win = [...document.querySelectorAll('.wm-window')].find((w) =>
    [...w.querySelectorAll('.wm-tab')].some((t) => t.dataset.tab === id));
  win.style.left = '1300px';
  win.style.top = '800px';
  win.style.width = '550px';
  win.style.height = '400px';
  window.WindowManager.syncPanes();
}, pgI);
// -- I1: 頁內 free 拖曳＋回彈——拖 roof 到內容區內、但貼近 viewport 右緣
//    （roof 寬 110px，落點 x=1790 → 元素右緣 ≈1845 > viewport 1800 → 觸發
//    needsBounce；落點仍與內容區重疊 ≥0.4 → 走頁內 free 分支）。--
const iRoofBox = await page.locator('.roofbutton').boundingBox();
// settle 900ms：跨過 draggable.js BOUNCE_DURATION(300ms) 與 GROUP_BOUNCE_REASSERT_MS(500ms)
// 兩顆計時器，讓畫面完全落定後再讀最終視覺位置。
await engineDrag(page, '.roofbutton', { x: iRoofBox.x + iRoofBox.width / 2, y: iRoofBox.y + 4 }, { x: 1790, y: 900 }, { settle: 900 });
const i1 = await page.evaluate((id) => {
  const pg = JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]').find((p) => p.id === id);
  const r = document.querySelector('.roofbutton').getBoundingClientRect();
  window.WindowManager.syncPanes(); // 冪等性檢查（比照 e3）：settled 應已是 canonical
  const r2 = document.querySelector('.roofbutton').getBoundingClientRect();
  return {
    mode: pg ? pg.layoutMode : null,
    settled: { left: r.left, top: r.top },
    canonical: { left: r2.left, top: r2.top },
  };
}, pgI);
A(i1.mode === 'free', `I1: 頁內拖曳轉 free（${i1.mode}）`);
A(Math.abs(i1.settled.left - i1.canonical.left) < 1 && Math.abs(i1.settled.top - i1.canonical.top) < 1,
  `I1: 回彈計時器後 settled 已是 canonical 頁內定位（Δ=(${(i1.settled.left - i1.canonical.left).toFixed(1)},${(i1.settled.top - i1.canonical.top).toFixed(1)})）`);
// -- I2: 拖出退組＋回彈——把 roof 拖離內容區、貼近 viewport 左緣（落點 x=5 →
//    元素左緣 ≈-50 < 0 → 觸發 needsBounce）。兩員頁拖出一員 → 剩一自動解散：
//    roof（實際被拖曳者，keepPosition）不應回 detachedRect（回饋輪 Task 3 修
//    復核心，見上方檔頭更新註解——needsBounce 邊界情況下最終落在「本次拖曳前
//    的 I1 落定位置」，非 detachedRect）；shrturl（被連帶退組的另一員，未經手
//    opts）仍應精確回 detachedRect（對照）。--
const iRoofBox2 = await page.locator('.roofbutton').boundingBox();
await engineDrag(page, '.roofbutton', { x: iRoofBox2.x + iRoofBox2.width / 2, y: iRoofBox2.y + 4 }, { x: 5, y: 600 }, { settle: 900 });
const i2 = await page.evaluate(() => {
  const r = document.querySelector('.roofbutton').getBoundingClientRect();
  const s = document.querySelector('.linkout').getBoundingClientRect();
  return {
    n: JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]').length,
    roof: { left: r.left, top: r.top },
    shrturl: { left: s.left, top: s.top },
    roofVisible: getComputedStyle(document.querySelector('.roofbutton')).display !== 'none',
  };
});
A(i2.n === 0, `I2: 拖出剩一自動解散，store 清空（n=${i2.n}）`);
A(i2.roofVisible, 'I2: 退組面板回畫布可見');
const i2RoofDelta = Math.hypot(i2.roof.left - iPreJoin.left, i2.roof.top - iPreJoin.top);
A(i2RoofDelta > 50,
  `I2: 回饋輪 Task 3 後，roof（實際被拖曳退組者）不再回 detachedRect（keepPosition 生效，detachedRect=(${iPreJoin.left.toFixed(1)},${iPreJoin.top.toFixed(1)}), 實際=(${i2.roof.left.toFixed(1)},${i2.roof.top.toFixed(1)}), Δ=${i2RoofDelta.toFixed(1)}）`);
A(Math.abs(i2.roof.left - i1.settled.left) < 3 && Math.abs(i2.roof.top - i1.settled.top) < 3,
  `I2: needsBounce 邊界情況下 roof 落在本次拖曳前（I1 settled）的位置（I1 settled=(${i1.settled.left.toFixed(1)},${i1.settled.top.toFixed(1)}), I2 post=(${i2.roof.left.toFixed(1)},${i2.roof.top.toFixed(1)})）`);
A(Math.abs(i2.shrturl.left - iShrturlPreJoin.left) < 3 && Math.abs(i2.shrturl.top - iShrturlPreJoin.top) < 3,
  `I2: 被連帶退組的另一員（shrturl）仍精確回 detachedRect（對照斷言，pre=(${iShrturlPreJoin.left.toFixed(1)},${iShrturlPreJoin.top.toFixed(1)}), post=(${i2.shrturl.left.toFixed(1)},${i2.shrturl.top.toFixed(1)})）`);

// K 區（九期B 回饋輪 Task 1）沿用本區同一 `page`（success:false stub 語境），
// 但物理段落挪到檔尾（J 之後）以維持「區段字母接續檔尾現況」慣例——延後
// page.close() 到 K 區結束（J 用獨立 context ctxJ/pj，兩者互不干擾）。

// ===== J. 真伺服器路徑（success:true）：wm 生產路徑掛載＋二輪注入防護（九期B 終審 C1/I1）=====
// A–I 區全程走 {"success":false} stub，從未覆蓋「fetch 成功、tabsHTML 注入、
// adoptTabs 交棒」的生產路徑——正是 C1（掛載時序）與 I1（二輪注入覆寫）的測試
// 盲區。本區用獨立 browser context（乾淨 localStorage）＋ success:true 攔截，
// tabsHTML 取 tools/wm-fixture.html 的真實 markup 形狀（input[type=radio]
// [name=panel-tab]#panel-tab-X ＋ label[for] ＋ .panel-tab-content，兩顆 tab、
// 其一含 iframe 指向 tools/wm-iframe-stub.html）。
console.log('— J. 真伺服器路徑（success:true）：核心先起→adoptTabs 認養、pageHost 具備、pg: 持久化不被淨化 —');
const TABS_HTML = [
  '<div class="panel-tabs-container">',
  '  <div class="panel-tabs">',
  '    <input type="radio" id="panel-tab-naniclub" name="panel-tab" checked>',
  '    <label for="panel-tab-naniclub">🗝️帳號搜尋</label>',
  '    <div class="panel-tab-content"><iframe class="responsive-iframe" src="/tools/wm-iframe-stub.html?tab=naniclub"></iframe></div>',
  '    <input type="radio" name="panel-tab" id="panel-tab-tools">',
  '    <label for="panel-tab-tools">🚀快捷貼圖</label>',
  '    <div class="panel-tab-content"><div class="appicon">tools-dom-content</div></div>',
  '  </div>',
  '</div>',
].join('\n');
const ctxJ = await browser.newContext({ viewport: { width: 1800, height: 1200 } });
const pj = await ctxJ.newPage();
await installAccessFixture(pj);
await pj.route('**/api/order-tool-api', (r) => r.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({
    success: true, tabsHTML: TABS_HTML,
    ipHTML: '<div class="IPsearch_in_panelALL"><table><tbody><tr><td>ip-stub</td></tr></tbody></table></div>',
  }),
}));
await pj.goto(BASE + '/panel_all_v2.html');
await pj.waitForSelector('.wm-pane[data-tab="naniclub"]', { state: 'attached', timeout: 15000 });
await pj.waitForTimeout(300); // 等候初始登入生命週期完成

// -- J0: 二輪完整注入不殺 pool/layer（I1）——顯式再派發一次 firework-login-success
//    （確定性重現重複登入生命週期訊號；必須穩定覆蓋「首輪已完成後再來一輪」）。
await pj.evaluate(() => window.dispatchEvent(new Event('firework-login-success')));
await pj.waitForTimeout(500);
const j0 = await pj.evaluate(() => {
  const win = document.querySelector('.wm-window');
  const pane = document.querySelector('.wm-pane[data-tab="naniclub"]');
  const ifr = pane && pane.querySelector('iframe');
  const tab = document.querySelector('.wm-tab[data-tab="naniclub"]');
  return {
    winInDoc: !!win && win.isConnected,
    paneAlive: !!pane && pane.isConnected && !!ifr && ifr.isConnected,
    title: tab ? tab.textContent : null,
    tabCount: document.querySelectorAll('.wm-window .wm-tab').length,
  };
});
A(j0.winInDoc, 'J0: 二輪注入後 .wm-window 仍在 DOM（pool/layer 未被 innerHTML 覆寫殺掉）');
A(j0.paneAlive, 'J0: 常駐池 iframe pane（含 iframe）存活');
A(j0.title === '🗝️帳號搜尋', `J0: iframe tab 標題正確（${j0.title}）`);
A(j0.tabCount === 2, `J0: 兩顆 iframe tab 都被認養（${j0.tabCount}）`);

// -- J1: 引擎掛載的核心具 pageHost（C1）——PageEngine.create 後 page tab 標題是
//    成員 label 串接（computeTitle）而非裸 'pg:' id，且成員定位進視窗內容區。--
const pgJ = await pj.evaluate(() => window.PageEngine.create(['optitle', 'fudausearch']));
A(typeof pgJ === 'string' && pgJ.startsWith('pg:'), `J1: PageEngine.create 回 pg: id（${pgJ}）`);
await pj.waitForTimeout(300);
const j1 = await pj.evaluate((id) => {
  const tab = document.querySelector(`.wm-tab[data-tab="${CSS.escape(id)}"]`);
  const win = tab && tab.closest('.wm-window');
  const content = win && win.querySelector('.wm-content').getBoundingClientRect();
  const o = document.querySelector('.optitlepanel').getBoundingClientRect();
  return {
    title: tab ? tab.textContent : null,
    memberIn: content ? (o.top >= content.top - 1 && o.left >= content.left - 1) : false,
  };
}, pgJ);
A(!!j1.title && j1.title.includes('標題生成') && j1.title.includes('職代查詢') && !j1.title.startsWith('pg:'),
  `J1: page tab 標題為成員 label 串接而非裸 id（${j1.title}）`);
A(j1.memberIn, 'J1: 成員定位進 page 視窗內容區（pageHost.layout 生效）');

// -- J2: 含 'pg:' 視窗的持久化在 reload 後存活（C1 淨化盲區）——reload 後 page
//    tab 視窗還原（loadWindows 不得因 isPageId 缺席而濾掉 'pg:' tab），且對
//    windows 存檔做一次「觸發 persist」（拖動視窗 tabbar 空白處幾 px）後，存檔
//    仍含 pg: tab（淨化若發生，這次 persist 就是「永久丟失」的定錨點）。--
await pj.reload();
await pj.waitForSelector('.wm-pane[data-tab="naniclub"]', { state: 'attached', timeout: 15000 });
await pj.waitForTimeout(500); // wm 掛載＋adoptTabs＋hydratePageJoins＋syncPanes 落定
const j2a = await pj.evaluate((id) => {
  const tab = document.querySelector(`.wm-tab[data-tab="${CSS.escape(id)}"]`);
  const win = tab && tab.closest('.wm-window');
  const content = win && win.querySelector('.wm-content').getBoundingClientRect();
  const o = document.querySelector('.optitlepanel').getBoundingClientRect();
  return {
    tabAlive: !!tab,
    title: tab ? tab.textContent : null,
    memberIn: content ? (o.top >= content.top - 1 && o.left >= content.left - 1) : false,
    pagesLen: JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]').length,
  };
}, pgJ);
A(j2a.tabAlive, 'J2: reload 後 page tab 視窗存活（未被 loadWindows 淨化）');
A(!!j2a.title && j2a.title.includes('標題生成'), `J2: reload 後 page tab 標題仍為成員 label（${j2a.title}）`);
A(j2a.memberIn, 'J2: reload 後成員重新定位進內容區（hydratePageJoins＋pageHost）');
A(j2a.pagesLen === 1, `J2: pages store 跨 reload 保留（len=${j2a.pagesLen}）`);
// 觸發一次 persist：拖 iframe 視窗的 tabbar 空白處位移 12px（走 wm 自身的視窗
// 移動路徑，結束時 persist()）。
const jBar = await pj.evaluate(() => {
  const win = [...document.querySelectorAll('.wm-window')].find((w) =>
    [...w.querySelectorAll('.wm-tab')].some((t) => t.dataset.tab === 'naniclub'));
  const b = win.querySelector('.wm-tabbar').getBoundingClientRect();
  return { x: b.right - 8, y: b.top + b.height / 2 };
});
await pj.mouse.move(jBar.x, jBar.y);
await pj.mouse.down();
await pj.mouse.move(jBar.x + 12, jBar.y + 12, { steps: 4 });
await pj.waitForTimeout(50);
await pj.mouse.up();
await pj.waitForTimeout(200);
const j2b = await pj.evaluate(() => {
  const stored = JSON.parse(localStorage.getItem('cspanel.windows.cs.v2') || '{"windows":[]}');
  return { storedHasPg: (stored.windows || []).some((w) => (w.tabs || []).some((t) => String(t).startsWith('pg:'))) };
});
A(j2b.storedHasPg, 'J2: persist 後 windows .v2 存檔仍含 pg: tab（持久化未被淨化）');
await pj.close();
await ctxJ.close();

// ===== K. 入組成員抑制 transition（九期B 回饋輪 Task 1：修「慢一拍」）=====
// 根因：sharedGeometryCss／dt geometryCss 的 transition:all 0.3s ease 讓
// pageHost.layout 每幀寫入的 inline left/top 被動畫追趕，拖曳視窗移動時視覺
// 「慢一拍」。修法：joinMember 設 inline transition:none（inline 勝 CSS），
// leaveMember 還原——斷言 dt（帶 transition）入組期間 computed
// transitionDuration 為 0s，dissolve 後回落 CSS 幾何的 0.3s（v1 語義不變）。
// 沿用 A–I 區同一 `page`（success:false stub 語境，J 區的 pj/ctxJ 是獨立
// context，兩者互不干擾，此刻 `page` 仍開著）；L 區沿用同一 page，本區結束不
// close（見 L 區檔頭說明，物理段落同樣挪到檔尾以維持「區段字母接續檔尾現況」
// 慣例，L 結束才真正 page.close()）。
console.log('— K. 入組成員抑制 transition（joinMember/leaveMember，回饋輪 Task 1）—');
const pgK = await page.evaluate(() => window.PageEngine.create(['dt', 'optitle']));
A(typeof pgK === 'string' && pgK.startsWith('pg:'), `K: 成組 dt+optitle（${pgK}）`);
await page.waitForTimeout(200);
const k1 = await page.evaluate(() => getComputedStyle(document.querySelector('.DT_panel')).transitionDuration);
A(k1 === '0s', `K1: 入組期間 dt 的 transition 被抑制（transitionDuration=${k1}）`);
await page.evaluate((id) => window.PageEngine.dissolve(id), pgK);
await page.waitForTimeout(200);
const k2 = await page.evaluate(() => getComputedStyle(document.querySelector('.DT_panel')).transitionDuration);
A(k2 === '0.3s', `K2: dissolve 後 dt 的 transition 復原為 CSS 幾何 0.3s（transitionDuration=${k2}）`);

// ===== L. pageSolo 面板——排除成組、拖進 wm 視窗 tabbar 成單獨分頁（九期B 回饋輪 Task 2）=====
// 根因：groupTargets()（成組候選集組成點）原本無條件把「其他自由面板」與「既有
// page 視窗內容區」都算進重疊候選——toggle 大面板（dt/consultant/assist）畫面
// 尺寸夠大，日常操作很容易與其他面板／頁視窗重疊過門檻，違反使用者「這類大面板
// 只想拖進視窗 tabbar 成獨立分頁，不該被誤觸成組」的期待。修法：manifest 新增
// `pageSolo:true`（cs.js dt/consultant/assist），groupTargets() 雙向排除（來源
// 是 pageSolo → panel/page 目標全排除；任何面板拖曳時 pageSolo 面板不出現在
// panel 目標清單）；新增 tabbar 目標型別（指標座標 in-rect 命中，非面積重疊——
// tabbar 僅 36px 高，面積比永遠達不到 GROUP_OVERLAP_RATIO），對所有面板（含一般
// 面板）開放，drop 後 PageEngine.create([panelId], { targetWindowId }) 建單員
// page 併入該視窗。沿用 K 區同一 `page`（此刻仍開著，K 結束未 close）。
console.log('— L. pageSolo 面板：排除成組、拖進 tabbar 成單獨分頁（回饋輪 Task 2）—');
await sectionGate(page, 'L');

// -- L1(a): 拖 dt（pageSolo 來源）疊上 optitle，懸停 700ms 不應出現成組預覽
//    （來源排除——groupTargets 對 sourceIsSolo 直接跳過 panel/page 兩個迴圈，
//    此刻無任何 wm 視窗存在，tabbar 候選亦為空，best 全程為 null）。--
const dtBoxA = await page.locator('.DT_panel').boundingBox();
const optBoxA = await page.locator('.optitlepanel').boundingBox();
await engineDrag(page, '.DT_panel', { x: dtBoxA.x + dtBoxA.width / 2, y: dtBoxA.y + 4 }, { x: optBoxA.x + optBoxA.width / 2, y: optBoxA.y + optBoxA.height / 2 }, {
  beforeUp: async () => {
    await page.waitForTimeout(700);
    A(await page.evaluate(() => !document.querySelector('.gl-group-preview')),
      'L1a: pageSolo 來源（dt）疊上一般面板懸停 700ms 不出現成組預覽');
  },
});
A(await page.evaluate(() => JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]').length === 0),
  'L1a: 放開後未成組（pages store 仍空）');
// 防呆清場：RED（修復前）dt 其實會正常成組——若不清掉，optitle 會變成 page
// 成員，導致 L1b 因「已是成員、joinMember 不啟動 groupWatch」而巧合通過，並非
// 真的驗證到 pageSolo 目標排除；GREEN（修復後）這裡 pages store 應已是空，
// dissolve 呼叫安全 no-op（找不到 page id 直接跳過）。
await (async () => {
  const leftoverId = await page.evaluate(() => {
    const pgs = JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]');
    return pgs[0] ? pgs[0].id : null;
  });
  if (leftoverId) {
    await page.evaluate((id) => window.PageEngine.dissolve(id), leftoverId);
    await page.waitForTimeout(200);
  }
})();

// -- L1(b): 拖 optitle 疊上 dt（pageSolo 目標），懸停 700ms 不應出現成組預覽
//    （目標排除——dt 被 groupTargets 的 panel 迴圈濾掉，不管誰拖過來）。--
// 前置條件取證（間歇性失敗調查）：L1b 若成組，唯一合法目標來源是「前段殘留的
// page 視窗內容區」。先斷言畫面乾淨；不乾淨即前段清場競態的直接證據——印診斷、
// 確定性拆除後再進行，讓 L1b 只驗證 pageSolo 排除本身（閘門已抽成 sectionGate）。
await sectionGate(page, 'L1b');
// 幾何取證結論（間歇失敗根因）：dt 是 toggle 面板，縮小態僅 105×30 且緊鄰
// shrturl（438,58）——「拖到 dt 中心」的 optitle（400×120）會同時疊上 shrturl，
// 與 shrturl 的重疊比 ≥0.4 而合法成組（成組的是 shrturl+optitle，pageSolo 排除
// 其實正常）。修法：先把 dt 移到空曠區（1150,760——遠離所有預設面板與罐頭），
// 再拖 optitle 疊上去，讓斷言只量測「optitle×dt」一對重疊。
await page.evaluate(() => {
  const el = document.querySelector('.DT_panel');
  el.style.left = '1150px'; el.style.top = '760px';
});
await page.waitForTimeout(100);
const optBoxB = await page.locator('.optitlepanel').boundingBox();
const dtBoxB = await page.locator('.DT_panel').boundingBox();
// 落點 (dt.x+180, dt.y+50)：dt 縮小態（105×30）時 optitle 完整罩住 dt（比 1.0）、
// 展開態（900 寬）時交集比 ≈0.87——兩種尺寸態皆穩超過 0.4 門檻且不碰其他面板。
await engineDrag(page, '.optitlepanel', { x: optBoxB.x + optBoxB.width / 2, y: optBoxB.y + 4 }, { x: dtBoxB.x + 180, y: dtBoxB.y + 50 }, {
  beforeUp: async () => {
    await page.waitForTimeout(700);
    const pv = await page.evaluate(() => {
      const el = document.querySelector('.gl-group-preview');
      return el ? { text: el.textContent.trim(), rect: el.getBoundingClientRect() } : null;
    });
    A(!pv, `L1b: 一般面板疊上 pageSolo 目標（dt）懸停 700ms 不出現成組預覽${pv ? `（診斷：預覽=${JSON.stringify(pv)}）` : ''}`);
  },
});
{
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]'));
  A(st.length === 0, `L1b: 放開後未成組（pages store 仍空）${st.length ? `（診斷：${JSON.stringify(st.map((pg) => ({ id: pg.id, m: pg.members.map((m) => m.panelId) })))}）` : ''}`);
}
// 同上防呆清場，確保 L1(c) 開始時 dt/optitle 皆為自由面板。
await (async () => {
  const leftoverId = await page.evaluate(() => {
    const pgs = JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]');
    return pgs[0] ? pgs[0].id : null;
  });
  if (leftoverId) {
    await page.evaluate((id) => window.PageEngine.dissolve(id), leftoverId);
    await page.waitForTimeout(200);
  }
})();

// -- L1(c): 先 API 建一個 page 視窗（shrturl+tooldl，兩者此刻皆為自由面板），
//    拖 dt 使指標進入其 tabbar 懸停 → 預覽（文案含「成為分頁」）→ 放開 → 該
//    視窗多一顆 tab、標題「測試報告生成」、dt 定位進內容區、pages store 多一筆
//    單員 page 且不自動解散。--
const pgL = await page.evaluate(() => window.PageEngine.create(['shrturl', 'tooldl']));
A(typeof pgL === 'string' && pgL.startsWith('pg:'), `L1c: 先建一個 page 視窗（${pgL}）`);
await page.waitForTimeout(200);
const lBar = await page.evaluate((id) => {
  const win = [...document.querySelectorAll('.wm-window')].find((w) =>
    [...w.querySelectorAll('.wm-tab')].some((t) => t.dataset.tab === id));
  const b = win.querySelector('.wm-tabbar').getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}, pgL);
const dtBoxC = await page.locator('.DT_panel').boundingBox();
// 「拖曳未啟動」單次重試防護（1/12 殘餘 flake 取證後的處置）已內建於
// engineDrag 的 (a) 步驟；預覽用軟性等待（不用 waitForSelector 的預設拋錯行
// 為）：RED 階段（修復前）本就預期不會出現預覽，讓後續斷言能以清楚的失敗訊
// 息呈現，而不是整支測試腳本中途拋例外中斷、後面區段全部無法回報。
await engineDrag(page, '.DT_panel', { x: dtBoxC.x + dtBoxC.width / 2, y: dtBoxC.y + 4 }, { x: lBar.x, y: lBar.y }, {
  via: [{ x: (dtBoxC.x + dtBoxC.width / 2 + lBar.x) / 2, y: (dtBoxC.y + 4 + lBar.y) / 2 }],
  settle: 300,
  beforeUp: async () => {
    const lPreviewSeen = await page.waitForSelector('.gl-group-preview', { timeout: 3000 }).then(() => true).catch(() => false);
    const lPreviewText = lPreviewSeen ? await page.evaluate(() => document.querySelector('.gl-group-preview').textContent) : null;
    A(lPreviewSeen && lPreviewText.includes('成為分頁'),
      `L1c: 拖 dt 指標進 tabbar 懸停浮現「成為分頁」預覽（文案=${lPreviewText}）`);
    await page.waitForTimeout(600);
  },
});
const l1c = await page.evaluate((id) => {
  const win = [...document.querySelectorAll('.wm-window')].find((w) =>
    [...w.querySelectorAll('.wm-tab')].some((t) => t.dataset.tab === id));
  const tabs = win ? [...win.querySelectorAll('.wm-tab')].map((t) => t.dataset.tab) : [];
  const newTabId = tabs.find((t) => t !== id) || null;
  const newTab = newTabId ? win.querySelector(`.wm-tab[data-tab="${CSS.escape(newTabId)}"]`) : null;
  const content = win ? win.querySelector('.wm-content').getBoundingClientRect() : null;
  const dt = document.querySelector('.DT_panel').getBoundingClientRect();
  const pages = JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]');
  return {
    tabCount: tabs.length,
    newTabId,
    newTabTitle: newTab ? newTab.textContent : null,
    dtIn: content ? (dt.top >= content.top - 1 && dt.left >= content.left - 1) : false,
    pagesLen: pages.length,
    newPage: newTabId ? pages.find((p) => p.id === newTabId) : null,
  };
}, pgL);
A(l1c.tabCount === 2, `L1c: 視窗多一顆 tab（tabCount=${l1c.tabCount}）`);
A(!!l1c.newTabTitle && l1c.newTabTitle.includes('測試報告生成'), `L1c: 新 tab 標題正確（${l1c.newTabTitle}）`);
A(l1c.dtIn, 'L1c: dt 定位進視窗內容區');
A(l1c.pagesLen === 2, `L1c: pages store 多一筆單員 page（pagesLen=${l1c.pagesLen}）`);
A(!!l1c.newPage && l1c.newPage.members.length === 1 && l1c.newPage.members[0].panelId === 'dt',
  `L1c: 新 page 為單員（dt）且未自動解散（members=${l1c.newPage ? JSON.stringify(l1c.newPage.members) : l1c.newPage}）`);

// -- L1(d): reload 後單員 page tab 存活 --
await page.reload();
await page.waitForSelector('.canned-panel-handle', { timeout: 15000 });
await page.waitForTimeout(500);
const l1d = await page.evaluate((id) => {
  const tab = id ? document.querySelector(`.wm-tab[data-tab="${CSS.escape(id)}"]`) : null;
  return {
    tabAlive: !!tab,
    title: tab ? tab.textContent : null,
    pagesLen: JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]').length,
  };
}, l1c.newTabId);
A(l1d.tabAlive, 'L1d: reload 後單員 page tab 存活');
A(!!l1d.title && l1d.title.includes('測試報告生成'), `L1d: reload 後標題仍正確（${l1d.title}）`);
A(l1d.pagesLen === 2, `L1d: reload 後 pages store 仍是 2 筆（含單員 page）（pagesLen=${l1d.pagesLen}）`);

// L 區收尾清場：pgL 與單員 dt page 是本區建構產物，斷言完畢後明確拆除（比照
// C/D/E/G 各區自我清場慣例），讓 M 區在乾淨畫布上開始——M 的宿主視窗落位因此
// 可預期（回饋輪收尾：M 區落點幾何不再依賴前段殘留視窗的排擠效應；sectionGate
// 的 [診斷] 保留給「非預期」污染，本處是預期內建構物、靜默拆除）。
await page.evaluate(() => {
  for (const pg of JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]')) {
    try { window.PageEngine.dissolve(pg.id); } catch (e) {}
  }
});
await page.waitForFunction(() => document.querySelectorAll('.wm-window').length === 0, { timeout: 5000 })
  .catch(() => console.error('  [診斷] L 收尾殘留視窗 5s 內未拆完'));
await page.waitForTimeout(200);

// ===== M. 拖出退組落點所見即所得（九期B 回饋輪 Task 3）=====
// 根因（計畫 Architecture 3）：handleMemberDrop 拖出分支呼叫 pgRemoveMember →
// leaveMember 無條件恢復 detachedRect，蓋掉 draggable 剛寫好的落點。修法：
// leaveMember 加 opts.keepPosition，handleMemberDrop 拖出分支傳 true——僅套用在
// 「實際被拖曳退組的那一員」；pgRemoveMember 剩一自動解散分支內 for 迴圈掃到的
// 「被連帶退組的另一員」不受影響，仍走 detachedRect（task-3-brief.md Step 1
// 「剩一自動解散的最後一員仍回 detachedRect」對照斷言）。沿用全檔既有 `page`
// （L 區結束未 close，見該區檔頭說明）。
console.log('— M. 拖出退組落點所見即所得（keepPosition，回饋輪 Task 3）—');
await sectionGate(page, 'M');

// -- M0：入組前先把兩員都移離原位，讓 detachedRect 與稍後 M2 的落點必然不同
//    （task-3-brief.md Step 1 前置要求，避免巧合相等讓斷言失去意義）。直接寫
//    inline left/top（而非模擬滑鼠拖曳）——這裡只是測試前置的「擺放」，要驗證
//    的拖曳手勢是 M2；captureDetachedRect／leaveMember 本就只讀 inline
//    left/top／offsetLeft/Top（見 canvas-engine.js 檔頭註解），與是否經滑鼠拖
//    曳寫入無關，直接賦值等價、更決定性（不受 headless 環境下 rAF 節流拖曳手
//    勢的既有偶發性 flaky 干擾，同 H3 區「不動…改為在測試這端」同一取捨精
//    神）。--
const mDetached = await page.evaluate(() => {
  const place = (sel, left, top) => {
    const el = document.querySelector(sel);
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top };
  };
  return { optitle: place('.optitlepanel', 0, 0), fudausearch: place('.fudausearch-container', 0, 700) };
});

// -- M1：成組兩員（optitle+fudausearch）——此刻各自的 detachedRect 即 M0 落點。
//    明確傳 rect 把宿主視窗擺到畫布中上（500,100,480,380），與 M0 兩點皆不重
//    疊，讓 M2 的拖出落點判定乾淨可控。x 刻意選偏左：M2 的相對落點
//    （contentRect.right + 150）連同 optitle 自身寬度必須落在 scrollWidth 的
//    clamp 上限內，clamp 才永遠不會把落點回壓進內容區（見 M2 落點註解）。--
const pgM = await page.evaluate(() =>
  window.PageEngine.create(['optitle', 'fudausearch'], { rect: { x: 500, y: 100, w: 480, h: 380 } }));
A(typeof pgM === 'string' && pgM.startsWith('pg:'), `M1: 成組兩員（${pgM}）`);
await page.waitForTimeout(200);
await page.evaluate(() => localStorage.removeItem('cspanel.layout.cs.v2')); // 清空 layout store，供 M2 驗證「落點寫入 .v2」乾淨可判定

// -- M2：把其中一員（optitle）拖出內容區、放開在畫布上「相對於宿主視窗實際
//    contentRect」算出的一點（回饋輪收尾：取代 magic 1200/600——那組值假設 M
//    視窗被排在預設位置；若視窗被排到別處，1200/600 反而落在自己內容區內→退
//    組永不觸發）：x＝contentRect.right + 150（元素左緣＝content.right − 50，
//    x 向重疊固定 50px，對 min 面積比 ≈0.125 ≪ GROUP_OVERLAP_RATIO 0.4，必判
//    「拖出」）、y＝contentRect.top + 100；並 clamp 於 scrollWidth/Height 邊界
//    內——上限扣掉「放開時元素超出指標的那段」＋200px 緩衝，避免誤觸
//    draggable.js 的 needsBounce（邊界回彈——回彈分支下 onPositionChange 收到
//    的是「已修正的落點」，但 panel.style.left/top 要等其自身 300ms setTimeout
//    才真正寫入，此刻 keepPosition 讀到的會是回彈前的舊值，不是本斷言要驗證的
//    對象；I2 區另有專門驗證回彈情境，見該區）。M1 的視窗 rect 選在 x=500 保
//    證 clamp 在最小 scrollWidth（=viewport 1800）下也不會回頭把落點壓進內容
//    區。→ 兩員頁 splice 後剩 1（<=1）觸發整頁自動解散，但「實際被拖曳的那一
//    員」（optitle）應落在放開時的位置——不等於 detachedRect（keepPosition 修
//    復核心）；「被連帶退組的另一員」（fudausearch，M3 驗證）仍應回
//    detachedRect（對照）。「放開時面板位置」以抓取點（grab offset）＋滑鼠終
//    點數學算出預期落點；拖曳機制（分段＋放開前收斂等待）統一由 engineDrag
//    提供，settle 900ms 跨過 BOUNCE_DURATION(300ms)＋GROUP_BOUNCE_REASSERT_MS
//    (500ms) 兩顆計時器，讓畫面完全落定。--
const mHostContent = await page.evaluate((id) => {
  const win = [...document.querySelectorAll('.wm-window')].find((w) =>
    [...w.querySelectorAll('.wm-tab')].some((t) => t.dataset.tab === id));
  const c = win.querySelector('.wm-content').getBoundingClientRect();
  return { left: c.left, top: c.top, right: c.right, bottom: c.bottom };
}, pgM);
const mOptBox1 = await page.locator('.optitlepanel').boundingBox();
const mScrollDims = await page.evaluate(() =>
  ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
const mGrabX = mOptBox1.x + mOptBox1.width / 2, mGrabY = mOptBox1.y + 4;
const mDropX = Math.min(mHostContent.right + 150, mScrollDims.w - (mOptBox1.width - (mGrabX - mOptBox1.x)) - 200);
const mDropY = Math.min(mHostContent.top + 100, mScrollDims.h - (mOptBox1.height - (mGrabY - mOptBox1.y)) - 200);
const mExpected = { left: mDropX - (mGrabX - mOptBox1.x), top: mDropY - (mGrabY - mOptBox1.y) };
await engineDrag(page, '.optitlepanel', { x: mGrabX, y: mGrabY }, { x: mDropX, y: mDropY }, { settle: 900 });
const mAfterSettle = await page.evaluate((id) => {
  const pages = JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]');
  const layout = JSON.parse(localStorage.getItem('cspanel.layout.cs.v2') || '{}');
  const optEl = document.querySelector('.optitlepanel');
  const fudaEl = document.querySelector('.fudausearch-container');
  const opt = optEl.getBoundingClientRect();
  const fuda = fudaEl.getBoundingClientRect();
  return {
    // 明確找 pgM 這個 id 是否還在 store 裡（自動解散後應被移除，見
    // pgRemoveMember 的剩一分支）——不用 pagesLen 當判準：全檔累積套件下對
    // 「store 恰有幾筆」的假設脆弱（L 區收尾已清場，但判準仍保持 id 錨定）。
    pgMGone: !pages.some((p) => p.id === id),
    optitle: { left: opt.left, top: opt.top },
    fudausearch: { left: fuda.left, top: fuda.top },
    optitleInline: { left: parseFloat(optEl.style.left), top: parseFloat(optEl.style.top) },
    layoutOptitle: layout.optitle || null,
  };
}, pgM);
A(mAfterSettle.pgMGone, `M2: 兩員頁拖出一員後剩一，自動解散（pgM 已從 store 移除）`);
A(Math.abs(mAfterSettle.optitle.left - mExpected.left) < 5 && Math.abs(mAfterSettle.optitle.top - mExpected.top) < 5,
  `M2: optitle computed left/top ≈ 放開時面板位置（預期=(${mExpected.left.toFixed(1)},${mExpected.top.toFixed(1)}), 實際=(${mAfterSettle.optitle.left.toFixed(1)},${mAfterSettle.optitle.top.toFixed(1)})）`);
const mOptDelta = Math.hypot(mAfterSettle.optitle.left - mDetached.optitle.left, mAfterSettle.optitle.top - mDetached.optitle.top);
A(mOptDelta > 50,
  `M2: optitle 落點與 detachedRect 明顯不同（keepPosition 生效，Δ=${mOptDelta.toFixed(1)}px，detachedRect=(${mDetached.optitle.left.toFixed(1)},${mDetached.optitle.top.toFixed(1)})，落點=(${mAfterSettle.optitle.left.toFixed(1)},${mAfterSettle.optitle.top.toFixed(1)})）`);
A(!!mAfterSettle.layoutOptitle &&
  Math.abs(mAfterSettle.layoutOptitle.x - mAfterSettle.optitleInline.left) < 1 && Math.abs(mAfterSettle.layoutOptitle.y - mAfterSettle.optitleInline.top) < 1,
  `M2: layout store .v2 記錄落點（layout=${JSON.stringify(mAfterSettle.layoutOptitle)}, inline=(${mAfterSettle.optitleInline.left},${mAfterSettle.optitleInline.top})）`);

// -- M3：被連帶退組的另一員（fudausearch，對照）——未被拖曳、無 opts，仍回
//    detachedRect（task-3-brief.md Step 1「剩一自動解散的最後一員仍回
//    detachedRect」）。--
A(Math.abs(mAfterSettle.fudausearch.left - mDetached.fudausearch.left) < 3 &&
  Math.abs(mAfterSettle.fudausearch.top - mDetached.fudausearch.top) < 3,
  `M3: 被連帶退組的另一員（fudausearch）仍回 detachedRect（對照斷言，pre=(${mDetached.fudausearch.left.toFixed(1)},${mDetached.fudausearch.top.toFixed(1)}), post=(${mAfterSettle.fudausearch.left.toFixed(1)},${mAfterSettle.fudausearch.top.toFixed(1)})）`);

// -- M4：對照組——API removeMember（無 opts）／剩一自動解散維持 detachedRect
//    語義不變（brief 明文：「API PageEngine.dissolve／removeMember（無 opts）與
//    剩一自動解散維持 detachedRect 語義不變」）。用另一組面板（roof+consultant）
//    純 API 操作（無滑鼠拖曳），驗證「不傳 opts」路徑完全不受 keepPosition 影響。--
const mApiPreJoin = await page.evaluate(() => {
  const r = document.querySelector('.roofbutton').getBoundingClientRect();
  return { left: r.left, top: r.top };
});
const pgM2 = await page.evaluate(() => window.PageEngine.create(['roof', 'consultant']));
A(typeof pgM2 === 'string' && pgM2.startsWith('pg:'), `M4: 成組兩員（純 API，${pgM2}）`);
await page.waitForTimeout(200);
await page.evaluate((id) => window.PageEngine.removeMember(id, 'roof'), pgM2); // 無 opts → 觸發剩一自動解散
await page.waitForTimeout(200);
const mApiAfter = await page.evaluate((id) => {
  const r = document.querySelector('.roofbutton').getBoundingClientRect();
  const pages = JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]');
  return { pgM2Gone: !pages.some((p) => p.id === id), left: r.left, top: r.top };
}, pgM2);
A(mApiAfter.pgM2Gone, 'M4: 剩一自動解散，pgM2 已從 store 移除');
A(Math.abs(mApiAfter.left - mApiPreJoin.left) < 3 && Math.abs(mApiAfter.top - mApiPreJoin.top) < 3,
  `M4: API removeMember（無 opts）維持 detachedRect 語義不變（pre=(${mApiPreJoin.left.toFixed(1)},${mApiPreJoin.top.toFixed(1)}), post=(${mApiAfter.left.toFixed(1)},${mApiAfter.top.toFixed(1)})）`);

// ===== N. 成組視窗生成於手勢位置（WYSIWYG，回饋輪 2 Task 1）=====
// 根因（計畫 Architecture 1）：commitGroup panel 分支呼叫 pgCreate([target.id,
// dragged]) 未傳 rect，createPageWindow 落硬編碼預設值 (410,160)，與手勢實際
// 觸發的畫面位置無關。修法：commitGroup 取目標與拖曳兩面板「成組當下」的
// getBoundingClientRect() 聯集為新視窗初始 rect（見 canvas-engine.js
// groupUnionRect）。本區段把 shrturl 拖疊 roof 成組，在放開前（beforeUp，兩者
// 螢幕位置與 commitGroup 屆時讀到的完全一致）擷取聯集 bbox 左上角（viewport
// 座標），與放開後新 .wm-window 的 boundingRect 左上角（同為 viewport 座標，
// 兩者無需換算容器座標即可直接比較）比對，差距應 <40px（而非落在硬編碼預設值
// 410,160）。
console.log('— N. 成組視窗生成於手勢位置（WYSIWYG）—');
await sectionGate(page, 'N');
const nRoof = await page.locator('.roofbutton').boundingBox();
const nShr = await page.locator('.linkout').boundingBox();
let nUnion = null;
await engineDrag(page, '.linkout', { x: nShr.x + nShr.width / 2, y: nShr.y + 4 }, { x: nRoof.x + nRoof.width / 2, y: nRoof.y + nRoof.height / 2 }, {
  settle: 300,
  beforeUp: async () => {
    const seen = await page.waitForSelector('.gl-group-preview', { timeout: 3000 }).then(() => true).catch(() => false);
    A(seen, 'N: 重疊懸停浮現成組預覽');
    await page.waitForTimeout(600);
    nUnion = await page.evaluate(() => {
      const a = document.querySelector('.linkout').getBoundingClientRect();
      const b = document.querySelector('.roofbutton').getBoundingClientRect();
      return { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top) };
    });
  },
});
A(!!nUnion, 'N: 成組當下聯集 bbox 已擷取');
const nWin = await page.evaluate(() => {
  const pgs = JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]');
  const pg = pgs[0];
  if (!pg) return null;
  const win = [...document.querySelectorAll('.wm-window')].find((w) =>
    [...w.querySelectorAll('.wm-tab')].some((t) => t.dataset.tab === pg.id));
  if (!win) return null;
  const r = win.getBoundingClientRect();
  return { left: r.left, top: r.top, members: pg.members.map((m) => m.panelId) };
});
A(!!nWin && nWin.members.includes('shrturl') && nWin.members.includes('roof'),
  `N: 放開成組（members=${nWin ? nWin.members.join(',') : 'null'}）`);
const nDelta = (nWin && nUnion) ? Math.hypot(nWin.left - nUnion.left, nWin.top - nUnion.top) : Infinity;
A(nDelta < 40,
  `N: 新視窗落於手勢聯集位置，非預設 410,160（視窗=(${nWin ? nWin.left.toFixed(1) : '?'},${nWin ? nWin.top.toFixed(1) : '?'}), 聯集=(${nUnion ? nUnion.left.toFixed(1) : '?'},${nUnion ? nUnion.top.toFixed(1) : '?'}), Δ=${Number.isFinite(nDelta) ? nDelta.toFixed(1) : '?'}）`);
// 清場
await page.evaluate(() => {
  for (const pg of JSON.parse(localStorage.getItem('cspanel.pages.cs.v1') || '[]')) {
    try { window.PageEngine.dissolve(pg.id); } catch (e) {}
  }
});
await page.waitForFunction(() => document.querySelectorAll('.wm-window').length === 0, { timeout: 5000 })
  .catch(() => console.error('  [診斷] N 收尾殘留視窗 5s 內未拆完'));
await page.waitForTimeout(200);

await page.close();

const anyFail = fails.length > 0;
await browser.close();
if (anyFail) { console.error(`\n${fails.length} FAILURES`); process.exit(1); }
console.log('\nPAGE-ENGINE-B TEST OK');
