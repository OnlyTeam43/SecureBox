// client/src/components/BrickSmashGame.tsx
// High-Performance 60-120 FPS Physics Engine with 0ms React State Overhead
// Pre-rendered offscreen sprite caches for Animal Character Balls (Panda, Cat, Puppy)
// Pre-rendered gift pills & Direct Compositor Pointer Events for instant 0-latency paddle response

import React, { useEffect, useRef } from 'react';
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

  const playTone = (freq: number, duration = 0.06, type: OscillatorType = 'sine') => {
    if (!audioCtxRef.current) return;
    try {
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtxRef.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + duration);
    } catch (_) {}
  };

  const playPowerupChime = () => {
    playTone(523, 0.05, 'sine');
    setTimeout(() => playTone(659, 0.05, 'sine'), 50);
    setTimeout(() => playTone(784, 0.08, 'sine'), 100);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // ─────────────────────────────────────────────────────────────
    // 1. PRE-RENDER OFFSCREEN SPRITES (0ms Render Overhead in Loop)
    // ─────────────────────────────────────────────────────────────
    const SPRITE_SIZE = 64; // High DPI 2x sprite
    const makeOffscreen = () => {
      const off = document.createElement('canvas');
      off.width = SPRITE_SIZE;
      off.height = SPRITE_SIZE;
      return off;
    };

    // Panda Sprite 🐼
    const pandaCanvas = makeOffscreen();
    const pCtx = pandaCanvas.getContext('2d');
    if (pCtx) {
      const cx = 32, cy = 32, r = 24, s = r / 16;
      // Ears
      pCtx.fillStyle = '#2C2C2A';
      pCtx.beginPath();
      pCtx.arc(cx - 11 * s, cy - 11 * s, 5.5 * s, 0, Math.PI * 2);
      pCtx.arc(cx + 11 * s, cy - 11 * s, 5.5 * s, 0, Math.PI * 2);
      pCtx.fill();

      // Head
      pCtx.fillStyle = '#FFFFFF';
      pCtx.strokeStyle = '#2C2C2A';
      pCtx.lineWidth = 1.6 * s;
      pCtx.beginPath();
      pCtx.arc(cx, cy, r, 0, Math.PI * 2);
      pCtx.fill();
      pCtx.stroke();

      // Eye Patches
      pCtx.fillStyle = '#2C2C2A';
      pCtx.beginPath();
      pCtx.ellipse(cx - 5 * s, cy - 2 * s, 4 * s, 5 * s, Math.PI / 8, 0, Math.PI * 2);
      pCtx.ellipse(cx + 5 * s, cy - 2 * s, 4 * s, 5 * s, -Math.PI / 8, 0, Math.PI * 2);
      pCtx.fill();

      // Pupils
      pCtx.fillStyle = '#FFFFFF';
      pCtx.beginPath();
      pCtx.arc(cx - 4.5 * s, cy - 2.5 * s, 1.5 * s, 0, Math.PI * 2);
      pCtx.arc(cx + 4.5 * s, cy - 2.5 * s, 1.5 * s, 0, Math.PI * 2);
      pCtx.fill();

      // Cheeks
      pCtx.fillStyle = '#F4C0D1';
      pCtx.beginPath();
      pCtx.arc(cx - 8.5 * s, cy + 4 * s, 2.6 * s, 0, Math.PI * 2);
      pCtx.arc(cx + 8.5 * s, cy + 4 * s, 2.6 * s, 0, Math.PI * 2);
      pCtx.fill();

      // Snout & Mouth
      pCtx.fillStyle = '#2C2C2A';
      pCtx.beginPath();
      pCtx.ellipse(cx, cy + 2.8 * s, 2.2 * s, 1.6 * s, 0, 0, Math.PI * 2);
      pCtx.fill();
      pCtx.strokeStyle = '#2C2C2A';
      pCtx.lineWidth = 1.2 * s;
      pCtx.beginPath();
      pCtx.arc(cx, cy + 3.5 * s, 2.4 * s, 0.2 * Math.PI, 0.8 * Math.PI);
      pCtx.stroke();
    }

    // Cat Sprite 🐱
    const catCanvas = makeOffscreen();
    const cCtx = catCanvas.getContext('2d');
    if (cCtx) {
      const cx = 32, cy = 32, r = 24, s = r / 16;
      cCtx.fillStyle = '#FAC775';
      cCtx.strokeStyle = '#854F0B';
      cCtx.lineWidth = 1.4 * s;

      // Ears
      cCtx.beginPath();
      cCtx.moveTo(cx - 12 * s, cy - 4 * s);
      cCtx.lineTo(cx - 10 * s, cy - 18 * s);
      cCtx.lineTo(cx - 2 * s, cy - 11 * s);
      cCtx.closePath();
      cCtx.fill();
      cCtx.stroke();

      cCtx.beginPath();
      cCtx.moveTo(cx + 12 * s, cy - 4 * s);
      cCtx.lineTo(cx + 10 * s, cy - 18 * s);
      cCtx.lineTo(cx + 2 * s, cy - 11 * s);
      cCtx.closePath();
      cCtx.fill();
      cCtx.stroke();

      // Inner Pink
      cCtx.fillStyle = '#F4A56C';
      cCtx.beginPath();
      cCtx.moveTo(cx - 10 * s, cy - 5 * s);
      cCtx.lineTo(cx - 9 * s, cy - 15 * s);
      cCtx.lineTo(cx - 3 * s, cy - 11 * s);
      cCtx.closePath();
      cCtx.fill();

      cCtx.beginPath();
      cCtx.moveTo(cx + 10 * s, cy - 5 * s);
      cCtx.lineTo(cx + 9 * s, cy - 15 * s);
      cCtx.lineTo(cx + 3 * s, cy - 11 * s);
      cCtx.closePath();
      cCtx.fill();

      // Head
      cCtx.fillStyle = '#FAC775';
      cCtx.beginPath();
      cCtx.arc(cx, cy, r, 0, Math.PI * 2);
      cCtx.fill();
      cCtx.stroke();

      // Cheeks
      cCtx.fillStyle = '#F4C0D1';
      cCtx.beginPath();
      cCtx.arc(cx - 8 * s, cy + 3 * s, 3 * s, 0, Math.PI * 2);
      cCtx.arc(cx + 8 * s, cy + 3 * s, 3 * s, 0, Math.PI * 2);
      cCtx.fill();

      // Eyes
      cCtx.fillStyle = '#412402';
      cCtx.beginPath();
      cCtx.arc(cx - 5 * s, cy - 2 * s, 2.4 * s, 0, Math.PI * 2);
      cCtx.arc(cx + 5 * s, cy - 2 * s, 2.4 * s, 0, Math.PI * 2);
      cCtx.fill();

      cCtx.fillStyle = '#FFFFFF';
      cCtx.beginPath();
      cCtx.arc(cx - 4.2 * s, cy - 2.8 * s, 1 * s, 0, Math.PI * 2);
      cCtx.arc(cx + 5.8 * s, cy - 2.8 * s, 1 * s, 0, Math.PI * 2);
      cCtx.fill();

      // Nose
      cCtx.fillStyle = '#D4537E';
      cCtx.beginPath();
      cCtx.moveTo(cx - 2 * s, cy + 2 * s);
      cCtx.lineTo(cx + 2 * s, cy + 2 * s);
      cCtx.lineTo(cx, cy + 4 * s);
      cCtx.closePath();
      cCtx.fill();
    }

    // Puppy Sprite 🐶
    const puppyCanvas = makeOffscreen();
    const puCtx = puppyCanvas.getContext('2d');
    if (puCtx) {
      const cx = 32, cy = 32, r = 24, s = r / 16;
      // Floppy ears
      puCtx.fillStyle = '#854F0B';
      puCtx.beginPath();
      puCtx.ellipse(cx - 13 * s, cy - 2 * s, 4.5 * s, 9 * s, Math.PI / 10, 0, Math.PI * 2);
      puCtx.ellipse(cx + 13 * s, cy - 2 * s, 4.5 * s, 9 * s, -Math.PI / 10, 0, Math.PI * 2);
      puCtx.fill();

      // Head
      puCtx.fillStyle = '#F5C4B3';
      puCtx.strokeStyle = '#993C1D';
      puCtx.lineWidth = 1.4 * s;
      puCtx.beginPath();
      puCtx.arc(cx, cy, r, 0, Math.PI * 2);
      puCtx.fill();
      puCtx.stroke();

      // Muzzle
      puCtx.fillStyle = '#FAECE7';
      puCtx.beginPath();
      puCtx.ellipse(cx, cy + 4 * s, 6.5 * s, 4.5 * s, 0, 0, Math.PI * 2);
      puCtx.fill();

      // Cheeks
      puCtx.fillStyle = '#F4C0D1';
      puCtx.beginPath();
      puCtx.arc(cx - 8 * s, cy + 3 * s, 2.6 * s, 0, Math.PI * 2);
      puCtx.arc(cx + 8 * s, cy + 3 * s, 2.6 * s, 0, Math.PI * 2);
      puCtx.fill();

      // Eyes
      puCtx.fillStyle = '#2C2C2A';
      puCtx.beginPath();
      puCtx.arc(cx - 5 * s, cy - 2 * s, 2.4 * s, 0, Math.PI * 2);
      puCtx.arc(cx + 5 * s, cy - 2 * s, 2.4 * s, 0, Math.PI * 2);
      puCtx.fill();

      puCtx.fillStyle = '#FFFFFF';
      puCtx.beginPath();
      puCtx.arc(cx - 4.2 * s, cy - 2.8 * s, 1 * s, 0, Math.PI * 2);
      puCtx.arc(cx + 5.8 * s, cy - 2.8 * s, 1 * s, 0, Math.PI * 2);
      puCtx.fill();

      // Nose
      puCtx.fillStyle = '#2C2C2A';
      puCtx.beginPath();
      puCtx.ellipse(cx, cy + 2.5 * s, 2.4 * s, 1.8 * s, 0, 0, Math.PI * 2);
      puCtx.fill();
    }

    // ─────────────────────────────────────────────────────────────
    // 2. PRE-RENDER GIFT SPRITES
    // ─────────────────────────────────────────────────────────────
    const giftSprites: Record<GiftType, { canvas: HTMLCanvasElement; label: string; color: string }> = {
      multiball: { canvas: makeOffscreen(), label: 'Multi-Ball!', color: '#D97757' },
      points: { canvas: makeOffscreen(), label: '+100!', color: '#E28743' },
      heart: { canvas: makeOffscreen(), label: '+1 Life!', color: '#FF3366' },
      wide: { canvas: makeOffscreen(), label: 'Wide Paddle!', color: '#5E9473' },
    };

    const giftEmojis: Record<GiftType, string> = {
      multiball: '🐾',
      points: '🎁',
      heart: '❤️',
      wide: '⚡',
    };

    (Object.keys(giftSprites) as GiftType[]).forEach((type) => {
      const gC = giftSprites[type].canvas;
      gC.width = 36;
      gC.height = 24;
      const gCtx = gC.getContext('2d');
      if (gCtx) {
        gCtx.fillStyle = '#FFFFFF';
        gCtx.strokeStyle = giftSprites[type].color;
        gCtx.lineWidth = 1.5;
        gCtx.beginPath();
        (gCtx as any).roundRect
          ? (gCtx as any).roundRect(1, 1, 34, 22, 11)
          : gCtx.rect(1, 1, 34, 22);
        gCtx.fill();
        gCtx.stroke();

        gCtx.font = '13px sans-serif';
        gCtx.textAlign = 'center';
        gCtx.textBaseline = 'middle';
        gCtx.fillText(giftEmojis[type], 18, 12);
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 3. ZERO-OVERHEAD GAME STATE (No React rerenders in game loop)
    // ─────────────────────────────────────────────────────────────
    let animId: number;
    let score = 0;
    let lives = 3;
    let level = 1;
    let highScore = parseInt(localStorage.getItem('brick_smash_high_score') || '0', 10);
    let gameOver = false;
    let victory = false;

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

    // Progressive snappy ball velocity
    const getBallSpeed = (lvl: number) => 7.2 + Math.min((lvl - 1) * 0.25, 4.0);

    const basePaddleWidth = Math.max(86, Math.min(108, w * 0.24));
    let paddleWidth = basePaddleWidth;
    let widePaddleTimer: NodeJS.Timeout | null = null;

    const paddle = {
      x: (w - basePaddleWidth) / 2,
      y: h - 35,
      height: 13,
    };

    // Balls Pool
    const balls: Ball[] = [
      {
        x: w / 2,
        y: h - 50,
        radius: 13,
        dx: 5.2,
        dy: -5.2,
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
      const speed = getBallSpeed(level);
      const angle = Math.PI / 4 + (Math.random() * Math.PI) / 2;
      balls.push({
        x: paddle.x + paddleWidth / 2,
        y: paddle.y - 15,
        radius: 13,
        dx: Math.cos(angle) * (Math.random() > 0.5 ? speed : -speed),
        dy: -Math.abs(Math.sin(angle) * speed),
        speed,
        character: 'panda',
        active: true,
      });
    };

    const spawnMultiBall = () => {
      const refBall = balls.find((b) => b.active) || balls[0];
      const companions: AnimalType[] = ['cat', 'puppy'];
      companions.forEach((animal, i) => {
        const angle = (Math.PI / 3) * (i === 0 ? 0.8 : 1.2);
        const speed = getBallSpeed(level) * 1.05;
        balls.push({
          x: refBall.x,
          y: refBall.y,
          radius: 13,
          dx: (i === 0 ? 1 : -1) * Math.cos(angle) * speed,
          dy: -Math.abs(Math.sin(angle) * speed),
          speed,
          character: animal,
          active: true,
        });
      });
    };

    const spawnGift = (bx: number, by: number) => {
      if (Math.random() > 0.42) return;

      const types: GiftType[] = ['multiball', 'points', 'heart', 'wide'];
      const chosen = types[Math.floor(Math.random() * types.length)];

      gifts.push({
        x: bx - 18,
        y: by,
        width: 36,
        height: 24,
        vy: 3.4,
        type: chosen,
        active: true,
      });
    };

    const applyGift = (g: Gift) => {
      playPowerupChime();
      const meta = giftSprites[g.type];

      floatingTexts.push({
        x: paddle.x + paddleWidth / 2,
        y: paddle.y - 10,
        text: meta.label,
        color: meta.color,
        alpha: 1.0,
      });

      if (g.type === 'multiball') {
        spawnMultiBall();
      } else if (g.type === 'points') {
        score += 100;
        if (score > highScore) {
          highScore = score;
          localStorage.setItem('brick_smash_high_score', highScore.toString());
        }
      } else if (g.type === 'heart') {
        lives = Math.min(lives + 1, 5);
      } else if (g.type === 'wide') {
        paddleWidth = basePaddleWidth + 44;
        if (widePaddleTimer) clearTimeout(widePaddleTimer);
        widePaddleTimer = setTimeout(() => {
          paddleWidth = basePaddleWidth;
        }, 12000);
      }
    };

    initBricks();
    resetPrimaryBall();

    // ─────────────────────────────────────────────────────────────
    // 4. INSTANT 0-LATENCY POINTER CONTROLS (Compositor Thread)
    // ─────────────────────────────────────────────────────────────
    let isPointerDown = false;

    const updatePaddlePos = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      const pointerX = clientX - rect.left;
      paddle.x = Math.max(0, Math.min(w - paddleWidth, pointerX - paddleWidth / 2));
    };

    const onPointerDown = (e: PointerEvent) => {
      initAudio();
      isPointerDown = true;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
      updatePaddlePos(e.clientX);
      if (gameOver || victory) restartGame();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerDown && e.pointerType === 'touch') return;
      updatePaddlePos(e.clientX);
    };

    const onPointerUp = (e: PointerEvent) => {
      isPointerDown = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
    };

    const onKeyDown = (e: KeyboardEvent) => {
      initAudio();
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        paddle.x = Math.max(0, paddle.x - 26);
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        paddle.x = Math.min(w - paddleWidth, paddle.x + 26);
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (gameOver || victory) restartGame();
      }
    };

    const restartGame = () => {
      score = 0;
      lives = 3;
      level = 1;
      gameOver = false;
      victory = false;
      gifts.length = 0;
      floatingTexts.length = 0;
      paddleWidth = basePaddleWidth;
      initBricks();
      resetPrimaryBall();
    };

    canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
    canvas.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('pointerup', onPointerUp, { passive: true });
    canvas.addEventListener('pointercancel', onPointerUp, { passive: true });
    window.addEventListener('keydown', onKeyDown);

    // ─────────────────────────────────────────────────────────────
    // 5. FIXED TIME-STEP PHYSICS LOOP (Smooth 60-120Hz Delta Time)
    // ─────────────────────────────────────────────────────────────
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const elapsed = currentTime - lastTime;
      lastTime = currentTime;

      // Delta time capped to prevent teleporting
      const dt = Math.min(elapsed / 16.667, 1.8);

      if (!gameOver && !victory) {
        // Update balls
        for (let i = balls.length - 1; i >= 0; i--) {
          const b = balls[i];
          if (!b.active) continue;

          b.x += b.dx * dt;
          b.y += b.dy * dt;

          // Side wall bounce
          if (b.x - b.radius <= 0) {
            b.x = b.radius;
            b.dx = Math.abs(b.dx);
            playTone(380, 0.04, 'triangle');
          } else if (b.x + b.radius >= w) {
            b.x = w - b.radius;
            b.dx = -Math.abs(b.dx);
            playTone(380, 0.04, 'triangle');
          }

          // Top wall bounce
          if (b.y - b.radius <= 44) {
            b.y = 44 + b.radius;
            b.dy = Math.abs(b.dy);
            playTone(380, 0.04, 'triangle');
          }

          // Paddle bounce
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
            playTone(440, 0.05, 'triangle');
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
              score += brick.pts;

              if (score > highScore) {
                highScore = score;
                localStorage.setItem('brick_smash_high_score', highScore.toString());
              }

              // Sparks
              for (let k = 0; k < 5; k++) {
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

              spawnGift(brick.x + brick.width / 2, brick.y + brick.height);
              playTone(480 + brick.pts * 2, 0.04, 'sine');
              break;
            }
          }

          if (remaining === 0) {
            level++;
            if (level > 4) {
              victory = true;
            } else {
              initBricks();
              resetPrimaryBall();
            }
          }

          if (b.y - b.radius > h) {
            b.active = false;
          }
        }

        // Check if all balls were lost
        const activeCount = balls.filter((b) => b.active).length;
        if (activeCount === 0) {
          lives--;
          playTone(180, 0.2, 'sawtooth');
          if (lives <= 0) {
            gameOver = true;
          } else {
            resetPrimaryBall();
          }
        }

        // Update gifts
        for (let i = gifts.length - 1; i >= 0; i--) {
          const g = gifts[i];
          if (!g.active) continue;

          g.y += g.vy * dt;

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

        // Update floating texts
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
          const ft = floatingTexts[i];
          ft.y -= 1.3 * dt;
          ft.alpha -= 0.025 * dt;
          if (ft.alpha <= 0) floatingTexts.splice(i, 1);
        }

        // Update particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.dx * dt;
          p.y += p.dy * dt;
          p.life -= 0.05 * dt;
          if (p.life <= 0) particles.splice(i, 1);
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 6. RENDER (Hardware-Accelerated Blits)
      // ─────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, w, h);

      // Canvas background (warm ivory)
      ctx.fillStyle = '#FAF9F5';
      ctx.fillRect(0, 0, w, h);

      // Hairline Grid Lines
      ctx.strokeStyle = 'rgba(20, 20, 19, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 44);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // HUD Header
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
      ctx.fillText(`SCORE: ${score}`, 16, 26);

      ctx.fillStyle = '#87867F';
      ctx.textAlign = 'center';
      ctx.fillText(`HIGH: ${highScore}`, w / 2, 26);

      ctx.textAlign = 'right';
      let hearts = '';
      for (let i = 0; i < lives; i++) hearts += '♥ ';
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

      // Particles
      for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Draw Falling Gifts using pre-rendered offscreen canvases
      for (const g of gifts) {
        if (!g.active) continue;
        const sprite = giftSprites[g.type]?.canvas;
        if (sprite) {
          ctx.drawImage(sprite, g.x, g.y);
        }
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

      // Paddle
      ctx.fillStyle = Colors.accent.primary;
      ctx.beginPath();
      (ctx as any).roundRect
        ? (ctx as any).roundRect(paddle.x, paddle.y, paddleWidth, paddle.height, 6)
        : ctx.rect(paddle.x, paddle.y, paddleWidth, paddle.height);
      ctx.fill();

      // Blit Animal Character Balls via GPU offscreen cache (0ms draw time!)
      for (const b of balls) {
        if (!b.active) continue;
        const sCanvas = b.character === 'cat' ? catCanvas : b.character === 'puppy' ? puppyCanvas : pandaCanvas;
        const diameter = b.radius * 2;
        ctx.drawImage(sCanvas, b.x - b.radius, b.y - b.radius, diameter, diameter);
      }

      // Overlays
      if (gameOver) {
        ctx.fillStyle = 'rgba(250, 249, 245, 0.94)';
        ctx.fillRect(0, 140, w, 140);
        ctx.textAlign = 'center';
        ctx.fillStyle = Colors.accent.primary;
        ctx.font = '600 24px -apple-system, sans-serif';
        ctx.fillText('GAME OVER', w / 2, 195);
        ctx.font = '400 13px -apple-system, sans-serif';
        ctx.fillStyle = '#5E5D59';
        ctx.fillText('Tap screen or press Space to play again', w / 2, 230);
      } else if (victory) {
        ctx.fillStyle = 'rgba(250, 249, 245, 0.94)';
        ctx.fillRect(0, 140, w, 140);
        ctx.textAlign = 'center';
        ctx.fillStyle = Colors.status.online;
        ctx.font = '600 24px -apple-system, sans-serif';
        ctx.fillText('VICTORY!', w / 2, 195);
        ctx.font = '400 13px -apple-system, sans-serif';
        ctx.fillStyle = '#5E5D59';
        ctx.fillText(`Final Score: ${score}`, w / 2, 230);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      if (widePaddleTimer) clearTimeout(widePaddleTimer);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
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
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
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
        touchAction: 'none',
      }}>
        <canvas
          ref={canvasRef}
          style={{
            cursor: 'pointer',
            touchAction: 'none',
            display: 'block',
          }}
        />
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
        <span>Drag to move paddle</span>
        <span style={{ fontSize: 11, opacity: 0.8 }}>🐾 Multi-Ball & Gifts Active</span>
      </div>
    </div>
  );
};
