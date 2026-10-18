// src/services/notificationService.js
// Centralized push & local notification service for SecureBox

import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { navigate } from '../navigation/navigationRef';

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Currently open conversation tracker (prevents notification banners for active chat)
let activeConversationId = null;

export const setActiveConversation = (id) => {
  activeConversationId = id;
};

export const getActiveConversation = () => activeConversationId;

export const NOTIFICATION_CHANNELS = {
  MESSAGES: 'messages',
  REQUESTS: 'requests',
  CALLS: 'calls',
  SECURITY: 'security',
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
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
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
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.MESSAGES, {
        name: 'Chat Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E02888',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.REQUESTS, {
        name: 'Connection Requests',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#E02888',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.CALLS, {
        name: 'Incoming Calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 500, 500],
        lightColor: '#E02888',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.SECURITY, {
        name: 'Security & Privacy Alerts',
        importance: Notifications.AndroidImportance.HIGH,
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
 * Notify incoming chat message
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
    const title = senderNickname || (senderHandle ? `@${senderHandle}` : 'New Message');
    const body = text || 'Sent a photo 📷';

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type: 'chat',
          conversationId,
          contactHandle: senderHandle,
          contactNickname: senderNickname,
          contactAvatarId: contactAvatarId || 'avatar_rose',
        },
        sound: 'default',
        channelId: NOTIFICATION_CHANNELS.MESSAGES,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('notifyIncomingMessage error:', err.message);
  }
};

/**
 * Notify incoming connection request
 */
export const notifyConnectionRequest = async ({ fromHandle, fromNickname, reqId }) => {
  try {
    const cleanHandle = fromHandle ? fromHandle.replace('@', '') : 'someone';
    const displayName = fromNickname ? `${fromNickname} (@${cleanHandle})` : `@${cleanHandle}`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New Connection Request 💌',
        body: `${displayName} wants to connect with you!`,
        data: {
          type: 'request',
          fromHandle: cleanHandle,
          fromNickname,
          reqId,
        },
        sound: 'default',
        channelId: NOTIFICATION_CHANNELS.REQUESTS,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('notifyConnectionRequest error:', err.message);
  }
};

/**
 * Notify connection request accepted
 */
export const notifyRequestAccepted = async ({ byHandle, byNickname, byAvatar }) => {
  try {
    const cleanHandle = byHandle ? byHandle.replace('@', '') : 'User';
    const displayName = byNickname ? `${byNickname} (@${cleanHandle})` : `@${cleanHandle}`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Request Accepted! 💕',
        body: `${displayName} accepted your chat request! Say hi.`,
        data: {
          type: 'chat',
          contactHandle: cleanHandle,
          contactNickname: byNickname || cleanHandle,
          contactAvatarId: byAvatar || 'avatar_rose',
        },
        sound: 'default',
        channelId: NOTIFICATION_CHANNELS.REQUESTS,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('notifyRequestAccepted error:', err.message);
  }
};

/**
 * Notify incoming call
 */
export const notifyIncomingCall = async ({ callerNickname, callerHandle, callType, callId, callerAvatarId }) => {
  try {
    const cleanHandle = callerHandle ? callerHandle.replace('@', '') : 'User';
    const displayName = callerNickname || `@${cleanHandle}`;
    const typeLabel = callType === 'video' ? 'Video' : 'Voice';
    const safeAvatarId =
      callerAvatarId && callerAvatarId.length < 100 && !callerAvatarId.startsWith('data:')
        ? callerAvatarId
        : 'avatar_rose';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Incoming ${typeLabel} Call 📞`,
        body: `${displayName} is calling you...`,
        data: {
          type: 'call',
          callId,
          callerHandle: cleanHandle,
          callerNickname: displayName,
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
        priority: Notifications.AndroidNotificationPriority.HIGH,
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
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('notifyScreenshotRequest error:', err.message);
  }
};
