import { initializeApp } from './vendor/firebase-app.js';
import {
  initializeAuth,
  indexedDBLocalPersistence,
  onAuthStateChanged,
  onIdTokenChanged
} from './vendor/firebase-auth-web-extension.js';

const firebaseConfig = {
    apiKey: "AIzaSyAhgA5nFE3bLTVyudYjKctSpnTCIgORg8M",
    authDomain: "cstoolsapi.firebaseapp.com",
    projectId: "cstoolsapi",
    appId: "1:632885029336:web:f491b9cc28fe3f2504aaad"
};

const app  = initializeApp(firebaseConfig);
const auth = initializeAuth(app, { persistence: indexedDBLocalPersistence });

// 狀態同步到 session storage
async function push(state) {
  await chrome.storage.session.set({ authState: state });
}

// 1. 一登出立即同步狀態
onAuthStateChanged(auth, user => push(user ? 'SIGNED_IN' : 'SIGNED_OUT'));

// 2. token 一失效立即 signOut
onIdTokenChanged(auth, async user => {
  if (!user) return;
  try { await user.getIdToken(true); }
  catch { await auth.signOut(); }
});

// 3. 定時強制驗證，確保帳號被拔權後能同步登出
setInterval(async () => {
  const u = auth.currentUser;
  if (!u) return;
  try { await u.getIdToken(true); }
  catch { await auth.signOut(); }
}, 180000); // 3分鐘驗證一次，可調短