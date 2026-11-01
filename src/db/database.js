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

    CREATE TABLE IF NOT EXISTS vault_items (
      id              TEXT PRIMARY KEY,
      file_name       TEXT,
      file_uri        TEXT NOT NULL,
      file_size       INTEGER DEFAULT 0,
      media_type      TEXT DEFAULT 'photo',
      created_at      INTEGER NOT NULL,
      source          TEXT DEFAULT 'imported',
      note            TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_vault_items_created
      ON vault_items(created_at DESC);

    CREATE TABLE IF NOT EXISTS crash_reports (
      id              TEXT PRIMARY KEY,
      error_message   TEXT NOT NULL,
      stack_trace     TEXT,
      component_stack TEXT,
      created_at      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_feedback (
      id              TEXT PRIMARY KEY,
      category        TEXT NOT NULL,
      content         TEXT NOT NULL,
      device_info     TEXT,
      created_at      INTEGER NOT NULL
    );
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

  // --- Message state, ordering and tombstones (batch 2) ---------------------------------------
  // send_state : 'pending' | 'sent' | 'failed' for messages I sent (NULL = old message, treated as sent)
  // send_attempts : how many times the outbox tried to upload it
  // sort_key : the order messages are shown in (see computeSortKey)
  for (const sql of [
    `ALTER TABLE messages ADD COLUMN send_state TEXT;`,
    `ALTER TABLE messages ADD COLUMN send_attempts INTEGER DEFAULT 0;`,
    `ALTER TABLE messages ADD COLUMN sort_key REAL;`,
  ]) {
    try {
      await db.execAsync(sql);
    } catch (_) {
      // Column already exists
    }
  }
  try {
    await db.execAsync(`
      UPDATE messages SET sort_key = sent_at WHERE sort_key IS NULL;
      CREATE INDEX IF NOT EXISTS idx_messages_conv_sort ON messages(conversation_id, sort_key DESC);

      -- ids of messages that were deleted. If a "delete for everyone" arrives BEFORE the message
      -- itself (offline phone), the message is dropped instead of appearing after it was deleted.
      CREATE TABLE IF NOT EXISTS deleted_messages (
        id          TEXT PRIMARY KEY,
        deleted_at  INTEGER NOT NULL
      );

      -- Answered / outgoing call entries are not "unread messages" (only missed calls are).
      UPDATE messages SET read = 1
        WHERE type = 'call' AND read = 0 AND body NOT LIKE '%"direction":"missed"%';
    `);
  } catch (_) {}

  // Automatic clean-up: Purge any raw connection/status/ACK JSON strings so they never render as messages
  try {
    await db.execAsync(`
      DELETE FROM messages WHERE
        type IN ('connection', 'contact_req', 'contact_accepted', 'call_req', 'ack_seen', 'ack_delivered', 'delete_cmd')
        OR id LIKE 'ack_%'
        OR id LIKE 'del_cmd_%'
        OR body LIKE '{"conversationId"%'
        OR body LIKE '%"conversationId"%'
        OR body LIKE '{"status"%'
        OR body LIKE '%"status":"connected"%';

      UPDATE conversations SET last_msg = '' WHERE
        last_msg LIKE '{"conversationId"%'
        OR last_msg LIKE '%"conversationId"%'
        OR last_msg LIKE '{"status"%'
        OR last_msg LIKE '%"status":"connected"%';
    `);
  } catch (_) {}
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
  if (
    text &&
    (text.startsWith('{"conversationId"') ||
      text.includes('"conversationId"') ||
      text.startsWith('{"status"') ||
      text.includes('"status":"connected"'))
  ) {
    return;
  }
  const db = await getDB();
  await db.runAsync(
    `UPDATE conversations SET last_msg = ?, last_time = ?, last_sender = ?, last_status = ? WHERE id = ?`,
    [text, time, sender, status, conversationId]
  );
};

export const incrementConversationUnread = async (conversationId, text, time, sender = null) => {
  if (
    text &&
    (text.startsWith('{"conversationId"') ||
      text.includes('"conversationId"') ||
      text.startsWith('{"status"') ||
      text.includes('"status":"connected"'))
  ) {
    return;
  }
  const db = await getDB();
  await db.runAsync(
    `UPDATE conversations SET last_msg = ?, last_time = ?, last_sender = ?, unread = COALESCE(unread, 0) + 1 WHERE id = ?`,
    [text, time, sender, conversationId]
  );
};

export const getAllConversations = async (currentHandle = null) => {
  const db = await getDB();
  const notMsgSql = `AND m.type NOT IN ('connection', 'contact_req', 'contact_accepted', 'call_req', 'ack_seen', 'ack_delivered', 'delete_cmd')
    AND m.id NOT LIKE 'ack_%' AND m.id NOT LIKE 'del_cmd_%'
    AND (m.body IS NULL OR (m.body NOT LIKE '{"conversationId"%' AND m.body NOT LIKE '{"status"%'))`;

  const rows = await db.getAllAsync(`
    SELECT c.*, ct.handle, ct.nickname, ct.avatar_id,
      (SELECT m.sender FROM messages m WHERE m.conversation_id = c.id AND m.deleted = 0 ${notMsgSql} ORDER BY COALESCE(m.sort_key, m.sent_at) DESC LIMIT 1) as latest_sender,
      (SELECT m.read FROM messages m WHERE m.conversation_id = c.id AND m.deleted = 0 ${notMsgSql} ORDER BY COALESCE(m.sort_key, m.sent_at) DESC LIMIT 1) as latest_read,
      (SELECT m.delivered FROM messages m WHERE m.conversation_id = c.id AND m.deleted = 0 ${notMsgSql} ORDER BY COALESCE(m.sort_key, m.sent_at) DESC LIMIT 1) as latest_delivered,
      (SELECT m.send_state FROM messages m WHERE m.conversation_id = c.id AND m.deleted = 0 ${notMsgSql} ORDER BY COALESCE(m.sort_key, m.sent_at) DESC LIMIT 1) as latest_send_state,
      -- UNREAD IS COUNTED, NEVER STORED: incoming messages (sent by the contact) not yet read.
      -- The old stored counter drifted whenever a message was processed twice or a screen forgot to reset it.
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.deleted = 0 AND m.read = 0
         AND ct.handle IS NOT NULL AND LOWER(m.sender) = LOWER(ct.handle) ${notMsgSql}) as unread_count
    FROM conversations c
    LEFT JOIN contacts ct ON ct.id = c.contact_id
    ORDER BY c.last_time DESC
  `);

  // Auto-heal any conversations where contact join was null so chat is NEVER lost or disappeared
  for (const r of rows) {
    r.unread = Number(r.unread_count) || 0;
    if (!r.handle && r.id && r.id.startsWith('chat_')) {
      const parts = r.id.replace('chat_', '').split('_');
      let partner = parts[0];
      if (currentHandle && parts[0]?.toLowerCase() === currentHandle?.toLowerCase()) {
        partner = parts[1] || parts[0];
      } else if (parts.length > 1) {
        partner = parts[1];
      }
      r.handle = partner;
      r.nickname = partner;
      r.avatar_id = 'avatar_rose';

      try {
        const contactId = `contact_${partner}`;
        db.runAsync(
          `INSERT OR IGNORE INTO contacts (id, handle, nickname, avatar_id, added_at) VALUES (?, ?, ?, ?, ?)`,
          [contactId, partner, partner, 'avatar_rose', Date.now()]
        ).then(() => {
          db.runAsync(`UPDATE conversations SET contact_id = ? WHERE id = ?`, [contactId, r.id]).catch(() => {});
        }).catch(() => {});
      } catch (_) {}
    }
  }

  return rows;
};

export const getConversationById = async (conversationId) => {
  const db = await getDB();
  return await db.getFirstAsync(
    `SELECT c.*, ct.handle, ct.nickname, ct.avatar_id
     FROM conversations c
     LEFT JOIN contacts ct ON ct.id = c.contact_id
     WHERE c.id = ?`,
    [conversationId]
  );
};

export const isConversationOrContactConnected = async (myHandle, partnerHandle) => {
  if (!myHandle || !partnerHandle) return false;
  try {
    const db = await getDB();
    const cleanTarget = partnerHandle.replace('@', '').trim().toLowerCase();
    const cleanMy = myHandle.replace('@', '').trim().toLowerCase();

    // 1. Check contact in SQLite
    const contact = await db.getFirstAsync(
      `SELECT id FROM contacts WHERE LOWER(handle) = ?`,
      [cleanTarget]
    );
    if (contact) return true;

    // 2. Check conversation in SQLite
    const participants = [cleanMy, cleanTarget].sort();
    const convId = `chat_${participants[0]}_${participants[1]}`;
    const conv = await db.getFirstAsync(
      `SELECT id FROM conversations WHERE id = ?`,
      [convId]
    );
    if (conv) return true;

    // 3. Check if any message ever existed in SQLite
    const msg = await db.getFirstAsync(
      `SELECT id FROM messages WHERE conversation_id = ? LIMIT 1`,
      [convId]
    );
    if (msg) return true;

    return false;
  } catch (_) {
    return false;
  }
};

/**
 * Mark everything the CONTACT sent in this conversation as read.
 * Returns the ids that were newly marked, so a per-message "seen" receipt can be sent.
 * (Without a handle this used to set read = 1 on ALL messages including my own, which
 * turned my own outgoing ticks blue without the other person reading anything.)
 */
export const markConversationRead = async (conversationId, myHandle = null) => {
  const db = await getDB();
  await db.runAsync(
    `UPDATE conversations SET unread = 0 WHERE id = ?`,
    [conversationId]
  );

  let partnerHandle = null;
  if (!myHandle) {
    partnerHandle = await getConversationPartnerHandle(conversationId);
    if (!partnerHandle) return [];
  }

  const whereIncoming = myHandle
    ? `conversation_id = ? AND LOWER(sender) != LOWER(?) AND read = 0 AND deleted = 0`
    : `conversation_id = ? AND LOWER(sender) = LOWER(?) AND read = 0 AND deleted = 0`;
  const arg = myHandle || partnerHandle;

  const unreadRows = await db.getAllAsync(`SELECT id FROM messages WHERE ${whereIncoming}`, [conversationId, arg]);
  if (unreadRows.length > 0) {
    await db.runAsync(`UPDATE messages SET read = 1 WHERE ${whereIncoming}`, [conversationId, arg]);
  }
  return unreadRows.map((r) => r.id);
};

/** Handle of the other person in a conversation (from the contacts table). */
export const getConversationPartnerHandle = async (conversationId) => {
  const db = await getDB();
  const row = await db.getFirstAsync(
    `SELECT ct.handle AS handle FROM conversations c JOIN contacts ct ON ct.id = c.contact_id WHERE c.id = ?`,
    [conversationId]
  );
  return row?.handle || null;
};

const toIdList = (ids) => (Array.isArray(ids) ? ids.filter(Boolean) : []);

/**
 * Re-derive the status shown on the conversation row from the real latest message,
 * so it can never get stuck on an old value.
 */
const refreshConversationLastStatus = async (db, conversationId) => {
  const last = await db.getFirstAsync(
    `SELECT delivered, read, send_state FROM messages
     WHERE conversation_id = ? AND deleted = 0
       AND type NOT IN ('connection', 'contact_req', 'contact_accepted', 'call_req', 'ack_seen', 'ack_delivered', 'delete_cmd')
     ORDER BY COALESCE(sort_key, sent_at) DESC LIMIT 1`,
    [conversationId]
  );
  if (!last) return;
  const status =
    last.send_state === 'failed' ? 'failed'
      : last.send_state === 'pending' ? 'pending'
      : last.read ? 'seen'
      : last.delivered ? 'delivered'
      : 'sent';
  await db.runAsync(`UPDATE conversations SET last_status = ? WHERE id = ?`, [status, conversationId]);
};

// A message that the other phone has acknowledged is by definition on the server: it is "sent".
const SENT_IF_ACKED = `send_state = CASE WHEN send_state IN ('pending', 'failed') THEN 'sent' ELSE send_state END`;

/**
 * The other person has READ these messages.
 * With messageIds only those exact messages change. Without ids (old app versions) every message I
 * sent that has already reached the server changes, but never ones still pending/failed.
 * Flags only ever move forward (0 -> 1), a late or repeated receipt cannot undo a tick.
 */
export const markSentMessagesRead = async (conversationId, myHandle, messageIds = null) => {
  if (!myHandle) return;
  const db = await getDB();
  const ids = toIdList(messageIds);
  if (ids.length > 0) {
    const ph = ids.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE messages SET read = 1, delivered = 1, ${SENT_IF_ACKED} WHERE id IN (${ph}) AND LOWER(sender) = LOWER(?)`,
      [...ids, myHandle]
    );
  } else {
    await db.runAsync(
      `UPDATE messages SET read = 1, delivered = 1, ${SENT_IF_ACKED}
       WHERE conversation_id = ? AND LOWER(sender) = LOWER(?) AND COALESCE(send_state, 'sent') = 'sent'`,
      [conversationId, myHandle]
    );
  }
  await refreshConversationLastStatus(db, conversationId);
};

/** The other phone has RECEIVED these messages (two grey ticks). Same rules as markSentMessagesRead. */
export const markSentMessagesDelivered = async (conversationId, myHandle, messageIds = null) => {
  if (!myHandle) return;
  const db = await getDB();
  const ids = toIdList(messageIds);
  if (ids.length > 0) {
    const ph = ids.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE messages SET delivered = 1, ${SENT_IF_ACKED} WHERE id IN (${ph}) AND LOWER(sender) = LOWER(?)`,
      [...ids, myHandle]
    );
  } else {
    await db.runAsync(
      `UPDATE messages SET delivered = 1, ${SENT_IF_ACKED}
       WHERE conversation_id = ? AND LOWER(sender) = LOWER(?) AND COALESCE(send_state, 'sent') = 'sent'`,
      [conversationId, myHandle]
    );
  }
  await refreshConversationLastStatus(db, conversationId);
};

