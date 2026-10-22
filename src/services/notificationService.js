// src/services/notificationService.js
// Centralized push & local notification service for SecureBox

import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { navigate } from '../navigation/navigationRef';
import { useBadgeStore } from '../store/useBadgeStore';
import { saveUserPushToken } from './supabase';

// Configure foreground notification behavior: Sound only, NO popup alert or banner
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // NO popup alert
    shouldPlaySound: true,  // Sound only
    shouldSetBadge: true,
    shouldShowBanner: false, // NO banner popup
    shouldShowList: true,   // List in notification tray
  }),
});

// Currently open conversation tracker (prevents notification for active chat)
let activeConversationId = null;

export const setActiveConversation = (id) => {
  activeConversationId = id;
};

export const getActiveConversation = () => activeConversationId;

export const NOTIFICATION_CHANNELS = {
  MESSAGES: 'messages_sound_v1',
  REQUESTS: 'requests_sound_v1',
  CALLS: 'calls_incoming_v2',
  SECURITY: 'security_sound_v1',
};

/**
 * Initialize notifications: request permissions and set up Android channels
 */
export const initNotifications = async () => {
  try {
    // 1. Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: false, // No popup alert
          allowBadge: true,
          allowSound: true,  // Sound only
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
      return false;
    }

    // 2. Set up Android Notification Channels
    if (Platform.OS === 'android') {
      // Clean up legacy channels
      await Notifications.deleteNotificationChannelAsync('messages').catch(() => {});
      await Notifications.deleteNotificationChannelAsync('requests').catch(() => {});
      await Notifications.deleteNotificationChannelAsync('calls').catch(() => {});
      await Notifications.deleteNotificationChannelAsync('calls_sound_v1').catch(() => {});
      await Notifications.deleteNotificationChannelAsync('security').catch(() => {});

      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.MESSAGES, {
        name: 'Chat Messages',
        importance: Notifications.AndroidImportance.DEFAULT, // Sound, NO popup
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E02888',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.REQUESTS, {
        name: 'Connection Requests',
        importance: Notifications.AndroidImportance.DEFAULT, // Sound, NO popup
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#E02888',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      // CALLS channel: High importance so Android wakes device when app is in background/minimized
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.CALLS, {
        name: 'Incoming Calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 1000, 500, 1000, 500, 1000],
        lightColor: '#25D366',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.SECURITY, {
        name: 'Security & Privacy Alerts',
        importance: Notifications.AndroidImportance.DEFAULT, // Sound, NO popup
        vibrationPattern: [0, 150, 150, 150],
        lightColor: '#FF3B30',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    return true;
  } catch (err) {
    console.warn('initNotifications error:', err.message);
    return false;
  }
};

/**
 * Register device's Expo Push Token and sync to Supabase
 * Enables receiving messages, calls, and requests even when the app is completely closed
 */
export const registerPushToken = async (myHandle) => {
  if (!myHandle) return;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Push permissions not granted for remote tokens');
      return;
    }

    const tokenObj = await Notifications.getExpoPushTokenAsync().catch((err) => {
      console.log('getExpoPushTokenAsync notice:', err.message);
      return null;
    });

    if (tokenObj && tokenObj.data) {
      console.log(`[PushService] Acquired push token for ${myHandle}: ${tokenObj.data}`);
      await saveUserPushToken(myHandle, tokenObj.data);
    }
  } catch (err) {
    console.log('registerPushToken error:', err.message);
  }
};

/**
 * Handle notification click navigation
 */
export const handleNotificationClick = (response) => {
  try {
    const data = response?.notification?.request?.content?.data;
    if (!data) return;

    if (data.type === 'chat') {
      navigate('Chat', {
        conversationId: data.conversationId,
        contactHandle: data.contactHandle,
        contactNickname: data.contactNickname || data.contactHandle,
        contactAvatarId: data.contactAvatarId || 'avatar_rose',
      });
    } else if (data.type === 'request') {
      navigate('MainTabs', {
        screen: 'Requests',
      });
    } else if (data.type === 'call') {
      // If user tapped on an incoming call notification, open call view
      if (data.callId) {
        navigate('Call', {
          callId: data.callId,
          partnerHandle: data.callerHandle,
          partnerNickname: data.callerNickname,
          partnerAvatarId: data.callerAvatarId,
          callType: data.callType || 'voice',
          isCaller: false,
        });
      }
    }
  } catch (err) {
    console.warn('handleNotificationClick error:', err);
  }
};

/**
 * Check if app was opened by clicking a notification and handle it
 */
export const checkInitialNotification = async () => {
  try {
    const lastResponse = await Notifications.getLastNotificationResponseAsync();
    if (lastResponse) {
      handleNotificationClick(lastResponse);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }
  } catch (err) {
    console.log('checkInitialNotification notice:', err.message);
  }
};

/**
 * Notify incoming chat message (Sound only, NO popup, Parcel-safe)
 */
export const notifyIncomingMessage = async ({
  senderNickname,
  senderHandle,
  text,
  conversationId,
  contactAvatarId,
}) => {
  // If user is actively chatting in this conversation in foreground, suppress notification
  if (activeConversationId === conversationId && AppState.currentState === 'active') {
    return;
  }

  try {
    const cleanNick = String(senderNickname || '').substring(0, 40);
    const cleanHandle = String(senderHandle || '').replace('@', '').substring(0, 30);
    const title = cleanNick || (cleanHandle ? `@${cleanHandle}` : 'New Message');

    // Strictly ensure text is safe and never a huge raw base64 string
    let body = 'New Message';
    if (typeof text === 'string') {
      if (text.startsWith('data:') || text.length > 120) {
        body = 'Sent a photo 📷';
      } else {
        body = text.trim();
      }
    }

    const safeAvatarId =
      contactAvatarId &&
      typeof contactAvatarId === 'string' &&
      !contactAvatarId.startsWith('data:') &&
      !contactAvatarId.startsWith('file:') &&
      contactAvatarId.length < 50
        ? contactAvatarId
        : 'avatar_rose';

    // 1. If foregrounded, display the slick In-App notification toast!
    if (AppState.currentState === 'active') {
      useBadgeStore.getState().showInAppNotification({
        type: 'chat',
        title,
        body,
        avatar: safeAvatarId,
        data: {
          conversationId: String(conversationId || ''),
          contactHandle: cleanHandle,
          contactNickname: cleanNick,
          contactAvatarId: safeAvatarId,
        },
      });
    }

    // Refresh badge counts
    useBadgeStore.getState().refreshBadges();

    // 2. Play sound via system notification handler (sound only, no heads-up popup alert in foreground)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: String(title).substring(0, 40),
        body: String(body).substring(0, 100),
        data: {
          type: 'chat',
          conversationId: String(conversationId || ''),
          contactHandle: cleanHandle,
          contactNickname: cleanNick,
          contactAvatarId: safeAvatarId,
        },
        sound: 'default',
        channelId: NOTIFICATION_CHANNELS.MESSAGES,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('notifyIncomingMessage error:', err.message);
  }
};

/**
 * Notify incoming connection request (Sound only, NO popup, Parcel-safe)
 */
export const notifyConnectionRequest = async ({ fromHandle, fromNickname, reqId }) => {
  try {
    const cleanHandle = fromHandle ? fromHandle.replace('@', '').substring(0, 30) : 'someone';
    const cleanNick = fromNickname ? String(fromNickname).substring(0, 40) : null;
    const displayName = cleanNick ? `${cleanNick} (@${cleanHandle})` : `@${cleanHandle}`;

    // If foregrounded, show in-app banner toast
    if (AppState.currentState === 'active') {
      useBadgeStore.getState().showInAppNotification({
        type: 'request',
        title: 'New Connection Request 💌',
        body: `${displayName} wants to connect with you!`,
        avatar: 'avatar_rose',
        data: {
          fromHandle: cleanHandle,
          fromNickname: cleanNick || cleanHandle,
          reqId: String(reqId || ''),
        },
      });
    }

    useBadgeStore.getState().refreshBadges();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New Connection Request 💌',
        body: `${displayName} wants to connect with you!`,
        data: {
          type: 'request',
          fromHandle: cleanHandle,
          fromNickname: cleanNick || cleanHandle,
          reqId: String(reqId || ''),
        },
        sound: 'default',
        channelId: NOTIFICATION_CHANNELS.REQUESTS,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('notifyConnectionRequest error:', err.message);
  }
};

/**
 * Notify connection request accepted (Sound only, NO popup, Parcel-safe)
 */
export const notifyRequestAccepted = async ({ byHandle, byNickname, byAvatar }) => {
  try {
    const cleanHandle = byHandle ? byHandle.replace('@', '').substring(0, 30) : 'User';
    const cleanNick = byNickname ? String(byNickname).substring(0, 40) : null;
    const displayName = cleanNick ? `${cleanNick} (@${cleanHandle})` : `@${cleanHandle}`;

    const safeAvatar =
      byAvatar &&
      typeof byAvatar === 'string' &&
      !byAvatar.startsWith('data:') &&
      !byAvatar.startsWith('file:') &&
      byAvatar.length < 50
        ? byAvatar
        : 'avatar_rose';

    if (AppState.currentState === 'active') {
      useBadgeStore.getState().showInAppNotification({
        type: 'chat',
        title: 'Request Accepted! 💕',
        body: `${displayName} accepted your chat request! Say hi.`,
        avatar: safeAvatar,
        data: {
          contactHandle: cleanHandle,
          contactNickname: cleanNick || cleanHandle,
          contactAvatarId: safeAvatar,
        },
      });
    }

    useBadgeStore.getState().refreshBadges();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Request Accepted! 💕',
        body: `${displayName} accepted your chat request! Say hi.`,
        data: {
          type: 'chat',
          contactHandle: cleanHandle,
          contactNickname: cleanNick || cleanHandle,
          contactAvatarId: safeAvatar,
        },
        sound: 'default',
        channelId: NOTIFICATION_CHANNELS.REQUESTS,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('notifyRequestAccepted error:', err.message);
  }
};

/**
 * Notify incoming call:
 * - In Foreground: Handled completely by IncomingCallModal overlay + ringtone sound.
 * - In Background: Alerts device with high-priority heads-up notification so user never misses the call!
 */
export const notifyIncomingCall = async ({
  callId,
  callerHandle,
  callerNickname,
  callerAvatarId,
  callType,
}) => {
  // If app is actively in foreground, suppress system notification because IncomingCallModal is displayed directly on screen
  if (AppState.currentState === 'active') {
    return;
  }

  try {
    const cleanNick = String(callerNickname || '').substring(0, 40);
    const cleanHandle = String(callerHandle || '').replace('@', '').substring(0, 30);
    const displayName = cleanNick || `@${cleanHandle}`;
    const callTypeName = callType === 'video' ? 'Video' : 'Voice';

    const safeAvatarId =
      callerAvatarId &&
      typeof callerAvatarId === 'string' &&
      !callerAvatarId.startsWith('data:') &&
      !callerAvatarId.startsWith('file:') &&
      callerAvatarId.length < 50
        ? callerAvatarId
        : 'avatar_rose';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Incoming ${callTypeName} Call 📞`,
        body: `${displayName} is calling you. Tap to answer!`,
        data: {
          type: 'call',
          callId: String(callId || ''),
          callerHandle: cleanHandle,
          callerNickname: cleanNick,
          callerAvatarId: safeAvatarId,
          callType: callType || 'voice',
        },
        sound: 'default',
        channelId: NOTIFICATION_CHANNELS.CALLS,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('notifyIncomingCall error:', err.message);
  }
};

/**
 * Notify missed call: updates badge store & in-app or system notification
 */
export const notifyMissedCall = async ({
  callerHandle,
  callerNickname,
  callerAvatarId,
  callType,
}) => {
  const cleanNick = callerNickname || (callerHandle ? `@${callerHandle.replace('@', '')}` : 'Someone');
  const callTypeName = callType === 'video' ? 'Video' : 'Voice';

  if (AppState.currentState === 'active') {
    useBadgeStore.getState().showInAppNotification({
      type: 'call',
      title: `Missed ${callTypeName} Call 📵`,
      body: `Missed call from ${cleanNick}`,
      avatar: callerAvatarId || 'avatar_rose',
      data: { callerHandle, callerNickname, callerAvatarId, callType },
    });
  } else {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Missed ${callTypeName} Call 📵`,
          body: `Missed call from ${cleanNick}`,
          data: {
            type: 'call',
            callerHandle,
            callerNickname,
          },
          sound: 'default',
          channelId: NOTIFICATION_CHANNELS.CALLS,
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
        },
        trigger: null,
      });
    } catch (_) {}
  }

  useBadgeStore.getState().refreshBadges();
};

