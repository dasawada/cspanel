/*
 * whiteboard.js — 客服截圖標註白板
 * ------------------------------------------------------------------
 * 零依賴：沒有任何函式庫、外部圖片或外部 CSS。
 *
 * 單向資料流：
 *   操作 → 純函式算出新的 doc → commit() 存入歷史 → 畫面重畫
 *   畫面只是 doc 的投影。同一份 doc，永遠畫出同一張圖。
 *
 * 非同步只出現在三個「邊界」：
 *   1. 解碼圖片（貼上、拖曳、開檔）
 *   2. 寫入剪貼簿
 *   3. 下載檔案
 *   邊界的結果回來後，只透過一次同步 commit() 進入資料。
 *   復原、重做、移動、縮放、馬賽克，全部同步完成，彼此不互相等待。
 *
 * 對外 API（給客服系統整合用）：window.Whiteboard
 *   importImage(blob) → Promise<boolean>   匯入一張圖片
 *   toBlob()          → Promise<Blob|null> 取得目前成品 PNG
 *   getDoc()          → 目前文件資料（唯讀快照）
 *   clear() / undo() / redo() / setTool(name)
 */
(() => {
  'use strict';

  // ═══════════════════════ 0. 常數與小工具 ═══════════════════════

  const $ = (sel) => document.querySelector(sel);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const round1 = (v) => Math.round(v * 10) / 10;
  const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.userAgentData?.platform || navigator.platform || '');
  const MOD = IS_MAC ? '⌘' : 'Ctrl';
  const FONT = '"PingFang TC","Noto Sans TC","Microsoft JhengHei",system-ui,-apple-system,"Segoe UI",sans-serif';
  const SEL_COLOR = '#3B5BFF';   // 選取框顏色，固定不跟主題變
  const HANDLE = 8;              // 控制點大小（螢幕像素）
  const HISTORY_LIMIT = 200;
  const MAX_SIDE = 8192;         // 畫布單邊上限，避免超大圖吃光記憶體
  const MAX_LIVE_IMAGES = 8;     // 歷史紀錄裡最多保留幾張不同的截圖
  const STORE_KEY = 'cs-whiteboard:v2';

  let seq = 0;
  const uid = (prefix = 's') => prefix + (++seq).toString(36);

  const PALETTE = [
    ['#E5372B', '紅'], ['#F28C18', '橘'], ['#FFD21F', '黃'], ['#1EA75A', '綠'],
    ['#2B7BF2', '藍'], ['#9B4DEB', '紫'], ['#1E1E1E', '黑'], ['#FFFFFF', '白'],
  ];

  // 工具 → 快捷鍵
  const TOOLS = {
    select: 'v', rect: 'r', ellipse: 'o', arrow: 'a', pen: 'p',
    highlight: 'h', mosaic: 'm', text: 't', step: 'n', crop: 'c',
  };
  const KEY_TO_TOOL = Object.fromEntries(Object.entries(TOOLS).map(([tool, key]) => [key, tool]));

  const HINTS = {
    select: '點選物件可以拖曳移動；在空白處拖曳可以框選。按住 Shift 可以加選。',
    rect: '拖曳畫出方框。按住 Shift 畫正方形。',
    ellipse: '拖曳畫出圓圈。按住 Shift 畫正圓。',
    arrow: '從起點拖到要指的地方。按住 Shift 可以鎖定角度。',
    pen: '按住拖曳，自由畫線。',
    highlight: '框出要強調的文字。底下的字還是看得清楚。',
    mosaic: '框出要遮住的個資。選「粗」最不容易被還原。',
    text: '點一下就能打字。點已有的文字可以修改。',
    step: '依序點擊，會自動編上 1、2、3。',
    crop: '框出要保留的範圍，放開就會裁切。',
  };

  const TYPE_NAME = {
    image: '圖片', rect: '框線', ellipse: '圓圈', arrow: '箭頭', pen: '畫筆',
    highlight: '螢光筆', mosaic: '馬賽克', text: '文字', step: '編號',
  };
  const BOX_TYPES = new Set(['image', 'rect', 'ellipse', 'highlight', 'mosaic']);
  const HAS_COLOR = new Set(['rect', 'ellipse', 'arrow', 'pen', 'highlight', 'text', 'step']);
  const SIZE_KIND = { rect: 'stroke', ellipse: 'stroke', arrow: 'stroke', pen: 'stroke', text: 'text', step: 'step', mosaic: 'mosaic' };
  const SIZE_PROP = { stroke: 'width', text: 'size', step: 'r', mosaic: 'block' };
  const SIZE_TABLE = { stroke: [2, 4, 7], text: [16, 22, 32], step: [11, 15, 21], mosaic: [7, 13, 22] };

  /** 細／中／粗 換算成文件像素。大截圖自動放大，避免 4K 圖上的線細到看不見。 */
  const docUnit = (doc) => Math.max(1, Math.pow(Math.max(doc.w, doc.h) / 1280, 0.75));
  const sizeValue = (kind, idx, doc) => Math.round(SIZE_TABLE[kind][idx] * docUnit(doc) * 2) / 2;
  function sizeIndexOf(it, doc) {
    const kind = SIZE_KIND[it.type];
    if (!kind) return -1;
    const v = it[SIZE_PROP[kind]];
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < 3; i++) {
      const d = Math.abs(sizeValue(kind, i, doc) - v);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  // 每個工具記住自己的顏色和粗細（例如箭頭用紅、螢光筆用黃）
  const toolStyle = {
    rect: { color: '#E5372B', size: 1 },
    ellipse: { color: '#E5372B', size: 1 },
    arrow: { color: '#E5372B', size: 1 },
    pen: { color: '#E5372B', size: 1 },
    highlight: { color: '#FFD21F' },
    mosaic: { size: 1 },
    text: { color: '#E5372B', size: 1, bg: false },
    step: { color: '#E5372B', size: 1 },
  };

  function luminance(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 0;
    const n = parseInt(m[1], 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  }
  const inkOn = (bg) => (luminance(bg) > 0.62 ? '#1D232B' : '#FFFFFF');
  const haloFor = (color) => (luminance(color) > 0.62 ? 'rgba(20,24,30,.9)' : '#FFFFFF');

  const normRect = (x1, y1, x2, y2) => ({
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
  });
  const rectsOverlap = (a, b) => a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
  const inRect = (p, r, pad = 0) =>
    p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;

  function distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  /** 按住 Shift 時，把角度吸附到 15° 的倍數 */
  function snapAngle(ax, ay, bx, by) {
    const len = Math.hypot(bx - ax, by - ay);
    const step = Math.PI / 12;
    const ang = Math.round(Math.atan2(by - ay, bx - ax) / step) * step;
    return { x: ax + Math.cos(ang) * len, y: ay + Math.sin(ang) * len };
  }

  function pathRoundRect(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // ═══════════════════════ 1. 狀態 ═══════════════════════

  const els = {
    viewport: $('#viewport'), view: $('#view'), editor: $('#editor'),
    empty: $('#empty'), drop: $('#drop'),
    toolButtons: [...document.querySelectorAll('[data-tool]')],
    undo: $('#undo'), redo: $('#redo'), open: $('#open'), clear: $('#clear'),
    download: $('#download'), copy: $('#copy'), copyLabel: $('#copy .lbl'),
    swatches: $('#swatches'), customColor: $('#customColor'), colorInput: $('#colorInput'),
    sizeSeg: $('#sizeSeg'), textBg: $('#textBg'), propsNote: $('#propsNote'),
    layersToggle: $('#layersToggle'), helpBtn: $('#helpBtn'), help: $('#help'),
    layers: $('#layers'), layerList: $('#layerList'), layerCount: $('#layerCount'), layersEmpty: $('#layersEmpty'),
    hint: $('#hint'), docSize: $('#docSize'), zoomGroup: $('#zoomGroup'),
    zoomIn: $('#zoomIn'), zoomOut: $('#zoomOut'), zoomLabel: $('#zoomLabel'),
    menu: $('#ctxmenu'), toast: $('#toast'), fileInput: $('#fileInput'),
    emptyOpen: $('#emptyOpen'), emptyBlank: $('#emptyBlank'),
  };

  // doc 是「不可變」的：每次修改都產生新物件，沒變的物件直接共用。
  // 所以歷史紀錄只是一串 doc 參照，復原／重做是 O(1) 的同步操作。
  const EMPTY_DOC = Object.freeze({ w: 0, h: 0, bg: '#ffffff', items: Object.freeze([]) });

  const state = {
    doc: EMPTY_DOC,
    tool: 'arrow',
    prevTool: 'arrow',
    selection: new Set(),
    hoverId: null,
    hoverHandle: null,
    view: { zoom: 1, x: 0, y: 0, fitted: true },
    editing: null,       // 文字編輯中：{ item, isNew }
    spaceDown: false,
    exportedDoc: null,   // 最後一次複製或下載的 doc
  };
  const assets = new Map();  // 圖片解碼結果。doc 只存 id，歷史紀錄因此很輕。
  const history = { past: [], future: [], lastKey: null, lastTime: 0 };

  let gesture = null;        // 進行中的拖曳手勢
  let docDirty = true;
  let frame = 0;

  const isEmpty = () => state.doc.w === 0;

  const indexCache = new WeakMap();
  function byId(doc = state.doc) {
    let map = indexCache.get(doc);
    if (!map) {
      map = new Map(doc.items.map((it) => [it.id, it]));
      indexCache.set(doc, map);
    }
    return map;
  }
  const getItem = (id) => byId().get(id);

  function singleSelected() {
    if (state.selection.size !== 1) return null;
    const [id] = state.selection;
    return getItem(id) || null;
  }
  const movableIds = (sel) => new Set([...sel].filter((id) => {
    const it = getItem(id);
    return it && !it.locked;
  }));

  function setSelection(sel) {
    const cur = state.selection;
    if (sel.size === cur.size && [...sel].every((id) => cur.has(id))) return;
    state.selection = sel;
    invalidate();
  }

  // ═══════════════════════ 2. 歷史紀錄（全部同步） ═══════════════════════

  /** 套用新 doc，但不寫入歷史。拖曳中的即時預覽用這個。 */
  function setDoc(next) {
    if (next === state.doc) return;
    const prev = state.doc;
    state.doc = next;
    docDirty = true;
    const map = byId(next);
    if ([...state.selection].some((id) => !map.has(id))) {
      state.selection = new Set([...state.selection].filter((id) => map.has(id)));
    }
    if (state.hoverId && !map.has(state.hoverId)) state.hoverId = null;
    // 從空白變成有圖，或尺寸變了而畫面原本是「符合視窗」：重新置中
    if ((prev.w !== next.w || prev.h !== next.h) && !gesture && (prev.w === 0 || state.view.fitted)) fitView();
    invalidate();
  }

  function pushPast(doc) {
    history.past.push(doc);
    if (history.past.length > HISTORY_LIMIT) history.past.shift();
  }

  /** 寫入一筆歷史。mergeKey 相同且間隔很短時合併成一筆（例如連按方向鍵、拖曳調色盤）。 */
  function commit(next, mergeKey = null) {
    if (next === state.doc) return;
    const now = performance.now();
    const merge = mergeKey !== null && mergeKey === history.lastKey && now - history.lastTime < 1000;
    if (!merge) pushPast(state.doc);
    history.future.length = 0;
    history.lastKey = mergeKey;
    history.lastTime = now;
    setDoc(next);
  }

  /** 手勢結束時呼叫：把手勢開始前的 doc 存成一筆歷史（拖曳過程不會塞滿歷史） */
  function commitFrom(base) {
    if (base === state.doc) return;
    pushPast(base);
    history.future.length = 0;
    history.lastKey = null;
    invalidate();
  }

  function undo() {
    finishTextEdit();
    cancelGesture();
    if (!history.past.length) return;
    history.future.push(state.doc);
    history.lastKey = null;
    setDoc(history.past.pop());
  }

  function redo() {
    finishTextEdit();
    cancelGesture();
    if (!history.future.length) return;
    history.past.push(state.doc);
    history.lastKey = null;
    setDoc(history.future.pop());
  }

  /** 歷史裡的截圖太多時，丟掉最舊的紀錄並釋放圖片記憶體 */
  function trimHistory() {
    const live = () => {
      const ids = new Set();
      for (const doc of [...history.past, state.doc, ...history.future]) {
        for (const it of doc.items) if (it.type === 'image') ids.add(it.asset);
      }
      return ids;
    };
    let ids = live();
    while (ids.size > MAX_LIVE_IMAGES && history.past.length) {
      history.past.shift();
      ids = live();
    }
    for (const [id, img] of assets) {
      if (!ids.has(id)) {
        if (typeof img.close === 'function') img.close();
        assets.delete(id);
      }
    }
  }

  // ═══════════════════════ 3. 文件操作（純函式：舊 doc → 新 doc） ═══════════════════════

  const withItems = (doc, items) => ({ ...doc, items });
  const addItems = (doc, ...items) => withItems(doc, [...doc.items, ...items]);
  const removeItems = (doc, ids) => withItems(doc, doc.items.filter((it) => !ids.has(it.id)));
  const mapItems = (doc, ids, fn) => withItems(doc, doc.items.map((it) => (ids.has(it.id) ? fn(it) : it)));

  function moveItem(it, dx, dy) {
    if (it.type === 'arrow') return { ...it, x1: it.x1 + dx, y1: it.y1 + dy, x2: it.x2 + dx, y2: it.y2 + dy };
    if (it.type === 'pen') return { ...it, pts: it.pts.map((v, i) => v + (i & 1 ? dy : dx)) };
    return { ...it, x: it.x + dx, y: it.y + dy };
  }

  /** 把點限制在畫布內（m＝離邊緣的最小距離），避免新物件放到看不見的地方 */
  const clampToDoc = (p, m = 0) => ({
    x: round1(clamp(p.x, m, Math.max(m, state.doc.w - m))),
    y: round1(clamp(p.y, m, Math.max(m, state.doc.h - m))),
  });

  const nextStepNo = (doc) => doc.items.reduce((n, it) => (it.type === 'step' ? Math.max(n, it.n) : n), 0) + 1;

  /** 新截圖當成整張畫布（底圖預設鎖定，框選時不會誤拖） */
  function freshDoc(assetId) {
    const img = assets.get(assetId);
    const s = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * s));
    const h = Math.max(1, Math.round(img.height * s));
    return { w, h, bg: '#ffffff', items: [{ id: uid(), type: 'image', asset: assetId, x: 0, y: 0, w, h, locked: true }] };
  }

  /** 新截圖疊在目前畫面中央；比畫布大就等比縮小 */
  function withImage(doc, assetId) {
    const img = assets.get(assetId);
    const s = Math.min(1, (doc.w * 0.9) / img.width, (doc.h * 0.9) / img.height);
    const w = Math.max(1, Math.round(img.width * s));
    const h = Math.max(1, Math.round(img.height * s));
    const c = toDoc(els.viewport.clientWidth / 2, els.viewport.clientHeight / 2);
    const x = clamp(Math.round(c.x - w / 2), 0, Math.max(0, doc.w - w));
    const y = clamp(Math.round(c.y - h / 2), 0, Math.max(0, doc.h - h));
    return addItems(doc, { id: uid(), type: 'image', asset: assetId, x, y, w, h });
  }

  // ═══════════════════════ 4. 幾何、排版與命中測試 ═══════════════════════

  const measureCtx = document.createElement('canvas').getContext('2d');
  const layoutCache = new WeakMap();   // 物件不可變，所以可以安心用物件本身當快取鍵
  const boundsCache = new WeakMap();

  function textLayout(it) {
    let L = layoutCache.get(it);
    if (L) return L;
    const font = `600 ${it.size}px ${FONT}`;
    measureCtx.font = font;
    const lines = (it.text || ' ').split('\n');
    const lh = it.size * 1.3;
    let tw = 0;
    for (const ln of lines) tw = Math.max(tw, measureCtx.measureText(ln).width);
    const pad = it.bg ? it.size * 0.45 : it.size * 0.2;
    L = { font, lines, lh, pad, w: Math.ceil(tw + pad * 2), h: Math.ceil(lines.length * lh + pad * 2) };
    layoutCache.set(it, L);
    return L;
  }

  function arrowGeom(it) {
    const dx = it.x2 - it.x1;
    const dy = it.y2 - it.y1;
    const len = Math.hypot(dx, dy) || 0.0001;
    const ux = dx / len;
    const uy = dy / len;
    const s = it.width / 2;
    const headLen = Math.min(it.width * 4.2 + 6, len * 0.6);
    const headHalf = Math.max(s * 2.3, headLen * 0.5);
    return { len, ux, uy, nx: -uy, ny: ux, s, headLen, headHalf, bx: it.x2 - ux * headLen, by: it.y2 - uy * headLen };
  }

  function bounds(it) {
    let b = boundsCache.get(it);
    if (b) return b;
    switch (it.type) {
      case 'arrow': {
        const p = arrowGeom(it).headHalf;
        b = {
          x: Math.min(it.x1, it.x2) - p, y: Math.min(it.y1, it.y2) - p,
          w: Math.abs(it.x2 - it.x1) + p * 2, h: Math.abs(it.y2 - it.y1) + p * 2,
        };
        break;
      }
      case 'pen': {
        let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
        for (let i = 0; i < it.pts.length; i += 2) {
          x0 = Math.min(x0, it.pts[i]); x1 = Math.max(x1, it.pts[i]);
          y0 = Math.min(y0, it.pts[i + 1]); y1 = Math.max(y1, it.pts[i + 1]);
        }
        const p = it.width / 2;
        b = { x: x0 - p, y: y0 - p, w: x1 - x0 + p * 2, h: y1 - y0 + p * 2 };
        break;
      }
      case 'text': {
        const L = textLayout(it);
        b = { x: it.x, y: it.y, w: L.w, h: L.h };
        break;
      }
      case 'step':
        b = { x: it.x - it.r, y: it.y - it.r, w: it.r * 2, h: it.r * 2 };
        break;
      case 'rect':
      case 'ellipse': {
        const p = it.width / 2;
        b = { x: it.x - p, y: it.y - p, w: it.w + p * 2, h: it.h + p * 2 };
        break;
      }
      default:
        b = { x: it.x, y: it.y, w: it.w, h: it.h };
    }
    boundsCache.set(it, b);
    return b;
  }

  /** 精準命中：點在線條上、色塊內或文字框內 */
  function hitStrict(it, p, tol) {
    switch (it.type) {
      case 'rect': {
        const o = it.width / 2 + tol;
        if (!inRect(p, it, o)) return false;
        if (it.w <= o * 2 || it.h <= o * 2) return true;
        return !(p.x > it.x + o && p.x < it.x + it.w - o && p.y > it.y + o && p.y < it.y + it.h - o);
      }
      case 'ellipse': {
        const rx = it.w / 2;
        const ry = it.h / 2;
        if (rx < 1 || ry < 1) return inRect(p, it, it.width / 2 + tol);
        const d = Math.hypot((p.x - it.x - rx) / rx, (p.y - it.y - ry) / ry);
        return Math.abs(d - 1) * Math.min(rx, ry) <= it.width / 2 + tol;
      }
      case 'arrow': {
        const g = arrowGeom(it);
        if (distToSeg(p.x, p.y, it.x1, it.y1, it.x2, it.y2) <= Math.max(g.s, 2) + tol) return true;
        return distToSeg(p.x, p.y, g.bx, g.by, it.x2, it.y2) <= g.headHalf * 0.7 + tol;
      }
      case 'pen': {
        const q = it.pts;
        const r = it.width / 2 + tol;
        if (q.length === 2) return Math.hypot(p.x - q[0], p.y - q[1]) <= r;
        for (let i = 2; i < q.length; i += 2) {
          if (distToSeg(p.x, p.y, q[i - 2], q[i - 1], q[i], q[i + 1]) <= r) return true;
        }
        return false;
      }
      case 'step':
        return Math.hypot(p.x - it.x, p.y - it.y) <= it.r + tol;
      case 'text':
        return inRect(p, bounds(it), tol);
      default:
        return inRect(p, it, tol);   // 圖片、螢光筆、馬賽克
    }
  }

  function insideOutline(it, p) {
    if (it.type === 'rect') return inRect(p, it);
    if (it.type !== 'ellipse' || it.w < 2 || it.h < 2) return false;
    return Math.hypot((p.x - it.x - it.w / 2) / (it.w / 2), (p.y - it.y - it.h / 2) / (it.h / 2)) <= 1;
  }

  /**
   * 找出指標下最上層的物件。
   * deep：點在空心框／圓圈的「內部」也算選到（但會讓給壓在下面、被精準點到的線條）。
   */
  function pick(p, { images = true, locked = false, deep = false, types = null } = {}) {
    const tol = 6 / state.view.zoom;
    const items = state.doc.items;
    let inside = null;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.locked && !locked) continue;
      if (types && !types.includes(it.type)) continue;
      if (it.type === 'image' && !images) continue;
      if (hitStrict(it, p, tol)) return it.type === 'image' && inside ? inside : it;
      if (deep && !inside && insideOutline(it, p)) inside = it;
    }
    return inside;
  }

  /** 控制點：[名稱, x, y]（文件座標） */
  function handlesOf(it) {
    if (it.locked) return [];
    if (BOX_TYPES.has(it.type)) {
      const { x, y, w, h } = it;
      const corners = [['nw', x, y], ['ne', x + w, y], ['se', x + w, y + h], ['sw', x, y + h]];
      if (it.type === 'image') return corners;   // 圖片只給四角，預設等比例
      return [...corners, ['n', x + w / 2, y], ['e', x + w, y + h / 2], ['s', x + w / 2, y + h], ['w', x, y + h / 2]];
    }
    if (it.type === 'arrow') return [['p1', it.x1, it.y1], ['p2', it.x2, it.y2]];
    if (it.type === 'text') {
      const b = bounds(it);
      return [['se', b.x + b.w, b.y + b.h]];
    }
    if (it.type === 'step') return [['se', it.x + it.r, it.y + it.r]];
    return [];
  }

  function hitHandle(sx, sy) {
    const it = singleSelected();
    if (!it || (state.editing && state.editing.item.id === it.id)) return null;
    for (const [name, x, y] of handlesOf(it)) {
      const s = toScreen(x, y);
      if (Math.abs(s.x - sx) <= HANDLE && Math.abs(s.y - sy) <= HANDLE) return { it, name, x, y };
    }
    return null;
  }

  /** 由拖曳起點與目前位置產生新物件（每次都從起點重算，不會累積誤差） */
  function makeShape(g, p, shift) {
    const st = toolStyle[g.tool];
    const doc = g.startDoc;
    const a = g.start;
    if (g.tool === 'arrow') {
      const b = shift ? snapAngle(a.x, a.y, p.x, p.y) : p;
      return {
        id: g.id, type: 'arrow', x1: round1(a.x), y1: round1(a.y), x2: round1(b.x), y2: round1(b.y),
        color: st.color, width: sizeValue('stroke', st.size, doc),
      };
    }
    if (g.tool === 'pen') {
      return { id: g.id, type: 'pen', pts: g.pts, color: st.color, width: sizeValue('stroke', st.size, doc) };
    }
    let dx = p.x - a.x;
    let dy = p.y - a.y;
    if (shift) {
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      dx = dx < 0 ? -m : m;
      dy = dy < 0 ? -m : m;
    }
    const r = normRect(Math.round(a.x), Math.round(a.y), Math.round(a.x + dx), Math.round(a.y + dy));
    const it = { id: g.id, type: g.tool, ...r };
    if (g.tool === 'mosaic') it.block = sizeValue('mosaic', st.size, doc);
    else if (g.tool === 'highlight') it.color = st.color;
    else { it.color = st.color; it.width = sizeValue('stroke', st.size, doc); }
    return it;
  }

  /** 拖曳控制點：一律從原始物件 o 重算 */
  function resizeItem(o, handle, p, shift) {
    if (o.type === 'arrow') {
      const other = handle === 'p1' ? { x: o.x2, y: o.y2 } : { x: o.x1, y: o.y1 };
      const q = shift ? snapAngle(other.x, other.y, p.x, p.y) : p;
      return handle === 'p1' ? { ...o, x1: round1(q.x), y1: round1(q.y) } : { ...o, x2: round1(q.x), y2: round1(q.y) };
    }
    if (o.type === 'text') {
      const b = bounds(o);
      const s = Math.max((p.x - o.x) / b.w, (p.y - o.y) / b.h);
      return { ...o, size: clamp(Math.round(o.size * s * 2) / 2, 6, 600) };
    }
    if (o.type === 'step') {
      const r = Math.hypot(p.x - o.x, p.y - o.y) / Math.SQRT2;
      return { ...o, r: clamp(Math.round(r * 2) / 2, 4, 400) };
    }
    let x1 = o.x;
    let y1 = o.y;
    let x2 = o.x + o.w;
    let y2 = o.y + o.h;
    if (handle.includes('w')) x1 = p.x;
    if (handle.includes('e')) x2 = p.x;
    if (handle.includes('n')) y1 = p.y;
    if (handle.includes('s')) y2 = p.y;
    const keepRatio = o.type === 'image' ? !shift : shift;   // 圖片預設等比例，按 Shift 解除
    if (keepRatio && handle.length === 2 && o.w > 0 && o.h > 0) {
      const ax = handle.includes('w') ? o.x + o.w : o.x;     // 對角固定不動
      const ay = handle.includes('n') ? o.y + o.h : o.y;
      const s = Math.max(Math.abs(p.x - ax) / o.w, Math.abs(p.y - ay) / o.h);
      x1 = ax; y1 = ay;
      x2 = ax + (p.x < ax ? -1 : 1) * o.w * s;
      y2 = ay + (p.y < ay ? -1 : 1) * o.h * s;
    }
    const r = normRect(Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2));
    return { ...o, ...r, w: Math.max(1, r.w), h: Math.max(1, r.h) };
  }

  // ═══════════════════════ 5. 繪製：doc → 畫布（純同步） ═══════════════════════

  const mosaicSrc = document.createElement('canvas');
  const mosaicSrcCtx = mosaicSrc.getContext('2d');
  const mosaicCanvas = document.createElement('canvas');
  const mosaicCtx = mosaicCanvas.getContext('2d');

  /** 同一份 doc 永遠畫出同一張圖。畫面預覽和輸出圖檔共用這一個函式。 */
  function renderDoc(ctx, doc, skipId = null) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = doc.bg;
    ctx.fillRect(0, 0, doc.w, doc.h);
    for (const it of doc.items) {
      if (it.id === skipId) continue;
      ctx.save();
      drawItem(ctx, it, doc);
      ctx.restore();
    }
    ctx.restore();
  }

  function shadowOn(ctx, w) {
    ctx.shadowColor = 'rgba(0,0,0,.28)';
    ctx.shadowBlur = w * 0.9 + 2;
    ctx.shadowOffsetY = w * 0.25;
  }

  function drawItem(ctx, it, doc) {
    switch (it.type) {
      case 'image': {
        const img = assets.get(it.asset);
        if (img) {
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, it.x, it.y, it.w, it.h);
        }
        break;
      }
      case 'rect':
        shadowOn(ctx, it.width);
        ctx.strokeStyle = it.color;
        ctx.lineWidth = it.width;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        pathRoundRect(ctx, it.x, it.y, it.w, it.h, it.width * 0.9);
        ctx.stroke();
        break;
      case 'ellipse':
        shadowOn(ctx, it.width);
        ctx.strokeStyle = it.color;
        ctx.lineWidth = it.width;
        ctx.beginPath();
        ctx.ellipse(it.x + it.w / 2, it.y + it.h / 2, Math.max(it.w / 2, 0.5), Math.max(it.h / 2, 0.5), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'highlight':
        // 「色彩增值」：像真的螢光筆，底下的黑字仍然是黑的，不會被洗淡
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = it.color;
        ctx.beginPath();
        pathRoundRect(ctx, it.x, it.y, it.w, it.h, Math.min(it.w, it.h) * 0.12);
        ctx.fill();
        break;
      case 'mosaic': drawMosaic(ctx, it, doc); break;
      case 'arrow': drawArrow(ctx, it); break;
      case 'pen': drawPen(ctx, it); break;
      case 'text': drawText(ctx, it); break;
      case 'step': drawStep(ctx, it); break;
      default: break;
    }
  }

  /**
   * 馬賽克：把「它底下已經畫好的內容」縮小再放大。
   * 縮小時每一格自動取平均色，放大時關掉平滑變成硬邊色塊。
   * 全程在 GPU 上完成，不用 getImageData 逐點讀取。
   * 因為每次都從 doc 重畫，移動、縮放、復原馬賽克都不會出錯。
   */
  function drawMosaic(ctx, it, doc) {
    const x0 = clamp(Math.floor(it.x), 0, doc.w);
    const y0 = clamp(Math.floor(it.y), 0, doc.h);
    const x1 = clamp(Math.ceil(it.x + it.w), 0, doc.w);
    const y1 = clamp(Math.ceil(it.y + it.h), 0, doc.h);
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < 1 || h < 1) return;
    const b = Math.max(2, it.block);
    const sw = Math.max(1, Math.round(w / b));
    const sh = Math.max(1, Math.round(h / b));
    // 1. 先把這一塊原封不動複製出來。縮小時只會用到框內的像素，框外的顏色不會滲進來
    if (mosaicSrc.width !== w || mosaicSrc.height !== h) { mosaicSrc.width = w; mosaicSrc.height = h; }
    mosaicSrcCtx.globalCompositeOperation = 'copy';
    mosaicSrcCtx.drawImage(ctx.canvas, x0, y0, w, h, 0, 0, w, h);
    // 2. 縮小：每一格自動取平均色
    if (mosaicCanvas.width !== sw || mosaicCanvas.height !== sh) { mosaicCanvas.width = sw; mosaicCanvas.height = sh; }
    mosaicCtx.globalCompositeOperation = 'copy';
    mosaicCtx.imageSmoothingEnabled = true;
    mosaicCtx.imageSmoothingQuality = 'high';
    mosaicCtx.drawImage(mosaicSrc, 0, 0, w, h, 0, 0, sw, sh);
    // 3. 放大：關掉平滑，變成硬邊色塊
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mosaicCanvas, 0, 0, sw, sh, x0, y0, w, h);
  }

  /** 箭頭：尾端細、頭部實心的單一形狀，所以陰影不會疊兩層 */
  function drawArrow(ctx, it) {
    const g = arrowGeom(it);
    if (g.len < 1) return;
    const a = Math.atan2(g.uy, g.ux);
    ctx.beginPath();
    ctx.arc(it.x1, it.y1, g.s * 0.55, a + Math.PI / 2, a - Math.PI / 2);
    ctx.lineTo(g.bx - g.nx * g.s, g.by - g.ny * g.s);
    ctx.lineTo(g.bx - g.nx * g.headHalf, g.by - g.ny * g.headHalf);
    ctx.lineTo(it.x2, it.y2);
    ctx.lineTo(g.bx + g.nx * g.headHalf, g.by + g.ny * g.headHalf);
    ctx.lineTo(g.bx + g.nx * g.s, g.by + g.ny * g.s);
    ctx.closePath();
    shadowOn(ctx, it.width);
    ctx.fillStyle = it.color;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = it.color;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, it.width * 0.35);
    ctx.stroke();
  }

  function drawPen(ctx, it) {
    const p = it.pts;
    const n = p.length / 2;
    if (n < 1) return;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    if (n === 1) {
      ctx.lineTo(p[0] + 0.01, p[1]);
    } else {
      // 用相鄰點的中點做二次曲線，手繪線條會比較滑順
      for (let i = 1; i < n - 1; i++) {
        const x = p[i * 2];
        const y = p[i * 2 + 1];
        ctx.quadraticCurveTo(x, y, (x + p[i * 2 + 2]) / 2, (y + p[i * 2 + 3]) / 2);
      }
      ctx.lineTo(p[(n - 1) * 2], p[(n - 1) * 2 + 1]);
    }
    shadowOn(ctx, it.width);
    ctx.strokeStyle = it.color;
    ctx.lineWidth = it.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function drawText(ctx, it) {
    const L = textLayout(it);
    ctx.font = L.font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const tx = it.x + L.pad;
    const ty = (i) => it.y + L.pad + L.lh * (i + 0.5);
    if (it.bg) {
      shadowOn(ctx, it.size * 0.15);
      ctx.fillStyle = it.color;
      ctx.beginPath();
      pathRoundRect(ctx, it.x, it.y, L.w, L.h, it.size * 0.32);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = inkOn(it.color);
      L.lines.forEach((ln, i) => ctx.fillText(ln, tx, ty(i)));
    } else {
      // 白色描邊：放在任何背景上都讀得到
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.lineWidth = Math.max(2, it.size * 0.22);
      ctx.strokeStyle = haloFor(it.color);
      L.lines.forEach((ln, i) => ctx.strokeText(ln, tx, ty(i)));
      ctx.fillStyle = it.color;
      L.lines.forEach((ln, i) => ctx.fillText(ln, tx, ty(i)));
    }
  }

  function drawStep(ctx, it) {
    shadowOn(ctx, it.r * 0.25);
    ctx.fillStyle = it.color;
    ctx.beginPath();
    ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = Math.max(1.5, it.r * 0.14);
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    const label = String(it.n);
    const fs = it.r * [1.15, 0.95, 0.75][Math.min(label.length, 3) - 1];
    ctx.font = `700 ${fs}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(label);
    ctx.fillStyle = inkOn(it.color);
    ctx.fillText(label, it.x, it.y + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  }

  function exportCanvas(doc) {
    const c = document.createElement('canvas');
    c.width = doc.w;
    c.height = doc.h;
    renderDoc(c.getContext('2d'), doc);
    return c;
  }

  // ═══════════════════════ 6. 視圖：縮放、平移、選取框 ═══════════════════════

  const view = els.view;
  const vctx = view.getContext('2d');
  const docCanvas = document.createElement('canvas');
  const docCtx = docCanvas.getContext('2d');

  const toDoc = (sx, sy) => ({ x: (sx - state.view.x) / state.view.zoom, y: (sy - state.view.y) / state.view.zoom });
  const toScreen = (x, y) => ({ x: state.view.x + x * state.view.zoom, y: state.view.y + y * state.view.zoom });

  function screenPoint(e) {
    const r = view.getBoundingClientRect();
    return { sx: e.clientX - r.left, sy: e.clientY - r.top };
  }

  /** 畫面更新排進下一個影格。只是「重畫」，任何邏輯都不等它。 */
  function invalidate() {
    if (!frame) frame = requestAnimationFrame(flush);
  }

  const unionRect = (a, b) => {
    if (!a) return { ...b };
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  };
  const containsRect = (a, b) => b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h;

  /** 陰影和描邊會畫到物件範圍外面，局部重畫時要多留這些邊 */
  function paintPad(it) {
    switch (it.type) {
      case 'rect': case 'ellipse': case 'arrow': case 'pen': return it.width * 2.5 + 8;
      case 'text': return it.size * 0.5 + 8;
      case 'step': return it.r * 0.8 + 8;
      default: return 2;
    }
  }

  /**
   * 找出需要重畫的範圍。doc 不可變，所以用 === 就知道哪些物件變了。
   * 回傳 'none'（看得到的都沒變）、矩形（只重畫這塊），或 null（整張重畫）。
   */
  function dirtyRect(prev, next) {
    if (prev === next) return 'none';
    if (prev.bg !== next.bg) return null;
    const pm = byId(prev);
    const nm = byId(next);
    const a = prev.items.filter((it) => nm.has(it.id));
    const b = next.items.filter((it) => pm.has(it.id));
    if (a.some((it, i) => it.id !== b[i].id)) return null;   // 上下順序變了
    let r = null;
    const add = (it) => {
      const bb = bounds(it);
      const m = paintPad(it);
      r = unionRect(r, { x: bb.x - m, y: bb.y - m, w: bb.w + m * 2, h: bb.h + m * 2 });
    };
    for (const it of next.items) {
      const old = pm.get(it.id);
      if (old !== it) { add(it); if (old) add(old); }
    }
    for (const it of prev.items) if (!nm.has(it.id)) add(it);
    if (!r) return 'none';
    // 馬賽克會讀取底下的像素：範圍碰到的馬賽克，要整塊一起重畫
    for (let grew = true; grew;) {
      grew = false;
      for (const it of next.items) {
        if (it.type !== 'mosaic') continue;
        const mb = bounds(it);
        if (rectsOverlap(r, mb) && !containsRect(r, mb)) { r = unionRect(r, mb); grew = true; }
      }
    }
    const x0 = Math.max(0, Math.floor(r.x));
    const y0 = Math.max(0, Math.floor(r.y));
    const x1 = Math.min(next.w, Math.ceil(r.x + r.w));
    const y1 = Math.min(next.h, Math.ceil(r.y + r.h));
    if (x1 <= x0 || y1 <= y0) return 'none';
    if ((x1 - x0) * (y1 - y0) > next.w * next.h * 0.6) return null;   // 範圍太大，整張重畫反而快
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  let rendered = { doc: null, skip: null };   // 文件畫布上目前畫的是哪一份 doc

  function flush() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (docDirty) {
      docDirty = false;
      const doc = state.doc;
      const skip = state.editing?.item.id ?? null;
      if (doc.w) {
        let dirty = null;
        if (docCanvas.width !== doc.w || docCanvas.height !== doc.h) {
          docCanvas.width = doc.w;
          docCanvas.height = doc.h;
        } else if (rendered.doc && rendered.skip === skip) {
          dirty = dirtyRect(rendered.doc, doc);
        }
        if (dirty && dirty !== 'none') {
          docCtx.save();
          docCtx.beginPath();
          docCtx.rect(dirty.x, dirty.y, dirty.w, dirty.h);
          docCtx.clip();
          renderDoc(docCtx, doc, skip);
          docCtx.restore();
        } else if (!dirty) {
          renderDoc(docCtx, doc, skip);
        }
        rendered = { doc, skip };
      } else {
        rendered = { doc: null, skip: null };
      }
    }
    renderView();
    syncUI();
  }

  function setView(zoom, x, y, fitted = false) {
    const dpr = window.devicePixelRatio || 1;
    state.view = { zoom, x: Math.round(x * dpr) / dpr, y: Math.round(y * dpr) / dpr, fitted };
    invalidate();
  }

  function fitView() {
    const { w, h } = state.doc;
    if (!w) return;
    const vw = els.viewport.clientWidth;
    const vh = els.viewport.clientHeight;
    const pad = 40;
    const z = clamp(Math.min(1, (vw - pad * 2) / w, (vh - pad * 2) / h), 0.02, 1);
    setView(z, (vw - w * z) / 2, (vh - h * z) / 2, true);
  }

  function zoomAt(z, sx, sy) {
    const v = state.view;
    const nz = clamp(z, 0.05, 16);
    setView(nz, sx - (sx - v.x) * (nz / v.zoom), sy - (sy - v.y) * (nz / v.zoom));
  }
  const zoomCenter = (z) => zoomAt(z, els.viewport.clientWidth / 2, els.viewport.clientHeight / 2);

  function resizeViewCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(els.viewport.clientWidth * dpr));
    const H = Math.max(1, Math.round(els.viewport.clientHeight * dpr));
    if (view.width !== W || view.height !== H) {
      view.width = W;
      view.height = H;
    }
    if (state.view.fitted) fitView();
    flush();   // 同步重畫，視窗縮放時不會閃一下空白
  }

  function renderView() {
    const dpr = window.devicePixelRatio || 1;
    vctx.setTransform(1, 0, 0, 1, 0, 0);
    vctx.clearRect(0, 0, view.width, view.height);
    if (isEmpty()) return;
    vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { zoom: z, x: ox, y: oy } = state.view;
    const W = state.doc.w * z;
    const H = state.doc.h * z;
    vctx.save();
    vctx.shadowColor = 'rgba(15,20,30,.22)';
    vctx.shadowBlur = 18;
    vctx.shadowOffsetY = 4;
    vctx.fillStyle = state.doc.bg;
    vctx.fillRect(ox, oy, W, H);
    vctx.restore();
    // 放大很多時改用硬邊，看得到每個像素，方便對齊
    vctx.imageSmoothingEnabled = z * dpr < 2;
    vctx.imageSmoothingQuality = 'high';
    vctx.drawImage(docCanvas, ox, oy, W, H);
    drawOverlays(ox, oy, W, H);
  }

  function drawOverlays(ox, oy, W, H) {
    const c = vctx;
    const g = gesture;
    const editingId = state.editing?.item.id;

    if (state.hoverId && !state.selection.has(state.hoverId) && !g) {
      const it = getItem(state.hoverId);
      if (it) outline(it, 'rgba(59,91,255,.6)', 1);
    }

    if (state.tool !== 'crop') {
      for (const id of state.selection) {
        const it = getItem(id);
        if (it && id !== editingId) outline(it, SEL_COLOR, 1.5, it.locked);
      }
      const one = singleSelected();
      const busy = g && (g.kind === 'move' || g.kind === 'draw');
      if (one && !busy && one.id !== editingId) {
        for (const [name, x, y] of handlesOf(one)) drawHandle(toScreen(x, y), name);
      }
    }

    if (g?.kind === 'marquee' && g.rect) {
      const a = toScreen(g.rect.x, g.rect.y);
      const w = g.rect.w * state.view.zoom;
      const h = g.rect.h * state.view.zoom;
      c.save();
      c.fillStyle = 'rgba(59,91,255,.08)';
      c.fillRect(a.x, a.y, w, h);
      c.strokeStyle = SEL_COLOR;
      c.lineWidth = 1;
      c.strokeRect(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5, Math.round(w), Math.round(h));
      c.restore();
    }

    if (g?.kind === 'crop' && g.rect) {
      const a = toScreen(g.rect.x, g.rect.y);
      const w = g.rect.w * state.view.zoom;
      const h = g.rect.h * state.view.zoom;
      c.save();
      c.fillStyle = 'rgba(10,14,20,.5)';
      c.beginPath();
      c.rect(ox, oy, W, H);
      c.rect(a.x, a.y, w, h);
      c.fill('evenodd');
      c.strokeStyle = '#FFFFFF';
      c.lineWidth = 1.5;
      c.setLineDash([6, 4]);
      c.strokeRect(a.x, a.y, w, h);
      c.restore();
      sizeLabel(`${g.rect.w} × ${g.rect.h}`, a.x, a.y + h + 8);
    }

    if (state.tool === 'select' && !editingId) {
      drawGrip();
      if (g?.kind === 'canvas') sizeLabel(`${state.doc.w} × ${state.doc.h}`, ox + W + 18, oy + H - 10);
    }
  }

  function outline(it, color, lw, dashed = false) {
    const c = vctx;
    const z = state.view.zoom;
    c.save();
    if (dashed) c.setLineDash([4, 3]);
    c.beginPath();
    if (it.type === 'arrow') {
      const a = toScreen(it.x1, it.y1);
      const b = toScreen(it.x2, it.y2);
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
    } else {
      const b = bounds(it);
      const s = toScreen(b.x, b.y);
      const pad = 3;
      c.rect(Math.round(s.x - pad) + 0.5, Math.round(s.y - pad) + 0.5, Math.round(b.w * z + pad * 2), Math.round(b.h * z + pad * 2));
    }
    c.strokeStyle = 'rgba(255,255,255,.9)';   // 白色底線，深色截圖上也看得到
    c.lineWidth = lw + 2;
    c.stroke();
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.stroke();
    c.restore();
  }

  function drawHandle(p, name) {
    const c = vctx;
    const r = HANDLE / 2;
    c.save();
    c.fillStyle = '#FFFFFF';
    c.strokeStyle = SEL_COLOR;
    c.lineWidth = 1.5;
    c.shadowColor = 'rgba(0,0,0,.25)';
    c.shadowBlur = 3;
    c.beginPath();
    if (name === 'p1' || name === 'p2') c.arc(p.x, p.y, r + 1, 0, Math.PI * 2);
    else c.rect(Math.round(p.x - r) + 0.5, Math.round(p.y - r) + 0.5, HANDLE, HANDLE);
    c.fill();
    c.shadowColor = 'transparent';
    c.stroke();
    c.restore();
  }

  /** 畫布右下角的把手：拖曳可以加大或縮小畫布 */
  function gripRect() {
    const s = toScreen(state.doc.w, state.doc.h);
    return { x: s.x + 3, y: s.y + 3, w: 12, h: 12 };
  }
  function overGrip(sx, sy) {
    if (isEmpty() || state.tool !== 'select') return false;
    const r = gripRect();
    return sx >= r.x - 4 && sx <= r.x + r.w + 4 && sy >= r.y - 4 && sy <= r.y + r.h + 4;
  }
  function drawGrip() {
    const r = gripRect();
    const c = vctx;
    c.save();
    c.fillStyle = '#FFFFFF';
    c.strokeStyle = 'rgba(30,35,45,.55)';
    c.lineWidth = 1;
    c.beginPath();
    pathRoundRect(c, r.x + 0.5, r.y + 0.5, r.w, r.h, 3);
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(r.x + 4, r.y + r.h - 2.5);
    c.lineTo(r.x + r.w - 2.5, r.y + 4);
    c.moveTo(r.x + 7.5, r.y + r.h - 2.5);
    c.lineTo(r.x + r.w - 2.5, r.y + 7.5);
    c.stroke();
    c.restore();
  }

  function sizeLabel(text, x, y) {
    const c = vctx;
    c.save();
    c.font = `600 12px ${FONT}`;
    const w = c.measureText(text).width + 12;
    c.fillStyle = 'rgba(20,24,30,.85)';
    c.beginPath();
    pathRoundRect(c, x, y, w, 20, 5);
    c.fill();
    c.fillStyle = '#FFFFFF';
    c.textBaseline = 'middle';
    c.fillText(text, x + 6, y + 10.5);
    c.restore();
  }

  // ═══════════════════════ 7. 指標手勢（滑鼠、觸控、觸控筆共用） ═══════════════════════

  function startGesture(e, g) {
    gesture = { pointerId: e.pointerId, startDoc: state.doc, moved: false, ...g };
    try { view.setPointerCapture(e.pointerId); } catch { /* 忽略 */ }
    invalidate();
  }

  /** 取消手勢：直接回到手勢開始前的 doc，什麼都不留下 */
  function cancelGesture() {
    const g = gesture;
    if (!g) return;
    gesture = null;
    if (g.kind === 'marquee') setSelection(g.baseSel);
    else if (g.kind !== 'pan') setDoc(g.startDoc);
    try { view.releasePointerCapture(g.pointerId); } catch { /* 忽略 */ }
    invalidate();
  }

  function onPointerDown(e) {
    hideMenu();
    if (gesture) return;   // 第二根手指之類，忽略
    if (state.editing) { finishTextEdit(); return; }   // 點旁邊＝結束文字輸入
    const { sx, sy } = screenPoint(e);
    const p = toDoc(sx, sy);

    if (e.button === 1 || (e.button === 0 && state.spaceDown)) {
      e.preventDefault();
      startGesture(e, { kind: 'pan', sx0: sx, sy0: sy, vx: state.view.x, vy: state.view.y });
      return;
    }
    if (e.button !== 0 || isEmpty()) return;

    // 畫圖時按住 Ctrl／⌘：這一下暫時當成選取工具
    const tempSelect = (e.ctrlKey || e.metaKey) && state.tool !== 'select' && state.tool !== 'crop';
    const tool = tempSelect ? 'select' : state.tool;
    const base = { sx0: sx, sy0: sy, start: p };

    if (tool !== 'crop') {
      const h = hitHandle(sx, sy);
      if (h) {
        startGesture(e, { ...base, kind: 'resize', id: h.it.id, handle: h.name, orig: h.it, off: { x: h.x - p.x, y: h.y - p.y } });
        return;
      }
    }

    if (tool === 'select') {
      if (!tempSelect && overGrip(sx, sy)) {
        state.view.fitted = false;
        startGesture(e, { ...base, kind: 'canvas' });
        return;
      }
      const hit = pick(p, { deep: true });
      if (hit) {
        let sel = state.selection;
        let collapse = null;
        if (e.shiftKey) {
          sel = new Set(sel);
          if (sel.has(hit.id)) { sel.delete(hit.id); setSelection(sel); return; }
          sel.add(hit.id);
        } else if (!sel.has(hit.id)) {
          sel = new Set([hit.id]);
        } else if (sel.size > 1) {
          collapse = hit.id;   // 放開時如果沒拖動，就只留這一個
        }
        setSelection(sel);
        startGesture(e, { ...base, kind: 'move', ids: movableIds(sel), collapse });
        return;
      }
      const baseSel = e.shiftKey ? state.selection : new Set();
      setSelection(baseSel);
      startGesture(e, { ...base, kind: 'marquee', baseSel, rect: null });
      return;
    }

    if (tool === 'text') {
      const t = pick(p, { types: ['text'] });
      if (t) {
        setSelection(new Set([t.id]));
        startGesture(e, { ...base, kind: 'move', ids: new Set([t.id]), editOnClick: t.id });
      } else {
        startGesture(e, { ...base, kind: 'textPlace' });
      }
      return;
    }

    if (tool === 'step') {
      const s = pick(p, { types: ['step'] });
      if (s) {
        setSelection(new Set([s.id]));
        startGesture(e, { ...base, kind: 'move', ids: new Set([s.id]) });
        return;
      }
      const st = toolStyle.step;
      const r = sizeValue('step', st.size, state.doc);
      const at = clampToDoc(p, r);
      const item = { id: uid(), type: 'step', x: at.x, y: at.y, r, n: nextStepNo(state.doc), color: st.color };
      startGesture(e, { ...base, kind: 'place', item });
      setDoc(addItems(state.doc, item));
      setSelection(new Set([item.id]));
      return;
    }

    if (tool === 'crop') {
      startGesture(e, { ...base, kind: 'crop', rect: null });
      return;
    }

    setSelection(new Set());
    startGesture(e, { ...base, kind: 'draw', tool, id: uid(), pts: [round1(p.x), round1(p.y)] });
  }

  function onPointerMove(e) {
    const { sx, sy } = screenPoint(e);
    const p = toDoc(sx, sy);
    const g = gesture;
    if (!g) { updateHover(sx, sy, p); return; }
    if (e.pointerId !== g.pointerId) return;
    if (!g.moved) {
      if (Math.hypot(sx - g.sx0, sy - g.sy0) < 3) return;   // 小於 3px 當成點擊，避免手抖
      g.moved = true;
    }
    switch (g.kind) {
      case 'pan':
        setView(state.view.zoom, g.vx + sx - g.sx0, g.vy + sy - g.sy0);
        break;
      case 'move': {
        let dx = Math.round(p.x - g.start.x);
        let dy = Math.round(p.y - g.start.y);
        if (e.shiftKey) { if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0; }
        setDoc(mapItems(g.startDoc, g.ids, (it) => moveItem(it, dx, dy)));
        break;
      }
      case 'place':
        setDoc(addItems(g.startDoc, { ...g.item, ...clampToDoc(p, g.item.r) }));
        break;
      case 'draw':
        if (g.tool === 'pen') {
          const minD = 1.5 / state.view.zoom;
          const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
          for (const ce of events.length ? events : [e]) {
            const sp = screenPoint(ce);
            const q = toDoc(sp.sx, sp.sy);
            const lx = g.pts[g.pts.length - 2];
            const ly = g.pts[g.pts.length - 1];
            if (Math.hypot(q.x - lx, q.y - ly) >= minD) g.pts.push(round1(q.x), round1(q.y));
          }
        }
        setDoc(addItems(g.startDoc, makeShape(g, p, e.shiftKey)));
        break;
      case 'resize': {
        const q = { x: p.x + g.off.x, y: p.y + g.off.y };   // 加上抓取偏移量，按下去時不會跳一下
        setDoc(mapItems(g.startDoc, new Set([g.id]), () => resizeItem(g.orig, g.handle, q, e.shiftKey)));
        break;
      }
      case 'marquee': {
        g.rect = normRect(g.start.x, g.start.y, p.x, p.y);
        const sel = new Set(g.baseSel);
        for (const it of state.doc.items) if (!it.locked && rectsOverlap(bounds(it), g.rect)) sel.add(it.id);
        setSelection(sel);
        invalidate();
        break;
      }
      case 'crop': {
        const { w, h } = state.doc;
        g.rect = normRect(
          clamp(Math.round(g.start.x), 0, w), clamp(Math.round(g.start.y), 0, h),
          clamp(Math.round(p.x), 0, w), clamp(Math.round(p.y), 0, h),
        );
        invalidate();
        break;
      }
      case 'canvas':
        setDoc({
          ...g.startDoc,
          w: clamp(Math.round(g.startDoc.w + p.x - g.start.x), 16, MAX_SIDE),
          h: clamp(Math.round(g.startDoc.h + p.y - g.start.y), 16, MAX_SIDE),
        });
        break;
      default:
        break;
    }
  }

  function tooSmall(it) {
    const z = state.view.zoom;
    if (it.type === 'arrow') return Math.hypot(it.x2 - it.x1, it.y2 - it.y1) * z < 6;
    if (it.type === 'pen') return it.pts.length < 4;
    return Math.max(it.w, it.h) * z < 4;
  }

  function onPointerUp(e) {
    const g = gesture;
    if (!g || e.pointerId !== g.pointerId) return;
    gesture = null;
    try { view.releasePointerCapture(e.pointerId); } catch { /* 忽略 */ }
    switch (g.kind) {
      case 'draw': {
        const it = getItem(g.id);
        if (!g.moved || !it || tooSmall(it)) { setDoc(g.startDoc); break; }
        commitFrom(g.startDoc);
        setSelection(new Set([g.id]));   // 剛畫好的會被選取，可以馬上拖控制點微調
        break;
      }
      case 'move':
        if (!g.moved && g.editOnClick) { openEditor(getItem(g.editOnClick)); break; }
        if (!g.moved && g.collapse) setSelection(new Set([g.collapse]));
        commitFrom(g.startDoc);
        break;
      case 'place':
      case 'resize':
      case 'canvas':
        commitFrom(g.startDoc);
        break;
      case 'crop':
        if (g.rect && g.rect.w >= 4 && g.rect.h >= 4) applyCrop(g.rect);
        break;
      case 'textPlace':
        openEditor(null, g.start);
        break;
      default:
        break;
    }
    const { sx, sy } = screenPoint(e);
    updateHover(sx, sy, toDoc(sx, sy));
    invalidate();
  }

  function applyCrop(r) {
    const doc = state.doc;
    commit({ ...doc, w: r.w, h: r.h, items: doc.items.map((it) => moveItem(it, -r.x, -r.y)) });
    fitView();
    setTool(state.prevTool && state.prevTool !== 'crop' ? state.prevTool : 'select');
    toast(`已裁切成 ${r.w} × ${r.h}`, { label: '復原', run: undo });
  }

  const HANDLE_CURSOR = {
    nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
    n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
    p1: 'move', p2: 'move', grip: 'nwse-resize', body: 'move', textbody: 'text',
  };

  function updateHover(sx, sy, p) {
    let hoverId = null;
    let handle = null;
    if (!isEmpty() && !state.spaceDown && !state.editing) {
      const h = state.tool !== 'crop' ? hitHandle(sx, sy) : null;
      if (h) {
        handle = h.name;
      } else if (state.tool === 'select') {
        hoverId = pick(p, { deep: true })?.id ?? null;
        if (!hoverId && overGrip(sx, sy)) handle = 'grip';
      } else if (state.tool === 'text') {
        if (pick(p, { types: ['text'] })) handle = 'textbody';
      } else if (state.tool === 'step') {
        if (pick(p, { types: ['step'] })) handle = 'body';
      }
    }
    if (hoverId !== state.hoverId || handle !== state.hoverHandle) {
      state.hoverId = hoverId;
      state.hoverHandle = handle;
      invalidate();
    }
    updateCursor();
  }

  function updateCursor() {
    let c;
    if (isEmpty()) c = 'default';
    else if (gesture?.kind === 'pan') c = 'grabbing';
    else if (state.spaceDown) c = 'grab';
    else if (gesture?.kind === 'move') c = 'move';
    else if (gesture?.kind === 'resize') c = HANDLE_CURSOR[gesture.handle];
    else if (gesture?.kind === 'canvas') c = 'nwse-resize';
    else if (state.hoverHandle) c = HANDLE_CURSOR[state.hoverHandle];
    else if (state.tool === 'select') c = state.hoverId ? 'move' : 'default';
    else if (state.tool === 'text') c = 'text';
    else c = 'crosshair';
    if (view.style.cursor !== c) view.style.cursor = c;
  }

  // ═══════════════════════ 8. 文字編輯器（疊在畫布上的 textarea） ═══════════════════════

  function openEditor(item, at) {
    cancelGesture();
    if (item) {
      state.editing = { item, isNew: false };
      setSelection(new Set([item.id]));
    } else {
      const st = toolStyle.text;
      const size = sizeValue('text', st.size, state.doc);
      const L0 = textLayout({ text: ' ', size, bg: st.bg });
      state.editing = {
        isNew: true,
        item: {
          id: uid(), type: 'text',
          x: Math.round(clamp(at.x - L0.pad, 0, Math.max(0, state.doc.w - L0.w))),
          y: Math.round(clamp(at.y - L0.h / 2, 0, Math.max(0, state.doc.h - L0.h))),
          text: '', color: st.color, size, bg: st.bg,
        },
      };
      setSelection(new Set());
    }
    const ta = els.editor;
    ta.value = state.editing.item.text;
    ta.hidden = false;
    docDirty = true;   // 編輯中先把畫布上的那段字藏起來
    layoutEditor();
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(ta.value.length, ta.value.length);
    invalidate();
  }

  function haloShadow(color, px) {
    const h = haloFor(color);
    const r = Math.max(1, px);
    return [[-r, 0], [r, 0], [0, -r], [0, r], [-r, -r], [r, r], [-r, r], [r, -r]]
      .map(([x, y]) => `${x}px ${y}px 0 ${h}`).join(',');
  }

  function layoutEditor() {
    const ed = state.editing;
    if (!ed) return;
    const ta = els.editor;
    const it = ed.item;
    const z = state.view.zoom;
    const L = textLayout({ ...it, text: ta.value || ' ' });
    const s = toScreen(it.x, it.y);
    const st = ta.style;
    st.left = `${s.x}px`;
    st.top = `${s.y}px`;
    st.width = `${(L.w + it.size * 0.8) * z}px`;   // 多留一點寬度，打字時不會跳動
    st.height = `${L.h * z}px`;
    st.padding = `${L.pad * z}px`;
    st.font = `600 ${it.size * z}px/${L.lh * z}px ${FONT}`;
    st.color = it.bg ? inkOn(it.color) : it.color;
    st.background = it.bg ? it.color : 'transparent';
    st.borderRadius = it.bg ? `${it.size * 0.32 * z}px` : '0';
    st.textShadow = it.bg ? 'none' : haloShadow(it.color, it.size * 0.09 * z);
  }

  function finishTextEdit() {
    const ed = state.editing;
    if (!ed) return;
    state.editing = null;
    const ta = els.editor;
    const text = ta.value.replace(/\s+$/, '');
    ta.hidden = true;
    docDirty = true;
    if (ed.isNew) {
      if (text) {
        commit(addItems(state.doc, { ...ed.item, text }));
        setSelection(new Set([ed.item.id]));
      }
    } else {
      const cur = getItem(ed.item.id);
      if (cur && !text) {
        commit(removeItems(state.doc, new Set([cur.id])));
      } else if (cur) {
        const next = { ...ed.item, text };
        const same = cur.text === next.text && cur.color === next.color && cur.size === next.size && cur.bg === next.bg;
        if (!same) commit(mapItems(state.doc, new Set([cur.id]), () => next));
      }
    }
    invalidate();
  }

  /** 編輯中改顏色／大小／底色：只改暫存的那段字，結束時一起寫入歷史 */
  function patchEditing(patch) {
    state.editing.item = { ...state.editing.item, ...patch };
    layoutEditor();
    invalidate();
  }

  // ═══════════════════════ 9. 編輯指令 ═══════════════════════

  function setTool(t) {
    if (!TOOLS[t]) return;
    finishTextEdit();
    cancelGesture();
    hideMenu();
    if (t === 'crop' && state.tool !== 'crop') state.prevTool = state.tool;
    if (t !== 'select') setSelection(new Set());   // 換成畫圖工具時取消選取，避免誤拖
    state.tool = t;
    savePrefs();
    invalidate();
  }

  function deleteSelection() {
    if (!state.selection.size) return;
    commit(removeItems(state.doc, state.selection));
  }

  function selectAll() {
    finishTextEdit();
    const ids = state.doc.items.filter((it) => !it.locked).map((it) => it.id);
    if (!ids.length) { toast('目前沒有可以選取的標記'); return; }
    if (state.tool !== 'select') setTool('select');
    setSelection(new Set(ids));
  }

  function duplicateSelection() {
    const src = state.doc.items.filter((it) => state.selection.has(it.id));
    if (!src.length) return;
    const d = Math.round(12 * docUnit(state.doc));
    let n = nextStepNo(state.doc);
    const clones = src.map((it) => {
      const c = { ...moveItem(it, d, d), id: uid(), locked: false };
      if (c.type === 'step') c.n = n++;
      return c;
    });
    commit(addItems(state.doc, ...clones));
    setSelection(new Set(clones.map((c) => c.id)));
  }

  function nudge(dx, dy) {
    const ids = movableIds(state.selection);
    if (!ids.size) return;
    commit(mapItems(state.doc, ids, (it) => moveItem(it, dx, dy)), `nudge:${[...ids].join()}`);
  }

  function reorder(dir) {
    const sel = state.selection;
    if (!sel.size) return;
    let items = [...state.doc.items];
    if (dir === 'front') items = [...items.filter((i) => !sel.has(i.id)), ...items.filter((i) => sel.has(i.id))];
    else if (dir === 'back') items = [...items.filter((i) => sel.has(i.id)), ...items.filter((i) => !sel.has(i.id))];
    else if (dir === 'up') {
      for (let i = items.length - 2; i >= 0; i--) {
        if (sel.has(items[i].id) && !sel.has(items[i + 1].id)) [items[i], items[i + 1]] = [items[i + 1], items[i]];
      }
    } else {
      for (let i = 1; i < items.length; i++) {
        if (sel.has(items[i].id) && !sel.has(items[i - 1].id)) [items[i], items[i - 1]] = [items[i - 1], items[i]];
      }
    }
    if (items.every((it, i) => it === state.doc.items[i])) return;
    commit(withItems(state.doc, items));
  }

  function moveLayer(id, targetId, above) {
    const moving = getItem(id);
    const items = state.doc.items.filter((it) => it.id !== id);
    const idx = items.findIndex((it) => it.id === targetId);
    if (!moving || idx < 0) return;
    items.splice(above ? idx + 1 : idx, 0, moving);   // 清單由上到下＝圖層由高到低
    if (items.every((it, i) => it === state.doc.items[i])) return;
    commit(withItems(state.doc, items));
  }

  function toggleLock(ids) {
    const list = [...ids].map(getItem).filter(Boolean);
    if (!list.length) return;
    const lock = list.some((it) => !it.locked);
    commit(mapItems(state.doc, new Set(list.map((it) => it.id)), (it) => ({ ...it, locked: lock })));
    toast(lock ? '已鎖定。畫布上點不到它，可以從圖層清單選取。' : '已解除鎖定');
  }

  function renumberSteps() {
    let n = 0;
    const items = state.doc.items.map((it) => {
      if (it.type !== 'step') return it;
      n += 1;
      return it.n === n ? it : { ...it, n };
    });
    if (items.every((it, i) => it === state.doc.items[i])) { toast('編號已經是連續的'); return; }
    commit(withItems(state.doc, items));
    toast('已重新編號');
  }

  function clearAll() {
    if (isEmpty()) return;
    finishTextEdit();
    cancelGesture();
    commit(EMPTY_DOC);
    toast('已清空畫布', { label: '復原', run: undo });
  }

  function newBlank() {
    commit({ w: 1280, h: 720, bg: '#ffffff', items: [] });
    fitView();
  }

  // ── 樣式：作用在「正在編輯的文字」或「選取的物件」，沒有選取時改的是工具預設值 ──

  function styleTargets() {
    if (state.editing) return { editing: true, items: [state.editing.item] };
    const items = [...state.selection].map(getItem).filter(Boolean);
    return { editing: false, items };
  }

  function setColor(color) {
    const t = styleTargets();
    if (t.editing) {
      patchEditing({ color });
      toolStyle.text.color = color;
    } else if (t.items.length) {
      const ids = new Set(t.items.filter((it) => HAS_COLOR.has(it.type)).map((it) => it.id));
      if (ids.size) commit(mapItems(state.doc, ids, (it) => ({ ...it, color })), `color:${[...ids].join()}`);
      for (const it of t.items) if (toolStyle[it.type] && 'color' in toolStyle[it.type]) toolStyle[it.type].color = color;
    } else if (toolStyle[state.tool] && 'color' in toolStyle[state.tool]) {
      toolStyle[state.tool].color = color;
    }
    savePrefs();
    invalidate();
  }

  function setSize(idx) {
    const t = styleTargets();
    if (t.editing) {
      patchEditing({ size: sizeValue('text', idx, state.doc) });
      toolStyle.text.size = idx;
    } else if (t.items.length) {
      const ids = new Set(t.items.filter((it) => SIZE_KIND[it.type]).map((it) => it.id));
      if (ids.size) {
        commit(mapItems(state.doc, ids, (it) => {
          const kind = SIZE_KIND[it.type];
          return { ...it, [SIZE_PROP[kind]]: sizeValue(kind, idx, state.doc) };
        }));
      }
      for (const it of t.items) if (toolStyle[it.type] && 'size' in toolStyle[it.type]) toolStyle[it.type].size = idx;
    } else if (toolStyle[state.tool] && 'size' in toolStyle[state.tool]) {
      toolStyle[state.tool].size = idx;
    }
    savePrefs();
    invalidate();
  }

  function toggleTextBg() {
    const t = styleTargets();
    if (t.editing) {
      const bg = !state.editing.item.bg;
      patchEditing({ bg });
      toolStyle.text.bg = bg;
    } else {
      const texts = t.items.filter((it) => it.type === 'text');
      if (texts.length) {
        const bg = !texts[0].bg;
        commit(mapItems(state.doc, new Set(texts.map((it) => it.id)), (it) => ({ ...it, bg })));
        toolStyle.text.bg = bg;
      } else {
        toolStyle.text.bg = !toolStyle.text.bg;
      }
    }
    savePrefs();
    invalidate();
  }

  // ═══════════════════════ 10. 非同步邊界：匯入、剪貼簿、下載 ═══════════════════════
  // 這一區是整個程式「唯一」會等待的地方。
  // 等待的結果一律交給同步函式（receiveImage、markExported）一次處理完。

  function decodeImage(blob) {
    const viaImg = () => new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      img.src = url;
    });
    return typeof createImageBitmap === 'function' ? createImageBitmap(blob).catch(viaImg) : viaImg();
  }

  function importImage(blob) {
    if (!blob || (blob.type && !blob.type.startsWith('image/'))) {
      toast('這個檔案不是圖片。請使用 PNG、JPG 或 WebP。');
      return Promise.resolve(false);
    }
    return decodeImage(blob).then(
      (img) => { receiveImage(img); return true; },
      () => { toast('無法讀取這張圖片，檔案可能已經損壞。'); return false; },
    );
  }

  /**
   * 圖片解碼完成，回到同步世界。
   * 先結束進行中的拖曳與文字輸入，再用「一次」commit 放進文件，
   * 所以不會出現「拖到一半，圖片突然插進來」這種狀態交錯。
   */
  function receiveImage(img) {
    finishTextEdit();
    cancelGesture();
    hideMenu();
    const assetId = uid('a');
    assets.set(assetId, img);
    const before = state.doc;
    const wasEmpty = isEmpty();
    // 剛複製過成品＝這張單子處理完了，新的截圖直接換成新畫布
    const fresh = wasEmpty || before === state.exportedDoc;
    const apply = (asFresh) => {
      commit(asFresh ? freshDoc(assetId) : withImage(state.doc, assetId));
      if (asFresh) { setSelection(new Set()); fitView(); } else {
        const items = state.doc.items;
        setSelection(new Set([items[items.length - 1].id]));
      }
    };
    apply(fresh);
    const after = state.doc;
    trimHistory();
    if (wasEmpty) return;
    const swap = (asFresh, msg) => () => {
      if (state.doc !== after) { toast(`畫面已經有變動，請改用 ${MOD}+Z 調整`); return; }
      history.past.pop();       // 拿掉剛才那一步（它就是 before），換成另一種做法
      state.doc = before;
      apply(asFresh);
      toast(msg);
    };
    if (fresh) toast('已換成新的截圖（上一張已經複製過）', { label: '改成疊加上去', run: swap(false, '已改成疊加') });
    else toast('已疊加成新圖層', { label: '改成換新的', run: swap(true, '已換成新的截圖') });
  }

  const canvasToBlob = (canvas) => new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });

  function fileName() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `annotated_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
  }

  function saveBlob(blobPromise) {
    return blobPromise.then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName();
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  }

  function markExported(doc) {
    state.exportedDoc = doc;
  }

  function copyImage() {
    if (isEmpty()) { toast(`還沒有圖片。先按 ${MOD}+V 貼上截圖。`); return; }
    finishTextEdit();
    cancelGesture();
    const doc = state.doc;
    const blob = canvasToBlob(exportCanvas(doc));   // 同步畫好，只有編碼 PNG 是非同步
    const done = () => { markExported(doc); flashCopied(); toast('已複製圖片，可以直接貼到對話或工單'); };
    const fallback = () => {
      saveBlob(blob).then(() => { markExported(doc); });
      toast('無法寫入剪貼簿（被瀏覽器封鎖，或網址不是 https），已改成下載檔案');
    };
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') { fallback(); return; }
    // 先用「Promise 版」：在點擊當下就交出 ClipboardItem，Safari 也接受
    let first;
    try { first = navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); }
    catch (err) { first = Promise.reject(err); }
    first.then(done, () => blob
      .then((b) => navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]))
      .then(done, fallback));
  }

  function downloadImage() {
    if (isEmpty()) { toast(`還沒有圖片。先按 ${MOD}+V 貼上截圖。`); return; }
    finishTextEdit();
    cancelGesture();
    const doc = state.doc;
    saveBlob(canvasToBlob(exportCanvas(doc))).then(
      () => { markExported(doc); toast('已下載 PNG'); },
      () => toast('下載失敗，請再試一次'),
    );
  }

  let copiedTimer = 0;
  function flashCopied() {
    els.copyLabel.textContent = '已複製';
    els.copy.querySelector('use').setAttribute('href', '#i-check');
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      els.copyLabel.textContent = '複製圖片';
      els.copy.querySelector('use').setAttribute('href', '#i-copy');
    }, 1600);
  }

  // ═══════════════════════ 11. 鍵盤 ═══════════════════════

  const isTyping = (el) => el instanceof HTMLElement
    && (el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['color', 'file', 'button', 'checkbox', 'radio', 'range'].includes(el.type)));

  // 用實體按鍵判斷：開著注音輸入法時快捷鍵一樣有效
  const letterOf = (e) => (/^Key[A-Z]$/.test(e.code) ? e.code[3].toLowerCase() : (e.key || '').toLowerCase());

  function openHelp() {
    if (!els.help.open) els.help.showModal();
  }

  function onKeyDown(e) {
    if (els.help.open || isTyping(e.target)) return;
    if (!els.menu.hidden) return;   // 選單自己處理鍵盤
    const onControl = e.target instanceof Element && e.target.closest('button, a, input, select');
    const mod = e.ctrlKey || e.metaKey;
    const key = letterOf(e);

    if (mod && !e.altKey) {
      let handled = true;
      switch (key) {
        case 'z': if (e.shiftKey) redo(); else undo(); break;
        case 'y': redo(); break;
        case 'c':
          if (window.getSelection && !window.getSelection().isCollapsed) { handled = false; break; }
          copyImage();
          break;
        case 's': downloadImage(); break;
        case 'o': els.fileInput.click(); break;
        case 'a': selectAll(); break;
        case 'd': duplicateSelection(); break;
        default:
          if (e.code === 'Digit0' || e.code === 'Numpad0') fitView();
          else if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomCenter(state.view.zoom * 1.25);
          else if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomCenter(state.view.zoom / 1.25);
          else if (e.code === 'BracketRight') reorder(e.shiftKey ? 'front' : 'up');
          else if (e.code === 'BracketLeft') reorder(e.shiftKey ? 'back' : 'down');
          else handled = false;
      }
      if (handled) e.preventDefault();
      return;
    }
    if (e.altKey) return;

    if (e.code === 'Space') {
      if (onControl) return;
      e.preventDefault();
      if (!state.spaceDown) { state.spaceDown = true; updateCursor(); }
      return;
    }
    if (e.key === 'Escape') {
      if (gesture) cancelGesture();
      else if (state.tool === 'crop') setTool(state.prevTool || 'select');
      else setSelection(new Set());
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selection.size) { e.preventDefault(); deleteSelection(); }
      return;
    }
    if (e.key === 'Enter') {
      if (onControl) return;
      const one = singleSelected();
      if (one?.type === 'text') { e.preventDefault(); openEditor(one); }
      return;
    }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key] && state.selection.size) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      nudge(arrows[e.key][0] * step, arrows[e.key][1] * step);
      return;
    }
    if (e.key === '?' || (e.code === 'Slash' && e.shiftKey)) { openHelp(); return; }
    if (e.shiftKey && e.code === 'Digit0') { zoomCenter(1); return; }
    if (!e.shiftKey && KEY_TO_TOOL[key]) {
      e.preventDefault();
      setTool(KEY_TO_TOOL[key]);
    }
  }

  function onKeyUp(e) {
    if (e.code === 'Space' && state.spaceDown) {
      state.spaceDown = false;
      updateCursor();
    }
  }

  // ═══════════════════════ 12. 介面同步（每個影格一次，內容沒變就不動 DOM） ═══════════════════════

  const setText = (el, v) => { if (el.textContent !== v) el.textContent = v; };
  const setAttr = (el, k, v) => { if (el.getAttribute(k) !== v) el.setAttribute(k, v); };
  const setHidden = (el, v) => { if (el.hidden !== v) el.hidden = v; };

  function syncUI() {
    const empty = isEmpty();
    setHidden(els.empty, !empty);
    for (const b of els.toolButtons) setAttr(b, 'aria-pressed', String(b.dataset.tool === state.tool));
    els.undo.disabled = !history.past.length;
    els.redo.disabled = !history.future.length;
    els.copy.disabled = empty;
    els.download.disabled = empty;
    els.clear.disabled = empty;
    syncProps();
    renderLayers();
    setText(els.hint, hintText());
    setText(els.docSize, empty ? '' : `${state.doc.w} × ${state.doc.h}`);
    setText(els.zoomLabel, `${Math.round(state.view.zoom * 100)}%`);
    setHidden(els.zoomGroup, empty);
    setAttr(els.layersToggle, 'aria-pressed', String(!els.layers.hidden));
    layoutEditor();
    updateCursor();
  }

  function hintText() {
    if (isEmpty()) return `按 ${MOD}+V 貼上截圖，或把圖片拖進畫面。`;
    if (state.editing) return '直接輸入文字，Enter 換行。按 Esc 或點旁邊就完成。';
    if (gesture?.kind === 'canvas') return '放開滑鼠，畫布大小就會改變。';
    const n = state.selection.size;
    if (n && (state.tool === 'select' || state.tool === 'text' || state.tool === 'step')) {
      const one = singleSelected();
      if (one?.locked) return '這個物件已鎖定。在畫布上按右鍵可以解除鎖定。';
      if (one?.type === 'image') return '拖曳四個角可以縮放，會自動維持比例。按住 Shift 可以自由變形。';
      return `已選取 ${n} 個物件。Delete 刪除，方向鍵微調，${MOD}+D 複製一份。`;
    }
    return HINTS[state.tool];
  }

  /** 決定第二列要顯示哪些控制項：依「正在編輯／選取的物件」或「目前工具」 */
  function styleContext() {
    const t = styleTargets();
    if (t.items.length) {
      const types = [...new Set(t.items.map((it) => it.type))];
      const colored = t.items.find((it) => HAS_COLOR.has(it.type));
      const sized = t.items.find((it) => SIZE_KIND[it.type]);
      const text = t.items.find((it) => it.type === 'text');
      return {
        types,
        color: colored?.color,
        sizeIdx: sized ? sizeIndexOf(sized, state.doc) : -1,
        bg: !!text?.bg,
      };
    }
    const st = toolStyle[state.tool];
    if (!st) return { types: [] };
    return { types: [state.tool], color: st.color, sizeIdx: st.size ?? -1, bg: !!st.bg };
  }

  let propsSig = '';
  function syncProps() {
    const c = styleContext();
    const showColor = c.types.some((t) => HAS_COLOR.has(t));
    const showSize = c.types.some((t) => SIZE_KIND[t]);
    const showBg = c.types.includes('text');
    let note = '';
    if (!showColor && !showSize) {
      if (isEmpty()) note = '';
      else if (state.tool === 'crop') note = '在圖上拖曳，框出要保留的範圍。';
      else if (c.types.includes('image')) note = '圖片可以拖曳移動，或拖四個角縮放。';
      else note = '選取物件後，可以在這裡改顏色和粗細。';
    }
    const sig = [showColor, showSize, showBg, c.color, c.sizeIdx, c.bg, note, c.types.join()].join('|');
    if (sig === propsSig) return;
    propsSig = sig;

    setHidden(els.swatches, !showColor);
    setHidden(els.customColor, !showColor);
    for (const b of els.swatches.children) setAttr(b, 'aria-checked', String(b.dataset.color === c.color));
    const custom = showColor && c.color && !PALETTE.some(([hex]) => hex === c.color);
    els.customColor.classList.toggle('on', !!custom);
    if (custom) els.customColor.style.setProperty('--c', c.color);
    if (c.color && /^#[0-9a-f]{6}$/i.test(c.color)) els.colorInput.value = c.color.toLowerCase();

    setHidden(els.sizeSeg, !showSize);
    [...els.sizeSeg.children].forEach((b, i) => setAttr(b, 'aria-checked', String(i === c.sizeIdx)));
    setAttr(els.sizeSeg, 'aria-label', c.types.every((t) => t === 'mosaic') ? '格子大小' : '粗細');

    setHidden(els.textBg, !showBg);
    setAttr(els.textBg, 'aria-pressed', String(!!c.bg));
    setText(els.propsNote, note);
  }

  // ── 圖層清單 ──

  function layerLabel(it) {
    if (it.type === 'text') {
      const s = it.text.replace(/\s+/g, ' ').trim();
      return `文字「${s.length > 14 ? `${s.slice(0, 14)}…` : s}」`;
    }
    if (it.type === 'step') return `編號 ${it.n}`;
    if (it.type === 'image') {
      const a = assets.get(it.asset);
      return a ? `圖片 ${a.width}×${a.height}` : '圖片';
    }
    return TYPE_NAME[it.type];
  }

  function icon(name, cls = 'ic') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', cls);
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#i-${name}`);
    svg.append(use);
    return svg;
  }

  function miniButton(cls, iconName, label, on = false) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `mini ${cls}${on ? ' on' : ''}`;
    b.title = label;
    b.setAttribute('aria-label', label);
    b.append(icon(iconName));
    return b;
  }

  let layerSig = '';
  function renderLayers() {
    const items = state.doc.items;
    const sig = items.map((it) => [it.id, layerLabel(it), it.locked ? 1 : 0, state.selection.has(it.id) ? 1 : 0, it.color || ''].join(':')).join('/');
    if (sig === layerSig) return;
    layerSig = sig;
    setText(els.layerCount, items.length ? String(items.length) : '');
    setHidden(els.layersEmpty, items.length > 0);
    const frag = document.createDocumentFragment();
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const li = document.createElement('li');
      li.className = `layer${it.locked ? ' is-locked' : ''}`;
      li.dataset.id = it.id;
      li.draggable = true;
      li.setAttribute('aria-selected', String(state.selection.has(it.id)));
      li.append(icon(it.type));
      if (it.color) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.setProperty('--c', it.color);
        li.append(dot);
      }
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = layerLabel(it);   // 用 textContent，貼上的文字不會被當成 HTML
      li.append(name);
      li.append(miniButton('lock', it.locked ? 'lock' : 'unlock', it.locked ? '解除鎖定' : '鎖定', it.locked));
      li.append(miniButton('del', 'trash', '刪除'));
      frag.append(li);
    }
    els.layerList.replaceChildren(frag);
  }

  function bindLayers() {
    const list = els.layerList;
    list.addEventListener('click', (e) => {
      const li = e.target.closest('.layer');
      if (!li) return;
      const id = li.dataset.id;
      finishTextEdit();
      if (e.target.closest('.del')) { commit(removeItems(state.doc, new Set([id]))); return; }
      if (e.target.closest('.lock')) { toggleLock(new Set([id])); return; }
      if (state.tool !== 'select') setTool('select');
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        const s = new Set(state.selection);
        if (s.has(id)) s.delete(id); else s.add(id);
        setSelection(s);
      } else {
        setSelection(new Set([id]));
      }
    });
    list.addEventListener('pointerover', (e) => {
      const id = e.target.closest('.layer')?.dataset.id ?? null;
      if (id !== state.hoverId) { state.hoverId = id; invalidate(); }
    });
    list.addEventListener('pointerleave', () => { state.hoverId = null; invalidate(); });

    let dragId = null;
    const clearMarks = () => list.querySelectorAll('.drop-before, .drop-after, .dragging')
      .forEach((n) => n.classList.remove('drop-before', 'drop-after', 'dragging'));
    list.addEventListener('dragstart', (e) => {
      const li = e.target.closest('.layer');
      if (!li) return;
      dragId = li.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/x-wb-layer', dragId);
      li.classList.add('dragging');
    });
    list.addEventListener('dragover', (e) => {
      if (!dragId) return;
      const li = e.target.closest('.layer');
      if (!li) return;
      e.preventDefault();
      const r = li.getBoundingClientRect();
      const before = e.clientY < r.top + r.height / 2;
      list.querySelectorAll('.drop-before, .drop-after').forEach((n) => n.classList.remove('drop-before', 'drop-after'));
      li.classList.add(before ? 'drop-before' : 'drop-after');
    });
    list.addEventListener('drop', (e) => {
      if (!dragId) return;
      e.preventDefault();
      const li = e.target.closest('.layer');
      if (li && li.dataset.id !== dragId) moveLayer(dragId, li.dataset.id, li.classList.contains('drop-before'));
      dragId = null;
      clearMarks();
    });
    list.addEventListener('dragend', () => { dragId = null; clearMarks(); });
  }

  // ── 右鍵選單 ──

  function showMenu(x, y, entries) {
    const m = els.menu;
    m.replaceChildren();
    for (const en of entries) {
      if (en === '-') { m.append(document.createElement('hr')); continue; }
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      if (en.danger) b.className = 'danger';
      const label = document.createElement('span');
      label.textContent = en.label;
      b.append(label);
      if (en.keys) {
        const k = document.createElement('span');
        k.className = 'k';
        k.textContent = en.keys;
        b.append(k);
      }
      b.addEventListener('click', () => { hideMenu(); en.run(); });
      m.append(b);
    }
    m.hidden = false;
    const r = m.getBoundingClientRect();
    m.style.left = `${Math.max(8, Math.min(x, window.innerWidth - r.width - 8))}px`;
    m.style.top = `${Math.max(8, Math.min(y, window.innerHeight - r.height - 8))}px`;
    m.querySelector('button')?.focus({ preventScroll: true });
  }

  function hideMenu() {
    if (!els.menu.hidden) els.menu.hidden = true;
  }

  function onContextMenu(e) {
    e.preventDefault();
    if (isEmpty() || gesture) return;
    finishTextEdit();
    const { sx, sy } = screenPoint(e);
    const p = toDoc(sx, sy);
    const hit = pick(p, { deep: true, locked: true });
    const hasSteps = state.doc.items.some((it) => it.type === 'step');
    const entries = [];
    if (hit && !hit.locked) {
      if (!state.selection.has(hit.id)) {
        if (state.tool !== 'select') setTool('select');
        setSelection(new Set([hit.id]));
      }
      const one = singleSelected();
      entries.push(
        { label: '複製一份', keys: `${MOD}+D`, run: duplicateSelection },
        '-',
        { label: '移到最上層', keys: `${MOD}+Shift+]`, run: () => reorder('front') },
        { label: '上移一層', keys: `${MOD}+]`, run: () => reorder('up') },
        { label: '下移一層', keys: `${MOD}+[`, run: () => reorder('down') },
        { label: '移到最下層', keys: `${MOD}+Shift+[`, run: () => reorder('back') },
        '-',
      );
      if (one?.type === 'text') entries.push({ label: '編輯文字', keys: 'Enter', run: () => openEditor(one) });
      entries.push({ label: '鎖定', run: () => toggleLock(state.selection) });
      if (hasSteps) entries.push({ label: '編號重新排成 1、2、3', run: renumberSteps });
      entries.push('-', { label: '刪除', keys: 'Delete', danger: true, run: deleteSelection });
    } else {
      if (hit?.locked) entries.push({ label: `解除鎖定（${TYPE_NAME[hit.type]}）`, run: () => toggleLock(new Set([hit.id])) }, '-');
      entries.push(
        { label: '複製整張圖片', keys: `${MOD}+C`, run: copyImage },
        { label: '下載 PNG', keys: `${MOD}+S`, run: downloadImage },
        '-',
        { label: '全選', keys: `${MOD}+A`, run: selectAll },
        { label: '符合視窗', keys: `${MOD}+0`, run: fitView },
        { label: '實際大小 100%', keys: 'Shift+0', run: () => zoomCenter(1) },
      );
      if (hasSteps) entries.push('-', { label: '編號重新排成 1、2、3', run: renumberSteps });
    }
    showMenu(e.clientX, e.clientY, entries);
  }

  function onMenuKey(e) {
    const btns = [...els.menu.querySelectorAll('button')];
    const i = btns.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); hideMenu(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length]?.focus(); }
    e.stopPropagation();
  }

  // ── 提示訊息 ──

  let toastTimer = 0;
  function hideToast() { els.toast.hidden = true; }
  function toast(msg, action) {
    const t = els.toast;
    t.replaceChildren();
    const span = document.createElement('span');
    span.textContent = msg;
    t.append(span);
    if (action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = action.label;
      b.addEventListener('click', () => { hideToast(); action.run(); });
      t.append(b);
    }
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? 6000 : 2600);
  }

  // ── 偏好設定（只存工具樣式與面板開關，不存圖片） ──

  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      for (const [tool, v] of Object.entries(saved.toolStyle || {})) {
        const st = toolStyle[tool];
        if (!st || !v) continue;
        if ('color' in st && /^#[0-9a-f]{6}$/i.test(v.color)) st.color = v.color.toUpperCase();
        if ('size' in st && [0, 1, 2].includes(v.size)) st.size = v.size;
        if ('bg' in st && typeof v.bg === 'boolean') st.bg = v.bg;
      }
      return saved;
    } catch {
      return {};
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ toolStyle, tool: state.tool, layers: !els.layers.hidden }));
    } catch { /* 隱私模式等情況，不影響使用 */ }
  }

  // ═══════════════════════ 13. 啟動 ═══════════════════════

  function bindEvents() {
    // 工具列的按鈕不搶焦點：點完按鈕後，快捷鍵和空白鍵平移照樣能用
    document.addEventListener('mousedown', (e) => {
      if (e.target instanceof Element && e.target.closest('button') && !e.target.closest('dialog')) e.preventDefault();
    });

    els.toolButtons.forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
    els.undo.addEventListener('click', undo);
    els.redo.addEventListener('click', redo);
    els.open.addEventListener('click', () => els.fileInput.click());
    els.emptyOpen.addEventListener('click', () => els.fileInput.click());
    els.emptyBlank.addEventListener('click', newBlank);
    els.clear.addEventListener('click', clearAll);
    els.download.addEventListener('click', downloadImage);
    els.copy.addEventListener('click', copyImage);
    els.helpBtn.addEventListener('click', openHelp);
    els.layersToggle.addEventListener('click', () => { els.layers.hidden = !els.layers.hidden; savePrefs(); invalidate(); });
    els.zoomIn.addEventListener('click', () => zoomCenter(state.view.zoom * 1.25));
    els.zoomOut.addEventListener('click', () => zoomCenter(state.view.zoom / 1.25));
    els.zoomLabel.addEventListener('click', fitView);

    for (const [hex, name] of PALETTE) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.dataset.color = hex;
      b.title = name;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', name);
      b.style.setProperty('--c', hex);
      b.addEventListener('click', () => setColor(hex));
      els.swatches.append(b);
    }
    els.colorInput.addEventListener('input', () => setColor(els.colorInput.value.toUpperCase()));
    [...els.sizeSeg.children].forEach((b, i) => b.addEventListener('click', () => setSize(i)));
    els.textBg.addEventListener('click', toggleTextBg);

    view.addEventListener('pointerdown', onPointerDown);
    view.addEventListener('pointermove', onPointerMove);
    view.addEventListener('pointerup', onPointerUp);
    view.addEventListener('pointercancel', cancelGesture);
    view.addEventListener('lostpointercapture', (e) => { if (gesture && e.pointerId === gesture.pointerId) onPointerUp(e); });
    view.addEventListener('pointerleave', () => {
      if (!gesture && (state.hoverId || state.hoverHandle)) { state.hoverId = null; state.hoverHandle = null; invalidate(); }
    });
    view.addEventListener('dblclick', (e) => {
      const { sx, sy } = screenPoint(e);
      const t = pick(toDoc(sx, sy), { types: ['text'] });
      if (t && !state.editing) openEditor(t);
    });
    view.addEventListener('contextmenu', onContextMenu);

    els.viewport.addEventListener('wheel', (e) => {
      if (isEmpty()) return;
      e.preventDefault();
      hideMenu();
      const { sx, sy } = screenPoint(e);
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? els.viewport.clientHeight : 1;
      if (e.ctrlKey || e.metaKey) {
        zoomAt(state.view.zoom * Math.exp(-e.deltaY * k * 0.0025), sx, sy);
      } else {
        const dx = e.deltaX || (e.shiftKey ? e.deltaY : 0);
        const dy = e.shiftKey ? 0 : e.deltaY;
        setView(state.view.zoom, state.view.x - dx * k, state.view.y - dy * k);
      }
    }, { passive: false });

    els.editor.addEventListener('input', () => layoutEditor());
    els.editor.addEventListener('keydown', (e) => {
      e.stopPropagation();   // 打字時不要觸發工具快捷鍵
      if (e.isComposing || e.keyCode === 229) return;   // 注音選字中，Esc 交給輸入法
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        finishTextEdit();
      }
    });
    // 切到別的視窗時不結束輸入；只有在頁面內點別處才結束
    els.editor.addEventListener('blur', () => { if (document.hasFocus()) finishTextEdit(); });

    els.menu.addEventListener('keydown', onMenuKey);
    document.addEventListener('pointerdown', (e) => { if (!els.menu.contains(e.target)) hideMenu(); }, true);
    window.addEventListener('resize', hideMenu);
    window.addEventListener('blur', () => { hideMenu(); state.spaceDown = false; });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    document.addEventListener('paste', (e) => {
      if (isTyping(e.target)) return;   // 文字編輯中：讓瀏覽器照常貼上文字
      const dt = e.clipboardData;
      if (!dt) return;
      const item = [...dt.items].find((i) => i.kind === 'file' && i.type.startsWith('image/'));
      const file = item?.getAsFile() || [...dt.files].find((f) => f.type.startsWith('image/'));
      if (file) { e.preventDefault(); importImage(file); return; }
      const text = dt.getData('text/plain');
      if (text && !isEmpty()) {
        // 貼上純文字：直接變成畫面中央的一段文字
        e.preventDefault();
        finishTextEdit();
        const st = toolStyle.text;
        const c = clampToDoc(toDoc(els.viewport.clientWidth / 2, els.viewport.clientHeight / 2), 8);
        const it = {
          id: uid(), type: 'text', x: Math.round(c.x), y: Math.round(c.y),
          text: text.slice(0, 2000).replace(/\r\n?/g, '\n'), color: st.color, size: sizeValue('text', st.size, state.doc), bg: st.bg,
        };
        commit(addItems(state.doc, it));
        if (state.tool !== 'select') setTool('select');
        setSelection(new Set([it.id]));
      }
    });

    let dragDepth = 0;
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    document.addEventListener('dragenter', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth += 1;
      els.drop.hidden = false;
    });
    document.addEventListener('dragleave', (e) => {
      if (!hasFiles(e)) return;
      dragDepth -= 1;
      if (dragDepth <= 0) { dragDepth = 0; els.drop.hidden = true; }
    });
    document.addEventListener('dragover', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    document.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth = 0;
      els.drop.hidden = true;
      const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/'));
      if (f) importImage(f);
      else toast('這不是圖片檔。請拖曳 PNG、JPG 或 WebP。');
    });

    els.fileInput.addEventListener('change', () => {
      const f = els.fileInput.files[0];
      if (f) importImage(f);
      els.fileInput.value = '';
    });

    window.addEventListener('beforeunload', (e) => {
      if (!isEmpty() && state.doc !== state.exportedDoc && history.past.length) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    new ResizeObserver(resizeViewCanvas).observe(els.viewport);
    const watchDpr = () => {
      matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
        .addEventListener('change', () => { resizeViewCanvas(); watchDpr(); }, { once: true });
    };
    watchDpr();
  }

  function localizeModKeys() {
    if (!IS_MAC) return;
    document.querySelectorAll('[data-mod]').forEach((el) => { el.textContent = '⌘'; });
    document.querySelectorAll('[title*="Ctrl"]').forEach((el) => { el.title = el.title.replace(/Ctrl\+?/g, '⌘'); });
  }

  const prefs = loadPrefs();
  if (prefs.tool && TOOLS[prefs.tool] && prefs.tool !== 'crop') state.tool = prefs.tool;
  if (prefs.layers === false || (prefs.layers === undefined && window.innerWidth < 900)) els.layers.hidden = true;
  localizeModKeys();
  bindLayers();
  bindEvents();
  resizeViewCanvas();

  // ── 對外 API：讓客服系統可以預先帶入截圖，或自動上傳成品 ──
  window.Whiteboard = Object.freeze({
    importImage: (blob) => importImage(blob),
    toBlob: () => (isEmpty() ? Promise.resolve(null) : canvasToBlob(exportCanvas(state.doc))),
    getDoc: () => state.doc,
    clear: clearAll,
    undo,
    redo,
    setTool,
  });
})();
