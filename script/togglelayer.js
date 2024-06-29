document.getElementById('toggleCheckbox').addEventListener('change', function() {
    const content = document.querySelector('.consultantlistgooglesheet #content');
    const container = document.querySelector('.consultantlistgooglesheet');
    if (this.checked) {
        container.classList.remove('small-size');
        content.style.display = 'block';
    } else {
        container.classList.add('small-size');
        content.style.display = 'none';
    }
});

document.getElementById('NaniClub_toggleCheckbox').addEventListener('change', function() {
    const content = document.querySelector('.idsearchpanel #content');
    const container = document.querySelector('.idsearchpanel');
    if (this.checked) {
        container.classList.remove('small-size');
        content.style.display = 'block';
    } else {
        container.classList.add('small-size');
        content.style.display = 'none';
    }
});

document.getElementById('logToggleCheckbox').addEventListener('change', function() {
    const content = document.querySelector('.ClassLogpanel #content');
    const container = document.querySelector('.ClassLogpanel');
    if (this.checked) {
        container.classList.remove('small-size');
        content.style.display = 'block';
    } else {
        container.classList.add('small-size');
        content.style.display = 'none';
    }
});

window.addEventListener('DOMContentLoaded', (event) => {
    const consultantContainer = document.querySelector('.consultantlistgooglesheet');
    const consultantContent = consultantContainer.querySelector('#content');
    const consultantCheckbox = document.getElementById('toggleCheckbox');
    consultantCheckbox.checked = false;
    consultantContainer.classList.add('small-size');
    consultantContent.style.display = 'none';

    const idsearchContainer = document.querySelector('.idsearchpanel');
    const idsearchContent = idsearchContainer.querySelector('#content');
    const idsearchCheckbox = document.getElementById('NaniClub_toggleCheckbox');
    idsearchCheckbox.checked = false;
    idsearchContainer.classList.add('small-size');
    idsearchContent.style.display = 'none';

    const classLogContainer = document.querySelector('.ClassLogpanel');
    const classLogContent = classLogContainer.querySelector('#content');
    const classLogCheckbox = document.getElementById('logToggleCheckbox');
    classLogCheckbox.checked = false;
    classLogContainer.classList.add('small-size');
    classLogContent.style.display = 'none';
});
