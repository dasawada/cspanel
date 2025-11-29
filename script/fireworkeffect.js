export async function loadLoginPanel() {
  const panelHtml = `
    <div id="firebase-login-bar" style="position:fixed;right:20px;bottom:20px;z-index:9999;width:auto;min-width:unset;max-width:unset;">
      <div id="firebase-login-bar-content" style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #eee;border-radius:24px;padding:8px 16px;box-shadow:0 2px 8px #eee;transition:all .3s;width:auto;min-width:unset;max-width:unset;">
        <div id="firebase-login-bar-status" style="flex:1;color:#333;font-size:15px;">
          <span id="firebase-login-bar-message"><i class="fa-solid fa-right-to-bracket"></i></span>
        </div>
        <input type="email" id="firebase-login-bar-email" placeholder="Email" style="width:110px;font-size:13px;padding:2px 6px;border-radius:4px;border:1px solid #ddd;">
        <input type="password" id="firebase-login-bar-password" placeholder="密碼" style="width:80px;font-size:13px;padding:2px 6px;border-radius:4px;border:1px solid #ddd;">
        <i id="firebase-login-bar-btn" class="fa-solid fa-play" style="font-size:18px;color:#2d8cf0;cursor:pointer;display:flex;align-items:center;justify-content:center;"></i>
        <i id="firebase-logout-bar-btn" class="fa-solid fa-right-to-bracket" style="display:none;font-size:18px;color:#aaa;cursor:pointer;display:flex;align-items:center;justify-content:center;"></i>
      </div>
    </div>
  `;
  if (!document.getElementById('firebase-login-bar')) {
    document.body.insertAdjacentHTML('beforeend', panelHtml);
  }

  // SDK Loading ... (保持原樣)
  if (!window.firebase) {
    await Promise.all([
      new Promise(r => { const s = document.createElement('script'); s.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"; s.onload = r; document.head.appendChild(s); }),
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

  // ----- UI 狀態更新邏輯 (抽離) -----
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
  // 呼叫此方法代表：「我要執行敏感操作，請現在、立刻確認此人是否真的有效」
  window.verifyFireworkAuth = async function() {
    const user = auth.currentUser;
    if (!user) {
      // 根本沒登入，直接踢出
      window.dispatchEvent(new Event('firework-force-logout'));
      return false;
    }
    try {
      // forceRefresh: true 是核心
      // 若帳號被停用，這裡會拋出 'auth/user-disabled' 錯誤
      // 若 Token 被竄改，這裡也會驗證失敗
      const token = await user.getIdToken(true);
      localStorage.setItem('firebase_id_token', token); // 更新本地有效 Token
      return true;
    } catch (e) {
      console.error("⛔ Auth Check Failed (Account Disabled/Expired):", e.code, e.message);
      // 驗證失敗 -> 視為帳號失效 -> 強制登出流程
      // 這裡不只是 return false，更要主動殺死 session
      window.dispatchEvent(new Event('firework-force-logout'));
      return false;
    }
  };

  // ----- 監聽強制登出 -----
  // 這是唯一的「登出入口」，無論是手動按、API 錯誤、還是驗證失敗，最後都彙整到這裡
  window.addEventListener('firework-force-logout', () => {
    console.log("⚠️ 執行強制登出程序...");
    auth.signOut();
    localStorage.removeItem('firebase_id_token');
    updateUIState(false);
    // 廣播給其他元件 (Tabs, Mediator) 讓它們清空內容
    window.dispatchEvent(new Event('firework-logout-success'));
  });

  // ----- 標準事件綁定 -----
  const loginBtn = document.getElementById('firebase-login-bar-btn');
  const logoutBtn = document.getElementById('firebase-logout-bar-btn');
  const emailInput = document.getElementById('firebase-login-bar-email');
  const pwdInput = document.getElementById('firebase-login-bar-password');
  const statusMsg = document.getElementById('firebase-login-bar-message');
  let lastLoginFail = false;

  [emailInput, pwdInput].forEach(input => {
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginBtn.click(); });
  });

  loginBtn.onclick = async function() {
    statusMsg.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    loginBtn.style.color = '#2d8cf0';
    lastLoginFail = false;
    try {
      await auth.signInWithEmailAndPassword(emailInput.value, pwdInput.value);
    } catch(e) {
      loginBtn.style.color = '#e74c3c';
      loginBtn.title = '登入失敗，請檢查帳號密碼';
      lastLoginFail = true;
      statusMsg.innerHTML = '';
    }
  };

  loginBtn.onmouseenter = () => { if (lastLoginFail) loginBtn.title = '登入失敗，請檢查帳號密碼'; };
  loginBtn.onmouseleave = () => { if (lastLoginFail) loginBtn.title = ''; };

  // 手動登出按鈕也走強制登出流程，保持路徑一致
  logoutBtn.onclick = function() {
    window.dispatchEvent(new Event('firework-force-logout'));
  };

  auth.onAuthStateChanged(async function(user) {
    if (user) {
      // 登入時只做 UI 更新，不主動 check disabled (由操作觸發)
      const token = await user.getIdToken();
      localStorage.setItem('firebase_id_token', token);
      updateUIState(true);
      window.dispatchEvent(new Event('firework-login-success'));
    } else {
      localStorage.removeItem('firebase_id_token');
      updateUIState(false);
      // 這裡不 dispatch logout，防止初始化時誤觸
    }
  });
}

// ===== 新增：登入成功後的保護邏輯 =====
window.addEventListener('firework-login-success', async () => {
  const tabsPlaceholder = document.getElementById('auth-protected-tabs-placeholder');
  const ipPlaceholder = document.getElementById('auth-protected-ip-placeholder');

  // ===== 1. 同步阻斷攔截器 (Block-Verify-Replay) =====
  // 解決「點擊 Tab -> 驗證中 -> Tab 已切換 -> 驗證失敗」的時序漏洞
  const interceptor = (e) => {
    const target = e.target;
    
    // 檢查是否為「已驗證通過的重播事件」
    // 如果標記存在，代表這是我們驗證後手動觸發的，予以放行
    if (target.dataset.authVerified === 'true') {
      delete target.dataset.authVerified; // 清除標記
      return;
    }

    // A. 立即阻斷：在驗證結果出來前，不允許任何事件傳遞
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation(); // 確保連同層級的 Bootstrap Tab 監聽器都收不到事件

    console.log('🔒 操作攔截：正在與後端確認帳號狀態...');

    // B. 啟動異步驗證
    (async () => {
      if (typeof window.verifyFireworkAuth !== 'function') {
        console.error('Verify function missing');
        return;
      }

      // 呼叫 fireworkeffect.js 的驗證
      // 若帳號被停用，這裡會 return false 並觸發 force-logout
      const isValid = await window.verifyFireworkAuth();

      if (isValid) {
        console.log('✅ 驗證通過，重播操作');
        // C. 驗證成功：標記並重播點擊
        target.dataset.authVerified = 'true';
        target.click(); 
      } else {
        console.log('⛔ 帳號異常(停用/失效)，操作已作廢');
        // UI 會由 firework-force-logout 事件自動清空
      }
    })();
  };
  
  // 使用 Capture Phase (true) 確保攔截器是第一個執行的
  if (tabsPlaceholder) {
    tabsPlaceholder.removeEventListener('click', interceptor, true);
    tabsPlaceholder.addEventListener('click', interceptor, true);
  }
  if (ipPlaceholder) {
    ipPlaceholder.removeEventListener('click', interceptor, true);
    ipPlaceholder.addEventListener('click', interceptor, true);
  }

  // ===== 2. 內容獲取 (API 層級防護) =====
  async function fetchProtectedContentWithRetry(retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const user = window.firebase?.auth()?.currentUser;
        if (!user) throw new Error('No user');
        
        // 獲取 token 用於 API 呼叫
        const token = await user.getIdToken(); 

        const response = await fetch('https://stirring-pothos-28253d.netlify.app/.netlify/functions/order-tool-api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ action: 'getProtectedTabs' })
        });

        // 若 API 回傳 401 (未授權) 或 403 (禁止)，代表後端已拒絕此 Token
        if (response.status === 401 || response.status === 403) {
          console.warn(`API Access Denied: ${response.status}`);
          if (i < retries - 1) {
             // 嘗試刷新一次 (可能是單純過期)
             try {
               await user.getIdToken(true);
             } catch (refreshErr) {
               // 刷新失敗 (如帳號被停用)，直接拋出 fatal error
               throw new Error('AUTH_FATAL');
             }
             continue;
          } else {
             // 重試耗盡
             throw new Error('AUTH_FATAL');
          }
        }

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();

      } catch (error) {
        // 捕捉到致命驗證錯誤，觸發全域登出
        if (error.message === 'AUTH_FATAL' || error.code === 'auth/user-disabled') {
           console.error('❌ 帳號驗證致命失敗，執行強制登出');
           window.dispatchEvent(new Event('firework-force-logout'));
           return null;
        }
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  // 載入內容
  try {
    const data = await fetchProtectedContentWithRetry();
    if (data && data.success) {
      if (tabsPlaceholder && data.tabsHTML) tabsPlaceholder.innerHTML = data.tabsHTML;
      if (ipPlaceholder && data.ipHTML) {
        ipPlaceholder.innerHTML = data.ipHTML;
        try {
          const { initIPSearch } = await import('./IP_search.js');
          await initIPSearch();
        } catch (error) {
          console.error('Failed to init IP search:', error);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching content:', error);
  }
});

// ===== 3. 登出清理 =====
// 當 firework-force-logout 觸發後，會發送 firework-logout-success
// 這裡負責把已經顯示的內容清空，達成「全部登出」的視覺效果
window.addEventListener('firework-logout-success', () => {
  const tabsPlaceholder = document.getElementById('auth-protected-tabs-placeholder');
  const ipPlaceholder = document.getElementById('auth-protected-ip-placeholder');
  
  if (tabsPlaceholder) tabsPlaceholder.innerHTML = '';
  if (ipPlaceholder) ipPlaceholder.innerHTML = '';
});