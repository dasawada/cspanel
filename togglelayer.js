// 顧問名單googlesheet勾選腳本
document.getElementById('toggleCheckbox').addEventListener('change', function() {
    const content = document.getElementById('content');
    const container = document.querySelector('.consultantlistgooglesheet');
    if (this.checked) {
        container.classList.remove('small-size');
        content.style.display = 'block';
    } else {
        container.classList.add('small-size');
        content.style.display = 'none';
    }
});

// idsearchpanel勾選腳本
document.getElementById('NaniClub_toggleCheckbox').addEventListener('change', function() {
    const content = document.getElementById('usersearch');
    const container = document.querySelector('.idsearchpanel');
    if (this.checked) {
        container.classList.remove('small-size');
        content.style.display = 'block';
    } else {
        container.classList.add('small-size');
        content.style.display = 'none';
    }
});
// 頁面載入時初始化
window.addEventListener('DOMContentLoaded', (event) => {
    // 初始化顧問名單googlesheet
    const consultantContainer = document.querySelector('.consultantlistgooglesheet');
    const consultantContent = document.getElementById('content');
    const consultantCheckbox = document.getElementById('toggleCheckbox');

    // 頁面載入時預設未勾選並顯示小尺寸
    consultantCheckbox.checked = false;
    consultantContainer.classList.add('small-size');
    consultantContent.style.display = 'none';

    // 初始化idsearchpanel
    const idsearchContainer = document.querySelector('.idsearchpanel');
    const idsearchContent = document.getElementById('usersearch');
    const idsearchCheckbox = document.getElementById('NaniClub_toggleCheckbox');

    // 頁面載入時預設未勾選並顯示小尺寸
    idsearchCheckbox.checked = false;
    idsearchContainer.classList.add('small-size');
    idsearchContent.style.display = 'none';
});


