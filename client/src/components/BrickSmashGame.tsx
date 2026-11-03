// client/src/components/BrickSmashGame.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Colors, BrickRowColors } from '../theme/tokens';
import { Lock } from 'lucide-react';

interface BrickSmashGameProps {
  onUnlockClick: () => void;
}

type AnimalType = 'panda' | 'cat' | 'puppy';
type GiftType = 'multiball' | 'points' | 'heart' | 'wide';

interface Gift {
  x: number;
  y: number;
  width: number;
  height: number;
  vy: number;
  type: GiftType;
  emoji: string;
  label: string;
  color: string;
  active: boolean;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
}

interface Ball {
  x: number;
  y: number;
  radius: number;
  dx: number;
  dy: number;
  speed: number;
  character: AnimalType;
  active: boolean;
}

export const BrickSmashGame: React.FC<BrickSmashGameProps> = ({ onUnlockClick }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('brick_smash_high_score') || '0', 10);
  });
  const [lives, setLives] = useState(3);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVictory, setIsVictory] = useState(false);

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      try {
        const AudioClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioClass) audioCtxRef.current = new AudioClass();
      } catch (_) {}
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
  };

  const playTone = (freq: number, duration = 0.08, type: OscillatorType = 'sine') => {
    if (!audioCtxRef.current) return;
    try {
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtxRef.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + duration);
    } catch (_) {}
  };

  const playPowerupChime = () => {
    playTone(523, 0.07, 'sine');
    setTimeout(() => playTone(659, 0.07, 'sine'), 60);
    setTimeout(() => playTone(784, 0.1, 'sine'), 120);
  };

  // Helper to draw cute scalable animal face directly onto Canvas
  const drawAnimalFace = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, char: AnimalType) => {
    ctx.save();
    ctx.translate(x, y);

    const scale = r / 16; // Normal face radius is 16

    if (char === 'cat') {
      // Cat Ears
      ctx.fillStyle = '#FAC775';
      ctx.strokeStyle = '#854F0B';
      ctx.lineWidth = 1.2 * scale;

      // Left Ear
      ctx.beginPath();
      ctx.moveTo(-12 * scale, -4 * scale);
      ctx.lineTo(-10 * scale, -18 * scale);
      ctx.lineTo(-2 * scale, -11 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Right Ear
      ctx.beginPath();
      ctx.moveTo(12 * scale, -4 * scale);
      ctx.lineTo(10 * scale, -18 * scale);
      ctx.lineTo(2 * scale, -11 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner Pink Ears
      ctx.fillStyle = '#F4A56C';
      ctx.beginPath();
      ctx.moveTo(-10 * scale, -5 * scale);
      ctx.lineTo(-9 * scale, -15 * scale);
      ctx.lineTo(-3 * scale, -11 * scale);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(10 * scale, -5 * scale);
      ctx.lineTo(9 * scale, -15 * scale);
      ctx.lineTo(3 * scale, -11 * scale);
      ctx.closePath();
      ctx.fill();

      // Head
      ctx.fillStyle = '#FAC775';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Pink Cheeks
      ctx.fillStyle = '#F4C0D1';
      ctx.beginPath();
      ctx.arc(-8 * scale, 3 * scale, 2.8 * scale, 0, Math.PI * 2);
      ctx.arc(8 * scale, 3 * scale, 2.8 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#412402';
      ctx.beginPath();
      ctx.arc(-5 * scale, -2 * scale, 2.2 * scale, 0, Math.PI * 2);
      ctx.arc(5 * scale, -2 * scale, 2.2 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Eye Sparkles
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-4.2 * scale, -2.8 * scale, 0.9 * scale, 0, Math.PI * 2);
      ctx.arc(5.8 * scale, -2.8 * scale, 0.9 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Nose & Whiskers
      ctx.fillStyle = '#D4537E';
      ctx.beginPath();
      ctx.moveTo(-1.8 * scale, 2 * scale);
      ctx.lineTo(1.8 * scale, 2 * scale);
      ctx.lineTo(0, 3.8 * scale);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#854F0B';
      ctx.lineWidth = 0.8 * scale;
      ctx.beginPath();
      ctx.moveTo(-7 * scale, 1 * scale);
      ctx.lineTo(-13 * scale, 0.5 * scale);
      ctx.moveTo(-7 * scale, 3 * scale);
      ctx.lineTo(-13 * scale, 3.5 * scale);
      ctx.moveTo(7 * scale, 1 * scale);
      ctx.lineTo(13 * scale, 0.5 * scale);
      ctx.moveTo(7 * scale, 3 * scale);
      ctx.lineTo(13 * scale, 3.5 * scale);
      ctx.stroke();
    } else if (char === 'puppy') {
      // Puppy Floppy Ears
      ctx.fillStyle = '#854F0B';
      ctx.beginPath();
      ctx.ellipse(-13 * scale, -2 * scale, 4.5 * scale, 9 * scale, Math.PI / 10, 0, Math.PI * 2);
      ctx.ellipse(13 * scale, -2 * scale, 4.5 * scale, 9 * scale, -Math.PI / 10, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = '#F5C4B3';
      ctx.strokeStyle = '#993C1D';
      ctx.lineWidth = 1.2 * scale;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Muzzle
      ctx.fillStyle = '#FAECE7';
      ctx.beginPath();
      ctx.ellipse(0, 4 * scale, 6.5 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cheeks
      ctx.fillStyle = '#F4C0D1';
      ctx.beginPath();
      ctx.arc(-8 * scale, 3 * scale, 2.5 * scale, 0, Math.PI * 2);
      ctx.arc(8 * scale, 3 * scale, 2.5 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#2C2C2A';
      ctx.beginPath();
      ctx.arc(-5 * scale, -2 * scale, 2.2 * scale, 0, Math.PI * 2);
      ctx.arc(5 * scale, -2 * scale, 2.2 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Eye Sparkles
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-4.2 * scale, -2.8 * scale, 0.9 * scale, 0, Math.PI * 2);
      ctx.arc(5.8 * scale, -2.8 * scale, 0.9 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Nose
      ctx.fillStyle = '#2C2C2A';
      ctx.beginPath();
      ctx.ellipse(0, 2.5 * scale, 2.2 * scale, 1.6 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Default: Panda 🐼
      // Panda Ears
      ctx.fillStyle = '#2C2C2A';
      ctx.beginPath();
      ctx.arc(-11 * scale, -11 * scale, 5.2 * scale, 0, Math.PI * 2);
      ctx.arc(11 * scale, -11 * scale, 5.2 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Panda Head
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#2C2C2A';
      ctx.lineWidth = 1.3 * scale;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Eye Patches
      ctx.fillStyle = '#2C2C2A';
      ctx.beginPath();
      ctx.ellipse(-5 * scale, -1.8 * scale, 3.8 * scale, 4.6 * scale, Math.PI / 8, 0, Math.PI * 2);
      ctx.ellipse(5 * scale, -1.8 * scale, 3.8 * scale, 4.6 * scale, -Math.PI / 8, 0, Math.PI * 2);
      ctx.fill();

      // Pupils
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-4.5 * scale, -2.2 * scale, 1.4 * scale, 0, Math.PI * 2);
      ctx.arc(4.5 * scale, -2.2 * scale, 1.4 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Cheeks
      ctx.fillStyle = '#F4C0D1';
      ctx.beginPath();
      ctx.arc(-8 * scale, 4 * scale, 2.4 * scale, 0, Math.PI * 2);
      ctx.arc(8 * scale, 4 * scale, 2.4 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Snout & Smile
      ctx.fillStyle = '#2C2C2A';
      ctx.beginPath();
      ctx.ellipse(0, 2.6 * scale, 2 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#2C2C2A';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.arc(0, 3.2 * scale, 2.2 * scale, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }

    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let currentScore = 0;
    let currentLives = 3;
    let currentLevel = 1;
    let gameOver = false;
    let victory = false;

    // Dimensions
    const dpr = window.devicePixelRatio || 1;
    const updateSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const w = Math.min(rect.width || 480, 560);
      const h = Math.min(rect.height || 640, 700);

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      return { w, h };
    };

    let { w, h } = updateSize() || { w: 480, h: 640 };

    // Progressive snappy ball speed (Increased speed requested by user!)
    const getBallSpeed = (lvl: number) => 6.8 + Math.min((lvl - 1) * 0.25, 4.0);

    const basePaddleWidth = Math.max(86, Math.min(108, w * 0.24));
    let paddleWidth = basePaddleWidth;
    let widePaddleTimer: NodeJS.Timeout | null = null;

    const paddle = {
      x: (w - basePaddleWidth) / 2,
      y: h - 35,
      height: 13,
    };

    // Balls Pool (Supports Multi-Ball with cute companion animal heads!)
    const balls: Ball[] = [
      {
        x: w / 2,
        y: h - 50,
        radius: 12, // Distinct animal face size
        dx: 4.8,
        dy: -4.8,
        speed: getBallSpeed(1),
        character: 'panda',
        active: true,
      },
    ];

    interface Brick {
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
      border: string;
      pts: number;
      alive: boolean;
    }

    let bricks: Brick[] = [];
    const gifts: Gift[] = [];
    const floatingTexts: FloatingText[] = [];
    const particles: Array<{ x: number; y: number; dx: number; dy: number; r: number; color: string; life: number }> = [];

    const initBricks = () => {
      const cols = Math.floor(Math.min(8, (w - 24) / 48));
      const brickWidth = Math.floor((w - 24 - (cols - 1) * 5) / cols);
      const brickHeight = 14;
      const startY = 65;
      bricks = [];

      for (let r = 0; r < Math.min(7, BrickRowColors.length); r++) {
        const rowColor = BrickRowColors[r];
        for (let c = 0; c < cols; c++) {
          bricks.push({
            x: 12 + c * (brickWidth + 5),
            y: startY + r * (brickHeight + 5),
            width: brickWidth,
            height: brickHeight,
            color: rowColor.color,
            border: rowColor.border,
            pts: rowColor.points,
            alive: true,
          });
        }
      }
    };

    const resetPrimaryBall = () => {
      balls.length = 0;
      const speed = getBallSpeed(currentLevel);
      const angle = Math.PI / 4 + (Math.random() * Math.PI) / 2;
      balls.push({
        x: paddle.x + paddleWidth / 2,
        y: paddle.y - 14,
        radius: 12,
        dx: Math.cos(angle) * (Math.random() > 0.5 ? speed : -speed),
        dy: -Math.abs(Math.sin(angle) * speed),
        speed,
        character: 'panda',
        active: true,
      });
    };

    const spawnMultiBall = () => {
      const activeBalls = balls.filter((b) => b.active);
      const refBall = activeBalls[0] || balls[0];

      // Spawn Cat 🐱 and Puppy 🐶 companion balls!
      const companions: AnimalType[] = ['cat', 'puppy'];
      companions.forEach((animal, i) => {
        const angle = (Math.PI / 3) * (i === 0 ? 0.8 : 1.2);
        const speed = getBallSpeed(currentLevel) * 1.05;
        balls.push({
          x: refBall.x,
          y: refBall.y,
          radius: 12,
          dx: (i === 0 ? 1 : -1) * Math.cos(angle) * speed,
          dy: -Math.abs(Math.sin(angle) * speed),
          speed,
          character: animal,
          active: true,
        });
      });
    };

    const spawnGift = (bx: number, by: number) => {
      // 40% chance to drop falling gift from smashed brick!
      if (Math.random() > 0.4) return;

      const giftPool: Array<{ type: GiftType; emoji: string; label: string; color: string }> = [
        { type: 'multiball', emoji: '🐾', label: 'Multi-Ball!', color: '#D97757' },
        { type: 'points', emoji: '🎁', label: '+100!', color: '#E28743' },
        { type: 'heart', emoji: '❤️', label: '+1 Life!', color: '#FF3366' },
        { type: 'wide', emoji: '⚡', label: 'Wide Paddle!', color: '#5E9473' },
      ];

      const chosen = giftPool[Math.floor(Math.random() * giftPool.length)];
      gifts.push({
        x: bx - 14,
        y: by,
        width: 32,
        height: 24,
        vy: 3.2,
        type: chosen.type,
        emoji: chosen.emoji,
        label: chosen.label,
        color: chosen.color,
        active: true,
      });
    };

    const applyGift = (gift: Gift) => {
      playPowerupChime();
      floatingTexts.push({
        x: paddle.x + paddleWidth / 2,
        y: paddle.y - 10,
        text: gift.label,
        color: gift.color,
        alpha: 1.0,
      });

      if (gift.type === 'multiball') {
        spawnMultiBall();
      } else if (gift.type === 'points') {
        currentScore += 100;
        setScore(currentScore);
      } else if (gift.type === 'heart') {
        currentLives = Math.min(currentLives + 1, 5);
        setLives(currentLives);
      } else if (gift.type === 'wide') {
        paddleWidth = basePaddleWidth + 44;
        if (widePaddleTimer) clearTimeout(widePaddleTimer);
        widePaddleTimer = setTimeout(() => {
          paddleWidth = basePaddleWidth;
        }, 12000);
      }
    };

    initBricks();
    resetPrimaryBall();

    // Event handlers
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      initAudio();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      paddle.x = Math.max(0, Math.min(w - paddleWidth, touchX - paddleWidth / 2));
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      paddle.x = Math.max(0, Math.min(w - paddleWidth, mouseX - paddleWidth / 2));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      initAudio();
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        paddle.x = Math.max(0, paddle.x - 24);
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        paddle.x = Math.min(w - paddleWidth, paddle.x + 24);
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (gameOver || victory) {
          restartGame();
        }
      }
    };

    const restartGame = () => {
      currentScore = 0;
      currentLives = 3;
      currentLevel = 1;
      gameOver = false;
      victory = false;
      gifts.length = 0;
      floatingTexts.length = 0;
      paddleWidth = basePaddleWidth;
      setScore(0);
      setLives(3);
      setIsGameOver(false);
      setIsVictory(false);
      initBricks();
      resetPrimaryBall();
    };

    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', () => {
      initAudio();
      if (gameOver || victory) restartGame();
    });
    window.addEventListener('keydown', onKeyDown);

    // Main 60-120fps Game Loop
    const loop = () => {
      if (!gameOver && !victory) {
        // Update all active balls
        for (let i = balls.length - 1; i >= 0; i--) {
          const b = balls[i];
          if (!b.active) continue;

          b.x += b.dx;
          b.y += b.dy;

          // Side walls
          if (b.x - b.radius <= 0) {
            b.x = b.radius;
            b.dx = Math.abs(b.dx);
            playTone(380, 0.05, 'triangle');
          } else if (b.x + b.radius >= w) {
            b.x = w - b.radius;
            b.dx = -Math.abs(b.dx);
            playTone(380, 0.05, 'triangle');
          }

          // Top wall
          if (b.y - b.radius <= 44) {
            b.y = 44 + b.radius;
            b.dy = Math.abs(b.dy);
            playTone(380, 0.05, 'triangle');
          }

          // Paddle collision
          if (
            b.y + b.radius >= paddle.y &&
            b.y - b.radius <= paddle.y + paddle.height &&
            b.x >= paddle.x - 2 &&
            b.x <= paddle.x + paddleWidth + 2
          ) {
            const hitRatio = (b.x - (paddle.x + paddleWidth / 2)) / (paddleWidth / 2);
            const maxAngle = (Math.PI / 180) * 60;
            const currentSpeed = Math.sqrt(b.dx * b.dx + b.dy * b.dy);
            b.dx = currentSpeed * Math.sin(hitRatio * maxAngle);
            b.dy = -Math.abs(currentSpeed * Math.cos(hitRatio * maxAngle));
            b.y = paddle.y - b.radius;
            playTone(440, 0.06, 'triangle');
          }

          // Brick collision
          let remaining = 0;
          for (const brick of bricks) {
            if (!brick.alive) continue;
            remaining++;

            if (
              b.x + b.radius >= brick.x &&
              b.x - b.radius <= brick.x + brick.width &&
              b.y + b.radius >= brick.y &&
              b.y - b.radius <= brick.y + brick.height
            ) {
              brick.alive = false;
              b.dy = -b.dy;
              currentScore += brick.pts;
              setScore(currentScore);

              const storedHigh = parseInt(localStorage.getItem('brick_smash_high_score') || '0', 10);
              if (currentScore > storedHigh) {
                setHighScore(currentScore);
                localStorage.setItem('brick_smash_high_score', currentScore.toString());
              }

              // Sparks
              for (let k = 0; k < 6; k++) {
                particles.push({
                  x: brick.x + brick.width / 2,
                  y: brick.y + brick.height / 2,
                  dx: (Math.random() - 0.5) * 5,
                  dy: (Math.random() - 0.5) * 5,
                  r: Math.random() * 2 + 1,
                  color: brick.color,
                  life: 1,
                });
              }

              // 40% Chance to drop falling gifts!
              spawnGift(brick.x + brick.width / 2, brick.y + brick.height);

              playTone(480 + brick.pts * 2, 0.05, 'sine');
              document.title = `Brick Smash | Score: ${currentScore}`;
              break;
            }
          }

          // Check level complete
          if (remaining === 0) {
            currentLevel++;
            if (currentLevel > 4) {
              victory = true;
              setIsVictory(true);
            } else {
              initBricks();
              resetPrimaryBall();
            }
          }

          // Ball fell below paddle
          if (b.y - b.radius > h) {
            b.active = false;
          }
        }

        // Check if all balls were lost
        const activeBallsCount = balls.filter((b) => b.active).length;
        if (activeBallsCount === 0) {
          currentLives--;
          setLives(currentLives);
          playTone(180, 0.2, 'sawtooth');
          if (currentLives <= 0) {
            gameOver = true;
            setIsGameOver(true);
          } else {
            resetPrimaryBall();
          }
        }

        // Update Falling Gifts
        for (let i = gifts.length - 1; i >= 0; i--) {
          const g = gifts[i];
          if (!g.active) continue;

          g.y += g.vy;

          // Catch gift with paddle!
          if (
            g.y + g.height >= paddle.y &&
            g.y <= paddle.y + paddle.height &&
            g.x + g.width >= paddle.x &&
            g.x <= paddle.x + paddleWidth
          ) {
            g.active = false;
            applyGift(g);
          } else if (g.y > h) {
            g.active = false;
          }
        }

        // Update Floating Texts
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
          const ft = floatingTexts[i];
          ft.y -= 1.2;
          ft.alpha -= 0.02;
          if (ft.alpha <= 0) {
            floatingTexts.splice(i, 1);
          }
        }

        // Update Particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.dx;
          p.y += p.dy;
          p.life -= 0.04;
          if (p.life <= 0) particles.splice(i, 1);
        }
      }

      // ─────────────────────────────────────────────────────────
      // RENDER
      // ─────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, w, h);

      // Background - Keep exact web game canvas warm ivory!
      ctx.fillStyle = '#FAF9F5';
      ctx.fillRect(0, 0, w, h);

      // Subtle Grid
      ctx.strokeStyle = 'rgba(20, 20, 19, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 44);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Top HUD Header
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, 44);
      ctx.strokeStyle = 'rgba(20, 20, 19, 0.08)';
      ctx.beginPath();
      ctx.moveTo(0, 44);
      ctx.lineTo(w, 44);
      ctx.stroke();

      ctx.fillStyle = '#141413';
      ctx.font = '500 13px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`SCORE: ${currentScore}`, 16, 26);

      ctx.fillStyle = '#87867F';
      ctx.textAlign = 'center';
      ctx.fillText(`HIGH: ${highScore}`, w / 2, 26);

      ctx.textAlign = 'right';
      let hearts = '';
      for (let i = 0; i < currentLives; i++) hearts += '♥ ';
      ctx.fillStyle = Colors.accent.primary;
      ctx.font = '14px sans-serif';
      ctx.fillText(hearts.trim(), w - 16, 26);

      // Bricks
      for (const b of bricks) {
        if (!b.alive) continue;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        (ctx as any).roundRect ? (ctx as any).roundRect(b.x, b.y, b.width, b.height, 4) : ctx.rect(b.x, b.y, b.width, b.height);
        ctx.fill();

        ctx.strokeStyle = b.border;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Smashed Brick Particles
      for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Draw Falling Gifts (Capsule Badge with Emoji)
      for (const g of gifts) {
        if (!g.active) continue;

        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = g.color;
        ctx.lineWidth = 1.5;

        // Pill shape
        ctx.beginPath();
        (ctx as any).roundRect
          ? (ctx as any).roundRect(g.x, g.y, g.width, g.height, 12)
          : ctx.rect(g.x, g.y, g.width, g.height);
        ctx.fill();
        ctx.stroke();

        // Emoji
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(g.emoji, g.x + g.width / 2, g.y + g.height / 2);
        ctx.restore();
      }

      // Draw Floating Notification Text
      for (const ft of floatingTexts) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 13px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      // Paddle - Claude Terracotta Accent
      ctx.fillStyle = Colors.accent.primary;
      ctx.beginPath();
      (ctx as any).roundRect
        ? (ctx as any).roundRect(paddle.x, paddle.y, paddleWidth, paddle.height, 6)
        : ctx.rect(paddle.x, paddle.y, paddleWidth, paddle.height);
      ctx.fill();

      // Draw Animal Character Balls! 🐼 🐱 🐶
      for (const b of balls) {
        if (!b.active) continue;
        drawAnimalFace(ctx, b.x, b.y, b.radius, b.character);
      }

      // Game Over / Victory Overlays
      if (gameOver) {
        ctx.fillStyle = 'rgba(250, 249, 245, 0.92)';
        ctx.fillRect(0, 140, w, 140);
        ctx.textAlign = 'center';
        ctx.fillStyle = Colors.accent.primary;
        ctx.font = '600 24px -apple-system, sans-serif';
        ctx.fillText('GAME OVER', w / 2, 195);
        ctx.font = '400 13px -apple-system, sans-serif';
        ctx.fillStyle = '#5E5D59';
        ctx.fillText('Tap screen or press Space to play again', w / 2, 230);
      } else if (victory) {
        ctx.fillStyle = 'rgba(250, 249, 245, 0.92)';
        ctx.fillRect(0, 140, w, 140);
        ctx.textAlign = 'center';
        ctx.fillStyle = Colors.status.online;
        ctx.font = '600 24px -apple-system, sans-serif';
        ctx.fillText('VICTORY!', w / 2, 195);
        ctx.font = '400 13px -apple-system, sans-serif';
        ctx.fillStyle = '#5E5D59';
        ctx.fillText(`Final Score: ${currentScore}`, w / 2, 230);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      if (widePaddleTimer) clearTimeout(widePaddleTimer);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: Colors.bg.primary,
    }}>
      {/* Top Header */}
      <div style={{
        width: '100%',
        maxWidth: 560,
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: `1px solid ${Colors.border}`,
        backgroundColor: Colors.bg.elevated,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 600,
          fontSize: 16,
          color: Colors.accent.primary,
          letterSpacing: '-0.3px',
          cursor: 'pointer',
        }}>
          <span>🐼 BRICK SMASH</span>
        </div>

        {/* Discreet PIN trigger */}
        <button
          onClick={onUnlockClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 8,
            backgroundColor: Colors.bg.secondary,
            border: `1px solid ${Colors.border}`,
            color: Colors.text.secondary,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
          title="Security PIN"
        >
          <Lock size={13} color={Colors.text.secondary} />
          <span>PIN</span>
        </button>
      </div>

      {/* Canvas Wrapper */}
      <div style={{
        flex: 1,
        width: '100%',
        maxWidth: 560,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <canvas ref={canvasRef} style={{ cursor: 'pointer', touchAction: 'none' }} />
      </div>

      {/* Bottom Bar */}
      <div style={{
        width: '100%',
        maxWidth: 560,
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 12,
        color: Colors.text.placeholder,
        borderTop: `1px solid ${Colors.border}`,
        backgroundColor: Colors.bg.elevated,
      }}>
        <span>Drag or arrow keys to move paddle</span>
        <span style={{ fontSize: 11, opacity: 0.8 }}>🐾 Catch falling gifts!</span>
      </div>
    </div>
  );
};
