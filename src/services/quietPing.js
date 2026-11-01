// src/services/quietPing.js
// Runs when a SILENT data push arrives while the app is closed or in the background.
// IMPORTANT: import this file at the very top of your entry file (index.js), before the app starts.
//
// Discreet OFF on this phone -> play a quick sound with no popup (a notification on a quiet
//                               channel that is removed after ~1.5 s).
// Discreet ON on this phone  -> show the disguised notification (covers the case where the
//                               server's copy of the toggle was out of date).
import { AppState } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const QUIET_TASK = 'SECUREBOX-QUIET-PUSH';
const DISCREET_CHANNEL = 'discreet_alert_v1';
const TEXTS = [
  '🐼 Panda is missing you! Let’s play!',
  '🐾 Your pet wants to play Brick Breaker!',
  '🎮 High score challenge waiting for you!',
  '✨ Panda has a daily reward for you!',
  '🏆 Ready to smash some bricks?',
];

const readKind = (data) => {
  try {
    const m = JSON.stringify(data || {}).match(/"k\\?"\s*:\s*\\?"(msg|req|call)\\?"/);
    return m ? m[1] : null;
  } catch (_) {
    return null;
  }
};

const discreetOnThisPhone = async () => {
  try {
    const raw = await AsyncStorage.getItem('securebox-user');
    const state = raw ? JSON.parse(raw).state : null;
    return Boolean(state && state.isStealthNotificationsEnabled);
  } catch (_) {
    return false;
  }
};

TaskManager.defineTask(QUIET_TASK, async ({ data, error }) => {
  if (error) return;
  if (AppState.currentState === 'active') return; // the open app plays its own in-app sound
  const kind = readKind(data);
  if (kind !== 'msg' && kind !== 'req') return;

  try {
    if (await discreetOnThisPhone()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Animal Smash 🐾',
          body: TEXTS[Math.floor(Math.random() * TEXTS.length)],
          sound: 'default',
          data: { k: kind },
        },
        trigger: { channelId: DISCREET_CHANNEL },
      });
      return;
    }

    // Discreet is OFF: Complete stealth mode.
    // Do NOT show any popup notification or "System: Done" banners.
  } catch (_) {}
});

Notifications.registerTaskAsync(QUIET_TASK).catch(() => {});
