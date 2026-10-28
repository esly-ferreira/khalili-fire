const canvas = document.getElementById("game"),
  ctx = canvas.getContext("2d"),
  ifoodEl = document.getElementById("ifood"),
  menuEl = document.getElementById("menu"),
  startBtn = document.getElementById("start-btn");

const W = 1200,
  H = 700,
  MAX_LIVES = 3,
  IFOOD_INTERVAL_MS = 8000,
  CARLAO_TIME_SEC = 28,
  BOSS_INTERVAL_FRAMES = 11 * 60;

const keys = new Set();
let player,
  fires,
  particles = [],
  lives = MAX_LIVES,
  gameOver = false,
  hurtCooldown = 0,
  ifoodTimer = 0,
  ifoodHideTimer = 0,
  ifoodBusy = false,
  ifoodSeq = 0,
  screwdriver,
  hasScrewdriver = false,
  carlaoTimer = 0,
  deathReason = "",
  playing = false,
  carlaoShake = 0,
  bossTimer = 0;

const headImg = new Image();
headImg.src = "imagens/cabeça.png";
const carlaoImg = new Image();
carlaoImg.src = "imagens/carlao.png";

const tocTocSfx = new Audio("audios/toctoc.mp3");
const ifoodSfx = new Audio("audios/ifood.mp3");
const extinguishSfx = new Audio("audios/soundeffect.mp3");
const deathSfx = new Audio("audios/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.mp3");
const applauseSfx = new Audio("audios/aplausos-individuales.mp3");
const pickupSfx = new Audio("audios/gaster-vanish.mp3");
const bossSfx = new Audio("audios/fala-fiote.mp3");
const bgMusic = new Audio("audios/musica fundo.mp3");
tocTocSfx.preload = "auto";
ifoodSfx.preload = "auto";
extinguishSfx.preload = "auto";
deathSfx.preload = "auto";
applauseSfx.preload = "auto";
pickupSfx.preload = "auto";
bossSfx.preload = "auto";
bgMusic.preload = "auto";
bgMusic.loop = true;
bgMusic.volume = 0.45;

let applauseCtx = null;
let applauseReady = false;
function setupApplauseBoost() {
  if (applauseReady) return;
  applauseCtx = new (window.AudioContext || window.webkitAudioContext)();
  const src = applauseCtx.createMediaElementSource(applauseSfx);
  const gain = applauseCtx.createGain();
  gain.gain.value = 10.8;
  src.connect(gain);
  gain.connect(applauseCtx.destination);
  applauseReady = true;
}
function playApplause() {
  setupApplauseBoost();
  if (applauseCtx.state === "suspended") applauseCtx.resume();
  applauseSfx.currentTime = 0;
  applauseSfx.play().catch(() => {});
}

let musicStarted = false;
function startMusic() {
  if (musicStarted) return;
  musicStarted = true;
  bgMusic.play().catch(() => {
    musicStarted = false;
  });
}

function playBossLine() {
  if (!playing || gameOver) return;
  bossSfx.currentTime = 0;
  bossSfx.play().catch(() => {});
  carlaoShake = 100;
}

function startGame() {
  menuEl.classList.add("hidden");
  playing = true;
  startMusic();
  reset();
  bossTimer = BOSS_INTERVAL_FRAMES - 90; // fala do boss logo no começo
}

startBtn.addEventListener("click", startGame);

const platforms = [
  { x: 0, y: 660, w: 1200, h: 40 },
  { x: 60, y: 560, w: 260, h: 18 },
  { x: 340, y: 470, w: 260, h: 18 },
  { x: 640, y: 540, w: 260, h: 18 },
  { x: 880, y: 430, w: 240, h: 18 },
  { x: 520, y: 350, w: 250, h: 18 },
  { x: 160, y: 390, w: 230, h: 18 },
  { x: 360, y: 270, w: 240, h: 18 },
];

const carlao = {
  x: W - 210,
  y: H - 250,
  w: 180,
  h: 200,
};

const stars = Array.from({ length: 70 }, () => ({
  x: Math.random() * W,
  y: Math.random() * (H * 0.55),
  r: Math.random() * 1.6 + 0.4,
  a: Math.random() * 0.6 + 0.35,
}));

