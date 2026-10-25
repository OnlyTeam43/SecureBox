// src/services/outbox.js
// Reliable sending: every message is saved on the phone FIRST (state "pending"), then uploaded.
// If the upload fails (no internet, Supabase down, app killed) it stays "pending" and is retried
// automatically with a growing delay, and after too many failures it shows "failed" with tap-to-retry.
//
// States of a message I sent:
//   pending -> clock icon      saved on this phone, not accepted by the server yet
//   sent    -> 1 grey tick     the server accepted it
//   (delivered / read are tracked by the receipts: 2 grey ticks / 2 blue ticks)
//   failed  -> red "!"         gave up after MAX_AUTO_ATTEMPTS, tap to try again

import {
  getMessageById,
  getPendingOutgoing,
  setSendState,
  bumpSendAttempts,
  resetSendAttempts,
  getConversationPartnerHandle,
} from '../db/database';
import { sendMessageToSupabase } from './supabase';
import { readVaultFileAsDataUri } from './mediaVault';

export const MAX_AUTO_ATTEMPTS = 8;
const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 60000;
const WORKER_INTERVAL_MS = 15000;

const nextAttemptAt = new Map(); // messageId -> earliest time of the next automatic retry
const inFlight = new Set();      // messageIds being uploaded right now
let flushing = false;
const changeListeners = new Set();

const backoffMs = (attempts) => Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.min(attempts, 5));

/** Screens subscribe to re-read their messages when a send state changes. */
export const subscribeOutboxChanges = (callback) => {
  changeListeners.add(callback);
  return () => changeListeners.delete(callback);
};
const notifyChanged = () => {
  changeListeners.forEach((cb) => {
    try {
      cb();
    } catch (_) {}
  });
};

/** Work out the other person's handle if the contact row is missing: chat_<a>_<b> minus my handle. */
const partnerFromConversationId = (conversationId, myHandle) => {
  if (!conversationId || !conversationId.startsWith('chat_')) return null;
  const rest = conversationId.slice('chat_'.length);
  const me = (myHandle || '').toLowerCase();
  if (me && rest.startsWith(`${me}_`)) return rest.slice(me.length + 1);
  if (me && rest.endsWith(`_${me}`)) return rest.slice(0, rest.length - me.length - 1);
  return null;
};

/**
 * Try to upload one pending message now. Safe to call repeatedly (a message is never uploaded
 * twice at the same time, and the server ignores a duplicate id).
 * mediaDataUri can be passed on the first attempt to avoid re-reading the photo from disk.
 * Returns true if the server accepted it.
 */
export const attemptSend = async (messageId, { mediaDataUri = null } = {}) => {
  if (!messageId || inFlight.has(messageId)) return false;
  inFlight.add(messageId);
  try {
    const row = await getMessageById(messageId);
    if (!row || row.send_state !== 'pending') return false; // gone, already sent, or already failed

    const receiver =
      (await getConversationPartnerHandle(row.conversation_id)) ||
      partnerFromConversationId(row.conversation_id, row.sender);
    if (!receiver) {
      console.warn('[outbox] No recipient for message', messageId);
      await setSendState(messageId, 'failed');
      notifyChanged();
      return false;
    }

    let mediaUri = mediaDataUri;
    if (!mediaUri && row.media_uri) {
      mediaUri = await readVaultFileAsDataUri(row.media_uri);
      if (!mediaUri) {
        // The photo file is gone from the vault: retrying can never work.
        console.warn('[outbox] Photo file missing for message', messageId);
        await setSendState(messageId, 'failed');
        notifyChanged();
        return false;
      }
    }

    const result = await sendMessageToSupabase({
      id: row.id,
      conversationId: row.conversation_id,
      sender: row.sender,
      receiver,
      body: row.body,
      mediaUri,
      sentAt: row.sent_at,
      expiresAt: row.expires_at,
      replyTo: row.reply_to,
      retry: (row.send_attempts || 0) > 0,
    });

    if (result && result.relayed) {
      nextAttemptAt.delete(messageId);
      // A receipt may have arrived meanwhile and already moved it on: only touch it if still pending.
      const fresh = await getMessageById(messageId);
      if (fresh && fresh.send_state === 'pending') await setSendState(messageId, 'sent');
      notifyChanged();
      return true;
    }

    const attempts = await bumpSendAttempts(messageId);
    if (attempts >= MAX_AUTO_ATTEMPTS) {
      await setSendState(messageId, 'failed');
      nextAttemptAt.delete(messageId);
    } else {
      nextAttemptAt.set(messageId, Date.now() + backoffMs(attempts));
    }
    notifyChanged();
    return false;
  } catch (err) {
    console.warn('[outbox] attemptSend error:', err?.message || err);
    try {
      const attempts = await bumpSendAttempts(messageId);
      if (attempts >= MAX_AUTO_ATTEMPTS) await setSendState(messageId, 'failed');
      else nextAttemptAt.set(messageId, Date.now() + backoffMs(attempts));
      notifyChanged();
    } catch (_) {}
    return false;
  } finally {
    inFlight.delete(messageId);
  }
};

/** Retry everything that is waiting and due, oldest first (keeps the sending order). */
export const flushOutbox = async () => {
  if (flushing) return;
  flushing = true;
  try {
    const rows = await getPendingOutgoing(20);
    for (const row of rows) {
      if (Date.now() < (nextAttemptAt.get(row.id) || 0)) continue;
      await attemptSend(row.id);
    }
  } catch (err) {
    console.warn('[outbox] flush error:', err?.message || err);
  } finally {
    flushing = false;
  }
};

/** Tap on a failed message. */
export const retryFailedMessage = async (messageId) => {
  await resetSendAttempts(messageId);
  await setSendState(messageId, 'pending');
  nextAttemptAt.delete(messageId);
  notifyChanged();
  return attemptSend(messageId);
};

/** Start the background retry loop. Call once when the user is logged in; returns a stop function. */
export const startOutboxWorker = () => {
  flushOutbox();
  const timer = setInterval(flushOutbox, WORKER_INTERVAL_MS);
  return () => clearInterval(timer);
};
