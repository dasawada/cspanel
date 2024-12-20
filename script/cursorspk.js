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
        }

        .trail {
            position: fixed;
            width: 5px;
            height: 5px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 50%;
            pointer-events: none;
            animation: fade-out 1s forwards;
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
    `;
    document.head.appendChild(style);

    document.addEventListener("mousemove", (e) => {
        const trail = document.createElement("div");
        trail.className = "trail";
        trail.style.left = `${e.pageX}px`;
        trail.style.top = `${e.pageY}px`;

        document.body.appendChild(trail);
        trail.addEventListener("animationend", () => trail.remove());
    });
});
