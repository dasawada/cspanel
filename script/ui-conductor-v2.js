const UI_CONFIG = {
  timing: {
    overlayFade: 500,
    contentReveal: 800,
    staggerDelay: 80,
  },
  easing: {
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    cinematic: 'cubic-bezier(0.6, 0.1, 0.4, 0.9)',
  },
  effects: {
    enableParticles: true,
    particleCount: 6,
  }
};

const OVERLAY_BACKGROUND = 'linear-gradient(135deg, #f6f7f1 0%, #eceee3 100%)';

(function immediateOverlayCheck() {
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
})();

(function initUIInfrastructure() {
  const css = `
    /* ===== 色彩系統 — 三主色，其餘自動衍生 ===== */
    :root {
      --ui-accent: var(--accent, #8d9c00);   /* 主色：跟隨主題 */
      --ui-surface: var(--bg-base, #f2f3ec); /* 底色：跟隨主題 */
      --ui-text:    var(--fg-2, #6e6e73);    /* 文字：跟隨主題 */

      /* ▼ 以下全由三主色自動運算，換色只需改上方三行 ▼ */
      --ui-overlay-bg-start: color-mix(in srgb, var(--ui-accent)  4%, var(--ui-surface));
      --ui-overlay-bg-end:   color-mix(in srgb, var(--ui-accent) 12%, var(--ui-surface));
      --ui-spinner-primary:  var(--ui-accent);
      --ui-spinner-secondary:color-mix(in srgb, var(--ui-accent) 65%, white);
      --ui-spinner-highlight:color-mix(in srgb, var(--ui-accent) 40%, white);
      --ui-track-color:      color-mix(in srgb, var(--ui-accent)  5%, transparent);
      --ui-spinner-glow:     color-mix(in srgb, var(--ui-accent) 30%, transparent);
      --ui-particle-color:   color-mix(in srgb, var(--ui-accent) 40%, transparent);
      --ui-status-color:     color-mix(in srgb, var(--ui-accent) 25%, var(--ui-text));
    }

    /* ===== 主遮罩層 ===== */
    #ui-transition-overlay {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      z-index: 9999;
      pointer-events: none;
      opacity: 0;
      transition: opacity ${UI_CONFIG.timing.overlayFade}ms ${UI_CONFIG.easing.smooth};
      background: linear-gradient(135deg, var(--ui-overlay-bg-start) 0%, var(--ui-overlay-bg-end) 100%);
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

    /* 第十期：所有 infinite 動畫「預設 paused、僅 .active 期間 running」——
       overlay 以 opacity:0 退場（為了淡出過渡不能立即 display:none），動畫若無條件
       running 就會在不可見狀態永久空轉、每幀弄髒玻璃面板的 backdrop 取樣範圍。
       用 play-state 而非「動畫宣告整個搬進 .active 後代」（審查修正）：後者在
       remove('active') 當下（opacity 仍為 1 的淡出首幀）會讓 spinner 瞬間跳回
       初始姿態，肉眼可見；paused 則凍結在當前姿態，隨淡出自然消失。
       paused 的動畫不逐幀運算，效能上等同沒有動畫。 */
    .ui-spinner {
      width: 72px;  /* 加大尺寸以容納雙層細節 */
      height: 72px;
      /* 複合光暈：產生類似電影鏡頭的空氣感 */
      filter: drop-shadow(0 0 8px var(--ui-spinner-glow));
      /* 整體緩慢公轉，增加不確定性 */
      animation: container-rotate 4s linear infinite;
      animation-play-state: paused;
    }
    #ui-transition-overlay.active .ui-spinner { animation-play-state: running; }

    /* 0. 軌道層 (最底層) */
    .path-track {
      fill: none;
      stroke: var(--ui-track-color); /* 極淡 */
      stroke-width: 1;
    }

    /* 1. 主光束 (外圈 - 負責動量與伸縮) */
    .path-beam {
      fill: none;
      stroke: var(--ui-spinner-primary);
      stroke-width: 2.5;
      stroke-linecap: round; /* 圓頭端點 */

      /* 物理長度控制 */
      stroke-dasharray: 1, 200;
      stroke-dashoffset: 0;

      /* 複合動畫：伸縮 + 呼吸（預設 paused，僅 .active 期間 running） */
      animation:
        beam-stretch 1.8s ease-in-out infinite,
        beam-pulse 3s ease-in-out infinite;
      animation-play-state: paused;
    }
    #ui-transition-overlay.active .path-beam { animation-play-state: running; }

    /* 2. 數據環 (內圈 - 負責精密度與對沖) */
    .path-data {
      fill: none;
      stroke: var(--ui-spinner-secondary);
      stroke-width: 1.5;
      opacity: 0.8;
      transform-origin: center;

      /* 數位訊號感：虛線 - 初始值 */
      stroke-dasharray: 2, 10;

      /* 關鍵：逆時針旋轉 (reverse) + 數據收縮 (contract) 與外圈 1.8s 對稱
         （預設 paused，僅 .active 期間 running） */
      animation:
        spin-data 2s linear infinite reverse,
        data-contract 1.8s ease-in-out infinite;
      animation-play-state: paused;
    }
    #ui-transition-overlay.active .path-data { animation-play-state: running; }

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
      0%, 100% { stroke: var(--ui-spinner-primary); }
      50% { stroke: var(--ui-spinner-highlight); } /* 高亮狀態 */
    }

    /* ===== 狀態文字 ===== */
    .ui-status-text {
      margin-top: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: var(--ui-status-color);
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
      background: linear-gradient(to top, var(--ui-particle-color), transparent);
    }
    
    .ui-particle.floating {
      animation: floatUp var(--duration) ease-in infinite;
      animation-play-state: paused;
    }
    #ui-transition-overlay.active .ui-particle.floating { animation-play-state: running; }

    @keyframes floatUp {
      0% { transform: translateY(0) scale(0.5); opacity: 0; }
      20% { opacity: 0.4; }
      100% { transform: translateY(-80px) scale(1.5); opacity: 0; }
    }

    /* 第十期：reduced-motion 分支（本注入樣式原為全庫唯一缺席處）——
       粒子與光束/數據環的伸縮脈衝屬裝飾性動態，全數停用（審查修正：只降速
       .ui-spinner 時，主要動態源 path-beam/path-data 仍全速，分支形同虛設）；
       外圈公轉是唯一保留的載入回饋，比照 capsule/ipsearch 慣例降速。 */
    @media (prefers-reduced-motion: reduce) {
      .ui-particle.floating, .path-beam, .path-data { animation: none; }
      .ui-spinner { animation-duration: 12s; }
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

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

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
    
    // 開機一律 fail closed；Firebase identity + server grant boot 完成後才由事件撤下。
    overlay.classList.add('active');

    document.body.appendChild(overlay);
  }
  
  const immediateStyle = document.getElementById('ui-conductor-immediate-overlay');
  if (immediateStyle) {
    requestAnimationFrame(() => immediateStyle.remove());
  }
})();

class UITransitionController {
  constructor() {
    this.overlay = document.getElementById('ui-transition-overlay');
    this.statusText = document.getElementById('ui-status-text');
    this.particleContainer = document.getElementById('ui-particle-container');
    // 登出過場進行中旗標：session-absent 若在此期間抵達（signOut 觸發的
    // onAuthStateChanged(null)），收場交由 finalizeLogout，不得中途撤 overlay。
    this.inLogoutTransition = false;
  }

  // 第十期：overlay 顯示/收場的 display 管理。淡入前先解除 display:none 並強制
  // reflow（否則 display 與 .active 同幀變更會跳過 opacity 過渡）；淡出結束後
  // （transitionend，waitTransition 內建 timeout 兜底涵蓋分頁隱藏時事件不觸發）
  // 補 display:none 釋放合成層——若期間又被重新 activate 則跳過。
  showOverlay() {
    if (this.overlay && this.overlay.style.display === 'none') {
      this.overlay.style.display = '';
      void this.overlay.offsetWidth;
    }
  }

  hideOverlayWhenFaded() {
    if (!this.overlay) return;
    // 固定延時而非 transitionend（審查修正）：淡入剛完成的殘留 transitionend 會
    // 提早 resolve，在 opacity≈1 時就落 display:none 而截斷淡出。延時 ≥ 淡出全長
    // 後再驗 opacity 已歸零才收場；仍在過渡（或又被 activate）就不動，交由下一輪
    // 過場重試——overlay 停留在 opacity:0＋動畫 paused 的狀態，成本趨近零。
    setTimeout(() => {
      if (!this.overlay.classList.contains('active')
        && getComputedStyle(this.overlay).opacity === '0') {
        this.overlay.style.display = 'none';
      }
    }, UI_CONFIG.timing.overlayFade + 150);
  }

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

  async playLoginTransition() {
    this.showOverlay();
    this.overlay.classList.add('active');
    this.spawnParticles();
    this.setStatus('驗證身分中...');
    
    await this.waitTransition(this.overlay, 600);
    
    document.documentElement.classList.add('auth-active');
    document.body.classList.add('auth-active');
  }

  async playLogoutTransition() {
    this.showOverlay();
    this.overlay.classList.add('active');
    this.spawnParticles();
    this.setStatus('正在安全登出...');
    
    await this.waitTransition(this.overlay, 600);
    
    document.documentElement.classList.remove('auth-active');
    document.body.classList.remove('auth-active');
  }

  revealContent() {
    this.setStatus('準備就緒');

    setTimeout(() => {
      this.overlay.classList.remove('active');
      this.hideOverlayWhenFaded();
      this.animateContentEntry();
    }, 300);
  }

  animateContentEntry() {
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
    this.hideOverlayWhenFaded();
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
      uiConductor.inLogoutTransition = true;
      await uiConductor.playLogoutTransition();
      break;

    case 'logout-complete':
      await uiConductor.finalizeLogout();
      uiConductor.inLogoutTransition = false;
      break;

    case 'init-logged-out':
      document.documentElement.classList.remove('auth-active');
      document.body.classList.remove('auth-active');
      break;

    case 'session-absent':
      // Firebase restore／server access boot確認沒有可用session後，撤下開機鎖屏並
      // 露出登入列；登出過場進行中仍交由finalizeLogout收尾。
      if (uiConductor.inLogoutTransition) break;
      document.documentElement.classList.remove('auth-active');
      document.body.classList.remove('auth-active');
      uiConductor.overlay.classList.remove('active');
      uiConductor.hideOverlayWhenFaded();
      break;
  }
});
