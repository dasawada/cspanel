document.addEventListener("DOMContentLoaded", function () {
    const style = document.createElement("style");
    style.textContent = `
        html, body {
            margin: 0;
            padding: 0;
            background-color: #c0cad3;
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
    const maxSnowflakes = 50; // 保持雪花數量較低
    const fallSpeeds = [1, 2, 3]; // 三種速度
    const layers = 3; // 遠近層數

    function createSnowflake(layer) {
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 3 + layer + 1, // 基於層級控制大小
            speed: fallSpeeds[layer] + Math.random(), // 每層速度稍有隨機性
            opacity: Math.random() * 0.5 + 0.3,
        };
    }

    function generateSnowflakes() {
        for (let layer = 0; layer < layers; layer++) {
            while (snowflakes.filter(s => s.size > layer).length < maxSnowflakes / layers) {
                snowflakes.push(createSnowflake(layer));
            }
        }
    }

    function updateSnowflakes() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        snowflakes.forEach(flake => {
            flake.y += flake.speed;
            if (flake.y > canvas.height) {
                flake.y = -flake.size; // 循環使用
                flake.x = Math.random() * canvas.width;
            }

            ctx.beginPath();
            ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity})`;
            ctx.fill();
        });
    }

    function animate() {
        requestAnimationFrame(animate);
        updateSnowflakes();
    }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        snowflakes.length = 0; // 清空雪花數據
        generateSnowflakes();
    }

    window.addEventListener("resize", resizeCanvas);

    generateSnowflakes();
    animate();
});