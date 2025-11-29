import { refreshMeetingPanel } from './meeting-now-includefetch.js';
import { initProtectedTabs, clearProtectedTabs } from './auth-protected-tabs.js';

window.addEventListener('firework-login-success', async () => {
  console.log('Mediator: 初始化登入後模組...');
  
  // 平行執行或依序執行皆可，視依賴關係而定
  // 這裡示範平行啟動以加快速度
  await Promise.all([
    refreshMeetingPanel(),
    initProtectedTabs()
  ]);
});

window.addEventListener('firework-logout-success', () => {
  console.log('Mediator: 清理模組...');
  refreshMeetingPanel(); // 假設它內部有處理登出邏輯
  clearProtectedTabs();
});