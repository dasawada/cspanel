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
    const maxSnowflakes = 80; // 減少雪花數量，遠近景分層
    const layers = 3; // 增加遠近層級
    const fallSpeeds = [2, 4, 6]; // 加速不同層的雪花
    const blurLevels = [5, 10, 20]; // 遠近景模糊效果

    function createSnowflake(layer) {
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 3 + layer + 1, // 層級影響大小
            speed: fallSpeeds[layer] + Math.random(), // 層級影響速度
            blur: blurLevels[layer], // 模糊程度
            opacity: Math.random() * 0.5 + 0.2,
        };
    }

    function generateSnowflakes() {
        for (let layer = 0; layer < layers; layer++) {
            while (snowflakes.filter(s => s.blur === blurLevels[layer]).length < maxSnowflakes / layers) {
                snowflakes.push(createSnowflake(layer));
            }
        }
    }

    function updateSnowflakes() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        snowflakes.forEach(flake => {
            flake.y += flake.speed;
            if (flake.y > canvas.height) {
                flake.y = -flake.size;
                flake.x = Math.random() * canvas.width;
            }

            ctx.beginPath();
            ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity})`;
            ctx.shadowBlur = flake.blur; // 柔焦效果
            ctx.shadowColor = `rgba(255, 255, 255, ${flake.opacity})`;
            ctx.fill();
        });
    }

    function animate() {
        setTimeout(() => {
            requestAnimationFrame(animate);
            updateSnowflakes();
        }, 1000 / 8); // 限制到每秒 8 幀
    }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        snowflakes.length = 0; // 清空舊的雪花
        generateSnowflakes();
    }

    window.addEventListener("resize", resizeCanvas);

    generateSnowflakes();
    animate();
});
