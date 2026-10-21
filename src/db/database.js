// src/db/database.js
// Local SQLite database — all data stays on device

import * as SQLite from 'expo-sqlite';
import { deleteVaultFile, deleteVaultFilesBatch } from '../services/mediaVault';

let db;

export const getDB = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('securebox.db');
    await initSchema();
  }
  return db;
};

const initSchema = async () => {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS contacts (
      id          TEXT PRIMARY KEY,
      handle      TEXT NOT NULL UNIQUE,
      nickname    TEXT NOT NULL,
      avatar_id   TEXT NOT NULL,
      added_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id          TEXT PRIMARY KEY,
      contact_id  TEXT NOT NULL,
      last_msg    TEXT,
      last_time   INTEGER,
      unread      INTEGER DEFAULT 0,
      expiry_secs INTEGER,
      FOREIGN KEY (contact_id) REFERENCES contacts(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id            TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender        TEXT NOT NULL,
      type          TEXT NOT NULL DEFAULT 'text',
      body          TEXT,
      media_uri     TEXT,
      sent_at       INTEGER NOT NULL,
      delivered     INTEGER DEFAULT 0,
      read          INTEGER DEFAULT 0,
      expires_at    INTEGER,
      deleted       INTEGER DEFAULT 0,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conv
      ON messages(conversation_id, sent_at DESC);

    CREATE TABLE IF NOT EXISTS call_logs (
      id              TEXT PRIMARY KEY,
      contact_handle  TEXT NOT NULL,
      contact_nickname TEXT,
      contact_avatar_id TEXT,
      call_type       TEXT NOT NULL,
      direction       TEXT NOT NULL,
      timestamp       INTEGER NOT NULL,
      duration        INTEGER DEFAULT 0,
      seen            INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_call_logs_time
      ON call_logs(timestamp DESC);
  `);

  try {
    await db.execAsync(`ALTER TABLE messages ADD COLUMN reply_to TEXT;`);
  } catch (_) {
    // Column already exists
  }

  try {
    await db.execAsync(`ALTER TABLE conversations ADD COLUMN last_sender TEXT;`);
  } catch (_) {
    // Column already exists
  }

  try {
    await db.execAsync(`ALTER TABLE conversations ADD COLUMN last_status TEXT;`);
  } catch (_) {
    // Column already exists
  }
};

// ─── Contacts ────────────────────────────────────────────────────────────────

export const insertContact = async (contact) => {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO contacts (id, handle, nickname, avatar_id, added_at)
     VALUES (?, ?, ?, ?, ?)`,
    [contact.id, contact.handle, contact.nickname, contact.avatarId, Date.now()]
  );
};

export const updateContactAvatar = async (handle, avatarId) => {
  const db = await getDB();
  const cleanHandle = handle.replace('@', '').trim().toLowerCase();
  await db.runAsync(
    `UPDATE contacts SET avatar_id = ? WHERE LOWER(handle) = ?`,
    [avatarId, cleanHandle]
  );
};

export const getAllContacts = async () => {
  const db = await getDB();
  return await db.getAllAsync(`SELECT * FROM contacts ORDER BY nickname ASC`);
};

export const getContactByHandle = async (handle) => {
  const db = await getDB();
  const cleanHandle = handle.replace('@', '').trim().toLowerCase();
  return await db.getFirstAsync(
    `SELECT * FROM contacts WHERE LOWER(handle) = ?`,
    [cleanHandle]
  );
};

// ─── Conversations ────────────────────────────────────────────────────────────

export const upsertConversation = async (conv) => {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO conversations (id, contact_id, last_msg, last_time, unread, expiry_secs, last_sender, last_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      conv.id,
      conv.contactId,
      conv.lastMsg,
      conv.lastTime,
      conv.unread || 0,
      conv.expirySecs || null,
      conv.lastSender || null,
      conv.lastStatus || null,
    ]
  );
};

export const updateConversationLastMessage = async (conversationId, text, time, sender = null, status = 'sent') => {
  const db = await getDB();
  await db.runAsync(
    `UPDATE conversations SET last_msg = ?, last_time = ?, last_sender = ?, last_status = ? WHERE id = ?`,
    [text, time, sender, status, conversationId]
  );
};

export const incrementConversationUnread = async (conversationId, text, time, sender = null) => {
  const db = await getDB();
  await db.runAsync(
    `UPDATE conversations SET last_msg = ?, last_time = ?, last_sender = ?, unread = COALESCE(unread, 0) + 1 WHERE id = ?`,
    [text, time, sender, conversationId]
  );
};

export const getAllConversations = async () => {
  const db = await getDB();
  return await db.getAllAsync(`
    SELECT c.*, ct.handle, ct.nickname, ct.avatar_id,
      (SELECT m.sender FROM messages m WHERE m.conversation_id = c.id AND m.deleted = 0 ORDER BY m.sent_at DESC LIMIT 1) as latest_sender,
      (SELECT m.read FROM messages m WHERE m.conversation_id = c.id AND m.deleted = 0 ORDER BY m.sent_at DESC LIMIT 1) as latest_read,
      (SELECT m.delivered FROM messages m WHERE m.conversation_id = c.id AND m.deleted = 0 ORDER BY m.sent_at DESC LIMIT 1) as latest_delivered
    FROM conversations c
    JOIN contacts ct ON ct.id = c.contact_id
    ORDER BY c.last_time DESC
  `);
};

export const markConversationRead = async (conversationId, myHandle = null) => {
  const db = await getDB();
  await db.runAsync(
    `UPDATE conversations SET unread = 0 WHERE id = ?`,
    [conversationId]
  );
  if (myHandle) {
    await db.runAsync(
      `UPDATE messages SET read = 1 WHERE conversation_id = ? AND LOWER(sender) != LOWER(?)`,
      [conversationId, myHandle]
    );
  } else {
    await db.runAsync(
      `UPDATE messages SET read = 1 WHERE conversation_id = ?`,
      [conversationId]
    );
  }
};

export const markSentMessagesRead = async (conversationId, myHandle) => {
  const db = await getDB();
  if (myHandle) {
    await db.runAsync(
      `UPDATE messages SET read = 1, delivered = 1 WHERE conversation_id = ? AND LOWER(sender) = LOWER(?)`,
      [conversationId, myHandle]
    );
    await db.runAsync(
      `UPDATE conversations SET last_status = 'seen' WHERE id = ? AND LOWER(last_sender) = LOWER(?)`,
      [conversationId, myHandle]
    );
  }
};

export const markSentMessagesDelivered = async (conversationId, myHandle) => {
  const db = await getDB();
  if (myHandle) {
    await db.runAsync(
      `UPDATE messages SET delivered = 1 WHERE conversation_id = ? AND LOWER(sender) = LOWER(?) AND read = 0`,
      [conversationId, myHandle]
    );
    await db.runAsync(
      `UPDATE conversations SET last_status = 'delivered' WHERE id = ? AND LOWER(last_sender) = LOWER(?) AND last_status != 'seen'`,
      [conversationId, myHandle]
    );
  }
};

export const deleteConversationsBatch = async (conversationIds) => {
  if (!conversationIds || conversationIds.length === 0) return;
  const db = await getDB();
  const placeholders = conversationIds.map(() => '?').join(',');

  // 1. Delete associated media files from vault
  try {
    const mediaRows = await db.getAllAsync(
      `SELECT media_uri FROM messages WHERE conversation_id IN (${placeholders}) AND media_uri IS NOT NULL`,
      conversationIds
    );
    if (mediaRows && mediaRows.length > 0) {
      await deleteVaultFilesBatch(mediaRows.map((r) => r.media_uri).filter(Boolean));
    }
  } catch (e) {
    console.warn('Vault cleanup error on conv delete:', e);
  }

  // 2. Delete messages
  await db.runAsync(
    `DELETE FROM messages WHERE conversation_id IN (${placeholders})`,
    conversationIds
  );

  // 3. Delete contacts
  await db.runAsync(
    `DELETE FROM contacts WHERE id IN (SELECT contact_id FROM conversations WHERE id IN (${placeholders}))`,
    conversationIds
  );

  // 4. Delete conversations
  await db.runAsync(
    `DELETE FROM conversations WHERE id IN (${placeholders})`,
    conversationIds
  );
};

// ─── Messages ─────────────────────────────────────────────────────────────────

export const insertMessage = async (msg) => {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO messages (id, conversation_id, sender, type, body, media_uri, sent_at, delivered, read, expires_at, reply_to, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      msg.id,
      msg.conversationId,
      msg.sender,
      msg.type || 'text',
      msg.body || null,
      msg.mediaUri || null,
      msg.sentAt || Date.now(),
      msg.delivered ? 1 : 0,
      msg.read ? 1 : 0,
      msg.expiresAt || null,
      msg.replyTo || null,
    ]
  );
};

