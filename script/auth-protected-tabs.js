import { CSPANEL_API } from './cspanel-api.js';

// 內部變數，用於儲存 interceptor 引用以便移除
let currentInterceptor = null;
// 分頁視窗管理器實例（第三期，子專案 B）：tabsHTML 注入完成後接管，登出時拆除。
let windowManager = null;

export async function initProtectedTabs() {
  const tabsPlaceholder = document.getElementById('auth-protected-tabs-placeholder');
  const ipPlaceholder = document.getElementById('auth-protected-ip-placeholder');

  // ===== 1. 注入點擊攔截器 (關鍵功能) =====
  // 使用 capture: true 確保在子元素事件觸發前先執行
  const interceptor = async (e) => {
    // 檢查 window.verifyFireworkAuth 是否存在 (可能 fireworkeffect 還沒載入完，雖不常見)
    if (typeof window.verifyFireworkAuth === 'function') {
      const isValid = await window.verifyFireworkAuth();
      if (!isValid) {
        // 驗證失敗：阻止事件傳播，並阻止默認行為
        e.preventDefault();
        e.stopPropagation();
        console.log('⛔ 操作被攔截：Token 無效');
        // verifyFireworkAuth 內部已經觸發了 firework-force-logout
        return;
      }
    }
  };
  
  // 儲存引用以便 destroy 時移除
  currentInterceptor = interceptor;

  // 移除舊的監聽器避免重複 (如果有的話)，然後添加新的
  if (tabsPlaceholder) {
    tabsPlaceholder.removeEventListener('click', interceptor, true);
    tabsPlaceholder.addEventListener('click', interceptor, true);
  }
  if (ipPlaceholder) {
    ipPlaceholder.removeEventListener('click', interceptor, true);
    ipPlaceholder.addEventListener('click', interceptor, true);
  }

  // ===== 2. 內容獲取邏輯 (含重試與強制登出) =====
  await fetchProtectedContentWithRetry();
}

export function clearProtectedTabs() {
  const tabsPlaceholder = document.getElementById('auth-protected-tabs-placeholder');
  const ipPlaceholder = document.getElementById('auth-protected-ip-placeholder');

  // 1. 移除監聽器
  if (currentInterceptor) {
    if (tabsPlaceholder) tabsPlaceholder.removeEventListener('click', currentInterceptor, true);
    if (ipPlaceholder) ipPlaceholder.removeEventListener('click', currentInterceptor, true);
    currentInterceptor = null;
  }

  // 2. 拆除分頁視窗管理器（移除全域 pointer/scroll/resize 監聽與常駐池/視窗層），
  //    再清空 UI。順序：先 destroy（收監聽器）→ 後清 DOM（innerHTML 會一併移除
  //    池/視窗，iframe 於登出被銷毀屬預期）。
  if (windowManager) {
    try { windowManager.destroy(); } catch (e) { console.error('視窗管理器 destroy 失敗:', e); }
    windowManager = null;
  }

  // 3. 清空 UI
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

// 內部輔助函式保持不變
async function fetchProtectedContentWithRetry(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      // 直接使用 verifyFireworkAuth 來確保 token 是最新的
      // 注意：這裡不強制阻斷，因為這是背景獲取，若失敗會進 catch
      const user = window.firebase?.auth()?.currentUser;
      if (!user) throw new Error('No user');
      
      const token = await user.getIdToken(); 

      const response = await fetch(CSPANEL_API.orderTool, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'getProtectedTabs' })
      });

      if (response.status === 401 || response.status === 403) {
        // 若 API 回傳 401，嘗試刷新 Token
        if (i < retries - 1) {
           await user.getIdToken(true); // 強制刷新
           continue;
        } else {
           // 重試耗盡仍 401，視為 Token 失效，觸發全域登出
           throw new Error('AUTH_FAILED');
        }
      }

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      if (data && data.success) {
        const tabsPlaceholder = document.getElementById('auth-protected-tabs-placeholder');
        const ipPlaceholder = document.getElementById('auth-protected-ip-placeholder');

        if (tabsPlaceholder && data.tabsHTML) {
          tabsPlaceholder.innerHTML = data.tabsHTML;
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

    } catch (error) {
      if (error.message === 'AUTH_FAILED') {
         console.error('❌ 認證徹底失敗，執行強制登出');
         window.dispatchEvent(new Event('firework-force-logout'));
         return null;
      }
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
