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

// Move event listener inside DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    const DT_form = document.querySelector('.form_container');
    if (!DT_form) {
        console.warn('Device testing form not found');
        return;
    }

    DT_form.addEventListener('submit', function(e) {
        e.preventDefault();
        generateOutput();
    });

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

    // 初始化所有面板
    const panels = [
        {class: '.consultantlistgooglesheet', id: 'toggleCheckbox'},
        {class: '.idsearchpanel', id: 'NaniClub_toggleCheckbox'},
        {class: '.ClassLogpanel', id: 'logToggleCheckbox'},
        {class: '.DT_panel', id: 'DT_toggleCheckbox'},
        {class: '.assist_googlesheet', id: 'assist_toggleCheckbox'},
        {class: '.assist-issue', id: 'assist-issue-toggleCheckbox'}
    ];

    panels.forEach(panel => {
        setupToggle(panel.class, panel.id);
    });

    // Form validation setup
    const form = document.querySelector('.form_container');
    if (form) {
        const requiredFields = form.querySelectorAll('[required]');
        
        form.addEventListener('submit', function(e) {
            let isValid = true;

            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    isValid = false;
                    field.classList.add('error');
                } else {
                    field.classList.remove('error');
                }
            });

            if (!isValid) {
                e.preventDefault();
                alert('請填寫所有必填欄位');
            }
        });

        requiredFields.forEach(field => {
            field.addEventListener('input', function() {
                if (this.value.trim()) {
                    this.classList.remove('error');
                } else {
                    this.classList.add('error');
                }
            });
        });
    }
});
