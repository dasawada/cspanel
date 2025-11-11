window.addEventListener('firework-login-success', async () => {
  try {
    console.log('🔐 Login success event triggered');
    
    // 改為使用 localStorage 中的 token（與 dragb_msg_pnl.js 一致）
    const token = localStorage.getItem('firebase_id_token');
    
    if (!token) {
      console.error('❌ Token 不存在於 localStorage');
      return;
    }

    console.log('🎫 Token obtained from localStorage:', token.substring(0, 20) + '...');

    // 呼叫後端 API 獲取受保護內容
    console.log('📡 Fetching protected content...');
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

    console.log('📥 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Response error:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data = await response.json();
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