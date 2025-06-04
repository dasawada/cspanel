// enhancedInput.js

export function enhanceInput(selector, options = {}) {
    const targetInput = document.querySelector(selector);
    if (!targetInput) {
      console.warn(`[enhanceInput] No input element found for selector: ${selector}`);
      return;
    }
  
    // 防止重複初始化
    if (targetInput.dataset.enhanced === 'true') return;
    targetInput.dataset.enhanced = 'true';
  
    // 包裝容器
    const wrapper = document.createElement('div');
    wrapper.classList.add('enhanced-wrapper');
  
    // 將 input 放入包裝容器中
    targetInput.classList.add('enhanced-input');
    targetInput.parentNode.insertBefore(wrapper, targetInput);
    wrapper.appendChild(targetInput);
  
    // 建立清除按鈕
    const clearBtn = document.createElement('span');
    clearBtn.classList.add('enhanced-clear-btn');
    wrapper.appendChild(clearBtn);
  
    // 輸入變化時顯示或隱藏按鈕
    targetInput.addEventListener('input', () => {
      clearBtn.style.display = targetInput.value ? 'block' : 'none';
    });
  
    // 按下清除按鈕
    clearBtn.addEventListener('click', () => {
      targetInput.value = '';
      clearBtn.style.display = 'none';
      targetInput.focus();
    });
  
    // 按下 Enter 時觸發事件
    targetInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.stopPropagation(); // 不冒泡，避免影響其他表單提交
        options.onEnter?.(targetInput.value.trim());
      }
    });
  
    injectStyles();
  }
  
  function injectStyles() {
    if (document.getElementById('enhanced-input-style')) return;
  
    const style = document.createElement('style');
    style.id = 'enhanced-input-style';
    style.textContent = `
    .enhanced-wrapper {
      position: relative;
      display: inline-block;
      width: 100%;
    }
  
    .enhanced-wrapper .enhanced-input {
      width: 100%;
      border: 1px solid #ccc;
      border-radius: 9999px;
      padding: 6px 28px 6px 12px;
      font-size: 14px;
      box-sizing: border-box;
      background: #fff;
      color: #333;
      transition: all 0.2s ease-in-out;
    }
  
    .enhanced-wrapper .enhanced-clear-btn {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 16px;
      cursor: pointer;
      color: #999;
      display: none;
      z-index: 2;
      user-select: none;
    }
  
    .enhanced-wrapper .enhanced-clear-btn::before {
      content: '×';
    }
  `;  
    document.head.appendChild(style);
  }
  