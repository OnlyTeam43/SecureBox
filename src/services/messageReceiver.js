// src/services/messageReceiver.js
// Centralized local-first incoming message receiver
// ZERO CLOUD STORAGE: Messages are saved strictly in the device's local SQLite database!
// Any ephemeral message in Supabase is immediately and permanently deleted upon receipt!

import * as Crypto from 'expo-crypto';
import {
  insertContact,
  insertMessage,
  incrementConversationUnread,
  updateConversationLastMessage,
  markConversationRead,
} from '../db/database';
import {
  supabase,
  findUserByHandle,
  markMessagesDeliveredInSupabase,
  markMessagesSeenInSupabase,
} from './supabase';
import { saveIncomingBase64ToVault } from './mediaVault';
import { getActiveConversation } from './notificationService';
import { useBadgeStore } from '../store/useBadgeStore';

/**
 * Process and persist an incoming chat message into the local SQLite database.
 * Updates conversation state and refreshes badge store without any in-app banner popup.
 * Immediately deletes the ephemeral relay row from Supabase (ZERO CLOUD STORAGE).
 */
export const processIncomingMessage = async (incoming, myHandle) => {
  if (!incoming || !myHandle) return;
  const cleanMy = myHandle.replace('@', '').trim().toLowerCase();
  const senderClean = (incoming.sender || '').replace('@', '').trim().toLowerCase();
  if (!senderClean || senderClean === cleanMy) return;

  const participants = [cleanMy, senderClean].sort();
  const convId = incoming.conversation_id || `chat_${participants[0]}_${participants[1]}`;

  try {
    let mediaDataUri = incoming.media_uri;
    let fullBody = incoming.body;

    // 1. If incoming was lightweight broadcast with has_media: true, fetch full payload from Supabase
    if (incoming.has_media && !mediaDataUri) {
      try {
        const { data: fullMsg } = await supabase
          .from('messages')
          .select('body, media_uri')
          .eq('id', incoming.id)
          .maybeSingle();
        if (fullMsg) {
          mediaDataUri = fullMsg.media_uri;
          fullBody = fullMsg.body || fullBody;
        }
      } catch (fErr) {
        console.warn('Fetch full media payload notice:', fErr?.message);
      }
    }

    // 2. ZERO-STORAGE: Immediately delete this message row from Supabase!
    // The server relay row is destroyed.
    try {
      await supabase.from('messages').delete().eq('id', incoming.id);
    } catch (_) {}

    // 3. Ensure contact exists in SQLite
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

    // 4. Save GIANT FULL SIZE media directly into hidden local vault (.secure_media/)
    let localMedia = null;
    if (mediaDataUri) {
      localMedia = await saveIncomingBase64ToVault(incoming.id, mediaDataUri);
    }

    const isActiveChat = getActiveConversation() === convId;

    // 5. Persist to local SQLite
    await insertMessage({
      id: incoming.id,
      conversationId: convId,
      sender: senderClean,
      receiver: cleanMy,
      type: (mediaDataUri || incoming.has_media) ? 'image' : 'text',
      body: fullBody || '',
      mediaUri: localMedia,
      sentAt: incoming.sent_at || incoming.created_at || Date.now(),
      expiresAt: incoming.expires_at || null,
      replyTo: incoming.reply_to || null,
      delivered: 1,
      read: isActiveChat ? 1 : 0,
    });

    if (!isActiveChat) {
      await incrementConversationUnread(
        convId,
        fullBody || (localMedia ? 'Photo 📷' : 'Message'),
        incoming.sent_at || Date.now(),
        senderClean
      );
    } else {
      await updateConversationLastMessage(
        convId,
        fullBody || (localMedia ? 'Photo 📷' : 'Message'),
        incoming.sent_at || Date.now(),
        senderClean
      );
      await markConversationRead(convId, cleanMy);
    }

    // 6. Send delivery ACK back to sender
    markMessagesDeliveredInSupabase(convId, cleanMy, senderClean);
    if (isActiveChat) {
      markMessagesSeenInSupabase(convId, cleanMy, senderClean);
    }

    // 7. Refresh unread badges for game screen & tabs
    await useBadgeStore.getState().refreshBadges(cleanMy);
  } catch (err) {
    console.warn('[messageReceiver] Error saving message to local SQLite:', err);
  }
};
