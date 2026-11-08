'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const startButton = document.getElementById('start');
const healthText = document.getElementById('health');
const healthFill = document.getElementById('health-fill');
const waveText = document.getElementById('wave');
const scoreText = document.getElementById('score');
const W = canvas.width;
const H = canvas.height;
const keys = new Set();
const touchMoves = new Set();
const pointer = { x: W / 2, y: H / 2 - 100, down: false, touch: false };
let state = 'ready';
let player, enemies, bullets, particles, pickups, wave, score, spawnRemaining, spawnTimer, waveTimer, lastTime;

const terrain = Array.from({ length: 95 }, (_, i) => {
  const seed = n => (Math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1;
  return { x: Math.abs(seed(1)) * W, y: Math.abs(seed(2)) * H, size: 5 + Math.abs(seed(3)) * 14, kind: i % 4 };
});

function reset() {
  player = { x: W / 2, y: H / 2, angle: -Math.PI / 2, health: 100, cooldown: 0, invulnerable: 0 };
  enemies = [];
  bullets = [];
  particles = [];
  pickups = [];
  wave = 0;
  score = 0;
  waveTimer = 1;
  spawnRemaining = 0;
  spawnTimer = 0;
  pointer.down = false;
  touchMoves.clear();
  keys.clear();
  nextWave();
  updateHud();
}

function nextWave() {
  wave++;
  spawnRemaining = 4 + wave * 2;
  spawnTimer = 0.8;
  waveTimer = 2;
  updateHud();
}

function updateHud() {
  healthText.innerHTML = `${Math.max(0, Math.ceil(player.health))}<span>%</span>`;
  healthFill.style.width = `${Math.max(0, player.health)}%`;
  waveText.textContent = `WAVE ${String(wave).padStart(2, '0')}`;
  scoreText.textContent = String(score).padStart(3, '0');
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  const x = side === 0 ? -25 : side === 1 ? W + 25 : Math.random() * W;
  const y = side === 2 ? -25 : side === 3 ? H + 25 : Math.random() * H;
  enemies.push({ x, y, angle: 0, health: 3 + Math.floor((wave - 1) / 4), cooldown: 1 + Math.random() * 2, speed: 35 + Math.min(wave * 3, 35) });
}

function burst(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 140;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.3 + Math.random() * 0.5, color });
  }
}

function shoot(x, y, angle, friendly) {
  const speed = friendly ? 700 : 230;
  bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, friendly, life: 2 });
}

