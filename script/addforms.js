let deviceCount = 1;
let connectionCount = 1;
let tabCount = 1;

function addDevice() {
    deviceCount++;
    const deviceContainer = document.getElementById('DT_devices');
    const newDevice = document.createElement('div');
    newDevice.className = 'device-group';
    newDevice.innerHTML = `
    <hr>
        <div class="row">
            <div><label for="DT_device_${deviceCount}">設備<span class="red-asterisk">*</span></label></div>
            <div><label for="DT_brand_${deviceCount}">品牌<span class="red-asterisk">*</span></label></div>
            <div><label for="DT_os_${deviceCount}">作業系統<span class="red-asterisk">*</span></label></div>
            <div><label for="DT_os_version_${deviceCount}">版本/硬體條件<span class="red-asterisk">*</span></label></div>
            <div><label for="DT_browser_${deviceCount}">瀏覽器<span class="red-asterisk">*</span></label></div>
        </div>
        <div class="row">
            <div>
                <select id="DT_device_${deviceCount}" name="device_${deviceCount}" >
                    <option value="-">-</option>
                    <option value="筆電">筆電</option>
                    <option value="桌上型電腦">桌上型電腦</option>
                    <option value="平板">平板</option>
                    <option value="其他">其他</option>
                </select>
            </div>
            <div>
                <input type="text" id="DT_brand_${deviceCount}" name="brand_${deviceCount}">
            </div>
            <div>
                <select id="DT_os_${deviceCount}" name="os_${deviceCount}" >
                    <option value="-">-</option>
                    <option value="Windows">Windows</option>
                    <option value="MacOS">MacOS</option>
                    <option value="iOS">iOS</option>
                    <option value="Android">Android</option>
                    <option value="其他">其他</option>
                </select>
            </div>
            <div>
                <input type="text" id="DT_os_version_${deviceCount}" name="os_version_${deviceCount}" >
            </div>
            <div>
                <input type="text" id="DT_browser_${deviceCount}" name="browser_${deviceCount}" >
            </div>
        </div>
		<span class="error" id="error_device_os_${deviceCount}">請填寫設備和作業系統信息</span>
        <div class="DTDV_grid-container">
            <div class="DTDV_grid-item">
                <label>視訊規格：<span class="red-asterisk">*</span></label>
                <input type="radio" id="DT_video_spec_internal_${deviceCount}" name="video_spec_${deviceCount}" value="內建" ><label for="DT_video_spec_internal_${deviceCount}">內建</label>
                <input type="radio" id="DT_video_spec_external_${deviceCount}" name="video_spec_${deviceCount}" value="外接" ><label for="DT_video_spec_external_${deviceCount}">外接</label>
            </div>
            <div class="DTDV_grid-item">
                <label>視訊品質：<span class="red-asterisk">*</span></label>
                <input type="radio" id="DT_video_quality_clear_${deviceCount}" name="video_quality_${deviceCount}" value="清晰" ><label for="DT_video_quality_clear_${deviceCount}">清晰</label>
                <input type="radio" id="DT_video_quality_poor_${deviceCount}" name="video_quality_${deviceCount}" value="不佳" ><label for="DT_video_quality_poor_${deviceCount}">不佳</label>
                <input type="radio" id="DT_video_quality_untested_${deviceCount}" name="video_quality_${deviceCount}" value="未測試" ><label for="DT_video_quality_untested_${deviceCount}">未測試</label>
            </div>
			<span class="error" id="error_video_${deviceCount}">請選擇視訊規格和品質</span>
            <div class="DTDV_grid-item">
                <label>耳麥規格：<span class="red-asterisk">*</span></label>
                <input type="radio" id="DT_audio_spec_internal_${deviceCount}" name="audio_spec_${deviceCount}" value="內建" ><label for="DT_audio_spec_internal_${deviceCount}">內建</label>
                <input type="radio" id="DT_audio_spec_external_${deviceCount}" name="audio_spec_${deviceCount}" value="外接" ><label for="DT_audio_spec_external_${deviceCount}">外接</label>
            </div>
            <div class="DTDV_grid-item">
                <label>聲音品質：<span class="red-asterisk">*</span></label>
                <input type="radio" id="DT_audio_quality_clear_${deviceCount}" name="audio_quality_${deviceCount}" value="清晰" ><label for="DT_audio_quality_clear_${deviceCount}">清晰</label>
                <input type="radio" id="DT_audio_quality_poor_${deviceCount}" name="audio_quality_${deviceCount}" value="不佳" ><label for="DT_audio_quality_poor_${deviceCount}">不佳</label>
                <input type="radio" id="DT_audio_quality_untested_${deviceCount}" name="audio_quality_${deviceCount}" value="未測試" ><label for="DT_audio_quality_untested_${deviceCount}">未測試</label>
            </div>
        </div>

        <span class="error" id="error_audio_${deviceCount}">請選擇耳麥規格和品質</span>
    `;
    deviceContainer.appendChild(newDevice);
}




