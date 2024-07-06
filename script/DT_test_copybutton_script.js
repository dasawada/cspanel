document.getElementById('copyReportButton').addEventListener('click', function() {
    const outputContent = document.getElementById('output_content');
    DT_copyToClipboard(outputContent);
});

function DT_copyToClipboard(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    try {
        document.execCommand('copy');
        const copyButton = document.getElementById('copyReportButton');
        copyButton.textContent = '已複製！';
        copyButton.style.backgroundColor = 'green';
        copyButton.style.color = 'white';

        setTimeout(() => {
            copyButton.textContent = '複製報告';
            copyButton.style.backgroundColor = '';
            copyButton.style.color = '';
        }, 2000);
    } catch (err) {
        console.error('複製失敗', err);
    }

    selection.removeAllRanges();
}