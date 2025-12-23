/**
 * UI Conductor - 視覺狀態轉場控制器 (Refactored)
 * 特性：遮罩層管理、Promise 異步流控
 * 注意：背景樣式已移至 panel-all.css，避免閃爍
 */

// 0. 立即檢查是否有 token，若有則預先升起遮罩（防止閃爍）
(function immediateOverlayCheck() {
  const token = localStorage.getItem('firebase_id_token');
  if (token) {
    // 立即建立遮罩並啟用，不等 DOM 完成
    const style = document.createElement('style');
    style.id = 'ui-conductor-immediate-overlay';
    style.textContent = `
      body::before {
        content: '';
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: #ffffff;
        z-index: 9998;
        pointer-events: all;
      }
    `;
    document.head.appendChild(style);
    console.log('🎬 UI Conductor: 偵測到 Token，預先遮罩已啟用');
  }
})();

// 1. 初始化遮罩層 (自執行)
(function initUIInfrastructure() {
  const css = `
    /* 遮罩層樣式 */
    #ui-transition-overlay {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: #ffffff;
      z-index: 9999;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    #ui-transition-overlay.active {
      pointer-events: all;
      opacity: 1;
    }

    .loading-spinner {
      width: 40px; height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      display: none;
    }
    #ui-transition-overlay.active .loading-spinner {
      display: block;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  if (!document.getElementById('ui-transition-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'ui-transition-overlay';
    overlay.innerHTML = '<div class="loading-spinner"></div>';
    
    // 如果有 token，預設遮罩為 active 狀態
    const token = localStorage.getItem('firebase_id_token');
    if (token) {
      overlay.classList.add('active');
    }
    
    document.body.appendChild(overlay);
  }
  
  // 移除預先遮罩（因為真正的 overlay 已經就位）
  const immediateStyle = document.getElementById('ui-conductor-immediate-overlay');
  if (immediateStyle) {
    immediateStyle.remove();
  }
})();

// ===== 核心動畫控制器 =====
const overlay = document.getElementById('ui-transition-overlay');

function waitTransition(element, minWaitMs = 300) {
  return new Promise(resolve => {
    let resolved = false;
    const handler = (e) => {
      if (e.target !== element) return;
      element.removeEventListener('transitionend', handler);
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };
    element.addEventListener('transitionend', handler);
    
    setTimeout(() => {
      element.removeEventListener('transitionend', handler);
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }, minWaitMs + 100);
  });
}

function waitForBackgroundTransition(duration = 800) {
  return new Promise(resolve => setTimeout(resolve, duration));
}

// ===== 動作定義 =====

async function playLoginTransition() {
  console.log('🎬 UI Conductor: 升起遮罩 (Login Start)');
  
  overlay.classList.add('active');
  await waitTransition(overlay, 400); 
  
  // 同時為 html 和 body 加上 auth-active
  document.documentElement.classList.add('auth-active');
  document.body.classList.add('auth-active');
}

async function playLogoutTransition() {
  console.log('🎬 UI Conductor: 升起遮罩 (Logout Start)');
  overlay.classList.add('active');
  await waitTransition(overlay, 400);
  
  // 同時移除 html 和 body 的 auth-active
  document.documentElement.classList.remove('auth-active');
  document.body.classList.remove('auth-active');
}

function revealContent() {
  console.log('🎬 UI Conductor: 降下遮罩 (Ready)');
  
  requestAnimationFrame(() => {
    setTimeout(() => {
      overlay.classList.remove('active');
    }, 100);
  });
}

async function finalizeLogout() {
  console.log('🎬 UI Conductor: 等待背景過渡完成 (Logout Finalizing)');
  
  await waitForBackgroundTransition(800);
  
  console.log('🎬 UI Conductor: 降下遮罩 (Logout Complete)');
  
  requestAnimationFrame(() => {
    setTimeout(() => {
      overlay.classList.remove('active');
    }, 100);
  });
}

// ===== 輔助功能 =====
function clearAutofilledInputs() {
  requestAnimationFrame(() => {
    const containers = [
      'meeting-search-panel-placeholder',
      'optitle-placeholder',
      'fudausearch-placeholder',
      'shrturl-placeholder',
      'dt-panel-placeholder',
      'consultant-panel-placeholder',
      'assist-panel-placeholder'
    ];
    
    containers.forEach(containerId => {
      const container = document.getElementById(containerId);
      if (container) {
        const inputs = container.querySelectorAll('input[type="search"], input[type="text"]:not([type="date"])');
        inputs.forEach(input => {
          input.value = '';
          input.setAttribute('autocomplete', 'off');
          input.setAttribute('name', 'field_' + Math.random().toString(36).substring(7));
        });
      }
    });
    console.log('🧹 UI Conductor: 已清除自動填入');
  });
}

// ===== 事件監聯 =====
window.addEventListener('fw-auth-state-change', async (e) => {
  const { state } = e.detail;
  
  switch (state) {
    case 'login-start':
      await playLoginTransition();
      break;
      
    case 'login-ready':
      clearAutofilledInputs();
      revealContent();
      break;
      
    case 'logout-start':
      await playLogoutTransition();
      break;
      
    case 'logout-complete':
      await finalizeLogout();
      break;
      
    case 'init-logged-out':
      // 初始狀態，確保沒有 auth class
      document.documentElement.classList.remove('auth-active');
      document.body.classList.remove('auth-active');
      break;
  }
});

console.log('🎭 UI Conductor: 已載入 (Animation Enabled)');