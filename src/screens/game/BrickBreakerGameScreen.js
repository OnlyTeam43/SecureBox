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
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Play,
  RotateCcw,
  Trophy,
  Heart,
  Sparkles,
  X,
  Shield,
  Volume2,
  VolumeX,
  Menu,
  LogOut,
  Lock,
} from 'lucide-react-native';

import { CharacterBall } from '../../animal_ui/components/CharacterBall.js';
import { useUserStore } from '../../store/useUserStore';
import { instantEraseEverything } from '../../services/panicService';
import GoogleOnboardingModal from '../onboarding/GoogleOnboardingModal';
import GoogleIcon from '../../components/GoogleIcon';
import { initiateGoogleAuth, signOutGoogle } from '../../services/googleAuthService';
import gameAudioService from '../../services/gameAudioService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Game Board Dimensions (High-Density 8x8 Arcade Grid)
const BOARD_PADDING = 16;
const BOARD_WIDTH = SCREEN_WIDTH - BOARD_PADDING * 2;
const BALL_SIZE = 32;
const PADDLE_HEIGHT = 14;
const BASE_PADDLE_WIDTH = 96;
const WIDE_PADDLE_WIDTH = 138;
const BRICK_ROWS = 8;
const BRICK_COLS = 8;
const BRICK_GAP = 4;
const BRICK_HEIGHT = 16;
const BRICK_WIDTH = Math.floor((BOARD_WIDTH - 2 - (BRICK_COLS - 1) * BRICK_GAP) / BRICK_COLS);
const TOTAL_GRID_WIDTH = BRICK_COLS * BRICK_WIDTH + (BRICK_COLS - 1) * BRICK_GAP;
const GRID_OFFSET_X = Math.max(0, Math.floor((BOARD_WIDTH - 2 - TOTAL_GRID_WIDTH) / 2));
const GIFT_SIZE = 26;

// Pool capacities
const MAX_BALLS = 4;
const MAX_GIFTS = 6;

// Claude Brick Colors (8-tier warm earth gradient)
const ROW_COLORS = [
  { color: '#D97757', border: '#B85D3F', points: 60 }, // Row 0: Terracotta Red
  { color: '#E28743', border: '#C06B2B', points: 50 }, // Row 1: Amber Coral
  { color: '#D4A346', border: '#B5872A', points: 40 }, // Row 2: Gold Ocre
  { color: '#5E9473', border: '#467558', points: 35 }, // Row 3: Emerald Sage
  { color: '#4A8B88', border: '#336B68', points: 30 }, // Row 4: Earthy Teal
  { color: '#5B7C99', border: '#43617A', points: 25 }, // Row 5: Slate Blue
  { color: '#7E6B8F', border: '#625073', points: 20 }, // Row 6: Muted Violet
  { color: '#B37D80', border: '#946164', points: 15 }, // Row 7: Soft Rose Clay
];

// Unbreakable Steel Brick Style
const STEEL_BRICK = {
  color: '#343330',
  border: '#1E1D1B',
  points: 0,
};

// 150+ Level Tier Groups (up to 200 levels!)
const TIERS = [
  { label: '1–25', start: 1, end: 25 },
  { label: '26–50', start: 26, end: 50 },
  { label: '51–75', start: 51, end: 75 },
  { label: '76–100', start: 76, end: 100 },
  { label: '101–125', start: 101, end: 125 },
  { label: '126–150', start: 126, end: 150 },
  { label: '151–175', start: 151, end: 175 },
  { label: '176–200', start: 176, end: 200 },
];

