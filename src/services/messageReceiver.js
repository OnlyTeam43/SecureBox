// src/services/messageReceiver.js
// Centralized local-first incoming message receiver
// ZERO CLOUD STORAGE: Messages are saved strictly in the device's local SQLite database!

import * as Crypto from 'expo-crypto';
import {
  insertContact,
  insertMessage,
  incrementConversationUnread,
  updateConversationLastMessage,
  markConversationRead,
} from '../db/database';
import { findUserByHandle, markMessagesDeliveredInSupabase } from './supabase';
import { saveIncomingBase64ToVault } from './mediaVault';
import { getActiveConversation } from './notificationService';
import { useBadgeStore } from '../store/useBadgeStore';

/**
 * Process and persist an incoming chat message into the local SQLite database.
 * Updates conversation state and refreshes badge store without any in-app banner popup.
 */
export const processIncomingMessage = async (incoming, myHandle) => {
  if (!incoming || !myHandle) return;
  const cleanMy = myHandle.replace('@', '').trim().toLowerCase();
  const senderClean = (incoming.sender || '').replace('@', '').trim().toLowerCase();
  if (!senderClean || senderClean === cleanMy) return;

  const participants = [cleanMy, senderClean].sort();
  const convId = incoming.conversation_id || `chat_${participants[0]}_${participants[1]}`;

  try {
    const contactId = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      senderClean
    );

    let contactAvatar = 'avatar_rose';
    let contactNick = senderClean;
    try {
      const remoteUser = await findUserByHandle(senderClean);
      if (remoteUser?.avatar_id) contactAvatar = remoteUser.avatar_id;
      if (remoteUser?.nickname) contactNick = remoteUser.nickname;
    } catch (_) {}

    await insertContact({
      id: contactId,
      handle: senderClean,
      nickname: contactNick,
      avatarId: contactAvatar,
    });

    let localMedia = null;
    if (incoming.media_uri) {
      localMedia = await saveIncomingBase64ToVault(incoming.id, incoming.media_uri);
    }

    const isActiveChat = getActiveConversation() === convId;

    await insertMessage({
      id: incoming.id,
      conversationId: convId,
      sender: senderClean,
      receiver: cleanMy,
      type: incoming.media_uri ? 'image' : 'text',
      body: incoming.body || '',
      mediaUri: localMedia,
      sentAt: incoming.sent_at || incoming.created_at || Date.now(),
      expiresAt: incoming.expires_at || null,
      replyTo: incoming.reply_to || null,
      status: 'delivered',
      read: isActiveChat ? 1 : 0,
    });

    if (!isActiveChat) {
      await incrementConversationUnread(
        convId,
        incoming.body || (localMedia ? 'Photo 📷' : 'Message'),
        incoming.sent_at || Date.now(),
        senderClean
      );
    } else {
      await updateConversationLastMessage(
        convId,
        incoming.body || (localMedia ? 'Photo 📷' : 'Message'),
        incoming.sent_at || Date.now(),
        senderClean
      );
      await markConversationRead(convId, cleanMy);
    }

    markMessagesDeliveredInSupabase(convId, cleanMy, senderClean);

    // Refresh badges so game screen and tabs immediately reflect the unread message count
    await useBadgeStore.getState().refreshBadges(cleanMy);
  } catch (err) {
    console.warn('[messageReceiver] Error saving message to local SQLite:', err);
  }
};
