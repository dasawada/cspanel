document.addEventListener('DOMContentLoaded', () => {
  const rippleSettings = {
    maxSize: 300,
    animationSpeed: 1,
    strokeColor: [255, 255, 255],
  };

  const canvasSettings = {
    blur: 20,
    ratio: 0.1,
  };

  function Coords(x, y) {
    this.x = x || null;
    this.y = y || null;
  }

  const Ripple = function Ripple(x, y, circleSize, ctx) {
    this.position = new Coords(x, y);
    this.circleSize = circleSize;
    this.maxSize = rippleSettings.maxSize;
    this.opacity = 1;
    this.ctx = ctx;
    this.strokeColor = `rgba(${Math.floor(rippleSettings.strokeColor[0])},
      ${Math.floor(rippleSettings.strokeColor[1])},
      ${Math.floor(rippleSettings.strokeColor[2])},
      ${this.opacity})`;

    this.animationSpeed = rippleSettings.animationSpeed;
    this.opacityStep = (this.animationSpeed / (this.maxSize - circleSize)) / 2;
  };

  Ripple.prototype = {
    update: function update() {
      this.circleSize += this.animationSpeed;
      this.opacity -= this.opacityStep;
      this.strokeColor = `rgba(${Math.floor(rippleSettings.strokeColor[0])},
        ${Math.floor(rippleSettings.strokeColor[1])},
        ${Math.floor(rippleSettings.strokeColor[2])},
        ${this.opacity})`;
    },
    draw: function draw() {
      this.ctx.beginPath();
      this.ctx.strokeStyle = this.strokeColor;
      this.ctx.arc(this.position.x, this.position.y, this.circleSize, 0,
        2 * Math.PI);
      this.ctx.stroke();
    },
  };

  // Dynamically create and insert canvas into the DOM
  const canvas = document.createElement('canvas');
  canvas.id = 'canvas';
  canvas.style.position = 'fixed';
  canvas.style.bottom = '0';
  canvas.style.left = '0';
  canvas.style.zIndex = '-1'; // Ensure it stays in the background
  canvas.style.pointerEvents = 'none'; // Prevent interaction blocking
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const ripples = [];

  const height = window.innerHeight;
  const width = window.innerWidth;

  canvas.style.filter = `blur(${canvasSettings.blur}px)`;

  canvas.width = width * canvasSettings.ratio;
  canvas.height = height * canvasSettings.ratio;

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

// Function executed on mouse click over the canvas
const canvasClick = (e) => {
  const x = e.clientX * canvasSettings.ratio;
  const y = e.clientY * canvasSettings.ratio;

  // Generate multiple ripples with increasing distance
  const circleCount = 1; // Number of circles to create
  for (let i = 0; i < circleCount; i++) {
    const distanceMultiplier = i * 10; // Gradually increase the distance
    const randomAngle = Math.random() * Math.PI * 1; // Randomize the direction

    // Calculate new ripple position based on angle and distance
    const rippleX = x + Math.cos(randomAngle) * distanceMultiplier;
    const rippleY = y + Math.sin(randomAngle) * distanceMultiplier;

    const randomDelay = i * 50; // Add a slight delay between each ripple
    setTimeout(() => {
      ripples.unshift(new Ripple(rippleX, rippleY, 2, ctx));
    }, randomDelay);
  }
};

  const animation = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.update();
      r.draw();

      if (r.opacity <= 0) {
        ripples.splice(i, 1);
      }
    }
    window.requestAnimationFrame(animation);
  };

  animation();
  document.body.addEventListener('click', canvasClick);
});
