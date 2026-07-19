import { CSPANEL_API } from './cspanel-api.js';
import { authFetch, readApiError } from './auth-fetch.js';

// 分頁視窗管理器實例（第三期，子專案 B）：tabsHTML 注入完成後接管，登出時拆除。
let windowManager = null;
// 再進入/併發防護（第三期，審查 #1）。
let initInFlight = false;
let diaryBridgeListener = null;

const DIARY_CHILD_ORIGIN = 'https://stirring-pothos-28253d.netlify.app';
const DIARY_CHILD_PATH = '/hhnueyfrsoj1na8pjj.html';
const DIARY_COURSE_ID_RE = /^[0-9a-fA-F]{24}$/;
const DIARY_NONCE_RE = /^[A-Za-z0-9_-]{16,128}$/;
const DIARY_RATE_WINDOW_MS = 60_000;
const DIARY_RATE_LIMIT = 10;
const diaryRequestsBySource = new WeakMap();

export async function initProtectedTabs() {
  // 登入事件與 canvas 的漏接補位可能在同一時刻收斂到此處；用 in-flight 旗標
  // 保證 innerHTML/import/mount 只執行一輪。登出後再登入屬循序重入，不受影響。
  if (initInFlight) {
    console.log('initProtectedTabs 已在進行中，略過重入');
    return;
  }
  initInFlight = true;
  try {
    const tabsPlaceholder = document.getElementById('auth-protected-tabs-placeholder');
    const ipPlaceholder = document.getElementById('auth-protected-ip-placeholder');

    // Session boot 已先決定可見模組；每個 API request 再由 gateway 即時仲裁。
    await fetchProtectedContent();
  } finally {
    initInFlight = false;
  }
}

export function clearProtectedTabs() {
  const tabsPlaceholder = document.getElementById('auth-protected-tabs-placeholder');
  const ipPlaceholder = document.getElementById('auth-protected-ip-placeholder');

  if (diaryBridgeListener) {
    window.removeEventListener('message', diaryBridgeListener);
    diaryBridgeListener = null;
  }

  // 1. 拆除分頁視窗管理器（移除全域 pointer/scroll/resize 監聽與常駐池/視窗層），
  //    再清空 UI。順序：先 destroy（收監聽器）→ 後清 DOM（innerHTML 會一併移除
  //    池/視窗，iframe 於登出被銷毀屬預期）。
  if (windowManager) {
    try { windowManager.destroy(); } catch (e) { console.error('視窗管理器 destroy 失敗:', e); }
    windowManager = null;
  }

  // 2. 清空 UI
  if (tabsPlaceholder) tabsPlaceholder.innerHTML = '';
  if (ipPlaceholder) ipPlaceholder.innerHTML = '';
}

// Liquid Glass：伺服器注入內容（tabsHTML/ipHTML）注入後補上 class，供 panels.css 的 .gl-injected 樣式套用
function glDecorate(container) {
  if (!container) return;
  container.classList.add('gl-injected');
  container.querySelectorAll('table').forEach((table) => {
    table.classList.add('gl-table');
  });
}

function isDiaryUrl(value) {
  try {
    const url = new URL(value, DIARY_CHILD_ORIGIN);
    return url.origin === DIARY_CHILD_ORIGIN && url.pathname === DIARY_CHILD_PATH;
  } catch {
    return false;
  }
}

function filterDiaryTab(container) {
  if (!container) return;

  container.querySelectorAll('iframe[src]').forEach((iframe) => {
    if (!isDiaryUrl(iframe.getAttribute('src'))) return;

    const content = iframe.closest('.panel-tab-content');
    const label = content?.previousElementSibling;
    const input = label?.previousElementSibling;
    const isMatchedTab = label?.tagName === 'LABEL'
      && input?.tagName === 'INPUT'
      && input.type === 'radio'
      && label.htmlFor === input.id;

    content?.remove();
    if (isMatchedTab) {
      label.remove();
      input.remove();
    }
  });

  const firstRemainingTab = container.querySelector('.panel-tabs input[type="radio"]');
  if (firstRemainingTab && !container.querySelector('.panel-tabs input[type="radio"]:checked')) {
    firstRemainingTab.checked = true;
  }
}

function createTabsStaging(tabsHTML, canReadCourseDiaries, lazyIframes = false) {
  const staging = document.createElement('div');
  staging.innerHTML = tabsHTML;
  if (canReadCourseDiaries !== true) filterDiaryTab(staging);
  // 第十期（v2 惰性掛載）：src→data-src 摘除必須在 staging 接進 live DOM「之前」
  // 完成（detached 節點的 iframe 不會載入），且必須在 filterDiaryTab「之後」
  // （它依 iframe[src] 判別課程日誌 tab）。首次切到該 tab 時由 window-manager
  // syncPanes 回填 src——「零重載鐵律」語意不變，只是首載從登入瞬間延到首次可見。
  // v1 與降級路徑不傳 lazyIframes，行為逐位元不變。
  if (lazyIframes) {
    staging.querySelectorAll('iframe[src]').forEach((iframe) => {
      iframe.dataset.src = iframe.getAttribute('src');
      iframe.removeAttribute('src');
    });
  }
  return staging;
}

