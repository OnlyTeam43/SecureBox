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
  upsertConversation,
  markSentMessagesDelivered,
  markSentMessagesRead,
  deleteMessagesBatch,
  messageExists,
  isMessageTombstoned,
} from '../db/database';
import { tryClaimIncoming, releaseIncoming } from './incomingGuard';
import {
  supabase,
  findUserByHandle,
  markMessagesDeliveredInSupabase,
  markMessagesSeenInSupabase,
} from './supabase';
import { saveIncomingBase64ToVault } from './mediaVault';
import { getActiveConversation, onIncomingStored } from './notificationService';
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

  // 1. Process delivery ACK packets — NEVER save as chat message!
  if (incoming.type === 'ack_delivered' || incoming.id?.startsWith('ack_deliv_')) {
    try {
      const payload = typeof incoming.body === 'string' ? JSON.parse(incoming.body) : incoming.body;
      const targetConvId = payload?.conversationId || incoming.conversation_id;
      if (targetConvId) {
        await markSentMessagesDelivered(targetConvId, cleanMy, payload?.messageIds);
      }
      if (incoming.id) {
        await supabase.from('messages').delete().eq('id', incoming.id);
      }
    } catch (_) {}
    return;
  }

  // 2. Process read ACK packets — NEVER save as chat message!
  if (incoming.type === 'ack_seen' || incoming.id?.startsWith('ack_seen_')) {
    try {
      const payload = typeof incoming.body === 'string' ? JSON.parse(incoming.body) : incoming.body;
      const targetConvId = payload?.conversationId || incoming.conversation_id;
      if (targetConvId) {
        await markSentMessagesRead(targetConvId, cleanMy, payload?.messageIds);
      }
      if (incoming.id) {
        await supabase.from('messages').delete().eq('id', incoming.id);
      }
    } catch (_) {}
    return;
  }

  // 3. Process remote message deletion command — NEVER save as chat message!
  if (incoming.type === 'delete_cmd' || incoming.id?.startsWith('del_cmd_')) {
    try {
      const payload = typeof incoming.body === 'string' ? JSON.parse(incoming.body) : incoming.body;
      if (payload?.messageIds && payload.messageIds.length > 0) {
        await deleteMessagesBatch(payload.messageIds);
      }
      if (incoming.id) {
        await supabase.from('messages').delete().eq('id', incoming.id);
      }
    } catch (_) {}
    return;
  }

  // 4. NEVER process system control / connection records as chat messages!
  if (
    incoming.type === 'connection' ||
    incoming.type === 'contact_req' ||
    incoming.type === 'contact_accepted' ||
    incoming.type === 'call_req' ||
    incoming.id?.startsWith('ack_') ||
    incoming.id?.startsWith('del_cmd_') ||
    incoming.id?.startsWith('conn_') ||
    incoming.id?.startsWith('req_') ||
    (incoming.body && (
      incoming.body.startsWith('{"conversationId"') ||
      incoming.body.includes('"conversationId"') ||
      incoming.body.startsWith('{"status"') ||
      incoming.body.includes('"status":"connected"')
    ))
  ) {
    if (incoming.id) {
      try {
        await supabase.from('messages').delete().eq('id', incoming.id);
      } catch (_) {}
    }
    return;
  }

  const participants = [cleanMy, senderClean].sort();
  const convId = incoming.conversation_id || `chat_${participants[0]}_${participants[1]}`;

  // DUPLICATE GUARD: the same message arrives through several paths (user broadcast,
  // Postgres Changes, pending fetch). Only the first one to claim the id may process it,
  // otherwise unread counts double and read messages get reset to unread.
  if (!tryClaimIncoming(incoming.id)) return;
  let stored = false;

  try {
    // Already saved earlier (e.g. by the pending fetch)? Just make sure the relay row is gone.
    if (await messageExists(incoming.id)) {
      stored = true;
      try {
        await supabase.from('messages').delete().eq('id', incoming.id);
      } catch (_) {}
      return false;
    }

    // "Delete for everyone" can arrive BEFORE the message itself (this phone was offline).
    // The message must then never appear.
    if (await isMessageTombstoned(incoming.id)) {
      stored = true; // keep the claim: nothing more to do for this id
      try {
        await supabase.from('messages').delete().eq('id', incoming.id);
      } catch (_) {}
      return false;
    }

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

      // Could not get the photo (network hiccup). Do NOT save a blank photo message and do NOT
      // delete the relay row: leave it so the next pending fetch can retry.
      if (!mediaDataUri) {
        console.warn('[messageReceiver] Media not available yet, will retry later:', incoming.id);
        return false;
      }
    }

    // 2. Ensure contact exists in SQLite
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
    stored = true;

    // ZERO-STORAGE: only now that the message is safely saved on this phone, destroy the
    // relay row (deleting earlier meant a crash or a failed save lost the message forever).
    try {
      await supabase.from('messages').delete().eq('id', incoming.id);
    } catch (_) {}

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
    markMessagesDeliveredInSupabase(convId, cleanMy, senderClean, [incoming.id]);
    if (isActiveChat) {
      markMessagesSeenInSupabase(convId, cleanMy, senderClean, [incoming.id]);
    }

    // 7. Refresh unread badges for game screen & tabs
    await useBadgeStore.getState().refreshBadges(cleanMy);
    if (!isActiveChat) onIncomingStored(convId);
    return true; // a NEW message was stored (screens use this to refresh)
  } catch (err) {
    console.warn('[messageReceiver] Error saving message to local SQLite:', err);
    return false;
  } finally {
    // If the message was not saved, give the id back so another path (or the next pending
    // fetch) can try again instead of the message being dropped for good.
    if (!stored) releaseIncoming(incoming.id);
  }
};

