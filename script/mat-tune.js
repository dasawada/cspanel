// 材質調校面板（第五期，dev-only）。
//
// 啟用方式：網址帶 ?tune=1（例 panel_all.html?tune=1）。未帶參數時本模組完全
// no-op——不注入樣式、不套用調校（即使 localStorage 有存檔），同事零影響。
//
// 設計原則（brainstorm 定案）：
//   1. 給「檔位」不給裸滑桿——每檔是一套設計好的參數比例（避免逐參數過鹹）。
//   2. 即時生效：檔位寫入 :root 的 --mat-* 自訂屬性（見 style/v2/materiality.css），
//      吃現有 stack-manager 的 is-stack-top / gl-dragging 鉤子。
//   3. 「輸出 spec」產生 JSON 交給實作者，把選中的數值烘成正式預設後本面板退役。
//
// 調校狀態存 localStorage['cspanel.mat-tune.v1']（只在 ?tune=1 時讀寫與套用）。

import { makeDraggable } from './draggable.js';

const STORE_KEY = 'cspanel.mat-tune.v1';
const GLASS_INSET = '0 0 0 1px rgba(255,255,255,0.55) inset';

// ===== 檔位定義（成套參數，比例是設計決策） =====
const AXES = {
  elevation: {
    label: '高度可讀',
    note: '最上層的影子景深＋其餘面板微退',
    steps: {
      off:     { label: '無',   shadow: 'var(--glass-shadow)', recede: '1' },
      subtle:  { label: '含蓄', shadow: `0 10px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05), ${GLASS_INSET}`, recede: '0.97' },
      clear:   { label: '清晰', shadow: `0 18px 48px rgba(0,0,0,0.14), 0 3px 10px rgba(0,0,0,0.06), ${GLASS_INSET}`, recede: '0.93' },
      theater: { label: '劇場', shadow: `0 28px 72px rgba(0,0,0,0.20), 0 5px 14px rgba(0,0,0,0.08), ${GLASS_INSET}`, recede: '0.88' },
    },
  },
  motion: {
    label: '運動文法',
    note: '置頂／退後的過渡節奏',
    steps: {
      off:      { label: '無',   ms: 0 },
      crisp:    { label: '俐落', ms: 140, ease: 'cubic-bezier(0.22, 1, 0.36, 1)', easeName: 'ease-out-quint' },
      standard: { label: '標準', ms: 200, ease: 'cubic-bezier(0.22, 1, 0.36, 1)', easeName: 'ease-out-quint' },
      graceful: { label: '從容', ms: 260, ease: 'cubic-bezier(0.16, 1, 0.3, 1)',  easeName: 'ease-out-expo' },
    },
  },
  focus: {
    label: '聚焦表現',
    note: '最上層的 chrome 處理',
    steps: {
      // outline 模型（不參與 box-shadow 組合，可獨立於高度軸開關）
      off:    { label: '無',       outline: 'none', offset: '0px' },
      bright: { label: '邊框微亮', outline: '1px solid rgba(255,255,255,0.9)', offset: '-1px' },
      accent: { label: '重點外圈', outline: '2px solid var(--accent-ring)', offset: '0px' },
    },
  },
  lift: {
    label: '拖曳浮起',
    note: '抓起面板／視窗時的影子加深',
    steps: {
      off:    { label: '無',   shadow: 'var(--glass-shadow)' },
      subtle: { label: '微浮', shadow: `0 16px 44px rgba(0,0,0,0.16), ${GLASS_INSET}` },
      marked: { label: '明顯', shadow: `0 26px 64px rgba(0,0,0,0.22), ${GLASS_INSET}` },
    },
  },
};

const PRESETS = {
  quiet:    { label: '靜',   state: { elevation: 'subtle', motion: 'crisp',    focus: 'off',    lift: 'subtle' } },
  standard: { label: '標準', state: { elevation: 'clear',  motion: 'standard', focus: 'bright', lift: 'subtle' } },
  theater:  { label: '劇場', state: { elevation: 'theater', motion: 'graceful', focus: 'accent', lift: 'marked' } },
};

const DEFAULT_STATE = { elevation: 'off', motion: 'off', focus: 'off', lift: 'off' };

let state = { ...DEFAULT_STATE };

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    if (raw && typeof raw === 'object') {
      for (const axis of Object.keys(DEFAULT_STATE)) {
        // hasOwnProperty：擋掉原型鏈鍵（'constructor' 等）騙過真值檢查、
        // 把 undefined 寫進 --mat-* 的路徑（審查 #11）
        if (typeof raw[axis] === 'string' && Object.prototype.hasOwnProperty.call(AXES[axis].steps, raw[axis])) {
          state[axis] = raw[axis];
        }
      }
    }
  } catch (e) { /* 壞存檔回預設 */ }
}
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* noop */ }
}

// ===== 套用：state → :root 的 --mat-* ＋ html[data-mat-*] 屬性閘門 =====
// 每軸的 CSS 規則都以 html[data-mat-<axis>] 閘門（materiality.css）：off = 移除
// 屬性 = 零規則命中，預設/關閉時對既有樣式零干擾（審查 #1/#2/#8 的修法）。
function apply() {
  const root = document.documentElement;
  const el = AXES.elevation.steps[state.elevation];
  const mo = AXES.motion.steps[state.motion];
  const fo = AXES.focus.steps[state.focus];
  const li = AXES.lift.steps[state.lift];
  const gate = (name, on) => { if (on) root.setAttribute(name, '1'); else root.removeAttribute(name); };

  root.style.setProperty('--mat-shadow-top', el.shadow);
  root.style.setProperty('--mat-recede-opacity', el.recede);
  gate('data-mat-elevation', state.elevation !== 'off');

  root.style.setProperty('--mat-focus-outline', fo.outline);
  root.style.setProperty('--mat-focus-outline-offset', fo.offset);
  gate('data-mat-focus', state.focus !== 'off');

  root.style.setProperty('--mat-lift-shadow', li.shadow);
  gate('data-mat-lift', state.lift !== 'off');

  if (mo.ms > 0) {
    root.style.setProperty('--mat-motion-ms', mo.ms + 'ms');
    root.style.setProperty('--mat-motion-ease', mo.ease);
  }
  gate('data-mat-motion', mo.ms > 0);
}

