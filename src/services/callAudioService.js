// src/services/callAudioService.js
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import {
  getOutgoingRingToneUri,
  getIncomingRingToneUri,
  getConnectedToneUri,
  getEndedToneUri,
} from './soundGenerator';

let currentSound = null;
let vibrationTimer = null;
let isAudioModeConfigured = false;

// Pre-generated data URIs (cached once in memory)
let cachedOutgoingRingUri = null;
let cachedIncomingRingUri = null;
let cachedConnectedUri = null;
let cachedEndedUri = null;

const ensureAudioMode = async (isSpeaker = true) => {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: !isSpeaker,
      staysActiveInBackground: true,
    });
    isAudioModeConfigured = true;
  } catch (err) {
    console.warn('Audio mode config error:', err.message);
  }
};

export const callAudioService = {
  /**
   * Stop any active audio and vibration immediately
   */
  async stopAll() {
    if (vibrationTimer) {
      clearInterval(vibrationTimer);
      vibrationTimer = null;
    }
    if (currentSound) {
      try {
        await currentSound.stopAsync();
        await currentSound.unloadAsync();
      } catch (_) {}
      currentSound = null;
    }
  },

  /**
   * Play outgoing ringback tone ("tuut... tuut...") on loop
   */
  async playOutgoingRing() {
    await this.stopAll();
    await ensureAudioMode(true);

    try {
      if (!cachedOutgoingRingUri) {
        cachedOutgoingRingUri = getOutgoingRingToneUri();
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: cachedOutgoingRingUri },
        { shouldPlay: true, isLooping: true, volume: 0.7 }
      );
      currentSound = sound;
    } catch (err) {
      console.warn('Play outgoing ring error:', err.message);
    }
  },

  /**
   * Play incoming ringtone on loop + periodic haptics
   */
  async playIncomingRing() {
    await this.stopAll();
    await ensureAudioMode(true);

    // Vibration pattern every 1.5 seconds
    const triggerHaptics = () => {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch (_) {}
    };
    triggerHaptics();
    vibrationTimer = setInterval(triggerHaptics, 1500);

    try {
      if (!cachedIncomingRingUri) {
        cachedIncomingRingUri = getIncomingRingToneUri();
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: cachedIncomingRingUri },
        { shouldPlay: true, isLooping: true, volume: 0.9 }
      );
      currentSound = sound;
    } catch (err) {
      console.warn('Play incoming ring error:', err.message);
    }
  },

  /**
   * Play connected chime once (stops ringtone first)
   */
  async playConnectedChime() {
    await this.stopAll();
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_) {}

    try {
      if (!cachedConnectedUri) {
        cachedConnectedUri = getConnectedToneUri();
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: cachedConnectedUri },
        { shouldPlay: true, isLooping: false, volume: 0.8 }
      );
      currentSound = sound;
      setTimeout(async () => {
        try {
          await sound.unloadAsync();
          if (currentSound === sound) currentSound = null;
        } catch (_) {}
      }, 600);
    } catch (err) {
      console.warn('Play connected chime error:', err.message);
    }
  },

  /**
   * Play ended tone once
   */
  async playEndedChime() {
    await this.stopAll();
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (_) {}

    try {
      if (!cachedEndedUri) {
        cachedEndedUri = getEndedToneUri();
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: cachedEndedUri },
        { shouldPlay: true, isLooping: false, volume: 0.7 }
      );
      currentSound = sound;
      // Auto unload after short delay
      setTimeout(async () => {
        try {
          await sound.unloadAsync();
        } catch (_) {}
      }, 1000);
    } catch (err) {
      console.warn('Play ended chime error:', err.message);
    }
  },

  /**
   * Switch between earpiece and speaker
   */
  async setSpeakerphone(enableSpeaker) {
    try {
      await ensureAudioMode(enableSpeaker);
    } catch (err) {
      console.warn('Speakerphone toggle error:', err.message);
    }
  },
};
