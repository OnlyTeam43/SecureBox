// src/services/notificationService.js  (REPLACES the old file)
//
// How it works now
//  - Supabase sends the push (see supabase/push_trigger.sql). Phones never send pushes.
//  - Discreet ON : the server sends a disguised notification with sound. Android shows it by itself.
//  - Discreet OFF: the server sends a silent data push. src/services/quietPing.js plays a quick
//                  sound with no popup. Calls send nothing.
//  - App open    : system notifications are hidden. A short sound plays and the badge on the
//                  animal game icon pulses.
//  - The toggle is saved on the phone AND on the user's row in Supabase the moment it changes.

import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { navigate } from '../navigation/navigationRef';
import { useBadgeStore } from '../store/useBadgeStore';
import { useUserStore } from '../store/useUserStore';
import { supabase } from './supabase';

// App open: never show a system notification or play the system sound.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

export const NOTIFICATION_CHANNELS = {
  DISCREET: 'discreet_alert_v1', // Discreet ON: popup + sound
  QUIET: 'quiet_ping_v1', // Discreet OFF: sound only, no popup
  CALLS: 'calls_incoming_v2', // Discreet ON: incoming call
};

let activeConversationId = null;
export const setActiveConversation = (id) => {
  activeConversationId = id;
};
export const getActiveConversation = () => activeConversationId;

let receivedSub = null;

const cleanHandle = (h) => String(h || '').replace('@', '').trim().toLowerCase();

/** In-app sound + game icon badge pulse. Called when a message is saved while the app is open. */
export const onIncomingStored = (convId = null) => {
  if (AppState.currentState !== 'active') return;
  const activeChat = getActiveConversation();
  // If the user is actively looking at this conversation, do NOT play ping or pulse
  if (activeChat && (!convId || activeChat === convId)) return;
  useBadgeStore.getState().showInAppNotification();
};

/** Ask permission, create channels, listen for pushes that arrive while the app is open. */
export const initNotifications = async () => {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (Platform.OS === 'android') {
      for (const old of ['messages_sound_v1', 'requests_sound_v1', 'calls_sound_v1', 'security_sound_v1', 'messages', 'requests', 'calls', 'security']) {
        await Notifications.deleteNotificationChannelAsync(old).catch(() => {});
      }
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.DISCREET, {
        name: 'Game notifications',
        importance: Notifications.AndroidImportance.HIGH, // popup + sound
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
        showBadge: false,
      });
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.QUIET, {
        name: 'Quiet sound',
        importance: Notifications.AndroidImportance.DEFAULT, // sound, NO popup
        enableVibrate: false,
        sound: 'default',
        showBadge: false,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET,
      });
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.CALLS, {
        name: 'Game challenges',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 1000, 500, 1000, 500, 1000],
        sound: 'default',
        showBadge: false,
      });
    }

    // A push that arrives while the app is open: play the in-app sound and pulse the badge.
    if (!receivedSub) {
      receivedSub = Notifications.addNotificationReceivedListener(() => {
        useBadgeStore.getState().refreshBadges?.();
        // If user is currently looking at any active chat, never interrupt with in-app sound!
        if (getActiveConversation()) return;
        onIncomingStored();
      });
    }
    return finalStatus === 'granted';
  } catch (err) {
    console.warn('initNotifications error:', err?.message);
    return false;
  }
};

/**
 * Save this phone's push token AND the current Discreet setting on the user's row.
 * Call it at login and on every app resume (AppNavigator already does).
 * Returns true only if the row was really updated.
 */
export const registerPushToken = async (myHandle) => {
  const handle = cleanHandle(myHandle);
  if (!handle) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return false;

    const tokenObj = await Notifications.getExpoPushTokenAsync().catch((err) => {
      console.warn('[Push] getExpoPushTokenAsync failed:', err?.message);
      return null;
    });
    if (!tokenObj?.data) return false;

    const discreet = Boolean(useUserStore.getState().isStealthNotificationsEnabled);
    const { error } = await supabase
      .from('users')
      .update({ push_token: String(tokenObj.data), discreet_push: discreet })
      .eq('handle', handle);
    if (error) {
      console.warn('[Push] Could not save token:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Push] registerPushToken error:', err?.message);
    return false;
  }
};

/** Call this from the "Discreet Push Notifications" switch in Profile. */
export const setDiscreetPush = async (enabled) => {
  const value = Boolean(enabled);
  useUserStore.getState().setStealthNotificationsEnabled(value);
  const handle = cleanHandle(useUserStore.getState().handle);
  if (!handle) return;
  const { error } = await supabase.from('users').update({ discreet_push: value }).eq('handle', handle);
  if (error) console.warn('[Push] Could not save Discreet setting (will retry on resume):', error.message);
};

/** Tap on a notification. The push carries no names or ids, so just open the inbox. */
export const handleNotificationClick = (response) => {
  try {
    const data = response?.notification?.request?.content?.data || {};
    const st = useUserStore.getState();
    // Game disguise is active and locked: do not jump past it.
    if (st.isStealthModeEnabled && !st.isStealthUnlocked) return;
    if (data.k === 'msg' || data.k === 'req') {
      const go = () => navigate('MainTabs', { screen: 'Inbox' });
      try {
        go();
      } catch (_) {
        setTimeout(go, 1500);
      }
    }
    // data.k === 'call': the invite is picked up by the pending-call check when the app opens.
  } catch (err) {
    console.warn('handleNotificationClick error:', err);
  }
};

export const checkInitialNotification = async () => {
  try {
    const last = await Notifications.getLastNotificationResponseAsync();
    if (last) {
      handleNotificationClick(last);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }
  } catch (_) {}
};

export const dismissAllCallNotifications = async () => {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (_) {}
};

// ---- Old exports kept so existing imports do not break. The server now sends these. ----
export const notifyIncomingCall = async () => {};
export const notifyIncomingMessage = async () => onIncomingStored();
export const notifyConnectionRequest = async () => onIncomingStored();
export const notifyRequestAccepted = async () => onIncomingStored();
export const notifyMissedCall = async () => useBadgeStore.getState().refreshBadges?.();
export const notifySecurityAlert = async () => {};
export const notifyScreenshotRequest = async () => {};