// ─── Outbox (messages waiting to be uploaded) ────────────────────────────────

export const getMessageById = async (id) => {
  const db = await getDB();
  return await db.getFirstAsync(`SELECT * FROM messages WHERE id = ?`, [id]);
};

/** Messages I wrote that the server has not accepted yet, oldest first. */
export const getPendingOutgoing = async (limit = 20) => {
  const db = await getDB();
  return await db.getAllAsync(
    `SELECT * FROM messages WHERE send_state = 'pending' AND deleted = 0
     ORDER BY COALESCE(sort_key, sent_at) ASC LIMIT ?`,
    [limit]
  );
};

export const setSendState = async (id, state) => {
  const db = await getDB();
  await db.runAsync(`UPDATE messages SET send_state = ? WHERE id = ?`, [state, id]);
  const row = await db.getFirstAsync(`SELECT conversation_id FROM messages WHERE id = ?`, [id]);
  if (row?.conversation_id) await refreshConversationLastStatus(db, row.conversation_id);
};

/** Returns the new attempt count. */
export const bumpSendAttempts = async (id) => {
  const db = await getDB();
  await db.runAsync(`UPDATE messages SET send_attempts = COALESCE(send_attempts, 0) + 1 WHERE id = ?`, [id]);
  const row = await db.getFirstAsync(`SELECT send_attempts FROM messages WHERE id = ?`, [id]);
  return Number(row?.send_attempts) || 0;
};

