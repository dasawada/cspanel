document.getElementById('copyReportButton').addEventListener('click', function() {
    const outputContent = document.getElementById('output_content');
    if (outputContent.textContent.trim() === "") {
        showCopyError();
    } else {
        DT_copyToClipboard(outputContent);
    }
});

function DT_copyToClipboard(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            const copyButton = document.getElementById('copyReportButton');
            copyButton.textContent = '已複製！';
            copyButton.style.backgroundColor = 'green';
            copyButton.style.color = 'white';

            setTimeout(() => {
                copyButton.textContent = '複製報告';
                copyButton.style.backgroundColor = '';
                copyButton.style.color = '';
            }, 2000);
        } else {
            console.error('複製失敗');
        }
    } catch (err) {
        console.error('複製失敗', err);
    }

    selection.removeAllRanges();
}

function showCopyError() {
    const copyButton = document.getElementById('copyReportButton');
    copyButton.textContent = '無報告可複製';
    copyButton.style.backgroundColor = 'red';
    copyButton.style.color = 'white';

    setTimeout(() => {
        copyButton.textContent = '複製報告';
        copyButton.style.backgroundColor = '';
        copyButton.style.color = '';
    }, 2000);
}

