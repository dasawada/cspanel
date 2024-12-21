document.addEventListener("DOMContentLoaded", function () {
    const style = document.createElement("style");
    style.textContent = `
        html, body {
            margin: 0;
            padding: 0;
            width: 100vw;
            height: 100vh;
            overflow-y: hidden;
        }
        body {
            background: url('img/截圖 2024-12-21 02.08.01.png') no-repeat center center fixed;
            background-size: cover;
        }
    `;
    document.head.appendChild(style);
});
