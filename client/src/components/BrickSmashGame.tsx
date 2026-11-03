// client/src/components/BrickSmashGame.tsx
// High-Performance 60-120 FPS Physics Engine with 0ms React State Overhead in Game Loop
// Classic Claude Theme (#FAF9F5 Warm Ivory & #D97757 Terracotta Clay)
// - Standard rectangular rounded arcade bricks with hit counter numbers
// - 5 Default animal balls (x5), aiming trajectory with wall bounce prediction
// - Sequential 1-by-1 ball streaming
// - Turn-based downward grid shift: when balls return, bricks shift down by 1 row
// - Smashed before reaching danger line
// - Board pickup gifts: +1 Ball (5x -> 6x), 2X Multiplier (5x -> 10x), and falling gifts
// - 300 Progressive Levels + Persistence + Character Companion Icon + PIN Vault Unlock

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Colors, BrickRowColors } from '../theme/tokens';
import { Lock, FastForward, RotateCcw } from 'lucide-react';
import { LevelSelectModal, AnimalType } from './LevelSelectModal';
import { LEVEL_PATTERNS } from './levelPatterns';

interface BrickSmashGameProps {
  onUnlockClick: () => void;
}

// ─────────────────────────────────────────────────────────────
// GAME TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────
type ItemType = 'ball_plus' | 'ball_double';

interface Brick {
  id: number;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  color: string;
  border: string;
  pts: number;
  alive: boolean;
}

