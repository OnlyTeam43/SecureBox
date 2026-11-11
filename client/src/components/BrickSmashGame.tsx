// client/src/components/BrickSmashGame.tsx
// High-Performance 60-120 FPS Arcade Game Disguise
// Native vector character graphics (Panda, Cat, Puppy) with zero emojis
// Manual level progression (NO auto-start), Speed Controller, Sound toggle & SecureBox Gateway

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Colors, BrickRowColors } from '../theme/tokens';
import { Lock, Volume2, VolumeX, Zap, Trophy, RotateCcw, ArrowRight, UploadCloud, Menu, X, ChevronRight, ShieldCheck } from 'lucide-react';
import { BrickWallPeeker } from './BrickWallPeeker';

interface BrickSmashGameProps {
  onUnlockClick: () => void;
  unreadCount?: number;
  onOpenSecureboxPage?: () => void;
  onOpenQuickDrop?: () => void;
}

type AnimalType = 'panda' | 'cat' | 'puppy';
type GiftType = 'multiball' | 'points' | 'heart' | 'wide';
type GamePlayState = 'ready' | 'playing' | 'cleared' | 'over';

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

const SPEED_OPTIONS = [0.8, 1.0, 1.3, 1.6];

export const BrickSmashGame: React.FC<BrickSmashGameProps> = ({
  onUnlockClick,
  unreadCount = 0,
  onOpenSecureboxPage,
  onOpenQuickDrop,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // High-level React game states for clean UI overlays
  const [gameState, setGameState] = useState<GamePlayState>('ready');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [levelDisplay, setLevelDisplay] = useState(1);
  const [scoreDisplay, setScoreDisplay] = useState(0);

  // Speed multiplier state
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(() => {
    const saved = localStorage.getItem('brick_smash_speed_mult');
    return saved ? parseFloat(saved) || 1.0 : 1.0;
  });
  const speedMultRef = useRef(speedMultiplier);
  speedMultRef.current = speedMultiplier;

  // Sound toggle state
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('brick_smash_sound_muted') === 'true';
  });
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Engine control bridge refs
  const serveBallRef = useRef<(() => void) | null>(null);
  const nextLevelRef = useRef<(() => void) | null>(null);
  const restartGameRef = useRef<(() => void) | null>(null);
  const adjustBallSpeedRef = useRef<((multiplier: number) => void) | null>(null);

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

  const playLevelWinChime = () => {
    if (isMutedRef.current) return;
    playTone(523, 0.08, 'sine');
    setTimeout(() => playTone(659, 0.08, 'sine'), 80);
    setTimeout(() => playTone(784, 0.08, 'sine'), 160);
    setTimeout(() => playTone(1046, 0.16, 'triangle'), 240);
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

  const cycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(speedMultiplier);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    const next = SPEED_OPTIONS[nextIndex];
    setSpeedMultiplier(next);
    speedMultRef.current = next;
    localStorage.setItem('brick_smash_speed_mult', String(next));
    if (adjustBallSpeedRef.current) {
      adjustBallSpeedRef.current(next);
    }
  };

  // Main game initialization & physics lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // ─────────────────────────────────────────────────────────────
    // 1. PRE-RENDER CRISP NATIVE VECTOR SPRITES (NO EMOJIS, HIGH-DPI)
    // ─────────────────────────────────────────────────────────────
    const SPRITE_SIZE = 96; // 3x resolution for razor-sharp vector rendering

    const makeOffscreen = (sw = SPRITE_SIZE, sh = SPRITE_SIZE) => {
      const off = document.createElement('canvas');
      off.width = sw;
      off.height = sh;
      return off;
    };

    // --- Vector Panda Sprite ---
    const pandaCanvas = makeOffscreen();
    {
      const pCtx = pandaCanvas.getContext('2d');
      if (pCtx) {
        const cx = SPRITE_SIZE / 2;
        const cy = SPRITE_SIZE / 2;
        const r = SPRITE_SIZE * 0.38;

        // Ears
        pCtx.fillStyle = '#2C2C2A';
        pCtx.beginPath();
        pCtx.arc(cx - r * 0.72, cy - r * 0.72, r * 0.36, 0, Math.PI * 2);
        pCtx.arc(cx + r * 0.72, cy - r * 0.72, r * 0.36, 0, Math.PI * 2);
        pCtx.fill();

        // Head Base
        pCtx.fillStyle = '#FFFFFF';
        pCtx.beginPath();
        pCtx.arc(cx, cy, r, 0, Math.PI * 2);
        pCtx.fill();
        pCtx.strokeStyle = '#2C2C2A';
        pCtx.lineWidth = 2.4;
        pCtx.stroke();

        // Eye Patches
        pCtx.save();
        pCtx.fillStyle = '#2C2C2A';
        pCtx.translate(cx - r * 0.38, cy - r * 0.1);
        pCtx.rotate(0.32);
        pCtx.beginPath();
        (pCtx as any).ellipse
          ? (pCtx as any).ellipse(0, 0, r * 0.22, r * 0.28, 0, 0, Math.PI * 2)
          : pCtx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
        pCtx.fill();
        pCtx.restore();

        pCtx.save();
        pCtx.fillStyle = '#2C2C2A';
        pCtx.translate(cx + r * 0.38, cy - r * 0.1);
        pCtx.rotate(-0.32);
        pCtx.beginPath();
        (pCtx as any).ellipse
          ? (pCtx as any).ellipse(0, 0, r * 0.22, r * 0.28, 0, 0, Math.PI * 2)
          : pCtx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
        pCtx.fill();
        pCtx.restore();

        // White specular eye glints
        pCtx.fillStyle = '#FFFFFF';
        pCtx.beginPath();
        pCtx.arc(cx - r * 0.36, cy - r * 0.14, r * 0.08, 0, Math.PI * 2);
        pCtx.arc(cx + r * 0.36, cy - r * 0.14, r * 0.08, 0, Math.PI * 2);
        pCtx.fill();

        // Cute blush cheeks
        pCtx.fillStyle = '#F4C0D1';
        pCtx.beginPath();
        pCtx.arc(cx - r * 0.65, cy + r * 0.24, r * 0.13, 0, Math.PI * 2);
        pCtx.arc(cx + r * 0.65, cy + r * 0.24, r * 0.13, 0, Math.PI * 2);
        pCtx.fill();

        // Snout Nose
        pCtx.fillStyle = '#2C2C2A';
        pCtx.beginPath();
        pCtx.arc(cx, cy + r * 0.16, r * 0.14, 0, Math.PI * 2);
        pCtx.fill();

        // Smile
        pCtx.strokeStyle = '#2C2C2A';
        pCtx.lineWidth = 1.8;
        pCtx.beginPath();
        pCtx.arc(cx, cy + r * 0.24, r * 0.18, 0.15 * Math.PI, 0.85 * Math.PI);
        pCtx.stroke();

        // 3D Glass Sheen
        const sheen = pCtx.createLinearGradient(cx, cy - r, cx, cy);
        sheen.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
        sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
        pCtx.fillStyle = sheen;
        pCtx.beginPath();
        pCtx.arc(cx, cy, r - 2, Math.PI * 1.15, Math.PI * 1.85);
        pCtx.lineTo(cx, cy);
        pCtx.closePath();
        pCtx.fill();
      }
    }

    // --- Vector Cat Sprite ---
    const catCanvas = makeOffscreen();
    {
      const cCtx = catCanvas.getContext('2d');
      if (cCtx) {
        const cx = SPRITE_SIZE / 2;
        const cy = SPRITE_SIZE / 2;
        const r = SPRITE_SIZE * 0.38;

        // Cat Ears
        cCtx.fillStyle = '#FAC775';
        cCtx.strokeStyle = '#854F0B';
        cCtx.lineWidth = 2.4;
        cCtx.beginPath();
        cCtx.moveTo(cx - r * 0.8, cy - r * 0.3);
        cCtx.lineTo(cx - r * 0.65, cy - r * 1.05);
        cCtx.lineTo(cx - r * 0.05, cy - r * 0.65);
        cCtx.closePath();
        cCtx.fill();
        cCtx.stroke();

        cCtx.beginPath();
        cCtx.moveTo(cx + r * 0.8, cy - r * 0.3);
        cCtx.lineTo(cx + r * 0.65, cy - r * 1.05);
        cCtx.lineTo(cx + r * 0.05, cy - r * 0.65);
        cCtx.closePath();
        cCtx.fill();
        cCtx.stroke();

        // Inner ears
        cCtx.fillStyle = '#F4A56C';
        cCtx.beginPath();
        cCtx.moveTo(cx - r * 0.68, cy - r * 0.4);
        cCtx.lineTo(cx - r * 0.6, cy - r * 0.9);
        cCtx.lineTo(cx - r * 0.15, cy - r * 0.65);
        cCtx.closePath();
        cCtx.fill();

        cCtx.beginPath();
        cCtx.moveTo(cx + r * 0.68, cy - r * 0.4);
        cCtx.lineTo(cx + r * 0.6, cy - r * 0.9);
        cCtx.lineTo(cx + r * 0.15, cy - r * 0.65);
        cCtx.closePath();
        cCtx.fill();

        // Head Base
        cCtx.fillStyle = '#FAC775';
        cCtx.beginPath();
        cCtx.arc(cx, cy, r, 0, Math.PI * 2);
        cCtx.fill();
        cCtx.strokeStyle = '#854F0B';
        cCtx.lineWidth = 2.4;
        cCtx.stroke();

        // Whiskers
        cCtx.strokeStyle = '#854F0B';
        cCtx.lineWidth = 1.4;
        cCtx.beginPath();
        cCtx.moveTo(cx - r * 0.9, cy + r * 0.1);
        cCtx.lineTo(cx - r * 0.35, cy + r * 0.15);
        cCtx.moveTo(cx - r * 0.9, cy + r * 0.3);
        cCtx.lineTo(cx - r * 0.35, cy + r * 0.25);
        cCtx.moveTo(cx + r * 0.9, cy + r * 0.1);
        cCtx.lineTo(cx + r * 0.35, cy + r * 0.15);
        cCtx.moveTo(cx + r * 0.9, cy + r * 0.3);
        cCtx.lineTo(cx + r * 0.35, cy + r * 0.25);
        cCtx.stroke();

        // Cheeks
        cCtx.fillStyle = '#F4C0D1';
        cCtx.beginPath();
        cCtx.arc(cx - r * 0.6, cy + r * 0.2, r * 0.12, 0, Math.PI * 2);
        cCtx.arc(cx + r * 0.6, cy + r * 0.2, r * 0.12, 0, Math.PI * 2);
        cCtx.fill();

        // Eyes
        cCtx.fillStyle = '#412402';
        cCtx.beginPath();
        cCtx.arc(cx - r * 0.35, cy - r * 0.08, r * 0.12, 0, Math.PI * 2);
        cCtx.arc(cx + r * 0.35, cy - r * 0.08, r * 0.12, 0, Math.PI * 2);
        cCtx.fill();

        cCtx.fillStyle = '#FFFFFF';
        cCtx.beginPath();
        cCtx.arc(cx - r * 0.32, cy - r * 0.12, r * 0.045, 0, Math.PI * 2);
        cCtx.arc(cx + r * 0.38, cy - r * 0.12, r * 0.045, 0, Math.PI * 2);
        cCtx.fill();

        // Nose & Mouth
        cCtx.fillStyle = '#D4537E';
        cCtx.beginPath();
        cCtx.moveTo(cx - r * 0.1, cy + r * 0.15);
        cCtx.lineTo(cx + r * 0.1, cy + r * 0.15);
        cCtx.lineTo(cx, cy + r * 0.25);
        cCtx.closePath();
        cCtx.fill();
      }
    }

    // --- Vector Puppy Sprite ---
    const puppyCanvas = makeOffscreen();
    {
      const uCtx = puppyCanvas.getContext('2d');
      if (uCtx) {
        const cx = SPRITE_SIZE / 2;
        const cy = SPRITE_SIZE / 2;
        const r = SPRITE_SIZE * 0.38;

        // Floppy Ears
        uCtx.fillStyle = '#854F0B';
        uCtx.save();
        uCtx.translate(cx - r * 0.85, cy - r * 0.1);
        uCtx.rotate(0.25);
        uCtx.beginPath();
        (uCtx as any).ellipse
          ? (uCtx as any).ellipse(0, 0, r * 0.3, r * 0.6, 0, 0, Math.PI * 2)
          : uCtx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
        uCtx.fill();
        uCtx.restore();

        uCtx.save();
        uCtx.translate(cx + r * 0.85, cy - r * 0.1);
        uCtx.rotate(-0.25);
        uCtx.beginPath();
        (uCtx as any).ellipse
          ? (uCtx as any).ellipse(0, 0, r * 0.3, r * 0.6, 0, 0, Math.PI * 2)
          : uCtx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
        uCtx.fill();
        uCtx.restore();

        // Head Base
        uCtx.fillStyle = '#F5C4B3';
        uCtx.beginPath();
        uCtx.arc(cx, cy, r, 0, Math.PI * 2);
        uCtx.fill();
        uCtx.strokeStyle = '#993C1D';
        uCtx.lineWidth = 2.4;
        uCtx.stroke();

        // Muzzle
        uCtx.fillStyle = '#FAECE7';
        uCtx.beginPath();
        (uCtx as any).ellipse
          ? (uCtx as any).ellipse(cx, cy + r * 0.3, r * 0.45, r * 0.32, 0, 0, Math.PI * 2)
          : uCtx.arc(cx, cy + r * 0.3, r * 0.35, 0, Math.PI * 2);
        uCtx.fill();

        // Cheeks
        uCtx.fillStyle = '#F4C0D1';
        uCtx.beginPath();
        uCtx.arc(cx - r * 0.58, cy + r * 0.18, r * 0.11, 0, Math.PI * 2);
        uCtx.arc(cx + r * 0.58, cy + r * 0.18, r * 0.11, 0, Math.PI * 2);
        uCtx.fill();

        // Eyes
        uCtx.fillStyle = '#2C2C2A';
        uCtx.beginPath();
        uCtx.arc(cx - r * 0.34, cy - r * 0.12, r * 0.11, 0, Math.PI * 2);
        uCtx.arc(cx + r * 0.34, cy - r * 0.12, r * 0.11, 0, Math.PI * 2);
        uCtx.fill();

        uCtx.fillStyle = '#FFFFFF';
        uCtx.beginPath();
        uCtx.arc(cx - r * 0.31, cy - r * 0.16, r * 0.045, 0, Math.PI * 2);
        uCtx.arc(cx + r * 0.37, cy - r * 0.16, r * 0.045, 0, Math.PI * 2);
        uCtx.fill();

        // Nose
        uCtx.fillStyle = '#2C2C2A';
        uCtx.beginPath();
        uCtx.arc(cx, cy + r * 0.18, r * 0.13, 0, Math.PI * 2);
        uCtx.fill();
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. VECTOR GIFT CAPSULES (NO EMOJIS)
    // ─────────────────────────────────────────────────────────────
    const giftSprites: Record<GiftType, { canvas: HTMLCanvasElement; label: string; color: string }> = {
      multiball: { canvas: makeOffscreen(44, 22), label: 'TRIPLE BALL!', color: '#D97757' },
      points: { canvas: makeOffscreen(44, 22), label: '+100 POINTS!', color: '#F59E0B' },
      heart: { canvas: makeOffscreen(44, 22), label: '+1 EXTRA LIFE!', color: '#EF4444' },
      wide: { canvas: makeOffscreen(44, 22), label: 'WIDE PADDLE!', color: '#10B981' },
    };

    Object.entries(giftSprites).forEach(([key, meta]) => {
      const gCtx = meta.canvas.getContext('2d');
      if (gCtx) {
        const type = key as GiftType;
        gCtx.clearRect(0, 0, 44, 22);

        // Capsule Body
        gCtx.fillStyle = '#1E1E1C';
        gCtx.beginPath();
        (gCtx as any).roundRect ? (gCtx as any).roundRect(2, 2, 40, 18, 9) : gCtx.rect(2, 2, 40, 18);
        gCtx.fill();

        gCtx.strokeStyle = meta.color;
        gCtx.lineWidth = 1.6;
        gCtx.stroke();

        if (type === 'multiball') {
          gCtx.fillStyle = '#FFFFFF';
          gCtx.beginPath();
          gCtx.arc(14, 11, 3.2, 0, Math.PI * 2);
          gCtx.arc(22, 11, 3.2, 0, Math.PI * 2);
          gCtx.arc(30, 11, 3.2, 0, Math.PI * 2);
          gCtx.fill();
        } else if (type === 'points') {
          gCtx.fillStyle = '#F59E0B';
          gCtx.font = 'bold 10px monospace';
          gCtx.textAlign = 'center';
          gCtx.textBaseline = 'middle';
          gCtx.fillText('+100', 22, 11);
        } else if (type === 'heart') {
          // Sharp medical cross in bright crimson
          gCtx.fillStyle = '#EF4444';
          gCtx.fillRect(19, 6, 6, 10);
          gCtx.fillRect(17, 8, 10, 6);
        } else if (type === 'wide') {
          gCtx.fillStyle = '#10B981';
          gCtx.fillRect(13, 9.5, 18, 3);
          // Left arrow
          gCtx.beginPath();
          gCtx.moveTo(10, 11);
          gCtx.lineTo(13, 8);
          gCtx.lineTo(13, 14);
          gCtx.closePath();
          gCtx.fill();
          // Right arrow
          gCtx.beginPath();
          gCtx.moveTo(34, 11);
          gCtx.lineTo(31, 8);
          gCtx.lineTo(31, 14);
          gCtx.closePath();
          gCtx.fill();
        }
      }
    });

    // Helper to draw vector hearts for Lives HUD
    const drawVectorHeart = (hx: number, hy: number, size: number, filled: boolean) => {
      ctx.save();
      ctx.translate(hx, hy);
      const s = size / 24;
      ctx.translate(-12 * s, -12 * s);
      ctx.scale(s, s);

      ctx.beginPath();
      ctx.moveTo(12, 21.35);
      ctx.lineTo(10.55, 20.03);
      ctx.bezierCurveTo(5.4, 15.36, 2, 12.28, 2, 8.5);
      ctx.bezierCurveTo(2, 5.42, 4.42, 3, 7.5, 3);
      ctx.bezierCurveTo(9.24, 3, 10.91, 3.81, 12, 5.09);
      ctx.bezierCurveTo(13.09, 3.81, 14.76, 3, 16.5, 3);
      ctx.bezierCurveTo(19.58, 3, 22, 5.42, 22, 8.5);
      ctx.bezierCurveTo(22, 12.28, 18.6, 15.36, 13.45, 20.04);
      ctx.closePath();

      if (filled) {
        ctx.fillStyle = '#E53935';
        ctx.fill();
        ctx.strokeStyle = '#B91C1C';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(212, 208, 197, 0.15)';
        ctx.fill();
        ctx.strokeStyle = '#D4D0C5';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.restore();
    };

    // ─────────────────────────────────────────────────────────────
    // 3. ZERO-OVERHEAD ENGINE STATE MACHINE
    // ─────────────────────────────────────────────────────────────
    let animId: number;
    let score = 0;
    let lives = 3;
    let level = 1;
    let highScore = parseInt(localStorage.getItem('brick_smash_high_score') || '0', 10);
    let currentGameState: GamePlayState = 'ready';

    const dpr = window.devicePixelRatio || 1;
    const updateSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const w = Math.min(rect.width || 480, 520);
      const h = Math.max(480, rect.height || 640);

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      return { w, h };
    };

    let { w, h } = updateSize() || { w: 480, h: 640 };

    const getBallSpeed = (lvl: number) => {
      const base = 8.0 + Math.min((lvl - 1) * 0.35, 4.0);
      return base * speedMultRef.current;
    };

    const basePaddleWidth = Math.max(86, Math.min(108, w * 0.24));
    let paddleWidth = basePaddleWidth;
    let widePaddleTimer: NodeJS.Timeout | null = null;

    const paddle = {
      x: (w - basePaddleWidth) / 2,
      y: h - 35,
      height: 13,
    };

    // Ball definition
    const balls: Ball[] = [
      {
        x: paddle.x + paddleWidth / 2,
        y: paddle.y - 14,
        radius: 12.5,
        dx: 0,
        dy: 0,
        speed: getBallSpeed(1),
        character: 'panda',
        active: true,
      },
    ];

    let bricks: Brick[] = [];
    const gifts: Gift[] = [];
    const floatingTexts: FloatingText[] = [];
    const particles: Array<{ x: number; y: number; dx: number; dy: number; r: number; color: string; life: number }> = [];

    // Dock ball firmly on paddle
    const dockBallOnPaddle = () => {
      balls.length = 0;
      balls.push({
        x: paddle.x + paddleWidth / 2,
        y: paddle.y - 14,
        radius: 12.5,
        dx: 0,
        dy: 0,
        speed: getBallSpeed(level),
        character: 'panda',
        active: true,
      });
    };

    // Serve ball on user command (tap / drag / space)
    const serveBall = () => {
      if (currentGameState !== 'ready') return;
      initAudio();
      const primary = balls[0];
      if (!primary) return;

      const angle = Math.PI / 4 + (Math.random() * Math.PI) / 2;
      const speed = getBallSpeed(level);
      primary.dx = Math.cos(angle) * (Math.random() > 0.5 ? speed : -speed);
      primary.dy = -Math.abs(Math.sin(angle) * speed);
      primary.active = true;

      currentGameState = 'playing';
      setGameState('playing');
      playTone(440, 0.08, 'sine');
    };
    serveBallRef.current = serveBall;

    // Advance to next level — strictly manual on user trigger!
    const advanceNextLevel = () => {
      level++;
      setLevelDisplay(level);
      initBricks();
      dockBallOnPaddle();
      gifts.length = 0;
      floatingTexts.length = 0;
      paddleWidth = basePaddleWidth;

      currentGameState = 'ready';
      setGameState('ready');
      playTone(520, 0.1, 'sine');
    };
    nextLevelRef.current = advanceNextLevel;

    // Restart game from Level 1
    const restartGame = () => {
      score = 0;
      lives = 3;
      level = 1;
      setLevelDisplay(1);
      setScoreDisplay(0);

      initBricks();
      dockBallOnPaddle();
      gifts.length = 0;
      floatingTexts.length = 0;
      paddleWidth = basePaddleWidth;

      currentGameState = 'ready';
      setGameState('ready');
      playTone(400, 0.1, 'sine');
    };
    restartGameRef.current = restartGame;

    // Adjust in-flight ball speed on speed button click
    adjustBallSpeedRef.current = (newMult: number) => {
      floatingTexts.push({
        x: paddle.x + paddleWidth / 2,
        y: paddle.y - 12,
        text: `SPEED: ${newMult}x`,
        color: '#E05A38',
        alpha: 1.0,
      });

      const targetSpeed = getBallSpeed(level);
      balls.forEach((b) => {
        if (!b.active || (b.dx === 0 && b.dy === 0)) return;
        const currentMag = Math.hypot(b.dx, b.dy) || 1;
        b.dx = (b.dx / currentMag) * targetSpeed;
        b.dy = (b.dy / currentMag) * targetSpeed;
        b.speed = targetSpeed;
      });
    };

    // Brick generation
    const initBricks = () => {
      const cols = Math.floor(Math.min(10, (w - 20) / 42));
      const brickWidth = Math.floor((w - 20 - (cols - 1) * 4) / cols);
      const brickHeight = 12;
      const startY = 60;
      const numRows = Math.min(8, 5 + Math.min(level - 1, 3));
      bricks = [];

      const totalBricks = numRows * cols;
      const bombIndices = new Set<number>();
      const bombTargetCount = Math.max(3, Math.min(5, Math.floor(totalBricks * 0.06)));
      let attempts = 0;
      while (bombIndices.size < bombTargetCount && attempts < 100) {
        attempts++;
        const r = 1 + Math.floor(Math.random() * Math.max(1, numRows - 2));
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
        x: bx - 22,
        y: by,
        width: 44,
        height: 22,
        vy: 2.8,
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
        setScoreDisplay(score);
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

    // Detonate 25% of bricks when bomb shatters
    const triggerBombBlast = (bombBrick: Brick) => {
      playBombExplosion();
      const aliveBricks = bricks.filter((b) => b.alive && b !== bombBrick);
      const shatterCount = Math.max(1, Math.floor(aliveBricks.length * 0.25));

      aliveBricks.sort((a, b) => {
        const da = Math.hypot(a.x - bombBrick.x, a.y - bombBrick.y);
        const db = Math.hypot(b.x - bombBrick.x, b.y - bombBrick.y);
        return da - db;
      });

      const toShatter = aliveBricks.slice(0, shatterCount);
      toShatter.forEach((bk) => {
        bk.alive = false;
        score += bk.pts;
        for (let p = 0; p < 4; p++) {
          particles.push({
            x: bk.x + bk.width / 2,
            y: bk.y + bk.height / 2,
            dx: (Math.random() - 0.5) * 6,
            dy: (Math.random() - 0.5) * 6,
            r: 2.2,
            color: bk.color,
            life: 1.0,
          });
        }
      });

      setScoreDisplay(score);

      floatingTexts.push({
        x: bombBrick.x + bombBrick.width / 2,
        y: bombBrick.y - 15,
        text: `BOOM! -${shatterCount} BRICKS (25%)`,
        color: '#EF4444',
        alpha: 1.0,
      });
    };

    // Initialize board
    initBricks();
    dockBallOnPaddle();

    // ─────────────────────────────────────────────────────────────
    // 4. INSTANT POINTER & DRAG CONTROLS
    // ─────────────────────────────────────────────────────────────
    let isPointerDown = false;

    const updatePaddlePos = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      const pointerX = clientX - rect.left;
      paddle.x = Math.max(0, Math.min(w - paddleWidth, pointerX - paddleWidth / 2));

      // In ready mode, dock the ball so it smoothly tracks paddle center
      if (currentGameState === 'ready' && balls.length > 0) {
        balls[0].x = paddle.x + paddleWidth / 2;
        balls[0].y = paddle.y - 14;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      initAudio();
      isPointerDown = true;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
      updatePaddlePos(e.clientX);

      if (currentGameState === 'ready') {
        serveBall();
      }
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
        if (currentGameState === 'ready' && balls.length > 0) {
          balls[0].x = paddle.x + paddleWidth / 2;
        }
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        paddle.x = Math.min(w - paddleWidth, paddle.x + 26);
        if (currentGameState === 'ready' && balls.length > 0) {
          balls[0].x = paddle.x + paddleWidth / 2;
        }
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (currentGameState === 'ready') {
          serveBall();
        } else if (currentGameState === 'cleared') {
          advanceNextLevel();
        } else if (currentGameState === 'over') {
          restartGame();
        }
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
    canvas.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('pointerup', onPointerUp, { passive: true });
    canvas.addEventListener('pointercancel', onPointerUp, { passive: true });
    window.addEventListener('keydown', onKeyDown);

    // ─────────────────────────────────────────────────────────────
    // 5. PHYSICS LOOP
    // ─────────────────────────────────────────────────────────────
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      animId = requestAnimationFrame(loop);

      try {
        const elapsed = currentTime - lastTime;
        lastTime = currentTime;
        const dt = Math.min(elapsed / 16.667, 1.8);

        if (currentGameState === 'playing') {
          // Update active balls
          for (let i = balls.length - 1; i >= 0; i--) {
            const b = balls[i];
            if (!b.active) continue;

            b.x += b.dx * dt;
            b.y += b.dy * dt;

            // Walls collision
            if (b.x - b.radius <= 0) {
              b.x = b.radius;
              b.dx = Math.abs(b.dx);
              playTone(280, 0.04, 'sine');
            } else if (b.x + b.radius >= w) {
              b.x = w - b.radius;
              b.dx = -Math.abs(b.dx);
              playTone(280, 0.04, 'sine');
            }

            // Top boundary
            if (b.y - b.radius <= 44) {
              b.y = 44 + b.radius;
              b.dy = Math.abs(b.dy);
              playTone(320, 0.04, 'sine');
            }

            // Paddle bounce
            if (
              b.dy > 0 &&
              b.y + b.radius >= paddle.y &&
              b.y - b.radius <= paddle.y + paddle.height &&
              b.x >= paddle.x - b.radius * 0.5 &&
              b.x <= paddle.x + paddleWidth + b.radius * 0.5
            ) {
              b.y = paddle.y - b.radius;
              const hitOffset = (b.x - (paddle.x + paddleWidth / 2)) / (paddleWidth / 2);
              const maxAngle = (Math.PI / 3) * 0.9;
              const bounceAngle = hitOffset * maxAngle;
              const currentSpeed = Math.hypot(b.dx, b.dy) || getBallSpeed(level);

              b.dx = currentSpeed * Math.sin(bounceAngle);
              b.dy = -currentSpeed * Math.cos(bounceAngle);

              playTone(360 + Math.abs(hitOffset) * 120, 0.05, 'triangle');
            }

            // Bricks collision
            for (let k = 0; k < bricks.length; k++) {
              const bk = bricks[k];
              if (!bk.alive) continue;

              if (
                b.x + b.radius > bk.x &&
                b.x - b.radius < bk.x + bk.width &&
                b.y + b.radius > bk.y &&
                b.y - b.radius < bk.y + bk.height
              ) {
                const prevX = b.x - b.dx * dt;
                const prevY = b.y - b.dy * dt;

                if (prevX + b.radius <= bk.x || prevX - b.radius >= bk.x + bk.width) {
                  b.dx = -b.dx;
                } else {
                  b.dy = -b.dy;
                }

                if (bk.isBomb) {
                  bk.bombHitCount = (bk.bombHitCount || 2) - 1;
                  playTone(480, 0.06, 'sawtooth');

                  if (bk.bombHitCount <= 0) {
                    bk.alive = false;
                    score += bk.pts;
                    setScoreDisplay(score);
                    triggerBombBlast(bk);
                  }
                } else {
                  bk.alive = false;
                  score += bk.pts;
                  setScoreDisplay(score);
                  playTone(420 + (bk.pts / 10) * 15, 0.05, 'sine');
                  spawnGift(bk.x + bk.width / 2, bk.y + bk.height);
                }

                if (score > highScore) {
                  highScore = score;
                  localStorage.setItem('brick_smash_high_score', highScore.toString());
                }

                break;
              }
            }

            // Ball fell off screen
            if (b.y - b.radius > h) {
              b.active = false;
            }
          }

          // Check if all balls were lost
          const activeBalls = balls.filter((b) => b && b.active);
          if (activeBalls.length === 0) {
            lives--;
            playTone(180, 0.22, 'sawtooth');

            if (lives <= 0) {
              currentGameState = 'over';
              setGameState('over');
            } else {
              dockBallOnPaddle();
              currentGameState = 'ready';
              setGameState('ready');
            }
          }

          // ── CHECK LEVEL CLEARED ──
          const remainingAlive = bricks.filter((bk) => bk.alive).length;
          if (remainingAlive === 0 && currentGameState === 'playing') {
            currentGameState = 'cleared';
            setGameState('cleared');
            playLevelWinChime();

            // Calculate level bonus
            const bonus = 200 * level;
            score += bonus;
            setScoreDisplay(score);
            if (score > highScore) {
              highScore = score;
              localStorage.setItem('brick_smash_high_score', highScore.toString());
            }

            gifts.length = 0;
            // HALT balls — NO AUTO-START! Waits for user tap!
            dockBallOnPaddle();
          }

          // Update falling gifts
          for (let i = gifts.length - 1; i >= 0; i--) {
            const g = gifts[i];
            if (!g || !g.active) continue;

            g.y += g.vy * dt;

            if (
              g.y + g.height >= paddle.y &&
              g.y <= paddle.y + paddle.height &&
              g.x + g.width >= paddle.x &&
              g.x <= paddle.x + paddleWidth
            ) {
              g.active = false;
              applyGift(g);
              continue;
            }

            if (g.y > h) {
              g.active = false;
            }
          }

          // Update floating texts
          for (let i = floatingTexts.length - 1; i >= 0; i--) {
            const ft = floatingTexts[i];
            ft.y -= 0.8 * dt;
            ft.alpha -= 0.02 * dt;
            if (ft.alpha <= 0) floatingTexts.splice(i, 1);
          }

          // Update particles
          for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.dx * dt;
            p.y += p.dy * dt;
            p.life -= 0.045 * dt;
            if (p.life <= 0) particles.splice(i, 1);
          }
        }

        // ─────────────────────────────────────────────────────────────
        // 6. CRISP CANVAS RENDERING (100% VECTOR, ZERO EMOJIS)
        // ─────────────────────────────────────────────────────────────
        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = '#FAF9F5';
        ctx.fillRect(0, 0, w, h);

        // Subtle arcade grid
        ctx.strokeStyle = 'rgba(20, 20, 19, 0.04)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 32) {
          ctx.beginPath();
          ctx.moveTo(x, 44);
          ctx.lineTo(x, h);
          ctx.stroke();
        }

        // Top HUD Bar
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, 44);
        ctx.strokeStyle = 'rgba(20, 20, 19, 0.08)';
        ctx.beginPath();
        ctx.moveTo(0, 44);
        ctx.lineTo(w, 44);
        ctx.stroke();

        ctx.fillStyle = '#E05A38';
        ctx.font = '700 12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`LVL ${level}`, 14, 26);

        ctx.fillStyle = '#141413';
        ctx.font = '600 13px -apple-system, sans-serif';
        ctx.fillText(`SCORE: ${score}`, 68, 26);

        ctx.fillStyle = '#87867F';
        ctx.textAlign = 'center';
        ctx.fillText(`BEST: ${highScore}`, w / 2, 26);

        // Render 3 Crisp Vector Hearts for Lives (NO text emojis)
        for (let i = 0; i < 3; i++) {
          const heartX = w - 16 - (2 - i) * 19;
          const heartY = 24;
          drawVectorHeart(heartX, heartY, 14, i < lives);
        }

        // Render Bricks
        for (const b of bricks) {
          if (!b.alive) continue;

          if (b.isBomb) {
            // Explosive bomb brick with dark plate & glowing warning border
            ctx.fillStyle = '#1E1614';
            ctx.beginPath();
            (ctx as any).roundRect ? (ctx as any).roundRect(b.x, b.y, b.width, b.height, 3) : ctx.rect(b.x, b.y, b.width, b.height);
            ctx.fill();

            ctx.strokeStyle = b.bombHitCount === 1 ? '#EF4444' : '#F97316';
            ctx.lineWidth = 1.4;
            ctx.stroke();

            // Vector Bomb Capsule (Sphere + Fuse Spark + Counter Pill)
            const bx = b.x + b.width / 2;
            const by = b.y + b.height / 2;

            // Bomb body
            ctx.fillStyle = '#141413';
            ctx.beginPath();
            ctx.arc(bx - 6, by + 0.5, 4.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#D6D3D1';
            ctx.lineWidth = 0.8;
            ctx.stroke();

            // Spark
            ctx.strokeStyle = '#F59E0B';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(bx - 6, by - 3.5);
            ctx.lineTo(bx - 4.5, by - 5.5);
            ctx.stroke();

            // Counter Badge
            ctx.fillStyle = b.bombHitCount === 1 ? '#EF4444' : '#EA580C';
            ctx.beginPath();
            (ctx as any).roundRect ? (ctx as any).roundRect(bx + 1, by - 4.5, 9, 9, 2.5) : ctx.rect(bx + 1, by - 4.5, 9, 9);
            ctx.fill();

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${b.bombHitCount}`, bx + 5.5, by);
          } else {
            // Regular Brick
            ctx.fillStyle = b.color;
            ctx.beginPath();
            (ctx as any).roundRect ? (ctx as any).roundRect(b.x, b.y, b.width, b.height, 3) : ctx.rect(b.x, b.y, b.width, b.height);
            ctx.fill();

            ctx.strokeStyle = b.border;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Subtle 3D top shine
            ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
            ctx.fillRect(b.x + 1, b.y + 1, b.width - 2, 2.5);
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

        // Falling Gifts
        for (const g of gifts) {
          if (!g.active) continue;
          const spr = giftSprites[g.type];
          if (spr) {
            ctx.drawImage(spr.canvas, g.x, g.y, g.width, g.height);
          }
        }

        // Floating texts
        for (const ft of floatingTexts) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, ft.alpha);
          ctx.fillStyle = ft.color;
          ctx.font = 'bold 12px -apple-system, sans-serif';
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

        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(paddle.x + 4, paddle.y + 2, paddleWidth - 8, 2.5);

        // Razor-sharp Vector Character Balls (Panda, Cat, Puppy)
        for (const b of balls) {
          if (!b.active) continue;
          const sCanvas = b.character === 'cat' ? catCanvas : b.character === 'puppy' ? puppyCanvas : pandaCanvas;
          const size = b.radius * 2;
          ctx.drawImage(sCanvas, b.x - b.radius, b.y - b.radius, size, size);
        }
      } catch (err) {
        console.error('Physics loop error caught:', err);
      }
    };

    const handleResize = () => {
      const size = updateSize();
      if (size) {
        w = size.w;
        h = size.h;
        paddle.y = h - 35;
        if (currentGameState === 'ready') {
          balls.forEach((b) => {
            b.x = paddle.x + paddleWidth / 2;
            b.y = paddle.y - 14;
          });
        }
      }
    };
    window.addEventListener('resize', handleResize);
    const initialResizeTimer = setTimeout(handleResize, 80);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
      ro = new ResizeObserver(() => handleResize());
      ro.observe(canvas.parentElement);
    }

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      clearTimeout(initialResizeTimer);
      if (ro) ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      if (widePaddleTimer) clearTimeout(widePaddleTimer);
    };
  }, []);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.bg.primary,
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ─── Arcade Top Bar ─────────────────────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          height: 48,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 12px',
          borderBottom: `1px solid ${Colors.border}`,
          backgroundColor: Colors.bg.elevated,
          zIndex: 15,
        }}
      >
        {/* Clickable Title: Brick Wall Peeker + "Brick Smash × SecureBox" Font */}
        <div
          onClick={() => {
            if (onOpenSecureboxPage) {
              onOpenSecureboxPage();
            } else {
              window.history.pushState(null, '', '/Securebox');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: 8,
            transition: 'background-color 0.15s ease',
          }}
          title="SecureBox — Click to explore features and download APK"
        >
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
          </div>
        </div>

        {/* Right Controls: QuickDrop, PIN, and Hamburger Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          {/* QuickDrop Media Shuttle Button (Kept out on header) */}
          {onOpenQuickDrop && (
            <button
              onClick={onOpenQuickDrop}
              style={{
                padding: '5px 9px',
                borderRadius: 8,
                border: `1px solid ${Colors.border}`,
                backgroundColor: 'rgba(217, 119, 87, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
                color: Colors.accent.primary,
                fontSize: 11,
                fontWeight: 700,
                transition: 'all 0.15s ease',
              }}
              title="QuickDrop — Anonymous Cross-Device Media, Links & Text Transfer"
            >
              <UploadCloud size={13} />
              <span>QuickDrop</span>
            </button>
          )}

          {/* PIN Trigger Button (Kept out on header) */}
          <button
            onClick={onUnlockClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 9px',
              borderRadius: 8,
              border: `1px solid ${Colors.border}`,
              backgroundColor: unreadCount > 0 ? Colors.accent.soft : 'transparent',
              color: unreadCount > 0 ? Colors.accent.primary : Colors.text.secondary,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.15s ease',
            }}
            title="Unlock Secret Vault / Enter PIN"
          >
            <Lock size={13} />
            <span>PIN</span>
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  minWidth: 15,
                  height: 15,
                  borderRadius: '999px',
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: 9,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                  border: '1.5px solid #FFFFFF',
                  boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Hamburger Menu Button */}
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            style={{
              padding: '5px 7px',
              borderRadius: 8,
              border: `1px solid ${isMenuOpen ? Colors.accent.primary : Colors.border}`,
              backgroundColor: isMenuOpen ? Colors.accent.soft : Colors.bg.primary,
              color: isMenuOpen ? Colors.accent.primary : Colors.text.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.15s ease',
            }}
            title={isMenuOpen ? 'Close Menu' : 'Game Options & Settings'}
          >
            {isMenuOpen ? <X size={16} /> : <Menu size={16} />}
            {unreadCount > 0 && !isMenuOpen && (
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: '#EF4444',
                }}
              />
            )}
          </button>
        </div>
      </div>

      {/* ─── Hamburger Dropdown Menu ───────────────────────────────────────── */}
      {isMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 90,
              backgroundColor: 'rgba(0, 0, 0, 0.18)',
            }}
          />

          {/* Menu Dropdown Card */}
          <div
            style={{
              position: 'absolute',
              top: 52,
              right: 12,
              zIndex: 100,
              width: 250,
              backgroundColor: Colors.bg.elevated,
              borderRadius: 14,
              border: `1px solid ${Colors.border}`,
              boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {/* Header label */}
            <div
              style={{
                padding: '4px 8px 6px',
                borderBottom: `1px solid ${Colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: Colors.text.placeholder, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Game Options
              </span>
              <button
                onClick={() => setIsMenuOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: Colors.text.placeholder,
                  padding: 2,
                  display: 'flex',
                }}
              >
                <X size={13} />
              </button>
            </div>

            {/* Unread Vault Messages Alert */}
            {unreadCount > 0 && (
              <div
                onClick={() => {
                  setIsMenuOpen(false);
                  onUnlockClick();
                }}
                style={{
                  padding: '7px 9px',
                  borderRadius: 8,
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#DC2626',
                  fontSize: 11,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span>✉ {unreadCount} New Message{unreadCount > 1 ? 's' : ''}</span>
                <span style={{ fontSize: 10, textDecoration: 'underline' }}>Unlock →</span>
              </div>
            )}

            {/* Item 1: Arcade Sound */}
            <div
              onClick={() => toggleSound()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 9px',
                borderRadius: 8,
                cursor: 'pointer',
                backgroundColor: isMuted ? 'transparent' : 'rgba(217, 119, 87, 0.08)',
                transition: 'background-color 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                {isMuted ? <VolumeX size={16} color={Colors.text.secondary} /> : <Volume2 size={16} color={Colors.accent.primary} />}
                <span style={{ fontSize: 12, fontWeight: 600, color: Colors.text.primary }}>
                  Arcade Sound
                </span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 6,
                  backgroundColor: isMuted ? Colors.bg.secondary : Colors.accent.soft,
                  color: isMuted ? Colors.text.placeholder : Colors.accent.primary,
                }}
              >
                {isMuted ? 'MUTED' : 'ON'}
              </span>
            </div>

            {/* Item 2: Ball Speed Controller */}
            <div
              onClick={() => cycleSpeed()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 9px',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <Zap size={16} color="#E05A38" />
                <span style={{ fontSize: 12, fontWeight: 600, color: Colors.text.primary }}>
                  Ball Speed
                </span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 6,
                  backgroundColor: Colors.bg.secondary,
                  color: Colors.accent.primary,
                  fontFamily: 'monospace',
                  border: `1px solid ${Colors.border}`,
                }}
              >
                {speedMultiplier}x
              </span>
            </div>

            {/* Item 3: Companion Skin */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 9px',
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <img
                  src="/characters/panda-idle.png"
                  alt="Companion"
                  style={{ width: 18, height: 18, borderRadius: '50%' }}
                />
                <span style={{ fontSize: 12, fontWeight: 600, color: Colors.text.primary }}>
                  Ball Skin
                </span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: 6,
                  backgroundColor: Colors.bg.secondary,
                  color: Colors.text.secondary,
                }}
              >
                Panda
              </span>
            </div>

            {/* Divider */}
            <div style={{ height: 1, backgroundColor: Colors.border, margin: '3px 0' }} />

            {/* Item 4: About SecureBox & APK */}
            <div
              onClick={() => {
                setIsMenuOpen(false);
                if (onOpenSecureboxPage) {
                  onOpenSecureboxPage();
                } else {
                  window.history.pushState(null, '', '/Securebox');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 9px',
                borderRadius: 8,
                cursor: 'pointer',
                backgroundColor: 'rgba(217, 107, 67, 0.05)',
                transition: 'background-color 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <ShieldCheck size={16} color={Colors.accent.primary} />
                <span style={{ fontSize: 12, fontWeight: 600, color: Colors.accent.primary }}>
                  About SecureBox & APK
                </span>
              </div>
              <ChevronRight size={14} color={Colors.accent.primary} />
            </div>
          </div>
        </>
      )}

      {/* ─── Main Game Canvas Area & Overlays ───────────────────────────────── */}
      <div
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 520,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'stretch',
          overflow: 'hidden',
          position: 'relative',
          touchAction: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            cursor: 'pointer',
            touchAction: 'none',
            display: 'block',
          }}
        />

        {/* ── READY OVERLAY (Tap to Launch Ball) ── */}
        {gameState === 'ready' && (
          <div
            onClick={() => serveBallRef.current && serveBallRef.current()}
            style={{
              position: 'absolute',
              bottom: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(20, 21, 24, 0.88)',
              color: '#FFFFFF',
              padding: '10px 22px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              zIndex: 10,
              userSelect: 'none',
              animation: 'pulse 1.8s infinite',
            }}
          >
            <Zap size={14} color="#F59E0B" />
            <span>Level {levelDisplay} • Tap to Launch Ball</span>
          </div>
        )}

        {/* ── LEVEL CLEARED OVERLAY (DOES NOT AUTO-START) ── */}
        {gameState === 'cleared' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(17, 17, 17, 0.72)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
              padding: '24px',
            }}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '24px',
                padding: '32px 28px',
                maxWidth: '340px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                border: '1px solid #E7E5E4',
              }}
            >
              {/* Clean Vector Trophy Badge */}
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#FEF3C7',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <Trophy size={28} />
              </div>

              <div
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: '14px',
                  color: '#141518',
                  marginBottom: '8px',
                }}
              >
                LEVEL {levelDisplay} CLEARED!
              </div>

              <div
                style={{
                  fontSize: '14px',
                  color: '#16A34A',
                  fontWeight: 700,
                  marginBottom: '24px',
                }}
              >
                +{200 * levelDisplay} Level Bonus
              </div>

              <button
                onClick={() => nextLevelRef.current && nextLevelRef.current()}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: '12px',
                  backgroundColor: '#D96B43',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(217, 107, 67, 0.35)',
                }}
              >
                <span>Next Level</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── GAME OVER OVERLAY ── */}
        {gameState === 'over' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(17, 17, 17, 0.72)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
              padding: '24px',
            }}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '24px',
                padding: '32px 28px',
                maxWidth: '340px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                border: '1px solid #E7E5E4',
              }}
            >
              <div
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: '14px',
                  color: '#DC2626',
                  marginBottom: '10px',
                }}
              >
                GAME OVER
              </div>

              <div
                style={{
                  fontSize: '14px',
                  color: '#57534E',
                  marginBottom: '24px',
                }}
              >
                Final Score: <strong>{scoreDisplay}</strong>
              </div>

              <button
                onClick={() => restartGameRef.current && restartGameRef.current()}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: '12px',
                  backgroundColor: '#141518',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <RotateCcw size={16} />
                <span>Play Again</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Bottom Status Bar ────────────────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          padding: '9px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          color: Colors.text.placeholder,
          borderTop: `1px solid ${Colors.border}`,
          backgroundColor: Colors.bg.elevated,
        }}
      >
        <span>Drag to move paddle</span>
        <span style={{ fontSize: 11, opacity: 0.85 }}>Bombs Detonate 25% • Vector Powerups Active</span>
      </div>
    </div>
  );
};
