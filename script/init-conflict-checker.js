import { ConflictChecker } from './ConflictChecker.js';

// 請求通知權限
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('此瀏覽器不支援通知功能');
    return;
  }
  
  if (Notification.permission !== 'granted') {
    await Notification.requestPermission();
  }
}

// 初始化衝突檢查器
async function initializeConflictChecker() {
  await requestNotificationPermission();
  const checker = new ConflictChecker();
  await checker.start();
}

// DOM 載入完成後初始化
document.addEventListener('DOMContentLoaded', initializeConflictChecker);