/**
 * Dismiss all active call notifications
 */
export const dismissAllCallNotifications = async () => {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (_) {}
};

/**
 * Notify security alert (e.g. screenshot taken)
 */
export const notifySecurityAlert = async ({ actorHandle, message }) => {
  try {
    const cleanHandle = actorHandle ? actorHandle.replace('@', '') : 'User';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Security Alert ⚠️',
        body: message || `@${cleanHandle} took a screenshot of this conversation!`,
        data: {
          type: 'security',
          actorHandle: cleanHandle,
        },
        sound: 'default',
        channelId: NOTIFICATION_CHANNELS.SECURITY,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('notifySecurityAlert error:', err.message);
  }
};

/**
 * Notify screenshot permission request
 */
export const notifyScreenshotRequest = async ({ requesterNickname, requesterHandle, conversationId }) => {
  try {
    const cleanHandle = requesterHandle ? requesterHandle.replace('@', '') : 'User';
    const displayName = requesterNickname || `@${cleanHandle}`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Screenshot Request 📸',
        body: `${displayName} requested permission to take a screenshot.`,
        data: {
          type: 'chat',
          conversationId,
          contactHandle: cleanHandle,
        },
        sound: 'default',
        channelId: NOTIFICATION_CHANNELS.SECURITY,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('notifyScreenshotRequest error:', err.message);
  }
};
