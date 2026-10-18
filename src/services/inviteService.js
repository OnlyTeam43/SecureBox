// src/services/inviteService.js
// Profile / Handle invite link generator and handler

import { Share, Alert } from 'react-native';
import {
  findUserByHandle,
  checkConnectionStatus,
  sendConnectionRequest,
} from './supabase';
import { useUserStore } from '../store/useUserStore';

/**
 * Generate a shareable invite link & message for a given handle
 */
export const getInviteLink = (handle) => {
  const clean = handle ? handle.replace('@', '').trim().toLowerCase() : '';
  return `securebox://invite/${clean}`;
};

export const GITHUB_APK_DOWNLOAD_URL =
  'https://github.com/OnlyTeam43/SecureBox/releases/latest/download/SecureBox.apk';

/**
 * Generate full share text for WhatsApp / SMS / Instagram / etc.
 */
export const getInviteMessage = (handle, nickname = null) => {
  const clean = handle ? handle.replace('@', '').trim().toLowerCase() : '';
  const appLink = getInviteLink(clean);
  const displayName = nickname ? `${nickname} (@${clean})` : `@${clean}`;

  return (
    `💌 Connect with me on SecureBox — private end-to-end encrypted chat & calls!\n\n` +
    `1️⃣ Download & install the SecureBox APK:\n` +
    `${GITHUB_APK_DOWNLOAD_URL}\n\n` +
    `2️⃣ Connect with me:\n` +
    `My handle is: @${clean}\n` +
    `Or tap this link once installed: ${appLink}`
  );
};

/**
 * Open native share dialog with the profile invite link
 */
export const shareProfileInvite = async (handle, nickname = null) => {
  try {
    const message = getInviteMessage(handle, nickname);
    const link = getInviteLink(handle);
    const result = await Share.share({
      title: 'Connect on SecureBox',
      message: message,
      url: link,
    });
    return result;
  } catch (err) {
    console.warn('Share invite error:', err);
  }
};

/**
 * Parse an incoming deep link URL (e.g. "securebox://invite/alex" or "com.securebox.app://invite/alex")
 * Returns the target handle or null
 */
export const parseInviteUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  try {
    const cleanUrl = url.trim();

    // Match patterns like securebox://invite/<handle> or securebox://add/<handle> or securebox://<handle>
    const match =
      cleanUrl.match(/^[a-z0-9_.-]+:\/\/(?:invite|add|connect)\/([a-z0-9_.]+)/i) ||
      cleanUrl.match(/^[a-z0-9_.-]+:\/\/([a-z0-9_.]{3,})/i);

    if (match && match[1]) {
      const handle = match[1].toLowerCase().replace('@', '').trim();
      return handle.length >= 3 ? handle : null;
    }
  } catch (e) {
    console.warn('parseInviteUrl error:', e);
  }
  return null;
};

/**
 * Execute connecting to a handle received via invite link
 * Handles verification, existing connection check, and sending the chat request
 */
export const handleIncomingInvite = async (
  targetHandle,
  navigationRef,
  myHandle,
  myNickname,
  myAvatarId
) => {
  const cleanTarget = targetHandle.replace('@', '').trim().toLowerCase();
  if (!cleanTarget) return;

  // If user tapped their own link
  if (myHandle && cleanTarget === myHandle.toLowerCase()) {
    return Alert.alert('Your Own Link', "That's your own profile link!");
  }

  try {
    // 1. Check existing connection status
    const connStatus = await checkConnectionStatus(myHandle, cleanTarget);

    if (connStatus.status === 'connected') {
      const contact = connStatus.contact;
      const participants = [myHandle.toLowerCase(), cleanTarget].sort();
      const convId = `chat_${participants[0]}_${participants[1]}`;
      return Alert.alert(
        'Already Connected 💕',
        `You and @${cleanTarget} are already connected!`,
        [
          { text: 'Close', style: 'cancel' },
          {
            text: 'Open Chat',
            onPress: () => {
              if (navigationRef.isReady()) {
                navigationRef.navigate('Chat', {
                  conversationId: convId,
                  contactHandle: contact.handle,
                  contactNickname: contact.nickname,
                  contactAvatarId: contact.avatar_id,
                });
              }
            },
          },
        ]
      );
    }

    if (connStatus.status === 'pending_sent') {
      return Alert.alert(
        'Request Already Sent ⏳',
        `You've already sent a connection request to @${cleanTarget}. Waiting for them to accept!`,
        [
          {
            text: 'View Requests',
            onPress: () => {
              if (navigationRef.isReady()) {
                navigationRef.navigate('MainTabs', { screen: 'Requests' });
              }
            },
          },
          { text: 'OK', style: 'cancel' },
        ]
      );
    }

    if (connStatus.status === 'pending_received') {
      return Alert.alert(
        'Request Waiting! 💌',
        `@${cleanTarget} has already sent you a connection request! Go to your Requests tab to accept.`,
        [
          {
            text: 'Go to Requests',
            onPress: () => {
              if (navigationRef.isReady()) {
                navigationRef.navigate('MainTabs', { screen: 'Requests' });
              }
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }

    // 2. Lookup remote user in Supabase
    const remoteUser = await findUserByHandle(cleanTarget);
    if (!remoteUser) {
      return Alert.alert(
        'User Not Found',
        `No SecureBox account found with handle @${cleanTarget}.`
      );
    }

    const partnerName = remoteUser.nickname || cleanTarget;

    // 3. Prompt user to send request
    Alert.alert(
      `Connect with ${partnerName}! 💌`,
      `You followed an invite link from @${cleanTarget} (${partnerName}). Would you like to send a chat request now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Request 💕',
          onPress: async () => {
            try {
              await sendConnectionRequest({
                fromHandle: myHandle,
                toHandle: cleanTarget,
                fromNickname: myNickname || myHandle,
                fromAvatar: myAvatarId,
              });

              Alert.alert(
                'Request Sent! 💌',
                `Connection request sent to @${cleanTarget}! Once they accept, they will appear in your Messages.`,
                [
                  {
                    text: 'View Requests',
                    onPress: () => {
                      if (navigationRef.isReady()) {
                        navigationRef.navigate('MainTabs', { screen: 'Requests' });
                      }
                    },
                  },
                  { text: 'OK' },
                ]
              );
            } catch (err) {
              Alert.alert('Error', err.message || 'Could not send request.');
            }
          },
        },
      ]
    );
  } catch (err) {
    console.warn('handleIncomingInvite error:', err);
    Alert.alert('Error', 'Could not process invite link.');
  }
};
