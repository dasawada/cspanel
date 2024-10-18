document.getElementById('DT_form').addEventListener('submit', function (e) {
    e.preventDefault(); // 阻止表单的默认提交行为
    generateOutput(); // 直接生成输出
});

function generateOutput() {
    const datetime = document.getElementById('DT_datetime').value;
    const formattedDatetime = formatDateTime(datetime);
    const issues = escapeHtml(document.getElementById('DT_issues').value || '');
    const process = escapeHtml(document.getElementById('DT_process').value || '');

    const name = document.getElementById('DT_name').value || '';
    const phone = document.getElementById('DT_phone').value || '';
    const project = document.getElementById('DT_project').value || '';

    let deviceOutput = '';
    document.querySelectorAll('.device-group').forEach(function (el, index) {
        const deviceIndex = index + 1;
        const device = document.getElementById(`DT_device_${deviceIndex}`).value || '';
        const brand = document.getElementById(`DT_brand_${deviceIndex}`).value || '';
        const os = document.getElementById(`DT_os_${deviceIndex}`).value || '';
        const osVersion = document.getElementById(`DT_os_version_${deviceIndex}`).value || '';
        const browser = document.getElementById(`DT_browser_${deviceIndex}`).value || '';
        const videoSpec = document.querySelector(`input[name="video_spec_${deviceIndex}"]:checked`)?.value || '';
        const videoQuality = document.querySelector(`input[name="video_quality_${deviceIndex}"]:checked`)?.value || '';
        const audioSpec = document.querySelector(`input[name="audio_spec_${deviceIndex}"]:checked`)?.value || '';
        const audioQuality = document.querySelector(`input[name="audio_quality_${deviceIndex}"]:checked`)?.value || '';

        // 檢查是否要輸出每個字段，避免輸出空值或 "-"
        let deviceDetails = '';
        if (device && device !== '-') deviceDetails += `機型：【${device}】 `;
        if (brand) deviceDetails += `品牌：【${brand}】 `;
        if (os && os !== '-') deviceDetails += `作業系統：【${os}】<br>`;
        if (osVersion) deviceDetails += `版本/硬體條件：【${osVersion}】 `;
        if (browser) deviceDetails += `瀏覽器：【${browser}】<br>`;
        if (videoSpec) deviceDetails += `視訊規格：【${videoSpec}】 `;
        if (videoQuality) deviceDetails += `視訊品質：【${videoQuality}】<br>`;
        if (audioSpec) deviceDetails += `耳麥規格：【${audioSpec}】 `;
        if (audioQuality) deviceDetails += `聲音品質：【${audioQuality}】<br>`;

        if (deviceDetails) {
            deviceOutput += `設備（${deviceIndex}）：<br>${deviceDetails}`;
        }
    });

    let connectionOutput = '';
    document.querySelectorAll('.connection-group').forEach(function (el, index) {
        const connectionIndex = index + 1;
        const provider = document.getElementById(`DT_provider_${connectionIndex}`).value || '';
        const connection = document.getElementById(`DT_connection_${connectionIndex}`).value || '';
        const speed = document.getElementById(`DT_speed_${connectionIndex}`).value || '';

        // 檢查是否要輸出每個字段，避免輸出空值或 "-"
        let connectionDetails = '';
        if (provider) connectionDetails += `電信業者：【${provider}】 `;
        if (connection && connection !== '-') connectionDetails += `連線方式：【${connection}】<br>`;
        if (speed) connectionDetails += `當前網速：【${speed}】<br>`;

        if (connectionDetails) {
            connectionOutput += `連線（${connectionIndex}）：<br>${connectionDetails}`;
        }
    });

    const suitable = document.querySelector('input[name="suitable"]:checked')?.value || '';
    const boldbrief = document.getElementById('DT_boldbrief').value || '';

    let outputContent = `
        ${formattedDatetime ? `日期時間：【${formattedDatetime}】<br>` : ''}
        ${name || phone ? `學生姓名：【${name}】 ${phone}<br>` : ''}
        ${project ? `測試工程師：【${project}】<br>` : ''}
        ${deviceOutput ? `--------<br>使用設備：<br>${deviceOutput}--------<br>` : ''}
        ${connectionOutput ? `網路連線：<br>${connectionOutput}--------<br>` : ''}
        ${suitable ? `是否適合上課：【${suitable}】<br>--------<br>` : ''}
        ${issues ? `測試問題：<br><pre style="white-space: pre-wrap;">${issues}</pre><br><br>` : ''}
        ${process ? `處理過程：<br><pre style="white-space: pre-wrap;">${process}</pre><br><br>` : ''}
        ${boldbrief ? `<b>${boldbrief}</b>` : ''}
    `;

    document.getElementById('output_content').innerHTML = outputContent.trim();
}
