// src/services/gameAudioService.js
// Ultra-Low Latency Sound Effects Engine for Animal Smash Brick Breaker
// Zero-latency playback via pre-loaded Audio.Sound pool

import { Audio } from 'expo-av';
import {
  getGamePaddleToneUri,
  getGameBrickToneUri,
  getGameSteelToneUri,
  getGameWallToneUri,
  getGameGiftToneUri,
  getGameLostToneUri,
  getGameWinToneUri,
} from './soundGenerator';

class GameAudioService {
  constructor() {
    this.isMuted = false;
    this.isInitialized = false;
    this.isLoading = false;
    this.sounds = {
      paddle: null,
      brickPool: [],
      brickPoolIndex: 0,
      steel: null,
      wall: null,
      gift: null,
      lost: null,
      win: null,
    };
  }

  /**
   * Pre-load all game SFX into memory for instant zero-latency triggers
   */
  async init() {
    if (this.isInitialized || this.isLoading) return;
    this.isLoading = true;

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });

      // Pre-load sound objects concurrently
      const [paddle, b1, b2, b3, steel, wall, gift, lost, win] = await Promise.all([
        Audio.Sound.createAsync({ uri: getGamePaddleToneUri() }, { volume: 0.65 }),
        Audio.Sound.createAsync({ uri: getGameBrickToneUri() }, { volume: 0.75 }),
        Audio.Sound.createAsync({ uri: getGameBrickToneUri() }, { volume: 0.75 }),
        Audio.Sound.createAsync({ uri: getGameBrickToneUri() }, { volume: 0.75 }),
        Audio.Sound.createAsync({ uri: getGameSteelToneUri() }, { volume: 0.85 }),
        Audio.Sound.createAsync({ uri: getGameWallToneUri() }, { volume: 0.35 }),
        Audio.Sound.createAsync({ uri: getGameGiftToneUri() }, { volume: 0.8 }),
        Audio.Sound.createAsync({ uri: getGameLostToneUri() }, { volume: 0.75 }),
        Audio.Sound.createAsync({ uri: getGameWinToneUri() }, { volume: 0.85 }),
      ]);

      this.sounds.paddle = paddle.sound;
      this.sounds.brickPool = [b1.sound, b2.sound, b3.sound];
      this.sounds.brickPoolIndex = 0;
      this.sounds.steel = steel.sound;
      this.sounds.wall = wall.sound;
      this.sounds.gift = gift.sound;
      this.sounds.lost = lost.sound;
      this.sounds.win = win.sound;

      this.isInitialized = true;
    } catch (err) {
      console.warn('[GameAudioService] Audio init notice:', err.message);
    } finally {
      this.isLoading = false;
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  getMuted() {
    return this.isMuted;
  }

  async _playSound(soundObj) {
    if (this.isMuted || !soundObj) return;
    try {
      await soundObj.replayAsync();
    } catch (_) {
      try {
        await soundObj.setPositionAsync(0);
        await soundObj.playAsync();
      } catch (_) {}
    }
  }

  // 1. Paddle hit
  playPaddle() {
    this._playSound(this.sounds.paddle);
  }

  // 2. Brick smashed (rotates through pool for rapid multi-hits)
  playBrick() {
    if (this.isMuted || !this.sounds.brickPool.length) return;
    const sound = this.sounds.brickPool[this.sounds.brickPoolIndex];
    this.sounds.brickPoolIndex = (this.sounds.brickPoolIndex + 1) % this.sounds.brickPool.length;
    this._playSound(sound);
  }

  // 3. Steel unbreakable brick ricochet
  playSteel() {
    this._playSound(this.sounds.steel);
  }

  // 4. Side or top wall bounce
  playWall() {
    this._playSound(this.sounds.wall);
  }

  // 5. Gift power-up caught
  playGift() {
    this._playSound(this.sounds.gift);
  }

  // 6. Life lost
  playBallLost() {
    this._playSound(this.sounds.lost);
  }

  // 7. Level cleared / victory
  playLevelWin() {
    this._playSound(this.sounds.win);
  }

  /**
   * Clean unload on game exit
   */
  async unloadAll() {
    try {
      const all = [
        this.sounds.paddle,
        ...this.sounds.brickPool,
        this.sounds.steel,
        this.sounds.wall,
        this.sounds.gift,
        this.sounds.lost,
        this.sounds.win,
      ];
      for (const s of all) {
        if (s) {
          try {
            await s.unloadAsync();
          } catch (_) {}
        }
      }
      this.sounds.brickPool = [];
      this.isInitialized = false;
    } catch (_) {}
  }
}

export const gameAudioService = new GameAudioService();
export default gameAudioService;