function update(dt) {
  player.cooldown -= dt;
  player.invulnerable -= dt;
  waveTimer -= dt;
  let dx = Number(keys.has('d') || keys.has('arrowright') || touchMoves.has('right')) - Number(keys.has('a') || keys.has('arrowleft') || touchMoves.has('left'));
  let dy = Number(keys.has('s') || keys.has('arrowdown') || touchMoves.has('down')) - Number(keys.has('w') || keys.has('arrowup') || touchMoves.has('up'));
  const length = Math.hypot(dx, dy) || 1;
  player.x = Math.max(25, Math.min(W - 25, player.x + dx / length * 230 * dt));
  player.y = Math.max(25, Math.min(H - 25, player.y + dy / length * 230 * dt));

  if (pointer.touch && enemies.length) {
    const target = enemies.reduce((nearest, enemy) => Math.hypot(enemy.x - player.x, enemy.y - player.y) < Math.hypot(nearest.x - player.x, nearest.y - player.y) ? enemy : nearest);
    player.angle = Math.atan2(target.y - player.y, target.x - player.x);
  } else if (!pointer.touch) {
    player.angle = Math.atan2(pointer.y - player.y, pointer.x - player.x);
  }
  if ((pointer.down || keys.has(' ')) && player.cooldown <= 0) {
    shoot(player.x + Math.cos(player.angle) * 28, player.y + Math.sin(player.angle) * 28, player.angle, true);
    player.cooldown = 0.12;
  }

  if (spawnRemaining > 0) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnEnemy();
      spawnRemaining--;
      spawnTimer = Math.max(0.35, 1.1 - wave * 0.04);
    }
  } else if (!enemies.length && waveTimer <= 0) {
    nextWave();
  }

  for (const enemy of enemies) {
    enemy.angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (distance > 180) {
      enemy.x += Math.cos(enemy.angle) * enemy.speed * dt;
      enemy.y += Math.sin(enemy.angle) * enemy.speed * dt;
    }
    enemy.cooldown -= dt;
    if (enemy.cooldown <= 0) {
      shoot(enemy.x + Math.cos(enemy.angle) * 22, enemy.y + Math.sin(enemy.angle) * 22, enemy.angle, false);
      enemy.cooldown = Math.max(0.8, 2.5 - wave * 0.08) + Math.random();
    }
  }

  for (const bullet of bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.friendly) {
      for (const enemy of enemies) {
        if (enemy.health > 0 && Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < 22) {
          bullet.life = 0;
          enemy.health--;
          burst(bullet.x, bullet.y, '#e8d993', 4);
          if (enemy.health <= 0) {
            score++;
            burst(enemy.x, enemy.y, '#f2a55c', 18);
            if (score % 5 === 0) pickups.push({ x: enemy.x, y: enemy.y });
            updateHud();
          }
          break;
        }
      }
    } else if (player.invulnerable <= 0 && Math.hypot(bullet.x - player.x, bullet.y - player.y) < 18) {
      bullet.life = 0;
      player.health = Math.max(0, player.health - 10);
      player.invulnerable = 0.25;
      burst(player.x, player.y, '#f3a76a', 8);
      updateHud();
      if (player.health <= 0) endGame();
    }
  }
  enemies = enemies.filter(enemy => enemy.health > 0);
  bullets = bullets.filter(bullet => bullet.life > 0 && bullet.x > -30 && bullet.x < W + 30 && bullet.y > -30 && bullet.y < H + 30);
  pickups = pickups.filter(pickup => {
    if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < 27 && player.health < 100) {
      player.health = Math.min(100, player.health + 25);
      burst(pickup.x, pickup.y, '#d8ed75');
      updateHud();
      return false;
    }
    return true;
  });
  for (const particle of particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  }
  particles = particles.filter(particle => particle.life > 0);
}

function endGame() {
  state = 'over';
  pointer.down = false;
  document.getElementById('overlay-kicker').textContent = 'MISSION DEBRIEF';
  document.getElementById('overlay-title').innerHTML = 'MISSION <em>FAILED</em>';
  document.getElementById('overlay-description').textContent = `You reached wave ${wave} and eliminated ${score} enemies. Ready to fly again?`;
  startButton.innerHTML = 'REDEPLOY <span>→</span>';
  overlay.hidden = false;
}

function drawTerrain() {
  ctx.fillStyle = '#40513b';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#71806418';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = '#a4a17a25';
  ctx.lineWidth = 90;
  ctx.beginPath(); ctx.moveTo(-60, 570); ctx.bezierCurveTo(250, 480, 480, 690, 760, 550); ctx.bezierCurveTo(990, 435, 1100, 500, 1350, 370); ctx.stroke();
  ctx.strokeStyle = '#c9c3991c'; ctx.lineWidth = 2; ctx.setLineDash([18, 18]); ctx.stroke(); ctx.setLineDash([]);
  for (const item of terrain) {
    ctx.fillStyle = item.kind === 0 ? '#334631' : item.kind === 1 ? '#526548' : '#354a35';
    ctx.beginPath(); ctx.arc(item.x, item.y, item.size, 0, Math.PI * 2); ctx.fill();
    if (item.kind === 0) { ctx.fillStyle = '#617253'; ctx.beginPath(); ctx.arc(item.x - 3, item.y - 4, item.size * .6, 0, Math.PI * 2); ctx.fill(); }
  }
}

