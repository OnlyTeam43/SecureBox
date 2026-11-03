// client/src/components/BrickSmashGame.tsx
// "Brick Breaker Throw" (BBTAN / Many-Balls Stream Physics Engine)
// 60-120 FPS Direct Canvas Compositor with Zero React State Overhead in Game Loop
// - Dynamic numbered bricks (hit counter on every brick)
// - Starts with 5 balls (x5), aiming raycast trajectory line with wall bounces
// - Balls stream out 1-by-1 along the trajectory
// - Turn-based grid shift: once all balls return, bricks shift down by 1 row
// - Gifts & pickups: +1 Ball, 2x Multiplier (5x -> 10x), Bombs, Laser Clears
// - Triangle & Square neon glowing bricks matching user screenshots
// - 300 Progressive Levels + Persistence + Character Companion Icon + PIN Vault Unlock

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Colors } from '../theme/tokens';
import { Lock, FastForward, RotateCcw } from 'lucide-react';
import { LevelSelectModal, AnimalType } from './LevelSelectModal';
import { LEVEL_PATTERNS } from './levelPatterns';

interface BrickSmashGameProps {
  onUnlockClick: () => void;
}

// ─────────────────────────────────────────────────────────────
// GAME TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────
type BrickShape = 'square' | 'triangle_tl' | 'triangle_tr' | 'triangle_bl' | 'triangle_br';
type ItemType = 'ball_plus' | 'ball_double' | 'bomb' | 'laser_h' | 'laser_v';

