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
            pointer-events: none;
            border-radius: 50%;
            animation: particle-fade-out 1.2s linear forwards;
        }

        @keyframes particle-fade-out {
            0% {
                opacity: 1;
            }
            100% {
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    const colors = ['#FFDD44', '#FFAA33', '#FF5522', '#FF2200', '#AA1100']; // 燃燒配色
    const gravity = 0.2; // 重力加速度模擬

    document.addEventListener("mousemove", (e) => {
        const particleCount = Math.floor(Math.random() * 6 + 4); // 每次生成 4~10 粒火花
        for (let i = 0; i < particleCount; i++) {
            createParticle(e.pageX, e.pageY);
        }
    });

    function createParticle(x, y) {
        const particle = document.createElement("div");
        particle.className = "particle";

        // 設定粒子尺寸（極小化）
        const size = Math.random() * 2 + 0.5; // 0.5px ~ 2.5px
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;

        // 設定粒子顏色
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];

        // 初始位置
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;

        // 初始速度與方向
        const angle = Math.random() * Math.PI * 2; // 隨機方向（0 ~ 360°）
        const speed = Math.random() * 3 + 1; // 初始速度（1 ~ 4）
        const vx = Math.cos(angle) * speed; // X 軸速度
        const vy = Math.sin(angle) * speed - 1; // Y 軸速度，模擬燃燒向上

        let lifetime = 1.2; // 粒子壽命（秒）

        // 更新粒子位置與大小
        const update = () => {
            lifetime -= 0.016; // 減少壽命（60FPS）
            if (lifetime <= 0) {
                particle.remove();
                return;
            }

            // 重力影響
            const dx = vx * lifetime * 15; // X 方向位移
            const dy = vy * lifetime * 15 + gravity * (1.2 - lifetime) * 15; // Y 方向位移 + 重力影響

            // 設定粒子位置與縮放
            particle.style.transform = `translate(${dx}px, ${dy}px) scale(${lifetime})`;

            requestAnimationFrame(update);
        };

        document.body.appendChild(particle);
        update(); // 啟動粒子動畫
    }
});
