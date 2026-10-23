// src/screens/game/BrickBreakerGameScreen.js
// Ultra-Low Latency Animal Smash (Brick Breaker) Game — "The Hidden Gem"
// 60-120 FPS Native-Direct Physics Engine (0ms React State Overhead in Game Loop)
// Panda, Cat & Puppy character heads act as the high-velocity smashing balls!
// Falling gifts (Multi-Ball, +100 Points, +1 Life, Wide Paddle) drop from smashed bricks.
// Secret 3-second hold on the top animal icon:
//   - New User (!isSetup) -> Directly opens In-App Real Google Sign-In Onboarding (No PIN asked!)
//   - Signed-in User (isSetup) -> Prompts for Secret Vault PIN to enter encrypted chat directly!
// Zero visible lock buttons on screen.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  PanResponder,
  Modal,
  TextInput,
  Alert,
  StatusBar,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Play, RotateCcw, Trophy, Heart, Sparkles } from 'lucide-react-native';

import { CharacterBall } from '../../animal_ui/components/CharacterBall.js';
import { useUserStore } from '../../store/useUserStore';
import { instantEraseEverything } from '../../services/panicService';
import GoogleOnboardingModal from '../onboarding/GoogleOnboardingModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Game Board Dimensions
const BOARD_PADDING = 16;
const BOARD_WIDTH = SCREEN_WIDTH - BOARD_PADDING * 2;
const BALL_SIZE = 34;
const PADDLE_HEIGHT = 14;
const BASE_PADDLE_WIDTH = 96;
const WIDE_PADDLE_WIDTH = 138;
const BRICK_ROWS = 5;
const BRICK_COLS = 5;
const BRICK_GAP = 6;
const BRICK_HEIGHT = 22;
const BRICK_WIDTH = (BOARD_WIDTH - (BRICK_COLS - 1) * BRICK_GAP) / BRICK_COLS;
const GIFT_SIZE = 28;

// Pool capacities
const MAX_BALLS = 4;
const MAX_GIFTS = 6;

// Claude Brick Colors
const ROW_COLORS = [
  { color: '#D97757', border: '#B85D3F', points: 50 }, // Terracotta
  { color: '#E28743', border: '#C06B2B', points: 40 }, // Amber
  { color: '#6E8879', border: '#536D5E', points: 30 }, // Earthy Sage
  { color: '#5B7C99', border: '#43617A', points: 20 }, // Slate Blue
  { color: '#B37D80', border: '#946164', points: 10 }, // Soft Rose Clay
];

// Distinct level patterns
const LEVEL_PATTERNS = {
  1: (r, c) => true, // Full 5x5 grid
  2: (r, c) => r + c >= 2 && c - r <= 2, // Pyramid
  3: (r, c) => (r + c) % 2 === 0, // Checkerboard fortress
  4: (r, c) => r === 0 || r === 4 || c === 0 || c === 4 || (r === 2 && c === 2), // Ring maze
};

// Pure brick generator outside component to avoid setState during render
function generateBricksData(lvl = 1) {
  const patternFn = LEVEL_PATTERNS[lvl] || LEVEL_PATTERNS[1];
  const newBricks = [];
  const topOffset = 22;

  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      if (!patternFn(r, c)) continue;
      const rowStyle = ROW_COLORS[r % ROW_COLORS.length];
      newBricks.push({
        id: `b_${r}_${c}`,
        x: c * (BRICK_WIDTH + BRICK_GAP),
        y: topOffset + r * (BRICK_HEIGHT + BRICK_GAP),
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
        color: rowStyle.color,
        border: rowStyle.border,
        points: rowStyle.points * lvl,
        active: true,
      });
    }
  }
  return newBricks;
}

