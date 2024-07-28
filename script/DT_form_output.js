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

        deviceOutput += `
        
        　設備（${deviceIndex}）：<br>
        　機型：【${device}】 品牌：【${brand}】 作業系統：【${os}】<br>
        　版本/硬體條件：【${osVersion}】 瀏覽器：【${browser}】<br>
        　視訊規格：【${videoSpec}】 視訊品質：【${videoQuality}】<br>
        　耳麥規格：【${audioSpec}】 聲音品質：【${audioQuality}】<br>
        `;
    });

    let connectionOutput = '';
    document.querySelectorAll('.connection-group').forEach(function (el, index) {
        const connectionIndex = index + 1;
        const provider = document.getElementById(`DT_provider_${connectionIndex}`).value || '';
        const connection = document.getElementById(`DT_connection_${connectionIndex}`).value || '';
        const speed = document.getElementById(`DT_speed_${connectionIndex}`).value || '';

        connectionOutput += `
        
        　連線（${connectionIndex}）：<br>
        　電信業者：【${provider}】 連線方式：【${connection}】<br>
        　當前網速：【${speed}】<br>
        `;
    });

    const suitable = document.querySelector('input[name="suitable"]:checked')?.value || '';
    const boldbrief = document.getElementById('DT_boldbrief').value || '';

    let outputContent = `
        日期時間：【${formattedDatetime}】<br>
        學生姓名：【${name}】 ${phone}<br>
        測試工程師：【${project}】<br>
		--------<br>
        使用設備：<br>
		${deviceOutput}
		--------<br>
        網路連線：<br>
		${connectionOutput}
		--------<br>
        是否適合上課：【${suitable}】<br>
        --------<br>
        測試問題：<br>
        <pre style="white-space: pre-wrap;">${issues}</pre><br>
		　<br>
        處理過程：<br>
        <pre style="white-space: pre-wrap;">${process}</pre><br>
		　<br>
        <b>${boldbrief}</b>
    `;

    document.getElementById('output_content').innerHTML = outputContent.trim();
}