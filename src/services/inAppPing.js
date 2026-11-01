// src/services/inAppPing.js
// Gentle in-app alert when a message arrives while the app is open outside active chat.
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import gameAudioService from './gameAudioService';

let sound = null;
let lastPlayedAt = 0;

export const playInAppPing = async () => {
  const now = Date.now();
  if (now - lastPlayedAt < 1200) return; // one alert per burst of messages
  lastPlayedAt = now;

  try {
    // Subtle tactile haptic pulse
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Respect user's in-app sound mute setting
    if (gameAudioService.getMuted()) return;

    // Do NOT play over silent switch
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
    }).catch(() => {});

    if (!sound) {
      const res = await Audio.Sound.createAsync(
        require('../../assets/sounds/ping.wav'),
        { volume: 0.6 }
      );
      sound = res.sound;
    }
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (_) {}
};
