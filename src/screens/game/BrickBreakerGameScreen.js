// src/screens/game/BrickBreakerGameScreen.js
// Animal Brick Breaker Game — "The Hidden Gem"
// High-energy Breakout game where Panda, Cat & Puppy heads act as the ball hitting bricks!
// Doubles as the innocent decoy game that unlocks SecureBox via secret PIN.

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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Lock, Play, RotateCcw, Volume2, Trophy, Heart, Pause } from 'lucide-react-native';

import { CharacterBall } from '../../animal_ui/components/CharacterBall.js';
import { useUserStore } from '../../store/useUserStore';
import { instantEraseEverything } from '../../services/panicService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Game Board Dimensions
const BOARD_PADDING = 16;
const BOARD_WIDTH = SCREEN_WIDTH - BOARD_PADDING * 2;
const BALL_SIZE = 34;
const PADDLE_HEIGHT = 14;
const PADDLE_WIDTH = 92;
const BRICK_ROWS = 5;
const BRICK_COLS = 5;
const BRICK_GAP = 6;
const BRICK_HEIGHT = 24;
const BRICK_WIDTH = (BOARD_WIDTH - (BRICK_COLS - 1) * BRICK_GAP) / BRICK_COLS;

// Claude-inspired Brick Color Palette
const ROW_COLORS = [
  { color: '#D97757', border: '#B85D3F', points: 50 }, // Terracotta
  { color: '#E28743', border: '#C06B2B', points: 40 }, // Amber
  { color: '#6E8879', border: '#536D5E', points: 30 }, // Earthy Sage
  { color: '#5B7C99', border: '#43617A', points: 20 }, // Slate Blue
  { color: '#B37D80', border: '#946164', points: 10 }, // Soft Rose Clay
];

