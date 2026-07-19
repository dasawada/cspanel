import { bootAccess, killAccess } from './auth-fetch.js';

export async function loadLoginPanel() {
  // ===== Toast 通知系統 =====
  const toastStyles = `
    #firework-toast-container {
      position: fixed;
      left: 20px;
      bottom: 20px;
      z-index: var(--layer-toast);
      display: flex;
      flex-direction: column-reverse;
      gap: var(--space-4);
      pointer-events: none;
    }
    .firework-toast {
      background: var(--elevated);
      backdrop-filter: blur(var(--glass-blur, 20px)) saturate(1.6);
      -webkit-backdrop-filter: blur(var(--glass-blur, 20px)) saturate(1.6);
      color: var(--fg);
      padding: 12px 20px;
      border-radius: 12px;
      border: 1px solid var(--glass-border);
      font-size: var(--text-base);
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      opacity: 0;
      transform: translateX(-20px);
      transition: opacity var(--spring), transform var(--spring);
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }
    .firework-toast.show {
      opacity: 1;
      transform: translateX(0);
    }
    .firework-toast::before {
      content: "";
      width: 8px; height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--accent);
    }
    .firework-toast.success::before { background: var(--success); }
    .firework-toast.error::before   { background: var(--danger); }
    .firework-toast.warning::before { background: var(--warning); }
    .firework-toast.info::before    { background: var(--accent); }
    @media (prefers-reduced-motion: reduce) {
      .firework-toast { transition: opacity 0.2s ease; transform: none; }
    }
  `;

  // 注入 Toast 樣式
  if (!document.getElementById('firework-toast-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'firework-toast-styles';
    styleEl.textContent = toastStyles;
    document.head.appendChild(styleEl);
  }

  // 創建 Toast 容器
  if (!document.getElementById('firework-toast-container')) {
    const container = document.createElement('div');
    container.id = 'firework-toast-container';
    document.body.appendChild(container);
  }

  // Toast 顯示函數
  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('firework-toast-container');
    const toast = document.createElement('div');
    toast.className = `firework-toast ${type}`;
    
    const icons = {
      success: '<i class="fa-solid fa-circle-check"></i>',
      error: '<i class="fa-solid fa-circle-xmark"></i>',
      warning: '<i class="fa-solid fa-triangle-exclamation"></i>',
      info: '<i class="fa-solid fa-circle-info"></i>'
    };
    
    toast.innerHTML = `${icons[type] || icons.info} <span>${message}</span>`;
    container.appendChild(toast);
    
    // 觸發顯示動畫
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    
    // 自動移除
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // 掛載到全域供其他模組使用
  window.showFireworkToast = showToast;

  const panelHtml = `
    <div id="firebase-login-bar">
      <form id="firebase-login-form" autocomplete="on">
        <div id="firebase-login-bar-content">
          <div id="firebase-login-bar-status">
            <span id="firebase-login-bar-message"><i class="fa-solid fa-right-to-bracket"></i></span>
          </div>
          <input type="email" id="firebase-login-bar-email" name="email" placeholder="Email" autocomplete="username">
          <input type="password" id="firebase-login-bar-password" name="password" placeholder="密碼" autocomplete="current-password">
          <button type="submit" id="firebase-login-bar-submit" style="display:none;" aria-hidden="true"></button>
          <i id="firebase-login-bar-btn" class="fa-solid fa-play" role="button" tabindex="0" aria-label="登入"></i>
          <i id="firebase-logout-bar-btn" class="fa-solid fa-right-to-bracket" style="display:none;" role="button" tabindex="0" aria-label="登出"></i>
          <i id="fw-theme-btn" class="fa-solid fa-palette" style="display:none;" role="button" tabindex="0" aria-label="配色主題" title="配色主題"></i>
          <i id="fw-edit-btn" class="fa-solid fa-up-down-left-right" style="display:none;" role="button" tabindex="0" aria-label="編排佈局" title="編排佈局"></i>
        </div>
      </form>
    </div>
  `;
  if (!document.getElementById('firebase-login-bar')) {
    document.body.insertAdjacentHTML('beforeend', panelHtml);
  }

  const themeBtn = document.getElementById('fw-theme-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => { window.CspanelTheme && window.CspanelTheme.openPicker(); });
    themeBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.CspanelTheme && window.CspanelTheme.openPicker();
      }
    });
  }

  const editBtn = document.getElementById('fw-edit-btn');
  if (editBtn) {
    editBtn.addEventListener('click', () => { window.CanvasEdit && window.CanvasEdit.toggle(); });
    editBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.CanvasEdit && window.CanvasEdit.toggle();
      }
    });
  }

  // SDK Loading
  if (!window.firebase) {
    // Load firebase-app first (required before other modules)
    await new Promise(r => { 
      const s = document.createElement('script'); 
      s.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"; 
      s.onload = r; 
      document.head.appendChild(s); 
    });
    // Then load auth and firestore in parallel
    await Promise.all([
      new Promise(r => { const s = document.createElement('script'); s.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"; s.onload = r; document.head.appendChild(s); }),
      new Promise(r => { const s = document.createElement('script'); s.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"; s.onload = r; document.head.appendChild(s); })
    ]);
  }

  if (!window.firebase.apps?.length) {
    const firebaseConfig = {
      apiKey: "AIzaSyAhgA5nFE3bLTVyudYjKctSpnTCIgORg8M",
      authDomain: "cstoolsapi.firebaseapp.com",
      projectId: "cstoolsapi",
      storageBucket: "cstoolsapi.firebasestorage.app",
      messagingSenderId: "632885029336",
      appId: "1:632885029336:web:f491b9cc28fe3f2504aaad"
    };
    window.firebase.initializeApp(firebaseConfig);
  }

  const auth = window.firebase.auth();

  // ----- UI 狀態更新邏輯 -----
  function updateUIState(isLoggedIn) {
    const bar = document.getElementById('firebase-login-bar');
    const barContent = document.getElementById('firebase-login-bar-content');
    const barStatus = document.getElementById('firebase-login-bar-status');
    const emailInput = document.getElementById('firebase-login-bar-email');
    const pwdInput = document.getElementById('firebase-login-bar-password');
    const loginBtn = document.getElementById('firebase-login-bar-btn');
    const logoutBtn = document.getElementById('firebase-logout-bar-btn');
    const themeBtn = document.getElementById('fw-theme-btn');
    const editBtn = document.getElementById('fw-edit-btn');
    const statusMsg = document.getElementById('firebase-login-bar-message');
    if (!bar || !barContent) return;
    bar.classList.toggle('logged-in', !!isLoggedIn);
    if (isLoggedIn) {
      emailInput.style.display = 'none';
      pwdInput.style.display = 'none';
      loginBtn.style.display = 'none';
      logoutBtn.style.display = '';
      if (themeBtn) themeBtn.style.display = '';
      if (editBtn) editBtn.style.display = '';
      statusMsg.innerHTML = '<i class="fa-solid fa-circle-check fw-status-ok"></i>';
      statusMsg.style.display = '';
      barStatus.style.display = '';
      barStatus.style.flex = '1';
    } else {
      emailInput.style.display = '';
      pwdInput.style.display = '';
      loginBtn.style.display = '';
      logoutBtn.style.display = 'none';
      if (themeBtn) themeBtn.style.display = 'none';
      if (editBtn) editBtn.style.display = 'none';
      statusMsg.style.display = 'none';
      barStatus.style.display = 'none';
      barStatus.style.flex = '0';
    }
  }

  function closeProtectedUi() {
    const hadSession = wasLoggedIn;
    wasLoggedIn = false;
    window.fireworkAuthReady = false;
    updateUIState(false);
    if (hadSession) window.dispatchEvent(new Event('firework-logout-success'));
  }

  // access client 先同步清空畫面，再決定重新載入或 Firebase sign-out。
  window.addEventListener('cspanel:access-kill', closeProtectedUi);
  window.addEventListener('firework-force-logout', () => {
    closeProtectedUi();
    void killAccess({ reason: 'USER_LOGOUT', signOut: true });
  });

  // ----- 取得 DOM 元素 -----
  const loginForm = document.getElementById('firebase-login-form');
  const loginBtn = document.getElementById('firebase-login-bar-btn');
  const logoutBtn = document.getElementById('firebase-logout-bar-btn');
  const emailInput = document.getElementById('firebase-login-bar-email');
  const pwdInput = document.getElementById('firebase-login-bar-password');
  const statusMsg = document.getElementById('firebase-login-bar-message');

  // 第十期：區分「新登入」與「session 恢復」——onAuthStateChanged 在已登入頁
  // 重新整理時也會以 user 非空回呼（local persistence 恢復），不該重播「登入成功」
  // toast。只有 handleLogin（使用者實際送出帳密）才立此旗標。
  let pendingLoginToast = false;
  // 本頁載入後是否曾建立 access session——決定 onAuthStateChanged(null)
  // 是「跨分頁登出的拆場」（曾登入）還是「開機即無 identity」（未曾）。
  let wasLoggedIn = false;

  // ----- 核心登入邏輯 (統一處理) -----
  async function handleLogin(e) {
    // 阻止表單預設提交行為 (防止 URL 改變)
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const email = emailInput.value.trim();
    const password = pwdInput.value;
    
    // 驗證輸入
    if (!email || !password) {
      showToast('請輸入信箱和密碼', 'warning', 3000);
      return false;
    }
    
    // 簡易 email 格式驗證
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast('請輸入正確的信箱格式', 'warning', 3000);
      return false;
    }
    
    statusMsg.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    loginBtn.style.color = '';
    
    try {
      pendingLoginToast = true; // 標記本輪為使用者主動登入（toast 於 onAuthStateChanged 顯示）
      await auth.signInWithEmailAndPassword(email, password);
      return true;
    } catch(e) {
      pendingLoginToast = false;
      loginBtn.style.color = 'var(--danger)';
      statusMsg.innerHTML = '';
      
      // 根據錯誤類型顯示不同訊息
      const errorMessages = {
        'auth/user-disabled': '此帳號已被停用',
        'auth/user-not-found': '找不到此帳號',
        'auth/wrong-password': '密碼錯誤',
        'auth/invalid-email': '信箱格式不正確',
        'auth/too-many-requests': '登入嘗試次數過多，請稍後再試',
        'auth/invalid-credential': '帳號或密碼錯誤'
      };
      
      const message = errorMessages[e.code] || '登入失敗，請檢查帳號密碼';
      showToast(message, 'error', 4000);
      return false;
    }
  }

  // ----- 登出邏輯 -----
  function handleLogout(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    window.dispatchEvent(new Event('firework-force-logout'));
    showToast('已登出', 'info', 2000);
  }

  // ----- 表單 submit 事件 (攔截 Enter 鍵觸發的提交) -----
  loginForm.addEventListener('submit', handleLogin, { passive: false });

  // ----- 登入按鈕點擊事件 -----
  loginBtn.addEventListener('click', handleLogin, { passive: false });
  
  // ----- 登入按鈕鍵盤事件 (無障礙支援) -----
  loginBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleLogin(e);
    }
  });

  // ----- 登出按鈕點擊事件 -----
  logoutBtn.addEventListener('click', handleLogout, { passive: false });
  
  // ----- 登出按鈕鍵盤事件 (無障礙支援) -----
  logoutBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleLogout(e);
    }
  });

  // ----- 監聽登入狀態變化 -----
  auth.onAuthStateChanged(async function(user) {
    if (user) {
      try {
        await bootAccess();
      } catch (e) {
        closeProtectedUi();
        showToast('帳號目前無法使用此系統', 'error', 4000);
        window.dispatchEvent(new CustomEvent('fw-auth-state-change', { detail: { state: 'session-absent' } }));
        return;
      }
      wasLoggedIn = true;
      updateUIState(true);
      // 第十期：session 恢復（重新整理）不重播 toast——只有使用者主動登入才顯示
      if (pendingLoginToast) {
        showToast('登入成功', 'success', 2500);
        pendingLoginToast = false;
      }
      // 狀態旗標先於事件設置：canvas-engine 的 loadCanvas 要 await 十餘個模組
      // 動態 import 後才掛 'firework-login-success' 監聽器，事件可能在那之前就
      // 發出而漏接。旗標是「同一真相來源」（本回呼）的狀態面，晚註冊的訂閱者
      // 讀旗標補位，不需要第二個判定來源（見 canvas-engine loadCanvas 尾註解）。
      window.fireworkAuthReady = true;
      window.dispatchEvent(new Event('firework-login-success'));
    } else {
      window.fireworkAuthReady = false;
      updateUIState(false);
      if (wasLoggedIn) {
        // 本頁曾建立 session 而 Firebase 判定已結束（例如跨分頁登出）——完整拆場。
        // 否則背景分頁的 initPromise 停在已
        // resolve 狀態，A 分頁換帳號重登入時本分頁會跳過整輪 init、以新帳號
        // token 掛著前一帳號的面板資料。
        wasLoggedIn = false;
        window.dispatchEvent(new Event('firework-logout-success'));
      } else {
        // 開機即無可用Firebase/access session：通知conductor撤下「系統啟動中」
        // 鎖屏並露出登入列，避免全螢幕overlay永久留著。
        window.dispatchEvent(new CustomEvent('fw-auth-state-change', { detail: { state: 'session-absent' } }));
      }
    }
  });
}
