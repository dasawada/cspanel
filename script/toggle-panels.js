// ===== 模組內部變數 =====
let deviceCount = 1;
let connectionCount = 1;
let reportWindow = null;

// ===== HTML 模板 =====

// 測試模板 HTML
const dtPanelHTML = `
<div class="DT_panel small-size" style="z-index: 0;">
    <div class="toggle-container">
        <input type="checkbox" id="DT_toggleCheckbox">
        <label for="DT_toggleCheckbox">🛠️測試模板</label>
    </div>
    <div id="content" style="display: none; max-height: 80vh; overflow-y: auto;">
        <div class="form_container">
            <div class="DT_left_panel">
                <div class="form-group">
                    <div class="form-row">
                        <div class="form-col">
                            <div class="input-row">
                                <label for="DT_datetime">日期時間</label>
                                <input type="text" id="DT_datetime" name="datetime" placeholder="YYYY/MM/DD hh:mm">
                            </div>
                        </div>
                        <div class="form-col">
                            <div class="input-row">
                                <label for="DT_name">學生姓名</label>
                                <input type="text" id="DT_name" name="name">
                            </div>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <div class="form-row">
                        <div class="form-col">
                            <div class="input-row">
                                <label for="DT_project">測試人員</label>
                                <input type="text" id="DT_project" name="project">
                            </div>
                        </div>
                        <div class="form-col">
                            <div class="input-row">
                                <label for="DT_phone">連絡電話</label>
                                <input type="text" id="DT_phone" name="phone" placeholder="可填家長姓名、電話">
                            </div>
                        </div>
                    </div>
                </div>
                <div class="DT_SON_BORDER" style="background: white;">
                    <div id="DT_devices">
                        <h3>使用設備</h3>
                        <div class="device-group">
                            <div class="row">
                                <div><label for="DT_device_1">設備</label></div>
                                <div><label for="DT_brand_1">品牌</label></div>
                                <div><label for="DT_os_1">作業系統</label></div>
                                <div><label for="DT_os_version_1">版本/硬體</label></div>
                                <div><label for="DT_browser_1">瀏覽器</label></div>
                            </div>
                            <div class="row">
                                <div>
                                    <select id="DT_device_1" name="device">
                                        <option value="-">-</option>
                                        <option value="筆電">筆電</option>
                                        <option value="桌上型電腦">桌上型電腦</option>
                                        <option value="平板">平板</option>
                                        <option value="其他">其他</option>
                                    </select>
                                </div>
                                <div><input type="text" id="DT_brand_1" name="brand"></div>
                                <div>
                                    <select id="DT_os_1" name="os">
                                        <option value="-">-</option>
                                        <option value="Windows">Windows</option>
                                        <option value="MacOS">MacOS</option>
                                        <option value="iOS">iOS</option>
                                        <option value="Android">Android</option>
                                        <option value="其他">其他</option>
                                    </select>
                                </div>
                                <div><input type="text" id="DT_os_version_1" name="os_version"></div>
                                <div><input type="text" id="DT_browser_1" name="browser"></div>
                            </div>
                            <div class="DTDV_grid-container">
                                <div class="DTDV_grid-item">
                                    <label><i class="fa-solid fa-camera"></i> ：</label>
                                    <input type="radio" id="DT_video_spec_internal_1" name="video_spec_1" value="內建"><label for="DT_video_spec_internal_1">內建</label>
                                    <input type="radio" id="DT_video_spec_external_1" name="video_spec_1" value="外接"><label for="DT_video_spec_external_1">外接</label>
                                </div>
                                <div class="DTDV_grid-item">
                                    <label>品質：</label>
                                    <input type="radio" id="DT_video_quality_clear_1" name="video_quality_1" value="清晰"><label for="DT_video_quality_clear_1">清晰</label>
                                    <input type="radio" id="DT_video_quality_poor_1" name="video_quality_1" value="不佳"><label for="DT_video_quality_poor_1">不佳</label>
                                    <input type="radio" id="DT_video_quality_untested_1" name="video_quality_1" value="未測試"><label for="DT_video_quality_untested_1">未測試</label>
                                </div>
                                <div class="DTDV_grid-item">
                                    <label><i class="fa-solid fa-headphones"></i> ：</label>
                                    <input type="radio" id="DT_audio_spec_internal_1" name="audio_spec_1" value="內建"><label for="DT_audio_spec_internal_1">內建</label>
                                    <input type="radio" id="DT_audio_spec_external_1" name="audio_spec_1" value="外接"><label for="DT_audio_spec_external_1">外接</label>
                                </div>
                                <div class="DTDV_grid-item">
                                    <label>品質：</label>
                                    <input type="radio" id="DT_audio_quality_clear_1" name="audio_quality_1" value="清晰"><label for="DT_audio_quality_clear_1">清晰</label>
                                    <input type="radio" id="DT_audio_quality_poor_1" name="audio_quality_1" value="不佳"><label for="DT_audio_quality_poor_1">不佳</label>
                                    <input type="radio" id="DT_audio_quality_untested_1" name="audio_quality_1" value="未測試"><label for="DT_audio_quality_untested_1">未測試</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="spacer"></div>
                    <button type="button" id="dt-add-device-btn">新增設備</button>
                </div>
                <div class="DT_SON_BORDER" style="background: white;">
                    <div id="DT_connections">
                        <h3>網路連線</h3>
                        <div class="connection-group">
                            <div class="form-group">
                                <label for="DT_provider_1">電信業者：</label>
                                <input type="text" id="DT_provider_1" name="provider">
                                <label for="DT_connection_1">連線方式：</label>
                                <select id="DT_connection_1" name="connection">
                                    <option value="-">-</option>
                                    <option value="Wi-Fi">Wi-Fi</option>
                                    <option value="有線網路">有線網路</option>
                                    <option value="Wi-Fi+有線網路">Wi-Fi+有線網路</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="DT_speed_1">當前網速：</label>
                                <textarea id="DT_speed_1" name="speed"></textarea>
                            </div>
                        </div>
                    </div>
                    <div class="spacer"></div>
                    <button type="button" id="dt-add-connection-btn">新增網路連線</button>
                </div>
                <div class="form-group">
                    <label for="DT_issues">測試問題：</label>
                    <textarea id="DT_issues" name="issues"></textarea>
                </div>
            </div>
            <div class="DT_right_panel">
                <div class="form-group">
                    <div class="DV_sutable">
                        <label for="DT_suitable">是否適合上課：</label>
                        <input type="radio" id="DT_suitable_yes" name="suitable" value="適合">適合
                        <input type="radio" id="DT_suitable_no" name="suitable" value="不適合">不適合
                    </div>
                </div>
                <div class="form-group">
                    <label for="DT_process">處理過程：</label>
                    <textarea id="DT_process" name="process"></textarea>
                </div>
                <div class="form-group">
                    <label for="DT_boldbrief">想要粗體告訴輔導的最後一句話：</label>
                    <textarea id="DT_boldbrief" name="boldbrief"></textarea>
                </div>
                <button type="submit" id="generateReportButton" style="position: relative; z-index: 1000;">生成</button>
            </div>
        </div>
        <div id="output_content" style="display:none;"></div>
    </div>
</div>
`;

