document.addEventListener("DOMContentLoaded", function () {
    const style = document.createElement("style");
    style.textContent = `
        html {
            margin: 0;
            padding: 0;
            background-color: #1e3d59;
        }
        body, html {
            width: 100vw;
            height: auto;
        }
        .snow-container {
            position: fixed;
            top: 0;
            left: 0;
            overflow: hidden;
            width: 100vw;
            height: 100vh;
            z-index: 99999;
            pointer-events: none;
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

    const particlesPerThousandPixels = 0.1;
    const fallSpeed = 1.25;
    const maxSnowflakes = 50;
    const snowflakes = [];

    function resetSnowflake(snowflake) {
        const size = Math.random() * 5 + 1;
        snowflake.style.width = `${size}px`;
        snowflake.style.height = `${size}px`;
        snowflake.style.left = `${Math.random() * window.innerWidth}px`;
        snowflake.style.top = `-${size}px`;
        snowflake.style.animationDuration = `${(Math.random() * 3 + 2) / fallSpeed}s`;
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
        const numberOfParticles = Math.ceil((window.innerWidth * window.innerHeight) / 1000) * particlesPerThousandPixels;
        setInterval(() => {
            if (snowflakes.length < maxSnowflakes) createSnowflake();
        }, 1000 / numberOfParticles);
    }

    generateSnowflakes();
});