interface Brick {
  id: number;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: BrickShape;
  hp: number;
  maxHp: number;
  color: string;
  borderColor: string;
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

// Vibrant Neon Color Palette matching screenshots
const NEON_PALETTE = [
  { fill: 'rgba(0, 229, 255, 0.16)', border: '#00E5FF', glow: 'rgba(0, 229, 255, 0.7)' }, // Cyan
  { fill: 'rgba(255, 42, 109, 0.16)', border: '#FF2A6D', glow: 'rgba(255, 42, 109, 0.7)' }, // Pink/Magenta
  { fill: 'rgba(5, 255, 161, 0.16)', border: '#05FFA1', glow: 'rgba(5, 255, 161, 0.7)' }, // Neon Lime
  { fill: 'rgba(255, 184, 0, 0.16)', border: '#FFB800', glow: 'rgba(255, 184, 0, 0.7)' }, // Neon Amber
  { fill: 'rgba(157, 78, 221, 0.16)', border: '#9D4EDD', glow: 'rgba(157, 78, 221, 0.7)' }, // Violet
  { fill: 'rgba(58, 134, 255, 0.16)', border: '#3A86FF', glow: 'rgba(58, 134, 255, 0.7)' }, // Blue
  { fill: 'rgba(255, 77, 109, 0.16)', border: '#FF4D6D', glow: 'rgba(255, 77, 109, 0.7)' }, // Crimson
];

export const BrickSmashGame: React.FC<BrickSmashGameProps> = ({ onUnlockClick }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Persistent User Game State
  const [currentLevel, setCurrentLevel] = useState<number>(() => {
    const saved = localStorage.getItem('bbt_current_level');
    const parsed = saved ? parseInt(saved, 10) : 1;
    return isNaN(parsed) || parsed < 1 ? 1 : Math.min(parsed, 300);
  });

  const [maxUnlockedLevel, setMaxUnlockedLevel] = useState<number>(() => {
    const saved = localStorage.getItem('bbt_max_unlocked_level');
    const parsed = saved ? parseInt(saved, 10) : 3;
    return isNaN(parsed) || parsed < 1 ? 3 : Math.min(parsed, 300);
  });

  const [ballCount, setBallCount] = useState<number>(() => {
    const saved = localStorage.getItem('bbt_ball_count');
    const parsed = saved ? parseInt(saved, 10) : 5; // Default 5 balls as requested!
    return isNaN(parsed) || parsed < 5 ? 5 : parsed;
  });

  const [selectedCharacter, setSelectedCharacter] = useState<AnimalType>(() => {
    const saved = localStorage.getItem('bbt_character') as AnimalType;
    return saved === 'cat' || saved === 'puppy' ? saved : 'panda';
  });

  const [highScore, setHighScore] = useState<number>(() => {
    const saved = localStorage.getItem('bbt_high_score');
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
    // Pitch scales with brick health
    const freq = 400 + Math.min(600, (1 - hpRatio) * 450);
    playTone(freq, 0.04, 'triangle', 0.06);
  };

  const playGiftSound = () => {
    playTone(523, 0.06, 'sine', 0.1);
    setTimeout(() => playTone(659, 0.06, 'sine', 0.1), 60);
    setTimeout(() => playTone(784, 0.08, 'sine', 0.12), 120);
    setTimeout(() => playTone(1046, 0.12, 'sine', 0.14), 180);
  };

  const playExplodeSound = () => {
    playTone(180, 0.15, 'sawtooth', 0.15);
    setTimeout(() => playTone(90, 0.25, 'triangle', 0.12), 40);
  };

  const playLevelCompleteFanfare = () => {
    playTone(523, 0.08, 'sine', 0.12);
    setTimeout(() => playTone(659, 0.08, 'sine', 0.12), 90);
    setTimeout(() => playTone(784, 0.08, 'sine', 0.12), 180);
    setTimeout(() => playTone(1046, 0.18, 'sine', 0.15), 270);
  };

  // Level selector handlers
  const handleSelectLevel = useCallback((lvl: number) => {
    setCurrentLevel(lvl);
    localStorage.setItem('bbt_current_level', String(lvl));
    pendingLevelLoadRef.current = lvl;
  }, []);

  const handleSelectCharacter = useCallback((char: AnimalType) => {
    setSelectedCharacter(char);
    localStorage.setItem('bbt_character', char);
  }, []);

  // Speed multiplier toggle
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
    // 1. PRE-RENDER OFFSCREEN ANIMAL SPRITES (0ms Render Overhead)
    // ─────────────────────────────────────────────────────────────
    const SPRITE_SIZE = 48;
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
      const cx = 24, cy = 24, r = 18, s = r / 16;
      pCtx.fillStyle = '#1E1E1E';
      pCtx.beginPath();
      pCtx.arc(cx - 11 * s, cy - 11 * s, 5.5 * s, 0, Math.PI * 2);
      pCtx.arc(cx + 11 * s, cy - 11 * s, 5.5 * s, 0, Math.PI * 2);
      pCtx.fill();

      pCtx.fillStyle = '#FFFFFF';
      pCtx.strokeStyle = '#00E5FF'; // Glowing neon rim
      pCtx.lineWidth = 1.8;
      pCtx.beginPath();
      pCtx.arc(cx, cy, r, 0, Math.PI * 2);
      pCtx.fill();
      pCtx.stroke();

      pCtx.fillStyle = '#1E1E1E';
      pCtx.beginPath();
      pCtx.ellipse(cx - 5 * s, cy - 2 * s, 4 * s, 5 * s, Math.PI / 8, 0, Math.PI * 2);
      pCtx.ellipse(cx + 5 * s, cy - 2 * s, 4 * s, 5 * s, -Math.PI / 8, 0, Math.PI * 2);
      pCtx.fill();

      pCtx.fillStyle = '#FFFFFF';
      pCtx.beginPath();
      pCtx.arc(cx - 4.5 * s, cy - 2.5 * s, 1.5 * s, 0, Math.PI * 2);
      pCtx.arc(cx + 4.5 * s, cy - 2.5 * s, 1.5 * s, 0, Math.PI * 2);
      pCtx.fill();

      pCtx.fillStyle = '#FF2A6D';
      pCtx.beginPath();
      pCtx.arc(cx - 8.5 * s, cy + 4 * s, 2.5 * s, 0, Math.PI * 2);
      pCtx.arc(cx + 8.5 * s, cy + 4 * s, 2.5 * s, 0, Math.PI * 2);
      pCtx.fill();

      pCtx.fillStyle = '#1E1E1E';
      pCtx.beginPath();
      pCtx.ellipse(cx, cy + 2.8 * s, 2.2 * s, 1.6 * s, 0, 0, Math.PI * 2);
      pCtx.fill();
    }

    // Cat Sprite 🐱
    const catCanvas = makeOffscreen();
    const cCtx = catCanvas.getContext('2d');
    if (cCtx) {
      const cx = 24, cy = 24, r = 18, s = r / 16;
      cCtx.fillStyle = '#FFB800';
      cCtx.strokeStyle = '#FF8C00';
      cCtx.lineWidth = 1.4 * s;

      cCtx.beginPath();
      cCtx.moveTo(cx - 12 * s, cy - 4 * s);
      cCtx.lineTo(cx - 10 * s, cy - 18 * s);
      cCtx.lineTo(cx - 2 * s, cy - 11 * s);
      cCtx.closePath();
      cCtx.fill();

      cCtx.beginPath();
      cCtx.moveTo(cx + 12 * s, cy - 4 * s);
      cCtx.lineTo(cx + 10 * s, cy - 18 * s);
      cCtx.lineTo(cx + 2 * s, cy - 11 * s);
      cCtx.closePath();
      cCtx.fill();

      cCtx.beginPath();
      cCtx.arc(cx, cy, r, 0, Math.PI * 2);
      cCtx.fill();
      cCtx.strokeStyle = '#05FFA1';
      cCtx.stroke();

      cCtx.fillStyle = '#FF2A6D';
      cCtx.beginPath();
      cCtx.arc(cx - 8 * s, cy + 3 * s, 2.8 * s, 0, Math.PI * 2);
      cCtx.arc(cx + 8 * s, cy + 3 * s, 2.8 * s, 0, Math.PI * 2);
      cCtx.fill();

      cCtx.fillStyle = '#1A1A1A';
      cCtx.beginPath();
      cCtx.arc(cx - 5 * s, cy - 2 * s, 2.4 * s, 0, Math.PI * 2);
      cCtx.arc(cx + 5 * s, cy - 2 * s, 2.4 * s, 0, Math.PI * 2);
      cCtx.fill();
    }

    // Puppy Sprite 🐶
    const puppyCanvas = makeOffscreen();
    const puCtx = puppyCanvas.getContext('2d');
    if (puCtx) {
      const cx = 24, cy = 24, r = 18, s = r / 16;
      puCtx.fillStyle = '#9D4EDD';
      puCtx.beginPath();
      puCtx.ellipse(cx - 13 * s, cy - 2 * s, 4.5 * s, 8 * s, Math.PI / 10, 0, Math.PI * 2);
      puCtx.ellipse(cx + 13 * s, cy - 2 * s, 4.5 * s, 8 * s, -Math.PI / 10, 0, Math.PI * 2);
      puCtx.fill();

      puCtx.fillStyle = '#E0AAFF';
      puCtx.beginPath();
      puCtx.arc(cx, cy, r, 0, Math.PI * 2);
      puCtx.fill();
      puCtx.strokeStyle = '#FF2A6D';
      puCtx.lineWidth = 1.6;
      puCtx.stroke();

      puCtx.fillStyle = '#1A1A1A';
      puCtx.beginPath();
      puCtx.arc(cx - 5 * s, cy - 2 * s, 2.4 * s, 0, Math.PI * 2);
      puCtx.arc(cx + 5 * s, cy - 2 * s, 2.4 * s, 0, Math.PI * 2);
      puCtx.fill();
    }

    // ─────────────────────────────────────────────────────────────
    // 2. CANVAS RESOLUTION & GRID DIMENSIONS
    // ─────────────────────────────────────────────────────────────
    const dpr = window.devicePixelRatio || 1;
    const updateSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const w = Math.min(rect.width || 480, 560);
      const h = Math.min(rect.height || 640, 720);

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      return { w, h };
    };

