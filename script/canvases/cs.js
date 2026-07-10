// 客服畫布 manifest。座標唯一權威來源（CSS 不留幾何）。
// geometryCss 內禁用 z-index —— 疊序一律由 zOrder（帶內排序）供給。
export default {
  id: 'cs',
  name: '客服小工具',
  visibility: 'all', // 預留：部門權限（本期不實作）

  // 共用狀態幾何（原 panels.css 之 .panel_all_container / .small-size / 展開態，逐字）
  sharedGeometryCss: `
.panel_all_container { position: relative; width: 100%; height: 100vh; min-height: 800px; overflow: visible; box-sizing: border-box; margin: 0; padding: 10px; gap: 10px; height: auto; position: absolute; left: 0px; top: 0px; border: 10px; padding: 10px; margin: 10px; }
.small-size { position: absolute !important; width: 105px !important; height: 30px !important; min-width: 0px !important; flex-basis: 110px !important; overflow: hidden !important; } /* 第四期：移除 z-index——原本 calc(+10) 會蓋掉 stack-manager 的 --stack-rank，讓「最小化的面板點擊也無法置頂」（動態疊序失效）。改由統一疊序管理，最小化面板與其他面板一樣可點擊置頂。 */
.consultantlistgooglesheet:not(.small-size) { width: 950px; height: 700px; }
.DT_panel:not(.small-size) { width: 900px; height: auto; overflow: visible; } /* z-index 已移除：0-2-0 特異度會遮蔽 dt 面板 zOrder 注入的 0-1-0 規則，疊序一律由 zOrder 供給 */
.assist_googlesheet:not(.small-size) { width: 800px; height: 600px; }
.consultantlistgooglesheet, .DT_panel, .IPsearch_in_panelALL, .assist_googlesheet { display: flex; flex-direction: column; position: absolute; transition: all 0.3s ease; box-sizing: border-box; overflow: hidden; }
/* 伺服器注入 markup 的幾何（repo 內無模板，class 為既定契約）。
   第三期：.idsearchpanel／.ClassLogpanel 為死樣式（實測伺服器不再注入該 markup，
   真實 markup 只有 .panel-tabs-container 與 .IPsearch_in_panelALL），整組移除。 */
.IPsearch_in_panelALL { top: 240px; left: 115px; display: flex; flex-direction: column; justify-content: normal; align-items: flex-start; padding: 0px 6px 0px 6px; min-height: 42px; width: 285px; overflow: hidden; position: absolute; height: auto; } /* z-index 移至 protected 面板 zOrder:5 供給（§4.6：有 rootSelector 者不得在 sharedGeometryCss 宣告 z-index） */
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
      geometryCss: '.optitlepanel { padding: 10px; width: 400px; height: 120px; box-sizing: border-box; position: absolute; top: 0px; left: 0px; }', // panels.css:92-100
      zOrder: 0, behaviors: ['draggable'] },

    { id: 'fudausearch', label: '職代查詢', module: './fusearch-panel.js',
      init: 'initFudausearchPanel', clear: 'clearFudausearchPanel',
      initArgs: ['fudausearch-placeholder'], clearArgs: ['fudausearch-placeholder'],
      slot: 'fudausearch-placeholder', rootSelector: '.fudausearch-container',
      geometryCss: '.fudausearch-container { left: 0px; top: 130px; width: 400px; height: 105px; position: absolute; padding: 10px 5px 10px 5px; box-sizing: border-box; gap: 10px; }', // 原模板 inline + panels.css:802-811 幾何合併（Task 4）
      zOrder: 0, behaviors: ['draggable'] },

    { id: 'shrturl', label: '短網址', module: './shrturl.js',
      init: 'initShrtUrlPanel', clear: 'clearShrtUrlPanel',
      initArgs: ['shrturl-placeholder'], clearArgs: ['shrturl-placeholder'],
      slot: 'shrturl-placeholder', rootSelector: '.linkout',
      geometryCss: '.linkout { padding: 5px 8px; height: auto; width: auto; box-sizing: border-box; position: absolute; top: 40px; left: 420px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; }', // panels.css:225-237
      zOrder: 0, behaviors: ['draggable'] },

    { id: 'dt', label: '測試報告生成', module: './toggle-panels.js',
      init: 'initDTPanel', clear: 'clearDTPanel',
      initArgs: ['dt-panel-placeholder'], clearArgs: ['dt-panel-placeholder'],
      slot: 'dt-panel-placeholder', rootSelector: '.DT_panel',
      geometryCss: '.DT_panel { position: absolute; top: 0; left: 523px; transition: all 0.3s ease; }', // panels.css:190-196（z 移入 zOrder；!important 廢除——模板 inline z 同步移除）
      zOrder: 4, behaviors: ['draggable'] },

    { id: 'consultant', label: '顧問清單', module: './toggle-panels.js',
      init: 'initConsultantPanel', clear: 'clearConsultantPanel',
      initArgs: ['consultant-panel-placeholder'], clearArgs: ['consultant-panel-placeholder'],
      slot: 'consultant-panel-placeholder', rootSelector: '.consultantlistgooglesheet',
      geometryCss: '.consultantlistgooglesheet { position: absolute; height: 700px; width: 950px; top: 0px; left: 636px; }', // panels.css:198-206；right:20px 雙宣告本無效，不搬（盤點異常 C）；z 由 zOrder 供給
      zOrder: 3, behaviors: ['draggable'] },

    { id: 'assist', label: '輔導班表', module: './toggle-panels.js',
      init: 'initAssistPanel', clear: 'clearAssistPanel',
      initArgs: ['assist-panel-placeholder'], clearArgs: ['assist-panel-placeholder'],
      slot: 'assist-panel-placeholder', rootSelector: '.assist_googlesheet',
      geometryCss: '.assist_googlesheet { position: absolute; top: 0px; left: 410px; height: 600px; width: 800px; vertical-align: middle; }', // panels.css:180-188
      zOrder: 10, behaviors: ['draggable'] },

    { id: 'canned', label: '代課回應生成器', module: './dragb_msg_pnl.js',
      init: 'initCannedMessagesPanel', clear: 'clearCannedMessagesPanel',
      initArgs: [null, { left: 1300, top: 75 }],
      slot: null, rootSelector: '.canned-panel',
      zOrder: 15, alwaysDraggable: true, quirks: ['body-mounted', 'self-persisted'] },

    { id: 'roof', label: '檔次快捷', module: './roof-buttons.js',
      init: 'initRoofButtons', clear: 'clearRoofButtons',
      initArgs: ['roof-buttons-placeholder'], clearArgs: ['roof-buttons-placeholder'],
      slot: 'roof-buttons-placeholder', rootSelector: '.roofbutton',
      geometryCss: '.roofbutton { width: 110px; height: auto; font-size: 12px; padding: 10px; box-sizing: border-box; position: absolute; left: 0px; top: 240px; gap: 10px; display: flex; flex-wrap: nowrap; flex-direction: column; }', // panels.css:67-82
      zOrder: 5, behaviors: ['draggable'] },

    { id: 'tooldl', label: '工具下載', module: './tool-download-panel.js',
      init: 'initToolDownloadPanel', clear: 'clearToolDownloadPanel',
      initArgs: ['tool-download-placeholder'], clearArgs: ['tool-download-placeholder'],
      slot: 'tool-download-placeholder', rootSelector: '.tool_zip_dl',
      geometryCss: '.tool_zip_dl { color: var(--fg-2); padding: 5px 10px 5px 10px; box-sizing: border-box; position: absolute; left: 1290px; top: 0px; }', // panels.css:83-91
      zOrder: 3, behaviors: ['draggable'] },
  ],
};
