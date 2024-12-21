document.addEventListener("DOMContentLoaded", function () {
    const style = document.createElement("style");
    style.textContent = `
        html, body {
            margin: 0;
            padding: 0;
            background-color: #1e3d59;
            overflow-y: hidden;
            width: 100vw;
            height: 100vh;
        }
    `;
    document.head.appendChild(style);

    const canvas = document.createElement("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "9999";
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    const snowflakes = [];
    const maxSnowflakes = 100; // 雪花翻倍，但層級分組降低單次繪圖負擔
    const layers = 2; // 模擬近景與遠景層
    const fallSpeeds = [0.5, 1.5]; // 層級不同的下落速度
    const horizontalDrift = 0.5; // 增加水平漂移
    const fps = 10; // 動畫幀數限制

    function createSnowflake(layer) {
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 3 + (layer + 1), // 層級決定雪花大小
            speed: fallSpeeds[layer] + Math.random() * 0.5, // 下落速度
            opacity: Math.random() * 0.5 + 0.3,
            drift: (Math.random() - 0.5) * horizontalDrift, // 水平漂移
            layer,
        };
    }

    function generateSnowflakes() {
        for (let layer = 0; layer < layers; layer++) {
            while (snowflakes.filter(s => s.layer === layer).length < maxSnowflakes / layers) {
                snowflakes.push(createSnowflake(layer));
            }
        }
    }

    function updateSnowflakes() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        snowflakes.forEach(flake => {
            flake.y += flake.speed;
            flake.x += flake.drift;

            if (flake.y > canvas.height) {
                flake.y = -flake.size;
                flake.x = Math.random() * canvas.width;
            }

            ctx.beginPath();
            ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity})`;
            ctx.fill();
        });
    }

    function animate() {
        setTimeout(() => {
            requestAnimationFrame(animate);
            updateSnowflakes();
        }, 1000 / fps);
    }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        snowflakes.length = 0; // 清空並重新生成雪花
        generateSnowflakes();
    }

    window.addEventListener("resize", resizeCanvas);

    generateSnowflakes();
    animate();
});
