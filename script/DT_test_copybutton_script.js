document.addEventListener('DOMContentLoaded', function() {
    const copyBtn = document.getElementById('copyReportButton');
    if (!copyBtn) {
        console.warn('Copy button element not found');
        return;
    }
    copyBtn.addEventListener('click', function() {
        const output = document.getElementById('output_content');
        if (output) {
            navigator.clipboard.writeText(output.textContent)
                .then(() => alert('已複製到剪貼簿'))
                .catch(err => console.error('複製失敗:', err));
        }
    });
});