export const getMessages = async (conversationId, limit = 50, before = null) => {
  const db = await getDB();
  if (before) {
    return await db.getAllAsync(
      `SELECT * FROM messages WHERE conversation_id = ? AND deleted = 0 AND (body IS NOT NULL OR media_uri IS NOT NULL) AND sent_at < ?
       ORDER BY sent_at DESC LIMIT ?`,
      [conversationId, before, limit]
    );
  }
  return await db.getAllAsync(
    `SELECT * FROM messages WHERE conversation_id = ? AND deleted = 0 AND (body IS NOT NULL OR media_uri IS NOT NULL)
     ORDER BY sent_at DESC LIMIT ?`,
    [conversationId, limit]
  );
};

export const deleteMessage = async (messageId) => {
  const db = await getDB();
  try {
    const row = await db.getFirstAsync(`SELECT media_uri FROM messages WHERE id = ?`, [messageId]);
    if (row?.media_uri) {
      await deleteVaultFile(row.media_uri);
    }
  } catch (_) {}
  await db.runAsync(`DELETE FROM messages WHERE id = ?`, [messageId]);
};

export const deleteMessagesBatch = async (messageIds) => {
  if (!messageIds || messageIds.length === 0) return;
  const db = await getDB();
  const placeholders = messageIds.map(() => '?').join(',');

  try {
    const mediaRows = await db.getAllAsync(
      `SELECT media_uri FROM messages WHERE id IN (${placeholders}) AND media_uri IS NOT NULL`,
      messageIds
    );
    if (mediaRows && mediaRows.length > 0) {
      await deleteVaultFilesBatch(mediaRows.map((r) => r.media_uri).filter(Boolean));
    }
  } catch (e) {
    console.warn('Vault cleanup error on batch delete:', e);
  }

  await db.runAsync(
    `DELETE FROM messages WHERE id IN (${placeholders})`,
    messageIds
  );
};

