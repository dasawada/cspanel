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

  if (!window.firebase) {
    await Promise.all([
      new Promise(r => {
        const s = document.createElement('script');
        s.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js";
        s.onload = r;
        document.head.appendChild(s);
      }),
      new Promise(r => {
        const s = document.createElement('script');
        s.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js";
        s.onload = r;
        document.head.appendChild(s);
      })
    ]);
  }

  // 3. 初始化 Firebase
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
  const bar = document.getElementById('firebase-login-bar');
  const barContent = document.getElementById('firebase-login-bar-content');
  const loginBtn = document.getElementById('firebase-login-bar-btn');
  const logoutBtn = document.getElementById('firebase-logout-bar-btn');
  const statusMsg = document.getElementById('firebase-login-bar-message');
  const emailInput = document.getElementById('firebase-login-bar-email');
  const pwdInput = document.getElementById('firebase-login-bar-password');
  const barStatus = document.getElementById('firebase-login-bar-status');

  // 監聽 input active 時 enter 送出登入
  [emailInput, pwdInput].forEach(input => {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        loginBtn.click();
      }
    });
  });

  let lastLoginFail = false;

  loginBtn.onclick = async function() {
    statusMsg.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    loginBtn.style.color = '#2d8cf0';
    loginBtn.removeAttribute('title');
    lastLoginFail = false;
    try {
      const email = emailInput.value;
      const password = pwdInput.value;
      const userCred = await auth.signInWithEmailAndPassword(email, password);
      const token = await userCred.user.getIdToken();
      localStorage.setItem('firebase_id_token', token);
      statusMsg.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#2ecc71"></i>';
      window.dispatchEvent(new Event('firework-login-success'));
    } catch(e) {
      // 不顯示錯誤訊息，loginBtn 變紅，hover 顯示 title
      loginBtn.style.color = '#e74c3c';
      loginBtn.title = '登入失敗，請檢查帳號密碼';
      lastLoginFail = true;
      statusMsg.innerHTML = '';
    }
  };
  // 失敗後 hover loginBtn 顯示 title，移開時保留紅色
  loginBtn.onmouseenter = function() {
    if (lastLoginFail) {
      loginBtn.title = '登入失敗，請檢查帳號密碼';
    }
  };
  loginBtn.onmouseleave = function() {
    if (lastLoginFail) {
      loginBtn.title = '';
    }
  };

  logoutBtn.onclick = function() {
    auth.signOut();
    localStorage.removeItem('firebase_id_token');
    window.dispatchEvent(new Event('firework-logout-success'));
    // UI 狀態會由 onAuthStateChanged 控制
  };

  // 4. 狀態監聽，登入後收合顯示綠色勾勾
  auth.onAuthStateChanged(async function(user) {
    if (user) {
      const token = await user.getIdToken();
      localStorage.setItem('firebase_id_token', token);
      // 收合欄位，只顯示綠色勾勾
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
      window.dispatchEvent(new Event('firework-login-success'));
    } else {
      // 展開欄位
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
      localStorage.removeItem('firebase_id_token');
    }
    // 右下角浮動樣式強制
    bar.style.position = 'fixed';
    bar.style.right = '20px';
    bar.style.bottom = '20px';
    bar.style.zIndex = '9999';
    bar.style.margin = '0';
    bar.style.padding = '0';
  });
}