// 顧問名單 HTML
const consultantPanelHTML = `
<div class="consultantlistgooglesheet small-size" style="top:0px">
    <div class="toggle-container">
        <input type="checkbox" id="toggleCheckbox">
        <label for="toggleCheckbox">顧問組別</label>
    </div>
    <div id="content" style="display: none;">
        <iframe class="responsive-iframe" src="SA_iframe.html"></iframe>
    </div>
</div>
`;

// 輔導通訊錄 HTML
const assistPanelHTML = `
<div class="assist_googlesheet small-size">
    <div class="toggle-container">
        <input type="checkbox" id="assist_toggleCheckbox">
        <label for="assist_toggleCheckbox">☎️輔導班表</label>
    </div>
    <div id="content" style="display: none;">
        <iframe class="responsive-iframe" src="assist_list_scale.html"></iframe>
    </div>
</div>
`;

// ===== 工具函數 =====
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDateTime(datetime) {
    if (!datetime) return '';
    const date = new Date(datetime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
}

// ===== 面板切換功能 =====
function setupPanelToggle(containerClass, checkboxId) {
    const container = document.querySelector(containerClass);
    const checkbox = document.getElementById(checkboxId);

    if (container && checkbox) {
        const content = container.querySelector('#content');
        checkbox.checked = false;
        container.classList.add('small-size');
        if (content) {
            content.style.display = 'none';
        }

        checkbox.addEventListener('change', function() {
            if (this.checked) {
                container.classList.remove('small-size');
                if (content) {
                    content.style.display = 'block';
                }
            } else {
                container.classList.add('small-size');
                if (content) {
                    content.style.display = 'none';
                }
            }
        });
    }
}

// ===== 設備管理功能 =====
function addDevice() {
    deviceCount++;
    const deviceContainer = document.getElementById('DT_devices');
    if (!deviceContainer) return;
    
    const newDevice = document.createElement('div');
    newDevice.className = 'device-group';
    newDevice.innerHTML = `
    <hr>
        <div class="form-group">
            <button type="button" class="close-button dt-remove-device-btn">×</button>
        </div>
        <div class="row">
            <div><label for="DT_device_${deviceCount}">設備</label></div>
            <div><label for="DT_brand_${deviceCount}">品牌</label></div>
            <div><label for="DT_os_${deviceCount}">作業系統</label></div>
            <div><label for="DT_os_version_${deviceCount}">版本/硬體</label></div>
            <div><label for="DT_browser_${deviceCount}">瀏覽器</label></div>
        </div>
        <div class="row">
            <div>
                <select id="DT_device_${deviceCount}" name="device_${deviceCount}">
                    <option value="-">-</option>
                    <option value="筆電">筆電</option>
                    <option value="桌上型電腦">桌上型電腦</option>
                    <option value="平板">平板</option>
                    <option value="其他">其他</option>
                </select>
            </div>
            <div><input type="text" id="DT_brand_${deviceCount}" name="brand_${deviceCount}"></div>
            <div>
                <select id="DT_os_${deviceCount}" name="os_${deviceCount}">
                    <option value="-">-</option>
                    <option value="Windows">Windows</option>
                    <option value="MacOS">MacOS</option>
                    <option value="iOS">iOS</option>
                    <option value="Android">Android</option>
                    <option value="其他">其他</option>
                </select>
            </div>
            <div><input type="text" id="DT_os_version_${deviceCount}" name="os_version_${deviceCount}"></div>
            <div><input type="text" id="DT_browser_${deviceCount}" name="browser_${deviceCount}"></div>
        </div>
        <div class="DTDV_grid-container">
            <div class="DTDV_grid-item">
                <label><i class="fa-solid fa-camera"></i> ：</label>
                <input type="radio" id="DT_video_spec_internal_${deviceCount}" name="video_spec_${deviceCount}" value="內建"><label for="DT_video_spec_internal_${deviceCount}">內建</label>
                <input type="radio" id="DT_video_spec_external_${deviceCount}" name="video_spec_${deviceCount}" value="外接"><label for="DT_video_spec_external_${deviceCount}">外接</label>
            </div>
            <div class="DTDV_grid-item">
                <label>品質：</label>
                <input type="radio" id="DT_video_quality_clear_${deviceCount}" name="video_quality_${deviceCount}" value="清晰"><label for="DT_video_quality_clear_${deviceCount}">清晰</label>
                <input type="radio" id="DT_video_quality_poor_${deviceCount}" name="video_quality_${deviceCount}" value="不佳"><label for="DT_video_quality_poor_${deviceCount}">不佳</label>
                <input type="radio" id="DT_video_quality_untested_${deviceCount}" name="video_quality_${deviceCount}" value="未測試"><label for="DT_video_quality_untested_${deviceCount}">未測試</label>
            </div>
            <div class="DTDV_grid-item">
                <label><i class="fa-solid fa-headphones"></i> ：</label>
                <input type="radio" id="DT_audio_spec_internal_${deviceCount}" name="audio_spec_${deviceCount}" value="內建"><label for="DT_audio_spec_internal_${deviceCount}">內建</label>
                <input type="radio" id="DT_audio_spec_external_${deviceCount}" name="audio_spec_${deviceCount}" value="外接"><label for="DT_audio_spec_external_${deviceCount}">外接</label>
            </div>
            <div class="DTDV_grid-item">
                <label>品質：</label>
                <input type="radio" id="DT_audio_quality_clear_${deviceCount}" name="audio_quality_${deviceCount}" value="清晰"><label for="DT_audio_quality_clear_${deviceCount}">清晰</label>
                <input type="radio" id="DT_audio_quality_poor_${deviceCount}" name="audio_quality_${deviceCount}" value="不佳"><label for="DT_audio_quality_poor_${deviceCount}">不佳</label>
                <input type="radio" id="DT_audio_quality_untested_${deviceCount}" name="audio_quality_${deviceCount}" value="未測試"><label for="DT_audio_quality_untested_${deviceCount}">未測試</label>
            </div>
        </div>
    `;
    deviceContainer.appendChild(newDevice);
    
    // 綁定刪除按鈕事件
    newDevice.querySelector('.dt-remove-device-btn').addEventListener('click', function() {
        newDevice.remove();
    });
}

function addConnection() {
    connectionCount++;
    const connectionContainer = document.getElementById('DT_connections');
    if (!connectionContainer) return;
    
    const newConnection = document.createElement('div');
    newConnection.className = 'connection-group';
    newConnection.innerHTML = `
    <hr>    
        <div class="form-group">
            <button type="button" class="close-button dt-remove-connection-btn">×</button>
            <label for="DT_provider_${connectionCount}">電信業者：</label>
            <input type="text" id="DT_provider_${connectionCount}" name="provider_${connectionCount}">
            <label for="DT_connection_${connectionCount}">連線方式：</label>
            <select id="DT_connection_${connectionCount}" name="connection_${connectionCount}">
                <option value="-">-</option>
                <option value="Wi-Fi">Wi-Fi</option>
                <option value="有線網路">有線網路</option>
                <option value="Wi-Fi+有線網路">Wi-Fi+有線網路</option>
            </select>
        </div>
        <div class="form-group">
            <label for="DT_speed_${connectionCount}">當前網速：</label>
            <textarea id="DT_speed_${connectionCount}" name="speed_${connectionCount}"></textarea>
        </div>
    `;
    connectionContainer.appendChild(newConnection);
    
    // 綁定刪除按鈕事件
    newConnection.querySelector('.dt-remove-connection-btn').addEventListener('click', function() {
        newConnection.remove();
    });
}

// ===== 報告生成功能 =====
function generateOutput() {
    const datetime = document.getElementById('DT_datetime')?.value || '';
    const formattedDatetime = formatDateTime(datetime);
    const issues = escapeHtml(document.getElementById('DT_issues')?.value || '');
    const process = escapeHtml(document.getElementById('DT_process')?.value || '');

    const name = document.getElementById('DT_name')?.value || '';
    const phone = document.getElementById('DT_phone')?.value || '';
    const project = document.getElementById('DT_project')?.value || '';

    let deviceOutput = '';
    document.querySelectorAll('.device-group').forEach(function (el, index, array) {
        const deviceIndex = index + 1;
        const device = document.getElementById(`DT_device_${deviceIndex}`)?.value || '';
        const brand = document.getElementById(`DT_brand_${deviceIndex}`)?.value || '';
        const os = document.getElementById(`DT_os_${deviceIndex}`)?.value || '';
        const osVersion = document.getElementById(`DT_os_version_${deviceIndex}`)?.value || '';
        const browser = document.getElementById(`DT_browser_${deviceIndex}`)?.value || '';
        const videoSpec = document.querySelector(`input[name="video_spec_${deviceIndex}"]:checked`)?.value || '';
        const videoQuality = document.querySelector(`input[name="video_quality_${deviceIndex}"]:checked`)?.value || '';
        const audioSpec = document.querySelector(`input[name="audio_spec_${deviceIndex}"]:checked`)?.value || '';
        const audioQuality = document.querySelector(`input[name="audio_quality_${deviceIndex}"]:checked`)?.value || '';

        let deviceDetails = '';
        if (device && device !== '-') deviceDetails += `機型：【${device}】 `;
        if (brand) deviceDetails += `品牌：【${brand}】 `;
        if (os && os !== '-') deviceDetails += `作業系統：【${os}】<br>`;
        if (osVersion) deviceDetails += `版本/硬體：【${osVersion}】 `;
        if (browser) deviceDetails += `瀏覽器：【${browser}】<br>`;
        if (videoSpec) deviceDetails += `視訊規格：【${videoSpec}】 `;
        if (videoQuality) deviceDetails += `視訊品質：【${videoQuality}】<br>`;
        if (audioSpec) deviceDetails += `耳麥規格：【${audioSpec}】 `;
        if (audioQuality) deviceDetails += `聲音品質：【${audioQuality}】${index < array.length - 1 ? '<br>' : ''}`;

        if (deviceDetails) {
            deviceOutput += `設備（${deviceIndex}）：<br>${deviceDetails}`;
        }
    });

    let connectionOutput = '';
    document.querySelectorAll('.connection-group').forEach(function (el, index, array) {
        const connectionIndex = index + 1;
        const provider = document.getElementById(`DT_provider_${connectionIndex}`)?.value || '';
        const connection = document.getElementById(`DT_connection_${connectionIndex}`)?.value || '';
        const speed = document.getElementById(`DT_speed_${connectionIndex}`)?.value || '';

        let connectionDetails = '';
        if (provider) connectionDetails += `電信業者：【${provider}】 `;
        if (connection && connection !== '-') connectionDetails += `連線方式：【${connection}】<br>`;
        if (speed) {
            connectionDetails += `當前網速：【${speed}】${index < array.length - 1 ? '<br>' : ''}`;
        }

        if (connectionDetails) {
            connectionOutput += `連線（${connectionIndex}）：<br>${connectionDetails}`;
        }
    });

    const suitable = document.querySelector('input[name="suitable"]:checked')?.value || '';
    const boldbrief = document.getElementById('DT_boldbrief')?.value || '';

    let outputContent = `日期時間：【${formattedDatetime}】
學生姓名：【${name}】 ${phone}
測試工程師：【${project}】
--------
使用設備：
${deviceOutput}
--------
網路連線：
${connectionOutput}
--------
是否適合上課：【${suitable}】
--------
測試問題：
${issues}

處理過程：
${process}${boldbrief ? `\n<b>${boldbrief}</b>` : ''}`;

    const outputEl = document.getElementById('output_content');
    if (outputEl) {
        outputEl.innerHTML = outputContent
            .trim()
            .replace(/\n/g, '<br>')
            .replace(/【\s+/g, '【')
            .replace(/\s+】/g, '】');
    }

    // 檢查現有視窗是否已關閉
    if (!reportWindow || reportWindow.closed) {
        reportWindow = window.open('', 'TestReport', 'width=800,height=600,resizable=yes,scrollbars=yes');
    }

    // 更新現有視窗內容
    reportWindow.document.open();
    reportWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>測試報告</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    padding: 20px;
                    max-width: 800px;
                    margin: 0 auto;
                    background-color: #fff;
                }
                .report-content {
                    white-space: pre-wrap;
                    padding: 20px;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    font-size: 14px;
                }
                .copy-button {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 10px 20px;
                    background-color: #007bff;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                }
                .copy-button:hover {
                    background-color: #0056b3;
                }
            </style>
        </head>
        <body>
            <div class="report-content">${outputEl?.innerHTML || ''}</div>
            <button class="copy-button" onclick="copyReport()">複製報告</button>
            <script>
                function copyReport() {
                    const content = document.querySelector('.report-content').innerText.trim();
                    navigator.clipboard.writeText(content)
                        .then(() => alert('報告已複製到剪貼簿'))
                        .catch(err => console.error('複製失敗:', err));
                }
                document.addEventListener('keydown', function(e) {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                        if (!window.getSelection().toString()) {
                            e.preventDefault();
                            copyReport();
                        }
                    }
                });
            </script>
        </body>
        </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
}