/**
 * Process and persist an incoming connection request directly into the local SQLite Messages chat window.
 * Contact is saved, conversation is created/updated, initial request message is inserted, and Supabase relay row is removed.
 * No separate requests screen or manual acceptance needed!
 */
export const processIncomingConnectionRequest = async (requestData, myHandle) => {
  if (!requestData || !myHandle) return;
  const cleanMy = myHandle.replace('@', '').trim().toLowerCase();
  const fromHandle = (requestData.fromHandle || requestData.sender || '').replace('@', '').trim().toLowerCase();
  if (!fromHandle || fromHandle === cleanMy) return;

  const participants = [cleanMy, fromHandle].sort();
  const convId = `chat_${participants[0]}_${participants[1]}`;

  try {
    // 1. Ensure contact exists in SQLite
    const contactId = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      fromHandle
    );

    let contactAvatar = requestData.fromAvatar || 'avatar_rose';
    let contactNick = requestData.fromNickname || fromHandle;
    try {
      const remoteUser = await findUserByHandle(fromHandle);
      if (remoteUser?.avatar_id) contactAvatar = remoteUser.avatar_id;
      if (remoteUser?.nickname) contactNick = remoteUser.nickname;
    } catch (_) {}

    await insertContact({
      id: contactId,
      handle: fromHandle,
      nickname: contactNick,
      avatarId: contactAvatar,
    });

    const isActiveChat = getActiveConversation() === convId;

    // 2. Upsert conversation in Messages list so it appears directly in Inbox
    await upsertConversation({
      id: convId,
      contactId,
      lastMsg: 'Connected! Say hi 💕',
      lastTime: Date.now(),
      unread: isActiveChat ? 0 : 1,
    });

    // 3. ZERO CLOUD STORAGE: Delete the ephemeral request from Supabase relay
    if (requestData.reqId) {
      try {
        await supabase.from('messages').delete().eq('id', requestData.reqId);
      } catch (_) {}
    }

    // 4. Refresh unread badges for companion icon and Messages tab
    await useBadgeStore.getState().refreshBadges(cleanMy);
    if (!isActiveChat) onIncomingStored(convId);
  } catch (err) {
    console.warn('[processIncomingConnectionRequest] Error saving request to Messages:', err);
  }
};