function drawVehicle(x, y, angle, friendly) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#101b15aa';
  ctx.beginPath(); ctx.ellipse(4, 7, friendly ? 33 : 25, friendly ? 15 : 19, 0, 0, Math.PI * 2); ctx.fill();
  if (friendly) {
    ctx.fillStyle = '#a9bd83'; ctx.fillRect(-33, -4, 33, 8);
    ctx.fillStyle = '#718864'; ctx.fillRect(-36, -12, 8, 24);
    ctx.fillStyle = '#a8bb8d'; ctx.beginPath(); ctx.ellipse(0, 0, 23, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#243e35'; ctx.beginPath(); ctx.ellipse(12, 0, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d7e8b3'; ctx.fillRect(-2, -2, 4, 4);
    ctx.strokeStyle = '#d3dfbb99'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-27, -25); ctx.lineTo(27, 25); ctx.moveTo(-27, 25); ctx.lineTo(27, -25); ctx.stroke();
  } else {
    ctx.fillStyle = '#303d2d'; ctx.fillRect(-19, -20, 38, 9); ctx.fillRect(-19, 11, 38, 9);
    ctx.fillStyle = '#83916a'; ctx.fillRect(-20, -12, 40, 24);
    ctx.fillStyle = '#aab78a'; ctx.fillRect(-9, -9, 20, 18);
    ctx.fillStyle = '#b9c59a'; ctx.fillRect(4, -3, 25, 6);
  }
  ctx.restore();
}

function draw() {
  drawTerrain();
  for (const pickup of pickups) {
    ctx.fillStyle = '#d8ed75'; ctx.fillRect(pickup.x - 11, pickup.y - 11, 22, 22);
    ctx.fillStyle = '#344b34'; ctx.fillRect(pickup.x - 3, pickup.y - 8, 6, 16); ctx.fillRect(pickup.x - 8, pickup.y - 3, 16, 6);
  }
  for (const enemy of enemies) drawVehicle(enemy.x, enemy.y, enemy.angle, false);
  for (const bullet of bullets) {
    ctx.fillStyle = bullet.friendly ? '#ecf8a6' : '#ffae75';
    ctx.beginPath(); ctx.arc(bullet.x, bullet.y, bullet.friendly ? 3 : 4, 0, Math.PI * 2); ctx.fill();
  }
  if (player.invulnerable <= 0 || Math.floor(player.invulnerable * 20) % 2 === 0) drawVehicle(player.x, player.y, player.angle, true);
  for (const particle of particles) { ctx.globalAlpha = Math.min(1, particle.life * 2); ctx.fillStyle = particle.color; ctx.fillRect(particle.x, particle.y, 3, 3); }
  ctx.globalAlpha = 1;
  if (state === 'playing' && waveTimer > 0) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#e2edae'; ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`WAVE ${String(wave).padStart(2, '0')}`, W / 2, H / 2 - 90);
    ctx.font = '12px monospace'; ctx.fillText('HOSTILES INBOUND', W / 2, H / 2 - 70);
  }
}

function frame(time) {
  const dt = Math.min((time - (lastTime || time)) / 1000, 0.05);
  lastTime = time;
  if (state === 'playing') update(dt);
  draw();
  requestAnimationFrame(frame);
}

startButton.addEventListener('click', () => {
  reset();
  state = 'playing';
  overlay.hidden = true;
});
window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
  keys.add(key);
});
window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); touchMoves.clear(); pointer.down = false; });
canvas.addEventListener('pointermove', event => {
  if (event.pointerType === 'touch') return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = (event.clientX - rect.left) * W / rect.width;
  pointer.y = (event.clientY - rect.top) * H / rect.height;
  pointer.touch = false;
});
canvas.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'touch' && event.button === 0 && state === 'playing') { pointer.down = true; canvas.setPointerCapture(event.pointerId); }
});
canvas.addEventListener('pointerup', () => { pointer.down = false; });
canvas.addEventListener('pointercancel', () => { pointer.down = false; });
document.querySelectorAll('[data-move]').forEach(button => {
  button.addEventListener('pointerdown', event => { event.preventDefault(); pointer.touch = true; touchMoves.add(button.dataset.move); button.setPointerCapture(event.pointerId); });
  const release = () => touchMoves.delete(button.dataset.move);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
});
const touchFire = document.getElementById('touch-fire');
touchFire.addEventListener('pointerdown', event => { event.preventDefault(); pointer.touch = true; pointer.down = true; touchFire.setPointerCapture(event.pointerId); });
touchFire.addEventListener('pointerup', () => { pointer.down = false; });
touchFire.addEventListener('pointercancel', () => { pointer.down = false; });
reset();
requestAnimationFrame(frame);
