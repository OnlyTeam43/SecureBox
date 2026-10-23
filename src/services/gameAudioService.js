// src/services/gameAudioService.js
// Ultra-Low Latency Sound Effects Engine for Animal Smash Brick Breaker
// Bundled WAV assets for 100% Android APK & iOS production compatibility

import { Audio } from 'expo-av';

const SOUND_ASSETS = {
  paddle: require('../../assets/sounds/paddle.wav'),
  brick: require('../../assets/sounds/brick.wav'),
  steel: require('../../assets/sounds/steel.wav'),
  wall: require('../../assets/sounds/wall.wav'),
  gift: require('../../assets/sounds/gift.wav'),
  lost: require('../../assets/sounds/lost.wav'),
  win: require('../../assets/sounds/win.wav'),
};

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
   * Pre-load bundled audio assets into memory for instant zero-latency triggers
   */
  async init() {
    if (this.isInitialized || this.isLoading) return;
    this.isLoading = true;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });

      // Pre-load bundled native audio assets concurrently
      const [paddle, b1, b2, b3, steel, wall, gift, lost, win] = await Promise.all([
        Audio.Sound.createAsync(SOUND_ASSETS.paddle, { volume: 0.7, shouldPlay: false }),
        Audio.Sound.createAsync(SOUND_ASSETS.brick, { volume: 0.8, shouldPlay: false }),
        Audio.Sound.createAsync(SOUND_ASSETS.brick, { volume: 0.8, shouldPlay: false }),
        Audio.Sound.createAsync(SOUND_ASSETS.brick, { volume: 0.8, shouldPlay: false }),
        Audio.Sound.createAsync(SOUND_ASSETS.steel, { volume: 0.9, shouldPlay: false }),
        Audio.Sound.createAsync(SOUND_ASSETS.wall, { volume: 0.45, shouldPlay: false }),
        Audio.Sound.createAsync(SOUND_ASSETS.gift, { volume: 0.85, shouldPlay: false }),
        Audio.Sound.createAsync(SOUND_ASSETS.lost, { volume: 0.8, shouldPlay: false }),
        Audio.Sound.createAsync(SOUND_ASSETS.win, { volume: 0.9, shouldPlay: false }),
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