function findDiaryIframeForSource(source) {
  const tabsPlaceholder = document.getElementById('auth-protected-tabs-placeholder');
  if (!tabsPlaceholder || !source) return null;

  return Array.from(tabsPlaceholder.querySelectorAll('iframe[src]')).find((iframe) => (
    iframe.contentWindow === source && isDiaryUrl(iframe.getAttribute('src'))
  )) || null;
}

function consumeDiaryRateLimit(source, nonce) {
  const now = Date.now();
  const previous = diaryRequestsBySource.get(source) || { timestamps: [], nonces: new Set() };
  previous.timestamps = previous.timestamps.filter((timestamp) => now - timestamp < DIARY_RATE_WINDOW_MS);

  if (previous.nonces.has(nonce) || previous.timestamps.length >= DIARY_RATE_LIMIT) {
    diaryRequestsBySource.set(source, previous);
    return false;
  }

  previous.timestamps.push(now);
  previous.nonces.add(nonce);
  if (previous.nonces.size > 100) {
    previous.nonces.delete(previous.nonces.values().next().value);
  }
  diaryRequestsBySource.set(source, previous);
  return true;
}

function installDiaryBridge() {
  if (diaryBridgeListener) {
    window.removeEventListener('message', diaryBridgeListener);
  }

  diaryBridgeListener = async (event) => {
    if (event.origin !== DIARY_CHILD_ORIGIN) return;
    const message = event.data;
    if (!message || message.type !== 'cspanel:diary-request') return;
    if (!findDiaryIframeForSource(event.source)) return;

    const nonce = typeof message.nonce === 'string' ? message.nonce : '';
    const courseId = typeof message.courseId === 'string' ? message.courseId.trim() : '';
    const reply = (payload) => event.source?.postMessage?.({
      type: 'cspanel:diary-response',
      nonce,
      courseId,
      ...payload
    }, DIARY_CHILD_ORIGIN);

    if (!DIARY_NONCE_RE.test(nonce) || !DIARY_COURSE_ID_RE.test(courseId)) {
      reply({ ok: false, error: { code: 'INVALID_REQUEST', message: '請求格式無效', requestId: '' } });
      return;
    }
    if (!consumeDiaryRateLimit(event.source, nonce)) {
      reply({ ok: false, error: { code: 'RATE_LIMITED', message: '請求過於頻繁', requestId: '' } });
      return;
    }

    try {
      const response = await authFetch(CSPANEL_API.courseDiaries, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId })
      });
      if (!response.ok) {
        const apiError = await readApiError(response);
        reply({
          ok: false,
          error: {
            code: apiError.code,
            message: apiError.message,
            requestId: apiError.requestId
          }
        });
        return;
      }
      reply({ ok: true, data: await response.json() });
    } catch (error) {
      reply({
        ok: false,
        error: {
          code: error?.code || 'DIARY_REQUEST_FAILED',
          message: error?.code === 'AUTH_REQUIRED' ? '請先登入再查詢' : '課程日誌查詢失敗',
          requestId: ''
        }
      });
    }
  };

  window.addEventListener('message', diaryBridgeListener);
}

