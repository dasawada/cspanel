document.addEventListener("DOMContentLoaded", function () {
    const style = document.createElement("style");
    style.textContent = `
        html, body {
            margin: 0;
            padding: 0;
            width: 100vw;
            height: 100vh;
            overflow: hidden;
        }
        body {
            background: url('img/截圖 2024-12-21 02.08.01.png') no-repeat center center fixed;
            background-size: cover;
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
        }
        @keyframes fall {
            0% {
                opacity: 0;
                transform: translateY(0);
            }
            10% {
                opacity: 1;
            }
            100% {
                opacity: 0.5;
                transform: translateY(100vh);
            }
        }
        @keyframes diagonal-fall {
            0% {
                opacity: 0;
                transform: translate(0, 0);
            }
            10% {
                opacity: 1;
            }
            100% {
                opacity: 0.25;
                transform: translate(10vw, 100vh);
            }
        }
    `;
    document.head.appendChild(style);

    const snowContainer = document.createElement("div");
    snowContainer.className = "snow-container";
    document.body.appendChild(snowContainer);

    const maxSnowflakes = 30; // 限制雪花數量為 30
    const snowflakes = [];

    function resetSnowflake(snowflake) {
        const size = Math.random() * 5 + 1; // 隨機雪花大小
        snowflake.style.width = `${size}px`;
        snowflake.style.height = `${size}px`;
        snowflake.style.left = `${Math.random() * window.innerWidth}px`;
        snowflake.style.top = `-${size}px`;
        snowflake.style.animationDuration = `${Math.random() * 5 + 2}s`;
        snowflake.style.animationName = Math.random() < 0.5 ? "fall" : "diagonal-fall";
        snowflake.style.animationTimingFunction = "linear";
    }

    function createSnowflake() {
        if (snowflakes.length < maxSnowflakes) {
            const snowflake = document.createElement("div");
            snowflake.className = "snowflake";
            resetSnowflake(snowflake);
            snowflakes.push(snowflake);
            snowContainer.appendChild(snowflake);

            snowflake.addEventListener("animationend", () => {
                snowflake.remove();
                const index = snowflakes.indexOf(snowflake);
                if (index > -1) snowflakes.splice(index, 1);
            });
        }
    }

    function generateSnowflakes() {
        setInterval(() => {
            if (snowflakes.length < maxSnowflakes) createSnowflake();
        }, 200); // 控制生成速度
    }

    generateSnowflakes();
});