export const resetSendAttempts = async (id) => {
  const db = await getDB();
  await db.runAsync(`UPDATE messages SET send_attempts = 0 WHERE id = ?`, [id]);
};

// ─── Tombstones ──────────────────────────────────────────────────────────────

export const isMessageTombstoned = async (id) => {
  if (!id) return false;
  const db = await getDB();
  const row = await db.getFirstAsync(`SELECT id FROM deleted_messages WHERE id = ?`, [id]);
  return !!row;
};

const addTombstones = async (db, ids) => {
  const now = Date.now();
  for (const id of ids) {
    if (id) await db.runAsync(`INSERT OR IGNORE INTO deleted_messages (id, deleted_at) VALUES (?, ?)`, [id, now]);
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

export const ensureConversationExists = async (conversationId, contactHandle, contactNickname = null, contactAvatarId = null) => {
  const db = await getDB();
  const cleanHandle = (contactHandle || 'friend').replace('@', '').trim().toLowerCase();

  // 1. Check or insert contact
  let contact = await db.getFirstAsync(`SELECT id FROM contacts WHERE LOWER(handle) = ?`, [cleanHandle]);
  let contactId = contact?.id;
  if (!contactId) {
    contactId = `contact_${cleanHandle}`;
    await db.runAsync(
      `INSERT OR IGNORE INTO contacts (id, handle, nickname, avatar_id, added_at) VALUES (?, ?, ?, ?, ?)`,
      [contactId, cleanHandle, contactNickname || cleanHandle, contactAvatarId || 'avatar_rose', Date.now()]
    );
  }

  // 2. Check or insert conversation
  await db.runAsync(
    `INSERT OR IGNORE INTO conversations (id, contact_id, last_msg, last_time, unread) VALUES (?, ?, ?, ?, ?)`,
    [conversationId, contactId, '', Date.now(), 0]
  );
};

/**
 * True if a message with this id is already stored locally.
 * Used to drop duplicate deliveries of the same message.
 */
export const messageExists = async (id) => {
  if (!id) return false;
  const db = await getDB();
  const row = await db.getFirstAsync(`SELECT id FROM messages WHERE id = ?`, [id]);
  return !!row;
};

export const insertMessage = async (msg) => {
  if (
    !msg ||
    msg.type === 'connection' ||
    msg.type === 'contact_req' ||
    msg.type === 'contact_accepted' ||
    msg.type === 'ack_seen' ||
    msg.type === 'ack_delivered' ||
    msg.type === 'delete_cmd' ||
    msg.id?.startsWith('ack_') ||
    msg.id?.startsWith('del_cmd_') ||
    (msg.body && (
      msg.body.startsWith('{"conversationId"') ||
      msg.body.includes('"conversationId"') ||
      msg.body.startsWith('{"status"') ||
      msg.body.includes('"status":"connected"')
    ))
  ) {
    return;
  }

  const db = await getDB();

  // Ensure conversation & contact exist in SQLite so foreign key constraint NEVER fails!
  if (msg.conversationId) {
    const convRow = await db.getFirstAsync(`SELECT id FROM conversations WHERE id = ?`, [msg.conversationId]);
    if (!convRow) {
      const cleanSender = (msg.sender || 'friend').replace('@', '').trim().toLowerCase();
      let contact = await db.getFirstAsync(`SELECT id FROM contacts WHERE LOWER(handle) = ?`, [cleanSender]);
      let contactId = contact?.id;
      if (!contactId) {
        contactId = `contact_${cleanSender}`;
        await db.runAsync(
          `INSERT OR IGNORE INTO contacts (id, handle, nickname, avatar_id, added_at) VALUES (?, ?, ?, ?, ?)`,
          [contactId, cleanSender, cleanSender, 'avatar_rose', Date.now()]
        );
      }
      await db.runAsync(
        `INSERT OR IGNORE INTO conversations (id, contact_id, last_msg, last_time, unread) VALUES (?, ?, ?, ?, ?)`,
        [msg.conversationId, contactId, msg.body || '', msg.sentAt || Date.now(), 0]
      );
    }
  }

  const sentAt = msg.sentAt || Date.now();

  // If this id is already stored, MERGE instead of overwriting: delivered / read only ever move
  // forward and the message keeps its place in the list (a duplicate delivery used to reset them).
  const existing = await db.getFirstAsync(
    `SELECT delivered, read, sort_key, send_state, send_attempts FROM messages WHERE id = ?`,
    [msg.id]
  );
  const sortKey =
    existing?.sort_key != null
      ? Number(existing.sort_key)
      : await computeSortKey(db, msg.conversationId, msg.sender, sentAt);

  await db.runAsync(
    `INSERT OR REPLACE INTO messages
       (id, conversation_id, sender, type, body, media_uri, sent_at, delivered, read, expires_at, reply_to, deleted,
        send_state, send_attempts, sort_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      msg.id,
      msg.conversationId,
      msg.sender,
      msg.type || 'text',
      msg.body || null,
      msg.mediaUri || null,
      sentAt,
      existing?.delivered || msg.delivered ? 1 : 0,
      existing?.read || msg.read ? 1 : 0,
      msg.expiresAt || null,
      msg.replyTo || null,
      existing?.send_state ?? msg.sendState ?? null,
      existing?.send_attempts ?? 0,
      sortKey,
    ]
  );
};

/**
 * Where a new message goes in the list.
 *
 * Sorting by the sender's phone clock is what scrambled chats: two phones never agree on the time.
 * Rule used now:
 *   - every message gets the time THIS phone first saw it, and always goes after the last one
 *     (so what you see at the bottom is what arrived last), and
 *   - the messages of ONE sender keep the order that sender sent them in (their own clock is
 *     consistent with itself), so a message that arrives late slips in just before the one
 *     that followed it, instead of landing after it.
 */
const computeSortKey = async (db, conversationId, sender, sentAt) => {
  const last = await db.getFirstAsync(
    `SELECT MAX(COALESCE(sort_key, sent_at)) AS k FROM messages WHERE conversation_id = ?`,
    [conversationId]
  );
  let key = Math.max(Date.now(), (Number(last?.k) || 0) + 1);

  const next = await db.getFirstAsync(
    `SELECT COALESCE(sort_key, sent_at) AS k FROM messages
     WHERE conversation_id = ? AND LOWER(sender) = LOWER(?) AND sent_at > ?
     ORDER BY sent_at ASC LIMIT 1`,
    [conversationId, sender || '', sentAt]
  );
  if (next && Number(next.k) <= key) {
    const prev = await db.getFirstAsync(
      `SELECT COALESCE(sort_key, sent_at) AS k FROM messages
       WHERE conversation_id = ? AND LOWER(sender) = LOWER(?) AND sent_at <= ?
       ORDER BY sent_at DESC LIMIT 1`,
      [conversationId, sender || '', sentAt]
    );
    const nextK = Number(next.k);
    const prevK = prev ? Number(prev.k) : null;
    key = prevK !== null && prevK < nextK ? (prevK + nextK) / 2 : nextK - 1;
  }
  return key;
};

export const purgeCorruptedSystemMessages = async (conversationId = null) => {
  const db = await getDB();
  try {
    if (conversationId) {
      await db.runAsync(
        `DELETE FROM messages WHERE conversation_id = ? AND (
          type IN ('connection', 'contact_req', 'contact_accepted', 'call_req', 'ack_seen', 'ack_delivered', 'delete_cmd')
          OR id LIKE 'ack_%'
          OR id LIKE 'del_cmd_%'
          OR body LIKE '{"conversationId"%'
          OR body LIKE '%"conversationId"%'
          OR body LIKE '{"status"%'
          OR body LIKE '%"status":"connected"%'
        )`,
        [conversationId]
      );
    } else {
      await db.runAsync(`
        DELETE FROM messages WHERE
          type IN ('connection', 'contact_req', 'contact_accepted', 'call_req', 'ack_seen', 'ack_delivered', 'delete_cmd')
          OR id LIKE 'ack_%'
          OR id LIKE 'del_cmd_%'
          OR body LIKE '{"conversationId"%'
          OR body LIKE '%"conversationId"%'
          OR body LIKE '{"status"%'
          OR body LIKE '%"status":"connected"%';
      `);
    }
  } catch (_) {}
};

export const getMessages = async (conversationId, limit = 50, before = null) => {
  const db = await getDB();
  const notCodeSql = `AND (body NOT LIKE '{"status"%' AND (body IS NULL OR body NOT LIKE '%"status":"connected"%'))
    AND (body NOT LIKE '{"conversationId"%' AND (body IS NULL OR body NOT LIKE '%"conversationId"%'))
    AND type NOT IN ('connection', 'contact_req', 'contact_accepted', 'ack_seen', 'ack_delivered', 'delete_cmd')
    AND id NOT LIKE 'ack_%' AND id NOT LIKE 'del_cmd_%'`;
  if (before) {
    return await db.getAllAsync(
      `SELECT * FROM messages WHERE conversation_id = ? AND deleted = 0 AND (body IS NOT NULL OR media_uri IS NOT NULL) ${notCodeSql} AND COALESCE(sort_key, sent_at) < ?
       ORDER BY COALESCE(sort_key, sent_at) DESC LIMIT ?`,
      [conversationId, before, limit]
    );
  }
  return await db.getAllAsync(
    `SELECT * FROM messages WHERE conversation_id = ? AND deleted = 0 AND (body IS NOT NULL OR media_uri IS NOT NULL) ${notCodeSql}
     ORDER BY COALESCE(sort_key, sent_at) DESC LIMIT ?`,
    [conversationId, limit]
  );
};

export const getMessagesByConversation = getMessages;

export const deleteMessage = async (messageId) => {
  const db = await getDB();
  try {
    const row = await db.getFirstAsync(`SELECT media_uri FROM messages WHERE id = ?`, [messageId]);
    if (row?.media_uri) {
      await deleteVaultFile(row.media_uri);
    }
  } catch (_) {}
  await db.runAsync(`DELETE FROM messages WHERE id = ?`, [messageId]);
  await addTombstones(db, [messageId]);
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
  await addTombstones(db, messageIds);
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

export const addVaultItem = async ({ id, fileName, fileUri, fileSize = 0, mediaType = 'photo', source = 'imported', note = null }) => {
  const db = await getDB();
  const itemId = id || `vault_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO vault_items (id, file_name, file_uri, file_size, media_type, created_at, source, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [itemId, fileName || `photo_${now}.jpg`, fileUri, fileSize, mediaType, now, source, note]
  );
  return itemId;
};

export const getPersonalVaultItems = async () => {
  const db = await getDB();
  return await db.getAllAsync(
    `SELECT * FROM vault_items ORDER BY created_at DESC`
  );
};

export const deleteVaultItemById = async (id) => {
  const db = await getDB();
  const item = await db.getFirstAsync(`SELECT file_uri FROM vault_items WHERE id = ?`, [id]);
  if (item?.file_uri) {
    await deleteVaultFilesBatch([item.file_uri]);
  }
  await db.runAsync(`DELETE FROM vault_items WHERE id = ?`, [id]);
};

export const getAllVaultMedia = async ({ filter = 'all', conversationId = null } = {}) => {
  const db = await getDB();
  let personal = [];
  let chatMedia = [];

  if (filter === 'all' || filter === 'personal') {
    if (!conversationId) {
      const pRows = await db.getAllAsync(`SELECT * FROM vault_items ORDER BY created_at DESC`);
      personal = (pRows || []).map((r) => ({
        id: r.id,
        media_uri: r.file_uri,
        sent_at: r.created_at,
        source: 'personal',
        file_name: r.file_name,
        file_size: r.file_size,
        media_type: r.media_type,
        origin: r.source || 'imported',
      }));
    }
  }

  if (filter === 'all' || filter === 'chats') {
    let cRows = [];
    if (conversationId) {
      cRows = await db.getAllAsync(
        `SELECT m.*, c.nickname AS contact_nickname FROM messages m
         LEFT JOIN conversations conv ON m.conversation_id = conv.id
         LEFT JOIN contacts c ON conv.contact_id = c.id
         WHERE m.conversation_id = ? AND m.media_uri IS NOT NULL AND m.deleted = 0
         ORDER BY m.sent_at DESC`,
        [conversationId]
      );
    } else {
      cRows = await db.getAllAsync(
        `SELECT m.*, c.nickname AS contact_nickname FROM messages m
         LEFT JOIN conversations conv ON m.conversation_id = conv.id
         LEFT JOIN contacts c ON conv.contact_id = c.id
         WHERE m.media_uri IS NOT NULL AND m.deleted = 0
         ORDER BY m.sent_at DESC`
      );
    }
    chatMedia = (cRows || []).map((r) => ({
      id: r.id,
      media_uri: r.media_uri,
      sent_at: r.sent_at,
      source: 'chat',
      conversation_id: r.conversation_id,
      sender: r.sender,
      contact_nickname: r.contact_nickname,
      file_name: 'Chat Photo',
    }));
  }

  if (filter === 'personal') return personal;
  if (filter === 'chats') return chatMedia;

  const combined = [...personal, ...chatMedia];
  combined.sort((a, b) => (b.sent_at || 0) - (a.sent_at || 0));
  return combined;
};

export const purgeExpiredMessages = async () => {
  // Tombstones only need to outlive the longest time a relay row can wait (48h): keep 14 days.
  try {
    const db0 = await getDB();
    await db0.runAsync(`DELETE FROM deleted_messages WHERE deleted_at < ?`, [Date.now() - 14 * 86400000]);
  } catch (_) {}

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

export const recordCallEventMessage = async ({
  callId,
  partnerHandle,
  myHandle,
  callType = 'voice',
  direction = 'outgoing',
  duration = 0,
}) => {
  try {
    const cleanPartner = (partnerHandle || '').replace('@', '').trim().toLowerCase();
    const cleanMy = (myHandle || '').replace('@', '').trim().toLowerCase();
    if (!cleanPartner || !cleanMy) return;

    const participants = [cleanMy, cleanPartner].sort();
    const convId = `chat_${participants[0]}_${participants[1]}`;
    const isVideo = callType === 'video';

    const formatDurationShort = (secs) => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return m > 0 ? `${m}m ${s}s` : `${s}s`;
    };

    let displayTitle = '';
    let previewText = '';

    if (direction === 'missed') {
      displayTitle = isVideo ? 'Missed video call' : 'Missed audio call';
      previewText = isVideo ? '📹 Missed video call' : '📞 Missed audio call';
    } else if (direction === 'declined') {
      displayTitle = isVideo ? 'Declined video call' : 'Declined audio call';
      previewText = isVideo ? '📹 Declined video call' : '📞 Declined audio call';
    } else if (direction === 'no_answer') {
      displayTitle = isVideo ? 'Unanswered video call' : 'Unanswered audio call';
      previewText = isVideo ? '📹 Outgoing video call' : '📞 Outgoing audio call';
    } else {
      const durStr = duration > 0 ? formatDurationShort(duration) : null;
      displayTitle = isVideo ? 'Video call ended' : 'Audio call ended';
      previewText = isVideo
        ? `📹 Video call ended${durStr ? ` (${durStr})` : ''}`
        : `📞 Audio call ended${durStr ? ` (${durStr})` : ''}`;
    }

    const payload = JSON.stringify({
      callId,
      callType,
      direction,
      duration,
      displayTitle,
    });

    const msgId = `call_${callId || Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const sender = direction === 'outgoing' || direction === 'no_answer' ? cleanMy : cleanPartner;

    await insertMessage({
      id: msgId,
      conversationId: convId,
      sender,
      type: 'call',
      body: payload,
      sentAt: Date.now(),
      delivered: 1,
      read: direction === 'missed' ? 0 : 1,
    });

    await upsertConversation({
      id: convId,
      lastMsg: previewText,
      lastTime: Date.now(),
      unread: direction === 'missed' ? 1 : 0,
    });
  } catch (err) {
    console.warn('[recordCallEventMessage] Error:', err);
  }
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
  // Counted from the messages themselves (incoming + unread), not from a stored counter.
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) as total
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     JOIN contacts ct ON ct.id = c.contact_id
     WHERE m.deleted = 0 AND m.read = 0 AND LOWER(m.sender) = LOWER(ct.handle)
       AND m.type NOT IN ('connection', 'contact_req', 'contact_accepted', 'call_req', 'ack_seen', 'ack_delivered', 'delete_cmd')
       AND m.id NOT LIKE 'ack_%' AND m.id NOT LIKE 'del_cmd_%'`
  );
  return Math.max(0, Number(row?.total) || 0);
};

/**
 * Instant Erase / Kill Switch: Irreversibly purges all database tables and scrubs SQLite storage
 */
export const nukeEntireDatabase = async () => {
  try {
    const db = await getDB();
    await db.execAsync(`
      DELETE FROM messages;
      DELETE FROM conversations;
      DELETE FROM contacts;
      DELETE FROM call_logs;
      DELETE FROM deleted_messages;
      DELETE FROM vault_items;
      DELETE FROM crash_reports;
      DELETE FROM app_feedback;
      VACUUM;
    `);
    console.log('Database nuked successfully.');
  } catch (err) {
    console.warn('nukeEntireDatabase error:', err);
  }
};

export const logCrashToDB = async ({ errorMessage, stackTrace, componentStack }) => {
  try {
    const db = await getDB();
    const id = `crash_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.runAsync(
      `INSERT INTO crash_reports (id, error_message, stack_trace, component_stack, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, String(errorMessage || 'Unknown Error'), String(stackTrace || ''), String(componentStack || ''), Date.now()]
    );
    return id;
  } catch (e) {
    console.error('Failed to log crash to DB:', e);
    return null;
  }
};

export const getCrashLogsFromDB = async (limit = 10) => {
  try {
    const db = await getDB();
    return await db.getAllAsync(`SELECT * FROM crash_reports ORDER BY created_at DESC LIMIT ?`, [limit]);
  } catch (_) {
    return [];
  }
};

export const saveFeedbackToDB = async ({ category, content, deviceInfo }) => {
  try {
    const db = await getDB();
    const id = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.runAsync(
      `INSERT INTO app_feedback (id, category, content, device_info, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, category || 'feedback', content, deviceInfo || '', Date.now()]
    );
    return id;
  } catch (err) {
    console.error('Failed to save feedback to DB:', err);
    return null;
  }
};

