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
        }

        .golden-particle {
            position: fixed;
            width: 2px; /* 粒子大小 */
            height: 2px; /* 粒子大小 */
            background: radial-gradient(circle, rgba(255,223,0,0.8) 0%, rgba(255,215,0,0.5) 50%, rgba(255,215,0,0) 100%);
            border-radius: 50%;
            pointer-events: none;
            animation: fade-out 1.5s ease-out forwards, drift 1.5s ease-out;
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

    // 設置金色的粒子顏色漸變
    const colors = [
        'rgba(255,223,0,0.8)', // 金黃色
        'rgba(255,215,0,0.6)', // 柔和金色
        'rgba(255,248,220,0.8)', // 金白色
    ];

    // 監聽鼠標移動事件
    document.addEventListener("mousemove", (e) => {
        const particleCount = Math.random() * 4 + 2; // 每次生成 2-6 個粒子
        for (let i = 0; i < particleCount; i++) {
            createGoldenParticle(e.pageX, e.pageY);
        }
    });

    function createGoldenParticle(x, y) {
        const particle = document.createElement("div");
        particle.className = "golden-particle";

        // 隨機顏色
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];

        // 隨機方向漂移
        const dx = (Math.random() - 0.5) * 40; // X 軸偏移 -20px ~ 20px
        const dy = (Math.random() - 0.5) * 40; // Y 軸偏移 -20px ~ 20px
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