async function fetchProtectedContent() {
      const response = await authFetch(CSPANEL_API.orderTool, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getProtectedTabs' })
      });

      if (!response.ok) {
        const apiError = await readApiError(response);
        const requestSuffix = apiError.requestId ? ` (requestId: ${apiError.requestId})` : '';
        const error = new Error(`[${apiError.code}] ${apiError.message}${requestSuffix}`);
        error.status = apiError.status;
        error.code = apiError.code;
        throw error;
      }
      const data = await response.json();

      if (data && data.success) {
        const tabsPlaceholder = document.getElementById('auth-protected-tabs-placeholder');
        const ipPlaceholder = document.getElementById('auth-protected-ip-placeholder');

        if (tabsPlaceholder && data.tabsHTML) {
          const engineV2 = typeof window !== 'undefined' && !!window.CSPANEL_ENGINE_V2;
          if (engineV2) {
            // 九期B 終審 C1/I1 修復：v2 模式下 wm 核心的視窗層（layer）與常駐池
            // （pool，含所有 iframe）都住在 tabsPlaceholder「裡面」（mountWindowManager
            // 的 host 即本 placeholder，且核心已由 canvas-engine 在 initAllModules
            // 的 await Promise.allSettled 之「前」掛妥——本函式屬該等待集，執行至
            // 此核心必已存在）。因此 v2 絕不可 `innerHTML = data.tabsHTML` 覆寫
            // host——第一輪會殺掉剛掛載核心的 layer（render 從此畫進 detached
            // 節點，分頁整組不可見）；重複登入生命週期訊號各觸發一輪
            // initAllModules 時，第二輪更會
            // 連 pool 帶 iframe 一起銷毀，而 adoptTabs 是冪等設計（同 id 略過）
            // 不會重建，iframe 一旦被摧毀也沒有任何「重新收養」能免重載救回
            // （違反 iframe 零重載鐵律）——唯一正確修法是「防止覆寫」而非「事後
            // 自癒」。改法：tabsHTML 解析進 staging「子節點」（appendChild 不動
            // 同住 host 的 layer/pool），.panel-tabs-container 是 absolute 定位、
            // containing block 仍是 .panel_all_container，adoptTabs 內
            // readContainerRect 量到與 v1 注入完全相同的預設幾何；iframe 在
            // staging 開始載入、由 adoptTabs 一次性搬進常駐池（與 v1「唯一一次
            // DOM 移動免費」同一形狀），容器本身由 adoptTabs 丟棄、staging 隨後
            // 同步移除（同一 JS turn，無中間繪製）。
            // 已認養（hasTabs）時整段跳過：本輪是同一 session 的重複注入（tab 集
            // 合 per-session 穩定；真正的新集合來自登出→再登入，該路徑經
            // clearProtectedTabs 清空 host、clearAllModules 銷毀核心，下一輪
            // hasTabs() 為 false 照常注入），跳過可免解析/丟棄一份多餘 DOM。
            const wm = window.WindowManager;
            if (wm && typeof wm.adoptTabs === 'function') {
              if (typeof wm.hasTabs === 'function' && wm.hasTabs()) {
                console.log('WindowManager 已認養 iframe tabs，跳過本輪 tabsHTML 注入（保護常駐池/視窗層）');
              } else {
                const staging = createTabsStaging(data.tabsHTML, data.canReadCourseDiaries, true);
                tabsPlaceholder.appendChild(staging);
                // host 補 .gl-injected（池中內容依 .gl-injected 後代規則取色）＋
                // staging 內 tables 標 .gl-table（class 跟著內容搬進池）。
                glDecorate(tabsPlaceholder);
                try {
                  wm.adoptTabs(staging.querySelector('.panel-tabs-container'));
                } catch (error) {
                  console.error('❌ 分頁視窗管理器認養失敗:', error);
                } finally {
                  staging.remove();
                }
              }
            } else {
              // 理論不可達（C1 時序契約：核心先掛）。原 fallback「單段裸 mount」
              // 不可保留——裸 mount 不帶 canvasId/pageHost/isPageId opts，會讓
              // loadWindows 淨化掉全部 'pg:' tab（page 視窗存檔於下一次 persist
              // 永久丟失）、page tab 淪為裸 id、成員定位失效，比「不接管」破壞
              // 性更大。降級：console.error＋直接注入保留伺服器原生 tab 可見
              // （此路徑 host 內必無 layer/pool，innerHTML 無誤傷對象）。
              console.error('❌ WindowManager 核心未掛載（v2 時序契約違反，見 canvas-engine.js initAllModules C1 註解）：略過認養，注入伺服器原生 tab 降級顯示');
              const staging = createTabsStaging(data.tabsHTML, data.canReadCourseDiaries);
              tabsPlaceholder.replaceChildren(...staging.childNodes);
              glDecorate(tabsPlaceholder);
            }
          } else {
            // v1 模式（旗標未設）：呼叫形狀與行為逐位元不變。
            const staging = createTabsStaging(data.tabsHTML, data.canReadCourseDiaries);
            tabsPlaceholder.replaceChildren(...staging.childNodes);
            glDecorate(tabsPlaceholder);
            // 交棒分頁視窗管理器：把 .panel-tabs-container 的四個 tab 內容一次性
            // 搬進常駐池、丟棄伺服器 tab chrome、改渲染 Chrome 式可拖/可縮放視窗
            // （見 window-manager.js）。此刻 iframe 本就在載入，唯一一次 DOM 移動免費。
            try {
              const { mountWindowManager } = await import('./window-manager.js');
              if (windowManager) { windowManager.destroy(); windowManager = null; }
              windowManager = mountWindowManager(tabsPlaceholder);
            } catch (error) {
              console.error('❌ 分頁視窗管理器掛載失敗（保留伺服器原生 tab）:', error);
            }
          }

          if (data.canReadCourseDiaries === true) {
            installDiaryBridge();
          } else if (diaryBridgeListener) {
            window.removeEventListener('message', diaryBridgeListener);
            diaryBridgeListener = null;
          }
        }

        if (ipPlaceholder && data.ipHTML) {
          ipPlaceholder.innerHTML = data.ipHTML;
          glDecorate(ipPlaceholder);
          try {
            const { initIPSearch } = await import('./IP_search.js');
            await initIPSearch();
          } catch (error) {
            console.error('❌ Failed to initialize IP search:', error);
          }
        }
      }

      return data;
}