    let { w, h } = updateSize() || { w: 480, h: 640 };

    const COLS = 7; // 7 columns creates perfect neon tile proportions
    const ROWS = 9; // 9 grid rows
    const GRID_GAP = 5;
    const PLAY_PADDING = 12;
    const GRID_WIDTH = w - PLAY_PADDING * 2;
    const TILE_WIDTH = Math.floor((GRID_WIDTH - (COLS - 1) * GRID_GAP) / COLS);
    const TILE_HEIGHT = Math.floor(TILE_WIDTH * 0.95);
    const TOP_OFFSET = 58;
    const DANGER_ROW = ROWS - 1; // If any brick reaches row 8, Game Over!
    const DANGER_Y = TOP_OFFSET + DANGER_ROW * (TILE_HEIGHT + GRID_GAP);
    const LAUNCHER_Y = h - 38;

    // ─────────────────────────────────────────────────────────────
    // 3. GAMEPLAY STATE
    // ─────────────────────────────────────────────────────────────
    let animId: number;
    let score = 0;
    let level = currentLevelRef.current;
    let wave = 1;
    let localHighScore = parseInt(localStorage.getItem('bbt_high_score') || '0', 10);
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
    const BALL_SPEED = 14.5;
    const BALL_RADIUS = 9.5;

    // Aiming state
    let isAiming = false;
    let aimX = w / 2;
    let aimY = h / 2;
    let flightStartTime = 0;

    // Shift animation state
    let shiftProgress = 1; // 0 to 1 during downward shift
    let shiftDuration = 220; // ms
    let shiftStartTime = 0;

    // ─────────────────────────────────────────────────────────────
    // 4. LEVEL INITIALIZATION & WAVE SPAWNING
    // ─────────────────────────────────────────────────────────────
    let nextId = 1;

    const getTileRect = (r: number, c: number, shiftOffset = 0) => {
      const x = PLAY_PADDING + c * (TILE_WIDTH + GRID_GAP);
      const y = TOP_OFFSET + r * (TILE_HEIGHT + GRID_GAP) + shiftOffset;
      return { x, y, width: TILE_WIDTH, height: TILE_HEIGHT };
    };

