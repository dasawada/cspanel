import { readFile } from 'node:fs/promises';

const ACCESS_CLIENT_URL = 'https://stirring-pothos-28253d.netlify.app/access-client.js';
const ACCESS_CLIENT_SOURCE = await readFile(
  new URL('../../cspanel_netlify/access-client.js', import.meta.url),
  'utf8'
);

const DEFAULT_FEATURES = [
  'cache_refresh', 'chat', 'config', 'course_bundle', 'course_debug', 'ipsearch',
  'orders', 'schedule', 'shorturl', 'students', 'workspace'
];

const DEFAULT_MODULES = [
  'meeting-now', 'meeting-match', 'meeting-all', 'meeting-shell', 'protected',
  'optitle', 'fudausearch', 'shrturl', 'dt', 'consultant', 'assist', 'canned',
  'roof', 'tooldl'
];

export async function installAccessFixture(page, {
  features = DEFAULT_FEATURES,
  modules = DEFAULT_MODULES,
  revision = 1,
  theme = 'olive'
} = {}) {
  await page.route(ACCESS_CLIENT_URL, (route) => route.fulfill({
    status: 200,
    contentType: 'text/javascript; charset=utf-8',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: ACCESS_CLIENT_SOURCE
  }));

  await page.route('**/api/session', (route) => {
    const method = route.request().method();
    if (method === 'HEAD') return route.fulfill({ status: 204 });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ revision, features, modules })
    });
  });

  await page.addInitScript(({ selectedTheme }) => {
    window.CSPANEL_API_BASE = window.location.origin;
    localStorage.setItem('cspanel.theme.v1', selectedTheme);
    const user = {
      uid: 'access-fixture-user',
      async getIdToken(forceRefresh) {
        return forceRefresh ? 'access-fixture-token-refreshed' : 'access-fixture-token';
      }
    };
    const auth = {
      currentUser: user,
      onAuthStateChanged(callback) {
        const timer = setTimeout(() => callback(this.currentUser), 50);
        return () => clearTimeout(timer);
      },
      async signOut() { this.currentUser = null; },
      async signInWithEmailAndPassword() {
        this.currentUser = user;
        return { user };
      }
    };
    window.auth = auth;
    window.firebaseSignOut = () => auth.signOut();
    window.firebase = {
      apps: [{}],
      initializeApp: () => ({}),
      auth: () => auth,
      firestore: () => ({})
    };
  }, { selectedTheme: theme });
}
