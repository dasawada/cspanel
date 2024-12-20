document.addEventListener("DOMContentLoaded", function () {
    const style = document.createElement("style");
    style.textContent = `
        html, body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            width: 100vw;
            height: 100vh;
            background-color: #1e3d59;
            cursor: crosshair;
        }

        .particle {
            position: fixed;
            width: 1px; /* 最小粒子大小 */
            height: 1px; /* 最小粒子大小 */
            background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.7) 70%, rgba(255,255,255,0) 100%);
            border-radius: 50%; /* 圓形粒子 */
            pointer-events: none;
            animation: particle-fade 1.5s ease-out forwards;
        }

        @keyframes particle-fade {
            0% {
                opacity: 1;
                transform: translate(0, 0) scale(1);
            }
            100% {
                opacity: 0;
                transform: translate(var(--dx, 0), var(--dy, 0)) scale(0.5);
            }
        }
    `;
    document.head.appendChild(style);

    // 隨機顏色池
    const colors = ['#ffffff', '#ffcc33', '#ff9966', '#ff6633', '#ff0000'];

    // 監聽鼠標移動事件
    document.addEventListener("mousemove", (e) => {
        const particleCount = Math.random() * 4 + 2; // 每次生成 2-6 個粒子
        for (let i = 0; i < particleCount; i++) {
            createParticle(e.pageX, e.pageY);
        }
    });

    function createParticle(x, y) {
        const particle = document.createElement("div");
        particle.className = "particle";

        // 設定隨機顏色
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];

        // 粒子大小 (極小化)
        const size = Math.random() * 1 + 1; // 1px ~ 2px
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;

        // 隨機方向和速度
        const angle = Math.random() * Math.PI * 2; // 0 ~ 360°
        const speed = Math.random() * 3 + 1; // 1 ~ 4
        const dx = Math.cos(angle) * speed; // X 軸速度
        const dy = Math.sin(angle) * speed - 1; // Y 軸速度 (向上漂移)

        // 設定粒子位移變量
        particle.style.setProperty('--dx', `${dx * 20}px`); // X 偏移放大以更顯著
        particle.style.setProperty('--dy', `${dy * 20}px`); // Y 偏移放大以更顯著

        // 初始位置
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;

        // 添加粒子到頁面，並在動畫結束後移除
        document.body.appendChild(particle);
        particle.addEventListener("animationend", () => particle.remove());
    }
});
