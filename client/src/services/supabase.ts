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

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = sessionStorage.getItem('securebox_session_id');
  if (!id) {
    id = 's_' + Math.random().toString(36).slice(2, 9);
    sessionStorage.setItem('securebox_session_id', id);
  }
  return id;
}

/**
 * Register or fetch room state to link partners and enforce the 2-person limit
 */
export async function getOrCreateRoomState(
  roomId: string,
  myHandle: string,
  isCreator: boolean = false
): Promise<RoomStateResponse> {
  const roomRecordId = `room_state_${roomId}`;
  const cleanHandle = myHandle.trim();

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id', roomRecordId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('Fetch room state notice:', error.message);
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
        });
        return { success: true, isCreator: true, isFull: false, partner: null };
      } else {
        return { success: true, isCreator: false, isFull: false, partner: null };
      }
    }

    const meta = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
    const creator = (meta.creator || '').trim();
    const guest = (meta.guest || '').trim();

    if (isCreator || cleanHandle.toLowerCase() === creator.toLowerCase()) {
      return {
        success: true,
        isCreator: true,
        isFull: !!guest,
        partner: guest || null,
      };
    }

    if (guest && cleanHandle.toLowerCase() === guest.toLowerCase()) {
      return { success: true, isCreator: false, isFull: true, partner: creator };
    }

    // Guest claiming spot or room already has creator
    if (!guest) {
      meta.guest = cleanHandle;
      meta.isFull = true;

      await supabase
        .from('messages')
        .update({
          body: JSON.stringify(meta),
        })
        .eq('id', roomRecordId);

      return { success: true, isCreator: false, isFull: true, partner: creator };
    }

    // Room already has 2 members
    return {
      success: true,
      isCreator: false,
      isFull: true,
      partner: creator,
    };
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
  sessionId,
  encryptedPayload,
}: {
  roomId: string;
  sender: string;
  sessionId: string;
  encryptedPayload: EncryptedPayload;
}): Promise<{ success: boolean; id: string }> {
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const cleanSender = sender.trim();

  const wsPayload = {
    id: messageId,
    roomId,
    sender: cleanSender,
    sessionId,
    iv: encryptedPayload.iv,
    data: encryptedPayload.data,
    timestamp: Date.now(),
  };

  // 1. WebSocket Broadcast to active room channel
  try {
    const channel = supabase.getChannels().find((c) => c.topic === `realtime:room_${roomId}`);
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'message',
        payload: wsPayload,
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Realtime broadcast notice:', err);
  }

  // 2. Ephemeral Offline Relay in Supabase (purged immediately upon receipt)
  try {
    await supabase.from('messages').insert({
      id: messageId,
      sender: cleanSender,
      receiver: `relay_${roomId}`,
      body: JSON.stringify({
        sessionId,
        iv: encryptedPayload.iv,
        data: encryptedPayload.data,
        timestamp: Date.now(),
      }),
      type: 'room_msg',
      created_at: Date.now(),
    });
  } catch (err) {
    console.warn('Ephemeral insert notice:', err);
  }

  return { success: true, id: messageId };
}

/**
 * Fetch and clear offline queued messages (ZERO-STORAGE POLICY)
 */
export async function fetchAndClearOfflineMessages(
  roomId: string,
  mySessionId: string
): Promise<Array<{ id: string; sender: string; iv: string; data: string; timestamp: number }>> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('receiver', `relay_${roomId}`)
      .eq('type', 'room_msg')
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) return [];

    const validMessages = data.filter((d) => {
      try {
        const parsed = typeof d.body === 'string' ? JSON.parse(d.body) : d.body;
        return parsed.sessionId !== mySessionId;
      } catch (_) {
        return false;
      }
    });

    if (validMessages.length === 0) return [];

    const idsToDelete = validMessages.map((d) => d.id);
    supabase.from('messages').delete().in('id', idsToDelete).then(() => {}, () => {});

    return validMessages.map((d) => {
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
  mySessionId: string,
  handlers: {
    onMessage: (payload: any) => void;
    onTyping: (payload: { sender: string; isTyping: boolean }) => void;
    onPresenceChange: (activeUsers: Array<{ handle: string; sessionId: string }>) => void;
    onWipe?: () => void;
  }
): RealtimeChannel {
  const channelName = `room_${roomId}`;
  const cleanMy = myHandle.trim();

  const existing = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`);
  if (existing) {
    try {
      supabase.removeChannel(existing);
    } catch (_) {}
  }

  const channel = supabase.channel(channelName, {
    config: {
      presence: { key: mySessionId },
      broadcast: { self: false },
    },
  });

  channel
    .on('broadcast', { event: 'message' }, ({ payload }) => {
      if (payload && payload.sessionId !== mySessionId) {
        handlers.onMessage(payload);
      }
    })
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload && payload.sessionId !== mySessionId) {
        handlers.onTyping(payload);
      }
    })
    .on('broadcast', { event: 'wipe_room' }, ({ payload }) => {
      const targetId = payload?.roomId || roomId;
      localStorage.removeItem(`room_chat_${targetId}`);
      localStorage.removeItem(`securebox_unread_count_${targetId}`);
      try {
        const raw = localStorage.getItem('securebox_rooms');
        const map = raw ? JSON.parse(raw) : {};
        delete map[targetId];
        localStorage.setItem('securebox_rooms', JSON.stringify(map));
        if (localStorage.getItem('securebox_active_room_id') === targetId) {
          localStorage.removeItem('securebox_active_room_id');
        }
      } catch (_) {}

      if (handlers.onWipe) {
        handlers.onWipe();
      }
    })
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users: Array<{ handle: string; sessionId: string }> = [];
      Object.keys(state).forEach((key) => {
        const entries = state[key] as any[];
        if (entries && entries.length > 0) {
          users.push({
            sessionId: key,
            handle: entries[0].handle || 'Partner',
          });
        }
      });
      handlers.onPresenceChange(users);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ handle: cleanMy, sessionId: mySessionId, joinedAt: Date.now() });
      }
    });

  return channel;
}

export async function sendTypingStatus(roomId: string, myHandle: string, sessionId: string, isTyping: boolean) {
  try {
    const channel = supabase.getChannels().find((c) => c.topic === `realtime:room_${roomId}`);
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { sender: myHandle.trim(), sessionId, isTyping },
      }).catch(() => {});
    }
  } catch (_) {}
}

export async function sendWipeSignal(roomId: string) {
  try {
    await supabase.from('messages').delete().eq('receiver', roomId);
    await supabase.from('messages').delete().eq('receiver', `relay_${roomId}`);
    await supabase.from('messages').delete().eq('id', `room_state_${roomId}`);

    const channel = supabase.getChannels().find((c) => c.topic === `realtime:room_${roomId}`);
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'wipe_room',
        payload: { roomId, timestamp: Date.now() },
      });
    }
  } catch (err) {
    console.warn('Wipe signal notice:', err);
  }
}
