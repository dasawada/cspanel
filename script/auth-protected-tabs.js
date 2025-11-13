window.addEventListener('firework-login-success', async () => {
  // ===== 新增重試機制 =====
  async function fetchProtectedContentWithRetry(retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const token = localStorage.getItem('firebase_id_token');
        
        if (!token) {
          // 嘗試從 Firebase 取得新 token
          const user = window.firebase.auth().currentUser;
          if (user) {
            const newToken = await user.getIdToken(true);
            localStorage.setItem('firebase_id_token', newToken);
            return fetchProtectedContentWithRetry(retries - i - 1);
          }
          throw new Error('Token 不存在');
        }

        const response = await fetch('https://stirring-pothos-28253d.netlify.app/.netlify/functions/order-tool-api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            action: 'getProtectedTabs'
          })
        });

        // 401 錯誤,嘗試更新 token
        if (response.status === 401 && i < retries - 1) {
          console.log('🔄 Token 過期,嘗試更新...');
          const user = window.firebase.auth().currentUser;
          if (user) {
            const newToken = await user.getIdToken(true);
            localStorage.setItem('firebase_id_token', newToken);
            continue; // 重試
          }
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        if (i === retries - 1) throw error;
        console.log(`⚠️ 重試 ${i + 1}/${retries}...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  try {
    console.log('🔐 Login success event triggered');
    
    const data = await fetchProtectedContentWithRetry();
    console.log('✅ Received data:', data);
    
    if (data.success) {
      // 插入 tabs 內容
      const tabsPlaceholder = document.getElementById('auth-protected-tabs-placeholder');
      if (tabsPlaceholder && data.tabsHTML) {
        tabsPlaceholder.innerHTML = data.tabsHTML;
        console.log('✅ Tabs content inserted');
      }
      
      // 插入 IP 搜尋內容
      const ipPlaceholder = document.getElementById('auth-protected-ip-placeholder');
      if (ipPlaceholder && data.ipHTML) {
        ipPlaceholder.innerHTML = data.ipHTML;
        console.log('✅ IP search content inserted');
        
        // 動態 import 並初始化 IP 搜尋邏輯
        try {
          const { initIPSearch } = await import('./IP_search.js');
          await initIPSearch();
          console.log('✅ IP search initialized');
        } catch (error) {
          console.error('❌ Failed to initialize IP search:', error);
        }
      }
    } else {
      console.error('❌ Failed to load protected content:', data.error);
    }
  } catch (error) {
    console.error('❌ Error fetching protected content:', error);
  }
});

window.addEventListener('firework-logout-success', () => {
  console.log('🚪 Logout success event triggered');
  const tabsPlaceholder = document.getElementById('auth-protected-tabs-placeholder');
  if (tabsPlaceholder) {
    tabsPlaceholder.innerHTML = '';
  }
  const ipPlaceholder = document.getElementById('auth-protected-ip-placeholder');
  if (ipPlaceholder) {
    ipPlaceholder.innerHTML = '';
  }
});