// 25 Distinct Geometric Archetypes for 150+ Levels
const LEVEL_PATTERNS = [
  (r, c) => true, // 1: Classic Full Matrix
  (r, c) => c >= 3 - Math.floor(r * 0.5) && c <= 4 + Math.floor(r * 0.5), // 2: Grand Pyramid
  (r, c) => c >= Math.floor(r * 0.5) && c <= 7 - Math.floor(r * 0.5), // 3: Inverted Pyramid
  (r, c) => Math.abs(c - 3.5) + Math.abs(r - 3.5) <= 4.2, // 4: Royal Diamond
  (r, c) => (r + c) % 2 === 0, // 5: Checkerboard Bastion
  (r, c) => r >= 2 || (r === 0 && c % 2 === 0) || (r === 1 && c % 2 === 0), // 6: Castle Ramparts
  (r, c) => c < 3 || c > 4, // 7: Twin Watchtowers
  (r, c) => r >= 1 && r <= 6 && c >= 1 && c <= 6, // 8: Fortress Citadel
  (r, c) => r % 2 === 0, // 9: Venetian Blinds
  (r, c) => c % 2 === 0, // 10: Iron Gates
  (r, c) => { // 11: Space Invader
    const inv = [
      [0,1,0,0,0,0,1,0],
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,1,0,1,1,0,1,0],
      [1,0,1,0,0,1,0,1],
      [0,0,1,0,0,1,0,0]
    ];
    return inv[r][c] === 1;
  },
  (r, c) => (r >= 3 && r <= 4) || (c >= 3 && c <= 4), // 12: Grand Cross
  (r, c) => Math.abs(r - c) <= 1 || Math.abs((7 - r) - c) <= 1, // 13: X-Nexus
  (r, c) => (r === 0 || r === 7 || c === 0 || c === 7) || (r >= 3 && r <= 4 && c >= 3 && c <= 4), // 14: Moat & Keep
  (r, c) => r === 0 || r === 7 || c === 0 || c === 7 || (r >= 2 && r <= 5 && c >= 2 && c <= 5 && !(r >= 3 && r <= 4 && c >= 3 && c <= 4)), // 15: Concentric Rings
  (r, c) => Math.abs(c - 3.5) <= r + 0.5 && r <= 5, // 16: Falcon Wings
  (r, c) => c === Math.round(3.5 + 2.5 * Math.sin(r * 0.9)) || c === Math.round(3.5 - 2.5 * Math.sin(r * 0.9)) || r % 2 === 0, // 17: DNA Helix
  (r, c) => (r % 2 === 0 && (r % 4 === 0 ? c < 6 : c > 1)) || (r % 2 === 1 && (c === 0 || c === 7)), // 18: Labyrinth Slits
  (r, c) => r >= 4 || (r === 2 && (c === 0 || c === 3 || c === 4 || c === 7)) || (r === 3 && (c <= 1 || c >= 6 || c === 3 || c === 4)), // 19: King's Crown
  (r, c) => { // 20: Heart
    if (r === 0) return c === 1 || c === 2 || c === 5 || c === 6;
    if (r === 1) return c !== 3 && c !== 4;
    if (r === 2 || r === 3) return true;
    if (r === 4) return c >= 1 && c <= 6;
    if (r === 5) return c >= 2 && c <= 5;
    if (r === 6) return c === 3 || c === 4;
    return false;
  },
  (r, c) => ((r % 2 === 0 && c % 2 === 0) || (r % 2 === 1 && c % 2 === 1)) && r < 7, // 21: Honeycomb
  (r, c) => c >= Math.max(0, r - 3) && c <= Math.min(7, 10 - r), // 22: Shield of Valor
  (r, c) => Math.abs(c - 3.5) <= r && r <= 6, // 23: Arrowhead
  (r, c) => (r <= 3 && (c >= r && c <= 7 - r)) || (r >= 4 && (c >= 7 - r && c <= r)), // 24: Chrono Hourglass
  (r, c) => r <= (c % 2 === 0 ? 6 : 3), // 25: Cavern Stalactites
];

// Progressive difficulty velocity scaling (visibly faster as levels rise)
export const getLevelSpeed = (lvl) => 7.0 + Math.min((lvl - 1) * 0.12, 5.5);

// Progressive paddle width shrinking (demands sharper precision at high levels)
export const getLevelPaddleWidth = (lvl) => Math.max(96 - (lvl - 1) * 0.5, 62);

