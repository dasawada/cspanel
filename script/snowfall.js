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
    const maxSnowflakes = 5; // 增加雪花數量
    const fallSpeeds = [1, 2, 3]; // 三種速度
    const layers = 3; // 遠近層數

    function createSnowflake(layer) {
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 4 + layer + 1, // 增加層級大小差異
            speed: fallSpeeds[layer] + Math.random(),
            opacity: Math.random() * 0.7 + 0.3,
            swing: Math.random() * 0.6 - 0.3, // 增加左右晃動幅度
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
            flake.x += flake.swing; // 左右晃動
            if (flake.y > canvas.height) {
                flake.y = -flake.size;
                flake.x = Math.random() * canvas.width;
            }

            ctx.beginPath();
            ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity})`;
            ctx.shadowBlur = flake.size * 1.5; // 模糊光暈
            ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
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