const screwdriverSpawns = [
  { x: 150, y: 540 },
  { x: 420, y: 450 },
  { x: 720, y: 520 },
  { x: 960, y: 410 },
  { x: 600, y: 330 },
  { x: 220, y: 370 },
  { x: 430, y: 250 },
];

function placeScrewdriver() {
  const spot =
    screwdriverSpawns[Math.floor(Math.random() * screwdriverSpawns.length)];
  screwdriver = {
    x: spot.x,
    y: spot.y,
    w: 30,
    h: 12,
    taken: false,
  };
}

function reset() {
  player = {
    x: 45,
    y: 610,
    w: 24,
    h: 38,
    vx: 0,
    vy: 0,
    ground: false,
    face: 1,
    onFire: false,
  };
  fires = platforms.map((p, i) => ({
    x: i === 0 ? 520 : Math.min(p.x + p.w / 2, W - 250),
    y: p.y,
    active: true,
    t: Math.random() * 10,
  }));
  particles = [];
  lives = MAX_LIVES;
  gameOver = false;
  deathReason = "";
  hurtCooldown = 0;
  ifoodTimer = 0;
  ifoodBusy = false;
  ifoodSeq++;
  hasScrewdriver = false;
  carlaoTimer = CARLAO_TIME_SEC * 60;
  carlaoShake = 0;
  bossTimer = 0;
  placeScrewdriver();
  player.onFire = true;
  deathSfx.pause();
  deathSfx.currentTime = 0;
  applauseSfx.pause();
  applauseSfx.currentTime = 0;
  bossSfx.pause();
  bossSfx.currentTime = 0;
  tocTocSfx.pause();
  tocTocSfx.currentTime = 0;
  clearTimeout(ifoodHideTimer);
  ifoodEl.classList.remove("visible");
  if (musicStarted) {
    bgMusic.volume = 0.45;
    bgMusic.play().catch(() => {});
  }
}

function kill(reason) {
  if (gameOver) return;
  gameOver = true;
  lives = 0;
  deathReason = reason || "";
  bgMusic.volume = 0.15;
  deathSfx.currentTime = 0;
  deathSfx.play().catch(() => {});
  playApplause();
}

function reigniteAll() {
  for (const f of fires) {
    f.active = true;
    f.t = Math.random() * 10;
  }
  player.onFire = true;
}

function showIfood() {
  if (gameOver) {
    ifoodBusy = false;
    return;
  }
  clearTimeout(ifoodHideTimer);
  ifoodEl.classList.remove("visible");
  void ifoodEl.offsetWidth;
  ifoodEl.classList.add("visible");
  ifoodHideTimer = setTimeout(() => {
    ifoodEl.classList.remove("visible");
    ifoodBusy = false;
  }, 1400);

  ifoodSfx.currentTime = 0;
  ifoodSfx.play().catch(() => {});
  reigniteAll();
}

function screamIfood() {
  if (gameOver || ifoodBusy) return;
  ifoodBusy = true;
  const seq = ++ifoodSeq;
  tocTocSfx.currentTime = 0;
  const go = () => {
    if (seq !== ifoodSeq) return;
    showIfood();
  };
  tocTocSfx.addEventListener("ended", go, { once: true });
  tocTocSfx.play().catch(() => go());
}

addEventListener("keydown", (e) => {
  let k = e.key.toLowerCase();
  if (!playing) {
    if (k === "enter" || k === " ") startGame();
    return;
  }
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k))
    e.preventDefault();
  if (k === " ") {
    keys.add("space");
    extinguish();
    return;
  }
  keys.add(k);
  if (gameOver && k === "r") reset();
});

addEventListener("keyup", (e) =>
  keys.delete(e.key.toLowerCase() === " " ? "space" : e.key.toLowerCase()),
);

document.querySelectorAll("[data-key]").forEach((b) => {
  const k = b.dataset.key;
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    keys.add(k);
    if (k === "space") extinguish();
    b.setPointerCapture(e.pointerId);
  });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
    b.addEventListener(ev, () => keys.delete(k));
});

