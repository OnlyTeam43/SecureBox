// src/services/inAppPing.js
// Short in-app sound used when a message arrives while the app is open.
import { Audio } from 'expo-av';

let sound = null;
let lastPlayedAt = 0;

export const playInAppPing = async () => {
  const now = Date.now();
  if (now - lastPlayedAt < 1200) return; // one sound per burst of messages
  lastPlayedAt = now;
  try {
    if (!sound) {
      const res = await Audio.Sound.createAsync(require('../../assets/sounds/ping.wav'), { volume: 1 });
      sound = res.sound;
    }
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (_) {}
};