    const spawnNewRowAtTop = (currentLvl: number, currentWave: number) => {
      // Base hit points scale progressively
      const baseHp = Math.max(1, Math.floor(currentLvl * 1.8 + currentWave * 1.5));

      const shapes: BrickShape[] = [
        'square',
        'square',
        'square',
        'triangle_tl',
        'triangle_tr',
        'triangle_bl',
        'triangle_br',
      ];

      for (let c = 0; c < COLS; c++) {
        // Randomly decide if this tile contains a brick, an item, or is empty
        const rand = Math.random();

        if (rand < 0.58) {
          // Brick Tile
          const shape = shapes[Math.floor(Math.random() * shapes.length)];
          const hpVariance = Math.floor(baseHp * (0.8 + Math.random() * 0.6));
          const hp = Math.max(1, hpVariance);
          const palette = NEON_PALETTE[(c + currentWave) % NEON_PALETTE.length];
          const rect = getTileRect(0, c);

          bricks.push({
            id: nextId++,
            row: 0,
            col: c,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            shape,
            hp,
            maxHp: hp,
            color: palette.fill,
            borderColor: palette.border,
            alive: true,
          });
        } else if (rand < 0.78) {
          // Pickup Item Tile (+1 Ball, 2x Multiplier, or Bomb)
          const rect = getTileRect(0, c);
          const itemRand = Math.random();
          let type: ItemType = 'ball_plus';

          if (itemRand < 0.65) {
            type = 'ball_plus'; // +1 Ball (Common)
          } else if (itemRand < 0.85) {
            type = 'ball_double'; // 2x Multiplier (Exciting!)
          } else {
            type = 'bomb'; // Bomb blast
          }

          boardItems.push({
            id: nextId++,
            row: 0,
            col: c,
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            type,
            collected: false,
          });
        }
      }
    };

    const loadLevel = (lvl: number) => {
      level = Math.max(1, Math.min(300, lvl));
      currentLevelRef.current = level;
      setCurrentLevel(level);
      localStorage.setItem('bbt_current_level', String(level));

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

      // Check pattern from archetypes
      const pIdx = (level - 1) % LEVEL_PATTERNS.length;
      const patternFn = LEVEL_PATTERNS[pIdx] || LEVEL_PATTERNS[0];

      // Spawn initial 4 rows using archetype geometric pattern
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!patternFn(r, c)) continue;

          const baseHp = Math.max(1, Math.floor(level * 1.5 + (4 - r) * 1.2));
          const hp = Math.max(1, Math.floor(baseHp * (0.8 + Math.random() * 0.5)));
          const palette = NEON_PALETTE[(r + c) % NEON_PALETTE.length];
          const rect = getTileRect(r, c);

          const shape: BrickShape =
            Math.random() < 0.2
              ? (['triangle_tl', 'triangle_tr', 'triangle_bl', 'triangle_br'][
                  Math.floor(Math.random() * 4)
                ] as BrickShape)
              : 'square';

