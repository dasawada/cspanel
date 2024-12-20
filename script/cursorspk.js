document.addEventListener("DOMContentLoaded", function () {
    // 添加樣式
    const style = document.createElement("style");
    style.textContent = `
        html, body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            width: 100vw;
            height: 100vh;
            background-color: #1e3d59;
            cursor: none; /* 隱藏鼠標 */
        }

        .fairy-dust {
            position: fixed;
            width: 5px;
            height: 5px;
            background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.3) 70%, rgba(255,255,255,0) 100%);
            border-radius: 50%;
            pointer-events: none;
            animation: fade-out 1s ease-out forwards, drift 1s ease-out;
        }

        @keyframes fade-out {
            0% {
                opacity: 1;
                transform: scale(1);
            }
            100% {
                opacity: 0;
                transform: scale(0.5);
            }
        }

        @keyframes drift {
            0% {
                transform: translate(0, 0);
            }
            100% {
                transform: translate(var(--dx), var(--dy));
            }
        }
    `;
    document.head.appendChild(style);

    // 定義柔和的粒子顏色池
    const colors = [
        'rgba(255,223,186,0.8)', // 柔和金色
        'rgba(255,192,203,0.8)', // 淡粉色
        'rgba(255,255,255,0.8)', // 白色
        'rgba(255,240,200,0.8)'  // 金黃色
    ];

    // 監聽鼠標移動事件
    document.addEventListener("mousemove", (e) => {
        const particleCount = Math.random() * 3 + 2; // 每次生成 2-5 個粒子
        for (let i = 0; i < particleCount; i++) {
            createFairyDust(e.pageX, e.pageY);
        }
    });

    function createFairyDust(x, y) {
        const particle = document.createElement("div");
        particle.className = "fairy-dust";

        // 隨機顏色
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];

        // 隨機漂移方向
        const dx = (Math.random() - 0.5) * 50; // X 軸偏移 -25px ~ 25px
        const dy = (Math.random() - 0.5) * 50; // Y 軸偏移 -25px ~ 25px
        particle.style.setProperty('--dx', `${dx}px`);
        particle.style.setProperty('--dy', `${dy}px`);

        // 設置粒子初始位置
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;

        // 添加到頁面中並自動移除
        document.body.appendChild(particle);
        particle.addEventListener("animationend", () => particle.remove());
    }
});
