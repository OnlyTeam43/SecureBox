// src/services/inviteService.js
// Profile / Handle invite link generator and handler

import { Share, Alert } from 'react-native';
import {
  findUserByHandle,
  checkConnectionStatus,
  sendConnectionRequest,
} from './supabase';
import { insertContact, upsertConversation } from '../db/database';

export const WEB_INVITE_BASE_URL = 'https://onlyteam43.github.io/SecureBox';

/**
 * Generate a shareable invite link & message for a given handle
 */
export const getInviteLink = (handle) => {
  const clean = handle ? handle.replace('@', '').trim().toLowerCase() : '';
  return `${WEB_INVITE_BASE_URL}/?u=${clean}`;
};

export const getNativeInviteLink = (handle) => {
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
  const webLink = getInviteLink(clean);
  const displayName = nickname ? `${nickname} (@${clean})` : `@${clean}`;

  return (
    `💌 Connect with me on SecureBox — private end-to-end encrypted chat & calls!\n\n` +
    `👉 Tap to connect:\n` +
    `${webLink}\n\n` +
    `1️⃣ If you don't have SecureBox installed, download the APK here:\n` +
    `${GITHUB_APK_DOWNLOAD_URL}\n\n` +
    `2️⃣ My handle is: ${displayName}\n` +
    `Once installed, tap the connect link above or search for @${clean} inside the app!`
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
 * Parse an incoming deep link URL (e.g. "https://onlyteam43.github.io/SecureBox/?u=alex" or "securebox://invite/alex")
 * Returns the target handle or null
 */
export const parseInviteUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  try {
    const cleanUrl = url.trim();

    // 1. Check for https? web links (e.g. https://onlyteam43.github.io/SecureBox/?u=alex or #alex)
    if (/^https?:\/\//i.test(cleanUrl)) {
      try {
        const parsed = new URL(cleanUrl);
        const queryHandle =
          parsed.searchParams.get('u') ||
          parsed.searchParams.get('invite') ||
          parsed.searchParams.get('handle');
        if (queryHandle) {
          const h = queryHandle.replace('@', '').trim().toLowerCase();
          return h.length >= 3 ? h : null;
        }
        if (parsed.hash) {
          const h = parsed.hash.replace(/^[#/]+/, '').replace('@', '').trim().toLowerCase();
          if (h && h.length >= 3) return h;
        }
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        const inviteIdx = pathParts.findIndex((p) => p.toLowerCase() === 'invite');
        if (inviteIdx !== -1 && pathParts[inviteIdx + 1]) {
          const h = pathParts[inviteIdx + 1].replace('@', '').trim().toLowerCase();
          return h.length >= 3 ? h : null;
        }
      } catch (_e) {
        // Continue to fallback regex if URL parsing fails
      }
    }

    // 2. Check for custom app scheme links (securebox://invite/alex or securebox://alex)
    const match =
      cleanUrl.match(/^[a-z0-9_.-]+:\/\/(?:invite|add|connect)\/([a-z0-9_.]+)/i) ||
      cleanUrl.match(/^securebox:\/\/([a-z0-9_.]{3,})/i);

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

    if (connStatus.status === 'connected' || connStatus.status === 'pending_sent') {
      const contact = connStatus.contact || { handle: cleanTarget, nickname: cleanTarget, avatar_id: 'avatar_rose' };
      const participants = [myHandle.toLowerCase(), cleanTarget].sort();
      const convId = `chat_${participants[0]}_${participants[1]}`;
      const contactId = `contact_${cleanTarget}`;
      await insertContact({
        id: contactId,
        handle: cleanTarget,
        nickname: contact.nickname || cleanTarget,
        avatarId: contact.avatar_id || 'avatar_rose',
      });
      await upsertConversation({
        id: convId,
        contactId,
        lastMsg: 'Connected! Say hi 💕',
        lastTime: Date.now(),
        unread: 0,
      });
      if (navigationRef.isReady()) {
        navigationRef.navigate('Chat', {
          conversationId: convId,
          contactHandle: contact.handle || cleanTarget,
          contactNickname: contact.nickname || cleanTarget,
          contactAvatarId: contact.avatar_id || 'avatar_rose',
        });
      }
      return;
    }

    if (connStatus.status === 'pending_received') {
      const contact = connStatus.contact || { handle: cleanTarget, nickname: cleanTarget, avatar_id: 'avatar_rose' };
      const participants = [cleanMy, cleanTarget].sort();
      const convId = `chat_${participants[0]}_${participants[1]}`;
      const contactId = `contact_${cleanTarget}`;
      await insertContact({
        id: contactId,
        handle: cleanTarget,
        nickname: contact.nickname || cleanTarget,
        avatarId: contact.avatar_id || 'avatar_rose',
      });
      await upsertConversation({
        id: convId,
        contactId,
        lastMsg: 'Connected! Say hi 💕',
        lastTime: Date.now(),
        unread: 0,
      });
      if (navigationRef.isReady()) {
        navigationRef.navigate('Chat', {
          conversationId: convId,
          contactHandle: contact.handle || cleanTarget,
          contactNickname: contact.nickname || cleanTarget,
          contactAvatarId: contact.avatar_id || 'avatar_rose',
        });
      }
      return;
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
      `You followed an invite link from @${cleanTarget} (${partnerName}). Start chatting now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Chat Now 💕',
          onPress: async () => {
            try {
              await sendConnectionRequest({
                fromHandle: myHandle,
                toHandle: cleanTarget,
                fromNickname: myNickname || myHandle,
                fromAvatar: myAvatarId,
              });

              const participants = [myHandle.toLowerCase(), cleanTarget].sort();
              const convId = `chat_${participants[0]}_${participants[1]}`;
              const contactId = `contact_${cleanTarget}`;
              await insertContact({
                id: contactId,
                handle: cleanTarget,
                nickname: partnerName,
                avatarId: remoteUser.avatar_id || 'avatar_rose',
              });
              await upsertConversation({
                id: convId,
                contactId,
                lastMsg: 'Chat request sent 💌',
                lastTime: Date.now(),
                unread: 0,
              });

              if (navigationRef.isReady()) {
                navigationRef.navigate('Chat', {
                  conversationId: convId,
                  contactHandle: cleanTarget,
                  contactNickname: partnerName,
                  contactAvatarId: remoteUser.avatar_id || 'avatar_rose',
                });
              }
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
