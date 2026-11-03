/**
 * web/game.js
 * "Brick Smash" - HTML5 Canvas Retro Arcade Game
 * Built-in Web Audio API sound synthesizer (zero external sound files)
 * Touch, Mouse, and Keyboard controls.
 * Authentic camouflage disguise for private encrypted chat.
 */

export class BrickSmashGame {
  constructor(canvas, onUnlockRequested) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onUnlockRequested = onUnlockRequested;

    this.isRunning = false;
    this.animationId = null;

    // Game state
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('brick_smash_high_score') || '0', 10);
    this.lives = 3;
    this.level = 1;
    this.isGameOver = false;
    this.isVictory = false;
    this.isPaused = false;

    // Brick colors & values
    this.rowColors = [
      { fill: '#FF3366', stroke: '#CC1144', pts: 70 },
      { fill: '#FF7733', stroke: '#DD5511', pts: 60 },
      { fill: '#FFCC00', stroke: '#DDAA00', pts: 50 },
      { fill: '#00E676', stroke: '#00B359', pts: 40 },
      { fill: '#00D4FF', stroke: '#00A3CC', pts: 30 },
      { fill: '#7C4DFF', stroke: '#5E35B1', pts: 20 },
      { fill: '#E040FB', stroke: '#AB47BC', pts: 10 },
    ];

    // Objects
    this.paddle = { x: 0, y: 0, width: 90, height: 12, speed: 8 };
    this.ball = { x: 0, y: 0, radius: 6, dx: 4, dy: -4, speed: 5 };
    this.bricks = [];
    this.particles = [];

    // Audio context (Web Audio API)
    this.audioCtx = null;

    this.bindEvents();
    this.resize();
    this.initLevel();
  }

  initAudio() {
    if (!this.audioCtx) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      } catch (_) {}
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  playTone(freq, duration = 0.08, type = 'sine') {
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (_) {}
  }

  soundPaddle() {
    this.playTone(380, 0.07, 'triangle');
  }

  soundBrick(pts) {
    this.playTone(480 + pts * 3, 0.06, 'sine');
  }

  soundLoseLife() {
    this.playTone(180, 0.25, 'sawtooth');
  }

  soundWin() {
    this.playTone(523, 0.1, 'sine');
    setTimeout(() => this.playTone(659, 0.1, 'sine'), 100);
    setTimeout(() => this.playTone(784, 0.15, 'sine'), 200);
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const w = Math.min(rect.width, 560);
    const h = Math.min(rect.height || 640, 720);

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    this.width = w;
    this.height = h;

    this.paddle.width = Math.max(76, Math.min(100, w * 0.22));
    this.paddle.height = 12;
    this.paddle.y = this.height - 35;
    if (this.paddle.x === 0 || this.paddle.x + this.paddle.width > this.width) {
      this.paddle.x = (this.width - this.paddle.width) / 2;
    }
  }

  initLevel() {
    this.resize();
    const cols = Math.floor(Math.min(8, (this.width - 24) / 48));
    const brickWidth = Math.floor((this.width - 24 - (cols - 1) * 5) / cols);
    const brickHeight = 14;
    const startY = 65;

    this.bricks = [];
    const rows = Math.min(6, this.rowColors.length);

    for (let r = 0; r < rows; r++) {
      const color = this.rowColors[r];
      for (let c = 0; c < cols; c++) {
        const x = 12 + c * (brickWidth + 5);
        const y = startY + r * (brickHeight + 5);
        this.bricks.push({
          x,
          y,
          width: brickWidth,
          height: brickHeight,
          color: color.fill,
          stroke: color.stroke,
          pts: color.pts,
          alive: true,
        });
      }
    }

    this.resetBall();
  }

  resetBall() {
    this.ball.x = this.paddle.x + this.paddle.width / 2;
    this.ball.y = this.paddle.y - 12;
    const angle = (Math.PI / 4) + (Math.random() * Math.PI) / 2;
    const speed = 4.5 + (this.level - 1) * 0.5;
    this.ball.dx = Math.cos(angle) * (Math.random() > 0.5 ? speed : -speed);
    this.ball.dy = -Math.abs(Math.sin(angle) * speed);
  }

  createSparks(x, y, color) {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x,
        y,
        dx: (Math.random() - 0.5) * 6,
        dy: (Math.random() - 0.5) * 6,
        radius: Math.random() * 2.5 + 1,
        color,
        life: 1,
      });
    }
  }

  bindEvents() {
    // Touch controls
    const handleTouch = (e) => {
      e.preventDefault();
      this.initAudio();
      if (this.isGameOver || this.isVictory) {
        this.restart();
        return;
      }
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const clientX = touch.clientX - rect.left;
      this.paddle.x = Math.max(0, Math.min(this.width - this.paddle.width, clientX - this.paddle.width / 2));
    };

    this.canvas.addEventListener('touchstart', handleTouch, { passive: false });
    this.canvas.addEventListener('touchmove', handleTouch, { passive: false });

    // Mouse controls
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      this.paddle.x = Math.max(0, Math.min(this.width - this.paddle.width, mouseX - this.paddle.width / 2));
    });

    this.canvas.addEventListener('click', () => {
      this.initAudio();
      if (this.isGameOver || this.isVictory) {
        this.restart();
      }
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      this.initAudio();
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.paddle.x = Math.max(0, this.paddle.x - 22);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.paddle.x = Math.min(this.width - this.paddle.width, this.paddle.x + 22);
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (this.isGameOver || this.isVictory) {
          this.restart();
        }
      }
    });

    // Window resize
    window.addEventListener('resize', () => {
      if (this.isRunning) {
        this.resize();
      }
    });
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.loop = (time) => {
      if (!this.isRunning) return;
      this.update();
      this.draw();
      this.animationId = requestAnimationFrame(this.loop);
    };
    this.animationId = requestAnimationFrame(this.loop);
    this.updateTabTitle();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  restart() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.isGameOver = false;
    this.isVictory = false;
    this.initLevel();
    this.start();
  }

  update() {
    if (this.isGameOver || this.isVictory || this.isPaused) return;

    // Move ball
    this.ball.x += this.ball.dx;
    this.ball.y += this.ball.dy;

    // Wall collision (left / right)
    if (this.ball.x - this.ball.radius <= 0) {
      this.ball.x = this.ball.radius;
      this.ball.dx = Math.abs(this.ball.dx);
      this.soundPaddle();
    } else if (this.ball.x + this.ball.radius >= this.width) {
      this.ball.x = this.width - this.ball.radius;
      this.ball.dx = -Math.abs(this.ball.dx);
      this.soundPaddle();
    }

    // Top wall collision
    if (this.ball.y - this.ball.radius <= 44) {
      this.ball.y = 44 + this.ball.radius;
      this.ball.dy = Math.abs(this.ball.dy);
      this.soundPaddle();
    }

    // Paddle collision
    if (
      this.ball.y + this.ball.radius >= this.paddle.y &&
      this.ball.y - this.ball.radius <= this.paddle.y + this.paddle.height &&
      this.ball.x >= this.paddle.x - 2 &&
      this.ball.x <= this.paddle.x + this.paddle.width + 2
    ) {
      // Calculate bounce angle based on where it hit paddle
      const hitRatio = (this.ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
      const maxAngle = (Math.PI / 180) * 60; // 60 degrees max
      const currentSpeed = Math.sqrt(this.ball.dx * this.ball.dx + this.ball.dy * this.ball.dy);

      this.ball.dx = currentSpeed * Math.sin(hitRatio * maxAngle);
      this.ball.dy = -Math.abs(currentSpeed * Math.cos(hitRatio * maxAngle));
      this.ball.y = this.paddle.y - this.ball.radius;
      this.soundPaddle();
    }

    // Brick collision
    let aliveCount = 0;
    for (const b of this.bricks) {
      if (!b.alive) continue;
      aliveCount++;

      if (
        this.ball.x + this.ball.radius >= b.x &&
        this.ball.x - this.ball.radius <= b.x + b.width &&
        this.ball.y + this.ball.radius >= b.y &&
        this.ball.y - this.ball.radius <= b.y + b.height
      ) {
        b.alive = false;
        this.ball.dy = -this.ball.dy;
        this.score += b.pts;
        if (this.score > this.highScore) {
          this.highScore = this.score;
          localStorage.setItem('brick_smash_high_score', this.highScore.toString());
        }
        this.createSparks(b.x + b.width / 2, b.y + b.height / 2, b.color);
        this.soundBrick(b.pts);
        this.updateTabTitle();
        break;
      }
    }

    // Victory check
    if (aliveCount === 0) {
      this.soundWin();
      this.level++;
      if (this.level > 5) {
        this.isVictory = true;
      } else {
        this.initLevel();
      }
    }

    // Ball lost (bottom)
    if (this.ball.y - this.ball.radius > this.height) {
      this.lives--;
      this.soundLoseLife();
      if (this.lives <= 0) {
        this.isGameOver = true;
        this.updateTabTitle();
      } else {
        this.resetBall();
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.dx;
      p.y += p.dy;
      p.life -= 0.04;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Background gradient
    const bg = this.ctx.createLinearGradient(0, 0, 0, this.height);
    bg.addColorStop(0, '#0E0B16');
    bg.addColorStop(1, '#050409');
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Subtle Grid Pattern
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    this.ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 25) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 44);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }

    // HUD Header
    this.drawHUD();

    // Bricks
    for (const b of this.bricks) {
      if (!b.alive) continue;
      this.ctx.fillStyle = b.color;
      this.ctx.beginPath();
      this.ctx.roundRect ? this.ctx.roundRect(b.x, b.y, b.width, b.height, 3) : this.ctx.rect(b.x, b.y, b.width, b.height);
      this.ctx.fill();

      // Top highlight
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      this.ctx.fillRect(b.x, b.y, b.width, 2.5);

      // Border
      this.ctx.strokeStyle = b.stroke;
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    }

    // Particles
    for (const p of this.particles) {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = Math.max(0, p.life);
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1.0;

    // Paddle with neon glow
    this.ctx.save();
    this.ctx.shadowColor = '#00E5FF';
    this.ctx.shadowBlur = 12;
    const paddleGrad = this.ctx.createLinearGradient(this.paddle.x, 0, this.paddle.x + this.paddle.width, 0);
    paddleGrad.addColorStop(0, '#00C9FF');
    paddleGrad.addColorStop(1, '#92FE9D');
    this.ctx.fillStyle = paddleGrad;
    this.ctx.beginPath();
    this.ctx.roundRect ? this.ctx.roundRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height, 6) : this.ctx.rect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
    this.ctx.fill();
    this.ctx.restore();

    // Ball with glow
    this.ctx.save();
    this.ctx.shadowColor = '#FF007F';
    this.ctx.shadowBlur = 10;
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // Game Over / Victory Overlay
    if (this.isGameOver) {
      this.drawBanner('GAME OVER', 'Tap screen to retry', '#FF2A6D');
    } else if (this.isVictory) {
      this.drawBanner('VICTORY!', `Final Score: ${this.score}`, '#00E676');
    }
  }

  drawHUD() {
    this.ctx.fillStyle = 'rgba(20, 15, 30, 0.85)';
    this.ctx.fillRect(0, 0, this.width, 42);

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.beginPath();
    this.ctx.moveTo(0, 42);
    this.ctx.lineTo(this.width, 42);
    this.ctx.stroke();

    // Score
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 13px -apple-system, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`SCORE: ${this.score}`, 14, 26);

    // High score
    this.ctx.fillStyle = '#8E8A9F';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`HI: ${this.highScore}`, this.width / 2, 26);

    // Lives
    this.ctx.textAlign = 'right';
    let hearts = '';
    for (let i = 0; i < this.lives; i++) hearts += '♥ ';
    this.ctx.fillStyle = '#FF3366';
    this.ctx.font = '14px sans-serif';
    this.ctx.fillText(hearts.trim(), this.width - 14, 26);
  }

  drawBanner(title, subtitle, color) {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    this.ctx.fillRect(0, 140, this.width, 160);

    this.ctx.textAlign = 'center';
    this.ctx.font = '900 28px -apple-system, sans-serif';
    this.ctx.fillStyle = color;
    this.ctx.fillText(title, this.width / 2, 210);

    this.ctx.font = '500 14px -apple-system, sans-serif';
    this.ctx.fillStyle = '#E0DDEB';
    this.ctx.fillText(subtitle, this.width / 2, 250);
  }

  updateTabTitle() {
    document.title = `Brick Smash | Score: ${this.score}`;
  }
}
