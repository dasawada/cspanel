// GitHub Pages 已退役。把舊網址送到 Netlify 同站台的「正規化路徑」，保留 query 與 hash。
// 對照表與 cspanel_netlify/public/script/routes.js 的 legacy → href 一致；不在表中的路徑原樣帶過去，
// 由 Netlify 端的 301 與頁內 canonical-route.js 再接手。
(function () {
  var NETLIFY = 'https://stirring-pothos-28253d.netlify.app';
  var CANONICAL = {
    '/': '/panel',
    '/panel_all.html': '/panel',
    '/course_debug.html': '/course-debug',
    '/新增資料夾/轉單小工具.html': '/orders/',
    '/zvmeetingsearchall.html': '/meetings',
    '/schedule-inspect.html': '/schedule-inspect',
    '/tutor-schedule.html': '/tutor-schedule',
    '/TESTwhosthere.html': '/whos-there',
    '/dealId-to-ocid.html': '/deal-to-ocid',
    '/nanitrans3.html': '/message-classifier',
    '/paint.html': '/paint'
  };
  var path = location.pathname.replace(/^\/cspanel(?=\/|$)/, '');
  try { path = decodeURIComponent(path); } catch (e) {}
  if (path === '') path = '/';
  var target = CANONICAL[path] || path;
  location.replace(NETLIFY + encodeURI(target) + location.search + location.hash);
})();
