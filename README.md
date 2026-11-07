# cspanel（已退役）

這個 repo 原本是客服面板的 GitHub Pages 前端（`https://dasawada.github.io/cspanel/`）。

前端已經連同完整 git 歷史併入 [`dasawada/cspanel_netlify`](https://github.com/dasawada/cspanel_netlify) 的 `public/` 目錄，
和 API（Netlify edge functions）同一個站台、同源發佈：

**https://stirring-pothos-28253d.netlify.app/panel.html**

這裡只留下跳轉殼（`index.html`、`404.html`、`redirect.js`），把舊書籤的路徑、query、hash 原樣帶到新站台。
非 HTML 的直接請求（`<link>`、`<script>`、zip 下載）不會被跳轉，程式內已沒有這類跨站引用。

之後的前端開發一律在 `cspanel_netlify/public/` 進行；切換步驟見該 repo 的 `docs/runbooks/github-pages-retirement.md`。
