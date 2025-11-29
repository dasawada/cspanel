/**
 * UI Conductor Enhanced - 視覺狀態轉場控制器 (Advanced Edition)
 * 特性：多層遮罩管理、流體動畫效果、Promise 異步流控、粒子系統
 * 注意：所有動畫使用純原生 CSS + JavaScript，無外部依賴
 */

// ===== 配置常量 =====
const UI_CONFIG = {
  // 動畫時序
  timing: {
    overlayFade: 500,
    blurTransition: 400,
    contentReveal: 600,
    staggerDelay: 80,
    particleDuration: 2000,
    rippleDuration: 800,
  },
  // 緩動函數
  easing: {
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  },
  // 視覺效果
  effects: {
    enableParticles: true,
    enableRipple: true,
    enableBlur: true,
    particleCount: 12,
    maxBlur: 20,
  }
};

// ===== 0. 立即預遮罩（防止閃爍）=====
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
        background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
        z-index: 9998;
        pointer-events: all;
      }
    `;
    document.head.appendChild(style);
    console.log('🎬 UI Conductor Enhanced: 偵測到 Token，預先遮罩已啟用');
  }
})();

// ===== 1. 初始化增強基礎設施 =====
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
    }
    
    #ui-transition-overlay.active {
      pointer-events: all;
      opacity: 1;
    }

    /* ===== 多層背景系統 ===== */
    .ui-overlay-backdrop {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 50%, #e2e8f0 100%);
    }

    .ui-overlay-gradient {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      background: 
        radial-gradient(ellipse at 30% 20%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 70% 80%, rgba(139, 92, 246, 0.06) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(236, 72, 153, 0.04) 0%, transparent 60%);
      opacity: 0;
      transition: opacity ${UI_CONFIG.timing.overlayFade}ms ${UI_CONFIG.easing.decelerate};
    }

    #ui-transition-overlay.active .ui-overlay-gradient {
      opacity: 1;
    }

    /* ===== 流動光暈效果 ===== */
    .ui-overlay-glow {
      position: absolute;
      width: 300px; height: 300px;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0;
      transition: opacity 0.6s ease;
    }

    .ui-overlay-glow-1 {
      top: -100px; left: -100px;
      background: rgba(59, 130, 246, 0.3);
      animation: glowFloat1 8s ease-in-out infinite;
    }

    .ui-overlay-glow-2 {
      bottom: -100px; right: -100px;
      background: rgba(139, 92, 246, 0.25);
      animation: glowFloat2 10s ease-in-out infinite;
    }

    .ui-overlay-glow-3 {
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(236, 72, 153, 0.15);
      animation: glowPulse 6s ease-in-out infinite;
    }

    #ui-transition-overlay.active .ui-overlay-glow {
      opacity: 1;
    }

    @keyframes glowFloat1 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(50px, 30px) scale(1.1); }
      66% { transform: translate(-20px, 50px) scale(0.95); }
    }

    @keyframes glowFloat2 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(-40px, -20px) scale(1.05); }
      66% { transform: translate(30px, -40px) scale(0.9); }
    }

    @keyframes glowPulse {
      0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
      50% { transform: translate(-50%, -50%) scale(1.3); opacity: 0.8; }
    }

    /* ===== 高級載入動畫 ===== */
    .ui-loader-container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transform: scale(0.8);
      transition: all 0.4s ${UI_CONFIG.easing.elastic};
    }

    #ui-transition-overlay.active .ui-loader-container {
      opacity: 1;
      transform: scale(1);
    }

    /* 脈動圓環載入器 */
    .ui-loader-ring {
      width: 56px; height: 56px;
      position: relative;
    }

    .ui-loader-ring-circle {
      position: absolute;
      width: 100%; height: 100%;
      border: 3px solid transparent;
      border-radius: 50%;
    }

    .ui-loader-ring-circle:nth-child(1) {
      border-top-color: #3b82f6;
      animation: ringRotate 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
    }

    .ui-loader-ring-circle:nth-child(2) {
      border-right-color: #8b5cf6;
      animation: ringRotate 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
      animation-delay: -0.45s;
    }

    .ui-loader-ring-circle:nth-child(3) {
      border-bottom-color: #ec4899;
      animation: ringRotate 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
      animation-delay: -0.3s;
    }

    .ui-loader-ring-circle:nth-child(4) {
      border-left-color: #06b6d4;
      animation: ringRotate 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
      animation-delay: -0.15s;
    }

    @keyframes ringRotate {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* 中心脈動點 */
    .ui-loader-pulse {
      position: absolute;
      width: 12px; height: 12px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-radius: 50%;
      animation: pulseGlow 1.5s ease-in-out infinite;
    }

    @keyframes pulseGlow {
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
      50% { transform: scale(1.2); box-shadow: 0 0 20px 10px rgba(59, 130, 246, 0); }
    }

    /* ===== 粒子系統 ===== */
    .ui-particle-container {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none;
      overflow: hidden;
    }

    .ui-particle {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      opacity: 0;
    }

    .ui-particle.floating {
      animation: particleFloat var(--duration, 3s) ease-in-out infinite;
      animation-delay: var(--delay, 0s);
      opacity: var(--opacity, 0.6);
    }

    @keyframes particleFloat {
      0%, 100% { 
        transform: translate(0, 0) rotate(0deg); 
        opacity: var(--opacity, 0.6);
      }
      25% { 
        transform: translate(var(--tx1, 20px), var(--ty1, -30px)) rotate(90deg); 
      }
      50% { 
        transform: translate(var(--tx2, -10px), var(--ty2, -60px)) rotate(180deg);
        opacity: calc(var(--opacity, 0.6) * 1.2);
      }
      75% { 
        transform: translate(var(--tx3, 15px), var(--ty3, -40px)) rotate(270deg); 
      }
    }

    /* ===== 漣漪效果 ===== */
    .ui-ripple-container {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }

    .ui-ripple {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      border: 2px solid rgba(59, 130, 246, 0.3);
      border-radius: 50%;
      opacity: 0;
    }

    .ui-ripple.expanding {
      animation: rippleExpand var(--duration, 2s) ease-out infinite;
      animation-delay: var(--delay, 0s);
    }

    @keyframes rippleExpand {
      0% { width: 0; height: 0; opacity: 0.8; }
      100% { width: 400px; height: 400px; opacity: 0; }
    }

    /* ===== 內容模糊效果 ===== */
    .ui-blur-active {
      filter: blur(${UI_CONFIG.effects.maxBlur}px);
      transition: filter ${UI_CONFIG.timing.blurTransition}ms ${UI_CONFIG.easing.smooth};
    }

    .ui-blur-clear {
      filter: blur(0);
      transition: filter ${UI_CONFIG.timing.blurTransition}ms ${UI_CONFIG.easing.smooth};
    }

    /* ===== 內容揭示動畫 ===== */
    .ui-reveal-item {
      opacity: 0;
      transform: translateY(20px);
      transition: 
        opacity ${UI_CONFIG.timing.contentReveal}ms ${UI_CONFIG.easing.decelerate},
        transform ${UI_CONFIG.timing.contentReveal}ms ${UI_CONFIG.easing.elastic};
    }

    .ui-reveal-item.revealed {
      opacity: 1;
      transform: translateY(0);
    }

    /* ===== 淡入淡出變體 ===== */
    .ui-fade-slide-up {
      opacity: 0;
      transform: translateY(30px);
    }

    .ui-fade-slide-up.active {
      opacity: 1;
      transform: translateY(0);
      transition: all 0.5s ${UI_CONFIG.easing.elastic};
    }

    .ui-fade-scale {
      opacity: 0;
      transform: scale(0.9);
    }

    .ui-fade-scale.active {
      opacity: 1;
      transform: scale(1);
      transition: all 0.4s ${UI_CONFIG.easing.bounce};
    }

    /* ===== 進度指示器 ===== */
    .ui-progress-bar {
      position: absolute;
      bottom: 40%;
      left: 50%;
      transform: translateX(-50%);
      width: 200px;
      height: 3px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 2px;
      overflow: hidden;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    #ui-transition-overlay.active .ui-progress-bar {
      opacity: 1;
    }

    .ui-progress-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899);
      border-radius: 2px;
      transition: width 0.3s ease;
    }

    /* ===== 狀態文字 ===== */
    .ui-status-text {
      position: absolute;
      bottom: 35%;
      left: 50%;
      transform: translateX(-50%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #64748b;
      letter-spacing: 0.5px;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    #ui-transition-overlay.active .ui-status-text {
      opacity: 1;
    }

    /* ===== 閃光掃描效果 ===== */
    .ui-shimmer {
      position: absolute;
      top: 0; left: -100%;
      width: 100%; height: 100%;
      background: linear-gradient(
        90deg, 
        transparent, 
        rgba(255, 255, 255, 0.4), 
        transparent
      );
      animation: shimmerSweep 2s ease-in-out infinite;
    }

    @keyframes shimmerSweep {
      0% { left: -100%; }
      50%, 100% { left: 100%; }
    }
  `;

  const style = document.createElement('style');
  style.id = 'ui-conductor-enhanced-styles';
  style.textContent = css;
  document.head.appendChild(style);

  // 構建增強遮罩結構
  if (!document.getElementById('ui-transition-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'ui-transition-overlay';
    overlay.innerHTML = `
      <div class="ui-overlay-backdrop"></div>
      <div class="ui-overlay-gradient"></div>
      <div class="ui-overlay-glow ui-overlay-glow-1"></div>
      <div class="ui-overlay-glow ui-overlay-glow-2"></div>
      <div class="ui-overlay-glow ui-overlay-glow-3"></div>
      <div class="ui-particle-container" id="ui-particle-container"></div>
      <div class="ui-ripple-container" id="ui-ripple-container"></div>
      <div class="ui-loader-container">
        <div class="ui-loader-ring">
          <div class="ui-loader-ring-circle"></div>
          <div class="ui-loader-ring-circle"></div>
          <div class="ui-loader-ring-circle"></div>
          <div class="ui-loader-ring-circle"></div>
        </div>
        <div class="ui-loader-pulse"></div>
      </div>
      <div class="ui-progress-bar">
        <div class="ui-progress-fill" id="ui-progress-fill"></div>
        <div class="ui-shimmer"></div>
      </div>
      <div class="ui-status-text" id="ui-status-text">載入中...</div>
    `;
    
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

// ===== 核心控制器類 =====
class UITransitionController {
  constructor() {
    this.overlay = document.getElementById('ui-transition-overlay');
    this.progressFill = document.getElementById('ui-progress-fill');
    this.statusText = document.getElementById('ui-status-text');
    this.particleContainer = document.getElementById('ui-particle-container');
    this.rippleContainer = document.getElementById('ui-ripple-container');
    this.particles = [];
    this.ripples = [];
    this.isTransitioning = false;
  }

  // 等待過渡完成
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
      
      setTimeout(() => {
        element.removeEventListener('transitionend', handler);
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, minWaitMs + 100);
    });
  }

  // 等待背景過渡
  waitForBackgroundTransition(duration = 800) {
    return new Promise(resolve => setTimeout(resolve, duration));
  }

  // 更新進度
  setProgress(percent, statusText = null) {
    if (this.progressFill) {
      this.progressFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
    if (statusText && this.statusText) {
      this.statusText.textContent = statusText;
    }
  }

// ===== 視覺特效方法 =====

  // 生成懸浮粒子
  spawnParticles() {
    if (!UI_CONFIG.effects.enableParticles || !this.particleContainer) return;
    
    // 清除舊粒子
    this.particleContainer.innerHTML = '';
    
    const colors = ['rgba(59, 130, 246, 0.4)', 'rgba(139, 92, 246, 0.4)', 'rgba(236, 72, 153, 0.4)'];
    
    for (let i = 0; i < UI_CONFIG.effects.particleCount; i++) {
      const p = document.createElement('div');
      p.classList.add('ui-particle', 'floating');
      
      // 隨機屬性
      const size = 10 + Math.random() * 40;
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const delay = Math.random() * -5;
      const duration = 3 + Math.random() * 4;
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      // 應用樣式
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.left = `${x}%`;
      p.style.top = `${y}%`;
      p.style.background = color;
      p.style.setProperty('--delay', `${delay}s`);
      p.style.setProperty('--duration', `${duration}s`);
      p.style.setProperty('--tx1', `${(Math.random() - 0.5) * 60}px`);
      p.style.setProperty('--ty1', `${(Math.random() - 0.5) * 60}px`);
      p.style.setProperty('--tx2', `${(Math.random() - 0.5) * 60}px`);
      p.style.setProperty('--ty2', `${(Math.random() - 0.5) * 60}px`);
      
      this.particleContainer.appendChild(p);
      this.particles.push(p);
    }
  }

  // 觸發漣漪效果
  triggerRipple() {
    if (!UI_CONFIG.effects.enableRipple || !this.rippleContainer) return;
    
    const ripple = document.createElement('div');
    ripple.classList.add('ui-ripple', 'expanding');
    this.rippleContainer.appendChild(ripple);
    
    // 動畫結束後移除
    setTimeout(() => {
      ripple.remove();
    }, UI_CONFIG.timing.rippleDuration);
  }

  // 應用背景模糊
  toggleContentBlur(isActive) {
    if (!UI_CONFIG.effects.enableBlur) return;
    
    const target = document.querySelector('main') || document.body;
    if (isActive) {
      target.classList.add('ui-blur-active');
      target.classList.remove('ui-blur-clear');
    } else {
      target.classList.add('ui-blur-clear');
      target.classList.remove('ui-blur-active');
    }
  }

  // ===== 核心轉場邏輯 =====

  async playLoginTransition() {
    console.log('🎬 UI Conductor: 啟動登入轉場 (Login Start)');
    this.isTransitioning = true;
    
    // 1. 激活遮罩與特效
    this.overlay.classList.add('active');
    this.spawnParticles();
    this.toggleContentBlur(true);
    
    // 2. 更新進度狀態
    this.setProgress(0);
    requestAnimationFrame(() => this.setProgress(30, '正在驗證身分...'));
    
    await this.waitTransition(this.overlay, 400); 
    
    // 3. 鎖定全域樣式
    document.documentElement.classList.add('auth-active');
    document.body.classList.add('auth-active');
  }

  async playLogoutTransition() {
    console.log('🎬 UI Conductor: 啟動登出轉場 (Logout Start)');
    this.isTransitioning = true;
    
    this.overlay.classList.add('active');
    this.spawnParticles(); // 登出也加入粒子增強視覺
    this.toggleContentBlur(true);
    
    this.setProgress(0);
    requestAnimationFrame(() => this.setProgress(50, '正在安全登出...'));
    
    await this.waitTransition(this.overlay, 400);
    
    // 移除全域鎖定
    document.documentElement.classList.remove('auth-active');
    document.body.classList.remove('auth-active');
  }

  // 核心：內容揭示 (取代原版 revealContent)
  revealContent() {
    console.log('🎬 UI Conductor: 揭示內容 (Ready)');
    
    // 1. 完成進度條
    this.setProgress(100, '準備就緒');
    
    // 2. 觸發視覺反饋
    this.triggerRipple();
    
    requestAnimationFrame(() => {
      // 延遲以展示 100% 進度
      setTimeout(() => {
        // 3. 降下遮罩
        this.overlay.classList.remove('active');
        this.toggleContentBlur(false);
        this.isTransitioning = false;
        
        // 4. 內容入場動畫 (Staggered Animation)
        this.animateContentEntry();
        
      }, 300); // 稍作停留
    });
  }

  // 新增：內容入場動畫序列
  animateContentEntry() {
    // 尋找標記了 .ui-reveal-item 的元素，或預設針對常見容器
    let targets = document.querySelectorAll('.ui-reveal-item');
    
    // 如果沒有顯式標記，嘗試智能抓取主要區塊
    if (targets.length === 0) {
      const containers = document.querySelectorAll('main > div, .panel, .card, header');
      if (containers.length > 0) {
        containers.forEach(el => el.classList.add('ui-reveal-item'));
        targets = containers;
      }
    }

    // 錯開時間執行
    targets.forEach((el, index) => {
      setTimeout(() => {
        el.classList.add('revealed');
      }, index * UI_CONFIG.timing.staggerDelay);
    });
  }

  async finalizeLogout() {
    console.log('🎬 UI Conductor: 登出收尾 (Logout Finalizing)');
    
    this.setProgress(100, '已登出');
    await this.waitForBackgroundTransition(800);
    
    console.log('🎬 UI Conductor: 降下遮罩 (Complete)');
    this.overlay.classList.remove('active');
    this.toggleContentBlur(false);
    this.isTransitioning = false;
  }

  // ===== 輔助功能 =====
  clearAutofilledInputs() {
    requestAnimationFrame(() => {
      const containers = [
        'meeting-search-panel-placeholder',
        'optitle-placeholder',
        'fudausearch-placeholder',
        'shrturl-placeholder',
        'dt-panel-placeholder',
        'consultant-panel-placeholder',
        'assist-panel-placeholder',
        'login-form-container' // 新增可能需要的容器
      ];
      
      let clearedCount = 0;
      containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
          const inputs = container.querySelectorAll('input[type="search"], input[type="text"]:not([type="date"])');
          inputs.forEach(input => {
            input.value = '';
            input.setAttribute('autocomplete', 'off');
            // 生成隨機 name 屬性以徹底破壞瀏覽器自動填充機制
            input.setAttribute('name', 'field_' + Math.random().toString(36).substring(7));
            clearedCount++;
          });
        }
      });
      console.log(`🧹 UI Conductor: 已清除 ${clearedCount} 個自動填入欄位`);
    });
  }
}

// ===== 3. 實例化與事件綁定 =====
const uiConductor = new UITransitionController();

window.addEventListener('fw-auth-state-change', async (e) => {
  const { state } = e.detail;
  
  // 防止在轉場中途被重複觸發
  if (uiConductor.isTransitioning && state === 'login-start') return;

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

// 公開 API 供外部調用（如手動觸發載入）
window.UIConductor = {
  showLoading: (msg) => {
    uiConductor.overlay.classList.add('active');
    uiConductor.setProgress(0);
    uiConductor.spawnParticles();
    if(msg) uiConductor.setProgress(50, msg);
  },
  hideLoading: () => {
    uiConductor.revealContent();
  },
  triggerTransition: async (callback) => {
    uiConductor.overlay.classList.add('active');
    await uiConductor.waitTransition(uiConductor.overlay);
    if (callback) await callback();
    uiConductor.revealContent();
  }
};

console.log('🚀 UI Conductor Enhanced: 系統已就緒 (Particles & Physics Enabled)');