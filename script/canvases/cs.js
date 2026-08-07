// 客服畫布 manifest。座標唯一權威來源（CSS 不留幾何）。
// geometryCss 內禁用 z-index —— 疊序一律由 zOrder（帶內排序）供給。
export default {
  id: 'cs',
  name: '客服小工具',
  visibility: 'all', // 預留：部門權限（本期不實作）

  // 共用狀態幾何（原 panels.css 之 .panel_all_container 與伺服器 markup 幾何，逐字）
  // 十一期合併定版：.small-size 收合機制與 .DT_panel/.consultantlistgooglesheet/
  // .assist_googlesheet 幾何隨 checkbox 展開模式退役（三面板收納為 wm 分頁）。
  sharedGeometryCss: `
.panel_all_container { position: relative; width: 100%; height: 100vh; min-height: 800px; overflow: visible; box-sizing: border-box; margin: 0; padding: 10px; gap: 10px; height: auto; position: absolute; left: 0px; top: 0px; border: 10px; padding: 10px; margin: 10px; }
/* 伺服器注入 markup 的幾何（repo 內無模板，class 為既定契約）。
   第三期：.idsearchpanel／.ClassLogpanel 為死樣式（實測伺服器不再注入該 markup，
   真實 markup 只有 .panel-tabs-container 與 .IPsearch_in_panelALL），整組移除。
   十一期：原四面板共用 flex/transition 行只剩 IPsearch 一個消費者，
   transition/box-sizing 併入本行、共用行退役。 */
.IPsearch_in_panelALL { top: 240px; left: 115px; display: flex; flex-direction: column; justify-content: normal; align-items: flex-start; padding: 0px 6px 0px 6px; min-height: 42px; width: 285px; overflow: hidden; position: absolute; height: auto; transition: all 0.3s ease; box-sizing: border-box; } /* z-index 移至 protected 面板 zOrder:5 供給（§4.6：有 rootSelector 者不得在 sharedGeometryCss 宣告 z-index） */
.panel-tabs-container { position: absolute; left: 410px; top: 160px; width: 500px; height: 600px; z-index: calc(var(--layer-panel) + 2); }
`,

  panels: [
    { id: 'meeting-now', module: './meeting-now-includefetch.js',
      init: 'initMeetingNowPanel', clear: 'clearMeetingNowPanel', slot: null }, // 邏輯模組，綁 meeting-shell DOM

    { id: 'meeting-match', module: './meeting-match-check.js',
      init: 'initMeetingMatchCheck', clear: 'clearMeetingMatchCheck', slot: null },

    { id: 'meeting-all', module: './meeting-all-module.js',
      init: 'initMeetingAll', clear: 'clearMeetingAll', slot: null },

    // 順序契約：meeting-shell 的 clear 會清空容器，必須排在 meeting-now/meeting-match/meeting-all 之後（三者需先拆容器內監聽器）；init 不受影響（syncInit 獨立先行）
    { id: 'meeting-shell', label: '外部會議面板', module: './meeting-search-panel-module.js',
      init: 'initMeetingSearchPanel', clear: 'clearMeetingSearchPanel',
      initArgs: ['meeting-search-panel-placeholder'], clearArgs: ['meeting-search-panel-placeholder'],
      syncInit: true, // mediator:99 原為同步先行
      slot: 'meeting-search-panel-placeholder', rootSelector: '.meeting-search-panel-menu',
      geometryCss: '.meeting-search-panel-menu { height: auto; width: 360px; position: absolute; left: 920px; top: 0px; }', // 原 panels.css:441-447
      zOrder: 0, behaviors: ['draggable'] }, // 原 CSS 無 z-index（auto，與 optitle/fudausearch/linkout 同層），Task 2 manifest 誤填 1，Task 4 parity 迭代時修正

    // protected：伺服器注入 tabsHTML（→ 分頁視窗管理器 window-manager.js）與
    // ipHTML（.IPsearch_in_panelALL）。rootSelector 指向 IPsearch 盒：承接其
    // 層帶疊序（zOrder:5，z-index 從 sharedGeometryCss 遷出，遵 §4.6）並讓它在
    // 編輯模式可拖（handle 附加於 .IPsearch_in_panelALL，佈局存於 layout['protected']）。
    // .panel-tabs-container 不列 rootSelector——它由視窗管理器接管，非普通可拖面板。
    { id: 'protected', label: 'IP 查詢', module: './auth-protected-tabs.js',
      init: 'initProtectedTabs', clear: 'clearProtectedTabs',
      slot: 'auth-protected-tabs-placeholder', extraSlots: ['auth-protected-ip-placeholder'],
      rootSelector: '.IPsearch_in_panelALL', zOrder: 5, behaviors: ['draggable'],
      quirks: ['server-markup'] }, // 幾何在 sharedGeometryCss（伺服器 class）；z 由 zOrder 供給

    { id: 'optitle', label: '標題生成', module: './optitleGG.js',
      init: 'initOptitlePanel', clear: 'clearOptitlePanel',
      initArgs: ['optitle-placeholder'], clearArgs: ['optitle-placeholder'],
      slot: 'optitle-placeholder', rootSelector: '.optitlepanel',
      geometryCss: '.optitlepanel { padding: 10px; width: 400px; height: calc(120px + var(--handle-h, 36px)); box-sizing: border-box; position: absolute; top: 0px; left: 0px; }', // 原 panels.css:92-100；十一期：常駐標題帶讓高（內容區 120px 不變）
      zOrder: 0, behaviors: ['draggable'] },

    { id: 'fudausearch', label: '職代查詢', module: './fusearch-panel.js',
      init: 'initFudausearchPanel', clear: 'clearFudausearchPanel',
      initArgs: ['fudausearch-placeholder'], clearArgs: ['fudausearch-placeholder'],
      slot: 'fudausearch-placeholder', rootSelector: '.fudausearch-container',
      geometryCss: '.fudausearch-container { left: 0px; top: calc(130px + var(--handle-h, 36px)); width: 400px; height: calc(105px + var(--handle-h, 36px)); position: absolute; padding: 10px 5px 10px 5px; box-sizing: border-box; gap: 10px; }', // 原模板 inline + panels.css:802-811；十一期：讓高＋預設 top 讓位（上方 optitle 長高）
      zOrder: 0, behaviors: ['draggable'] },

    { id: 'shrturl', label: '短網址', module: './shrturl.js',
      init: 'initShrtUrlPanel', clear: 'clearShrtUrlPanel',
      initArgs: ['shrturl-placeholder'], clearArgs: ['shrturl-placeholder'],
      slot: 'shrturl-placeholder', rootSelector: '.linkout',
      geometryCss: '.linkout { padding: 5px 8px; height: auto; width: auto; box-sizing: border-box; position: absolute; top: 40px; left: 420px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; }', // panels.css:225-237
      zOrder: 0, behaviors: ['draggable'] },

    // 十一期合併定版：dt/consultant/assist 收納為 wm 分頁（toggle-panels.js
    // adoptPanelAsWmTab）——非畫布自由面板，slot/rootSelector/geometryCss/zOrder/
    // behaviors/pageSolo 全數退役；init 建 staging 交 WindowManager.adoptTabs，
    // clear 只清模組內狀態（pane 由 clearAllModules 的 WindowManager.destroy() 拆）。
    // label 仍為 wm tab 藥丸標題的語義來源（init 內字面同步）。
    { id: 'dt', label: '測試報告生成', module: './toggle-panels.js',
      init: 'initDTPanel', clear: 'clearDTPanel', slot: null },

    { id: 'consultant', label: '顧問清單', module: './toggle-panels.js',
      init: 'initConsultantPanel', clear: 'clearConsultantPanel', slot: null },

    { id: 'assist', label: '輔導班表', module: './toggle-panels.js',
      init: 'initAssistPanel', clear: 'clearAssistPanel', slot: null },

    { id: 'canned', label: '代課回應生成器', module: './dragb_msg_pnl.js',
      init: 'initCannedMessagesPanel', clear: 'clearCannedMessagesPanel',
      initArgs: [null, { left: 1300, top: 120 }], // 十一期：tooldl 常駐標題帶長高，預設 top 讓位（自 75）
      slot: null, rootSelector: '.canned-panel',
      zOrder: 15, alwaysDraggable: true, quirks: ['body-mounted', 'self-persisted'] },

    { id: 'roof', label: '檔次快捷', module: './roof-buttons.js',
      init: 'initRoofButtons', clear: 'clearRoofButtons',
      initArgs: ['roof-buttons-placeholder'], clearArgs: ['roof-buttons-placeholder'],
      slot: 'roof-buttons-placeholder', rootSelector: '.roofbutton',
      geometryCss: '.roofbutton { width: 110px; height: auto; font-size: 12px; padding: 10px; box-sizing: border-box; position: absolute; left: 0px; top: calc(240px + 2 * var(--handle-h, 36px)); gap: 10px; display: flex; flex-wrap: nowrap; flex-direction: column; }', // 原 panels.css:67-82；十一期：預設 top 讓位（同欄上方兩面板各長高 36px）
      zOrder: 5, behaviors: ['draggable'] },

    { id: 'tooldl', label: '工具下載', module: './tool-download-panel.js',
      init: 'initToolDownloadPanel', clear: 'clearToolDownloadPanel',
      initArgs: ['tool-download-placeholder'], clearArgs: ['tool-download-placeholder'],
      slot: 'tool-download-placeholder', rootSelector: '.tool_zip_dl',
      geometryCss: '.tool_zip_dl { color: var(--fg-2); padding: 5px 10px 5px 10px; box-sizing: border-box; position: absolute; left: 1290px; top: 0px; }', // panels.css:83-91
      zOrder: 3, behaviors: ['draggable'] },
  ],
};
