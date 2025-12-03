/**
 * UI Conductor Enhanced - 視覺狀態轉場控制器 (Optimized Edition)
 * 修正：移除高消耗濾鏡、移除邏輯死鎖、優化即時響應
 * 特性：保留粒子與流體效果，但確保 V1 等級的穩健性
 */

// ===== 配置常量 =====
const UI_CONFIG = {
  timing: {
    overlayFade: 400,    // 加快淡入淡出
    contentReveal: 600,
    staggerDelay: 50,    // 減少錯落延遲
    rippleDuration: 800,
  },
  easing: {
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  },
  effects: {
    enableParticles: true,
    enableRipple: true,
    particleCount: 8,    // 減少粒子數量以提升效能
  }
};

// 定義統一的背景樣式，確保預先遮罩與正式遮罩無縫接軌
const OVERLAY_BACKGROUND = 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)';

// ===== 0. 立即預遮罩 (Fail-safe: 防止閃爍) =====
(function immediateOverlayCheck() {
  const token = localStorage.getItem('firebase_id_token');
  if (token) {
    const style = document.createElement('style');
    style.id = 'ui-conductor-immediate-overlay';
    style.textContent = `
      body::before {
        content: '';
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: ${OVERLAY_BACKGROUND};
        z-index: 9998;
        pointer-events: all;
      }
    `;
    document.head.appendChild(style);
    console.log('🎬 UI Conductor: 預先遮罩已啟用');
  }
})();

