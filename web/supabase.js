/**
 * web/supabase.js
 * Supabase client configuration & zero-storage ephemeral relay
 */

export const SUPABASE_URL = 'https://mhqtqcjceklbtnfaqhqj.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ocXRxY2pjZWtsYnRuZmFxaHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NzAyNTQsImV4cCI6MjEwODI0NjI1NH0.0ycACugh0_7kboYOAz5pXfNUxKnIt9FSlDgDVK5rvgA';

let supabaseClient = null;

export function getSupabase() {
  if (!supabaseClient) {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
    } else {
      console.warn('Supabase SDK not loaded yet. Waiting for script...');
    }
  }
  return supabaseClient;
}

/**
 * Register or fetch room state to enforce the 2-person limit
 */
export async function getOrCreateRoomState(roomId, myHandle, isCreator = false) {
  const sb = getSupabase();
  if (!sb) return { success: false, error: 'Database unavailable' };

  const roomRecordId = `room_state_${roomId}`;
  const cleanHandle = myHandle.trim().toLowerCase();

  try {
    // 1. Fetch current room state
    const { data, error } = await sb
      .from('messages')
      .select('*')
      .eq('id', roomRecordId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('Fetch room state error:', error.message);
    }

    if (!data) {
      // Room doesn't exist on server yet
      if (isCreator) {
        const statePayload = {
          creator: cleanHandle,
          guest: null,
          isFull: false,
          createdAt: Date.now(),
        };
        await sb.from('messages').insert({
          id: roomRecordId,
          sender: cleanHandle,
          receiver: roomId,
          body: JSON.stringify(statePayload),
          type: 'room_meta',
          created_at: Date.now(),
          expires_at: Date.now() + 86400000 * 30, // 30 days
        });
        return { success: true, isCreator: true, isFull: false, partner: null };
      } else {
        // Guest visited before creator row committed
        return { success: true, isCreator: false, isFull: false, partner: null };
      }
    }

    // Parse existing room metadata
    const meta = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
    const creator = (meta.creator || '').toLowerCase();
    const guest = (meta.guest || '').toLowerCase();

    // Check if user is already one of the 2 participants
    if (cleanHandle === creator) {
      return { success: true, isCreator: true, isFull: !!guest, partner: guest || null };
    }
    if (cleanHandle === guest) {
      return { success: true, isCreator: false, isFull: true, partner: creator };
    }

    // User is neither creator nor guest. Can they join?
    if (guest && guest !== cleanHandle) {
      // Room is strictly locked to 2 people!
      return {
        success: false,
        isFull: true,
        error: 'This private room is already full (2/2 members). The invite link has expired.',
      };
    }

    // Room has spot for guest! Claim it now.
    meta.guest = cleanHandle;
    meta.isFull = true;

    await sb
      .from('messages')
      .update({
        body: JSON.stringify(meta),
      })
      .eq('id', roomRecordId);

    return { success: true, isCreator: false, isFull: true, partner: creator };
  } catch (err) {
    console.warn('getOrCreateRoomState notice:', err);
    return { success: true, isCreator, isFull: false, partner: null };
  }
}

/**
 * Publish encrypted message to room via realtime WebSocket + ephemeral offline queue
 */
export async function sendEncryptedMessage({ roomId, sender, recipient, encryptedPayload }) {
  const sb = getSupabase();
  if (!sb) return { success: false };

  const cleanSender = sender.trim().toLowerCase();
  const cleanRecipient = (recipient || '').trim().toLowerCase();
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const wsPayload = {
    id: messageId,
    roomId,
    sender: cleanSender,
    recipient: cleanRecipient,
    iv: encryptedPayload.iv,
    data: encryptedPayload.data,
    timestamp: Date.now(),
  };

  // 1. Instant WebSocket broadcast to active channel
  try {
    const channel = sb.getChannels().find((c) => c.topic === `realtime:room_${roomId}`);
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'message',
        payload: wsPayload,
      });
    }
  } catch (err) {
    console.warn('Realtime broadcast error:', err);
  }

  // 2. Ephemeral Offline Relay in Supabase (auto-deleted once picked up)
  try {
    const relayReceiver = cleanRecipient ? `${roomId}_${cleanRecipient}` : `${roomId}_broadcast`;
    await sb.from('messages').insert({
      id: messageId,
      sender: cleanSender,
      receiver: relayReceiver,
      body: JSON.stringify({
        iv: encryptedPayload.iv,
        data: encryptedPayload.data,
        timestamp: Date.now(),
      }),
      type: 'room_msg',
      created_at: Date.now(),
      expires_at: Date.now() + 86400000 * 2, // 48h purge
    });
  } catch (err) {
    console.warn('Ephemeral insert error:', err);
  }

  return { success: true, id: messageId };
}

