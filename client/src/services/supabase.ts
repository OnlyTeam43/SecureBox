// client/src/services/supabase.ts
// Supabase Client & Zero-Storage Ephemeral Relay in TypeScript

import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { EncryptedPayload, RoomStateResponse } from '../types';

export const SUPABASE_URL = 'https://mhqtqcjceklbtnfaqhqj.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ocXRxY2pjZWtsYnRuZmFxaHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NzAyNTQsImV4cCI6MjEwODI0NjI1NH0.0ycACugh0_7kboYOAz5pXfNUxKnIt9FSlDgDVK5rvgA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

/**
 * Register or fetch room state to enforce the 2-person limit
 */
export async function getOrCreateRoomState(
  roomId: string,
  myHandle: string,
  isCreator: boolean = false
): Promise<RoomStateResponse> {
  const roomRecordId = `room_state_${roomId}`;
  const cleanHandle = myHandle.trim().toLowerCase();

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id', roomRecordId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('Fetch room state error:', error.message);
    }

    if (!data) {
      if (isCreator) {
        const statePayload = {
          creator: cleanHandle,
          guest: null,
          isFull: false,
          createdAt: Date.now(),
        };
        await supabase.from('messages').insert({
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
        return { success: true, isCreator: false, isFull: false, partner: null };
      }
    }

    const meta = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
    const creator = (meta.creator || '').toLowerCase();
    const guest = (meta.guest || '').toLowerCase();

    if (cleanHandle === creator) {
      return { success: true, isCreator: true, isFull: !!guest, partner: guest || null };
    }
    if (cleanHandle === guest) {
      return { success: true, isCreator: false, isFull: true, partner: creator };
    }

    if (guest && guest !== cleanHandle) {
      return {
        success: false,
        isCreator: false,
        isFull: true,
        partner: null,
        error: 'This private room is already full (2/2 members). The invite link has expired.',
      };
    }

    // Claim guest spot
    meta.guest = cleanHandle;
    meta.isFull = true;

    await supabase
      .from('messages')
      .update({
        body: JSON.stringify(meta),
      })
      .eq('id', roomRecordId);

    return { success: true, isCreator: false, isFull: true, partner: creator };
  } catch (err: any) {
    console.warn('getOrCreateRoomState notice:', err?.message || err);
    return { success: true, isCreator, isFull: false, partner: null };
  }
}

/**
 * Publish encrypted message via WebSocket broadcast + ephemeral offline relay
 */
export async function sendEncryptedMessage({
  roomId,
  sender,
  recipient,
  encryptedPayload,
}: {
  roomId: string;
  sender: string;
  recipient: string | null;
  encryptedPayload: EncryptedPayload;
}): Promise<{ success: boolean; id: string }> {
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

  // 1. Instant WebSocket broadcast
  try {
    const channel = supabase.getChannels().find((c) => c.topic === `realtime:room_${roomId}`);
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

  // 2. Ephemeral Offline Relay in Supabase (purged immediately upon receipt)
  try {
    const relayReceiver = cleanRecipient ? `${roomId}_${cleanRecipient}` : `${roomId}_broadcast`;
    await supabase.from('messages').insert({
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
      expires_at: Date.now() + 86400000 * 2, // 48h fallback purge
    });
  } catch (err) {
    console.warn('Ephemeral insert error:', err);
  }

  return { success: true, id: messageId };
}

/**
 * Fetch and clear offline queued messages (ZERO-STORAGE POLICY)
 */
export async function fetchAndClearOfflineMessages(
  roomId: string,
  myHandle: string
): Promise<Array<{ id: string; sender: string; iv: string; data: string; timestamp: number }>> {
  if (!myHandle) return [];

  const cleanHandle = myHandle.trim().toLowerCase();
  const targetReceiver = `${roomId}_${cleanHandle}`;

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('receiver', targetReceiver)
      .eq('type', 'room_msg')
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) return [];

    const idsToDelete = data.map((d) => d.id);

    // Immediately remove from remote relay queue (Zero-Storage)
    supabase
      .from('messages')
      .delete()
      .in('id', idsToDelete)
      .then(() => {}, () => {});

    return data.map((d) => {
      const parsed = typeof d.body === 'string' ? JSON.parse(d.body) : d.body;
      return {
        id: d.id,
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
export function subscribeToRoom(
  roomId: string,
  myHandle: string,
  handlers: {
    onMessage: (payload: any) => void;
    onTyping: (payload: { sender: string; isTyping: boolean }) => void;
    onPresenceChange: (activeUsers: string[]) => void;
  }
): RealtimeChannel {
  const channelName = `room_${roomId}`;
  const cleanMy = myHandle.trim().toLowerCase();

  const existing = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`);
  if (existing) {
    try {
      supabase.removeChannel(existing);
    } catch (_) {}
  }

  const channel = supabase.channel(channelName, {
    config: {
      presence: { key: cleanMy },
      broadcast: { ack: true },
    },
  });

  channel
    .on('broadcast', { event: 'message' }, ({ payload }) => {
      if (payload) handlers.onMessage(payload);
    })
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload && payload.sender !== cleanMy) handlers.onTyping(payload);
    })
    .on('broadcast', { event: 'wipe_room' }, () => {
      localStorage.removeItem(`room_chat_${roomId}`);
      window.location.reload();
    })
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      handlers.onPresenceChange(Object.keys(state));
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ handle: cleanMy, joinedAt: Date.now() });
      }
    });

  return channel;
}

export async function sendTypingStatus(roomId: string, myHandle: string, isTyping: boolean) {
  try {
    const channel = supabase.getChannels().find((c) => c.topic === `realtime:room_${roomId}`);
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { sender: myHandle.trim().toLowerCase(), isTyping },
      });
    }
  } catch (_) {}
}

export async function sendWipeSignal(roomId: string) {
  try {
    const channel = supabase.getChannels().find((c) => c.topic === `realtime:room_${roomId}`);
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'wipe_room',
        payload: { roomId },
      });
    }
  } catch (_) {}
}
