// 效能衛生靜態回歸（第十期低階機流暢化，spec §5）。免瀏覽器；node tools/perf-hygiene-test.mjs
// 三條規則把設計慣例升級為約束，使違規「寫不出來」而非靠紀律：
//   R1 blur 字面值禁令——blur(Npx) 只准出現在 tokens.css（檔位權威）；其餘 CSS 與
//      JS 注入樣式一律引用 var(--glass-blur*)。@supports 能力偵測探針 blur(1px) 豁免。
//   R2 infinite 動畫白名單——animation … infinite 的宣告必須位於「可見狀態」選擇器
//      白名單下（.active 後代、.is-visible、display 切換父層族群），或於同一宣告塊
//      內帶 animation-play-state: paused（paused 動畫不逐幀運算，由狀態 class 切
//      running——ui-conductor 過場動畫採此式以免淡出首幀跳回初始姿態），防「隱藏仍空轉」。
//   R3 裸 setInterval 禁令——script/ 下週期工作一律走 canvas-engine 的 engineSchedule
//      （分頁隱藏跳過／登出兜底全清），僅排程器實作檔可出現 setInterval。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const fails = [];
const A = (c, m) => { if (!c) { fails.push(m); console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

function walk(dir, ext) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (name !== 'node_modules') out.push(...walk(p, ext)); }
    else if (name.endsWith(ext)) out.push(p);
  }
  return out;
}
const rel = (p) => relative(ROOT, p);
const cssFiles = walk(join(ROOT, 'style/v2'), '.css');
const jsFiles = walk(join(ROOT, 'script'), '.js');

// ===== R1：blur 字面值只准在 tokens.css =====
console.log('— R1 blur 字面值禁令（權威=style/v2/tokens.css）—');
{
  const offenders = [];
  for (const f of [...cssFiles, ...jsFiles]) {
    if (rel(f) === 'style/v2/tokens.css') continue;
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!/(^|[^-\w])blur\(\s*\d/.test(line)) return;
      if (/@supports/.test(line)) return; // 能力偵測探針 blur(1px) 豁免
      offenders.push(`${rel(f)}:${i + 1}`);
    });
  }
  A(offenders.length === 0, offenders.length === 0
    ? 'style/v2（tokens.css 除外）與 script/ 無任何裸 blur(Npx)'
    : `裸 blur(Npx) 出現於：${offenders.join('、')}`);
}

// ===== R2：infinite 動畫必須位於可見狀態選擇器白名單下 =====
console.log('— R2 infinite 動畫白名單（防隱藏空轉）—');
{
  // 白名單語意（詳 CANVAS.md 第十期記錄）：
  //   #ui-transition-overlay.active —— 過場 overlay 動畫一律綁 .active 狀態
  //   .ip-search-spinner.is-visible —— visibility 佔位 spinner 綁 .is-visible
  //   .gl-capsule__spinner／.meeting-loading-spinner —— display:none 切換的暫態載入指示
  //   .conflict-warning-icon —— 父層 #settings-button 以 display:none 切換
  //   .gl-chip-- —— 可見結果列的裝飾流動字（reduced-motion 另有停用分支）
  //   .meetingsearch-進行中 —— 分頁區塊 display 切換（panels.css .meeting-menu-content-section）
  const WHITELIST = [
    '#ui-transition-overlay.active',
    '.ip-search-spinner.is-visible',
    '.gl-capsule__spinner',
    '.meeting-loading-spinner',
    '.conflict-warning-icon',
    '.gl-chip--',
    '.meetingsearch-進行中',
  ];
  const offenders = [];
  for (const f of [...cssFiles, ...jsFiles]) {
    const text = readFileSync(f, 'utf8');
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(text))) {
      const [, selector, body] = m;
      if (!/animation[^;]*\binfinite\b/s.test(body)) continue;
      if (/animation-play-state\s*:\s*paused/.test(body)) continue; // paused-by-default 豁免
      const sel = selector.replace(/\s+/g, ' ').trim().split('\n').pop();
      if (WHITELIST.some((w) => sel.includes(w))) continue;
      const line = text.slice(0, m.index).split('\n').length;
      offenders.push(`${rel(f)}:${line}（${sel.slice(-60)}）`);
    }
  }
  A(offenders.length === 0, offenders.length === 0
    ? '所有 infinite 動畫皆位於可見狀態白名單選擇器下'
    : `白名單外的 infinite 動畫：${offenders.join('、')}`);
}

// ===== R3：裸 setInterval 禁令（僅排程器實作檔可出現）=====
console.log('— R3 裸 setInterval 禁令（週期工作一律 engineSchedule）—');
{
  const ALLOWED = new Set(['script/canvas-engine.js']); // engineSchedule 實作本體
  const offenders = [];
  for (const f of jsFiles) {
    if (ALLOWED.has(rel(f))) continue;
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/\bsetInterval\s*\(/.test(line)) offenders.push(`${rel(f)}:${i + 1}`);
    });
  }
  A(offenders.length === 0, offenders.length === 0
    ? 'script/ 無裸 setInterval（canvas-engine.js 排程器實作除外）'
    : `裸 setInterval 出現於：${offenders.join('、')}`);
}

console.log(fails.length ? `\n${fails.length} 項違規` : '\n全數通過');
process.exit(fails.length ? 1 : 0);
