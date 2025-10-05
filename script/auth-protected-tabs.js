const tabsHTML = `
<div class="panel-tabs-container">
  <div class="panel-tabs">
    <!--   NaniClub tab -->
    <input type="radio" id="panel-tab-naniclub" name="panel-tab" checked="checked">
    <label for="panel-tab-naniclub">🗝️帳號搜尋</label>
    <div class="panel-tab-content">
      <iframe class="responsive-iframe" src="7pc55uah1trppaw7ny.html"></iframe>
    </div>

    <!--   教室log tab -->
    <input type="radio" name="panel-tab" id="panel-tab-classlog">
    <label for="panel-tab-classlog">📊教室LOG</label>
    <div class="panel-tab-content">
      <iframe class="responsive-iframe" src="xu7fwfh93rbyorxkds.html"></iframe>
    </div>

    <!--   課程日誌查詢 tab -->
    <input type="radio" name="panel-tab" id="panel-tab-courselog">
    <label for="panel-tab-courselog">📝課程日誌</label>
    <div class="panel-tab-content">
      <iframe class="responsive-iframe" src="hhnueyfrsoj1na8pjj.html"></iframe>
    </div>

    <!--   Tools tab -->
    <input type="radio" name="panel-tab" id="panel-tab-tools">
    <label for="panel-tab-tools">🚀快捷貼圖</label>
    <div class="panel-tab-content">
        <div class="appicon">
      點擊圖片自動複製，可直接貼至BX<br>
      <img id="chromeIcon" src="img/chrome_icon.png" alt="Copy Icon" width="40" height="40">
      <img id="safariIcon" src="img/safari_icon.png" alt="Copy Icon" width="40" height="40">
      <img id="SamsungIcon" src="img/Samsung_Internet_logo.png" alt="Copy Icon" width="40" height="40">
      <img id="EdgeIcon" src="img/Microsoft_Edge_logo.png" alt="Copy Icon" width="40" height="40">
      <img id="chromeRefreshIcon" src="img/chrome_refresh.png" alt="Copy Icon" width="40" height="40">
      <img id="chromeaAccessIcon" src="img/chrome_access.png" alt="Copy Icon" width="40" height="40">
      <img id="OCparentappLogo" src="img/oc_parentapp_logo.png" alt="Copy Icon" width="40" height="40">
      <br>
      快速鍵圖庫<br>
      <img id="camDisableIcon" src="img/cam_disable.png" alt="Copy Icon" width="40">
      <img id="micDisableIcon" src="img/mic_disable.png" alt="Copy Icon" width="40">
      <img id="spDisableIcon" src="img/sp_disable.png" alt="Copy Icon" width="40">
      <img id="macMicIcon" src="img/mac_mic.png" alt="Copy Icon" width="60">
      <img id="macSpeakerIcon" src="img/mac_speaker.png" alt="Copy Icon" height="60">
      <br>
      其他引導截圖<br>
      <div class="hover-container">
        <img id="chromeACCMENU" src="img/chrome_access_menu.png" alt="Copy Icon" width="70">
        <div class="hover-overlay">[Chrome]<br><img src="img/chrome_icon_20.png" width="20"><br>隱私權設定</div>
      </div>
      <div class="hover-container">
        <img id="chromeDL" src="img/chrome_dl.png" alt="Copy Icon" width="70">
        <div class="hover-overlay">[Chrome]<br><img src="img/chrome_icon_20.png" width="20"><br>設定→下載</div>
      </div>
      <div class="hover-container">
        <img id="edgeACCMENU" src="img/edge_access.png" alt="Copy Icon" width="70">
        <div class="hover-overlay">[Edge]<br><img src="img/edge_icon_20.png" width="20"><br>隱私權設定</div>
      </div>
      <div class="hover-container">
        <img id="edgeDL" src="img/edge_dl.png" alt="Copy Icon" width="70">
        <div class="hover-overlay">[Edge]<br><img src="img/edge_icon_20.png" width="20"><br>設定→下載</div>
      </div>
      <div class="hover-container">
        <img id="safariINCOGNITO" src="img/safari_incognito.png" alt="Copy Icon" width="70">
        <div class="hover-overlay">[iPad Safari]<br><img src="img/safari_icon.png" height="20"><br>私密視窗</div>
      </div>
      <br>
      <div class="hover-container">
        <img id="win11Volumemix" src="img/win11_volumemix.png" alt="Copy Icon" width="70">
        <div class="hover-overlay">[Win 11]<br><i class="fa-solid fa-volume-high"></i>混音程式<br>引導</div>
      </div>
      <div class="hover-container">
        <img id="appClassDefer" src="img/app_class_defer.png" alt="Copy Icon" width="70">
        <div class="hover-overlay">[家長App]<br>請假順延<br>引導</div>
      </div>
    </div>
    </div>
  </div>
</div>
`;

const ipHTML = `
<div class="IPsearch_in_panelALL">
        <div id="ip_search_form_container">
            <form id="ip_search_form">
                <label for="ip_input">IP：</label>
                <input type="text" id="ip_input" name="ip_input" />
            </form>
        </div>
        <div id="ip_result_container">
            <p id="ip_country" style="margin: 0; padding: 0; line-height: 18px;"></p>
            <p id="ip_org" style="margin: 0; padding: 0; line-height: 18px;"></p>
            <p id="ip_hostname" style="margin: 0; padding: 0; line-height: 18px;"></p>
        </div>
        <a href="https://rpki.tw/stats/valid.html" 
           title="資料來源為「財團法人台灣網路資訊中心」" 
           class="IP_info-button" 
           target="_blank">?</a>
    </div>
`;

window.addEventListener('firework-login-success', () => {
  const tabsPlaceholder = document.getElementById('auth-protected-tabs-placeholder');
  if (tabsPlaceholder) {
    tabsPlaceholder.innerHTML = tabsHTML;
  }
  const ipPlaceholder = document.getElementById('auth-protected-ip-placeholder');
  if (ipPlaceholder) {
    ipPlaceholder.innerHTML = ipHTML;
  }
});

window.addEventListener('firework-logout-success', () => {
  const tabsPlaceholder = document.getElementById('auth-protected-tabs-placeholder');
  if (tabsPlaceholder) {
    tabsPlaceholder.innerHTML = '';
  }
  const ipPlaceholder = document.getElementById('auth-protected-ip-placeholder');
  if (ipPlaceholder) {
    ipPlaceholder.innerHTML = '';
  }
});