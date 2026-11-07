// GitHub Pages 已退役。把舊網址送到 Netlify 同站台的「正規化路徑」，保留 query 與 hash。
// 對照表與 cspanel_netlify/public/script/routes.js 的 legacyPairs() 一致；不在表中的路徑原樣帶過去，
// 由 Netlify 端的 301 與頁內 canonical-route.js 再接手。
(function () {
  var NETLIFY = 'https://stirring-pothos-28253d.netlify.app';
  var CANONICAL = {
    '/': '/panel.html',
    '/panel_all.html': '/panel.html',
    '/panel_all_v2.html': '/dev/panel-v2.html',
    '/course_debug.html': '/course-debug.html',
    '/新增資料夾/轉單小工具.html': '/orders.html',
    '/zvmeetingsearchall.html': '/meetings.html',
    '/TESTwhosthere.html': '/whos-there.html',
    '/dealId-to-ocid.html': '/deal-to-ocid.html',
    '/nanitrans3.html': '/message-classifier.html',
    '/SA_iframe.html': '/fragments/sa-sheet.html',
    '/assist_list_scale.html': '/fragments/assist-schedule.html',
    '/ggsheet.html': '/fragments/meeting-convert.html',
    '/DT_report.html': '/fragments/device-test-report.html',
    '/hhnueyfrsoj1na8pjj.html': '/fragments/course-diaries.html',
    '/xu7fwfh93rbyorxkds.html': '/fragments/classlog.html',
    '/bxtextareamodle.html': '/fragments/bx-messenger.html',
    '/fu_s_popup.html': '/fragments/substitute-search.html',
    '/gotogo.html': '/fragments/connecting.html',
    '/api-rate-test.html': '/dev/api-rate-test.html',
    '/time-gate-test.html': '/dev/time-gate-test.html',
    '/ua-debug.html': '/dev/ua-debug.html',
    '/bitrix24-calibration.html': '/dev/bitrix24-calibration.html'
  };
  var path = location.pathname.replace(/^\/cspanel(?=\/|$)/, '');
  try { path = decodeURIComponent(path); } catch (e) {}
  if (path === '') path = '/';
  var target = CANONICAL[path] || path;
  location.replace(NETLIFY + encodeURI(target) + location.search + location.hash);
})();
