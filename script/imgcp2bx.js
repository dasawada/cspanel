document.addEventListener('DOMContentLoaded', (event) => {
    document.querySelector('.appicon').addEventListener('click', function(e) {
if (e.target && e.target.tagName === 'IMG') {
    copyImageToClipboard(e.target.id);
}
    });

    async function copyImageToClipboard(imageId) {
try {
    // 獲取img URL
    const imgURL = document.getElementById(imageId).src;

    // fetch拿圖片Blob
    const response = await fetch(imgURL);
    if (!response.ok) {
throw new Error('無回應');
    }
    const blob = await response.blob();

    // 建立ClipboardItem並貼到剪貼簿
    const clipboardItem = new ClipboardItem({ [blob.type]: blob });
    await navigator.clipboard.write([clipboardItem]);

    console.log('圖片已複製');
} catch (error) {
    console.error('複製圖片時剪貼簿出錯: ', error);
}
    }

    // 請剪貼簿權限
    if (navigator.permissions) {
navigator.permissions.query({ name: 'clipboard-write' }).then(result => {
    if (result.state === 'granted') {
console.log('剪貼簿寫入權限GET');
    } else if (result.state === 'prompt') {
console.log('剪貼簿寫入權限 待接受');
    } else {
console.log('無剪貼簿使用權');
    }
});
    }
});