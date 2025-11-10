// 定義面板配置
const PANEL_CONFIG = {
    'toggleCheckbox': {
        containerClass: '.consultantlistgooglesheet',
        contentId: 'content'
    },
    'NaniClub_toggleCheckbox': {
        containerClass: '.idsearchpanel',
        contentId: 'content'
    },
    'logToggleCheckbox': {
        containerClass: '.ClassLogpanel',
        contentId: 'content'
    },
    'DT_toggleCheckbox': {
        containerClass: '.DT_panel',
        contentId: 'content'
    }
};

// 統一的面板處理器
class PanelHandler {
    constructor(configs) {
        this.configs = configs;
        this.init();
    }

    init() {
        window.addEventListener('DOMContentLoaded', () => {
            this.initializePanels();
            this.setupEventListeners();
        });
    }

    initializePanels() {
        Object.keys(this.configs).forEach(checkboxId => {
            try {
                const checkbox = document.getElementById(checkboxId);
                if (checkbox) {
                    checkbox.checked = false;
                    const container = document.querySelector(this.configs[checkboxId].containerClass);
                    if (container) {
                        container.classList.add('small-size');
                        const content = container.querySelector(`#${this.configs[checkboxId].contentId}`);
                        if (content) {
                            content.style.display = 'none';
                        }
                    }
                }
            } catch (error) {
                console.warn(`初始化面板失敗: ${checkboxId}`, error);
            }
        });
    }

    setupEventListeners() {
        Object.keys(this.configs).forEach(checkboxId => {
            try {
                const checkbox = document.getElementById(checkboxId);
                if (checkbox) {
                    checkbox.addEventListener('change', (event) => this.handlePanelToggle(event));
                }
            } catch (error) {
                console.warn(`設置事件監聽器失敗: ${checkboxId}`, error);
            }
        });
    }

    handlePanelToggle(event) {
        const checkboxId = event.target.id;
        const config = this.configs[checkboxId];
        if (!config) return;

        try {
            const container = document.querySelector(config.containerClass);
            const content = container.querySelector(`#${config.contentId}`);
            
            if (event.target.checked) {
                container.classList.remove('small-size');
                content.style.display = 'block';
            } else {
                container.classList.add('small-size');
                content.style.display = 'none';
            }
        } catch (error) {
            console.warn(`切換面板失敗: ${checkboxId}`, error);
        }
    }
}

// 創建面板處理器實例
new PanelHandler(PANEL_CONFIG);