          bricks.push({
            id: nextId++,
            row: r,
            col: c,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            shape,
            hp,
            maxHp: hp,
            color: palette.fill,
            borderColor: palette.border,
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
    // 5. BALL FIRING & STREAM ENGINE
    // ─────────────────────────────────────────────────────────────
    const fireBalls = (targetX: number, targetY: number) => {
      if (phase !== 'AIMING') return;

      const dx = targetX - launcherX;
      const dy = targetY - LAUNCHER_Y;

      // Disallow shooting purely horizontal or downwards
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

      // Store launch trajectory for streamer
      (canvas as any)._launchVx = normVx;
      (canvas as any)._launchVy = normVy;
      lastLaunchTime = 0;
    };

    // ─────────────────────────────────────────────────────────────
    // 6. AIMING RAYCAST TRAJECTORY (Predictive Wall Bounces)
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

      // Simulate up to 2 bounces
      for (let bounce = 0; bounce < 3; bounce++) {
        let nearestT = 1200;

        // Wall collisions
        // Left wall
        if (curDirX < 0) {
          const t = (BALL_RADIUS - currentX) / curDirX;
          if (t > 0 && t < nearestT) nearestT = t;
        }
        // Right wall
        if (curDirX > 0) {
          const t = (w - BALL_RADIUS - currentX) / curDirX;
          if (t > 0 && t < nearestT) nearestT = t;
        }
        // Top wall
        if (curDirY < 0) {
          const t = (TOP_OFFSET + BALL_RADIUS - currentY) / curDirY;
          if (t > 0 && t < nearestT) nearestT = t;
        }

        // Brick intersections
        for (const b of bricks) {
          if (!b.alive) continue;
          // Approximate AABB raycast
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

        // Wall bounce reflection
        if (nextX <= BALL_RADIUS + 2 || nextX >= w - BALL_RADIUS - 2) {
          curDirX = -curDirX;
          currentX = nextX;
          currentY = nextY;
        } else if (nextY <= TOP_OFFSET + BALL_RADIUS + 2) {
          curDirY = -curDirY;
          currentX = nextX;
          currentY = nextY;
        } else {
          // Hit brick, end preview
          break;
        }
      }

      return points;
    };

    // ─────────────────────────────────────────────────────────────
    // 7. INPUT POINTER HANDLERS (Compositor Thread Instant Aim)
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

      // Fire all balls towards the aim target!
      fireBalls(aimX, aimY);
    };

    canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
    canvas.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('pointerup', onPointerUp, { passive: true });
    canvas.addEventListener('pointercancel', onPointerUp, { passive: true });

    // ─────────────────────────────────────────────────────────────
    // 8. HIGH-PERFORMANCE 60-120 FPS PHYSICS LOOP
    // ─────────────────────────────────────────────────────────────
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const elapsed = currentTime - lastTime;
      lastTime = currentTime;

      // Handle external level load trigger
      if (pendingLevelLoadRef.current !== null) {
        const target = pendingLevelLoadRef.current;
        pendingLevelLoadRef.current = null;
        loadLevel(target);
      }

      // Delta time with speed multiplier (⚡ 1x, 2x, 3x)
      const baseDt = Math.min(elapsed / 16.667, 1.8);
      const dt = baseDt * speedMultiplierRef.current;

      // 8.1 STREAM BALLS QUEUE
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

      // Check recall capability
      if (phase === 'FIRING' && currentTime - flightStartTime > 3500) {
        setCanRecall(true);
      }

      // Instant Recall Triggered
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

      // 8.2 BALL MOVEMENT & COLLISION
      if (phase === 'FIRING') {
        let activeBallsCount = 0;

        for (const b of balls) {
          if (!b.active) continue;
          activeBallsCount++;

          if (b.returning) {
            // Ball returning to floor
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

          // Wall bounce (Left & Right)
          if (b.x - b.radius <= 0) {
            b.x = b.radius;
            b.vx = Math.abs(b.vx);
            playTone(320, 0.03, 'triangle', 0.04);
          } else if (b.x + b.radius >= w) {
            b.x = w - b.radius;
            b.vx = -Math.abs(b.vx);
            playTone(320, 0.03, 'triangle', 0.04);
          }

          // Top ceiling bounce
          if (b.y - b.radius <= TOP_OFFSET) {
            b.y = TOP_OFFSET + b.radius;
            b.vy = Math.abs(b.vy);
            playTone(320, 0.03, 'triangle', 0.04);
          }

          // Bottom floor return
          if (b.y >= LAUNCHER_Y) {
            b.y = LAUNCHER_Y;
            b.active = false;

            // First ball sets new launch position!
            if (!hasFirstBallReturned) {
              hasFirstBallReturned = true;
              nextLauncherX = Math.max(24, Math.min(w - 24, b.x));
            }
            continue;
          }

          // Pickup Item collection check
          for (const item of boardItems) {
            if (item.collected) continue;
            const dist = Math.hypot(b.x - item.x, b.y - item.y);
            if (dist < b.radius + 15) {
              item.collected = true;
              playGiftSound();

              if (item.type === 'ball_plus') {
                extraBallsEarnedThisTurn += 1;
                floatingTexts.push({
                  x: item.x,
                  y: item.y - 10,
                  text: '+1 Ball!',
                  color: '#05FFA1',
                  alpha: 1.0,
                  vy: -1.2,
                });
              } else if (item.type === 'ball_double') {
                // 2x Multiplier: Doubles current balls directly!
                const doubled = currentBallsCount * 2;
                extraBallsEarnedThisTurn += currentBallsCount; // Doubled
                floatingTexts.push({
                  x: item.x,
                  y: item.y - 12,
                  text: '⚡ 2X BALLS! (' + doubled + 'x)',
                  color: '#FFB800',
                  alpha: 1.0,
                  vy: -1.4,
                });
              } else if (item.type === 'bomb') {
                playExplodeSound();
                floatingTexts.push({
                  x: item.x,
                  y: item.y - 10,
                  text: '💥 BLAST!',
                  color: '#FF2A6D',
                  alpha: 1.0,
                  vy: -1.5,
                });

                // Blast adjacent bricks
                for (const br of bricks) {
                  if (!br.alive) continue;
                  const blastDist = Math.hypot(br.x + br.width / 2 - item.x, br.y + br.height / 2 - item.y);
                  if (blastDist < TILE_WIDTH * 2.2) {
                    br.hp = Math.max(0, br.hp - 15);
                    if (br.hp === 0) {
                      br.alive = false;
                      score += 15;
                    }
                  }
                }
              }

              // Spark particles
              for (let k = 0; k < 12; k++) {
                particles.push({
                  x: item.x,
                  y: item.y,
                  vx: (Math.random() - 0.5) * 6,
                  vy: (Math.random() - 0.5) * 6,
                  radius: Math.random() * 2.5 + 1.5,
                  color: item.type === 'ball_double' ? '#FFB800' : '#05FFA1',
                  alpha: 1.0,
                  life: 1.0,
                });
              }
            }
          }

          // Brick collision check
          for (const brick of bricks) {
            if (!brick.alive) continue;

            // AABB Overlap test
            const closestX = Math.max(brick.x, Math.min(b.x, brick.x + brick.width));
            const closestY = Math.max(brick.y, Math.min(b.y, brick.y + brick.height));
            const distX = b.x - closestX;
            const distY = b.y - closestY;
            const distSq = distX * distX + distY * distY;

            if (distSq < b.radius * b.radius) {
              // Decrement hit count
              brick.hp--;
              playHitSound(brick.hp / brick.maxHp);
              score += 1;

              if (score > localHighScore) {
                localHighScore = score;
                setHighScore(localHighScore);
                localStorage.setItem('bbt_high_score', String(localHighScore));
              }

              // Normal vector reflection
              if (brick.shape === 'square') {
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
              } else {
                // Triangle hypotenuse ricochet
                b.vx = -b.vx;
                b.vy = -b.vy;
              }

              // Hit spark particles
              for (let k = 0; k < 3; k++) {
                particles.push({
                  x: closestX,
                  y: closestY,
                  vx: (Math.random() - 0.5) * 5,
                  vy: (Math.random() - 0.5) * 5,
                  radius: 2,
                  color: brick.borderColor,
                  alpha: 1.0,
                  life: 0.6,
                });
              }

              // Smashed Brick Explodes!
              if (brick.hp <= 0) {
                brick.alive = false;

                // Explosion particles
                for (let k = 0; k < 14; k++) {
                  particles.push({
                    x: brick.x + brick.width / 2,
                    y: brick.y + brick.height / 2,
                    vx: (Math.random() - 0.5) * 8,
                    vy: (Math.random() - 0.5) * 8,
                    radius: Math.random() * 3 + 2,
                    color: brick.borderColor,
                    alpha: 1.0,
                    life: 1.0,
                  });
                }

                // 20% chance of spontaneous surprise gift
                if (Math.random() < 0.2) {
                  extraBallsEarnedThisTurn += 1;
                  floatingTexts.push({
                    x: brick.x + brick.width / 2,
                    y: brick.y,
                    text: '+1 Ball Gift!',
                    color: '#05FFA1',
                    alpha: 1.0,
                    vy: -1.2,
                  });
                }
              }

              break; // One collision per ball per frame
            }
          }
        }

        // 8.3 ALL BALLS RETURNED: ROUND COMPLETE
        if (ballsToLaunchQueue === 0 && activeBallsCount === 0) {
          // Check level complete (all breakable bricks destroyed)
          const remainingBricks = bricks.filter((b) => b.alive).length;

          if (remainingBricks === 0) {
            // Level Cleared!
            phase = 'LEVEL_CLEARED';
            playLevelCompleteFanfare();

            const nextLevel = Math.min(300, level + 1);
            const newMaxUnlocked = Math.max(maxUnlockedLevelRef.current, nextLevel);
            maxUnlockedLevelRef.current = newMaxUnlocked;
            setMaxUnlockedLevel(newMaxUnlocked);
            localStorage.setItem('bbt_max_unlocked_level', String(newMaxUnlocked));

            setTimeout(() => {
              loadLevel(nextLevel);
            }, 1400);
          } else {
            // Shift grid down by 1 row!
            phase = 'SHIFTING';
            shiftStartTime = currentTime;
            shiftProgress = 0;

            // Apply newly earned balls
            if (extraBallsEarnedThisTurn > 0) {
              currentBallsCount += extraBallsEarnedThisTurn;
              ballCountRef.current = currentBallsCount;
              setBallCount(currentBallsCount);
              localStorage.setItem('bbt_ball_count', String(currentBallsCount));
            }

            launcherX = nextLauncherX;
            balls.length = 0;
            setCanRecall(false);
          }
        }
      }

      // 8.4 SHIFTING ANIMATION & ROW PROGRESSION
      if (phase === 'SHIFTING') {
        const shiftElapsed = currentTime - shiftStartTime;
        shiftProgress = Math.min(1, shiftElapsed / shiftDuration);

        if (shiftProgress >= 1) {
          // Finish shift
          phase = 'AIMING';
          wave++;

          // Shift all existing brick rows down
          for (const b of bricks) {
            if (!b.alive) continue;
            b.row += 1;
            const rect = getTileRect(b.row, b.col);
            b.x = rect.x;
            b.y = rect.y;

            // Danger check: Any brick on or past danger line causes Game Over!
            if (b.row >= DANGER_ROW) {
              phase = 'GAME_OVER';
              playExplodeSound();
              break;
            }
          }

          // Shift board items down
          for (const item of boardItems) {
            if (item.collected) continue;
            item.row += 1;
            const rect = getTileRect(item.row, item.col);
            item.x = rect.x + rect.width / 2;
            item.y = rect.y + rect.height / 2;
          }

          // Spawn brand new row of bricks at Row 0
          if (phase !== 'GAME_OVER') {
            spawnNewRowAtTop(level, wave);
          }
        }
      }

      // 8.5 UPDATE PARTICLES & TEXTS
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
      // 9. HARDWARE-ACCELERATED RENDER (Deep Navy Neon Arcade)
      // ─────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, w, h);

      // Deep Navy / Starry Cyberpunk Backdrop (matching user screenshots)
      ctx.fillStyle = '#080E1E';
      ctx.fillRect(0, 0, w, h);

      // Subtle Background Grid
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.04)';
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

      // Danger Line (Glowing warning threshold)
      ctx.strokeStyle = 'rgba(255, 42, 109, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(PLAY_PADDING, DANGER_Y);
      ctx.lineTo(w - PLAY_PADDING, DANGER_Y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255, 42, 109, 0.6)';
      ctx.font = '600 10px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('DANGER LINE', w - PLAY_PADDING - 4, DANGER_Y - 4);

      // Interpolated downward shift offset
      const currentShiftOffset =
        phase === 'SHIFTING' ? shiftProgress * (TILE_HEIGHT + GRID_GAP) : 0;

      // Draw Bricks
      for (const b of bricks) {
        if (!b.alive) continue;
        const renderY = b.y + currentShiftOffset;

        ctx.save();
        ctx.shadowColor = b.borderColor;
        ctx.shadowBlur = 10;
        ctx.fillStyle = b.color;
        ctx.strokeStyle = b.borderColor;
        ctx.lineWidth = 2.2;

        if (b.shape === 'square') {
          ctx.beginPath();
          (ctx as any).roundRect
            ? (ctx as any).roundRect(b.x, renderY, b.width, b.height, 6)
            : ctx.rect(b.x, renderY, b.width, b.height);
          ctx.fill();
          ctx.stroke();
        } else if (b.shape === 'triangle_tl') {
          ctx.beginPath();
          ctx.moveTo(b.x, renderY);
          ctx.lineTo(b.x + b.width, renderY);
          ctx.lineTo(b.x, renderY + b.height);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (b.shape === 'triangle_tr') {
          ctx.beginPath();
          ctx.moveTo(b.x, renderY);
          ctx.lineTo(b.x + b.width, renderY);
          ctx.lineTo(b.x + b.width, renderY + b.height);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (b.shape === 'triangle_bl') {
          ctx.beginPath();
          ctx.moveTo(b.x, renderY);
          ctx.lineTo(b.x, renderY + b.height);
          ctx.lineTo(b.x + b.width, renderY + b.height);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (b.shape === 'triangle_br') {
          ctx.beginPath();
          ctx.moveTo(b.x + b.width, renderY);
          ctx.lineTo(b.x + b.width, renderY + b.height);
          ctx.lineTo(b.x, renderY + b.height);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore();

        // Draw Brick Number (Hit Counter)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 15px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(b.hp), b.x + b.width / 2, renderY + b.height / 2);
      }

      // Draw Board Items (+1 Ball, 2x Multiplier, Bomb)
      for (const item of boardItems) {
        if (item.collected) continue;
        const renderY = item.y + currentShiftOffset;

        ctx.save();
        if (item.type === 'ball_plus') {
          // Glowing Neon Ring with + inside
          ctx.shadowColor = '#05FFA1';
          ctx.shadowBlur = 12;
          ctx.strokeStyle = '#05FFA1';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(item.x, renderY, 13, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#05FFA1';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('+1', item.x, renderY);
        } else if (item.type === 'ball_double') {
          // Glowing Gold 2x Multiplier
          ctx.shadowColor = '#FFB800';
          ctx.shadowBlur = 14;
          ctx.fillStyle = 'rgba(255, 184, 0, 0.25)';
          ctx.strokeStyle = '#FFB800';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(item.x, renderY, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('2X', item.x, renderY);
        } else if (item.type === 'bomb') {
          ctx.shadowColor = '#FF2A6D';
          ctx.shadowBlur = 12;
          ctx.fillStyle = 'rgba(255, 42, 109, 0.3)';
          ctx.strokeStyle = '#FF2A6D';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(item.x, renderY, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('💣', item.x, renderY);
        }
        ctx.restore();
      }

      // Draw Particles
      for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Draw Floating Texts
      for (const ft of floatingTexts) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 13px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      // Draw Aiming Predictive Dotted Trajectory
      if (isAiming && phase === 'AIMING') {
        const trajectoryPoints = getAimTrajectory(aimX, aimY);
        if (trajectoryPoints && trajectoryPoints.length >= 2) {
          ctx.save();
          ctx.fillStyle = '#00E5FF';
          ctx.shadowColor = 'rgba(0, 229, 255, 0.8)';
          ctx.shadowBlur = 8;

          // Draw dotted dots along the line
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
              ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Target endpoint ring
          const endPoint = trajectoryPoints[trajectoryPoints.length - 1];
          ctx.strokeStyle = '#00E5FF';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(endPoint.x, endPoint.y, 8, 0, Math.PI * 2);
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

      // Draw Launcher Base & Ball Count Label at Bottom
      const curLauncherX = phase === 'AIMING' ? launcherX : nextLauncherX;
      ctx.save();
      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(curLauncherX, LAUNCHER_Y, BALL_RADIUS + 2, 0, Math.PI * 2);
      ctx.fill();

      // Animal head inside launcher ball
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

      // Ball Count Badge (e.g. x5, x10)
      ctx.fillStyle = '#00E5FF';
      ctx.font = 'bold 12px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`x${currentBallsCount}`, curLauncherX, LAUNCHER_Y + 22);

      // Overlays
      if (phase === 'LEVEL_CLEARED') {
        ctx.fillStyle = 'rgba(8, 14, 30, 0.9)';
        ctx.fillRect(0, 140, w, 140);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#05FFA1';
        ctx.font = '700 24px -apple-system, sans-serif';
        ctx.fillText(`✨ LEVEL ${level} CLEARED! ✨`, w / 2, 195);
        ctx.font = '500 13px -apple-system, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`Starting Level ${Math.min(300, level + 1)}...`, w / 2, 230);
      } else if (phase === 'GAME_OVER') {
        ctx.fillStyle = 'rgba(8, 14, 30, 0.94)';
        ctx.fillRect(0, 140, w, 150);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FF2A6D';
        ctx.font = '700 24px -apple-system, sans-serif';
        ctx.fillText('GAME OVER', w / 2, 190);
        ctx.font = '500 13px -apple-system, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`Bricks reached the danger line! Score: ${score}`, w / 2, 220);
        ctx.fillStyle = '#00E5FF';
        ctx.fillText('Tap Retry to play again', w / 2, 246);
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
        backgroundColor: '#080E1E',
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
          borderBottom: '1px solid rgba(0, 229, 255, 0.15)',
          backgroundColor: '#0D1527',
        }}
      >
        {/* Restored Title with 🧱 BRICK BREAKER THROW */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontWeight: 700,
            fontSize: 15,
            color: '#00E5FF',
            letterSpacing: '0.2px',
          }}
        >
          <span>🧱 BRICK BREAKER THROW</span>
        </div>

        {/* Level & Highscore */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#FFFFFF' }}>
            LVL {currentLevel}/300
          </span>
          <span style={{ fontSize: 11, color: '#8892B0' }}>
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
              backgroundColor: '#162238',
              border: '1.5px solid #00E5FF',
              cursor: 'pointer',
              padding: 0,
              boxShadow: '0 0 10px rgba(0, 229, 255, 0.25)',
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
                backgroundColor: '#FF2A6D',
                color: '#FFFFFF',
                fontSize: 10,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
                border: '2px solid #080E1E',
                boxShadow: '0 0 8px rgba(255, 42, 109, 0.6)',
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
              backgroundColor: '#162238',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              color: '#CCD6F6',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
            title="Security PIN"
          >
            <Lock size={13} color="#00E5FF" />
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
          color: '#8892B0',
          borderTop: '1px solid rgba(0, 229, 255, 0.15)',
          backgroundColor: '#0D1527',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Drag to aim • Release to shoot {ballCount} balls</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Recall Button (appears after 3.5s flight) */}
          {canRecall && (
            <button
              onClick={triggerRecall}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 6,
                backgroundColor: 'rgba(255, 42, 109, 0.2)',
                border: '1px solid #FF2A6D',
                color: '#FF2A6D',
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
                speedMultiplier > 1 ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)',
              border: `1px solid ${speedMultiplier > 1 ? '#00E5FF' : 'rgba(255, 255, 255, 0.15)'}`,
              color: speedMultiplier > 1 ? '#00E5FF' : '#8892B0',
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