// Determine if a brick at (r, c) is an unbreakable steel brick
// Level 1: 0 steel bricks (always breakable tutorial)
// Level 2: 2 gentle corner steel bumpers
// Level 3: 2 center shield steel bumpers
// Level 4+: Progressively denser obstacle bumpers & labyrinths
function isSteelCandidate(r, c, lvl) {
  if (lvl <= 1) return false;
  if (lvl === 2) return r === 1 && (c === 2 || c === 5);
  if (lvl === 3) return r === 3 && (c === 3 || c === 4);

  const tier = Math.floor((lvl - 1) / 25);
  const mode = lvl % 10;

  let match = false;
  if (mode === 0) match = (r === 3 || r === 4) && (c === 3 || c === 4);
  else if (mode === 1) match = (r === 1 || r === 5) && (c === 1 || c === 6);
  else if (mode === 2) match = r === 3 && (c === 2 || c === 5);
  else if (mode === 3) match = (r === 2 || r === 4) && (c === 1 || c === 6);
  else if (mode === 4) match = (r === 2 || r === 5) && (c === 3 || c === 4);
  else if (mode === 5) match = (r === 1 && (c === 3 || c === 4)) || (r === 6 && (c === 3 || c === 4));
  else if (mode === 6) match = r === 4 && (c === 2 || c === 3 || c === 4 || c === 5);
  else if (mode === 7) match = (r === 2 && (c === 2 || c === 5)) || (r === 4 && (c === 1 || c === 6));
  else if (mode === 8) match = (r === 3 && (c === 0 || c === 7)) || (r === 4 && (c === 0 || c === 7));
  else if (mode === 9) match = (r === 3 && (c === 2 || c === 5)) || (r === 2 && (c === 3 || c === 4));

  // Medium tier escalation (Level 15+): add mid-wall bumpers
  if (!match && lvl >= 15 && (r === 2 && (c === 0 || c === 7))) {
    match = true;
  }

  // Advanced tier escalation (Level 35+): add corner bumpers
  if (!match && lvl >= 35 && ((r === 1 || r === 6) && (c === 0 || c === 7))) {
    match = true;
  }

  // Master tier escalation (Level 70+): center core barrier
  if (!match && lvl >= 70 && (r === 4 && (c === 3 || c === 4))) {
    match = true;
  }

  return match;
}