function extinguish() {
  if (!playing || gameOver) return;
  extinguishSfx.currentTime = 0;
  extinguishSfx.play().catch(() => {});
  let hit = false;
  for (const f of fires) {
    const dx = Math.abs(player.x + player.w / 2 - f.x),
      dy = Math.abs(player.y + player.h / 2 - (f.y - 13));
    if (f.active && dx < 65 && dy < 66) {
      f.active = false;
      hit = true;
      for (let i = 0; i < 18; i++)
        particles.push({
          x: f.x,
          y: f.y - 15,
          vx: (Math.random() - 0.5) * 6,
          vy: -Math.random() * 5,
          life: 30,
        });
      break;
    }
  }
  if (hit && fires.every((f) => !f.active)) player.onFire = false;
}

function hurt() {
  if (hurtCooldown > 0 || gameOver) return;
  lives--;
  hurtCooldown = 90;
  player.vy = -8;
  player.vx = -player.face * 4;
  if (lives <= 0) kill("O Carlão te PEGOU");
}

function touchingFire() {
  for (const f of fires) {
    if (!f.active) continue;
    const dx = Math.abs(player.x + player.w / 2 - f.x),
      dy = Math.abs(player.y + player.h / 2 - (f.y - 13));
    if (dx < 28 && dy < 36) return true;
  }
  return false;
}

function overlaps(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function carlaoAnger() {
  return 1 - Math.max(0, carlaoTimer) / (CARLAO_TIME_SEC * 60);
}

function tryPickupScrewdriver() {
  if (hasScrewdriver || !screwdriver || screwdriver.taken) return;
  if (
    overlaps(
      player.x,
      player.y,
      player.w,
      player.h,
      screwdriver.x - 6,
      screwdriver.y - 10,
      screwdriver.w + 12,
      screwdriver.h + 16,
    )
  ) {
    screwdriver.taken = true;
    hasScrewdriver = true;
    pickupSfx.currentTime = 0;
    pickupSfx.play().catch(() => {});
  }
}

function tryDeliverScrewdriver() {
  if (!hasScrewdriver) return;
  if (
    overlaps(
      player.x,
      player.y,
      player.w,
      player.h,
      carlao.x + 30,
      carlao.y + 40,
      carlao.w - 50,
      carlao.h - 40,
    )
  ) {
    hasScrewdriver = false;
    carlaoTimer = CARLAO_TIME_SEC * 60;
    placeScrewdriver();
  }
}

function update() {
  if (!playing) return;

  if (carlaoShake > 0) carlaoShake--;

  if (!gameOver) {
    ifoodTimer += 1;
    if (ifoodTimer >= (IFOOD_INTERVAL_MS / 1000) * 60) {
      ifoodTimer = 0;
      screamIfood();
    }

    bossTimer += 1;
    if (bossTimer >= BOSS_INTERVAL_FRAMES) {
      bossTimer = 0;
      playBossLine();
    }

    carlaoTimer -= 1;
    if (carlaoTimer <= 0) kill("Carlão ficou sem a chave de fenda!");

    let left = keys.has("a") || keys.has("arrowleft"),
      right = keys.has("d") || keys.has("arrowright");
    player.vx = (right ? 3.7 : 0) - (left ? 3.7 : 0);
    if (player.vx) player.face = Math.sign(player.vx);
    if ((keys.has("w") || keys.has("arrowup")) && player.ground) {
      player.vy = -12.5;
      player.ground = false;
    }
    const prevBottom = player.y + player.h;
    player.vy = Math.min(player.vy + 0.52, 13);
    player.x = Math.max(0, Math.min(W - player.w, player.x + player.vx));
    player.y += player.vy;
    player.ground = false;
    if (player.vy >= 0)
      for (const p of platforms) {
        if (
          prevBottom <= p.y + 10 &&
          player.y + player.h >= p.y &&
          player.x + player.w > p.x + 2 &&
          player.x < p.x + p.w - 2
        ) {
          player.y = p.y - player.h;
          player.vy = 0;
          player.ground = true;
        }
      }
    if (player.y > H + 50) {
      player.x = 45;
      player.y = 610;
      player.vy = 0;
      hurt();
    }
    if (touchingFire()) hurt();
    if (hurtCooldown > 0) hurtCooldown--;

    tryPickupScrewdriver();
    tryDeliverScrewdriver();
  }

  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life--;
  }
  particles = particles.filter((p) => p.life > 0);
}

