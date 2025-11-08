window.addEventListener('firework-login-success', async () => {
  try {
    // 從 Firestore 獲取內容（假設集合為 'protectedContent'，文檔 ID 為 'tabsAndIP'）
    const docRef = window.firebase.firestore().collection('protectedContent').doc('tabsAndIP');
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {  // 修復：exists 是屬性，不是方法
      const data = docSnap.data();
      const tabsHTML = data.tabsHTML;
      const ipHTML = data.ipHTML;
      
      // 插入 tabs 內容
      const tabsPlaceholder = document.getElementById('auth-protected-tabs-placeholder');
      if (tabsPlaceholder) {
        tabsPlaceholder.innerHTML = tabsHTML;
      }
      
      // 插入 IP 搜尋內容
      const ipPlaceholder = document.getElementById('auth-protected-ip-placeholder');
      if (ipPlaceholder) {
        ipPlaceholder.innerHTML = ipHTML;
        
        // 動態 import 並初始化 IP 搜尋邏輯
        try {
          const { initIPSearch } = await import('./IP_search.js');
          await initIPSearch();
        } catch (error) {
          console.error('Failed to initialize IP search:', error);
        }
      }
    } else {
      console.error('Protected content not found in Firestore.');
    }
  } catch (error) {
    console.error('Failed to fetch protected content:', error);
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