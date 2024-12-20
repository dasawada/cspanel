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

        .mouse-glow {
            position: fixed;
            width: 30px;
            height: 30px;
            background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.1) 70%, rgba(255,255,255,0) 100%);
            border-radius: 50%;
            pointer-events: none;
            transform: translate(-50%, -50%);
            transition: transform 0.1s ease-out;
        }
    `;
    document.head.appendChild(style);

    const glow = document.createElement("div");
    glow.className = "mouse-glow";
    document.body.appendChild(glow);

    document.addEventListener("mousemove", (e) => {
        glow.style.left = `${e.pageX}px`;
        glow.style.top = `${e.pageY}px`;
    });
});