// ===== spec 輸出 =====
function buildSpec() {
  const mo = AXES.motion.steps[state.motion];
  return {
    'materiality-spec': 'v1',
    date: new Date().toISOString().slice(0, 10),
    elevation: state.elevation,
    motion: state.motion === 'off'
      ? { preset: 'off' }
      : { preset: state.motion, ms: mo.ms, easing: mo.easeName, easingCss: mo.ease },
    focus: state.focus,
    lift: state.lift,
    resolved: { // 給實作者烘焙用的完整實際值（免再查表；含 apply() 寫入的每一項，審查 #12）
      '--mat-shadow-top': AXES.elevation.steps[state.elevation].shadow,
      '--mat-recede-opacity': AXES.elevation.steps[state.elevation].recede,
      '--mat-focus-outline': AXES.focus.steps[state.focus].outline,
      '--mat-focus-outline-offset': AXES.focus.steps[state.focus].offset,
      '--mat-lift-shadow': AXES.lift.steps[state.lift].shadow,
      '--mat-motion-ms': state.motion === 'off' ? null : mo.ms + 'ms',
      '--mat-motion-ease': state.motion === 'off' ? null : mo.ease,
      gates: {
        'data-mat-elevation': state.elevation !== 'off',
        'data-mat-focus': state.focus !== 'off',
        'data-mat-lift': state.lift !== 'off',
        'data-mat-motion': state.motion !== 'off',
      },
    },
  };
}

// ===== UI =====
function buildPanel() {
  const panel = document.createElement('aside');
  panel.id = 'mat-tune-panel';
  panel.setAttribute('aria-label', '材質調校');

  const head = document.createElement('div');
  head.className = 'mt-head';
  head.innerHTML = `<span class="mt-title">材質調校</span><span class="mt-sub">?tune 模式 · 只有你看得到</span>`;
  panel.appendChild(head);

  // 總預設列
  const presetRow = document.createElement('div');
  presetRow.className = 'mt-presets';
  for (const [key, p] of Object.entries(PRESETS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mt-preset';
    b.dataset.preset = key;
    b.textContent = p.label;
    b.addEventListener('click', () => { state = { ...p.state }; apply(); saveState(); refresh(panel); });
    presetRow.appendChild(b);
  }
  panel.appendChild(presetRow);

  // 四軸
  for (const [axisKey, axis] of Object.entries(AXES)) {
    const sec = document.createElement('div');
    sec.className = 'mt-axis';
    const lab = document.createElement('div');
    lab.className = 'mt-axis-label';
    lab.innerHTML = `${axis.label}<small>${axis.note}</small>`;
    sec.appendChild(lab);
    const seg = document.createElement('div');
    seg.className = 'mt-seg';
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-label', axis.label);
    for (const [stepKey, step] of Object.entries(axis.steps)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mt-step';
      b.dataset.axis = axisKey;
      b.dataset.step = stepKey;
      b.setAttribute('role', 'radio');
      b.textContent = step.label;
      b.addEventListener('click', () => { state[axisKey] = stepKey; apply(); saveState(); refresh(panel); });
      seg.appendChild(b);
    }
    sec.appendChild(seg);
    panel.appendChild(sec);
  }

  // spec 輸出
  const out = document.createElement('div');
  out.className = 'mt-out';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mt-export';
  btn.textContent = '輸出 spec';
  const ta = document.createElement('textarea');
  ta.className = 'mt-json';
  ta.readOnly = true;
  ta.rows = 6;
  ta.placeholder = '調到「就是這個」之後按上面的鈕，把 JSON 貼給實作者。';
  btn.addEventListener('click', async () => {
    const json = JSON.stringify(buildSpec(), null, 2);
    ta.value = json;
    try { await navigator.clipboard.writeText(json); btn.textContent = '已複製 ✓'; }
    catch (e) { btn.textContent = '已產生（手動複製）'; }
    setTimeout(() => { btn.textContent = '輸出 spec'; }, 1600);
  });
  out.append(btn, ta);
  panel.appendChild(out);

  return panel;
}

function refresh(panel) {
  panel.querySelectorAll('.mt-step').forEach((b) => {
    const on = state[b.dataset.axis] === b.dataset.step;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  panel.querySelectorAll('.mt-preset').forEach((b) => {
    const p = PRESETS[b.dataset.preset].state;
    b.classList.toggle('is-on', Object.keys(p).every((k) => state[k] === p[k]));
  });
}

function init() {
  // 樣式只在啟用時載入（未啟用時零成本）
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'style/v2/mat-tune.css';
  document.head.appendChild(link);

  loadState();
  apply();

  const mount = () => {
    const panel = buildPanel();
    document.body.appendChild(panel);
    // 初始靠右上；把手可拖（persist:false——位置不入 draggable 存檔）
    panel.style.left = Math.max(20, window.innerWidth - 300) + 'px';
    panel.style.top = '110px';
    makeDraggable(panel, panel.querySelector('.mt-head'), { persist: false, disableBoundary: true });
    refresh(panel);
  };
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
}

if (new URLSearchParams(location.search).has('tune')) init();