function drawNightSky() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#050814");
  g.addColorStop(0.45, "#0c1633");
  g.addColorStop(1, "#1a2744");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  for (const s of stars) {
    ctx.fillStyle = `rgba(255,255,255,${s.a})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  const mx = 170,
    my = 110,
    mr = 48;
  const glow = ctx.createRadialGradient(mx, my, 10, mx, my, 120);
  glow.addColorStop(0, "#fff7c280");
  glow.addColorStop(0.45, "#fde68a33");
  glow.addColorStop(1, "#0000");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(mx, my, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fef9c3";
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#050814";
  ctx.beginPath();
  ctx.arc(mx + 18, my - 8, mr * 0.82, 0, Math.PI * 2);
  ctx.fill();
}

function drawScrewdriver() {
  if (!screwdriver || screwdriver.taken) return;
  const { x, y, w, h } = screwdriver;
  const bob = Math.sin(performance.now() / 220) * 3;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2 + bob);
  ctx.rotate(-0.45);
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(-w / 2, -h / 2, 12, h);
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(-w / 2 + 12, -2, w - 12, 4);
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(w / 2 - 4, -5, 4, 10);
  ctx.restore();

  ctx.fillStyle = "#fde68a";
  ctx.font = "bold 12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("chave", x + w / 2, y - 10);
  ctx.textAlign = "left";
}

function drawCarlao() {
  const anger = carlaoAnger();
  const angerShake =
    anger > 0.7 ? Math.sin(performance.now() / 40) * anger * 3 : 0;
  const talkShakeX = carlaoShake > 0 ? Math.sin(performance.now() / 28) * 7 : 0;
  const talkShakeY = carlaoShake > 0 ? Math.cos(performance.now() / 22) * 4 : 0;
  const talkRot = carlaoShake > 0 ? Math.sin(performance.now() / 35) * 0.05 : 0;
  const x = carlao.x + angerShake + talkShakeX;
  const y = carlao.y + talkShakeY;

  if (carlaoImg.complete && carlaoImg.naturalWidth) {
    ctx.save();
    if (anger > 0.02) {
      const hue = -30 * anger;
      const sat = 1 + anger * 5;
      const sep = anger * 0.95;
      ctx.filter = `sepia(${sep}) saturate(${sat}) hue-rotate(${hue}deg) brightness(${1 - anger * 0.12})`;
    }
    if (talkRot) {
      ctx.translate(x + carlao.w / 2, y + carlao.h / 2);
      ctx.rotate(talkRot);
      ctx.drawImage(
        carlaoImg,
        -carlao.w / 2,
        -carlao.h / 2,
        carlao.w,
        carlao.h,
      );
    } else {
      ctx.drawImage(carlaoImg, x, y, carlao.w, carlao.h);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = "#334155";
    ctx.fillRect(x, y, carlao.w, carlao.h);
  }

  // cronômetro acima do Carlão
  const sec = Math.max(0, Math.ceil(carlaoTimer / 60));
  const barW = 150;
  const barX = carlao.x + (carlao.w - barW) / 2;
  const barY = carlao.y - 28;
  ctx.fillStyle = "#0f172acc";
  ctx.fillRect(barX - 4, barY - 18, barW + 8, 34);
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(barX, barY, barW, 10);
  const pct = Math.max(0, carlaoTimer / (CARLAO_TIME_SEC * 60));
  ctx.fillStyle =
    anger > 0.65 ? "#ef4444" : anger > 0.35 ? "#f59e0b" : "#22c55e";
  ctx.fillRect(barX, barY, barW * pct, 10);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Carlão · " + sec + "s", barX + barW / 2, barY - 4);
  ctx.textAlign = "left";
}

function drawFirefighter() {
  const { x, y, w, h, face } = player;

  ctx.fillStyle = "#1e293b";
  ctx.fillRect(x + 3, y + h - 10, 8, 10);
  ctx.fillRect(x + w - 11, y + h - 10, 8, 10);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(x + 2, y + h - 3, 10, 3);
  ctx.fillRect(x + w - 12, y + h - 3, 10, 3);

  ctx.fillStyle = "#dc2626";
  ctx.fillRect(x + 2, y + 16, w - 4, 14);
  ctx.fillStyle = "#b91c1c";
  ctx.fillRect(x + 2, y + 16, 3, 14);
  ctx.fillRect(x + w - 5, y + 16, 3, 14);
  ctx.fillStyle = "#facc15";
  ctx.fillRect(x + 2, y + 19, w - 4, 3);
  ctx.fillRect(x + 2, y + 26, w - 4, 2);

  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(x + (face > 0 ? w - 2 : -5), y + 18, 7, 12);
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(x + (face > 0 ? w : -3), y + 16, 3, 3);

  const headSize = 36;
  const headX = x + w / 2 - headSize / 2;
  const headY = y - 16;
  if (headImg.complete && headImg.naturalWidth) {
    ctx.save();
    if (face < 0) {
      ctx.translate(headX + headSize, headY);
      ctx.scale(-1, 1);
      ctx.drawImage(headImg, 0, 0, headSize, headSize);
    } else {
      ctx.drawImage(headImg, headX, headY, headSize, headSize);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = "#facc15";
    ctx.fillRect(x + 4, y, 16, 14);
  }

  if (hasScrewdriver) {
    const sx = x + (face > 0 ? w + 4 : -22);
    const sy = y + 12;
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(sx, sy, 8, 10);
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(sx + 8, sy + 3, 14, 3);
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawNightSky();

  if (!playing) return;

  for (const p of platforms) {
    ctx.fillStyle = "#3f4f66";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "#7dd3fc";
    ctx.fillRect(p.x, p.y, p.w, 5);
    ctx.fillStyle = "#1e293b";
    for (let x = p.x + 12; x < p.x + p.w - 5; x += 28)
      ctx.fillRect(x, p.y + 10, 14, 3);
  }

  const time = performance.now() / 160;
  for (const f of fires) {
    if (!f.active) continue;
    const wobble = Math.sin(time + f.t) * 4;
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.moveTo(f.x - 15, f.y);
    ctx.quadraticCurveTo(f.x - 22, f.y - 17, f.x - 7, f.y - 28 + wobble);
    ctx.quadraticCurveTo(f.x - 4, f.y - 17, f.x + 2, f.y - 38 - wobble);
    ctx.quadraticCurveTo(f.x + 20, f.y - 15, f.x + 15, f.y);
    ctx.fill();
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(f.x - 7, f.y);
    ctx.quadraticCurveTo(f.x - 11, f.y - 12, f.x + 1, f.y - 21 + wobble);
    ctx.quadraticCurveTo(f.x + 12, f.y - 9, f.x + 8, f.y);
    ctx.fill();
  }

  for (const p of particles) {
    ctx.fillStyle = `rgba(125,211,252,${p.life / 30})`;
    ctx.fillRect(p.x, p.y, 5, 5);
  }

  drawScrewdriver();
  drawCarlao();

  const flash = hurtCooldown > 0 && Math.floor(hurtCooldown / 6) % 2 === 0;
  if (!flash) drawFirefighter();

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 18px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("Vidas: " + "♥".repeat(Math.max(0, lives)), 16, 28);
  if (hasScrewdriver) {
    ctx.fillStyle = "#fde68a";
    ctx.fillText("🔧 Chave de fenda em mãos — leve ao Carlão!", 16, 52);
  }

  if (gameOver) {
    ctx.fillStyle = "#020617c9";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f87171";
    ctx.font = "bold 48px system-ui";
    ctx.fillText("FIM DE JOGO", W / 2, H / 2 - 24);
    if (deathReason) {
      ctx.fillStyle = "#fca5a5";
      ctx.font = "20px system-ui";
      ctx.fillText(deathReason, W / 2, H / 2 + 12);
    }
    ctx.fillStyle = "#fff";
    ctx.font = "20px system-ui";
    ctx.fillText("Pressione R para reiniciar", W / 2, H / 2 + 48);
    ctx.textAlign = "left";
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
