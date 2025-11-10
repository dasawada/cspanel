window.addEventListener('firework-login-success', async () => {
  try {
    // 從 Firebase Auth 獲取當前用戶的 ID Token
    const user = window.firebase.auth().currentUser;
    if (!user) {
      console.error('用戶未登入');
      return;
    }

    const token = await user.getIdToken();

    // 呼叫後端 API 獲取受保護內容
    const response = await fetch('/.netlify/functions/order-tool-api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'getProtectedTabs'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      // 插入 tabs 內容
      const tabsPlaceholder = document.getElementById('auth-protected-tabs-placeholder');
      if (tabsPlaceholder && data.tabsHTML) {
        tabsPlaceholder.innerHTML = data.tabsHTML;
      }
      
      // 插入 IP 搜尋內容
      const ipPlaceholder = document.getElementById('auth-protected-ip-placeholder');
      if (ipPlaceholder && data.ipHTML) {
        ipPlaceholder.innerHTML = data.ipHTML;
        
        // 動態 import 並初始化 IP 搜尋邏輯
        try {
          const { initIPSearch } = await import('./IP_search.js');
          await initIPSearch();
        } catch (error) {
          console.error('Failed to initialize IP search:', error);
        }
      }
    } else {
      console.error('Failed to load protected content:', data.error);
    }
  } catch (error) {
    console.error('Error fetching protected content:', error);
  }
});

window.addEventListener('firework-logout-success', () => {
  const tabsPlaceholder = document.getElementById('auth-protected-tabs-placeholder');
  if (tabsPlaceholder) {
    tabsPlaceholder.innerHTML = '';
  }
  const ipPlaceholder = document.getElementById('auth-protected-ip-placeholder');
  if (ipPlaceholder) {
    ipPlaceholder.innerHTML = '';
  }
});