export default function BrickBreakerGameScreen({ route, navigation, onUnlock }) {
  const insets = useSafeAreaInsets();

  // User store & stealth pins
  const stealthPin = useUserStore((s) => s.stealthPin) || '1357';
  const stealthDuressPin = useUserStore((s) => s.stealthDuressPin) || '9999';
  const stealthDecoyPin = useUserStore((s) => s.stealthDecoyPin) || '0000';
  const setStealthUnlocked = useUserStore((s) => s.setStealthUnlocked);
  const setDecoyUnlocked = useUserStore((s) => s.setDecoyUnlocked);
  const gameHighScore = useUserStore((s) => s.gameHighScore) || 0;
  const setGameHighScore = useUserStore((s) => s.setGameHighScore);
  const myCharacter = useUserStore((s) => s.myCharacter) || 'panda';

  // Game configuration & board layout
  const boardHeight = Math.min(SCREEN_HEIGHT - insets.top - insets.bottom - 160, 520);
  const paddleY = boardHeight - 40;

  // Selected character ball
  const [character, setCharacter] = useState(myCharacter);

  // Game state
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gameState, setGameState] = useState('ready'); // 'ready' | 'playing' | 'paused' | 'over' | 'cleared'
  const [bricks, setBricks] = useState([]);

  // Ball & Paddle coordinates in JS refs for 60fps loop
  const ballPosRef = useRef({ x: BOARD_WIDTH / 2 - BALL_SIZE / 2, y: paddleY - BALL_SIZE - 2 });
  const ballVelRef = useRef({ vx: 4, vy: -5 });
  const paddleXRef = useRef(BOARD_WIDTH / 2 - PADDLE_WIDTH / 2);
  const scoreRef = useRef(0);
  const bricksRef = useRef([]);
  const animFrameRef = useRef(null);
  const gameStateRef = useRef('ready');

  // React state for rendering
  const [ballDisplay, setBallDisplay] = useState({ x: BOARD_WIDTH / 2 - BALL_SIZE / 2, y: paddleY - BALL_SIZE - 2 });
  const [paddleX, setPaddleX] = useState(BOARD_WIDTH / 2 - PADDLE_WIDTH / 2);
  const [particles, setParticles] = useState([]); // Floating +points popups

  // Stealth PIN unlock modal state
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const secretTapCountRef = useRef(0);
  const secretTapTimerRef = useRef(null);

  // Initialize Bricks Grid
  const generateBricks = useCallback((lvl = 1) => {
    const newBricks = [];
    const topOffset = 20;

    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
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
    bricksRef.current = newBricks;
    setBricks(newBricks);
  }, []);

  // Set up board initially
  useEffect(() => {
    generateBricks(1);
    resetBallToPaddle();
  }, [generateBricks]);

  // Reset ball on top of paddle
  const resetBallToPaddle = () => {
    const initX = paddleXRef.current + PADDLE_WIDTH / 2 - BALL_SIZE / 2;
    const initY = paddleY - BALL_SIZE - 2;
    ballPosRef.current = { x: initX, y: initY };
    const baseSpeed = 4 + (level - 1) * 0.5;
    ballVelRef.current = { vx: (Math.random() > 0.5 ? 1 : -1) * baseSpeed, vy: -baseSpeed };
    setBallDisplay({ x: initX, y: initY });
  };

  // Paddle Drag PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        let newX = gestureState.moveX - BOARD_PADDING - PADDLE_WIDTH / 2;
        if (newX < 0) newX = 0;
        if (newX > BOARD_WIDTH - PADDLE_WIDTH) newX = BOARD_WIDTH - PADDLE_WIDTH;

        paddleXRef.current = newX;
        setPaddleX(newX);

        if (gameStateRef.current === 'ready') {
          const ballX = newX + PADDLE_WIDTH / 2 - BALL_SIZE / 2;
          const ballY = paddleY - BALL_SIZE - 2;
          ballPosRef.current = { x: ballX, y: ballY };
          setBallDisplay({ x: ballX, y: ballY });
        }
      },
    })
  ).current;

  // Launch Ball
  const launchBall = () => {
    if (gameStateRef.current === 'ready' || gameStateRef.current === 'paused') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (_) {}
      gameStateRef.current = 'playing';
      setGameState('playing');
    }
  };

  // Main 60 FPS Game Loop
  useEffect(() => {
    let lastTime = Date.now();

    const loop = () => {
      if (gameStateRef.current === 'playing') {
        const now = Date.now();
        const dt = Math.min((now - lastTime) / 16.67, 2); // Normalized time step
        lastTime = now;

        let { x, y } = ballPosRef.current;
        let { vx, vy } = ballVelRef.current;

        x += vx * dt;
        y += vy * dt;

        // 1. Wall Collisions
        if (x <= 0) {
          x = 0;
          vx = Math.abs(vx);
          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
        } else if (x + BALL_SIZE >= BOARD_WIDTH) {
          x = BOARD_WIDTH - BALL_SIZE;
          vx = -Math.abs(vx);
          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
        }

        if (y <= 0) {
          y = 0;
          vy = Math.abs(vy);
          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
        }

        // 2. Paddle Collision
        const pX = paddleXRef.current;
        if (
          y + BALL_SIZE >= paddleY &&
          y + BALL_SIZE <= paddleY + PADDLE_HEIGHT + 6 &&
          x + BALL_SIZE >= pX - 4 &&
          x <= pX + PADDLE_WIDTH + 4 &&
          vy > 0
        ) {
          // Calculate deflection angle based on hit spot
          const paddleCenter = pX + PADDLE_WIDTH / 2;
          const ballCenter = x + BALL_SIZE / 2;
          const hitFactor = (ballCenter - paddleCenter) / (PADDLE_WIDTH / 2); // -1 to 1

          const speed = Math.sqrt(vx * vx + vy * vy);
          const maxAngle = Math.PI / 3; // 60 degrees max
          const angle = hitFactor * maxAngle;

          vx = speed * Math.sin(angle);
          vy = -speed * Math.cos(angle);
          y = paddleY - BALL_SIZE;

          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
        }

        // 3. Brick Collisions
        let hitBrick = false;
        const currentBricks = bricksRef.current;
        for (let i = 0; i < currentBricks.length; i++) {
          const b = currentBricks[i];
          if (!b.active) continue;

          // AABB collision detection
          if (
            x + BALL_SIZE > b.x &&
            x < b.x + b.width &&
            y + BALL_SIZE > b.y &&
            y < b.y + b.height
          ) {
            b.active = false;
            hitBrick = true;

            // Bounce logic
            const prevX = ballPosRef.current.x;
            const prevY = ballPosRef.current.y;
            if (prevX + BALL_SIZE <= b.x || prevX >= b.x + b.width) {
              vx = -vx;
            } else {
              vy = -vy;
            }

            // Update score
            scoreRef.current += b.points;
            setScore(scoreRef.current);
            setGameHighScore(scoreRef.current);

            // Pop score particle
            setParticles((prev) => [
              ...prev.slice(-4),
              { id: Date.now() + Math.random(), text: `+${b.points}`, x: b.x + 8, y: b.y },
            ]);

            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch (_) {}
            break;
          }
        }

        if (hitBrick) {
          setBricks([...currentBricks]);

          // Check if all bricks cleared!
          const remaining = currentBricks.filter((b) => b.active);
          if (remaining.length === 0) {
            gameStateRef.current = 'cleared';
            setGameState('cleared');
            scoreRef.current += 200;
            setScore(scoreRef.current);
            setGameHighScore(scoreRef.current);
            try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
            return;
          }
        }

        // 4. Fall past paddle (Lose a life)
        if (y > boardHeight) {
          try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch (_) {}
          setLives((prevLives) => {
            const nextLives = prevLives - 1;
            if (nextLives <= 0) {
              gameStateRef.current = 'over';
              setGameState('over');
            } else {
              gameStateRef.current = 'ready';
              setGameState('ready');
              resetBallToPaddle();
            }
            return nextLives;
          });
          return;
        }

        ballPosRef.current = { x, y };
        ballVelRef.current = { vx, vy };
        setBallDisplay({ x, y });
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [boardHeight, setGameHighScore]);

  // Next Level Handler
  const handleNextLevel = () => {
    const nextLvl = level + 1;
    setLevel(nextLvl);
    generateBricks(nextLvl);
    resetBallToPaddle();
    gameStateRef.current = 'ready';
    setGameState('ready');
  };

  // Restart Game Handler
  const handleRestart = () => {
    setScore(0);
    scoreRef.current = 0;
    setLives(3);
    setLevel(1);
    generateBricks(1);
    resetBallToPaddle();
    gameStateRef.current = 'ready';
    setGameState('ready');
  };

  // Secret 4-Tap on Title / Logo to open Stealth Vault Unlock PIN
  const handleSecretTap = () => {
    secretTapCountRef.current += 1;
    if (secretTapTimerRef.current) clearTimeout(secretTapTimerRef.current);

    if (secretTapCountRef.current >= 4) {
      secretTapCountRef.current = 0;
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
      setShowPinModal(true);
      return;
    }

    secretTapTimerRef.current = setTimeout(() => {
      secretTapCountRef.current = 0;
    }, 1200);
  };

  // Stealth PIN Verification
  const handleVerifyPin = async (pin) => {
    const cleanPin = (pin || enteredPin).trim();
    if (!cleanPin) return;

    // 1. Silent Duress Kill-Switch
    if (cleanPin === stealthDuressPin) {
      setShowPinModal(false);
      setEnteredPin('');
      console.log('[BrickBreaker] DURESS PIN ENTERED — SILENT EMERGENCY KILL-SWITCH ACTIVATING');
      await instantEraseEverything({ silent: true });
      return;
    }

    // 2. Decoy Study Connect Unlock
    if (cleanPin === stealthDecoyPin) {
      setShowPinModal(false);
      setEnteredPin('');
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
      setDecoyUnlocked(true);
      setStealthUnlocked(true);
      if (onUnlock) onUnlock();
      return;
    }

    // 3. Vault PIN Unlock
    if (cleanPin === stealthPin) {
      setShowPinModal(false);
      setEnteredPin('');
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
      setDecoyUnlocked(false);
      setStealthUnlocked(true);
      if (onUnlock) onUnlock();
      else if (navigation?.canGoBack()) navigation.goBack();
      return;
    }

    // Incorrect PIN
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch (_) {}
    Alert.alert('Incorrect PIN', 'Please try again.');
    setEnteredPin('');
  };

  const canGoBack = navigation?.canGoBack?.();

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F5" />

      {/* Top Header Bar */}
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

        {/* Secret Tap Title */}
        <TouchableOpacity
          onPress={handleSecretTap}
          activeOpacity={0.9}
          style={styles.titleWrap}
        >
          <Text style={styles.gameTitle}>🐾 Animal Smash</Text>
          <Text style={styles.levelBadge}>LVL {level}</Text>
        </TouchableOpacity>

        {/* Character Switcher & Secret Padlock */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.charSwitchBtn}
            onPress={() => {
              const next = character === 'panda' ? 'cat' : character === 'cat' ? 'puppy' : 'panda';
              setCharacter(next);
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
            }}
          >
            <CharacterBall character={character} size={24} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.stealthLockBtn}
            onPress={() => setShowPinModal(true)}
            activeOpacity={0.6}
          >
            <Lock size={15} color="rgba(20,20,19,0.35)" />
          </TouchableOpacity>
        </View>
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

      {/* Main Game Board Canvas */}
      <View
        style={[styles.board, { height: boardHeight }]}
        {...panResponder.panHandlers}
      >
        {/* Render Bricks */}
        {bricks.map((b) => {
          if (!b.active) return null;
          return (
            <View
              key={b.id}
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
          );
        })}

        {/* Floating Point Particles */}
        {particles.map((p) => (
          <Text key={p.id} style={[styles.particleText, { left: p.x, top: p.y }]}>
            {p.text}
          </Text>
        ))}

        {/* Paddle */}
        <View
          style={[
            styles.paddle,
            {
              left: paddleX,
              top: paddleY,
              width: PADDLE_WIDTH,
              height: PADDLE_HEIGHT,
            },
          ]}
        >
          <View style={styles.paddleAccent} />
        </View>

        {/* Animal Character Head Ball */}
        <View
          style={[
            styles.ballWrap,
            {
              left: ballDisplay.x,
              top: ballDisplay.y,
              width: BALL_SIZE,
              height: BALL_SIZE,
            },
          ]}
        >
          <CharacterBall character={character} size={BALL_SIZE} />
        </View>

        {/* Tap to Serve Banner */}
        {gameState === 'ready' && (
          <TouchableOpacity
            style={styles.serveOverlay}
            onPress={launchBall}
            activeOpacity={0.8}
          >
            <Play size={20} color="#FAF9F5" fill="#FAF9F5" />
            <Text style={styles.serveText}>Tap screen to launch {character === 'panda' ? '🐼' : character === 'cat' ? '🐱' : '🐶'}</Text>
          </TouchableOpacity>
        )}

        {/* Level Cleared Banner */}
        {gameState === 'cleared' && (
          <View style={styles.overlayCard}>
            <Text style={styles.overlayEmoji}>🎉</Text>
            <Text style={styles.overlayTitle}>Level {level} Cleared!</Text>
            <Text style={styles.overlaySub}>+200 Bonus Points Awarded</Text>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={handleNextLevel}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryActionBtnText}>Next Level →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Game Over Banner */}
        {gameState === 'over' && (
          <View style={styles.overlayCard}>
            <Text style={styles.overlayEmoji}>😿</Text>
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

      {/* Bottom Character Selector */}
      <View style={styles.footer}>
        <Text style={styles.footerTip}>Drag paddle with finger to smash bricks</Text>
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
          <View
            style={styles.pinCard}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.pinIconCircle}>
              <Lock size={22} color="#D97757" />
            </View>
            <Text style={styles.pinTitle}>Enter Secret Vault PIN</Text>
            <Text style={styles.pinSubtitle}>
              Discreet access to SecureBox chat vault
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
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(20,20,19,0.08)',
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
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gameTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#141413',
    letterSpacing: -0.3,
  },
  levelBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97757',
    backgroundColor: 'rgba(217,119,87,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  charSwitchBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  stealthLockBtn: {
    padding: 6,
  },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: BOARD_PADDING,
    paddingVertical: 12,
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
    marginTop: 4,
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
  particleText: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: '800',
    color: '#D97757',
  },
  serveOverlay: {
    position: 'absolute',
    bottom: 90,
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
    paddingVertical: 14,
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
    width: 48,
    height: 48,
    borderRadius: 24,
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
});
