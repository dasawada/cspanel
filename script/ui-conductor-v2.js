// ===== 系統配置 =====
const UI_CONFIG = {
  timing: {
    overlayFade: 500,    // 轉場淡入淡出時間
    contentReveal: 800,  // 內容揭示總時長
    staggerDelay: 80,    // 內容錯落顯示的延遲間隔
  },
  easing: {
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',         // 標準曲線
    cinematic: 'cubic-bezier(0.6, 0.1, 0.4, 0.9)',  // 電影感滑行曲線
  },
  effects: {
    enableParticles: true,
    particleCount: 6,    // 粒子數量 (適量即可，避免搶戲)
  }
};

// 定義統一背景 (預載與正式一致)
const OVERLAY_BACKGROUND = 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)';

// ===== 0. 立即預遮罩 (防止畫面閃爍) =====
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
  }
})();

// ===== 1. 初始化基礎設施 (CSS & DOM) =====
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
      background: ${OVERLAY_BACKGROUND};
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    
    #ui-transition-overlay.active {
      pointer-events: all;
      opacity: 1;
    }

    /* ===== 背景裝飾 ===== */
    .ui-overlay-decoration {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none;
      z-index: 0;
    }

    /* ===== 核心元件：雙核反應爐 Loader ===== */
    .ui-loader-container {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transform: scale(0.95);
      transition: transform 0.5s ${UI_CONFIG.easing.cinematic};
    }

    #ui-transition-overlay.active .ui-loader-container {
      transform: scale(1);
    }

    .ui-spinner {
      width: 72px;  /* 加大尺寸以容納雙層細節 */
      height: 72px;
      /* 複合光暈：產生類似電影鏡頭的空氣感 */
      filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.3));
      /* 整體緩慢公轉，增加不確定性 */
      animation: container-rotate 4s linear infinite; 
    }

    /* 0. 軌道層 (最底層) */
    .path-track {
      fill: none;
      stroke: rgba(59, 130, 246, 0.05); /* 極淡 */
      stroke-width: 1;
    }

    /* 1. 主光束 (外圈 - 負責動量與伸縮) */
    .path-beam {
      fill: none;
      stroke: #3b82f6;
      stroke-width: 2.5;
      stroke-linecap: round; /* 圓頭端點 */
      
      /* 物理長度控制 */
      stroke-dasharray: 1, 200;
      stroke-dashoffset: 0;
      
      /* 複合動畫：伸縮 + 呼吸 */
      animation: 
        beam-stretch 1.8s ease-in-out infinite,
        beam-pulse 3s ease-in-out infinite;
    }

    /* 2. 數據環 (內圈 - 負責精密度與對沖) */
    .path-data {
      fill: none;
      stroke: #60a5fa; 
      stroke-width: 1.5;
      opacity: 0.8;
      transform-origin: center;
      
      /* 數位訊號感：虛線 - 初始值 */
      stroke-dasharray: 2, 10; 
      /* 關鍵：逆時針旋轉 (reverse) + 數據收縮 (contract) 與外圈 1.8s 對稱 */
      animation: 
        spin-data 2s linear infinite reverse,
        data-contract 1.8s ease-in-out infinite;
    }

    /* ===== 動畫 Keyframes ===== */
    @keyframes container-rotate {
      100% { transform: rotate(360deg); }
    }
    
    @keyframes spin-data {
      100% { transform: rotate(360deg); }
    }

    /* 數據環收縮模擬 (配合外圈 1.8s) */
    @keyframes data-contract {
      0%, 100% { stroke-dasharray: 2, 10; }
      50% { stroke-dasharray: 5, 5; } /* 點拉長、間距收縮，製造加速感 */
    }

    /* 光束伸縮模擬 (基於半徑 r=22, 圓周約 138) */
    @keyframes beam-stretch {
      0% {
        stroke-dasharray: 1, 200; 
        stroke-dashoffset: 0;
      }
      50% {
        stroke-dasharray: 100, 200; /* 拉長 */
        stroke-dashoffset: -30px;   /* 頭部推進 */
      }
      100% {
        stroke-dasharray: 100, 200; 
        stroke-dashoffset: -138px;  /* 尾部收縮，完成一圈 */
      }
    }

    @keyframes beam-pulse {
      0%, 100% { stroke: #3b82f6; }
      50% { stroke: #93c5fd; } /* 高亮狀態 */
    }

    /* ===== 狀態文字 ===== */
    .ui-status-text {
      margin-top: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: #64748b;
      letter-spacing: 1.5px; /* 增加字距提升高級感 */
      opacity: 0.8;
      min-width: 120px;
      text-align: center;
      transition: opacity 0.2s ease;
    }

    /* ===== 背景粒子 (氛圍) ===== */
    .ui-particle {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      opacity: 0;
      background: linear-gradient(to top, rgba(59, 130, 246, 0.4), transparent);
    }
    
    .ui-particle.floating {
      animation: floatUp var(--duration) ease-in infinite;
    }

    @keyframes floatUp {
      0% { transform: translateY(0) scale(0.5); opacity: 0; }
      20% { opacity: 0.4; }
      100% { transform: translateY(-80px) scale(1.5); opacity: 0; }
    }

    /* ===== 內容揭示動畫 ===== */
    .ui-reveal-item {
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.6s ease-out, transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .ui-reveal-item.revealed {
      opacity: 1;
      transform: translateY(0);
    }
  `;

  // 注入樣式
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // 構建 DOM 結構
  if (!document.getElementById('ui-transition-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'ui-transition-overlay';
    
    overlay.innerHTML = `
      <div class="ui-overlay-decoration">
        <div id="ui-particle-container"></div>
      </div>
      <div class="ui-loader-container">
        <svg class="ui-spinner" viewBox="0 0 50 50">
          <circle class="path-track" cx="25" cy="25" r="22"></circle>
          <circle class="path-beam" cx="25" cy="25" r="22"></circle>
          <circle class="path-data" cx="25" cy="25" r="15"></circle>
        </svg>
        <div class="ui-status-text" id="ui-status-text">系統啟動中...</div>
      </div>
    `;
    
    const token = localStorage.getItem('firebase_id_token');
    if (token) {
      overlay.classList.add('active');
    }
    
    document.body.appendChild(overlay);
  }
  
  // 清除預先遮罩
  const immediateStyle = document.getElementById('ui-conductor-immediate-overlay');
  if (immediateStyle) {
    requestAnimationFrame(() => immediateStyle.remove());
  }
})();

// ===== 2. 核心控制器類 =====
class UITransitionController {
  constructor() {
    this.overlay = document.getElementById('ui-transition-overlay');
    this.statusText = document.getElementById('ui-status-text');
    this.particleContainer = document.getElementById('ui-particle-container');
  }

  // Promise 封裝的等待函數
  waitTransition(element, minWaitMs = 500) {
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
      
      // 安全閥 (Fail-safe)
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
    if (this.statusText) {
      this.statusText.style.opacity = 0;
      setTimeout(() => {
        this.statusText.textContent = text;
        this.statusText.style.opacity = 0.8;
      }, 150);
    }
  }

  spawnParticles() {
    if (!UI_CONFIG.effects.enableParticles || !this.particleContainer) return;
    this.particleContainer.innerHTML = '';
    
    for (let i = 0; i < UI_CONFIG.effects.particleCount; i++) {
      const p = document.createElement('div');
      p.classList.add('ui-particle', 'floating');
      
      const size = 4 + Math.random() * 8;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.left = `${Math.random() * 100}%`;
      p.style.top = `${60 + Math.random() * 40}%`;
      
      p.style.setProperty('--duration', `${3 + Math.random() * 4}s`);
      p.style.animationDelay = `${Math.random() * 2}s`;
      
      this.particleContainer.appendChild(p);
    }
  }

  // === 狀態流程 ===

  async playLoginTransition() {
    console.log('🎬 UI: 開始登入轉場');
    this.overlay.classList.add('active');
    this.spawnParticles();
    this.setStatus('驗證身分中...');
    
    // 確保有足夠的時間展示動畫
    await this.waitTransition(this.overlay, 600);
    
    document.documentElement.classList.add('auth-active');
    document.body.classList.add('auth-active');
  }

  async playLogoutTransition() {
    console.log('🎬 UI: 開始登出轉場');
    this.overlay.classList.add('active');
    this.spawnParticles();
    this.setStatus('正在安全登出...');
    
    await this.waitTransition(this.overlay, 600);
    
    document.documentElement.classList.remove('auth-active');
    document.body.classList.remove('auth-active');
  }

  revealContent() {
    console.log('🎬 UI: 揭示內容');
    this.setStatus('準備就緒');

    setTimeout(() => {
      this.overlay.classList.remove('active');
      this.animateContentEntry();
    }, 300);
  }

  animateContentEntry() {
    // 搜尋可進行轉場的內容區塊
    const containers = document.querySelectorAll('main, .panel, .card, header, .dashboard-grid > div');
    
    if (containers.length === 0) return;

    containers.forEach((el, index) => {
      el.classList.remove('revealed');
      el.classList.add('ui-reveal-item');
      
      setTimeout(() => {
        el.classList.add('revealed');
      }, index * UI_CONFIG.timing.staggerDelay);
    });
  }

  async finalizeLogout() {
    this.setStatus('登出完成');
    await new Promise(r => setTimeout(r, 400));
    this.overlay.classList.remove('active');
  }

  clearAutofilledInputs() {
    requestAnimationFrame(() => {
      const inputs = document.querySelectorAll('input[type="text"], input[type="search"]');
      inputs.forEach(input => {
        if (input.closest('#ui-transition-overlay')) return;
        input.value = '';
        input.setAttribute('autocomplete', 'off');
      });
    });
  }
}

// ===== 3. 啟動與事件監聽 =====
const uiConductor = new UITransitionController();

window.addEventListener('fw-auth-state-change', async (e) => {
  const { state } = e.detail;
  
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

console.log('🚀 UI Conductor: 雙核反應爐系統已就緒 (繁體中文版)');