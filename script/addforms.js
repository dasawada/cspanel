let deviceCount = 1;
let connectionCount = 1;

function addDevice() {
    deviceCount++;
    const deviceContainer = document.getElementById('DT_devices');
    const newDevice = document.createElement('div');
    newDevice.className = 'device-group';
    newDevice.innerHTML = `
    <hr>
        <div class="form-group">
            <button type="button" class="close-button" onclick="removeDevice(this)">×</button>
        </div>
        <div class="row">
            <div><label for="DT_device_${deviceCount}">設備<span class="red-asterisk">*</span></label></div>
            <div><label for="DT_brand_${deviceCount}">品牌<span class="red-asterisk">*</span></label></div>
            <div><label for="DT_os_${deviceCount}">作業系統<span class="red-asterisk">*</span></label></div>
            <div><label for="DT_os_version_${deviceCount}">版本/硬體<span class="red-asterisk">*</span></label></div>
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
}

function removeDevice(button) {
    const deviceGroup = button.closest('.device-group');
    deviceGroup.remove();
}
    
function addConnection() {
    connectionCount++;
    const connectionContainer = document.getElementById('DT_connections');
    const newConnection = document.createElement('div');
    newConnection.className = 'connection-group';
    newConnection.innerHTML = `
    <hr>    
        <div class="form-group">
            <button type="button" class="close-button" onclick="removeConnection(this)">×</button>
            <label for="DT_provider_${connectionCount}">電信業者：<span class="red-asterisk">*</span></label>
            <input type="text" id="DT_provider_${connectionCount}" name="provider_${connectionCount}" >
            <label for="DT_connection_${connectionCount}">連線方式：<span class="red-asterisk">*</span></label>
            <select id="DT_connection_${connectionCount}" name="connection_${connectionCount}" >
                <option value="-">-</option>
                <option value="Wi-Fi">Wi-Fi</option>
                <option value="有線網路">有線網路</option>
                <option value="Wi-Fi+有線網路">Wi-Fi+有線網路</option>
            </select>
        </div>
        <div class="form-group">
            <label for="DT_speed_${connectionCount}">當前網速：<span class="red-asterisk">*</span></label>
            <textarea id="DT_speed_${connectionCount}" name="speed_${connectionCount}" ></textarea>
        </div>
    `;
    connectionContainer.appendChild(newConnection);
}

function removeConnection(button) {
    const connectionGroup = button.closest('.connection-group');
    connectionGroup.remove();
}