document.getElementById('add-tab').addEventListener('click', function () {
    tabCount++;
    connectionCount++;
    addNewTab();
});

function addNewTab() {
    // 建立新標籤
    const newTab = document.createElement('li');
    newTab.setAttribute('data-tab', `tab${tabCount}`);
    newTab.setAttribute('data-index', `${tabCount}`);

    const tabTitle = document.createElement('span');
    tabTitle.textContent = `網路連線 ${connectionCount}`;
    newTab.appendChild(tabTitle);

    const closeButton = document.createElement('button');
    closeButton.textContent = 'x';
    closeButton.classList.add('close-tab');
    closeButton.addEventListener('click', function (e) {
        e.stopPropagation();
        removeTab(newTab, `tab${tabCount}`);
    });
    newTab.appendChild(closeButton);

    newTab.addEventListener('click', switchTab);

    // 停用之前的活動標籤
    document.querySelectorAll('.tab-list li').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // 在 "+" 標籤前插入新標籤
    const tabList = document.querySelector('.tab-list');
    tabList.insertBefore(newTab, tabList.querySelector('#add-tab'));

    // 建立新標籤內容
    const newTabContent = document.createElement('div');
    newTabContent.className = 'tab-content active';
    newTabContent.id = `tab${tabCount}`;
    newTabContent.setAttribute('data-index', `${tabCount}`);
    newTabContent.innerHTML = `
        <div class="connection-group" data-index="${connectionCount}">
            <div class="form-group">
                <label for="DT_provider_${connectionCount}">電信業者：<span class="red-asterisk">*</span></label>
                <input type="text" id="DT_provider_${connectionCount}" name="provider_${connectionCount}">
                <label for="DT_connection_${connectionCount}">連線方式：<span class="red-asterisk">*</span></label>
                <select id="DT_connection_${connectionCount}" name="connection_${connectionCount}">
                    <option value="-">-</option>
                    <option value="Wi-Fi">Wi-Fi</option>
                    <option value="有線網路">有線網路</option>
                    <option value="Wi-Fi+有線網路">Wi-Fi+有線網路</option>
                </select>
            </div>
            <div class="form-group">
                <label for="DT_speed_${connectionCount}">當前網速：<span class="red-asterisk">*</span></label>
                <textarea id="DT_speed_${connectionCount}" name="speed_${connectionCount}"></textarea>
                <span class="error" id="error_connection_${connectionCount}">請填寫電信業者和連線方式信息</span>
            </div>
        </div>
    `;

    // 將新標籤內容添加到容器
    document.getElementById('DT_connections').appendChild(newTabContent);

    // 激活新標籤
    newTab.classList.add('active');
    document.getElementById(`tab${tabCount}`).classList.add('active');
}

function switchTab() {
    document.querySelectorAll('.tab-list li').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    this.classList.add('active');
    document.getElementById(this.getAttribute('data-tab')).classList.add('active');
}


