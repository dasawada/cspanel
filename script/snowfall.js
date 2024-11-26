(function createSnowfallBackground() {
  const snowflakeConfig = {
    backgroundColor: '#b1575780', // 背景色
    snowflakeCount: 50, // 最大雪花數量
    snowflakeShapes: ['❄', '❅', '❆', '✻', '✼', '❉', '❊', '✴', '⛄', '☃'], // 雪花形狀
    snowflakeSizeRange: [10, 30], // 雪花大小範圍
    fallSpeedRange: [2, 5], // 雪花下落速度範圍
    rotationSpeedRange: [1, 3], // 雪花旋轉速度範圍
  };

  document.body.style.backgroundColor = snowflakeConfig.backgroundColor;
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.height = '100vh';

  const snowContainer = document.createElement('div');
  snowContainer.style.position = 'fixed';
  snowContainer.style.top = '0';
  snowContainer.style.left = '0';
  snowContainer.style.width = '100%';
  snowContainer.style.height = '100%';
  snowContainer.style.pointerEvents = 'none';
  snowContainer.style.zIndex = '9999';
  document.body.appendChild(snowContainer);

  const snowflakes = [];

  function createSnowflake() {
    const snowflake = document.createElement('div');
    const size =
      Math.random() * (snowflakeConfig.snowflakeSizeRange[1] - snowflakeConfig.snowflakeSizeRange[0]) +
      snowflakeConfig.snowflakeSizeRange[0];
    const layer = Math.floor(Math.random() * 10) + 1;
    const rotationSpeed =
      Math.random() * (snowflakeConfig.rotationSpeedRange[1] - snowflakeConfig.rotationSpeedRange[0]) +
      snowflakeConfig.rotationSpeedRange[0];
    const fallSpeed =
      Math.random() * (snowflakeConfig.fallSpeedRange[1] - snowflakeConfig.fallSpeedRange[0]) +
      snowflakeConfig.fallSpeedRange[0];
    const snowflakeShape =
      snowflakeConfig.snowflakeShapes[Math.floor(Math.random() * snowflakeConfig.snowflakeShapes.length)];

    snowflake.style.fontSize = `${size}px`;
    snowflake.style.position = 'absolute';
    snowflake.style.color = `rgba(255, 255, 255, ${Math.random() * 0.8 + 0.2})`;
    snowflake.style.left = `${Math.random() * 100}%`;
    snowflake.style.top = `-${size}px`;
    snowflake.style.zIndex = layer;
    snowflake.style.transform = `rotate(${Math.random() * 360}deg)`;
    snowflake.style.transition = 'opacity 2s ease-out';
    snowflake.innerHTML = snowflakeShape;

    snowContainer.appendChild(snowflake);

    const startTime = Date.now();
    snowflakes.push({
      element: snowflake,
      size,
      rotationSpeed,
      fallSpeed,
      startTime,
      melted: false,
    });
  }

  function updateSnowflakes() {
    const currentTime = Date.now();

    snowflakes.forEach((flake, index) => {
      if (flake.melted) return;

      const elapsed = (currentTime - flake.startTime) / 1000;
      const newY = flake.fallSpeed * elapsed * 50;
      const rotation = elapsed * flake.rotationSpeed * 100;

      flake.element.style.transform = `translateY(${newY}px) rotate(${rotation}deg)`;

      const rect = flake.element.getBoundingClientRect();
      if (rect.top >= window.innerHeight - flake.size) {
        flake.melted = true;
        flake.element.style.transition = 'opacity 2s ease-out';
        flake.element.style.opacity = '0';
        setTimeout(() => snowContainer.removeChild(flake.element), 2000);
        snowflakes.splice(index, 1);
      }
    });

    requestAnimationFrame(updateSnowflakes);
  }

  function startSnowfall() {
    setInterval(() => {
      if (snowflakes.length < snowflakeConfig.snowflakeCount) createSnowflake();
    }, 300);
    updateSnowflakes();
  }

  startSnowfall();
})();
