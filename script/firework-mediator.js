import { initMeetingNowPanel, clearMeetingNowPanel } from './meeting-now-includefetch.js';
import { initProtectedTabs, clearProtectedTabs } from './auth-protected-tabs.js';
import { initOptitlePanel, clearOptitlePanel } from './optitleGG.js';
import { initFudausearchPanel, clearFudausearchPanel } from './fusearch-panel.js';
import { initShrtUrlPanel, clearShrtUrlPanel } from './shrturl.js';
import { 
  initDTPanel, clearDTPanel,
  initConsultantPanel, clearConsultantPanel,
  initAssistPanel, clearAssistPanel 
} from './toggle-panels.js';
import { initMeetingMatchCheck, clearMeetingMatchCheck } from './meeting-match-check.js';
import { initAllMeetingCompare, clearAllMeetingCompare } from './all-meeting-compare.js';
import { initMeetingSearchPanel, clearMeetingSearchPanel } from './meeting-search-panel-module.js';
import { initMeetingAll, clearMeetingAll } from './meeting-all-module.js';
import { initCannedMessagesPanel, clearCannedMessagesPanel } from './dragb_msg_pnl.js';
import { initRoofButtons, clearRoofButtons } from './roof-buttons.js';
import { initToolDownloadPanel, clearToolDownloadPanel } from './tool-download-panel.js';

// ===== 全域認證狀態管理 =====
let globalAuthInterceptor = null;
let authCheckInterval = null;
const AUTH_CHECK_INTERVAL_MS = 60000; // 每 60 秒檢查一次

// ===== 全域點擊攔截器 =====
function setupGlobalAuthInterceptor() {
  if (globalAuthInterceptor) return;
  
  globalAuthInterceptor = async (e) => {
    const target = e.target;
    const isInteractive = target.closest('button, a, [onclick], [role="button"], .clickable, input[type="submit"], input[type="button"]');
    
    if (!isInteractive) return;
    
    if (typeof window.verifyFireworkAuth === 'function') {
      const isValid = await window.verifyFireworkAuth();
      if (!isValid) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log('⛔ [Mediator] 全域攔截：帳號已失效，操作被阻止');
        return false;
      }
    }
  };
  
  document.addEventListener('click', globalAuthInterceptor, true);
  console.log('Mediator: 已啟用全域認證攔截器 🛡️');
}

function removeGlobalAuthInterceptor() {
  if (globalAuthInterceptor) {
    document.removeEventListener('click', globalAuthInterceptor, true);
    globalAuthInterceptor = null;
    console.log('Mediator: 已移除全域認證攔截器');
  }
}

// ===== 定期背景認證檢查 =====
function startPeriodicAuthCheck() {
  if (authCheckInterval) return;
  
  authCheckInterval = setInterval(async () => {
    console.log('Mediator: 執行定期認證檢查...');
    if (typeof window.verifyFireworkAuth === 'function') {
      const isValid = await window.verifyFireworkAuth();
      if (!isValid) {
        console.log('⛔ [Mediator] 定期檢查發現帳號已失效');
        stopPeriodicAuthCheck();
      }
    }
  }, AUTH_CHECK_INTERVAL_MS);
  
  console.log(`Mediator: 已啟動定期認證檢查（每 ${AUTH_CHECK_INTERVAL_MS / 1000} 秒）⏰`);
}

function stopPeriodicAuthCheck() {
  if (authCheckInterval) {
    clearInterval(authCheckInterval);
    authCheckInterval = null;
    console.log('Mediator: 已停止定期認證檢查');
  }
}

// ===== 狀態廣播工具 =====
function broadcastAuthState(state) {
  window.dispatchEvent(new CustomEvent('fw-auth-state-change', { detail: { state } }));
}

