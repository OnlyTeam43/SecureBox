// client/src/components/BrickSmashGame.tsx
// High-Performance 60-120 FPS Physics Engine with 0ms React State Overhead
// Pre-rendered offscreen sprite caches for Animal Character Balls (Panda, Cat, Puppy) using real assets
// Clean vector arcade gift pills, BOMB bricks with 25% blast mechanic, speed boost, sound toggle & Features Modal

import React, { useEffect, useRef, useState } from 'react';
import { Colors, BrickRowColors } from '../theme/tokens';
import { Lock, Volume2, VolumeX } from 'lucide-react';
import { BrickWallPeeker } from './BrickWallPeeker';
import { FeaturesModal } from './FeaturesModal';

interface BrickSmashGameProps {
  onUnlockClick: () => void;
  unreadCount?: number;
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

interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  border: string;
  pts: number;
  alive: boolean;
  isBomb?: boolean;
  bombHitCount?: number;
  maxBombHits?: number;
}

export const BrickSmashGame: React.FC<BrickSmashGameProps> = ({ onUnlockClick, unreadCount = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isFeaturesOpen, setIsFeaturesOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('brick_smash_sound_muted') === 'true';
  });
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

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
    if (isMutedRef.current || !audioCtxRef.current) return;
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
    if (isMutedRef.current) return;
    playTone(523, 0.05, 'sine');
    setTimeout(() => playTone(659, 0.05, 'sine'), 50);
    setTimeout(() => playTone(784, 0.08, 'sine'), 100);
  };

  const playBombExplosion = () => {
    if (isMutedRef.current || !audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(36, ctx.currentTime + 0.38);

      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.38);
    } catch (_) {}
  };

  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    isMutedRef.current = next;
    localStorage.setItem('brick_smash_sound_muted', String(next));
    if (!next) {
      initAudio();
      setTimeout(() => playTone(600, 0.08, 'sine'), 50);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // ─────────────────────────────────────────────────────────────
    // 1. PRE-RENDER OFFSCREEN SPRITES USING OUR ASSETS (/characters)
    // ─────────────────────────────────────────────────────────────
    const SPRITE_SIZE = 64; // High DPI 2x sprite
    const makeOffscreen = () => {
      const off = document.createElement('canvas');
      off.width = SPRITE_SIZE;
      off.height = SPRITE_SIZE;
      return off;
    };

    const pandaCanvas = makeOffscreen();
    const catCanvas = makeOffscreen();
    const puppyCanvas = makeOffscreen();

    // Helper to draw asset image clipped to crisp ball
    const renderBallFromImage = (
      targetCanvas: HTMLCanvasElement,
      img: HTMLImageElement,
      fallbackColor: string
    ) => {
      const sCtx = targetCanvas.getContext('2d');
      if (!sCtx) return;
      sCtx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      const cx = SPRITE_SIZE / 2;
      const cy = SPRITE_SIZE / 2;
      const r = 24;

      sCtx.save();
      // Circular clipping
      sCtx.beginPath();
      sCtx.arc(cx, cy, r, 0, Math.PI * 2);
      sCtx.clip();

      // Clean background
      sCtx.fillStyle = '#FFFFFF';
      sCtx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

      if (img.complete && img.naturalWidth > 0) {
        sCtx.drawImage(img, cx - r + 1, cy - r + 1, (r - 1) * 2, (r - 1) * 2);
      } else {
        sCtx.fillStyle = fallbackColor;
        sCtx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      }
      sCtx.restore();

      // Rim & 3D bevel
      sCtx.strokeStyle = 'rgba(20, 20, 19, 0.25)';
      sCtx.lineWidth = 1.6;
      sCtx.beginPath();
      sCtx.arc(cx, cy, r, 0, Math.PI * 2);
      sCtx.stroke();

      // Subtle gloss sheen
      const grad = sCtx.createLinearGradient(cx, cy - r, cx, cy);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      sCtx.fillStyle = grad;
      sCtx.beginPath();
      sCtx.arc(cx, cy, r - 1.5, Math.PI * 1.1, Math.PI * 1.9);
      sCtx.lineTo(cx, cy);
      sCtx.closePath();
      sCtx.fill();
    };

    // Load actual character image assets
    const pandaImg = new Image();
    pandaImg.src = '/characters/panda-idle.png';
    pandaImg.onload = () => renderBallFromImage(pandaCanvas, pandaImg, '#FFFFFF');

    const catImg = new Image();
    catImg.src = '/characters/cat-idle.png';
    catImg.onload = () => renderBallFromImage(catCanvas, catImg, '#FAC775');

    const puppyImg = new Image();
    puppyImg.src = '/characters/puppy-idle.png';
    puppyImg.onload = () => renderBallFromImage(puppyCanvas, puppyImg, '#F5C4B3');

    // Initial render in case cached or fallback
    renderBallFromImage(pandaCanvas, pandaImg, '#FFFFFF');
    renderBallFromImage(catCanvas, catImg, '#FAC775');
    renderBallFromImage(puppyCanvas, puppyImg, '#F5C4B3');

    // ─────────────────────────────────────────────────────────────
    // 2. PRE-RENDER CLEAN VECTOR GIFT SPRITES (NO EMOJIS)
    // ─────────────────────────────────────────────────────────────
    const giftSprites: Record<GiftType, { canvas: HTMLCanvasElement; label: string; color: string }> = {
      multiball: { canvas: makeOffscreen(), label: 'Multi-Ball!', color: '#D97757' },
      points: { canvas: makeOffscreen(), label: '+100!', color: '#E28743' },
      heart: { canvas: makeOffscreen(), label: '+1 Life!', color: '#FF3366' },
      wide: { canvas: makeOffscreen(), label: 'Wide Paddle!', color: '#5E9473' },
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

        // Vector icon drawing per powerup (clean, crisp, no emojis)
        if (type === 'multiball') {
          // Double ball dots
          gCtx.fillStyle = '#D97757';
          gCtx.beginPath();
          gCtx.arc(14, 12, 4, 0, Math.PI * 2);
          gCtx.arc(22, 12, 4, 0, Math.PI * 2);
          gCtx.fill();
        } else if (type === 'points') {
          gCtx.fillStyle = '#E28743';
          gCtx.font = 'bold 9px monospace';
          gCtx.textAlign = 'center';
          gCtx.textBaseline = 'middle';
          gCtx.fillText('+100', 18, 12);
        } else if (type === 'heart') {
          // Clean vector heart
          gCtx.fillStyle = '#FF3366';
          gCtx.beginPath();
          gCtx.moveTo(18, 15);
          gCtx.bezierCurveTo(18, 15, 12, 11, 12, 8);
          gCtx.bezierCurveTo(12, 5, 15, 5, 18, 9);
          gCtx.bezierCurveTo(21, 5, 24, 5, 24, 8);
          gCtx.bezierCurveTo(24, 11, 18, 15, 18, 15);
          gCtx.fill();
        } else if (type === 'wide') {
          // Clean wide paddle symbol
          gCtx.fillStyle = '#5E9473';
          gCtx.beginPath();
          (gCtx as any).roundRect ? (gCtx as any).roundRect(10, 10, 16, 4, 2) : gCtx.rect(10, 10, 16, 4);
          gCtx.fill();
          // Small arrows
          gCtx.strokeStyle = '#5E9473';
          gCtx.lineWidth = 1.2;
          gCtx.beginPath();
          gCtx.moveTo(8, 12);
          gCtx.lineTo(6, 12);
          gCtx.moveTo(28, 12);
          gCtx.lineTo(30, 12);
          gCtx.stroke();
        }
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 3. ZERO-OVERHEAD GAME STATE
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

    // Snappier progressive ball speed
    const getBallSpeed = (lvl: number) => 8.4 + Math.min((lvl - 1) * 0.35, 4.5);

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
        radius: 12.5,
        dx: 5.8,
        dy: -5.8,
        speed: getBallSpeed(1),
        character: 'panda',
        active: true,
      },
    ];

    let bricks: Brick[] = [];
    const gifts: Gift[] = [];
    const floatingTexts: FloatingText[] = [];
    const particles: Array<{ x: number; y: number; dx: number; dy: number; r: number; color: string; life: number }> = [];

    // Dense brick grid (more bricks + smaller brick size + bomb placement)
    const initBricks = () => {
      // 9 to 10 columns for a denser, more satisfying wall
      const cols = Math.floor(Math.min(10, (w - 20) / 42));
      const brickWidth = Math.floor((w - 20 - (cols - 1) * 4) / cols);
      const brickHeight = 12; // decreased height
      const startY = 60;
      const numRows = Math.min(8, BrickRowColors.length);
      bricks = [];

      // Determine bomb bricks (approx 5-6% of bricks, placed in rows 1 to 5)
      const totalBricks = numRows * cols;
      const bombIndices = new Set<number>();
      const bombTargetCount = Math.max(3, Math.min(5, Math.floor(totalBricks * 0.06)));
      let attempts = 0;
      while (bombIndices.size < bombTargetCount && attempts < 100) {
        attempts++;
        const r = 1 + Math.floor(Math.random() * (numRows - 2));
        const c = Math.floor(Math.random() * cols);
        bombIndices.add(r * cols + c);
      }

      for (let r = 0; r < numRows; r++) {
        const rowColor = BrickRowColors[r % BrickRowColors.length];
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const isBomb = bombIndices.has(idx);

          bricks.push({
            x: 10 + c * (brickWidth + 4),
            y: startY + r * (brickHeight + 4),
            width: brickWidth,
            height: brickHeight,
            color: isBomb ? '#1F1E1D' : rowColor.color,
            border: isBomb ? '#EF4444' : rowColor.border,
            pts: isBomb ? 150 : rowColor.points,
            alive: true,
            isBomb,
            bombHitCount: isBomb ? 2 : 0,
            maxBombHits: isBomb ? 2 : 0,
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
        radius: 12.5,
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
          radius: 12.5,
          dx: (i === 0 ? 1 : -1) * Math.cos(angle) * speed,
          dy: -Math.abs(Math.sin(angle) * speed),
          speed,
          character: animal,
          active: true,
        });
      });
    };

    const spawnGift = (bx: number, by: number) => {
      if (Math.random() > 0.38) return;

      const types: GiftType[] = ['multiball', 'points', 'heart', 'wide'];
      const chosen = types[Math.floor(Math.random() * types.length)];

      gifts.push({
        x: bx - 18,
        y: by,
        width: 36,
        height: 24,
        vy: 3.5,
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
    // 4. INSTANT 0-LATENCY POINTER CONTROLS
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
    // 5. FIXED TIME-STEP PHYSICS LOOP
    // ─────────────────────────────────────────────────────────────
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const elapsed = currentTime - lastTime;
      lastTime = currentTime;

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
              b.dy = -b.dy;

              if (brick.isBomb) {
                // BOMB BRICK HIT LOGIC
                if ((brick.bombHitCount || 1) > 1) {
                  brick.bombHitCount = (brick.bombHitCount || 2) - 1;
                  brick.border = '#FF3B30';
                  brick.color = '#381616';
                  playTone(620, 0.08, 'sawtooth');
                  floatingTexts.push({
                    x: brick.x + brick.width / 2,
                    y: brick.y - 8,
                    text: '⚠️ 1 HIT TO BLAST!',
                    color: '#FF3B30',
                    alpha: 1.0,
                  });
                  // Sparks
                  for (let k = 0; k < 8; k++) {
                    particles.push({
                      x: brick.x + brick.width / 2,
                      y: brick.y + brick.height / 2,
                      dx: (Math.random() - 0.5) * 6,
                      dy: (Math.random() - 0.5) * 6,
                      r: Math.random() * 2.5 + 1,
                      color: '#FF4444',
                      life: 1,
                    });
                  }
                } else {
                  // DETONATE: Blast 25% of all remaining alive bricks!
                  brick.alive = false;
                  const aliveOthers = bricks.filter((bk) => bk.alive && bk !== brick);
                  const blastCount = Math.max(1, Math.ceil(aliveOthers.length * 0.25));

                  // Blast nearest surrounding bricks
                  aliveOthers.sort((bkA, bkB) => {
                    const da = Math.hypot(bkA.x - brick.x, bkA.y - brick.y);
                    const db = Math.hypot(bkB.x - brick.x, bkB.y - brick.y);
                    return da - db;
                  });

                  const blasted = aliveOthers.slice(0, blastCount);
                  let blastPoints = 150;
                  for (const bk of blasted) {
                    bk.alive = false;
                    blastPoints += bk.pts;
                    for (let k = 0; k < 4; k++) {
                      particles.push({
                        x: bk.x + bk.width / 2,
                        y: bk.y + bk.height / 2,
                        dx: (Math.random() - 0.5) * 8,
                        dy: (Math.random() - 0.5) * 8,
                        r: Math.random() * 2 + 1,
                        color: bk.color,
                        life: 1.2,
                      });
                    }
                  }

                  score += blastPoints;
                  if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('brick_smash_high_score', highScore.toString());
                  }

                  playBombExplosion();

                  floatingTexts.push({
                    x: w / 2,
                    y: brick.y - 14,
                    text: `💥 25% BLAST! +${blastPoints}`,
                    color: '#EF4444',
                    alpha: 1.0,
                  });
                }
              } else {
                // NORMAL BRICK HIT
                brick.alive = false;
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
              }
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
      // 6. RENDER
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
      ctx.font = '600 13px -apple-system, sans-serif';
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
        (ctx as any).roundRect ? (ctx as any).roundRect(b.x, b.y, b.width, b.height, 3) : ctx.rect(b.x, b.y, b.width, b.height);
        ctx.fill();

        ctx.strokeStyle = b.border;
        ctx.lineWidth = b.isBomb ? 1.5 : 1;
        ctx.stroke();

        // Bomb indicator with remaining hit count
        if (b.isBomb) {
          ctx.save();
          ctx.fillStyle = b.bombHitCount === 1 ? '#EF4444' : '#FFA500';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`💣${b.bombHitCount}`, b.x + b.width / 2, b.y + b.height / 2);
          ctx.restore();
        }
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

      // Draw Falling Gifts
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

      // Blit Animal Character Balls (Panda, Cat, Puppy) using real assets
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
        height: 54,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        borderBottom: `1px solid ${Colors.border}`,
        backgroundColor: Colors.bg.elevated,
      }}>
        {/* Clickable Title: Brick Wall Peeker + "Brick Smash × SecureBox" Font */}
        <div
          onClick={() => setIsFeaturesOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: 8,
            transition: 'background-color 0.15s ease',
          }}
          title="Click to discover all SecureBox features"
        >
          {/* Brick wall with panda peeking behind it */}
          <BrickWallPeeker width={34} height={28} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1 }}>
            <span
              style={{
                fontFamily: "'Silkscreen', 'Press Start 2P', monospace",
                fontSize: 12,
                fontWeight: 700,
                color: Colors.accent.primary,
                letterSpacing: '0.04em',
              }}
            >
              BRICK SMASH
            </span>
            <span style={{ fontSize: 11, color: Colors.text.placeholder, fontWeight: 300 }}>×</span>
            <span
              style={{
                fontFamily: "'Space Grotesk', -apple-system, sans-serif",
                fontSize: 13,
                fontWeight: 700,
                color: Colors.text.primary,
                letterSpacing: '-0.2px',
              }}
            >
              SecureBox
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '2px 5px',
                borderRadius: 4,
                backgroundColor: 'rgba(217, 119, 87, 0.12)',
                color: Colors.accent.primary,
                letterSpacing: '0.04em',
                marginLeft: 2,
              }}
            >
              INFO
            </span>
          </div>
        </div>

        {/* Right Controls: Sound Toggle, Animal Companion Badge, PIN Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Sound On / Off Icon */}
          <button
            onClick={toggleSound}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              backgroundColor: isMuted ? Colors.bg.secondary : 'rgba(217, 119, 87, 0.1)',
              border: `1px solid ${isMuted ? Colors.border : 'rgba(217, 119, 87, 0.3)'}`,
              color: isMuted ? Colors.text.placeholder : Colors.accent.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title={isMuted ? 'Turn Sound ON' : 'Turn Sound OFF'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {/* Animal companion icon with direct unread message notification badge */}
          <div
            onClick={onUnlockClick}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              border: `1.5px solid ${Colors.border}`,
              padding: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              cursor: 'pointer',
            }}
            title="Secret Vault / Open Chat"
          >
            <img
              src="/characters/panda-idle.png"
              alt="Companion"
              style={{
                width: 25,
                height: 25,
                borderRadius: '50%',
                objectFit: 'contain',
              }}
            />

            {/* Notification Badge Dot */}
            <span
              className={unreadCount > 0 ? 'char-badge-pulse' : undefined}
              style={{
                position: 'absolute',
                top: -3,
                right: -5,
                minWidth: 17,
                height: 17,
                borderRadius: 9,
                backgroundColor: unreadCount > 0 ? '#E53E3E' : Colors.bg.secondary,
                color: unreadCount > 0 ? '#FFFFFF' : Colors.text.placeholder,
                fontSize: 9.5,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
                border: unreadCount > 0 ? '2px solid #FFFFFF' : `1.5px solid ${Colors.border}`,
                boxShadow: unreadCount > 0 ? '0 0 0 1.5px rgba(229, 62, 62, 0.4)' : 'none',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </div>

          {/* Discreet PIN trigger */}
          <button
            onClick={onUnlockClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 11px',
              borderRadius: 8,
              backgroundColor: Colors.bg.secondary,
              border: `1px solid ${Colors.border}`,
              color: Colors.accent.primary,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Security PIN"
          >
            <Lock size={13} color={Colors.accent.primary} />
            <span>PIN</span>
          </button>
        </div>
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
        padding: '10px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 12,
        color: Colors.text.placeholder,
        borderTop: `1px solid ${Colors.border}`,
        backgroundColor: Colors.bg.elevated,
      }}>
        <span>Drag to move paddle</span>
        <span style={{ fontSize: 11, opacity: 0.85 }}>💣 Bombs Blast 25% • Assets Active</span>
      </div>

      {/* Complete SecureBox Features Information Modal */}
      <FeaturesModal
        isOpen={isFeaturesOpen}
        onClose={() => setIsFeaturesOpen(false)}
        onOpenVault={onUnlockClick}
      />
    </div>
  );
};