/**
 * Fetch and clear offline queued messages for this user (ZERO-STORAGE POLICY)
 */
export async function fetchAndClearOfflineMessages(roomId, myHandle) {
  const sb = getSupabase();
  if (!sb || !myHandle) return [];

  const cleanHandle = myHandle.trim().toLowerCase();
  const targetReceiver = `${roomId}_${cleanHandle}`;

  try {
    const { data, error } = await sb
      .from('messages')
      .select('*')
      .eq('receiver', targetReceiver)
      .eq('type', 'room_msg')
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) return [];

    const idsToDelete = data.map((d) => d.id);

    // Immediately remove from remote relay queue (Zero-Storage)
    sb.from('messages')
      .delete()
      .in('id', idsToDelete)
      .then(() => {})
      .catch(() => {});

    return data.map((d) => {
      const parsed = typeof d.body === 'string' ? JSON.parse(d.body) : d.body;
      return {
        id: d.id,
        roomId,
        sender: d.sender,
        iv: parsed.iv,
        data: parsed.data,
        timestamp: parsed.timestamp || Number(d.created_at),
      };
    });
  } catch (err) {
    console.warn('Fetch offline messages notice:', err);
    return [];
  }
}

/**
 * Subscribe to the real-time room channel
 */
export function subscribeToRoom(roomId, myHandle, { onMessage, onTyping, onPresenceChange }) {
  const sb = getSupabase();
  if (!sb) return null;

  const channelName = `room_${roomId}`;
  const cleanMy = myHandle.trim().toLowerCase();

  // Remove existing channel if present
  const existing = sb.getChannels().find((c) => c.topic === `realtime:${channelName}`);
  if (existing) {
    try {
      sb.removeChannel(existing);
    } catch (_) {}
  }

  const channel = sb.channel(channelName, {
    config: {
      presence: { key: cleanMy },
      broadcast: { ack: true },
    },
  });

  channel
    .on('broadcast', { event: 'message' }, ({ payload }) => {
      if (payload && onMessage) {
        onMessage(payload);
      }
    })
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload && payload.sender !== cleanMy && onTyping) {
        onTyping(payload);
      }
    })
    .on('broadcast', { event: 'wipe_room' }, () => {
      // Remote partner requested instant chat wipe
      localStorage.removeItem(`room_chat_${roomId}`);
      window.location.reload();
    })
    .on('presence', { event: 'sync' }, () => {
      if (onPresenceChange) {
        const state = channel.presenceState();
        const activeUsers = Object.keys(state);
        onPresenceChange(activeUsers);
      }
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ handle: cleanMy, joinedAt: Date.now() });
      }
    });

  return channel;
}

/**
 * Broadcast typing status
 */
export async function sendTypingStatus(roomId, myHandle, isTyping) {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const channel = sb.getChannels().find((c) => c.topic === `realtime:room_${roomId}`);
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { sender: myHandle.trim().toLowerCase(), isTyping: !!isTyping },
      });
    }
  } catch (_) {}
}

/**
 * Signal partner to wipe chat locally
 */
export async function sendWipeSignal(roomId) {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const channel = sb.getChannels().find((c) => c.topic === `realtime:room_${roomId}`);
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'wipe_room',
        payload: { roomId },
      });
    }
  } catch (_) {}
}
