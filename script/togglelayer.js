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

document.getElementById('DT_toggleCheckbox').addEventListener('change', function() {
    const content = document.querySelector('.DT_panel #content');
    const container = document.querySelector('.DT_panel');
    if (this.checked) {
        container.classList.remove('small-size');
        content.style.display = 'block';
    } else {
        container.classList.add('small-size');
        content.style.display = 'none';
    }
});

window.addEventListener('DOMContentLoaded', (event) => {
    const initToggle = (containerSelector, checkboxId) => {
        const container = document.querySelector(containerSelector);
        const content = container.querySelector('#content');
        const checkbox = document.getElementById(checkboxId);
        checkbox.checked = false;
        container.classList.add('small-size');
        content.style.display = 'none';
    };

    initToggle('.consultantlistgooglesheet', 'toggleCheckbox');
    initToggle('.idsearchpanel', 'NaniClub_toggleCheckbox');
    initToggle('.ClassLogpanel', 'logToggleCheckbox');
    initToggle('.DT_panel', 'DT_toggleCheckbox');
});