export const getAllMediaPhotos = async (conversationId = null) => {
  const db = await getDB();
  if (conversationId) {
    return await db.getAllAsync(
      `SELECT * FROM messages WHERE conversation_id = ? AND media_uri IS NOT NULL AND deleted = 0 ORDER BY sent_at DESC`,
      [conversationId]
    );
  }
  return await db.getAllAsync(
    `SELECT * FROM messages WHERE media_uri IS NOT NULL AND deleted = 0 ORDER BY sent_at DESC`
  );
};

export const purgeExpiredMessages = async () => {
  const db = await getDB();
  const now = Date.now();
  try {
    const expiredMedia = await db.getAllAsync(
      `SELECT media_uri FROM messages WHERE expires_at IS NOT NULL AND expires_at < ? AND media_uri IS NOT NULL`,
      [now]
    );
    if (expiredMedia && expiredMedia.length > 0) {
      await deleteVaultFilesBatch(expiredMedia.map((r) => r.media_uri).filter(Boolean));
    }
  } catch (e) {
    console.warn('Vault cleanup error on purge:', e);
  }

  await db.runAsync(
    `DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at < ?`,
    [now]
  );
};

export const clearConversationMessages = async (conversationId) => {
  const db = await getDB();
  try {
    const mediaRows = await db.getAllAsync(
      `SELECT media_uri FROM messages WHERE conversation_id = ? AND media_uri IS NOT NULL`,
      [conversationId]
    );
    if (mediaRows && mediaRows.length > 0) {
      await deleteVaultFilesBatch(mediaRows.map((r) => r.media_uri).filter(Boolean));
    }
  } catch (e) {
    console.warn('Vault cleanup error on clear conv:', e);
  }

  await db.runAsync(
    `DELETE FROM messages WHERE conversation_id = ?`,
    [conversationId]
  );
  await db.runAsync(
    `UPDATE conversations SET last_msg = '', last_time = ? WHERE id = ?`,
    [Date.now(), conversationId]
  );
};

// ─── Call Logs ───────────────────────────────────────────────────────────────

export const insertCallLog = async (log) => {
  const db = await getDB();
  const id = log.id || `call_log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await db.runAsync(
    `INSERT OR REPLACE INTO call_logs (id, contact_handle, contact_nickname, contact_avatar_id, call_type, direction, timestamp, duration, seen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      log.contactHandle,
      log.contactNickname || log.contactHandle,
      log.contactAvatarId || 'avatar_rose',
      log.callType || 'voice',
      log.direction || 'outgoing',
      log.timestamp || Date.now(),
      log.duration || 0,
      log.seen || 0,
    ]
  );
  return id;
};

export const updateCallLogDuration = async (id, duration) => {
  const db = await getDB();
  await db.runAsync(`UPDATE call_logs SET duration = ? WHERE id = ?`, [duration, id]);
};

export const updateCallLogDirection = async (id, direction, seen = 0) => {
  const db = await getDB();
  await db.runAsync(`UPDATE call_logs SET direction = ?, seen = ? WHERE id = ?`, [direction, seen, id]);
};

export const getCallLogs = async () => {
  const db = await getDB();
  return await db.getAllAsync(`SELECT * FROM call_logs ORDER BY timestamp DESC`);
};

export const getUnseenMissedCallsCount = async () => {
  const db = await getDB();
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM call_logs WHERE direction = 'missed' AND seen = 0`
  );
  return row?.count || 0;
};

export const markCallLogsAsSeen = async () => {
  const db = await getDB();
  await db.runAsync(`UPDATE call_logs SET seen = 1 WHERE seen = 0`);
};

export const deleteCallLog = async (id) => {
  const db = await getDB();
  await db.runAsync(`DELETE FROM call_logs WHERE id = ?`, [id]);
};

export const clearAllCallLogs = async () => {
  const db = await getDB();
  await db.runAsync(`DELETE FROM call_logs`);
};

export const getTotalUnreadMessagesCount = async () => {
  const db = await getDB();
  const row = await db.getFirstAsync(
    `SELECT SUM(unread) as total FROM conversations`
  );
  return row?.total || 0;
};

