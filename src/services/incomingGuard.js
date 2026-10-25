// src/services/incomingGuard.js
// One message can reach this phone through several paths at the same time:
//   1. Realtime broadcast on the user channel
//   2. Postgres Changes (INSERT on the relay table)
//   3. The "pending messages" fetch done by InboxScreen / ChatScreen
// Each path must claim the message id before processing it, so a message is saved,
// counted as unread and acknowledged exactly once.

const claimed = new Map(); // id -> claimedAt
const MAX_CLAIMS = 1000;

/** Returns true if the caller now owns this id, false if someone else already has it. */
export const tryClaimIncoming = (id) => {
  if (!id) return true;
  if (claimed.has(id)) return false;
  claimed.set(id, Date.now());
  if (claimed.size > MAX_CLAIMS) {
    const oldest = claimed.keys().next().value;
    claimed.delete(oldest);
  }
  return true;
};

/** Give the id back (use when processing failed so another path can retry). */
export const releaseIncoming = (id) => {
  if (id) claimed.delete(id);
};