// ===== 1. 初始化基礎設施 =====
(function initUIInfrastructure() {
  const css = `
    /* ===== 主遮罩層 ===== */
    #ui-transition-overlay {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      z-index: 9999;
      pointer-events: none;
      opacity: 0;
      transition: opacity ${UI_CONFIG.timing.overlayFade}ms ${UI_CONFIG.easing.smooth};
      overflow: hidden;
      background: ${OVERLAY_BACKGROUND}; /* 確保與預先遮罩一致 */
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    #ui-transition-overlay.active {
      pointer-events: all;
      opacity: 1;
    }

    /* ===== 裝飾背景 (使用絕對定位，不影響佈局) ===== */
    .ui-overlay-decoration {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none;
      z-index: 0;
    }

    .ui-overlay-gradient {
      position: absolute;
      width: 100%; height: 100%;
      background: 
        radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.05) 0%, transparent 40%),
        radial-gradient(circle at 80% 80%, rgba(236, 72, 153, 0.05) 0%, transparent 40%);
    }

    /* ===== 載入容器 ===== */
    .ui-loader-container {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transform: scale(0.9);
      opacity: 0;
      transition: all 0.3s ease;
    }

    #ui-transition-overlay.active .ui-loader-container {
      opacity: 1;
      transform: scale(1);
    }

    /* Hollywood "Elastic Beam" Spinner (SVG Based) */
    .ui-spinner {
      width: 50px; height: 50px;
      /* 讓整個 SVG 容器也帶有緩慢的自轉，增加不確定性 */
      animation: container-rotate 3s linear infinite;
      
      /* * 濾鏡：這是電影質感的核心
       * drop-shadow 比 box-shadow 更精準，它會跟隨 SVG 的路徑形狀發光
       */
      filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.5));
    }

    /* 軌道層設定 */
    .path-track {
      stroke: rgba(59, 130, 246, 0.1);
      /* 確保圓角，看起來更現代 */
      stroke-linecap: round; 
    }

    /* 核心層設定 */
    .path-core {
      stroke: #3b82f6;
      stroke-linecap: round;
      
      /* * 關鍵魔法：
       * 1. stroke-dasharray: 1, 200 -> 定義線條的「實線」與「虛線」長度
       * 2. stroke-dashoffset: 0 -> 定義線條的起始偏移量
       * 透過這兩個數值的交互動畫，創造出「毛毛蟲蠕動」般的伸縮感
       */
      animation: dash-morph 1.8s ease-in-out infinite;
    }

    /* * 動畫邏輯：
     * 這是 Google Material Design 的改良版曲線
     * 它同時控制「旋轉」與「長度」，模擬出類似「呼吸」的節奏
     */
    @keyframes dash-morph {
      0% {
        stroke-dasharray: 1, 200; /* 極短 */
        stroke-dashoffset: 0;
      }
      50% {
        stroke-dasharray: 89, 200; /* 拉長至約 70% 圓周 */
        stroke-dashoffset: -35px;  /* 稍微移動頭部 */
      }
      100% {
        stroke-dasharray: 89, 200; /* 保持長度 */
        stroke-dashoffset: -124px; /* 快速將尾巴收回，完成一圈 */
      }
    }

    /* 容器輔助旋轉：防止伸縮動畫看起來太規律 */
    @keyframes container-rotate {
      100% { transform: rotate(360deg); }
    }

    /* ===== 粒子系統 ===== */
    .ui-particle {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      opacity: 0;
      background: rgba(59, 130, 246, 0.2);
    }
    
    .ui-particle.floating {
      animation: floatUp var(--duration) ease-in infinite;
    }

    @keyframes floatUp {
      0% { transform: translateY(0) scale(0.8); opacity: 0; }
      20% { opacity: 0.5; }
      100% { transform: translateY(-100px) scale(1.2); opacity: 0; }
    }

    /* ===== 內容揭示動畫 ===== */
    .ui-reveal-item {
      opacity: 0;
      transform: translateY(15px);
      transition: opacity 0.5s ease, transform 0.5s ease;
    }

    .ui-reveal-item.revealed {
      opacity: 1;
      transform: translateY(0);
    }

    /* ===== 狀態文字 ===== */
    .ui-status-text {
      font-family: sans-serif;
      font-size: 14px;
      color: #64748b;
      letter-spacing: 1px;
      height: 20px; /* 固定高度防止跳動 */
    }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // 構建 DOM
  if (!document.getElementById('ui-transition-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'ui-transition-overlay';
    overlay.innerHTML = `
      <div class="ui-overlay-decoration">
        <div class="ui-overlay-gradient"></div>
        <div id="ui-particle-container"></div>
      </div>
      <div class="ui-loader-container">
        <svg class="ui-spinner" viewBox="0 0 50 50">
          <circle class="path-track" cx="25" cy="25" r="20" fill="none" stroke-width="2"></circle>
          <circle class="path-core" cx="25" cy="25" r="20" fill="none" stroke-width="2.5"></circle>
        </svg>
        <div class="ui-status-text" id="ui-status-text">載入中...</div>
      </div>
    `;
    
    // V1 的關鍵邏輯：如果有 token，立即設為 active
    const token = localStorage.getItem('firebase_id_token');
    if (token) {
      overlay.classList.add('active');
    }
    
    document.body.appendChild(overlay);
  }
  
  // 移除預先遮罩
  const immediateStyle = document.getElementById('ui-conductor-immediate-overlay');
  if (immediateStyle) {
    immediateStyle.remove();
  }
})();

// ===== 核心控制器 =====
class UITransitionController {
  constructor() {
    this.overlay = document.getElementById('ui-transition-overlay');
    this.statusText = document.getElementById('ui-status-text');
    this.particleContainer = document.getElementById('ui-particle-container');
    // 移除 isTransitioning 鎖，避免狀態死鎖
  }

  // V1 的穩健等待邏輯
  waitTransition(element, minWaitMs = 300) {
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
      
      // 防呆：如果 transitionend 沒有觸發，強制 resolve
      setTimeout(() => {
        element.removeEventListener('transitionend', handler);
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, minWaitMs + 100);
    });
  }

  setStatus(text) {
    if (this.statusText) this.statusText.textContent = text;
  }

  spawnParticles() {
    if (!UI_CONFIG.effects.enableParticles || !this.particleContainer) return;
    this.particleContainer.innerHTML = '';
    
    // 限制粒子數量，避免效能問題
    for (let i = 0; i < UI_CONFIG.effects.particleCount; i++) {
      const p = document.createElement('div');
      p.classList.add('ui-particle', 'floating');
      
      const size = 5 + Math.random() * 15;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.left = `${Math.random() * 100}%`;
      p.style.top = `${50 + Math.random() * 50}%`;
      p.style.setProperty('--duration', `${2 + Math.random() * 3}s`);
      p.style.animationDelay = `${Math.random() * 2}s`;
      
      this.particleContainer.appendChild(p);
    }
  }

  async playLoginTransition() {
    console.log('🎬 UI Conductor: Login Start');
    this.overlay.classList.add('active');
    this.spawnParticles();
    this.setStatus('正在驗證身分...');
    
    await this.waitTransition(this.overlay, 400);
    
    document.documentElement.classList.add('auth-active');
    document.body.classList.add('auth-active');
  }

  async playLogoutTransition() {
    console.log('🎬 UI Conductor: Logout Start');
    this.overlay.classList.add('active');
    this.setStatus('正在安全登出...');
    
    await this.waitTransition(this.overlay, 400);
    
    document.documentElement.classList.remove('auth-active');
    document.body.classList.remove('auth-active');
  }

  revealContent() {
    console.log('🎬 UI Conductor: Reveal Content');
    this.setStatus('準備就緒');

    // V1 的智慧：使用 requestAnimationFrame 確保渲染，但不做過多延遲
    requestAnimationFrame(() => {
      // 稍微延遲一點點讓使用者看到"準備就緒"，但不像 V2 那麼久
      setTimeout(() => {
        this.overlay.classList.remove('active');
        
        // 內容入場動畫 (非阻塞)
        this.animateContentEntry();
      }, 100); 
    });
  }

  // 防呆版內容動畫
  animateContentEntry() {
    // 嘗試尋找主要容器
    const containers = document.querySelectorAll('main, .panel, .card, header');
    if (containers.length === 0) return; // 找不到元素就放棄，不要報錯

    containers.forEach((el, index) => {
      el.classList.add('ui-reveal-item');
      // 使用 setTimeout 錯開動畫
      setTimeout(() => {
        el.classList.add('revealed');
      }, index * UI_CONFIG.timing.staggerDelay);
    });
  }

  async finalizeLogout() {
    // 模擬背景作業時間，但保持 UI 響應
    await new Promise(r => setTimeout(r, 500));
    this.overlay.classList.remove('active');
  }

  clearAutofilledInputs() {
    // V1 的清除邏輯保留
    requestAnimationFrame(() => {
      const inputs = document.querySelectorAll('input[type="text"], input[type="search"]');
      inputs.forEach(input => {
        if (input.closest('#ui-transition-overlay')) return; // 跳過遮罩層內的輸入框
        input.value = '';
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('name', 'field_' + Math.random().toString(36).slice(2));
      });
    });
  }
}

// ===== 實例化與事件綁定 =====
const uiConductor = new UITransitionController();

window.addEventListener('fw-auth-state-change', async (e) => {
  const { state } = e.detail;
  
  // 移除 V2 的 isTransitioning 檢查，確保狀態機指令總是被執行
  
  switch (state) {
    case 'login-start':
      await uiConductor.playLoginTransition();
      break;
      
    case 'login-ready':
      uiConductor.clearAutofilledInputs();
      uiConductor.revealContent();
      break;
      
    case 'logout-start':
      await uiConductor.playLogoutTransition();
      break;
      
    case 'logout-complete':
      await uiConductor.finalizeLogout();
      break;
      
    case 'init-logged-out':
      document.documentElement.classList.remove('auth-active');
      document.body.classList.remove('auth-active');
      break;
  }
});

console.log('🚀 UI Conductor Optimized: 系統已就緒');