export default function BrickBreakerGameScreen({ route, navigation, onUnlock }) {
  const insets = useSafeAreaInsets();

  // User state
  const isSetup = useUserStore((s) => s.isSetup);
  const stealthPin = useUserStore((s) => s.stealthPin) || '1357';
  const stealthDuressPin = useUserStore((s) => s.stealthDuressPin) || '9999';
  const stealthDecoyPin = useUserStore((s) => s.stealthDecoyPin) || '0000';
  const setStealthUnlocked = useUserStore((s) => s.setStealthUnlocked);
  const setDecoyUnlocked = useUserStore((s) => s.setDecoyUnlocked);
  const gameHighScore = useUserStore((s) => s.gameHighScore) || 0;
  const setGameHighScore = useUserStore((s) => s.setGameHighScore);
  const myCharacter = useUserStore((s) => s.myCharacter) || 'panda';

  const boardHeight = Math.min(SCREEN_HEIGHT - insets.top - insets.bottom - 150, 530);
  const paddleY = boardHeight - 38;

  // Selected companion persona
  const [character, setCharacter] = useState(myCharacter);

  // HUD stats
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gameState, setGameState] = useState('ready'); // 'ready' | 'playing' | 'cleared' | 'over'
  const [activeBanner, setActiveBanner] = useState(null);

  // Bricks state initialized synchronously
  const [bricks, setBricks] = useState(() => generateBricksData(1));
  const bricksRef = useRef(bricks);
  const remainingBricksRef = useRef(bricks.length);
  const brickRefs = useRef({});

  // Synchronize bricksRef with state
  useEffect(() => {
    bricksRef.current = bricks;
    remainingBricksRef.current = bricks.filter((b) => b.active).length;
  }, [bricks]);

  // ── ZERO LATENCY NATIVE REFS ──
  const paddleRef = useRef(null);
  const paddleXRef = useRef(BOARD_WIDTH / 2 - BASE_PADDLE_WIDTH / 2);
  const paddleWidthRef = useRef(BASE_PADDLE_WIDTH);
  const widePaddleTimerRef = useRef(null);

  // Balls direct native View refs
  const ballRef0 = useRef(null);
  const ballRef1 = useRef(null);
  const ballRef2 = useRef(null);
  const ballRef3 = useRef(null);
  const ballViewRefs = useRef([ballRef0, ballRef1, ballRef2, ballRef3]).current;

  // Ball pool state
  const ballsState = useRef([
    { id: 0, active: true, x: 0, y: 0, vx: 0, vy: 0, character: 'panda' },
    { id: 1, active: false, x: -999, y: -999, vx: 0, vy: 0, character: 'cat' },
    { id: 2, active: false, x: -999, y: -999, vx: 0, vy: 0, character: 'puppy' },
    { id: 3, active: false, x: -999, y: -999, vx: 0, vy: 0, character: 'panda' },
  ]);

  // Gifts direct native View refs
  const giftRef0 = useRef(null);
  const giftRef1 = useRef(null);
  const giftRef2 = useRef(null);
  const giftRef3 = useRef(null);
  const giftRef4 = useRef(null);
  const giftRef5 = useRef(null);
  const giftViewRefs = useRef([giftRef0, giftRef1, giftRef2, giftRef3, giftRef4, giftRef5]).current;

  // Gift pool state
  const giftsState = useRef([
    { id: 0, active: false, x: -999, y: -999, vy: 0, type: 'multiball', emoji: '🐾' },
    { id: 1, active: false, x: -999, y: -999, vy: 0, type: 'points', emoji: '🎁' },
    { id: 2, active: false, x: -999, y: -999, vy: 0, type: 'heart', emoji: '❤️' },
    { id: 3, active: false, x: -999, y: -999, vy: 0, type: 'wide', emoji: '⚡' },
    { id: 4, active: false, x: -999, y: -999, vy: 0, type: 'multiball', emoji: '🐾' },
    { id: 5, active: false, x: -999, y: -999, vy: 0, type: 'points', emoji: '🎁' },
  ]);

  // Loop control
  const gameStateRef = useRef('ready');
  const animFrameRef = useRef(null);
  const scoreRef = useRef(0);
  const boardHeightRef = useRef(boardHeight);
  const paddleYRef = useRef(paddleY);
  const levelRef = useRef(level);

  // Keep layout refs updated
  boardHeightRef.current = boardHeight;
  paddleYRef.current = paddleY;
  levelRef.current = level;

  // Modals
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [showGoogleOnboarding, setShowGoogleOnboarding] = useState(false);
  const [showLevelPicker, setShowLevelPicker] = useState(false);

  // 3-Second Hold on Top Animal Icon state
  const holdTimerRef = useRef(null);
  const holdStartRef = useRef(0);
  const holdProgressAnim = useRef(new Animated.Value(0)).current;
  const [isHolding, setIsHolding] = useState(false);

  // Reset ball on top of paddle
  const resetBallToPaddle = useCallback(() => {
    const initX = paddleXRef.current + paddleWidthRef.current / 2 - BALL_SIZE / 2;
    const initY = paddleYRef.current - BALL_SIZE - 2;
    const baseSpeed = 7.2 + (levelRef.current - 1) * 0.5;

    // Reset main ball
    const b0 = ballsState.current[0];
    b0.active = true;
    b0.x = initX;
    b0.y = initY;
    b0.vx = (Math.random() > 0.5 ? 1 : -1) * (baseSpeed * 0.7);
    b0.vy = -baseSpeed;
    b0.character = character;

    ballViewRefs[0].current?.setNativeProps({
      style: { left: initX, top: initY, opacity: 1 },
    });

    // Deactivate multi-balls
    for (let i = 1; i < MAX_BALLS; i++) {
      ballsState.current[i].active = false;
      ballsState.current[i].x = -999;
      ballsState.current[i].y = -999;
      ballViewRefs[i].current?.setNativeProps({
        style: { left: -999, top: -999, opacity: 0 },
      });
    }

    // Deactivate gifts
    for (let k = 0; k < MAX_GIFTS; k++) {
      giftsState.current[k].active = false;
      giftsState.current[k].x = -999;
      giftsState.current[k].y = -999;
      giftViewRefs[k].current?.setNativeProps({
        style: { left: -999, top: -999, opacity: 0 },
      });
    }
  }, [character, ballViewRefs, giftViewRefs]);

  // Initial ball setup on mount
  useEffect(() => {
    resetBallToPaddle();
  }, [resetBallToPaddle]);

  // PanResponder for ZERO-LATENCY Direct Paddle Movement
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        let newX = gestureState.moveX - BOARD_PADDING - paddleWidthRef.current / 2;
        if (newX < 0) newX = 0;
        if (newX > BOARD_WIDTH - paddleWidthRef.current) {
          newX = BOARD_WIDTH - paddleWidthRef.current;
        }

        paddleXRef.current = newX;
        // Direct native write to paddle — 0ms React latency!
        paddleRef.current?.setNativeProps({
          style: { left: newX },
        });

        // If ball ready to launch, track it directly on paddle
        if (gameStateRef.current === 'ready') {
          const ballX = newX + paddleWidthRef.current / 2 - BALL_SIZE / 2;
          const ballY = paddleYRef.current - BALL_SIZE - 2;
          ballsState.current[0].x = ballX;
          ballsState.current[0].y = ballY;
          ballViewRefs[0].current?.setNativeProps({
            style: { left: ballX, top: ballY, opacity: 1 },
          });
        }
      },
    })
  ).current;

  // Launch ball
  const launchBall = () => {
    if (gameStateRef.current === 'ready') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (_) {}
      gameStateRef.current = 'playing';
      setGameState('playing');
    }
  };

  // Spawn Multi-Ball helper (Fast & instant)
  const spawnMultiBall = () => {
    const pX = paddleXRef.current;
    const baseSpeed = 7.2 + (levelRef.current - 1) * 0.5;

    let spawned = 0;
    for (let i = 1; i < MAX_BALLS && spawned < 2; i++) {
      const b = ballsState.current[i];
      if (!b.active) {
        b.active = true;
        b.x = pX + (spawned === 0 ? 12 : paddleWidthRef.current - BALL_SIZE - 12);
        b.y = paddleYRef.current - BALL_SIZE - 6;
        b.vx = (spawned === 0 ? -1 : 1) * (baseSpeed * 0.75);
        b.vy = -baseSpeed;
        ballViewRefs[i].current?.setNativeProps({
          style: { left: b.x, top: b.y, opacity: 1 },
        });
        spawned++;
      }
    }
    showBanner('🐾 MULTI-BALL ACTIVATED!');
  };

  // Expand Paddle helper
  const expandPaddle = () => {
    paddleWidthRef.current = WIDE_PADDLE_WIDTH;
    paddleRef.current?.setNativeProps({
      style: { width: WIDE_PADDLE_WIDTH },
    });
    showBanner('⚡ WIDE PADDLE!');

    if (widePaddleTimerRef.current) clearTimeout(widePaddleTimerRef.current);
    widePaddleTimerRef.current = setTimeout(() => {
      paddleWidthRef.current = BASE_PADDLE_WIDTH;
      paddleRef.current?.setNativeProps({
        style: { width: BASE_PADDLE_WIDTH },
      });
    }, 12000);
  };

  // Show floating power-up banner
  const showBanner = (msg) => {
    setActiveBanner(msg);
    setTimeout(() => setActiveBanner(null), 2200);
  };

  // ── ZERO LATENCY 60-120 FPS NATIVE GAME LOOP ──
  useEffect(() => {
    let lastTime = Date.now();
    let isCancelled = false;

    const loop = () => {
      if (isCancelled) return;

      if (gameStateRef.current === 'playing') {
        const now = Date.now();
        const dt = Math.min((now - lastTime) / 16.67, 1.6);
        lastTime = now;

        const pX = paddleXRef.current;
        const pWidth = paddleWidthRef.current;
        const pY = paddleYRef.current;
        const bHeight = boardHeightRef.current;
        const currentBricks = bricksRef.current;

        let activeBallsCount = 0;

        // ── 1. Update Each Ball Directly in Native View ──
        for (let i = 0; i < MAX_BALLS; i++) {
          const ball = ballsState.current[i];
          if (!ball.active) continue;

          activeBallsCount++;
          ball.x += ball.vx * dt;
          ball.y += ball.vy * dt;

          // Side Wall Collisions
          if (ball.x <= 0) {
            ball.x = 0;
            ball.vx = Math.abs(ball.vx);
          } else if (ball.x + BALL_SIZE >= BOARD_WIDTH) {
            ball.x = BOARD_WIDTH - BALL_SIZE;
            ball.vx = -Math.abs(ball.vx);
          }

          // Top Wall Collision
          if (ball.y <= 0) {
            ball.y = 0;
            ball.vy = Math.abs(ball.vy);
          }

          // Paddle Collision
          if (
            ball.y + BALL_SIZE >= pY &&
            ball.y + BALL_SIZE <= pY + PADDLE_HEIGHT + 8 &&
            ball.x + BALL_SIZE >= pX - 4 &&
            ball.x <= pX + pWidth + 4 &&
            ball.vy > 0
          ) {
            const paddleCenter = pX + pWidth / 2;
            const ballCenter = ball.x + BALL_SIZE / 2;
            const hitFactor = (ballCenter - paddleCenter) / (pWidth / 2); // -1 to 1

            const currentSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            const angle = hitFactor * (Math.PI / 3); // Max 60 deg deflection

            ball.vx = currentSpeed * Math.sin(angle);
            ball.vy = -Math.abs(currentSpeed * Math.cos(angle));
            ball.y = pY - BALL_SIZE;

            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (_) {}
          }

          // Brick Collisions
          for (let j = 0; j < currentBricks.length; j++) {
            const b = currentBricks[j];
            if (!b.active) continue;

            if (
              ball.x + BALL_SIZE > b.x &&
              ball.x < b.x + b.width &&
              ball.y + BALL_SIZE > b.y &&
              ball.y < b.y + b.height
            ) {
              b.active = false;
              remainingBricksRef.current -= 1;

              // Hide brick view immediately via native ref (0ms delay!)
              brickRefs.current[b.id]?.setNativeProps({
                style: { opacity: 0 },
              });

              // Accurate bounce
              const prevX = ball.x - ball.vx * dt;
              if (prevX + BALL_SIZE <= b.x || prevX >= b.x + b.width) {
                ball.vx = -ball.vx;
              } else {
                ball.vy = -ball.vy;
              }

              // Update Score
              scoreRef.current += b.points;
              setScore(scoreRef.current);

              // 40% chance to drop a falling Gift!
              if (Math.random() < 0.4) {
                const types = [
                  { type: 'multiball', emoji: '🐾', label: 'Multi-Ball' },
                  { type: 'points', emoji: '🎁', label: '+100 pts' },
                  { type: 'heart', emoji: '❤️', label: '+1 Life' },
                  { type: 'wide', emoji: '⚡', label: 'Wide Paddle' },
                ];
                const picked = types[Math.floor(Math.random() * types.length)];

                // Find inactive gift slot
                const giftSlot = giftsState.current.find((g) => !g.active);
                if (giftSlot) {
                  giftSlot.active = true;
                  giftSlot.x = b.x + b.width / 2 - GIFT_SIZE / 2;
                  giftSlot.y = b.y + b.height;
                  giftSlot.vy = 3.2;
                  giftSlot.type = picked.type;
                  giftSlot.emoji = picked.emoji;
                }
              }

              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              } catch (_) {}
              break;
            }
          }

          // Ball Fell Off Bottom
          if (ball.y > bHeight) {
            ball.active = false;
            ballViewRefs[i].current?.setNativeProps({
              style: { left: -999, top: -999, opacity: 0 },
            });
            continue;
          }

          // Write updated ball coordinates directly to native view
          ballViewRefs[i].current?.setNativeProps({
            style: { left: ball.x, top: ball.y, opacity: 1 },
          });
        }

        // Check if all balls lost
        if (activeBallsCount === 0) {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          } catch (_) {}

          setLives((prev) => {
            const next = prev - 1;
            if (next <= 0) {
              gameStateRef.current = 'over';
              setGameState('over');
              setGameHighScore(scoreRef.current);
            } else {
              gameStateRef.current = 'ready';
              setGameState('ready');
              resetBallToPaddle();
            }
            return next;
          });
        }

        // ── 2. Update Falling Gifts Directly in Native Views ──
        for (let k = 0; k < MAX_GIFTS; k++) {
          const g = giftsState.current[k];
          if (!g.active) continue;

          g.y += g.vy * dt;

          // Caught by paddle!
          if (
            g.y + GIFT_SIZE >= pY &&
            g.y <= pY + PADDLE_HEIGHT &&
            g.x + GIFT_SIZE >= pX &&
            g.x <= pX + pWidth
          ) {
            g.active = false;
            giftViewRefs[k].current?.setNativeProps({
              style: { left: -999, top: -999, opacity: 0 },
            });

            if (g.type === 'multiball') {
              spawnMultiBall();
            } else if (g.type === 'points') {
              scoreRef.current += 100;
              setScore(scoreRef.current);
              showBanner('🎁 +100 BONUS POINTS!');
            } else if (g.type === 'heart') {
              setLives((l) => Math.min(l + 1, 5));
              showBanner('❤️ +1 EXTRA LIFE!');
            } else if (g.type === 'wide') {
              expandPaddle();
            }

            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (_) {}
            continue;
          }

          // Fell past bottom
          if (g.y > bHeight) {
            g.active = false;
            giftViewRefs[k].current?.setNativeProps({
              style: { left: -999, top: -999, opacity: 0 },
            });
            continue;
          }

          // Write updated gift position directly to native view
          giftViewRefs[k].current?.setNativeProps({
            style: { left: g.x, top: g.y, opacity: 1 },
          });
        }

        // ── 3. Check Level Cleared ──
        if (remainingBricksRef.current <= 0) {
          gameStateRef.current = 'cleared';
          setGameState('cleared');
          scoreRef.current += 200 * levelRef.current;
          setScore(scoreRef.current);
          setGameHighScore(scoreRef.current);
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (_) {}
          return;
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      isCancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [ballViewRefs, giftViewRefs, resetBallToPaddle, setGameHighScore]);

  // Next level handler
  const handleNextLevel = () => {
    const nextLvl = (level % 4) + 1;
    setLevel(nextLvl);
    const freshBricks = generateBricksData(nextLvl);
    setBricks(freshBricks);
    freshBricks.forEach((b) => {
      brickRefs.current[b.id]?.setNativeProps({ style: { opacity: 1 } });
    });
    resetBallToPaddle();
    gameStateRef.current = 'ready';
    setGameState('ready');
  };

  // Restart game
  const handleRestart = () => {
    scoreRef.current = 0;
    setScore(0);
    setLives(3);
    setLevel(1);
    const freshBricks = generateBricksData(1);
    setBricks(freshBricks);
    freshBricks.forEach((b) => {
      brickRefs.current[b.id]?.setNativeProps({ style: { opacity: 1 } });
    });
    resetBallToPaddle();
    gameStateRef.current = 'ready';
    setGameState('ready');
  };

  // ── SECRET 3-SECOND HOLD ON TOP ANIMAL ICON ──
  const handleAnimalPressIn = () => {
    holdStartRef.current = Date.now();
    setIsHolding(true);
    holdProgressAnim.setValue(0);

    Animated.timing(holdProgressAnim, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    }).start();

    // Haptics at 1s & 2s
    setTimeout(() => {
      if (holdStartRef.current) {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (_) {}
      }
    }, 1000);

    setTimeout(() => {
      if (holdStartRef.current) {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (_) {}
      }
    }, 2000);

    // 3-Second Completion Trigger!
    holdTimerRef.current = setTimeout(() => {
      holdStartRef.current = 0;
      setIsHolding(false);
      holdProgressAnim.setValue(0);

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}

      // Check User Setup Status:
      if (!isSetup) {
        // NEW USER: DO NOT ASK FOR PIN! Directly open In-App Real Google Sign-In Onboarding!
        setShowGoogleOnboarding(true);
      } else {
        // SIGNED-IN USER: Prompt for Secret PIN and send directly to chat interface!
        setShowPinModal(true);
      }
    }, 3000);
  };

  const handleAnimalPressOut = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    const elapsed = Date.now() - holdStartRef.current;
    holdStartRef.current = 0;
    setIsHolding(false);
    holdProgressAnim.setValue(0);

    // Quick tap switches companion avatar
    if (elapsed < 1200) {
      const next = character === 'panda' ? 'cat' : character === 'cat' ? 'puppy' : 'panda';
      setCharacter(next);
      ballsState.current[0].character = next;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (_) {}
    }
  };

  // Stealth PIN Verification
  const handleVerifyPin = async (pin) => {
    const cleanPin = (pin || enteredPin).trim();
    if (!cleanPin) return;

    // Silent Duress
    if (cleanPin === stealthDuressPin) {
      setShowPinModal(false);
      setEnteredPin('');
      await instantEraseEverything({ silent: true });
      return;
    }

    // Decoy Vault
    if (cleanPin === stealthDecoyPin) {
      setShowPinModal(false);
      setEnteredPin('');
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}
      setDecoyUnlocked(true);
      setStealthUnlocked(true);
      setTimeout(() => {
        if (onUnlock) onUnlock();
      }, 0);
      return;
    }

    // Secret Vault Unlock PIN -> Direct to Chat Interface!
    if (cleanPin === stealthPin) {
      setShowPinModal(false);
      setEnteredPin('');
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}
      setDecoyUnlocked(false);
      setStealthUnlocked(true);
      setTimeout(() => {
        if (onUnlock) onUnlock();
        else if (navigation?.canGoBack()) navigation.goBack();
      }, 0);
      return;
    }

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (_) {}
    Alert.alert('Incorrect PIN', 'Please try again.');
    setEnteredPin('');
  };

  const canGoBack = navigation?.canGoBack?.();

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F5" />

      {/* Top Header Bar (Zero Lock Icons!) */}
      <View style={styles.header}>
        {canGoBack ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color="#141413" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}

        {/* Center: Secret 3-Second Animal Companion Icon */}
        <TouchableOpacity
          onPressIn={handleAnimalPressIn}
          onPressOut={handleAnimalPressOut}
          activeOpacity={0.8}
          style={styles.animalCenterWrap}
        >
          {isHolding && (
            <Animated.View
              style={[
                styles.holdingHalo,
                {
                  transform: [
                    {
                      scale: holdProgressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.35],
                      }),
                    },
                  ],
                  opacity: holdProgressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 0.9],
                  }),
                },
              ]}
            />
          )}
          <View style={styles.animalIconBox}>
            <CharacterBall character={character} size={38} />
          </View>
        </TouchableOpacity>

        {/* Right: Level Switcher Pill */}
        <TouchableOpacity
          style={styles.levelPill}
          onPress={() => setShowLevelPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.levelPillText}>LVL {level}</Text>
        </TouchableOpacity>
      </View>

      {/* Score & Lives HUD */}
      <View style={styles.hud}>
        <View style={styles.hudCard}>
          <Text style={styles.hudLabel}>SCORE</Text>
          <Text style={styles.hudVal}>{score}</Text>
        </View>

        <View style={styles.hudCardCenter}>
          <View style={styles.livesRow}>
            {[1, 2, 3].map((heartIndex) => (
              <Heart
                key={heartIndex}
                size={18}
                color={heartIndex <= lives ? '#D97757' : '#D4D0C5'}
                fill={heartIndex <= lives ? '#D97757' : 'transparent'}
                style={{ marginHorizontal: 2 }}
              />
            ))}
          </View>
          <Text style={styles.livesLabel}>LIVES</Text>
        </View>

        <View style={styles.hudCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Trophy size={12} color="#D97757" style={{ marginRight: 4 }} />
            <Text style={styles.hudLabel}>BEST</Text>
          </View>
          <Text style={styles.hudVal}>{Math.max(gameHighScore, score)}</Text>
        </View>
      </View>

      {/* Main Game Board Canvas with Zero-Latency Pan */}
      <View
        style={[styles.board, { height: boardHeight }]}
        {...panResponder.panHandlers}
      >
        {/* Render Bricks */}
        {bricks.map((b) => (
          <View
            key={b.id}
            ref={(el) => {
              brickRefs.current[b.id] = el;
            }}
            style={[
              styles.brick,
              {
                left: b.x,
                top: b.y,
                width: b.width,
                height: b.height,
                backgroundColor: b.color,
                borderColor: b.border,
              },
            ]}
          >
            <View style={styles.brickShine} />
          </View>
        ))}

        {/* Falling Gifts Direct Views (Native-controlled) */}
        {giftsState.current.map((g, k) => (
          <View
            key={g.id}
            ref={giftViewRefs[k]}
            style={[
              styles.giftItem,
              {
                left: -999,
                top: -999,
                opacity: 0,
              },
            ]}
          >
            <Text style={styles.giftEmoji}>{g.emoji}</Text>
          </View>
        ))}

        {/* Active Power-up Floating Banner */}
        {activeBanner && (
          <View style={styles.powerupBanner}>
            <Sparkles size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.powerupBannerText}>{activeBanner}</Text>
          </View>
        )}

        {/* Zero Latency Paddle View (Native Ref) */}
        <View
          ref={paddleRef}
          style={[
            styles.paddle,
            {
              left: paddleXRef.current,
              top: paddleY,
              width: paddleWidthRef.current,
              height: PADDLE_HEIGHT,
            },
          ]}
        >
          <View style={styles.paddleAccent} />
        </View>

        {/* Zero Latency Balls Pool (Native Views with Direct setNativeProps) */}
        {ballsState.current.map((b, i) => (
          <View
            key={b.id}
            ref={ballViewRefs[i]}
            style={[
              styles.ballWrap,
              {
                left: -999,
                top: -999,
                width: BALL_SIZE,
                height: BALL_SIZE,
                opacity: 0,
              },
            ]}
          >
            <CharacterBall
              character={i === 0 ? character : i === 1 ? 'cat' : i === 2 ? 'puppy' : 'panda'}
              size={BALL_SIZE}
            />
          </View>
        ))}

        {/* Tap to Serve Banner */}
        {gameState === 'ready' && (
          <TouchableOpacity
            style={styles.serveOverlay}
            onPress={launchBall}
            activeOpacity={0.8}
          >
            <Play size={18} color="#FAF9F5" fill="#FAF9F5" />
            <Text style={styles.serveText}>Tap screen to smash bricks!</Text>
          </TouchableOpacity>
        )}

        {/* Level Cleared Overlay */}
        {gameState === 'cleared' && (
          <View style={styles.overlayCard}>
            <Text style={styles.overlayEmoji}>🎉</Text>
            <Text style={styles.overlayTitle}>Level {level} Cleared!</Text>
            <Text style={styles.overlaySub}>+{200 * level} Bonus Points</Text>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={handleNextLevel}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryActionBtnText}>Next Level →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Game Over Overlay */}
        {gameState === 'over' && (
          <View style={styles.overlayCard}>
            <Text style={styles.overlayEmoji}>🐾</Text>
            <Text style={styles.overlayTitle}>Game Over!</Text>
            <Text style={styles.overlaySub}>Final Score: {score}</Text>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={handleRestart}
              activeOpacity={0.85}
            >
              <RotateCcw size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.primaryActionBtnText}>Play Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Footer Tip */}
      <View style={styles.footer}>
        <Text style={styles.footerTip}>
          {isHolding ? 'Hold 3s to unlock...' : 'Smash bricks & catch falling power-up gifts!'}
        </Text>
      </View>

      {/* Secret Stealth Vault PIN Modal */}
      <Modal
        visible={showPinModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPinModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowPinModal(false)}
        >
          <View style={styles.pinCard} onStartShouldSetResponder={() => true}>
            <View style={styles.pinIconCircle}>
              <CharacterBall character={character} size={36} />
            </View>
            <Text style={styles.pinTitle}>Enter Secret Vault PIN</Text>
            <Text style={styles.pinSubtitle}>
              Direct access to end-to-end encrypted chats
            </Text>

            <TextInput
              style={styles.pinInput}
              placeholder="••••"
              placeholderTextColor="#87867F"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              value={enteredPin}
              onChangeText={(text) => {
                setEnteredPin(text);
                if (text.length >= 4) {
                  handleVerifyPin(text);
                }
              }}
              autoFocus
            />

            <View style={styles.pinBtnRow}>
              <TouchableOpacity
                style={styles.pinCancelBtn}
                onPress={() => {
                  setShowPinModal(false);
                  setEnteredPin('');
                }}
              >
                <Text style={styles.pinCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pinConfirmBtn}
                onPress={() => handleVerifyPin(enteredPin)}
              >
                <Text style={styles.pinConfirmText}>Unlock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 100% In-App Real Google Sign-In Onboarding Modal for New Users */}
      <GoogleOnboardingModal
        visible={showGoogleOnboarding}
        onClose={() => setShowGoogleOnboarding(false)}
        onComplete={() => {
          setShowGoogleOnboarding(false);
          setTimeout(() => {
            if (onUnlock) onUnlock();
          }, 0);
        }}
      />

      {/* Level Select Modal */}
      <Modal
        visible={showLevelPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLevelPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowLevelPicker(false)}
        >
          <View style={styles.levelCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.levelCardTitle}>Select Level</Text>
            <View style={styles.levelBtnGrid}>
              {[1, 2, 3, 4].map((lvl) => (
                <TouchableOpacity
                  key={lvl}
                  style={[styles.levelSelectBtn, level === lvl && styles.levelSelectBtnActive]}
                  onPress={() => {
                    setShowLevelPicker(false);
                    setLevel(lvl);
                    const fresh = generateBricksData(lvl);
                    setBricks(fresh);
                    fresh.forEach((b) => {
                      brickRefs.current[b.id]?.setNativeProps({ style: { opacity: 1 } });
                    });
                    resetBallToPaddle();
                  }}
                >
                  <Text style={[styles.levelSelectText, level === lvl && styles.levelSelectTextActive]}>
                    Level {lvl}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAF9F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BOARD_PADDING,
    paddingVertical: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  animalCenterWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdingHalo: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: '#D97757',
  },
  animalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(20,20,19,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  levelPill: {
    backgroundColor: 'rgba(217,119,87,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(217,119,87,0.25)',
  },
  levelPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97757',
  },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: BOARD_PADDING,
    paddingVertical: 10,
  },
  hudCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.08)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  hudCardCenter: {
    alignItems: 'center',
  },
  hudLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#87867F',
    letterSpacing: 0.5,
  },
  hudVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#141413',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  livesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  livesLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#87867F',
    marginTop: 3,
    letterSpacing: 0.5,
  },
  board: {
    marginHorizontal: BOARD_PADDING,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.1)',
    overflow: 'hidden',
    position: 'relative',
  },
  brick: {
    position: 'absolute',
    borderRadius: 5,
    borderWidth: 1,
    overflow: 'hidden',
  },
  brickShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  paddle: {
    position: 'absolute',
    backgroundColor: '#2C2C2A',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#D97757',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  paddleAccent: {
    width: 24,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#D97757',
  },
  ballWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftItem: {
    position: 'absolute',
    width: GIFT_SIZE,
    height: GIFT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: GIFT_SIZE / 2,
    borderWidth: 1,
    borderColor: '#D97757',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  giftEmoji: {
    fontSize: 15,
  },
  powerupBanner: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97757',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
    zIndex: 99,
  },
  powerupBannerText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  serveOverlay: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    backgroundColor: '#141413',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  serveText: {
    color: '#FAF9F5',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 8,
  },
  overlayCard: {
    position: 'absolute',
    top: '25%',
    left: 24,
    right: 24,
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.15)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    zIndex: 100,
  },
  overlayEmoji: {
    fontSize: 42,
    marginBottom: 8,
  },
  overlayTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#141413',
    marginBottom: 4,
  },
  overlaySub: {
    fontSize: 14,
    color: '#5E5D59',
    marginBottom: 20,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97757',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 20,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  footer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  footerTip: {
    fontSize: 12,
    color: '#87867F',
    fontWeight: '500',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pinCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FAF9F5',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.15)',
  },
  pinIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(217,119,87,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  pinTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#141413',
    marginBottom: 4,
  },
  pinSubtitle: {
    fontSize: 12,
    color: '#5E5D59',
    textAlign: 'center',
    marginBottom: 20,
  },
  pinInput: {
    width: '80%',
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.15)',
    textAlign: 'center',
    fontSize: 22,
    letterSpacing: 10,
    color: '#141413',
    marginBottom: 20,
  },
  pinBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  pinCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#F0EEE6',
    marginRight: 8,
  },
  pinCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5E5D59',
  },
  pinConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#D97757',
    marginLeft: 8,
  },
  pinConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  levelCard: {
    width: '100%',
    maxWidth: 300,
    backgroundColor: '#FAF9F5',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
  },
  levelCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#141413',
    marginBottom: 16,
  },
  levelBtnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  levelSelectBtn: {
    width: 100,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(20,20,19,0.12)',
    alignItems: 'center',
  },
  levelSelectBtnActive: {
    borderColor: '#D97757',
    backgroundColor: 'rgba(217,119,87,0.1)',
  },
  levelSelectText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5E5D59',
  },
  levelSelectTextActive: {
    color: '#D97757',
    fontWeight: '800',
  },
});
