// ===== 擴充元件下載面板模組 =====

// ===== HTML 模板 =====
const toolDownloadHTML = `
<div class="tool_zip_dl">
  擴充元件下載：<br>
  <button class="tool-dl-btn" data-url="https://dasawada.github.io/cspanel/tool_zip/點名1.6.5.zip">
    點名
  </button>
  <button class="tool-dl-btn" data-url="https://dasawada.github.io/cspanel/tool_zip/號碼偵測.zip">
    📞複製
  </button>
  <button class="tool-dl-btn" data-url="https://dasawada.github.io/cspanel/tool_zip/MMS連續課程星期幾.zip">
    連續星期幾
  </button>
  <button class="tool-dl-btn" data-url="https://dasawada.github.io/cspanel/tool_zip/BX服務用語快捷鍵.zip">
    服務語
  </button>
</div>
`;

// ===== 綁定按鈕事件 =====
function bindDownloadEvents() {
    const buttons = document.querySelectorAll('.tool_zip_dl .tool-dl-btn');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            const url = this.getAttribute('data-url');
            if (url) {
                window.location.href = url;
            }
        });
    });
}

// ===== 初始化函數 =====
export function initToolDownloadPanel(containerId = 'tool-download-placeholder') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`initToolDownloadPanel: 找不到容器 #${containerId}`);
        return;
    }
    
    // 注入 HTML
    container.innerHTML = toolDownloadHTML;
    
    // 綁定事件
    bindDownloadEvents();
    
    console.log('✅ ToolDownloadPanel 已初始化');
}

// ===== 清除函數 (登出時呼叫) =====
export function clearToolDownloadPanel(containerId = 'tool-download-placeholder') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
    }
    console.log('🧹 ToolDownloadPanel 已清除');
}