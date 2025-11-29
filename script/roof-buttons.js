// ===== 頂部快捷按鈕模組 =====

// ===== HTML 模板 =====
const roofButtonsHTML = `
<div class="roofbutton">
    <button class="roof-btn" data-copy-text="OneClass真人Live家教_體驗接待大廳_A">接待大廳_A</button>
    <button class="roof-btn" data-copy-text="OneClass真人Live家教_官方臉書_A">FB_A</button>
    <button class="roof-btn" data-copy-text="電話進線_A">電話進線_A</button>
    <button class="roof-btn" data-copy-mgm="true">顧問MGM</button>
</div>
`;

// ===== 複製到剪貼簿函數 =====
function copyToClipboard(button, text, isMGM = false) {
    if (isMGM) {
        // MGM 邏輯：可依需求自訂
        text = generateMGMText();
    }
    
    if (!text) {
        console.warn('沒有要複製的文字');
        return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        // 顯示複製成功的視覺反饋
        const originalText = button.textContent;
        button.textContent = '✓ 已複製';
        button.classList.add('copied');
        
        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
        }, 1000);
        
        console.log(`📋 已複製: ${text}`);
    }).catch(err => {
        console.error('複製失敗:', err);
    });
}

// ===== 生成 MGM 文字 =====
function generateMGMText() {
    // 如果有特定的 MGM 邏輯，可在此處實作
    // 目前返回空字串，與原本 copyToClipboard(this, '', true) 行為一致
    return '';
}

// ===== 綁定按鈕事件 =====
function bindButtonEvents() {
    const buttons = document.querySelectorAll('.roofbutton .roof-btn');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            const isMGM = this.hasAttribute('data-copy-mgm');
            const text = this.getAttribute('data-copy-text') || '';
            copyToClipboard(this, text, isMGM);
        });
    });
}

// ===== 初始化函數 =====
export function initRoofButtons(containerId = 'roof-buttons-placeholder') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`initRoofButtons: 找不到容器 #${containerId}`);
        return;
    }
    
    // 注入 HTML
    container.innerHTML = roofButtonsHTML;
    
    // 綁定事件
    bindButtonEvents();
    
    console.log('✅ RoofButtons 已初始化');
}

// ===== 清除函數 (登出時呼叫) =====
export function clearRoofButtons(containerId = 'roof-buttons-placeholder') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
    }
    console.log('🧹 RoofButtons 已清除');
}