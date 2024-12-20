document.addEventListener("DOMContentLoaded", function () {
    const style = document.createElement("style");
    style.textContent = `
        html, body {
            margin: 0;
            padding: 0;
            background-color: #1e3d59;
            overflow: hidden;
            width: 100vw;
            height: 100vh;
        }
        .snow-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 99999;
        }
        .snowflake {
            position: absolute;
            background-color: white;
            border-radius: 50%;
            opacity: 0.8;
            pointer-events: none;
            transform: translate(0, 0);
        }
    `;
    document.head.appendChild(style);

    const snowContainer = document.createElement("div");
    snowContainer.className = "snow-container";
    document.body.appendChild(snowContainer);

    const snowflakes = [];
    const maxSnowflakes = 50;
    const duration = 30 * 1000; // 30秒
    const frameRate = 60; // 每秒60幀
    const totalFrames = (duration / 1000) * frameRate;

    // 預計算雪花路徑
    function generateSnowflakePaths() {
        for (let i = 0; i < maxSnowflakes; i++) {
            const path = [];
            const size = Math.random() * 5 + 1; // 雪花大小
            const startX = Math.random() * window.innerWidth;
            const endX = startX + (Math.random() < 0.5 ? -50 : 50); // 隨機水平偏移
            const startY = -size;
            const endY = window.innerHeight + size;

            for (let frame = 0; frame < totalFrames; frame++) {
                const progress = frame / totalFrames;
                const x = startX + progress * (endX - startX);
                const y = startY + progress * (endY - startY);
                path.push({ x, y });
            }

            snowflakes.push({ size, path, currentFrame: 0 });
        }
    }

    // 渲染雪花元素
    function renderSnowflakes() {
        snowflakes.forEach((flake) => {
            const snowflake = document.createElement("div");
            snowflake.className = "snowflake";
            snowflake.style.width = `${flake.size}px`;
            snowflake.style.height = `${flake.size}px`;
            snowContainer.appendChild(snowflake);
            flake.element = snowflake;
        });
    }

    // 更新雪花位置
    function updateSnowflakes() {
        snowflakes.forEach((flake) => {
            const frame = flake.path[flake.currentFrame];
            flake.element.style.transform = `translate(${frame.x}px, ${frame.y}px)`;
            flake.currentFrame = (flake.currentFrame + 1) % totalFrames; // 循環播放
        });
        requestAnimationFrame(updateSnowflakes);
    }

    // 初始化並啟動動畫
    generateSnowflakePaths();
    renderSnowflakes();
    updateSnowflakes();
});
