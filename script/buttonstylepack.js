// buttonStyle.js
export function enhanceButton(selector, options = {}) {
    const defaultTheme = {
      borderRadius: '12px',
      padding: '10px 20px',
      backgroundColor: '#007bff',
      color: '#fff',
      hoverBackgroundColor: '#0056b3',
      activeBackgroundColor: '#004085',
      transition: 'background-color 0.3s ease',
      whiteSpace: 'nowrap',
      fontsize: '14px',
      lineHeight: '1.5'
    };
  
    const theme = { ...defaultTheme, ...options.theme };
  
    // 插入樣式
    const style = document.createElement('style');
    style.textContent = `
      ${selector} {
        border-radius: ${theme.borderRadius};
        padding: ${theme.padding};
        background-color: ${theme.backgroundColor};
        color: ${theme.color};
        border: none;
        cursor: pointer;
        transition: ${theme.transition};
        user-select: none;
        white-space: ${theme.whiteSpace};
      }
      ${selector}:hover {
        background-color: ${theme.hoverBackgroundColor};
      }
      ${selector}:active {
        background-color: ${theme.activeBackgroundColor};
      }
      ${selector}:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(0,123,255,0.5);
      }
    `;
    document.head.appendChild(style);
  
    // 這裡可以再做其他事件綁定，這邊先不綁定事件，純用CSS樣式控制
  }
  