import { refreshMeetingPanel } from './meeting-now-includefetch.js';
// 如有其他模組也可在這裡 import

window.addEventListener('firework-login-success', () => {
  refreshMeetingPanel();
  // 其他需要刷新功能也可在這裡呼叫
});

window.addEventListener('firework-logout-success', () => {
  refreshMeetingPanel();
  // 其他登出後刷新
});
