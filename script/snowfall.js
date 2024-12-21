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
    const maxSnowflakes = 50; // 降低雪花數量
    const fallSpeed = 1; // 調整速度

    function createSnowflake() {
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 3 + 2, // 減小雪花大小
            speed: Math.random() * fallSpeed + 0.5,
            opacity: Math.random() * 0.5 + 0.5,
        };
    }

    function updateSnowflakes() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        snowflakes.forEach((flake) => {
            flake.y += flake.speed;
            if (flake.y > canvas.height) flake.y = -flake.size; // 循環雪花
            ctx.beginPath();
            ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity})`;
            ctx.fill();
        });

        requestAnimationFrame(updateSnowflakes);
    }

    function generateSnowflakes() {
        while (snowflakes.length < maxSnowflakes) {
            snowflakes.push(createSnowflake());
        }
    }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        snowflakes.length = 0; // 清空舊的雪花
        generateSnowflakes();
    }

    window.addEventListener("resize", resizeCanvas);

    generateSnowflakes();
    updateSnowflakes();
});
