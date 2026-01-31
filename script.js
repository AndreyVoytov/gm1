const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const waveEl = document.getElementById("wave");
const upgradeOverlay = document.getElementById("upgradeOverlay");
const upgradeOptions = document.getElementById("upgradeOptions");
const gameOverOverlay = document.getElementById("gameOver");
const finalScoreEl = document.getElementById("finalScore");
const restartButton = document.getElementById("restartButton");

const state = {
  width: canvas.width,
  height: canvas.height,
  balls: [],
  cubes: [],
  score: 0,
  level: 1,
  wave: 1,
  isPaused: false,
  isGameOver: false,
  ballDamage: 1,
  ballSpeed: 360,
  ballCount: 1,
  pierce: 0,
  burstCooldown: 0,
  burstInterval: 0.12,
  burstDuration: 1,
  burstTimer: 0,
  burstShotsRemaining: 0,
  spawnCooldown: 0,
  moveSpeed: 24,
};

const player = {
  x: state.width / 2,
  y: state.height - 64,
  radius: 16,
};

const upgrades = [
  {
    title: "Усиление урона",
    description: "+1 урон шарам",
    apply: () => {
      state.ballDamage += 1;
    },
  },
  {
    title: "Дополнительный шар",
    description: "+1 шар в очереди",
    apply: () => {
      state.ballCount += 1;
    },
  },
  {
    title: "Скорость выстрела",
    description: "+15% к скорости шаров",
    apply: () => {
      state.ballSpeed *= 1.15;
    },
  },
  {
    title: "Пробивание",
    description: "Шары пробивают на 1 куб больше",
    apply: () => {
      state.pierce += 1;
    },
  },
  {
    title: "Темп очереди",
    description: "Быстрее очередь (интервал -20%)",
    apply: () => {
      state.burstInterval = Math.max(0.05, state.burstInterval * 0.8);
    },
  },
  {
    title: "Движение кубов",
    description: "Замедлить напор (скорость -10%)",
    apply: () => {
      state.moveSpeed = Math.max(12, state.moveSpeed * 0.9);
    },
  },
];

function resizeCanvas() {
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.floor(width * devicePixelRatio);
  canvas.height = Math.floor(height * devicePixelRatio);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(devicePixelRatio, devicePixelRatio);
  state.width = width;
  state.height = height;
  player.x = width / 2;
  player.y = height - 64;
}

function resetGame() {
  state.balls = [];
  state.cubes = [];
  state.score = 0;
  state.level = 1;
  state.wave = 1;
  state.ballDamage = 1;
  state.ballSpeed = 360;
  state.ballCount = 1;
  state.pierce = 0;
  state.burstCooldown = 0;
  state.burstInterval = 0.12;
  state.burstTimer = 0;
  state.burstShotsRemaining = 0;
  state.spawnCooldown = 0.5;
  state.moveSpeed = 24;
  state.isPaused = false;
  state.isGameOver = false;
  hideOverlay(gameOverOverlay);
  spawnWave();
  updateHud();
}

function updateHud() {
  scoreEl.textContent = state.score.toString();
  levelEl.textContent = state.level.toString();
  waveEl.textContent = state.wave.toString();
}

function showOverlay(overlay) {
  overlay.classList.remove("hidden");
}

function hideOverlay(overlay) {
  overlay.classList.add("hidden");
}

function spawnWave() {
  const columns = 6;
  const padding = 8;
  const availableWidth = state.width - padding * 2;
  const cell = availableWidth / columns;
  const cubeSize = cell - 6;

  for (let col = 0; col < columns; col += 1) {
    if (Math.random() > 0.25) {
      const hp = Math.floor(state.level + Math.random() * state.level);
      state.cubes.push({
        x: padding + col * cell + 3,
        y: -cubeSize - 6,
        size: cubeSize,
        hp,
        maxHp: hp,
      });
    }
  }
  state.wave += 1;
  updateHud();
}

function findClosestCube() {
  let closest = null;
  let closestDist = Infinity;
  for (const cube of state.cubes) {
    const centerX = cube.x + cube.size / 2;
    const centerY = cube.y + cube.size / 2;
    const dx = centerX - player.x;
    const dy = centerY - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < closestDist) {
      closestDist = dist;
      closest = cube;
    }
  }
  return closest;
}

function fireBurst(delta) {
  if (state.burstCooldown > 0) {
    state.burstCooldown -= delta;
    return;
  }

  if (state.burstShotsRemaining <= 0) {
    state.burstShotsRemaining = Math.max(1, Math.floor(state.burstDuration / state.burstInterval));
    state.burstTimer = 0;
    state.burstCooldown = 1;
  }

  state.burstTimer -= delta;
  if (state.burstTimer <= 0 && state.burstShotsRemaining > 0) {
    state.burstTimer = state.burstInterval;
    state.burstShotsRemaining -= 1;
    for (let i = 0; i < state.ballCount; i += 1) {
      spawnBall();
    }
  }
}

