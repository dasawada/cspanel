function formatDateTime(datetime) {
    if (!datetime) {
        return '';
    }
    const date = new Date(datetime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}/${month}/${day} ${hours}:${minutes}`;
}

        document.getElementById('DT_form').addEventListener('submit', function (e) {
            e.preventDefault(); // 阻止表单的默认提交行为
            generateOutput(); // 直接生成输出

    // 清除舊的錯誤訊息
    document.querySelectorAll('.error').forEach(function (el) {
        el.style.display = 'none';
    });

    document.querySelectorAll('.device-group').forEach(function (el, index) {
        const deviceIndex = index + 1;
        const osId = `DT_os_${deviceIndex}`;
        const osVersionId = `DT_os_version_${deviceIndex}`;
        const videoSpecName = `video_spec_${deviceIndex}`;
        const videoQualityName = `video_quality_${deviceIndex}`;
        const audioSpecName = `audio_spec_${deviceIndex}`;
        const audioQualityName = `audio_quality_${deviceIndex}`;

        if (!document.getElementById(osVersionId).value || document.getElementById(`DT_device_${deviceIndex}`).value === '-') {
            document.getElementById(`error_device_os_${deviceIndex}`).style.display = 'block';
            errors = true;
        }

        if (!document.querySelector(`input[name="${videoSpecName}"]:checked`) || !document.querySelector(`input[name="${videoQualityName}"]:checked`)) {
            document.getElementById(`error_video_${deviceIndex}`).style.display = 'block';
            errors = true;
        }

        if (!document.querySelector(`input[name="${audioSpecName}"]:checked`) || !document.querySelector(`input[name="${audioQualityName}"]:checked`)) {
            document.getElementById(`error_audio_${deviceIndex}`).style.display = 'block';
            errors = true;
        }
    });

    document.querySelectorAll('.connection-group').forEach(function (el, index) {
        const connectionIndex = index + 1;
        const providerId = `DT_provider_${connectionIndex}`;
        const connectionId = `DT_connection_${connectionIndex}`;

        if (!document.getElementById(providerId).value || document.getElementById(connectionId).value === '-') {
            document.getElementById(`error_connection_${connectionIndex}`).style.display = 'block';
            errors = true;
        }
    });

    if (!document.querySelector('input[name="suitable"]:checked')) {
        document.getElementById('error_suitable').style.display = 'block';
        errors = true;
    }
    if (!document.getElementById('DT_issues').value) {
        document.getElementById('error_issues').style.display = 'block';
        errors = true;
    }
    if (!document.getElementById('DT_process').value) {
        document.getElementById('error_process').style.display = 'block';
        errors = true;
    }
    if (!document.getElementById('DT_boldbrief').value) {
        document.getElementById('error_boldbrief').style.display = 'block';
        errors = true;
    }

    if (!errors) {
        generateOutput();
    }
});

// 多行內容斷行判斷
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', (event) => {
    function setupToggle(containerClass, checkboxId) {
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

    setupToggle('.consultantlistgooglesheet', 'toggleCheckbox');
    setupToggle('.idsearchpanel', 'NaniClub_toggleCheckbox');
    setupToggle('.ClassLogpanel', 'logToggleCheckbox');
});

//error alart
function validateForm() {
    let errors = false;

    // 檢查日期時間、姓名、電話和測試工程師字段
    if (!document.getElementById('DT_datetime').value || 
        !document.getElementById('DT_name').value || 
        !document.getElementById('DT_phone').value || 
        !document.getElementById('DT_project').value) {
        
        if (!document.getElementById('DT_datetime').value) {
            document.getElementById('error_datetime').style.display = 'block';
        }
        if (!document.getElementById('DT_name').value || !document.getElementById('DT_phone').value) {
            document.getElementById('error_name_phone').style.display = 'block';
        }
        if (!document.getElementById('DT_project').value) {
            document.getElementById('error_project').style.display = 'block';
        }
        errors = true;
    }

    // 檢查每個設備組
    document.querySelectorAll('.device-group').forEach(function (el, index) {
        const deviceIndex = index + 1;
        const device = document.getElementById(`DT_device_${deviceIndex}`).value;
        const os = document.getElementById(`DT_os_${deviceIndex}`).value;
        const errorElement = document.getElementById(`error_device_os_${deviceIndex}`);

        if (!device || device === "-" || !os || os === "-") {
            errorElement.style.display = 'block';
            errors = true;
        } else {
            errorElement.style.display = 'none';
        }

        const videoSpec = document.querySelector(`input[name="video_spec_${deviceIndex}"]:checked`);
        const videoQuality = document.querySelector(`input[name="video_quality_${deviceIndex}"]:checked`);
        const videoErrorElement = document.getElementById(`error_video_${deviceIndex}`);

        if (!videoSpec || !videoQuality) {
            videoErrorElement.style.display = 'block';
            errors = true;
        } else {
            videoErrorElement.style.display = 'none';
        }

        const audioSpec = document.querySelector(`input[name="audio_spec_${deviceIndex}"]:checked`);
        const audioQuality = document.querySelector(`input[name="audio_quality_${deviceIndex}"]:checked`);
        const audioErrorElement = document.getElementById(`error_audio_${deviceIndex}`);

        if (!audioSpec || !audioQuality) {
            audioErrorElement.style.display = 'block';
            errors = true;
        } else {
            audioErrorElement.style.display = 'none';
        }
    });

    // 檢查每個連線組
    document.querySelectorAll('.connection-group').forEach(function (el, index) {
        const connectionIndex = index + 1;
        const provider = document.getElementById(`DT_provider_${connectionIndex}`).value;
        const connection = document.getElementById(`DT_connection_${connectionIndex}`).value;
        const errorElement = document.getElementById(`error_connection_${connectionIndex}`);

        if (!provider || provider.trim() === "" || !connection || connection === "-") {
            errorElement.style.display = 'block';
            errors = true;
        } else {
            errorElement.style.display = 'none';
        }
    });

    // 檢查適合上課的選擇
    const suitable = document.querySelector('input[name="suitable"]:checked');
    if (!suitable) {
        document.getElementById('error_suitable').style.display = 'block';
        errors = true;
    } else {
        document.getElementById('error_suitable').style.display = 'none';
    }

    // 檢查測試問題和處理過程字段
    if (!document.getElementById('DT_issues').value) {
        document.getElementById('error_issues').style.display = 'block';
        errors = true;
    } else {
        document.getElementById('error_issues').style.display = 'none';
    }
    if (!document.getElementById('DT_process').value) {
        document.getElementById('error_process').style.display = 'block';
        errors = true;
    } else {
        document.getElementById('error_process').style.display = 'none';
    }

    if (!document.getElementById('DT_boldbrief').value) {
        document.getElementById('error_boldbrief').style.display = 'block';
        errors = true;
    } else {
        document.getElementById('error_boldbrief').style.display = 'none';
    }

    return !errors;
}

document.getElementById('DT_form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (validateForm()) {
        generateOutput();
    }
});