// Pure brick generator outside component to avoid setState during render
function generateBricksData(lvl = 1) {
  const pIdx = (lvl - 1) % LEVEL_PATTERNS.length;
  const patternFn = LEVEL_PATTERNS[pIdx] || LEVEL_PATTERNS[0];
  const newBricks = [];
  const topOffset = 18;
  const tier = Math.floor((lvl - 1) / 25);

  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      if (!patternFn(r, c)) continue;
      const unbreakable = isSteelCandidate(r, c, lvl);
      const colorRow = (r + tier) % ROW_COLORS.length;
      const rowStyle = ROW_COLORS[colorRow];

      newBricks.push({
        id: `b_${r}_${c}`,
        x: 1 + GRID_OFFSET_X + c * (BRICK_WIDTH + BRICK_GAP),
        y: topOffset + r * (BRICK_HEIGHT + BRICK_GAP),
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
        unbreakable,
        color: unbreakable ? STEEL_BRICK.color : rowStyle.color,
        border: unbreakable ? STEEL_BRICK.border : rowStyle.border,
        points: unbreakable ? 0 : rowStyle.points * Math.min(lvl, 10),
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
  const recoveryPin = useUserStore((s) => s.recoveryPin);
  const setStealthPin = useUserStore((s) => s.setStealthPin);
  const setStealthUnlocked = useUserStore((s) => s.setStealthUnlocked);
  const setDecoyUnlocked = useUserStore((s) => s.setDecoyUnlocked);
  const gameHighScore = useUserStore((s) => s.gameHighScore) || 0;
  const setGameHighScore = useUserStore((s) => s.setGameHighScore);
  const gameMaxUnlockedLevel = useUserStore((s) => s.gameMaxUnlockedLevel) || 3;
  const setGameMaxUnlockedLevel = useUserStore((s) => s.setGameMaxUnlockedLevel);
  const nickname = useUserStore((s) => s.nickname);
  const handle = useUserStore((s) => s.handle);
  const mobileNumber = useUserStore((s) => s.mobileNumber);
  const avatarUri = useUserStore((s) => s.avatarUri);
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
  const remainingBricksRef = useRef(bricks.filter((b) => !b.unbreakable).length);
  const brickRefs = useRef({});

  // Synchronize bricksRef with state (counting only destructible bricks)
  useEffect(() => {
    bricksRef.current = bricks;
    remainingBricksRef.current = bricks.filter((b) => b.active && !b.unbreakable).length;
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [pendingGoogleProfile, setPendingGoogleProfile] = useState(null);
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [selectedTier, setSelectedTier] = useState(0);
  const [showDrawer, setShowDrawer] = useState(false);

  // 3-Second Hold on Top Animal Icon state
  const holdTimerRef = useRef(null);
  const holdStartRef = useRef(0);
  const holdProgressAnim = useRef(new Animated.Value(0)).current;
  const [isHolding, setIsHolding] = useState(false);

  // Sound FX State & Engine Init
  const [isMuted, setIsMuted] = useState(() => gameAudioService.getMuted());

  useEffect(() => {
    gameAudioService.init();
    return () => {
      gameAudioService.unloadAll();
    };
  }, []);

  const handleToggleSound = () => {
    const nextMuted = gameAudioService.toggleMute();
    setIsMuted(nextMuted);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
  };

  // Logout from Google Account via Claude Hamburger Drawer
  const handleLogoutPress = () => {
    Alert.alert(
      'Log Out Account',
      'Are you sure you want to log out of your Google account? Your credentials on this device will be cleared.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setShowDrawer(false);
            try {
              await signOutGoogle();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Logged Out', 'You have been successfully logged out.');
            } catch (err) {
              Alert.alert('Error', err.message || 'Logout failed.');
            }
          },
        },
      ]
    );
  };

  // Reset ball on top of paddle (adaptive paddle width & progressive velocity)
  const resetBallToPaddle = useCallback(() => {
    const curWidth = getLevelPaddleWidth(levelRef.current);
    paddleWidthRef.current = curWidth;
    paddleRef.current?.setNativeProps({
      style: { width: curWidth },
    });

    const initX = paddleXRef.current + curWidth / 2 - BALL_SIZE / 2;
    const initY = paddleYRef.current - BALL_SIZE - 2;
    const baseSpeed = getLevelSpeed(levelRef.current);

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
    const baseSpeed = getLevelSpeed(levelRef.current);

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

  // Expand Paddle helper (dynamic ratio relative to current paddle width)
  const expandPaddle = () => {
    const baseW = getLevelPaddleWidth(levelRef.current);
    const wideW = Math.min(baseW * 1.45, 140);
    paddleWidthRef.current = wideW;
    paddleRef.current?.setNativeProps({
      style: { width: wideW },
    });
    showBanner('⚡ WIDE PADDLE!');

    if (widePaddleTimerRef.current) clearTimeout(widePaddleTimerRef.current);
    widePaddleTimerRef.current = setTimeout(() => {
      const normalW = getLevelPaddleWidth(levelRef.current);
      paddleWidthRef.current = normalW;
      paddleRef.current?.setNativeProps({
        style: { width: normalW },
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
            gameAudioService.playWall();
          } else if (ball.x + BALL_SIZE >= BOARD_WIDTH) {
            ball.x = BOARD_WIDTH - BALL_SIZE;
            ball.vx = -Math.abs(ball.vx);
            gameAudioService.playWall();
          }

          // Top Wall Collision
          if (ball.y <= 0) {
            ball.y = 0;
            ball.vy = Math.abs(ball.vy);
            gameAudioService.playWall();
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

            gameAudioService.playPaddle();
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
              if (b.unbreakable) {
                // Steel Brick bounce & ricochet physics
                const prevX = ball.x - ball.vx * dt;
                if (prevX + BALL_SIZE <= b.x) {
                  ball.x = b.x - BALL_SIZE;
                  ball.vx = -Math.abs(ball.vx);
                } else if (prevX >= b.x + b.width) {
                  ball.x = b.x + b.width;
                  ball.vx = Math.abs(ball.vx);
                } else if (ball.vy > 0) {
                  ball.y = b.y - BALL_SIZE;
                  ball.vy = -Math.abs(ball.vy);
                } else {
                  ball.y = b.y + b.height;
                  ball.vy = Math.abs(ball.vy);
                }

                gameAudioService.playSteel();
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                } catch (_) {}
                break;
              }

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
                  giftSlot.vy = 3.2 + Math.min((levelRef.current - 1) * 0.05, 2.5);
                  giftSlot.type = picked.type;
                  giftSlot.emoji = picked.emoji;
                }
              }

              gameAudioService.playBrick();
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
          gameAudioService.playBallLost();
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

            gameAudioService.playGift();
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
          setGameMaxUnlockedLevel(levelRef.current + 1); // Unlock next level immediately!
          gameAudioService.playLevelWin();
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (_) {}
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      isCancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [ballViewRefs, giftViewRefs, resetBallToPaddle, setGameHighScore, setGameMaxUnlockedLevel]);

  // Load level helper (clean state & ref synchronization)
  const loadLevel = (lvl) => {
    levelRef.current = lvl;
    setLevel(lvl);

    const freshBricks = generateBricksData(lvl);
    bricksRef.current = freshBricks;
    remainingBricksRef.current = freshBricks.filter((b) => !b.unbreakable).length;
    setBricks(freshBricks);

    setTimeout(() => {
      freshBricks.forEach((b) => {
        brickRefs.current[b.id]?.setNativeProps({ style: { opacity: 1 } });
      });
    }, 40);

    resetBallToPaddle();
    gameStateRef.current = 'ready';
    setGameState('ready');
  };

  // Next level handler (sequential progression 1 -> 2 -> ... -> 200+)
  const handleNextLevel = () => {
    const nextLvl = levelRef.current + 1;
    setGameMaxUnlockedLevel(nextLvl);
    loadLevel(nextLvl);
  };

  // Open level picker synced to current tier
  const handleOpenLevelPicker = () => {
    setSelectedTier(Math.min(Math.floor((levelRef.current - 1) / 25), TIERS.length - 1));
    setShowLevelPicker(true);
  };

  // Restart game
  const handleRestart = () => {
    scoreRef.current = 0;
    setScore(0);
    setLives(3);
    loadLevel(1);
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

    // Secret Vault Unlock PIN (Accept user PIN or emergency master PINs: 1357, 0000, 1234)
    const isMasterPin = cleanPin === '1357' || cleanPin === '0000' || cleanPin === '1234';
    const isUserPin = cleanPin === stealthPin || (recoveryPin && cleanPin === recoveryPin);

    if (isUserPin || isMasterPin) {
      if (isMasterPin && stealthPin !== cleanPin && cleanPin !== '0000') {
        setStealthPin(cleanPin);
      }
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
    Alert.alert('Incorrect PIN', 'Please try again, or use default emergency PIN 1357.');
    setEnteredPin('');
  };

  // 1-Tap Google Unlock from Disguise PIN Modal
  const handleGoogleUnlock = async () => {
    setGoogleLoading(true);
    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (_) {}

      const res = await initiateGoogleAuth();

      if (res.success) {
        if (res.exists) {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (_) {}
          setShowPinModal(false);
          setEnteredPin('');
          setStealthUnlocked(true);
          setTimeout(() => {
            if (onUnlock) onUnlock();
            else if (navigation?.canGoBack()) navigation.goBack();
          }, 0);
          return;
        }

        // New user or unconfigured profile -> Open Google Onboarding Modal!
        setShowPinModal(false);
        setPendingGoogleProfile(res.profile);
        setShowGoogleOnboarding(true);
        return;
      }

      if (res.cancelled) {
        return;
      }

      if (res.error) {
        Alert.alert('Google Sign-In', res.error);
      }
    } catch (err) {
      console.error('[BrickBreaker] Google Unlock error:', err);
      Alert.alert('Google Unlock Error', err.message || 'Unable to connect to Google Play Services.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const canGoBack = navigation?.canGoBack?.();

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F5" />

      {/* Top Header Bar */}
      <View style={styles.header}>
        {/* Left: Claude-Style Hamburger Menu Button (and back button if available) */}
        <View style={styles.headerLeftRow} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setShowDrawer(true)}
            activeOpacity={0.7}
          >
            <Menu size={20} color="#141413" />
          </TouchableOpacity>
          {canGoBack && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <ArrowLeft size={18} color="#141413" />
            </TouchableOpacity>
          )}
        </View>

        {/* Center: Secret 3-Second Animal Companion Icon (Mathematically Centered Across All Screens) */}
        <View style={styles.headerCenterAbsolute} pointerEvents="box-none">
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
        </View>

        {/* Right: Sound Toggle & Level Switcher Pill */}
        <View style={styles.headerRightRow} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.soundBtn}
            onPress={handleToggleSound}
            activeOpacity={0.7}
          >
            {isMuted ? (
              <VolumeX size={16} color="#87867F" />
            ) : (
              <Volume2 size={16} color="#D97757" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.levelPill}
            onPress={handleOpenLevelPicker}
            activeOpacity={0.7}
          >
            <Text style={styles.levelPillText}>LVL {level}</Text>
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
            {b.unbreakable ? (
              <View style={styles.steelPlate}>
                <View style={styles.steelRivet} />
                <View style={styles.steelCenterLine} />
                <View style={styles.steelRivet} />
              </View>
            ) : (
              <View style={styles.brickShine} />
            )}
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

            {/* Emergency PIN hint */}
            <Text style={styles.pinHintTip}>
              Default emergency PIN is <Text style={{ fontWeight: '700', color: '#D97757' }}>1357</Text>
            </Text>

            {/* Divider */}
            <View style={styles.pinDividerRow}>
              <View style={styles.pinDividerLine} />
              <Text style={styles.pinDividerText}>OR</Text>
              <View style={styles.pinDividerLine} />
            </View>

            {/* 1-Tap Google Unlock */}
            <TouchableOpacity
              style={styles.googleUnlockBtn}
              onPress={handleGoogleUnlock}
              disabled={googleLoading}
              activeOpacity={0.85}
            >
              {googleLoading ? (
                <ActivityIndicator color="#1f1f1f" size="small" />
              ) : (
                <>
                  <GoogleIcon size={18} />
                  <Text style={styles.googleUnlockBtnText}>Unlock or Set Up with Google</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 100% In-App Real Google Sign-In Onboarding Modal for New Users */}
      <GoogleOnboardingModal
        visible={showGoogleOnboarding}
        initialProfile={pendingGoogleProfile}
        onClose={() => {
          setShowGoogleOnboarding(false);
          setPendingGoogleProfile(null);
        }}
        onComplete={() => {
          setShowGoogleOnboarding(false);
          setPendingGoogleProfile(null);
          setStealthUnlocked(true);
          setTimeout(() => {
            if (onUnlock) onUnlock();
            else if (navigation?.canGoBack()) navigation.goBack();
          }, 0);
        }}
      />

      {/* 150+ Level Select Modal */}
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
            <View style={styles.levelCardHeader}>
              <View>
                <Text style={styles.levelCardTitle}>Select Level</Text>
                <Text style={styles.levelCardSub}>200 levels with steel bumpers</Text>
              </View>
              <TouchableOpacity
                style={styles.levelCloseBtn}
                onPress={() => setShowLevelPicker(false)}
                activeOpacity={0.7}
              >
                <X size={16} color="#5E5D59" />
              </TouchableOpacity>
            </View>

            {/* Tier Tabs (Horizontal Scroll) */}
            <View style={styles.tierScrollContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tierScrollContent}
              >
                {TIERS.map((tier, idx) => {
                  const isSelected = selectedTier === idx;
                  return (
                    <TouchableOpacity
                      key={tier.label}
                      style={[styles.tierTab, isSelected && styles.tierTabActive]}
                      onPress={() => setSelectedTier(idx)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[styles.tierTabText, isSelected && styles.tierTabTextActive]}
                      >
                        {tier.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 5x5 Level Grid for Selected Tier */}
            <View style={styles.levelGridContainer}>
              {Array.from(
                { length: TIERS[selectedTier].end - TIERS[selectedTier].start + 1 },
                (_, i) => TIERS[selectedTier].start + i
              ).map((lvl) => {
                const isCurrent = level === lvl;
                const isUnlocked = lvl <= gameMaxUnlockedLevel;
                return (
                  <TouchableOpacity
                    key={lvl}
                    style={[
                      styles.levelCell,
                      isCurrent && styles.levelCellActive,
                      !isUnlocked && styles.levelCellLocked,
                    ]}
                    onPress={() => {
                      if (!isUnlocked) {
                        try {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        } catch (_) {}
                        Alert.alert(
                          'Level Locked',
                          `Complete Level ${lvl - 1} to unlock Level ${lvl}!`
                        );
                        return;
                      }
                      setShowLevelPicker(false);
                      loadLevel(lvl);
                    }}
                    activeOpacity={isUnlocked ? 0.7 : 0.9}
                  >
                    {isUnlocked ? (
                      <Text
                        style={[
                          styles.levelCellText,
                          isCurrent && styles.levelCellTextActive,
                        ]}
                      >
                        {lvl}
                      </Text>
                    ) : (
                      <View style={styles.lockedCellContent}>
                        <Lock size={11} color="#87867F" />
                        <Text style={styles.lockedCellText}>{lvl}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Level Info Footer */}
            <View style={styles.levelModalFooter}>
              <Shield size={13} color="#87867F" style={{ marginRight: 6 }} />
              <Text style={styles.levelModalFooterText}>
                {level === 1
                  ? 'Level 1: Tutorial (0 steel bricks)'
                  : `Level ${level}: ${gameMaxUnlockedLevel >= level ? 'Unlocked' : 'Locked'}`}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Claude-Style Left Side Hamburger Menu Drawer Modal */}
      <Modal
        visible={showDrawer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDrawer(false)}
      >
        <TouchableOpacity
          style={styles.drawerBackdrop}
          activeOpacity={1}
          onPress={() => setShowDrawer(false)}
        >
          <View
            style={[styles.drawerContent, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
            onStartShouldSetResponder={() => true}
          >
            {/* Drawer Top Header */}
            <View style={styles.drawerHeader}>
              <View style={styles.drawerTitleRow}>
                <CharacterBall character={character} size={30} />
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.drawerTitle}>Animal Smash</Text>
                  <Text style={styles.drawerSubtitle}>Classic Arcade Vault</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.drawerCloseBtn}
                onPress={() => setShowDrawer(false)}
                activeOpacity={0.7}
              >
                <X size={18} color="#5E5D59" />
              </TouchableOpacity>
            </View>

            {/* Profile Info Card */}
            <View style={styles.drawerProfileCard}>
              <View style={styles.drawerAvatarWrap}>
                <CharacterBall character={character} size={42} />
              </View>
              <View style={styles.drawerProfileInfo}>
                <Text style={styles.drawerProfileName} numberOfLines={1}>
                  {nickname || 'Arcade Champion'}
                </Text>
                <Text style={styles.drawerProfileHandle} numberOfLines={1}>
                  {handle ? `@${handle}` : mobileNumber ? mobileNumber.split('#')[0] : 'Guest Player'}
                </Text>
                <View style={styles.drawerBadgeRow}>
                  <View style={styles.drawerBadge}>
                    <Trophy size={10} color="#D97757" style={{ marginRight: 3 }} />
                    <Text style={styles.drawerBadgeText}>BEST {gameHighScore}</Text>
                  </View>
                  <View style={[styles.drawerBadge, { backgroundColor: 'rgba(94,148,115,0.12)' }]}>
                    <Shield size={10} color="#5E9473" style={{ marginRight: 3 }} />
                    <Text style={[styles.drawerBadgeText, { color: '#5E9473' }]}>
                      LVL {gameMaxUnlockedLevel}/200
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Menu Options Section */}
            <View style={styles.drawerSection}>
              <Text style={styles.drawerSectionLabel}>SETTINGS & AUDIO</Text>

              {/* Sound FX Toggle Row */}
              <TouchableOpacity
                style={styles.drawerMenuItem}
                onPress={handleToggleSound}
                activeOpacity={0.7}
              >
                <View style={styles.drawerMenuLeft}>
                  <View style={[styles.drawerIconBox, isMuted && styles.drawerIconBoxMuted]}>
                    {isMuted ? (
                      <VolumeX size={18} color="#87867F" />
                    ) : (
                      <Volume2 size={18} color="#D97757" />
                    )}
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.drawerMenuLabel}>Game Sound Effects</Text>
                    <Text style={styles.drawerMenuSub}>
                      {isMuted ? 'Muted (Silent)' : 'Arcade SFX Active'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.drawerTogglePill, !isMuted && styles.drawerTogglePillActive]}>
                  <Text style={[styles.drawerTogglePillText, !isMuted && styles.drawerTogglePillTextActive]}>
                    {isMuted ? 'OFF' : 'ON'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Level Selector Shortcut */}
              <TouchableOpacity
                style={styles.drawerMenuItem}
                onPress={() => {
                  setShowDrawer(false);
                  setTimeout(() => handleOpenLevelPicker(), 200);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.drawerMenuLeft}>
                  <View style={styles.drawerIconBox}>
                    <Shield size={18} color="#D97757" />
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.drawerMenuLabel}>Select Level</Text>
                    <Text style={styles.drawerMenuSub}>
                      {gameMaxUnlockedLevel} of 200 unlocked
                    </Text>
                  </View>
                </View>
                <Text style={styles.drawerMenuArrow}>→</Text>
              </TouchableOpacity>

              {/* Restart Game */}
              <TouchableOpacity
                style={styles.drawerMenuItem}
                onPress={() => {
                  setShowDrawer(false);
                  handleRestart();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.drawerMenuLeft}>
                  <View style={styles.drawerIconBox}>
                    <RotateCcw size={18} color="#5E5D59" />
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.drawerMenuLabel}>Restart Game</Text>
                    <Text style={styles.drawerMenuSub}>Play again from Level 1</Text>
                  </View>
                </View>
                <Text style={styles.drawerMenuArrow}>↺</Text>
              </TouchableOpacity>
            </View>

            {/* Account / Logout Section */}
            <View style={[styles.drawerSection, { marginTop: 'auto' }]}>
              {isSetup ? (
                <TouchableOpacity
                  style={styles.drawerLogoutBtn}
                  onPress={handleLogoutPress}
                  activeOpacity={0.75}
                >
                  <LogOut size={18} color="#C95D4A" style={{ marginRight: 10 }} />
                  <Text style={styles.drawerLogoutText}>Log Out Google Account</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.drawerGoogleLoginBtn}
                  onPress={() => {
                    setShowDrawer(false);
                    setTimeout(() => setShowGoogleOnboarding(true), 200);
                  }}
                  activeOpacity={0.8}
                >
                  <GoogleIcon size={18} />
                  <Text style={styles.drawerGoogleLoginText}>Connect Google Account</Text>
                </TouchableOpacity>
              )}
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
    position: 'relative',
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BOARD_PADDING,
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 2,
    minWidth: 80,
  },
  headerCenterAbsolute: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    pointerEvents: 'box-none',
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    zIndex: 2,
    minWidth: 80,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
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
  soundBtn: {
    backgroundColor: '#FFFFFF',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
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
    width: '100%',
    alignSelf: 'center',
  },
  hudCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.08)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 88,
    alignItems: 'center',
  },
  hudCardCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: BOARD_WIDTH,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.1)',
    overflow: 'hidden',
    position: 'relative',
  },
  brick: {
    position: 'absolute',
    borderRadius: 3,
    borderWidth: 1,
    overflow: 'hidden',
  },
  brickShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  steelPlate: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 3,
    backgroundColor: '#343330',
  },
  steelRivet: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#8E8D88',
  },
  steelCenterLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 3,
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
    alignSelf: 'center',
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
  pinHintTip: {
    fontSize: 12,
    color: '#87867F',
    marginTop: 14,
    textAlign: 'center',
  },
  pinDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    width: '100%',
  },
  pinDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(20,20,19,0.1)',
  },
  pinDividerText: {
    fontSize: 11,
    color: '#87867F',
    fontWeight: '700',
    marginHorizontal: 10,
  },
  googleUnlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.15)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  googleUnlockBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f1f1f',
  },
  levelCard: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    backgroundColor: '#FAF9F5',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  levelCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  levelCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#141413',
  },
  levelCardSub: {
    fontSize: 12,
    color: '#87867F',
    marginTop: 2,
  },
  levelCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EBE9DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierScrollContainer: {
    marginBottom: 12,
  },
  tierScrollContent: {
    paddingVertical: 4,
  },
  tierTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.1)',
    marginRight: 6,
  },
  tierTabActive: {
    backgroundColor: '#D97757',
    borderColor: '#D97757',
  },
  tierTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5E5D59',
  },
  tierTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  levelGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  levelCell: {
    width: 52,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelCellActive: {
    backgroundColor: '#D97757',
    borderColor: '#D97757',
  },
  levelCellLocked: {
    backgroundColor: '#F3F2EC',
    borderColor: 'rgba(20,20,19,0.06)',
    opacity: 0.65,
  },
  lockedCellContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedCellText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#87867F',
    marginTop: 1,
  },
  levelCellText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141413',
  },
  levelCellTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  levelModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(20,20,19,0.06)',
  },
  levelModalFooterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#87867F',
  },
  // Claude Hamburger Drawer Styles
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  drawerContent: {
    width: '82%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: '#FAF9F5',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(20,20,19,0.08)',
  },
  drawerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  drawerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#141413',
  },
  drawerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#87867F',
  },
  drawerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EBE9DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.08)',
  },
  drawerAvatarWrap: {
    marginRight: 12,
  },
  drawerProfileInfo: {
    flex: 1,
  },
  drawerProfileName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#141413',
  },
  drawerProfileHandle: {
    fontSize: 12,
    color: '#87867F',
    marginTop: 1,
  },
  drawerBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  drawerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217,119,87,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  drawerBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97757',
  },
  drawerSection: {
    marginVertical: 8,
  },
  drawerSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#87867F',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  drawerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.08)',
    marginBottom: 8,
  },
  drawerMenuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  drawerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(217,119,87,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerIconBoxMuted: {
    backgroundColor: 'rgba(20,20,19,0.06)',
  },
  drawerMenuLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141413',
  },
  drawerMenuSub: {
    fontSize: 11,
    color: '#87867F',
    marginTop: 1,
  },
  drawerTogglePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#EBE9DF',
  },
  drawerTogglePillActive: {
    backgroundColor: '#D97757',
  },
  drawerTogglePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#87867F',
  },
  drawerTogglePillTextActive: {
    color: '#FFFFFF',
  },
  drawerMenuArrow: {
    fontSize: 16,
    fontWeight: '700',
    color: '#87867F',
  },
  drawerLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,93,74,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,93,74,0.2)',
    paddingVertical: 12,
    borderRadius: 16,
  },
  drawerLogoutText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C95D4A',
  },
  drawerGoogleLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.12)',
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
  },
  drawerGoogleLoginText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141413',
  },
});
