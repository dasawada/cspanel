// GitHub Pages 已退役。把舊網址原樣（路徑、query、hash）送到 Netlify 同站台。
(function () {
  var NETLIFY = 'https://stirring-pothos-28253d.netlify.app';
  var path = location.pathname.replace(/^\/cspanel(?=\/|$)/, '');
  if (path === '' || path === '/') path = '/panel_all.html';
  location.replace(NETLIFY + path + location.search + location.hash);
})();
