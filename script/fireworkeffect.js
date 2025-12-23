export async function loadLoginPanel() {
  // ===== Toast 通知系統 =====
  const toastStyles = `
    #firework-toast-container {
      position: fixed;
      left: 20px;
      bottom: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column-reverse;
      gap: 8px;
      pointer-events: none;
    }
    .firework-toast {
      background: #333;
      color: #fff;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      opacity: 0;
      transform: translateX(-20px);
      transition: all 0.3s ease;
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .firework-toast.show {
      opacity: 1;
      transform: translateX(0);
    }
    .firework-toast.success {
      background: linear-gradient(135deg, #2ecc71, #27ae60);
    }
    .firework-toast.error {
      background: linear-gradient(135deg, #e74c3c, #c0392b);
    }
    .firework-toast.warning {
      background: linear-gradient(135deg, #f39c12, #d68910);
    }
    .firework-toast.info {
      background: linear-gradient(135deg, #3498db, #2980b9);
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
    <div id="firebase-login-bar" style="position:fixed;right:20px;bottom:20px;z-index:9999;width:auto;min-width:unset;max-width:unset;">
      <form id="firebase-login-form" autocomplete="on">
        <div id="firebase-login-bar-content" style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #eee;border-radius:24px;padding:8px 16px;box-shadow:0 2px 8px #eee;transition:all .3s;width:auto;min-width:unset;max-width:unset;">
          <div id="firebase-login-bar-status" style="flex:1;color:#333;font-size:15px;">
            <span id="firebase-login-bar-message"><i class="fa-solid fa-right-to-bracket"></i></span>
          </div>
          <input type="email" id="firebase-login-bar-email" name="email" placeholder="Email" autocomplete="username" style="width:110px;font-size:13px;padding:2px 6px;border-radius:4px;border:1px solid #ddd;">
          <input type="password" id="firebase-login-bar-password" name="password" placeholder="密碼" autocomplete="current-password" style="width:80px;font-size:13px;padding:2px 6px;border-radius:4px;border:1px solid #ddd;">
          <button type="submit" id="firebase-login-bar-submit" style="display:none;" aria-hidden="true"></button>
          <i id="firebase-login-bar-btn" class="fa-solid fa-play" style="font-size:18px;color:#2d8cf0;cursor:pointer;display:flex;align-items:center;justify-content:center;" role="button" tabindex="0" aria-label="登入"></i>
          <i id="firebase-logout-bar-btn" class="fa-solid fa-right-to-bracket" style="display:none;font-size:18px;color:#aaa;cursor:pointer;display:flex;align-items:center;justify-content:center;" role="button" tabindex="0" aria-label="登出"></i>
        </div>
      </form>
    </div>
  `;
  if (!document.getElementById('firebase-login-bar')) {
    document.body.insertAdjacentHTML('beforeend', panelHtml);
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
    const loginBtn = document.getElementById('firebase-login-bar-btn');
    const logoutBtn = document.getElementById('firebase-logout-bar-btn');
    const statusMsg = document.getElementById('firebase-login-bar-message');
    const emailInput = document.getElementById('firebase-login-bar-email');
    const pwdInput = document.getElementById('firebase-login-bar-password');
    const barStatus = document.getElementById('firebase-login-bar-status');

    if (isLoggedIn) {
      emailInput.style.display = 'none';
      pwdInput.style.display = 'none';
      loginBtn.style.display = 'none';
      logoutBtn.style.display = '';
      statusMsg.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#2ecc71"></i>';
      statusMsg.style.display = '';
      barStatus.style.display = '';
      barStatus.style.flex = '1';
      barContent.style.background = '#f6fff7';
      barContent.style.borderColor = '#b7f5c2';
      barContent.style.boxShadow = '0 2px 8px #d2f5e3';
      barContent.style.minWidth = 'unset';
      barContent.style.maxWidth = 'unset';
      barContent.style.justifyContent = 'center';
      barContent.style.padding = '8px 12px';
    } else {
      emailInput.style.display = '';
      pwdInput.style.display = '';
      loginBtn.style.display = '';
      logoutBtn.style.display = 'none';
      statusMsg.innerHTML = '';
      statusMsg.style.display = 'none';
      barStatus.style.display = 'none';
      barStatus.style.flex = '0';
      barContent.style.background = '#fff';
      barContent.style.borderColor = '#eee';
      barContent.style.boxShadow = '0 2px 8px #eee';
      barContent.style.minWidth = 'unset';
      barContent.style.maxWidth = 'unset';
      barContent.style.justifyContent = '';
      barContent.style.padding = '8px 16px';
    }
    bar.style.position = 'fixed'; 
    bar.style.right = '20px'; 
    bar.style.bottom = '20px'; 
    bar.style.zIndex = '9999';
  }

  // ----- [關鍵方法] 全域強制驗證 -----
  window.verifyFireworkAuth = async function() {
    const user = auth.currentUser;
    if (!user) {
      window.dispatchEvent(new Event('firework-force-logout'));
      return false;
    }
    try {
      const token = await user.getIdToken(true);
      localStorage.setItem('firebase_id_token', token);
      return true;
    } catch (e) {
      // 明確處理帳號被停用的錯誤碼
      const disabledCodes = [
        'auth/user-disabled',
        'auth/user-token-expired', 
        'auth/invalid-user-token',
        'auth/user-not-found'
      ];
      
      if (disabledCodes.includes(e.code)) {
        console.error("⛔ 帳號已被停用或 Token 已失效:", e.code, e.message);
        showToast('您的帳號已被停用，請聯繫管理員', 'error', 5000);
      } else {
        console.error("⛔ Auth Check Failed:", e.code, e.message);
        showToast('驗證失敗，請重新登入', 'error', 4000);
      }
      
      window.dispatchEvent(new Event('firework-force-logout'));
      return false;
    }
  };

  // ----- 監聽強制登出 -----
  window.addEventListener('firework-force-logout', () => {
    console.log("⚠️ 執行強制登出程序...");
    auth.signOut();
    localStorage.removeItem('firebase_id_token');
    updateUIState(false);
    window.dispatchEvent(new Event('firework-logout-success'));
  });

  // ----- 取得 DOM 元素 -----
  const loginForm = document.getElementById('firebase-login-form');
  const loginBtn = document.getElementById('firebase-login-bar-btn');
  const logoutBtn = document.getElementById('firebase-logout-bar-btn');
  const emailInput = document.getElementById('firebase-login-bar-email');
  const pwdInput = document.getElementById('firebase-login-bar-password');
  const statusMsg = document.getElementById('firebase-login-bar-message');

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
    loginBtn.style.color = '#2d8cf0';
    
    try {
      await auth.signInWithEmailAndPassword(email, password);
      // 登入成功的 toast 會在 onAuthStateChanged 中顯示
      return true;
    } catch(e) {
      loginBtn.style.color = '#e74c3c';
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
      const token = await user.getIdToken();
      localStorage.setItem('firebase_id_token', token);
      updateUIState(true);
      showToast('登入成功', 'success', 2500);
      window.dispatchEvent(new Event('firework-login-success'));
    } else {
      localStorage.removeItem('firebase_id_token');
      updateUIState(false);
    }
  });
}