// ===== 綁定測試模板事件 =====
function bindDTEvents() {
    // 新增設備按鈕
    const addDeviceBtn = document.getElementById('dt-add-device-btn');
    if (addDeviceBtn) {
        addDeviceBtn.addEventListener('click', addDevice);
    }

    // 新增網路連線按鈕
    const addConnectionBtn = document.getElementById('dt-add-connection-btn');
    if (addConnectionBtn) {
        addConnectionBtn.addEventListener('click', addConnection);
    }

    // 生成報告按鈕
    const generateBtn = document.getElementById('generateReportButton');
    if (generateBtn) {
        generateBtn.addEventListener('click', function(e) {
            e.preventDefault();
            generateOutput();
        });
    }

    // 面板切換
    setupPanelToggle('.DT_panel', 'DT_toggleCheckbox');
}

// ===== 初始化函數 =====

/**
 * 初始化測試模板面板
 * @param {string} containerId - 容器 ID
 */
export function initDTPanel(containerId = 'dt-panel-placeholder') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`initDTPanel: 找不到容器 #${containerId}`);
        return;
    }
    
    // 重置計數器
    deviceCount = 1;
    connectionCount = 1;
    
    // 注入 HTML
    container.innerHTML = dtPanelHTML;
    
    // 綁定事件
    bindDTEvents();
    
    console.log('✅ DTPanel (測試模板) 已初始化');
}

