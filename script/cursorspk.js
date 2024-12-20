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
            cursor: default;
        }

        .particle {
            position: fixed;
            width: 1px;
            height: 1px;
            background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 100%);
            border-radius: 50%;
            pointer-events: none;
            animation: particle-animation 2s ease-out forwards;
        }

        @keyframes particle-animation {
            0% {
                opacity: 0.6;
                transform: translate(0, 0) scale(1);
            }
            100% {
                opacity: 0;
                transform: translate(var(--dx, 0), var(--dy, 0)) scale(0.5);
            }
        }
    `;
    document.head.appendChild(style);

    // 柔和的光斑顏色
    const colors = [
        'rgba(255,255,255,0.8)', // 柔白
        'rgba(255,255,224,0.8)', // 淡黃
        'rgba(240,248,255,0.8)'  // 淡藍
    ];

    document.addEventListener("mousemove", (e) => {
        const particleCount = Math.random() * 2 + 1; // 每次滑鼠移動生成 1~3 個粒子
        for (let i = 0; i < particleCount; i++) {
            createParticle(e.pageX, e.pageY);
        }
    });

    function createParticle(x, y) {
        const particle = document.createElement("div");
        particle.className = "particle";

        // 隨機選擇柔和顏色
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];

        // 粒子大小（較小且均一）
        const size = Math.random() * 2 + 1; // 1px ~ 3px
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;

        // 隨機方向漂移（柔和範圍）
        const dx = (Math.random() - 0.5) * 40; // X 軸偏移 -20px ~ 20px
        const dy = (Math.random() - 0.5) * 40; // Y 軸偏移 -20px ~ 20px
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