// ===== 初始化所有模組 =====
async function initAllModules() {
  console.log('Mediator: 初始化登入後模組...');
  
  broadcastAuthState('login-start');
  
  setupGlobalAuthInterceptor();
  startPeriodicAuthCheck();
  
  initMeetingSearchPanel('meeting-search-panel-placeholder');
  
  const results = await Promise.allSettled([
    initMeetingNowPanel(),
    initProtectedTabs(),
    Promise.resolve(initOptitlePanel('optitle-placeholder')),
    Promise.resolve(initFudausearchPanel('fudausearch-placeholder')),
    Promise.resolve(initShrtUrlPanel('shrturl-placeholder')),
    Promise.resolve(initDTPanel('dt-panel-placeholder')),
    Promise.resolve(initConsultantPanel('consultant-panel-placeholder')),
    Promise.resolve(initAssistPanel('assist-panel-placeholder')),
    Promise.resolve(initMeetingMatchCheck()),
    Promise.resolve(initMeetingAll()),
    Promise.resolve(initCannedMessagesPanel(null, { left: 1300, top: 75 })),
    Promise.resolve(initRoofButtons('roof-buttons-placeholder')),
    Promise.resolve(initToolDownloadPanel('tool-download-placeholder')),
    initAllMeetingCompare().catch(err => {
      console.error('initAllMeetingCompare 失敗:', err);
    })
  ]);
  
  broadcastAuthState('login-ready');
  
  console.log('Mediator: 所有模組初始化完成 ✅');
}

// ===== 清理所有模組 =====
function clearAllModules() {
  console.log('Mediator: 清理模組...');
  
  broadcastAuthState('logout-start');
  
  removeGlobalAuthInterceptor();
  stopPeriodicAuthCheck();
  
  try { clearMeetingNowPanel(); } catch (e) { console.error('clearMeetingNowPanel 失敗:', e); }
  try { clearProtectedTabs(); } catch (e) { console.error('clearProtectedTabs 失敗:', e); }
  try { clearOptitlePanel('optitle-placeholder'); } catch (e) { console.error('clearOptitlePanel 失敗:', e); }
  try { clearFudausearchPanel('fudausearch-placeholder'); } catch (e) { console.error('clearFudausearchPanel 失敗:', e); }
  try { clearShrtUrlPanel('shrturl-placeholder'); } catch (e) { console.error('clearShrtUrlPanel 失敗:', e); }
  try { clearDTPanel('dt-panel-placeholder'); } catch (e) { console.error('clearDTPanel 失敗:', e); }
  try { clearConsultantPanel('consultant-panel-placeholder'); } catch (e) { console.error('clearConsultantPanel 失敗:', e); }
  try { clearAssistPanel('assist-panel-placeholder'); } catch (e) { console.error('clearAssistPanel 失敗:', e); }
  try { clearMeetingMatchCheck(); } catch (e) { console.error('clearMeetingMatchCheck 失敗:', e); }
  try { clearMeetingAll(); } catch (e) { console.error('clearMeetingAll 失敗:', e); }
  try { clearAllMeetingCompare(); } catch (e) { console.error('clearAllMeetingCompare 失敗:', e); }
  try { clearMeetingSearchPanel('meeting-search-panel-placeholder'); } catch (e) { console.error('clearMeetingSearchPanel 失敗:', e); }
  try { clearCannedMessagesPanel(); } catch (e) { console.error('clearCannedMessagesPanel 失敗:', e); }
  try { clearRoofButtons('roof-buttons-placeholder'); } catch (e) { console.error('clearRoofButtons 失敗:', e); }
  try { clearToolDownloadPanel('tool-download-placeholder'); } catch (e) { console.error('clearToolDownloadPanel 失敗:', e); }
  
  broadcastAuthState('logout-complete');
  
  console.log('Mediator: 所有模組已清理 🧹');
}

// ===== 監聽登入成功事件 =====
window.addEventListener('firework-login-success', () => {
  initAllModules();
});

// ===== 監聽登出成功事件 =====
window.addEventListener('firework-logout-success', () => {
  clearAllModules();
});

// ===== 頁面載入時檢查現有登入狀態 =====
(async function checkExistingAuth() {
  broadcastAuthState('init-logged-out');
  
  const waitForFirebase = () => {
    return new Promise((resolve) => {
      const check = () => {
        if (window.firebase?.auth) {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  };
  
  await waitForFirebase();
  
  const token = localStorage.getItem('firebase_id_token');
  if (token) {
    await initAllModules();
  }
})();