function spawnBall() {
  const target = findClosestCube();
  const angle = target
    ? Math.atan2(target.y + target.size / 2 - player.y, target.x + target.size / 2 - player.x)
    : -Math.PI / 2;
  const spread = (Math.random() - 0.5) * 0.15;
  const finalAngle = angle + spread;
  state.balls.push({
    x: player.x,
    y: player.y,
    vx: Math.cos(finalAngle) * state.ballSpeed,
    vy: Math.sin(finalAngle) * state.ballSpeed,
    radius: 4,
    damage: state.ballDamage,
    pierce: state.pierce,
  });
}

function updateBalls(delta) {
  const alive = [];
  for (const ball of state.balls) {
    ball.x += ball.vx * delta;
    ball.y += ball.vy * delta;

    let hitCube = null;
    for (const cube of state.cubes) {
      if (
        ball.x + ball.radius > cube.x &&
        ball.x - ball.radius < cube.x + cube.size &&
        ball.y + ball.radius > cube.y &&
        ball.y - ball.radius < cube.y + cube.size
      ) {
        hitCube = cube;
        break;
      }
    }

    if (hitCube) {
      hitCube.hp -= ball.damage;
      if (hitCube.hp <= 0) {
        state.score += hitCube.maxHp * 5;
      } else {
        state.score += ball.damage;
      }
      updateHud();
      ball.pierce -= 1;
      if (hitCube.hp <= 0) {
        state.cubes = state.cubes.filter((cube) => cube !== hitCube);
      }
      if (ball.pierce < 0) {
        continue;
      }
    }

    if (ball.x < -20 || ball.x > state.width + 20 || ball.y < -40 || ball.y > state.height + 40) {
      continue;
    }

    alive.push(ball);
  }
  state.balls = alive;
}

function updateCubes(delta) {
  for (const cube of state.cubes) {
    cube.y += state.moveSpeed * delta;
  }

  const reachedBottom = state.cubes.some((cube) => cube.y + cube.size >= state.height - 30);
  if (reachedBottom) {
    endGame();
  }
}

function updateLevel() {
  const targetLevel = Math.floor(state.score / 400) + 1;
  if (targetLevel > state.level) {
    state.level = targetLevel;
    showUpgrade();
  }
}

function showUpgrade() {
  state.isPaused = true;
  upgradeOptions.innerHTML = "";
  const options = upgrades
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  options.forEach((upgrade) => {
    const button = document.createElement("button");
    button.innerHTML = `<strong>${upgrade.title}</strong><br /><span>${upgrade.description}</span>`;
    button.addEventListener("click", () => {
      upgrade.apply();
      hideOverlay(upgradeOverlay);
      state.isPaused = false;
      updateHud();
    });
    upgradeOptions.appendChild(button);
  });

  showOverlay(upgradeOverlay);
}

function endGame() {
  state.isGameOver = true;
  state.isPaused = true;
  finalScoreEl.textContent = `Итоговый счет: ${state.score}`;
  showOverlay(gameOverOverlay);
}

function update(delta) {
  if (state.isPaused || state.isGameOver) {
    return;
  }
  state.spawnCooldown -= delta;
  if (state.spawnCooldown <= 0) {
    spawnWave();
    state.spawnCooldown = Math.max(1.2, 3.2 - state.level * 0.1);
  }

  fireBurst(delta);
  updateBalls(delta);
  updateCubes(delta);
  updateLevel();
}

function drawPlayer() {
  ctx.fillStyle = "#ffcf70";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#27305b";
  ctx.beginPath();
  ctx.arc(player.x - 5, player.y - 4, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(player.x + 5, player.y - 4, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawBalls() {
  ctx.fillStyle = "#6cd6ff";
  for (const ball of state.balls) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCubes() {
  for (const cube of state.cubes) {
    const healthRatio = cube.hp / cube.maxHp;
    const hue = 10 + 100 * healthRatio;
    ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
    ctx.fillRect(cube.x, cube.y, cube.size, cube.size);

    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(cube.x, cube.y + cube.size - 12, cube.size, 12);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(cube.hp.toString(), cube.x + cube.size / 2, cube.y + cube.size - 6);
  }
}

function render() {
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.fillStyle = "rgba(16, 23, 48, 0.6)";
  ctx.fillRect(0, 0, state.width, state.height);
  drawCubes();
  drawBalls();
  drawPlayer();
}

let lastTime = 0;
function tick(timestamp) {
  const delta = Math.min(0.033, (timestamp - lastTime) / 1000 || 0);
  lastTime = timestamp;
  update(delta);
  render();
  requestAnimationFrame(tick);
}

window.addEventListener("resize", () => {
  resizeCanvas();
});

restartButton.addEventListener("click", () => {
  resetGame();
});

resizeCanvas();
resetGame();
requestAnimationFrame(tick);
