// 添加必要的工具函數
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

let reportWindow = null; // 全局變數保存彈出視窗引用

document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('.form_container');
    const generateButton = document.getElementById('generateReportButton');

    if (!form || !generateButton) {
        console.warn('Form container or generate button not found');
        return;
    }

    // 簡化事件處理
    generateButton.addEventListener('click', function(e) {
        e.preventDefault();
        generateOutput();
    });
});

function handleFormSubmit(e) {
    e.preventDefault();
    generateOutput();
}

function generateOutput() {
    const datetime = document.getElementById('DT_datetime').value;
    const formattedDatetime = formatDateTime(datetime);
    const issues = escapeHtml(document.getElementById('DT_issues').value || '');
    const process = escapeHtml(document.getElementById('DT_process').value || '');

    const name = document.getElementById('DT_name').value || '';
    const phone = document.getElementById('DT_phone').value || '';
    const project = document.getElementById('DT_project').value || '';

    let deviceOutput = '';
    document.querySelectorAll('.device-group').forEach(function (el, index, array) {
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

        // Avoid outputting empty fields or "-"
        let deviceDetails = '';
        if (device && device !== '-') deviceDetails += `機型：【${device}】 `;
        if (brand) deviceDetails += `品牌：【${brand}】 `;
        if (os && os !== '-') deviceDetails += `作業系統：【${os}】<br>`;
        if (osVersion) deviceDetails += `版本/硬體：【${osVersion}】 `;
        if (browser) deviceDetails += `瀏覽器：【${browser}】<br>`;
        if (videoSpec) deviceDetails += `視訊規格：【${videoSpec}】 `;
        if (videoQuality) deviceDetails += `視訊品質：【${videoQuality}】<br>`;
        if (audioSpec) deviceDetails += `耳麥規格：【${audioSpec}】 `;
        // 最後一個設備的最後一個欄位不添加換行
        if (audioQuality) deviceDetails += `聲音品質：【${audioQuality}】${index < array.length - 1 ? '<br>' : ''}`;

        if (deviceDetails) {
            deviceOutput += `設備（${deviceIndex}）：<br>${deviceDetails}`;
        }
    });

    let connectionOutput = '';
    document.querySelectorAll('.connection-group').forEach(function (el, index, array) {
        const connectionIndex = index + 1;
        const provider = document.getElementById(`DT_provider_${connectionIndex}`).value || '';
        const connection = document.getElementById(`DT_connection_${connectionIndex}`).value || '';
        const speed = document.getElementById(`DT_speed_${connectionIndex}`).value || '';

        // Avoid outputting empty fields or "-"
        let connectionDetails = '';
        if (provider) connectionDetails += `電信業者：【${provider}】 `;
        if (connection && connection !== '-') connectionDetails += `連線方式：【${connection}】<br>`;
        // 判斷是否為最後一條記錄，如果是最後一條則不添加換行符
        if (speed) {
            connectionDetails += `當前網速：【${speed}】${index < array.length - 1 ? '<br>' : ''}`;
        }

        if (connectionDetails) {
            connectionOutput += `連線（${connectionIndex}）：<br>${connectionDetails}`;
        }
    });

    const suitable = document.querySelector('input[name="suitable"]:checked')?.value || '';
    const boldbrief = document.getElementById('DT_boldbrief').value || '';

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

    document.getElementById('output_content').innerHTML = outputContent
        .trim()
        .replace(/\n/g, '<br>')
        .replace(/【\s+/g, '【')
        .replace(/\s+】/g, '】');

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
            <div class="report-content">${document.getElementById('output_content').innerHTML}</div>
            <button class="copy-button" onclick="copyReport()">複製報告</button>
            <script>
                function copyReport() {
                    const content = document.querySelector('.report-content').innerText.trim();
                    navigator.clipboard.writeText(content)
                        .then(() => alert('報告已複製到剪貼簿'))
                        .catch(err => console.error('複製失敗:', err));
                }
                // 僅當沒有選取文字時才自動複製，否則保留原生 Ctrl+C 行為
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
    reportWindow.focus(); // 將焦點切換到報告視窗
}

// Function to generate the report
function generateReport() {
    // Collect all form data
    const datetime = document.getElementById('DT_datetime').value;
    const name = document.getElementById('DT_name').value;
    const phone = document.getElementById('DT_phone').value;
    const project = document.getElementById('DT_project').value;
    const suitable = document.querySelector('input[name="suitable"]:checked')?.value || '';
    const issues = document.getElementById('DT_issues').value;
    const process = document.getElementById('DT_process').value;
    const boldbrief = document.getElementById('DT_boldbrief').value;

    // Generate report HTML
    let reportHtml = `
        <h3>測試報告</h3>
        <p>日期時間：${datetime}</p>
        <p>學生資訊：${name} / ${phone}</p>
        <p>測試工程師：${project}</p>
        <p>是否適合上課：${suitable}</p>
        <p>測試問題：${issues}</p>
        <p>處理過程：${process}</p>
    `;

    if (boldbrief) {
        reportHtml += `<p><strong>${boldbrief}</strong></p>`;
    }

    // Add device information
    // ...add your existing device info collection logic here...

    // Display the report
    const outputContent = document.getElementById('output_content');
    outputContent.innerHTML = reportHtml;
}