function removeTab(tabElement, tabContentId) {
    // 移除標籤和對應內容
    tabElement.remove();
    document.getElementById(tabContentId).remove();

    // 檢查是否有剩餘的新增標籤
    const remainingTabs = document.querySelectorAll('.tab-list li[data-tab]');
    if (remainingTabs.length === 1) { // 只剩下初始標籤
        // 重置計數器
        connectionCount = 1;
        tabCount = 1;

        // 清除所有新增的資料
        document.querySelectorAll('.tab-content:not(#tab1)').forEach(content => content.remove());

        // 重新顯示初始標籤
        document.querySelectorAll('.tab-list li[data-tab]').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.querySelector('.tab-list li[data-tab="tab1"]').classList.add('active');
        document.getElementById('tab1').classList.add('active');
    } else {
        // 重新計算所有標籤的索引和顯示的連線數字
        updateTabs();

        // 激活上一個標籤
        const remainingTabElements = Array.from(remainingTabs);
        const currentIndex = remainingTabElements.findIndex(tab => tab.getAttribute('data-tab') === tabContentId);
        const prevIndex = (currentIndex > 0) ? currentIndex - 1 : 0;
        const lastTab = remainingTabElements[prevIndex];
        
        if (lastTab) {
            lastTab.classList.add('active');
            document.getElementById(lastTab.getAttribute('data-tab')).classList.add('active');
        }
    }

    // 更新輸出
    generateOutput();
}


function updateTabs() {
    const tabs = document.querySelectorAll('.tab-list li[data-tab]');
    tabs.forEach((tab, index) => {
        const tabNumber = index + 1; // 新的連線數字
        const oldTabId = tab.getAttribute('data-tab');
        const newTabId = `tab${tabNumber}`;
        tab.setAttribute('data-tab', newTabId);
        tab.setAttribute('data-index', tabNumber);
        tab.querySelector('span').textContent = `網路連線 ${tabNumber}`;

        const content = document.querySelector(`.tab-content[id="${oldTabId}"]`);
        if (content) {
            content.id = newTabId;
            content.setAttribute('data-index', tabNumber);
            const connectionGroup = content.querySelector('.connection-group');
            connectionGroup.setAttribute('data-index', tabNumber);
            connectionGroup.querySelector('label[for^="DT_provider_"]').setAttribute('for', `DT_provider_${tabNumber}`);
            connectionGroup.querySelector('input[id^="DT_provider_"]').id = `DT_provider_${tabNumber}`;
            connectionGroup.querySelector('input[name^="provider_"]').name = `provider_${tabNumber}`;

            connectionGroup.querySelector('label[for^="DT_connection_"]').setAttribute('for', `DT_connection_${tabNumber}`);
            connectionGroup.querySelector('select[id^="DT_connection_"]').id = `DT_connection_${tabNumber}`;
            connectionGroup.querySelector('select[name^="connection_"]').name = `connection_${tabNumber}`;

            connectionGroup.querySelector('label[for^="DT_speed_"]').setAttribute('for', `DT_speed_${tabNumber}`);
            connectionGroup.querySelector('textarea[id^="DT_speed_"]').id = `DT_speed_${tabNumber}`;
            connectionGroup.querySelector('textarea[name^="speed_"]').name = `speed_${tabNumber}`;

            connectionGroup.querySelector('span[id^="error_connection_"]').id = `error_connection_${tabNumber}`;
        }
    });

    // 若當前活動標籤被移除，激活上一個標籤
    const activeTabs = document.querySelectorAll('.tab-list li.active');
    if (activeTabs.length === 0 && tabs.length > 0) {
        tabs[tabs.length - 1].classList.add('active');
        document.getElementById(tabs[tabs.length - 1].getAttribute('data-tab')).classList.add('active');
    }
}

document.querySelectorAll('.tab-list li[data-tab]').forEach(tab => {
    tab.addEventListener('click', switchTab);
});