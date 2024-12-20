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
        }

        .particle {
            position: fixed;
            width: 1px; /* 基本粒子尺寸 */
            height: 1px; /* 基本粒子尺寸 */
            background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.5) 70%, rgba(255,255,255,0) 100%);
            border-radius: 50%; /* 圓形粒子 */
            pointer-events: none;
            animation: particle-animation 1s ease-out forwards;
        }

        @keyframes particle-animation {
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

    // 定義擬真的火花配色
    const colors = [
        '#FFFFFF', '#FFFFE0', '#FFD700', // 高亮區域 (白、淡黃、亮黃)
        '#FFA500', '#FF4500',            // 橙色過渡
        '#8B0000', '#2E2E2E',            // 暗紅與灰色邊緣
        '#ADD8E6', '#EE82EE'             // 冷色亮點 (藍、紫)
    ];

    document.addEventListener("mousemove", (e) => {
        const particleCount = Math.random() * 6 + 4; // 每次生成 4~10 個粒子
        for (let i = 0; i < particleCount; i++) {
            createParticle(e.pageX, e.pageY);
        }
    });

    function createParticle(x, y) {
        const particle = document.createElement("div");
        particle.className = "particle";

        // 設定隨機顏色
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];

        // 隨機大小（模擬不同粒子尺寸）
        const size = Math.random() * 4 + 2; // 2px ~ 6px
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;

        // 隨機方向漂移
        const dx = (Math.random() - 0.5) * 120; // X 軸偏移 -60px ~ 60px
        const dy = Math.random() * 120 - 30; // Y 軸偏移 -30px ~ 90px
        particle.style.setProperty('--dx', `${dx}px`);
        particle.style.setProperty('--dy', `${dy}px`);

        // 粒子起始位置
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;

        // 添加到頁面並自動移除
        document.body.appendChild(particle);
        particle.addEventListener("animationend", () => particle.remove());
    }
});