interface BoardItem {
  id: number;
  row: number;
  col: number;
  x: number;
  y: number;
  type: ItemType;
  collected: boolean;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;
  returning: boolean;
  character: AnimalType;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

export const BrickSmashGame: React.FC<BrickSmashGameProps> = ({ onUnlockClick }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Persistent User Game State
  const [currentLevel, setCurrentLevel] = useState<number>(() => {
    const saved = localStorage.getItem('brick_smash_current_level');
    const parsed = saved ? parseInt(saved, 10) : 1;
    return isNaN(parsed) || parsed < 1 ? 1 : Math.min(parsed, 300);
  });

  const [maxUnlockedLevel, setMaxUnlockedLevel] = useState<number>(() => {
    const saved = localStorage.getItem('brick_smash_max_unlocked_level');
    const parsed = saved ? parseInt(saved, 10) : 3;
    return isNaN(parsed) || parsed < 1 ? 3 : Math.min(parsed, 300);
  });

  const [ballCount, setBallCount] = useState<number>(() => {
    const saved = localStorage.getItem('brick_smash_ball_count');
    const parsed = saved ? parseInt(saved, 10) : 5; // Default 5 balls
    return isNaN(parsed) || parsed < 5 ? 5 : parsed;
  });

  const [selectedCharacter, setSelectedCharacter] = useState<AnimalType>(() => {
    const saved = localStorage.getItem('brick_smash_character') as AnimalType;
    return saved === 'cat' || saved === 'puppy' ? saved : 'panda';
  });

  const [highScore, setHighScore] = useState<number>(() => {
    const saved = localStorage.getItem('brick_smash_high_score');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [canRecall, setCanRecall] = useState(false);

  // Synchronized state refs for 60-120 FPS game loop
  const currentLevelRef = useRef<number>(currentLevel);
  currentLevelRef.current = currentLevel;

  const maxUnlockedLevelRef = useRef<number>(maxUnlockedLevel);
  maxUnlockedLevelRef.current = maxUnlockedLevel;

  const ballCountRef = useRef<number>(ballCount);
  ballCountRef.current = ballCount;

  const selectedCharacterRef = useRef<AnimalType>(selectedCharacter);
  selectedCharacterRef.current = selectedCharacter;

  const speedMultiplierRef = useRef<number>(1);
  speedMultiplierRef.current = speedMultiplier;

  const pendingLevelLoadRef = useRef<number | null>(null);
  const recallTriggerRef = useRef<boolean>(false);

  // Web Audio Context Ref
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

  const playTone = (freq: number, duration = 0.05, type: OscillatorType = 'sine', vol = 0.08) => {
    if (!audioCtxRef.current) return;
    try {
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
      gain.gain.setValueAtTime(vol, audioCtxRef.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + duration);
    } catch (_) {}
  };

  const playHitSound = (hpRatio: number) => {
    const freq = 420 + Math.min(500, (1 - hpRatio) * 400);
    playTone(freq, 0.04, 'triangle', 0.06);
  };

  const playGiftSound = () => {
    playTone(523, 0.06, 'sine', 0.1);
    setTimeout(() => playTone(659, 0.06, 'sine', 0.1), 60);
    setTimeout(() => playTone(784, 0.08, 'sine', 0.12), 120);
  };

  const playLevelCompleteFanfare = () => {
    playTone(523, 0.08, 'sine', 0.12);
    setTimeout(() => playTone(659, 0.08, 'sine', 0.12), 90);
    setTimeout(() => playTone(784, 0.08, 'sine', 0.12), 180);
    setTimeout(() => playTone(1046, 0.18, 'sine', 0.15), 270);
  };

  const handleSelectLevel = useCallback((lvl: number) => {
    setCurrentLevel(lvl);
    localStorage.setItem('brick_smash_current_level', String(lvl));
    pendingLevelLoadRef.current = lvl;
  }, []);

  const handleSelectCharacter = useCallback((char: AnimalType) => {
    setSelectedCharacter(char);
    localStorage.setItem('brick_smash_character', char);
  }, []);

  const toggleSpeed = () => {
    setSpeedMultiplier((prev) => (prev === 1 ? 2 : prev === 2 ? 3 : 1));
  };

  const triggerRecall = () => {
    recallTriggerRef.current = true;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // ─────────────────────────────────────────────────────────────
    // 1. PRE-RENDER OFFSCREEN SPRITES (0ms Render Overhead in Loop)
    // ─────────────────────────────────────────────────────────────
    const SPRITE_SIZE = 64;
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
      pCtx.fillStyle = '#2C2C2A';
      pCtx.beginPath();
      pCtx.arc(cx - 11 * s, cy - 11 * s, 5.5 * s, 0, Math.PI * 2);
      pCtx.arc(cx + 11 * s, cy - 11 * s, 5.5 * s, 0, Math.PI * 2);
      pCtx.fill();

      pCtx.fillStyle = '#FFFFFF';
      pCtx.strokeStyle = '#2C2C2A';
      pCtx.lineWidth = 1.6 * s;
      pCtx.beginPath();
      pCtx.arc(cx, cy, r, 0, Math.PI * 2);
      pCtx.fill();
      pCtx.stroke();

      pCtx.fillStyle = '#2C2C2A';
      pCtx.beginPath();
      pCtx.ellipse(cx - 5 * s, cy - 2 * s, 4 * s, 5 * s, Math.PI / 8, 0, Math.PI * 2);
      pCtx.ellipse(cx + 5 * s, cy - 2 * s, 4 * s, 5 * s, -Math.PI / 8, 0, Math.PI * 2);
      pCtx.fill();

      pCtx.fillStyle = '#FFFFFF';
      pCtx.beginPath();
      pCtx.arc(cx - 4.5 * s, cy - 2.5 * s, 1.5 * s, 0, Math.PI * 2);
      pCtx.arc(cx + 4.5 * s, cy - 2.5 * s, 1.5 * s, 0, Math.PI * 2);
      pCtx.fill();

      pCtx.fillStyle = '#F4C0D1';
      pCtx.beginPath();
      pCtx.arc(cx - 8.5 * s, cy + 4 * s, 2.6 * s, 0, Math.PI * 2);
      pCtx.arc(cx + 8.5 * s, cy + 4 * s, 2.6 * s, 0, Math.PI * 2);
      pCtx.fill();

      pCtx.fillStyle = '#2C2C2A';
      pCtx.beginPath();
      pCtx.ellipse(cx, cy + 2.8 * s, 2.2 * s, 1.6 * s, 0, 0, Math.PI * 2);
      pCtx.fill();
    }

    // Cat Sprite 🐱
    const catCanvas = makeOffscreen();
    const cCtx = catCanvas.getContext('2d');
    if (cCtx) {
      const cx = 32, cy = 32, r = 24, s = r / 16;
      cCtx.fillStyle = '#FAC775';
      cCtx.strokeStyle = '#854F0B';
      cCtx.lineWidth = 1.4 * s;

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

      cCtx.fillStyle = '#FAC775';
      cCtx.beginPath();
      cCtx.arc(cx, cy, r, 0, Math.PI * 2);
      cCtx.fill();
      cCtx.stroke();

      cCtx.fillStyle = '#F4C0D1';
      cCtx.beginPath();
      cCtx.arc(cx - 8 * s, cy + 3 * s, 3 * s, 0, Math.PI * 2);
      cCtx.arc(cx + 8 * s, cy + 3 * s, 3 * s, 0, Math.PI * 2);
      cCtx.fill();

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
    }

    // Puppy Sprite 🐶
    const puppyCanvas = makeOffscreen();
    const puCtx = puppyCanvas.getContext('2d');
    if (puCtx) {
      const cx = 32, cy = 32, r = 24, s = r / 16;
      puCtx.fillStyle = '#854F0B';
      puCtx.beginPath();
      puCtx.ellipse(cx - 13 * s, cy - 2 * s, 4.5 * s, 9 * s, Math.PI / 10, 0, Math.PI * 2);
      puCtx.ellipse(cx + 13 * s, cy - 2 * s, 4.5 * s, 9 * s, -Math.PI / 10, 0, Math.PI * 2);
      puCtx.fill();

      puCtx.fillStyle = '#F5C4B3';
      puCtx.strokeStyle = '#993C1D';
      puCtx.lineWidth = 1.4 * s;
      puCtx.beginPath();
      puCtx.arc(cx, cy, r, 0, Math.PI * 2);
      puCtx.fill();
      puCtx.stroke();

      puCtx.fillStyle = '#FAECE7';
      puCtx.beginPath();
      puCtx.ellipse(cx, cy + 4 * s, 6.5 * s, 4.5 * s, 0, 0, Math.PI * 2);
      puCtx.fill();

      puCtx.fillStyle = '#F4C0D1';
      puCtx.beginPath();
      puCtx.arc(cx - 8 * s, cy + 3 * s, 2.6 * s, 0, Math.PI * 2);
      puCtx.arc(cx + 8 * s, cy + 3 * s, 2.6 * s, 0, Math.PI * 2);
      puCtx.fill();

      puCtx.fillStyle = '#2C2C2A';
      puCtx.beginPath();
      puCtx.arc(cx - 5 * s, cy - 2 * s, 2.4 * s, 0, Math.PI * 2);
      puCtx.arc(cx + 5 * s, cy - 2 * s, 2.4 * s, 0, Math.PI * 2);
      puCtx.fill();
    }

    // ─────────────────────────────────────────────────────────────
    // 2. CANVAS RESOLUTION & DIMENSIONS
    // ─────────────────────────────────────────────────────────────
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

    const COLS = 8;
    const ROWS = 9;
    const GRID_GAP = 4;
    const PLAY_PADDING = 12;
    const GRID_WIDTH = w - PLAY_PADDING * 2;
    const BRICK_WIDTH = Math.floor((GRID_WIDTH - (COLS - 1) * GRID_GAP) / COLS);
    const BRICK_HEIGHT = 16;
    const TOP_OFFSET = 56;
    const DANGER_ROW = ROWS - 1; // Row 8 is danger line
    const DANGER_Y = TOP_OFFSET + DANGER_ROW * (BRICK_HEIGHT + GRID_GAP);
    const LAUNCHER_Y = h - 36;

    // ─────────────────────────────────────────────────────────────
    // 3. ZERO-OVERHEAD GAME STATE
    // ─────────────────────────────────────────────────────────────
    let animId: number;
    let score = 0;
    let level = currentLevelRef.current;
    let wave = 1;
    let localHighScore = parseInt(localStorage.getItem('brick_smash_high_score') || '0', 10);
    let currentBallsCount = ballCountRef.current;
    let extraBallsEarnedThisTurn = 0;

    let launcherX = w / 2;
    let nextLauncherX = w / 2;
    let hasFirstBallReturned = false;

    type GamePhase = 'AIMING' | 'FIRING' | 'SHIFTING' | 'LEVEL_CLEARED' | 'GAME_OVER';
    let phase: GamePhase = 'AIMING';

    let bricks: Brick[] = [];
    let boardItems: BoardItem[] = [];
    const balls: Ball[] = [];
    const particles: Particle[] = [];
    const floatingTexts: FloatingText[] = [];

    // Firing queue
    let ballsToLaunchQueue = 0;
    let lastLaunchTime = 0;
    const LAUNCH_INTERVAL = 42; // ms between ball launches
    const BALL_SPEED = 14.0;
    const BALL_RADIUS = 9.0;

    // Aiming state
    let isAiming = false;
    let aimX = w / 2;
    let aimY = h / 2;
    let flightStartTime = 0;

    // Shift animation state
    let shiftProgress = 1;
    let shiftDuration = 220;
    let shiftStartTime = 0;

    let nextId = 1;

    const getTileRect = (r: number, c: number, shiftOffset = 0) => {
      const x = PLAY_PADDING + c * (BRICK_WIDTH + GRID_GAP);
      const y = TOP_OFFSET + r * (BRICK_HEIGHT + GRID_GAP) + shiftOffset;
      return { x, y, width: BRICK_WIDTH, height: BRICK_HEIGHT };
    };

    // Spawn a new row of rectangular bricks at row 0 with Claude warm palette
    const spawnNewRowAtTop = (currentLvl: number, currentWave: number) => {
      const baseHp = Math.max(1, Math.floor(currentLvl * 1.6 + currentWave * 1.4));
      const tier = Math.floor((currentLvl - 1) / 25);

      for (let c = 0; c < COLS; c++) {
        const rand = Math.random();

        if (rand < 0.62) {
          // Standard Rectangular Brick with hit counter
          const hpVariance = Math.floor(baseHp * (0.8 + Math.random() * 0.5));
          const hp = Math.max(1, hpVariance);
          const style = BrickRowColors[(currentWave + tier) % BrickRowColors.length];
          const rect = getTileRect(0, c);

          bricks.push({
            id: nextId++,
            row: 0,
            col: c,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            hp,
            maxHp: hp,
            color: style.color,
            border: style.border,
            pts: style.points,
            alive: true,
          });
        } else if (rand < 0.8) {
          // Pickup item (+1 Ball or 2x Multiplier)
          const rect = getTileRect(0, c);
          const isDouble = Math.random() < 0.2; // 20% chance of 2X multiplier!
          boardItems.push({
            id: nextId++,
            row: 0,
            col: c,
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            type: isDouble ? 'ball_double' : 'ball_plus',
            collected: false,
          });
        }
      }
    };

    const loadLevel = (lvl: number) => {
      level = Math.max(1, Math.min(300, lvl));
      currentLevelRef.current = level;
      setCurrentLevel(level);
      localStorage.setItem('brick_smash_current_level', String(level));

      bricks = [];
      boardItems = [];
      balls.length = 0;
      particles.length = 0;
      floatingTexts.length = 0;

      wave = 1;
      phase = 'AIMING';
      launcherX = w / 2;
      nextLauncherX = w / 2;
      hasFirstBallReturned = false;
      ballsToLaunchQueue = 0;
      setCanRecall(false);

      const pIdx = (level - 1) % LEVEL_PATTERNS.length;
      const patternFn = LEVEL_PATTERNS[pIdx] || LEVEL_PATTERNS[0];
      const tier = Math.floor((level - 1) / 25);

      // Spawn initial 4 rows using app pattern
      for (let r = 0; r < 4; r++) {
        const style = BrickRowColors[(r + tier) % BrickRowColors.length];
        for (let c = 0; c < COLS; c++) {
          if (!patternFn(r, c)) continue;

          const baseHp = Math.max(1, Math.floor(level * 1.5 + (4 - r) * 1.2));
          const hp = Math.max(1, Math.floor(baseHp * (0.8 + Math.random() * 0.5)));
          const rect = getTileRect(r, c);

          bricks.push({
            id: nextId++,
            row: r,
            col: c,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            hp,
            maxHp: hp,
            color: style.color,
            border: style.border,
            pts: style.points,
            alive: true,
          });
        }

        // Add 1 bonus +1 item per row initially
        const freeCol = Math.floor(Math.random() * COLS);
        if (!bricks.some((b) => b.row === r && b.col === freeCol)) {
          const rect = getTileRect(r, freeCol);
          boardItems.push({
            id: nextId++,
            row: r,
            col: freeCol,
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            type: Math.random() > 0.8 ? 'ball_double' : 'ball_plus',
            collected: false,
          });
        }
      }
    };

    loadLevel(level);

    // ─────────────────────────────────────────────────────────────
    // 4. BALL FIRING & STREAM ENGINE
    // ─────────────────────────────────────────────────────────────
    const fireBalls = (targetX: number, targetY: number) => {
      if (phase !== 'AIMING') return;

      const dx = targetX - launcherX;
      const dy = targetY - LAUNCHER_Y;

      if (dy >= -15) return;

      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag < 20) return;

      const normVx = (dx / mag) * BALL_SPEED;
      const normVy = (dy / mag) * BALL_SPEED;

      phase = 'FIRING';
      flightStartTime = performance.now();
      ballsToLaunchQueue = currentBallsCount;
      hasFirstBallReturned = false;
      extraBallsEarnedThisTurn = 0;
      setCanRecall(false);

      (canvas as any)._launchVx = normVx;
      (canvas as any)._launchVy = normVy;
      lastLaunchTime = 0;
    };

    // ─────────────────────────────────────────────────────────────
    // 5. AIMING RAYCAST TRAJECTORY
    // ─────────────────────────────────────────────────────────────
    const getAimTrajectory = (targetX: number, targetY: number) => {
      const dx = targetX - launcherX;
      const dy = targetY - LAUNCHER_Y;
      if (dy >= -15) return null;

      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag < 15) return null;

      const dirX = dx / mag;
      const dirY = dy / mag;

      const points: Array<{ x: number; y: number }> = [{ x: launcherX, y: LAUNCHER_Y }];
      let currentX = launcherX;
      let currentY = LAUNCHER_Y;
      let curDirX = dirX;
      let curDirY = dirY;

      for (let bounce = 0; bounce < 3; bounce++) {
        let nearestT = 1200;

        if (curDirX < 0) {
          const t = (BALL_RADIUS - currentX) / curDirX;
          if (t > 0 && t < nearestT) nearestT = t;
        }
        if (curDirX > 0) {
          const t = (w - BALL_RADIUS - currentX) / curDirX;
          if (t > 0 && t < nearestT) nearestT = t;
        }
        if (curDirY < 0) {
          const t = (TOP_OFFSET + BALL_RADIUS - currentY) / curDirY;
          if (t > 0 && t < nearestT) nearestT = t;
        }

        for (const b of bricks) {
          if (!b.alive) continue;
          const minX = b.x - BALL_RADIUS;
          const maxX = b.x + b.width + BALL_RADIUS;
          const minY = b.y - BALL_RADIUS;
          const maxY = b.y + b.height + BALL_RADIUS;

          const tx1 = (minX - currentX) / (curDirX || 0.0001);
          const tx2 = (maxX - currentX) / (curDirX || 0.0001);
          const tminX = Math.min(tx1, tx2);
          const tmaxX = Math.max(tx1, tx2);

          const ty1 = (minY - currentY) / (curDirY || 0.0001);
          const ty2 = (maxY - currentY) / (curDirY || 0.0001);
          const tminY = Math.min(ty1, ty2);
          const tmaxY = Math.max(ty1, ty2);

          const tEnter = Math.max(tminX, tminY);
          const tExit = Math.min(tmaxX, tmaxY);

          if (tEnter < tExit && tExit > 0 && tEnter < nearestT && tEnter > 1) {
            nearestT = tEnter;
          }
        }

        const nextX = currentX + curDirX * nearestT;
        const nextY = currentY + curDirY * nearestT;
        points.push({ x: nextX, y: nextY });

        if (nextX <= BALL_RADIUS + 2 || nextX >= w - BALL_RADIUS - 2) {
          curDirX = -curDirX;
          currentX = nextX;
          currentY = nextY;
        } else if (nextY <= TOP_OFFSET + BALL_RADIUS + 2) {
          curDirY = -curDirY;
          currentX = nextX;
          currentY = nextY;
        } else {
          break;
        }
      }

      return points;
    };

    // ─────────────────────────────────────────────────────────────
    // 6. INPUT POINTER HANDLERS
    // ─────────────────────────────────────────────────────────────
    const onPointerDown = (e: PointerEvent) => {
      initAudio();
      if (phase !== 'AIMING') return;

      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      isAiming = true;
      aimX = px;
      aimY = py;

      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isAiming) return;
      const rect = canvas.getBoundingClientRect();
      aimX = Math.max(0, Math.min(w, e.clientX - rect.left));
      aimY = Math.max(0, Math.min(h, e.clientY - rect.top));
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isAiming) return;
      isAiming = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}

      fireBalls(aimX, aimY);
    };

    canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
    canvas.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('pointerup', onPointerUp, { passive: true });
    canvas.addEventListener('pointercancel', onPointerUp, { passive: true });

    // ─────────────────────────────────────────────────────────────
    // 7. HIGH-PERFORMANCE 60-120 FPS PHYSICS LOOP
    // ─────────────────────────────────────────────────────────────
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const elapsed = currentTime - lastTime;
      lastTime = currentTime;

      if (pendingLevelLoadRef.current !== null) {
        const target = pendingLevelLoadRef.current;
        pendingLevelLoadRef.current = null;
        loadLevel(target);
      }

      const baseDt = Math.min(elapsed / 16.667, 1.8);
      const dt = baseDt * speedMultiplierRef.current;

      // Stream balls
      if (phase === 'FIRING' && ballsToLaunchQueue > 0) {
        if (currentTime - lastLaunchTime >= LAUNCH_INTERVAL / speedMultiplierRef.current) {
          lastLaunchTime = currentTime;
          ballsToLaunchQueue--;

          balls.push({
            x: launcherX,
            y: LAUNCHER_Y,
            vx: (canvas as any)._launchVx || 0,
            vy: (canvas as any)._launchVy || -BALL_SPEED,
            radius: BALL_RADIUS,
            active: true,
            returning: false,
            character: selectedCharacterRef.current,
          });
        }
      }

      if (phase === 'FIRING' && currentTime - flightStartTime > 3500) {
        setCanRecall(true);
      }

      if (recallTriggerRef.current) {
        recallTriggerRef.current = false;
        for (const b of balls) {
          if (b.active && !b.returning) {
            b.returning = true;
            b.vx = (launcherX - b.x) * 0.15;
            b.vy = 22;
          }
        }
      }

      // Ball physics & collision
      if (phase === 'FIRING') {
        let activeBallsCount = 0;

        for (const b of balls) {
          if (!b.active) continue;
          activeBallsCount++;

          if (b.returning) {
            b.x += (nextLauncherX - b.x) * 0.22 * dt;
            b.y += 24 * dt;
            if (b.y >= LAUNCHER_Y) {
              b.y = LAUNCHER_Y;
              b.active = false;
            }
            continue;
          }

          b.x += b.vx * dt;
          b.y += b.vy * dt;

          if (b.x - b.radius <= 0) {
            b.x = b.radius;
            b.vx = Math.abs(b.vx);
            playTone(320, 0.03, 'triangle', 0.04);
          } else if (b.x + b.radius >= w) {
            b.x = w - b.radius;
            b.vx = -Math.abs(b.vx);
            playTone(320, 0.03, 'triangle', 0.04);
          }

          if (b.y - b.radius <= TOP_OFFSET) {
            b.y = TOP_OFFSET + b.radius;
            b.vy = Math.abs(b.vy);
            playTone(320, 0.03, 'triangle', 0.04);
          }

          if (b.y >= LAUNCHER_Y) {
            b.y = LAUNCHER_Y;
            b.active = false;

            if (!hasFirstBallReturned) {
              hasFirstBallReturned = true;
              nextLauncherX = Math.max(24, Math.min(w - 24, b.x));
            }
            continue;
          }

          // Item pickups
          for (const item of boardItems) {
            if (item.collected) continue;
            const dist = Math.hypot(b.x - item.x, b.y - item.y);
            if (dist < b.radius + 14) {
              item.collected = true;
              playGiftSound();

              if (item.type === 'ball_plus') {
                extraBallsEarnedThisTurn += 1;
                floatingTexts.push({
                  x: item.x,
                  y: item.y - 10,
                  text: '+1 Ball!',
                  color: Colors.accent.primary,
                  alpha: 1.0,
                  vy: -1.2,
                });
              } else if (item.type === 'ball_double') {
                // 2X Multiplier directly doubles balls!
                const doubled = currentBallsCount * 2;
                extraBallsEarnedThisTurn += currentBallsCount;
                floatingTexts.push({
                  x: item.x,
                  y: item.y - 12,
                  text: '⚡ 2X BALLS! (' + doubled + 'x)',
                  color: '#E28743',
                  alpha: 1.0,
                  vy: -1.4,
                });
              }

              for (let k = 0; k < 8; k++) {
                particles.push({
                  x: item.x,
                  y: item.y,
                  vx: (Math.random() - 0.5) * 5,
                  vy: (Math.random() - 0.5) * 5,
                  radius: 2,
                  color: Colors.accent.primary,
                  alpha: 1.0,
                  life: 0.8,
                });
              }
            }
          }

          // Standard Rectangular Brick Collision
          for (const brick of bricks) {
            if (!brick.alive) continue;

            const closestX = Math.max(brick.x, Math.min(b.x, brick.x + brick.width));
            const closestY = Math.max(brick.y, Math.min(b.y, brick.y + brick.height));
            const distX = b.x - closestX;
            const distY = b.y - closestY;
            const distSq = distX * distX + distY * distY;

            if (distSq < b.radius * b.radius) {
              brick.hp--;
              playHitSound(brick.hp / brick.maxHp);
              score += 1;

              if (score > localHighScore) {
                localHighScore = score;
                setHighScore(localHighScore);
                localStorage.setItem('brick_smash_high_score', String(localHighScore));
              }

              const overlapLeft = Math.abs(b.x + b.radius - brick.x);
              const overlapRight = Math.abs(brick.x + brick.width - (b.x - b.radius));
              const overlapTop = Math.abs(b.y + b.radius - brick.y);
              const overlapBottom = Math.abs(brick.y + brick.height - (b.y - b.radius));
              const minOverlapX = Math.min(overlapLeft, overlapRight);
              const minOverlapY = Math.min(overlapTop, overlapBottom);

              if (minOverlapX < minOverlapY) {
                b.vx = -b.vx;
              } else {
                b.vy = -b.vy;
              }

              for (let k = 0; k < 3; k++) {
                particles.push({
                  x: closestX,
                  y: closestY,
                  vx: (Math.random() - 0.5) * 4,
                  vy: (Math.random() - 0.5) * 4,
                  radius: 2,
                  color: brick.border,
                  alpha: 1.0,
                  life: 0.6,
                });
              }

              if (brick.hp <= 0) {
                brick.alive = false;

                for (let k = 0; k < 10; k++) {
                  particles.push({
                    x: brick.x + brick.width / 2,
                    y: brick.y + brick.height / 2,
                    vx: (Math.random() - 0.5) * 6,
                    vy: (Math.random() - 0.5) * 6,
                    radius: Math.random() * 2.5 + 1.5,
                    color: brick.color,
                    alpha: 1.0,
                    life: 0.9,
                  });
                }

                // Random surprise gift
                if (Math.random() < 0.22) {
                  extraBallsEarnedThisTurn += 1;
                  floatingTexts.push({
                    x: brick.x + brick.width / 2,
                    y: brick.y,
                    text: '+1 Ball!',
                    color: Colors.accent.primary,
                    alpha: 1.0,
                    vy: -1.2,
                  });
                }
              }

              break;
            }
          }
        }

        // All balls returned: turn completed
        if (ballsToLaunchQueue === 0 && activeBallsCount === 0) {
          const remainingBricks = bricks.filter((b) => b.alive).length;

          if (remainingBricks === 0) {
            phase = 'LEVEL_CLEARED';
            playLevelCompleteFanfare();

            const nextLevel = Math.min(300, level + 1);
            const newMaxUnlocked = Math.max(maxUnlockedLevelRef.current, nextLevel);
            maxUnlockedLevelRef.current = newMaxUnlocked;
            setMaxUnlockedLevel(newMaxUnlocked);
            localStorage.setItem('brick_smash_max_unlocked_level', String(newMaxUnlocked));

            setTimeout(() => {
              loadLevel(nextLevel);
            }, 1300);
          } else {
            // Smooth downward shift by 1 row
            phase = 'SHIFTING';
            shiftStartTime = currentTime;
            shiftProgress = 0;

            if (extraBallsEarnedThisTurn > 0) {
              currentBallsCount += extraBallsEarnedThisTurn;
              ballCountRef.current = currentBallsCount;
              setBallCount(currentBallsCount);
              localStorage.setItem('brick_smash_ball_count', String(currentBallsCount));
            }

            launcherX = nextLauncherX;
            balls.length = 0;
            setCanRecall(false);
          }
        }
      }

      // Shifting animation
      if (phase === 'SHIFTING') {
        const shiftElapsed = currentTime - shiftStartTime;
        shiftProgress = Math.min(1, shiftElapsed / shiftDuration);

        if (shiftProgress >= 1) {
          phase = 'AIMING';
          wave++;

          for (const b of bricks) {
            if (!b.alive) continue;
            b.row += 1;
            const rect = getTileRect(b.row, b.col);
            b.x = rect.x;
            b.y = rect.y;

            // Danger line breach
            if (b.row >= DANGER_ROW) {
              phase = 'GAME_OVER';
              playTone(180, 0.25, 'sawtooth', 0.15);
              break;
            }
          }

          for (const item of boardItems) {
            if (item.collected) continue;
            item.row += 1;
            const rect = getTileRect(item.row, item.col);
            item.x = rect.x + rect.width / 2;
            item.y = rect.y + rect.height / 2;
          }

          if (phase !== 'GAME_OVER') {
            spawnNewRowAtTop(level, wave);
          }
        }
      }

      // Particles & floating texts
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= 0.035 * dt;
        p.alpha = Math.max(0, p.life);
        if (p.life <= 0) particles.splice(i, 1);
      }

      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y += ft.vy * dt;
        ft.alpha -= 0.02 * dt;
        if (ft.alpha <= 0) floatingTexts.splice(i, 1);
      }

      // ─────────────────────────────────────────────────────────────
      // 8. RENDER: CLAUDE MINIMALIST WARM IVORY THEME (#FAF9F5)
      // ─────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, w, h);

      // Warm Ivory Background
      ctx.fillStyle = '#FAF9F5';
      ctx.fillRect(0, 0, w, h);

      // Hairline Grid Lines
      ctx.strokeStyle = 'rgba(20, 20, 19, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, TOP_OFFSET);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = TOP_OFFSET; y < h; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Danger Line
      ctx.strokeStyle = 'rgba(217, 119, 87, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(PLAY_PADDING, DANGER_Y);
      ctx.lineTo(w - PLAY_PADDING, DANGER_Y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = Colors.accent.primary;
      ctx.font = '600 10px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('DANGER LINE', w - PLAY_PADDING - 4, DANGER_Y - 4);

      const currentShiftOffset =
        phase === 'SHIFTING' ? shiftProgress * (BRICK_HEIGHT + GRID_GAP) : 0;

      // Draw Standard Rectangular Bricks with Hit Numbers
      for (const b of bricks) {
        if (!b.alive) continue;
        const renderY = b.y + currentShiftOffset;

        ctx.fillStyle = b.color;
        ctx.strokeStyle = b.border;
        ctx.lineWidth = 1.2;

        ctx.beginPath();
        (ctx as any).roundRect
          ? (ctx as any).roundRect(b.x, renderY, b.width, b.height, 4)
          : ctx.rect(b.x, renderY, b.width, b.height);
        ctx.fill();
        ctx.stroke();

        // Brick Hit Counter Number
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(b.hp), b.x + b.width / 2, renderY + b.height / 2);
      }

      // Draw Board Items (+1 Ball and 2X Multiplier)
      for (const item of boardItems) {
        if (item.collected) continue;
        const renderY = item.y + currentShiftOffset;

        ctx.save();
        if (item.type === 'ball_plus') {
          ctx.fillStyle = '#FFFFFF';
          ctx.strokeStyle = Colors.accent.primary;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(item.x, renderY, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = Colors.accent.primary;
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('+1', item.x, renderY);
        } else if (item.type === 'ball_double') {
          ctx.fillStyle = '#FAF0EB';
          ctx.strokeStyle = '#E28743';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(item.x, renderY, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#C06B2B';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('2X', item.x, renderY);
        }
        ctx.restore();
      }

      // Particles
      for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Floating Texts
      for (const ft of floatingTexts) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 12px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      // Aiming Trajectory Line (Dotted Claude Terracotta)
      if (isAiming && phase === 'AIMING') {
        const trajectoryPoints = getAimTrajectory(aimX, aimY);
        if (trajectoryPoints && trajectoryPoints.length >= 2) {
          ctx.save();
          ctx.fillStyle = Colors.accent.primary;

          for (let pIdx = 0; pIdx < trajectoryPoints.length - 1; pIdx++) {
            const p1 = trajectoryPoints[pIdx];
            const p2 = trajectoryPoints[pIdx + 1];
            const segDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const numDots = Math.floor(segDist / 14);

            for (let d = 0; d <= numDots; d++) {
              const t = d / (numDots || 1);
              const dotX = p1.x + (p2.x - p1.x) * t;
              const dotY = p1.y + (p2.y - p1.y) * t;
              ctx.beginPath();
              ctx.arc(dotX, dotY, 2.8, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          const endPoint = trajectoryPoints[trajectoryPoints.length - 1];
          ctx.strokeStyle = Colors.accent.primary;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(endPoint.x, endPoint.y, 7, 0, Math.PI * 2);
          ctx.stroke();

          ctx.restore();
        }
      }

      // Draw Active Balls in Flight
      for (const b of balls) {
        if (!b.active) continue;
        const sCanvas =
          b.character === 'cat'
            ? catCanvas
            : b.character === 'puppy'
            ? puppyCanvas
            : pandaCanvas;
        const diameter = b.radius * 2;
        ctx.drawImage(sCanvas, b.x - b.radius, b.y - b.radius, diameter, diameter);
      }

      // Draw Launcher Base with Ball Count
      const curLauncherX = phase === 'AIMING' ? launcherX : nextLauncherX;
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = Colors.accent.primary;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(curLauncherX, LAUNCHER_Y, BALL_RADIUS + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const lCanvas =
        selectedCharacterRef.current === 'cat'
          ? catCanvas
          : selectedCharacterRef.current === 'puppy'
          ? puppyCanvas
          : pandaCanvas;
      ctx.drawImage(
        lCanvas,
        curLauncherX - BALL_RADIUS,
        LAUNCHER_Y - BALL_RADIUS,
        BALL_RADIUS * 2,
        BALL_RADIUS * 2
      );
      ctx.restore();

      // Ball Count Label (e.g. x5, x6, x10)
      ctx.fillStyle = Colors.accent.primary;
      ctx.font = 'bold 12px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`x${currentBallsCount}`, curLauncherX, LAUNCHER_Y + 22);

      // Overlays
      if (phase === 'LEVEL_CLEARED') {
        ctx.fillStyle = 'rgba(250, 249, 245, 0.95)';
        ctx.fillRect(0, 140, w, 140);
        ctx.textAlign = 'center';
        ctx.fillStyle = Colors.status.online;
        ctx.font = '700 24px -apple-system, sans-serif';
        ctx.fillText(`✨ LEVEL ${level} CLEARED! ✨`, w / 2, 195);
        ctx.font = '500 13px -apple-system, sans-serif';
        ctx.fillStyle = Colors.text.secondary;
        ctx.fillText(`Starting Level ${Math.min(300, level + 1)}...`, w / 2, 230);
      } else if (phase === 'GAME_OVER') {
        ctx.fillStyle = 'rgba(250, 249, 245, 0.95)';
        ctx.fillRect(0, 140, w, 150);
        ctx.textAlign = 'center';
        ctx.fillStyle = Colors.accent.primary;
        ctx.font = '700 24px -apple-system, sans-serif';
        ctx.fillText('GAME OVER', w / 2, 190);
        ctx.font = '500 13px -apple-system, sans-serif';
        ctx.fillStyle = Colors.text.secondary;
        ctx.fillText(`Bricks reached the danger line! Score: ${score}`, w / 2, 220);
        ctx.fillStyle = Colors.accent.primary;
        ctx.fillText('Tap screen to retry level', w / 2, 246);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
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
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: `1px solid ${Colors.border}`,
          backgroundColor: Colors.bg.elevated,
        }}
      >
        {/* Restored Title with 🧱 BRICK SMASH */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontWeight: 600,
            fontSize: 16,
            color: Colors.accent.primary,
            letterSpacing: '-0.3px',
          }}
        >
          <span>🧱 BRICK SMASH</span>
        </div>

        {/* Level & Highscore */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: Colors.text.primary }}>
            LVL {currentLevel}/300
          </span>
          <span style={{ fontSize: 11, color: Colors.text.placeholder }}>
            HIGH {highScore}
          </span>
        </div>

        {/* Right Action Icons Row: Character Level Selector + PIN */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Character Level Selector & Notification Icon (Left of PIN) */}
          <button
            onClick={() => setIsLevelModalOpen(true)}
            title={`Level ${currentLevel} • Select Level & Companion`}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              border: `1.5px solid ${Colors.border}`,
              cursor: 'pointer',
              padding: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              transition: 'all 0.15s ease',
            }}
          >
            <div className="char-halo-ripple" />
            <img
              src={`/characters/${selectedCharacter}-idle.png`}
              alt={selectedCharacter}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                objectFit: 'contain',
              }}
            />

            {/* Notification Badge Dot indicating current level */}
            <span
              className="char-badge-pulse"
              style={{
                position: 'absolute',
                top: -2,
                right: -4,
                minWidth: 17,
                height: 17,
                borderRadius: 9,
                backgroundColor: Colors.accent.primary,
                color: '#FFFFFF',
                fontSize: 10,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
                border: '2px solid #FFFFFF',
                boxShadow: '0 0 0 1.5px rgba(217, 119, 87, 0.35)',
              }}
            >
              {currentLevel}
            </span>
          </button>

          {/* Discreet PIN Trigger */}
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
      </div>

      {/* Canvas Wrapper */}
      <div
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 560,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          position: 'relative',
          touchAction: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            cursor: 'crosshair',
            touchAction: 'none',
            display: 'block',
          }}
        />
      </div>

      {/* Bottom Control Bar */}
      <div
        style={{
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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Drag to aim • Shoot {ballCount} balls</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Recall Button */}
          {canRecall && (
            <button
              onClick={triggerRecall}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 6,
                backgroundColor: Colors.bg.secondary,
                border: `1px solid ${Colors.border}`,
                color: Colors.accent.primary,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={12} />
              <span>Recall</span>
            </button>
          )}

          {/* Speed Multiplier Button (⚡ 1x, 2x, 3x) */}
          <button
            onClick={toggleSpeed}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 6,
              backgroundColor:
                speedMultiplier > 1 ? Colors.accent.soft : Colors.bg.secondary,
              border: `1px solid ${
                speedMultiplier > 1 ? Colors.accent.primary : Colors.border
              }`,
              color:
                speedMultiplier > 1 ? Colors.accent.primary : Colors.text.secondary,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <FastForward size={12} />
            <span>{speedMultiplier}x</span>
          </button>
        </div>
      </div>

      {/* 300-Level Selector & Companion Modal */}
      <LevelSelectModal
        isOpen={isLevelModalOpen}
        onClose={() => setIsLevelModalOpen(false)}
        currentLevel={currentLevel}
        maxUnlockedLevel={maxUnlockedLevel}
        selectedCharacter={selectedCharacter}
        onSelectLevel={handleSelectLevel}
        onSelectCharacter={handleSelectCharacter}
        highScore={highScore}
      />
    </div>
  );
};
