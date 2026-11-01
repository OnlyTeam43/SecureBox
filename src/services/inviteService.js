// src/services/inviteService.js
// Profile / Handle invite link generator and handler

import { Share, Alert, Clipboard } from 'react-native';
import {
  findUserByHandle,
  checkConnectionStatus,
  sendConnectionRequest,
} from './supabase';
import { insertContact, upsertConversation } from '../db/database';

export const WEB_INVITE_BASE_URL = 'https://kanelijo.com/securebox';

/**
 * Generate a shareable invite link & message for a given handle
 */
export const getInviteLink = (handle) => {
  const clean = handle ? handle.replace('@', '').trim().toLowerCase() : '';
  return `${WEB_INVITE_BASE_URL}?connect=@${clean}&download=auto`;
};

export const getNativeInviteLink = (handle) => {
  const clean = handle ? handle.replace('@', '').trim().toLowerCase() : '';
  return `securebox://connect/@${clean}`;
};

export const GITHUB_APK_DOWNLOAD_URL = 'https://kanelijo.com/securebox/SecureBox.apk';

/**
 * Generate full share text for WhatsApp / SMS / Instagram / etc.
 */
export const getInviteMessage = (handle, nickname = null) => {
  const clean = handle ? handle.replace('@', '').trim().toLowerCase() : '';
  const webLink = getInviteLink(clean);
  const displayName = nickname ? `${nickname} (@${clean})` : `@${clean}`;

  return (
    `💌 Connect with me on SecureBox — private end-to-end encrypted chat & calls!\n\n` +
    `👉 Tap to connect & download:\n` +
    `${webLink}\n\n` +
    `My handle is: ${displayName}\n` +
    `Once installed, tap the link again to jump straight into our chat!`
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

    // 0. Direct handle format e.g. "@alex" or "alex"
    if (cleanUrl.startsWith('@')) {
      const h = cleanUrl.slice(1).trim().toLowerCase();
      if (/^[a-z0-9_.]{3,30}$/.test(h)) return h;
    }

    // 1. Check for https? web links (e.g. https://kanelijo.com/securebox?connect=@alex)
    if (/^https?:\/\//i.test(cleanUrl)) {
      try {
        const parsed = new URL(cleanUrl);
        const queryHandle =
          parsed.searchParams.get('connect') ||
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
        const inviteIdx = pathParts.findIndex((p) => p.toLowerCase() === 'invite' || p.toLowerCase() === 'connect');
        if (inviteIdx !== -1 && pathParts[inviteIdx + 1]) {
          const h = pathParts[inviteIdx + 1].replace('@', '').trim().toLowerCase();
          return h.length >= 3 ? h : null;
        }
      } catch (_e) {
        // Continue to fallback regex if URL parsing fails
      }
    }

    // 2. Check for custom app scheme links (securebox://connect/@alex or securebox://invite/alex)
    const match =
      cleanUrl.match(/^[a-z0-9_.-]+:\/\/(?:invite|add|connect)\/?@?([a-z0-9_.]+)/i) ||
      cleanUrl.match(/^securebox:\/\/@?([a-z0-9_.]{3,})/i);

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
 * Check device clipboard for an invite link or @handle on first launch
 * Returns handle if found and clears clipboard to prevent re-triggering.
 */
export const checkClipboardForInvite = async () => {
  try {
    const text = await Clipboard.getString();
    if (!text || typeof text !== 'string') return null;
    const clean = text.trim();
    if (!clean) return null;

    const handle = parseInviteUrl(clean);
    if (handle) {
      console.log('[InviteService] Detected deferred invite in clipboard:', handle);
      try {
        Clipboard.setString('');
      } catch (_) {}
      return handle;
    }
  } catch (err) {
    console.warn('[InviteService] Clipboard check error:', err);
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
      // (was `cleanMy`, a variable that does not exist: opening an invite from someone who had already
      // sent you a request crashed here)
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

    // 2. Lookup remote user in Supabase
    const remoteUser = await findUserByHandle(cleanTarget);
    if (!remoteUser) {
      return Alert.alert(
        'User Not Found',
        `No SecureBox account found with handle @${cleanTarget}.`
      );
    }

    const partnerName = remoteUser.nickname || cleanTarget;

    // 3. Instant Connect: Directly create contact & open chat!
    try {
      await sendConnectionRequest({
        fromHandle: myHandle,
        toHandle: cleanTarget,
        fromNickname: myNickname || myHandle,
        fromAvatar: myAvatarId,
      });
    } catch (_) {}

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
      lastMsg: 'Connected via invite link 💕',
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
    console.warn('handleIncomingInvite error:', err);
    Alert.alert('Error', 'Could not process invite link.');
  }
};
