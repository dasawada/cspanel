// 子專案 A 回歸測試：headless 載入 tools/fudau-repro.html，跑「makeDraggable →
// clear → init」三步，斷言 window.__snap === { containers: 1, dragHandles: 1 }。
// 需要本機 server（repo 根）：python3 -m http.server 8123
// 用法：node tools/fudau-repro.mjs
import { chromium } from 'playwright';

const URL_ = process.env.REPRO_URL || 'http://localhost:8123/tools/fudau-repro.html';

const browser = await chromium.launch();
const page = await browser.newPage();
// google sheet API 端點在 fixture 環境無授權，會失敗；initFudausearchPanel 內
// fudausearch_loadData 是 fire-and-forget + try/catch，不影響同步 DOM 斷言。
// 只攔「對外 API 主機」以省去 headless 網路等待——絕不可攔本機 /script/*.js
// 模組檔（會斷掉 import 鏈，window.__snap 永遠不會被設，導致假性 timeout）。
await page.route('**/sheetread.jimmychienwada.cc/**', (r) => r.abort()).catch(() => {});
await page.route('**/google-sheet-worker.*.workers.dev/**', (r) => r.abort()).catch(() => {});

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(URL_);
await page.waitForFunction(() => !!window.__snap, { timeout: 10000 });
const snap = await page.evaluate(() => window.__snap);
await browser.close();

const ok = snap.containers === 1 && snap.dragHandles === 1;
console.log(`snap = ${JSON.stringify(snap)}  (expected {containers:1, dragHandles:1})`);
if (errors.length) console.log('pageerror:', errors.join(' | '));
if (!ok) { console.error('FUDAU REPRO FAIL'); process.exit(1); }
console.log('FUDAU REPRO OK');
