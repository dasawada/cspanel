// 佈局視差 harness：stub Firebase 觸發登入流程，量測面板 rect 與全域疊序。
// 用法：node tools/layout-parity.mjs capture out.json
//       node tools/layout-parity.mjs compare baseline.json current.json
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const [, , cmd, a, b] = process.argv;
const SELECTORS = JSON.parse(readFileSync(new URL('./parity-selectors.json', import.meta.url)));
const URL_ = process.env.PARITY_URL || 'http://localhost:8123/panel_all.html';

async function capture(outfile) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
  await page.addInitScript(() => {
    localStorage.setItem('firebase_id_token', 'parity-stub');
    localStorage.setItem('cspanel.theme.v1', 'olive');
    const fakeUser = { getIdToken: async () => 'parity-stub' };
    window.firebase = {
      apps: [{}],
      initializeApp: () => {},
      auth: () => ({
        onAuthStateChanged: (cb) => setTimeout(() => cb(fakeUser), 50),
        currentUser: fakeUser,
        signOut: async () => {},
        signInWithEmailAndPassword: async () => ({ user: fakeUser }),
      }),
      firestore: () => ({}),
    };
    window.verifyFireworkAuth = async () => true;
  });
  // 攔截真實遠端 API：stub token 對真實後端一定回 401，會觸發
  // auth-protected-tabs.js 的 fetchProtectedContentWithRetry 耗盡重試後
  // dispatch firework-force-logout，進而 clearAllModules() 把所有剛渲染
  // 的面板整個清空（.canned-panel 等 rect 全部消失）。回傳 200 + success:false
  // 讓呼叫端視為「無資料」正常結束，不觸發全域登出，也不必依賴真實後端。
  await page.route('**/api/order-tool-api', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: false }) })
  );
  await page.goto(URL_);
  await page.waitForFunction(() => document.documentElement.classList.contains('auth-active'), { timeout: 15000 });
  await page.waitForTimeout(2500); // allSettled + reveal stagger 完成
  const data = await page.evaluate((S) => {
    const out = { rects: {}, zorder: [] };
    for (const sel of S.rects) {
      const el = document.querySelector(sel);
      if (!el) { out.rects[sel] = null; continue; }
      const r = el.getBoundingClientRect();
      out.rects[sel] = { x: r.x, y: r.y, w: r.width, h: r.height };
    }
    const zs = S.zorder
      .map((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        return { sel, z: parseInt(getComputedStyle(el).zIndex, 10) || 0 };
      })
      .filter(Boolean)
      .sort((p, q) => q.z - p.z)
      .map((e) => e.sel);
    out.zorder = zs;
    return out;
  }, SELECTORS);
  writeFileSync(outfile, JSON.stringify(data, null, 2));
  await browser.close();
  console.log(`captured -> ${outfile}`);
}

function compare(basefile, curfile) {
  const base = JSON.parse(readFileSync(basefile, 'utf8'));
  const cur = JSON.parse(readFileSync(curfile, 'utf8'));
  let fail = 0;
  for (const [sel, br] of Object.entries(base.rects)) {
    const cr = cur.rects[sel];
    if (JSON.stringify(br) !== JSON.stringify(cr)) {
      console.error(`RECT DIFF ${sel}: base=${JSON.stringify(br)} cur=${JSON.stringify(cr)}`);
      fail++;
    }
  }
  if (JSON.stringify(base.zorder) !== JSON.stringify(cur.zorder)) {
    console.error(`ZORDER DIFF:\n  base=${base.zorder.join(' > ')}\n  cur =${cur.zorder.join(' > ')}`);
    fail++;
  }
  if (fail) { console.error(`FAIL: ${fail} diffs`); process.exit(1); }
  console.log('PARITY OK');
}

if (cmd === 'capture') await capture(a);
else if (cmd === 'compare') compare(a, b);
else { console.error('usage: capture <out> | compare <base> <cur>'); process.exit(2); }