/**
 * 清除測試模板面板
 * @param {string} containerId - 容器 ID
 */
export function clearDTPanel(containerId = 'dt-panel-placeholder') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
    }
    // 重置計數器
    deviceCount = 1;
    connectionCount = 1;
    // 關閉報告視窗
    if (reportWindow && !reportWindow.closed) {
        reportWindow.close();
    }
    reportWindow = null;
    console.log('🧹 DTPanel (測試模板) 已清除');
}

/**
 * 初始化顧問名單面板
 * @param {string} containerId - 容器 ID
 */
export function initConsultantPanel(containerId = 'consultant-panel-placeholder') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`initConsultantPanel: 找不到容器 #${containerId}`);
        return;
    }
    
    // 注入 HTML
    container.innerHTML = consultantPanelHTML;
    
    // 設定面板切換
    setupPanelToggle('.consultantlistgooglesheet', 'toggleCheckbox');
    
    console.log('✅ ConsultantPanel (顧問名單) 已初始化');
}

/**
 * 清除顧問名單面板
 * @param {string} containerId - 容器 ID
 */
export function clearConsultantPanel(containerId = 'consultant-panel-placeholder') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
    }
    console.log('🧹 ConsultantPanel (顧問名單) 已清除');
}

/**
 * 初始化輔導通訊錄面板
 * @param {string} containerId - 容器 ID
 */
export function initAssistPanel(containerId = 'assist-panel-placeholder') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`initAssistPanel: 找不到容器 #${containerId}`);
        return;
    }
    
    // 注入 HTML
    container.innerHTML = assistPanelHTML;
    
    // 設定面板切換
    setupPanelToggle('.assist_googlesheet', 'assist_toggleCheckbox');
    
    console.log('✅ AssistPanel (輔導通訊錄) 已初始化');
}

/**
 * 清除輔導通訊錄面板
 * @param {string} containerId - 容器 ID
 */
export function clearAssistPanel(containerId = 'assist-panel-placeholder') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
    }
    console.log('🧹 AssistPanel (輔導通訊錄) 已清除');
}

/**
 * 一次初始化所有三個面板
 */
export function initAllTogglePanels() {
    initDTPanel('dt-panel-placeholder');
    initConsultantPanel('consultant-panel-placeholder');
    initAssistPanel('assist-panel-placeholder');
}

/**
 * 一次清除所有三個面板
 */
export function clearAllTogglePanels() {
    clearDTPanel('dt-panel-placeholder');
    clearConsultantPanel('consultant-panel-placeholder');
    clearAssistPanel('assist-panel-placeholder');
}