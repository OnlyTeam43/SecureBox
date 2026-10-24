// src/services/supabase.js
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import {
  getContactByHandle,
  deleteMessagesBatch,
  markSentMessagesDelivered,
  markSentMessagesRead,
  isConversationOrContactConnected,
  insertContact,
  upsertConversation,
} from '../db/database';

export const SUPABASE_URL = 'https://mhqtqcjceklbtnfaqhqj.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ocXRxY2pjZWtsYnRuZmFxaHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NzAyNTQsImV4cCI6MjEwODI0NjI1NH0.0ycACugh0_7kboYOAz5pXfNUxKnIt9FSlDgDVK5rvgA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Check if a handle is available in Supabase (minimum 3 characters)
 */
export const checkHandleAvailability = async (handle) => {
  const clean = handle.replace('@', '').trim().toLowerCase();
  if (clean.length < 3) {
    return { available: false, reason: 'Handle must be at least 3 characters' };
  }
  if (!/^[a-z0-9_.]+$/.test(clean)) {
    return { available: false, reason: 'Only lowercase letters, numbers, _, and . are allowed' };
  }
  try {
    const { data, error } = await supabase
      .from('users')
      .select('handle')
      .eq('handle', clean)
      .maybeSingle();

    if (error) {
      console.warn('Handle check error:', error.message);
      return { available: true };
    }
    return { available: !data, reason: data ? 'Handle is already taken' : 'Handle is available' };
  } catch (_err) {
    return { available: true };
  }
};

/**
 * Automatically generate a unique handle from a user name (min 3 chars, never already exists)
 */
export const generateUniqueHandle = async (name) => {
  const baseRaw = (name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '');
  let base = baseRaw || 'user';
  if (base.length < 3) {
    const diff = 3 - base.length;
    const minNum = Math.pow(10, diff - 1);
    const maxNum = Math.pow(10, diff) - 1;
    const padding = Math.floor(minNum + Math.random() * (maxNum - minNum + 1));
    base = `${base}${padding}`;
  }

  // 1. Test base candidate
  let candidate = base;
  let check = await checkHandleAvailability(candidate);
  if (check.available) {
    return candidate;
  }

  // 2. Loop with random numerical suffixes
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = Math.floor(10 + Math.random() * 990);
    candidate = `${base}_${suffix}`;
    check = await checkHandleAvailability(candidate);
    if (check.available) {
      return candidate;
    }
  }

  // 3. Fallback timestamp
  return `${base}_${Date.now().toString().slice(-4)}`;
};

/**
 * Register or update user handle, phone & nickname in Supabase
 * mobile_number stores `${cleanPhone}#${recoveryPin}` for instant recovery
 */
export const registerUserInSupabase = async ({
  id,
  handle,
  nickname,
  avatarId,
  mobileNumber,
  password,
  recoveryPin,
}) => {
  const cleanHandle = handle.replace('@', '').trim().toLowerCase();

  let mobilePayload = null;
  if (mobileNumber && mobileNumber.trim()) {
    if (mobileNumber.includes('@')) {
      mobilePayload = recoveryPin ? `${mobileNumber.trim()}#${recoveryPin}` : mobileNumber.trim();
    } else {
      const cleanPhone = mobileNumber.replace(/[^0-9+]/g, '');
      mobilePayload = recoveryPin ? `${cleanPhone}#${recoveryPin}` : cleanPhone;
    }
  }

  // Auto-detect authenticated Supabase Auth user ID if not provided
  let authUserId = id;
  if (!authUserId) {
    try {
      const { data: authUserRes } = await supabase.auth.getUser();
      if (authUserRes?.user?.id) {
        authUserId = authUserRes.user.id;
      }
    } catch (_) {}
  }

  const payload = {
    handle: cleanHandle,
    nickname: nickname.trim(),
    avatar_id: avatarId || 'avatar_rose',
    mobile_number: mobilePayload,
    password: password,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('users')
    .upsert(payload, { onConflict: 'handle' })
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
};

/**
 * Verify Recovery PIN for password reset via WhatsApp number or @handle
 */
export const verifyRecoveryPin = async (identifier, pin) => {
  const cleanInput = (identifier || '').trim();
  if (!cleanInput) {
    throw new Error('Please enter your WhatsApp number or @handle');
  }
  const cleanPin = (pin || '').trim();
  if (cleanPin.length !== 4) {
    throw new Error('Please enter your 4-digit Recovery PIN');
  }

  let user = null;
  const cleanHandle = cleanInput.replace('@', '').toLowerCase();

  // Try handle lookup
  const { data: byHandle } = await supabase
    .from('users')
    .select('*')
    .eq('handle', cleanHandle)
    .maybeSingle();

  if (byHandle) {
    user = byHandle;
  } else {
    // Try phone number lookup
    const cleanPhone = cleanInput.replace(/[^0-9+]/g, '');
    if (cleanPhone) {
      const { data: byPhone } = await supabase
        .from('users')
        .select('*')
        .ilike('mobile_number', `${cleanPhone}%`)
        .maybeSingle();
      if (byPhone) {
        user = byPhone;
      }
    }
  }

  if (!user) {
    return { success: false, error: 'No account found with that WhatsApp number or handle.' };
  }

  const storedPin =
    user.mobile_number && user.mobile_number.includes('#')
      ? user.mobile_number.split('#')[1]
      : null;

  if (!storedPin) {
    return {
      success: false,
      error: 'No recovery PIN was set for this account. Please log in with your current password.',
    };
  }

  if (storedPin !== cleanPin) {
    return { success: false, error: 'Invalid 4-digit Recovery PIN. Please check and try again.' };
  }

  return { success: true, user };
};

/**
 * Reset user password in Supabase
 */
export const resetUserPassword = async (handle, newPassword) => {
  const cleanHandle = handle.replace('@', '').trim().toLowerCase();
  const { data, error } = await supabase
    .from('users')
    .update({
      password: newPassword,
      updated_at: new Date().toISOString(),
    })
    .eq('handle', cleanHandle)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
};

/**
 * Update user avatar picture in Supabase
 */
export const updateUserAvatarInSupabase = async (handle, avatarUri) => {
  const cleanHandle = handle.replace('@', '').trim().toLowerCase();
  const { data, error } = await supabase
    .from('users')
    .update({
      avatar_id: avatarUri,
      updated_at: new Date().toISOString(),
    })
    .eq('handle', cleanHandle)
    .select()
    .single();

  if (error) {
    console.warn('Update avatar error in Supabase:', error.message);
  }
  return data;
};

/**
 * Find user profile by unique @handle
 */
export const findUserByHandle = async (handle) => {
  const cleanHandle = handle.replace('@', '').trim().toLowerCase();
  const { data, error } = await supabase
    .from('users')
    .select('handle, nickname, avatar_id')
    .eq('handle', cleanHandle)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
};

/**
 * Verify login credentials (handle & password)
 */
export const verifyLoginCredentials = async (handle, password) => {
  const cleanHandle = handle.replace('@', '').trim().toLowerCase();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('handle', cleanHandle)
    .eq('password', password)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
};

/**
 * Send message via ephemeral relay and real-time WebSocket broadcast.
 * ZERO-STORAGE POLICY: Messages are queued strictly as ephemeral relay packets.
 * Once fetched/delivered, they are IMMEDIATELY deleted from Supabase.
 */
export const sendMessageToSupabase = async ({
  id,
  conversationId,
  sender,
  receiver,
  body,
  mediaUri,
  sentAt,
  expiresAt,
  replyTo,
}) => {
  const cleanSender = sender.replace('@', '').trim().toLowerCase();
  const receiverClean = receiver ? receiver.replace('@', '').trim().toLowerCase() : '';

  // 1. Ephemeral Cloud Relay:
  // Post message to temporary relay queue in Supabase.
  // The row will be IMMEDIATELY deleted by recipient device upon receipt or fetch!
  // Fallback expires_at (48 hours) ensures server auto-purges if recipient never connects.
  try {
    await supabase.from('messages').insert({
      id,
      conversation_id: conversationId,
      sender: cleanSender,
      receiver: receiverClean,
      body: body || null,
      media_uri: mediaUri || null,
      created_at: sentAt || Date.now(),
      expires_at: expiresAt || (Date.now() + 86400000 * 2),
      reply_to: replyTo || null,
      type: mediaUri ? 'image' : 'text',
    });
  } catch (dbErr) {
    console.warn('Ephemeral relay queue insert note:', dbErr?.message);
  }

  // 2. Realtime WebSocket payload:
  // Strip heavy base64 to keep payload tiny (<10KB) and prevent 256KB WebSocket drops.
  const wsPayload = {
    id,
    conversation_id: conversationId,
    sender: cleanSender,
    receiver: receiverClean,
    body: body || null,
    media_uri: null, // do not bloat websocket payload
    has_media: Boolean(mediaUri),
    sent_at: sentAt || Date.now(),
    expires_at: expiresAt || null,
    reply_to: replyTo || null,
    type: mediaUri ? 'image' : 'text',
  };

  // 3. Direct instantaneous delivery to the active chat room via WebSocket broadcast
  try {
    let roomChannel = supabase.getChannels().find((c) => c.topic === `realtime:room_${conversationId}`);
    if (!roomChannel) {
      roomChannel = supabase.channel(`room_${conversationId}`);
      await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(), 1200);
        roomChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timer);
            resolve();
          }
        });
      });
    }
    await roomChannel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: wsPayload,
    });
  } catch (err) {
    console.warn('Room broadcast error:', err);
  }

  // 4. Direct delivery to the partner's inbox channel via WebSocket broadcast
  if (receiverClean) {
    try {
      const userChannelName = `user_${receiverClean}`;
      let userChannel = supabase.getChannels().find((c) => c.topic === `realtime:${userChannelName}`);
      if (!userChannel) {
        userChannel = supabase.channel(userChannelName);
        await new Promise((resolve) => {
          const timer = setTimeout(() => resolve(), 1200);
          userChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              clearTimeout(timer);
              resolve();
            }
          });
        });
      }
      await userChannel.send({
        type: 'broadcast',
        event: 'incoming_msg',
        payload: wsPayload,
      });
    } catch (err) {
      console.warn('User broadcast error:', err);
    }
  }

  // 4. Remote Push Notification to recipient's phone via Expo/FCM
  // Ensures recipient gets sound & notification even if their app is completely closed!
  if (receiverClean) {
    getUserPushToken(receiverClean)
      .then((tokenData) => {
        if (tokenData && (tokenData.token || typeof tokenData === 'string')) {
          const actualToken = tokenData.token || tokenData;
          const isStealth = Boolean(tokenData.stealth);
          const pushTitle = isStealth ? 'Google Play Services' : cleanSender;
          const pushBody = isStealth
            ? 'Backup successfully synced.'
            : (mediaUri ? 'Sent a photo 📷' : (body ? body.substring(0, 100) : 'New message'));

          sendExpoPushNotification({
            toToken: actualToken,
            title: pushTitle,
            body: pushBody,
            channelId: 'messages_sound_v1',
            priority: 'high',
            data: {
              type: 'chat',
              conversationId,
              contactHandle: cleanSender,
            },
          });
        }
      })
      .catch(() => {});
  }

  return payload;
};

/**
 * Save user's device Expo Push Token to durable relay queue
 */
export const saveUserPushToken = async (handle, token, isStealth = false) => {
  if (!handle || !token) return;
  const clean = handle.replace('@', '').trim().toLowerCase();
  try {
    const rawVal = JSON.stringify({ token: String(token), stealth: Boolean(isStealth) });
    await supabase.from('messages').upsert({
      id: `push_token_${clean}`,
      type: 'push_tokens',
      sender: clean,
      receiver: clean,
      body: rawVal,
      created_at: Date.now(),
    });
    try {
      await supabase.from('users').update({ push_token: String(token) }).eq('handle', clean);
    } catch (_) {}
    console.log(`[PushToken] Saved push token for ${clean} (stealth=${isStealth})`);
  } catch (err) {
    console.warn('[PushToken] Save error:', err.message);
  }
};

/**
 * Retrieve user's device Expo Push Token
 */
export const getUserPushToken = async (handle) => {
  if (!handle) return null;
  const clean = handle.replace('@', '').trim().toLowerCase();
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('body')
      .eq('id', `push_token_${clean}`)
      .maybeSingle();
    if (error || !data || !data.body) return null;

    if (data.body.startsWith('ExponentPushToken[')) {
      return { token: data.body, stealth: false };
    }
    try {
      const parsed = JSON.parse(data.body);
      if (parsed && parsed.token) {
        return { token: parsed.token, stealth: Boolean(parsed.stealth) };
      }
    } catch (_) {}
    return { token: data.body, stealth: false };
  } catch (_) {
    return null;
  }
};

/**
 * Send an Expo Remote Push Notification via https://exp.host/--/api/v2/push/send
 * This alerts the recipient's phone via FCM even when their app is completely closed!
 */
export const sendExpoPushNotification = async ({
  toToken,
  title,
  body,
  data = {},
  channelId = 'messages_sound_v1',
  priority = 'high',
}) => {
  if (!toToken || typeof toToken !== 'string' || !toToken.startsWith('ExponentPushToken[')) {
    return;
  }
  try {
    const payload = {
      to: toToken,
      sound: 'default',
      title: String(title).substring(0, 40),
      body: String(body).substring(0, 100),
      data,
      priority,
      channelId,
    };
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    console.log(`[PushService] Dispatched remote push notification to ${toToken}`);
  } catch (err) {
    console.warn('[PushService] Remote push dispatch note:', err.message);
  }
};

/**
 * Fetch and clear pending queued messages for this user (e.g. sent while app was minimized/offline)
 * Once fetched, immediately removed from server relay queue for zero-storage privacy.
 * Processes offline deletion commands and delivery/read ACKs before returning chat messages.
 */
export const fetchAndClearPendingMessages = async (myHandle) => {
  if (!myHandle) return [];
  const clean = myHandle.replace('@', '').trim().toLowerCase();

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('receiver', clean)
      .neq('type', 'contact_req')
      .neq('type', 'contact_accepted')
      .neq('type', 'call_req')
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) return [];

    const chatMessages = [];
    const idsToDelete = [];

    for (const row of data) {
      idsToDelete.push(row.id);

      if (row.type === 'delete_cmd') {
        try {
          const payload = typeof row.body === 'string' ? JSON.parse(row.body) : row.body;
          if (payload?.messageIds && payload.messageIds.length > 0) {
            await deleteMessagesBatch(payload.messageIds);
          }
        } catch (e) {
          console.warn('Process offline delete_cmd error:', e);
        }
      } else if (row.type === 'ack_delivered') {
        try {
          const payload = typeof row.body === 'string' ? JSON.parse(row.body) : row.body;
          if (payload?.conversationId) {
            await markSentMessagesDelivered(payload.conversationId, clean);
          }
        } catch (e) {
          console.warn('Process offline ack_delivered error:', e);
        }
      } else if (row.type === 'ack_seen') {
        try {
          const payload = typeof row.body === 'string' ? JSON.parse(row.body) : row.body;
          if (payload?.conversationId) {
            await markSentMessagesRead(payload.conversationId, clean);
          }
        } catch (e) {
          console.warn('Process offline ack_seen error:', e);
        }
      } else {
        chatMessages.push(row);
      }
    }

    // Immediately remove ALL retrieved rows from server relay queue (ZERO-STORAGE)
    if (idsToDelete.length > 0) {
      await supabase.from('messages').delete().in('id', idsToDelete);
    }

    return chatMessages;
  } catch (err) {
    console.log('fetchAndClearPendingMessages notice:', err.message);
    return [];
  }
};

/**
 * Fetch latest pending incoming call invite for this user (if sent in the last 35 seconds)
 */
export const fetchPendingCallInvite = async (myHandle) => {
  if (!myHandle) return null;
  const clean = myHandle.replace('@', '').trim().toLowerCase();
  try {
    const cutoff = Date.now() - 35000;
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('receiver', clean)
      .eq('type', 'call_req')
      .gt('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return null;
    const row = data[0];
    const parsed = typeof row.body === 'string' ? JSON.parse(row.body) : row.body;
    if (Date.now() - (parsed.timestamp || Number(row.created_at) || new Date(row.created_at).getTime()) < 35000) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.log('fetchPendingCallInvite notice:', err.message);
    return null;
  }
};

/**
 * Clear durable call invite from server relay queue once handled
 */
export const clearPendingCallInvite = async (callId) => {
  if (!callId) return;
  try {
    await supabase.from('messages').delete().eq('id', `call_req_${callId}`);
  } catch (_) {}
};

/**
 * Broadcast typing status to the conversation room
 */
export const broadcastTypingStatus = async (conversationId, senderHandle, isTyping) => {
  try {
    const roomChannel = supabase.getChannels().find((c) => c.topic === `realtime:room_${conversationId}`);
    if (roomChannel) {
      roomChannel.send({
        type: 'broadcast',
        event: 'typing_status',
        payload: {
          sender: senderHandle,
          isTyping: !!isTyping,
        },
      });
    }
  } catch (_) {}
};

/**
 * Fetch messages for a conversation
 * ZERO-STORAGE POLICY: Messages are not stored on remote server
 */
export const fetchMessagesFromSupabase = async () => {
  return [];
};

export const subscribeToConversation = (conversationId, onNewMessage, onSecurityEvent) => {
  const channelName = `room_${conversationId}`;

  // Clean up any stale channel with the same topic to prevent "already subscribed" collisions
  const existing = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`);
  if (existing) {
    try {
      supabase.removeChannel(existing);
    } catch (_) {}
  }

  const channel = supabase
    .channel(channelName, {
      config: {
        broadcast: { ack: true },
      },
    })
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        try {
          if (payload?.new && payload.new.conversation_id === conversationId) {
            onNewMessage(payload.new);
          }
        } catch (_) {}
      }
    )
    .on('broadcast', { event: 'new_message' }, ({ payload }) => {
      try {
        if (payload && payload.conversation_id === conversationId) {
          onNewMessage(payload);
        }
      } catch (_) {}
    })
    .on('broadcast', { event: 'screenshot_request' }, ({ payload }) => {
      try {
        if (onSecurityEvent) {
          onSecurityEvent({ event: 'screenshot_request', ...payload });
        }
      } catch (_) {}
    })
    .on('broadcast', { event: 'screenshot_response' }, ({ payload }) => {
      try {
        if (onSecurityEvent) {
          onSecurityEvent({ event: 'screenshot_response', ...payload });
        }
      } catch (_) {}
    })
    .on('broadcast', { event: 'screenshot_taken' }, ({ payload }) => {
      try {
        if (onSecurityEvent) {
          onSecurityEvent({ event: 'screenshot_taken', ...payload });
        }
      } catch (_) {}
    })
    .on('broadcast', { event: 'typing_status' }, ({ payload }) => {
      try {
        if (onSecurityEvent) {
          onSecurityEvent({ event: 'typing_status', ...payload });
        }
      } catch (_) {}
    })
    .on('broadcast', { event: 'messages_seen' }, ({ payload }) => {
      try {
        if (onSecurityEvent) {
          onSecurityEvent({ event: 'messages_seen', ...payload });
        }
      } catch (_) {}
    })
    .on('broadcast', { event: 'messages_delivered' }, ({ payload }) => {
      try {
        if (onSecurityEvent) {
          onSecurityEvent({ event: 'messages_delivered', ...payload });
        }
      } catch (_) {}
    })
    .on('broadcast', { event: 'delete_messages' }, ({ payload }) => {
      try {
        if (onSecurityEvent) {
          onSecurityEvent({ event: 'delete_messages', payload });
        }
      } catch (_) {}
    })
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch (_) {}
  };
};

// ─── Singleton Global Realtime Presence Manager ────────────────────────────────
// Guarantees ONE channel instance, NO "cannot add presence after subscribe" errors,
// and continuous online status across the entire app.

let globalPresenceChannel = null;
let currentTrackedHandle = null;
let globalPresenceState = {};
const globalLastSeenMap = {}; // { [handle]: timestamp }
const presenceSubscribers = new Set(); // Set of callback functions: ({ allPresences, lastSeenMap }) => void

const notifyPresenceSubscribers = () => {
  for (const sub of presenceSubscribers) {
    try {
      sub({
        allPresences: globalPresenceState,
        lastSeenMap: globalLastSeenMap,
      });
    } catch (e) {
      console.warn('Presence subscriber callback error:', e);
    }
  }
};

/**
 * Initializes the singleton global presence channel once.
 */
export const initGlobalPresence = (myHandle) => {
  if (!myHandle) return;
  const cleanMy = myHandle.replace('@', '').trim().toLowerCase();

  // If already tracking this exact handle, don't recreate
  if (globalPresenceChannel && currentTrackedHandle === cleanMy) {
    return;
  }

  // If handle changed, clean up previous
  if (globalPresenceChannel) {
    try {
      globalPresenceChannel.untrack();
      supabase.removeChannel(globalPresenceChannel);
    } catch (_) {}
    globalPresenceChannel = null;
  }

  currentTrackedHandle = cleanMy;

  try {
    const channel = supabase.channel('global_user_presence', {
      config: {
        presence: { key: cleanMy },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        try {
          globalPresenceState = channel.presenceState();
          notifyPresenceSubscribers();
        } catch (err) {
          console.warn('Presence sync error:', err);
        }
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        try {
          globalPresenceState = channel.presenceState();
          notifyPresenceSubscribers();
        } catch (err) {
          console.warn('Presence join error:', err);
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        try {
          if (key) {
            globalLastSeenMap[key.toLowerCase()] = Date.now();
          }
          globalPresenceState = channel.presenceState();
          notifyPresenceSubscribers();
        } catch (err) {
          console.warn('Presence leave error:', err);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({
              online_at: new Date().toISOString(),
              user: cleanMy,
            });
          } catch (tErr) {
            console.log('Presence track notice:', tErr?.message);
          }
        }
      });

    globalPresenceChannel = channel;
  } catch (err) {
    console.warn('Init presence error:', err);
  }
};

/**
 * App-wide Global Presence subscription:
 * - Does NOT create duplicate channels.
 * - Does NOT call .on() after subscribe.
 * - Immediately fires with current presence state.
 * - Safely removes only the caller's listener on unmount.
 */
export const subscribeToGlobalPresence = (myHandle, partnerHandle, onPresenceUpdate) => {
  if (!myHandle) return () => {};

  const cleanPartner = partnerHandle ? partnerHandle.replace('@', '').trim().toLowerCase() : null;

  // Ensure global channel is active
  initGlobalPresence(myHandle);

  const subscriberCallback = ({ allPresences, lastSeenMap }) => {
    if (!onPresenceUpdate) return;
    if (cleanPartner) {
      const partnerPresences = allPresences?.[cleanPartner];
      const isOnline = !!(partnerPresences && partnerPresences.length > 0);
      const lastSeen = isOnline ? null : (lastSeenMap?.[cleanPartner] || null);
      onPresenceUpdate({ isOnline, lastSeen, allPresences, lastSeenMap });
    } else {
      onPresenceUpdate({ allPresences, lastSeenMap });
    }
  };

  // Add listener
  presenceSubscribers.add(subscriberCallback);

  // Immediately notify with current known state
  try {
    subscriberCallback({
      allPresences: globalPresenceState,
      lastSeenMap: globalLastSeenMap,
    });
  } catch (_) {}

  // Cleanup: only removes this subscriber, channel stays open for the app
  return () => {
    presenceSubscribers.delete(subscriberCallback);
  };
};

/**
 * Mark messages in a conversation as seen in real-time
 */
export const markMessagesSeenInSupabase = async (conversationId, viewerHandle, partnerHandle = null) => {
  const cleanViewer = viewerHandle ? viewerHandle.replace('@', '').trim().toLowerCase() : '';
  const cleanPartner = partnerHandle ? partnerHandle.replace('@', '').trim().toLowerCase() : '';

  try {
    const roomChannel = supabase.getChannels().find((c) => c.topic === `realtime:room_${conversationId}`);
    if (roomChannel) {
      roomChannel.send({
        type: 'broadcast',
        event: 'messages_seen',
        payload: { viewerHandle: cleanViewer, conversationId, seenAt: Date.now() },
      });
    }
    if (cleanPartner) {
      const userChannel = supabase.getChannels().find((c) => c.topic === `realtime:user_${cleanPartner}`);
      if (userChannel) {
        userChannel.send({
          type: 'broadcast',
          event: 'messages_seen',
          payload: { viewerHandle: cleanViewer, conversationId, seenAt: Date.now() },
        });
      }
      // Ephemeral ACK row for partner in case they are offline
      supabase.from('messages').insert({
        id: `ack_seen_${conversationId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'ack_seen',
        sender: cleanViewer,
        receiver: cleanPartner,
        body: JSON.stringify({ conversationId }),
        created_at: Date.now(),
      }).then(() => {}).catch(() => {});
    }
  } catch (err) {
    console.log('Seen broadcast error:', err.message);
  }
};

/**
 * Mark messages in a conversation as delivered in real-time
 */
export const markMessagesDeliveredInSupabase = async (conversationId, receiverHandle, partnerHandle = null) => {
  const cleanReceiver = receiverHandle ? receiverHandle.replace('@', '').trim().toLowerCase() : '';
  const cleanPartner = partnerHandle ? partnerHandle.replace('@', '').trim().toLowerCase() : '';

  try {
    const roomChannel = supabase.getChannels().find((c) => c.topic === `realtime:room_${conversationId}`);
    if (roomChannel) {
      roomChannel.send({
        type: 'broadcast',
        event: 'messages_delivered',
        payload: { receiverHandle: cleanReceiver, conversationId, deliveredAt: Date.now() },
      });
    }
    if (cleanPartner) {
      const userChannel = supabase.getChannels().find((c) => c.topic === `realtime:user_${cleanPartner}`);
      if (userChannel) {
        userChannel.send({
          type: 'broadcast',
          event: 'messages_delivered',
          payload: { receiverHandle: cleanReceiver, conversationId, deliveredAt: Date.now() },
        });
      }
      // Ephemeral ACK row for partner in case they are offline
      supabase.from('messages').insert({
        id: `ack_deliv_${conversationId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'ack_delivered',
        sender: cleanReceiver,
        receiver: cleanPartner,
        body: JSON.stringify({ conversationId }),
        created_at: Date.now(),
      }).then(() => {}).catch(() => {});
    }
  } catch (err) {
    console.log('Delivered broadcast error:', err.message);
  }
};

/**
 * Broadcast message deletion in real-time and post ephemeral tombstone
 */
export const broadcastMessageDelete = async (conversationId, messageIds, partnerHandle = null) => {
  if (!messageIds || messageIds.length === 0) return;
  const cleanPartner = partnerHandle ? partnerHandle.replace('@', '').trim().toLowerCase() : null;

  try {
    const roomChannel = supabase.getChannels().find((c) => c.topic === `realtime:room_${conversationId}`);
    if (roomChannel) {
      roomChannel.send({
        type: 'broadcast',
        event: 'delete_messages',
        payload: { messageIds, conversationId },
      });
    }
    if (cleanPartner) {
      const userChannel = supabase.getChannels().find((c) => c.topic === `realtime:user_${cleanPartner}`);
      if (userChannel) {
        userChannel.send({
          type: 'broadcast',
          event: 'delete_messages',
          payload: { messageIds, conversationId },
        });
      }
      // Ephemeral deletion command for offline partner
      supabase.from('messages').insert({
        id: `del_cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'delete_cmd',
        sender: 'system',
        receiver: cleanPartner,
        body: JSON.stringify({ conversationId, messageIds }),
        created_at: Date.now(),
      }).then(() => {}).catch(() => {});
    }
    // Permanently remove from Supabase
    await supabase
      .from('messages')
      .delete()
      .in('id', messageIds);
  } catch (err) {
    console.log('Delete broadcast notice:', err.message);
  }
};

/**
 * Permanently delete all messages for a single conversation in Supabase
 */
export const deleteConversationFromSupabase = async (conversationId) => {
  if (!conversationId) return;
  try {
    const parts = conversationId.replace(/^conv_/, '').split('_');
    if (parts.length >= 2) {
      await supabase
        .from('messages')
        .delete()
        .in('sender', parts)
        .in('receiver', parts);
    }
  } catch (err) {
    console.warn('deleteConversationFromSupabase note:', err.message);
  }
};

/**
 * Permanently delete all messages for multiple conversations in Supabase
 */
export const deleteConversationsBatchFromSupabase = async (conversationIds) => {
  if (!conversationIds || conversationIds.length === 0) return;
  try {
    for (const cid of conversationIds) {
      await deleteConversationFromSupabase(cid);
    }
  } catch (err) {
    console.warn('deleteConversationsBatchFromSupabase note:', err.message);
  }
};

// ─── Singleton User Message & Event Channel Manager ───────────────────────────
let myMessagesChannel = null;
let currentMyMessagesHandle = null;
const incomingMessageListeners = new Set();
const messageStatusListeners = new Set();

const notifyIncomingMessageListeners = (msg) => {
  for (const listener of incomingMessageListeners) {
    try {
      listener(msg);
    } catch (e) {
      console.warn('Incoming message listener error:', e);
    }
  }
};

const notifyMessageStatusListeners = (statusEvent) => {
  for (const listener of messageStatusListeners) {
    try {
      listener(statusEvent);
    } catch (e) {
      console.warn('Message status listener error:', e);
    }
  }
};

/**
 * Realtime subscription for incoming messages sent to this user handle.
 * Uses singleton channel management so multiple screens can subscribe without tearing down each other's channel.
 */
export const subscribeToMyMessages = (myHandle, onIncomingMessage, onMessageStatusEvent = null) => {
  if (!myHandle) return () => {};
  const clean = myHandle.replace('@', '').trim().toLowerCase();
  const channelName = `user_${clean}`;

  if (onIncomingMessage) incomingMessageListeners.add(onIncomingMessage);
  if (onMessageStatusEvent) messageStatusListeners.add(onMessageStatusEvent);

  // If already tracking this exact handle, keep channel alive
  if (myMessagesChannel && currentMyMessagesHandle === clean) {
    return () => {
      if (onIncomingMessage) incomingMessageListeners.delete(onIncomingMessage);
      if (onMessageStatusEvent) messageStatusListeners.delete(onMessageStatusEvent);
    };
  }

  // If handle changed, remove old channel
  if (myMessagesChannel) {
    try {
      supabase.removeChannel(myMessagesChannel);
    } catch (_) {}
    myMessagesChannel = null;
  }

  currentMyMessagesHandle = clean;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        try {
          if (payload?.new && payload.new.receiver?.toLowerCase() === clean) {
            // Check if this is a durable acceptance confirmation
            if (payload.new.type === 'contact_accepted' || payload.new.conversation_id === `contact_accepted_${clean}`) {
              try {
                const bodyObj = JSON.parse(payload.new.body);
                notifyMessageStatusListeners({
                  event: 'connection_request_accepted',
                  ...bodyObj,
                });
                // Delete from relay queue immediately
                supabase.from('messages').delete().eq('id', payload.new.id).then(() => {}).catch(() => {});
              } catch (_) {}
              return;
            }

            // Check if this is an incoming connection request
            if (payload.new.type === 'contact_req' || payload.new.conversation_id === `contact_req_${clean}`) {
              try {
                const bodyObj = JSON.parse(payload.new.body);
                notifyMessageStatusListeners({
                  event: 'incoming_connection_request',
                  fromHandle: payload.new.sender,
                  fromNickname: bodyObj.senderNickname || payload.new.sender,
                  fromAvatar: bodyObj.senderAvatar || 'avatar_rose',
                  reqId: payload.new.id,
                });
              } catch (_) {}
              return;
            }

            // Check if this is an incoming call invitation
            if (payload.new.type === 'call_req' || payload.new.conversation_id === `call_req_${clean}`) {
              try {
                const bodyObj = JSON.parse(payload.new.body);
                // Check if call invite is still recent (< 35 seconds old)
                if (Date.now() - (bodyObj.timestamp || 0) < 35000) {
                  notifyMessageStatusListeners({
                    event: 'incoming_call',
                    ...bodyObj,
                  });
                }
              } catch (_) {}
              return;
            }

            notifyIncomingMessageListeners(payload.new);
          }
        } catch (_) {}
      }
    )
    .on('broadcast', { event: 'incoming_msg' }, ({ payload }) => {
      try {
        if (payload && payload.receiver?.toLowerCase() === clean) {
          notifyIncomingMessageListeners(payload);
        }
      } catch (_) {}
    })
    .on('broadcast', { event: 'messages_seen' }, ({ payload }) => {
      try {
        notifyMessageStatusListeners({ event: 'messages_seen', ...payload });
      } catch (_) {}
    })
    .on('broadcast', { event: 'messages_delivered' }, ({ payload }) => {
      try {
        notifyMessageStatusListeners({ event: 'messages_delivered', ...payload });
      } catch (_) {}
    })
    .on('broadcast', { event: 'delete_messages' }, ({ payload }) => {
      try {
        notifyMessageStatusListeners({ event: 'delete_messages', ...payload });
      } catch (_) {}
    })
    .on('broadcast', { event: 'incoming_connection_request' }, ({ payload }) => {
      try {
        notifyMessageStatusListeners({ event: 'incoming_connection_request', ...payload });
      } catch (_) {}
    })
    .on('broadcast', { event: 'connection_request_accepted' }, ({ payload }) => {
      try {
        notifyMessageStatusListeners({ event: 'connection_request_accepted', ...payload });
      } catch (_) {}
    })
    .subscribe();

  myMessagesChannel = channel;

  return () => {
    if (onIncomingMessage) incomingMessageListeners.delete(onIncomingMessage);
    if (onMessageStatusEvent) messageStatusListeners.delete(onMessageStatusEvent);
  };
};

/**
 * Send a chat/connection request to a handle
 */
export const sendConnectionRequest = async ({ fromHandle, toHandle, fromNickname, fromAvatar }) => {
  const cleanFrom = fromHandle.replace('@', '').trim().toLowerCase();
  const cleanTo = toHandle.replace('@', '').trim().toLowerCase();

  if (cleanFrom === cleanTo) {
    throw new Error("You cannot send a connection request to yourself.");
  }

  const reqId = `req_${cleanFrom}_${cleanTo}`;
  const payloadData = {
    type: 'connection_request',
    status: 'pending',
    senderNickname: fromNickname || cleanFrom,
    senderAvatar: fromAvatar || 'avatar_rose',
    sentAt: Date.now(),
  };

  // 1. Persist request in Supabase
  const { data, error } = await supabase
    .from('messages')
    .upsert(
      {
        id: reqId,
        type: 'contact_req',
        sender: cleanFrom,
        receiver: cleanTo,
        body: JSON.stringify(payloadData),
        created_at: Date.now(),
      },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (error) {
    if (error.code === '42501') {
      console.error('[ConnectionRequest] Supabase RLS error:', error.message);
      throw new Error("Supabase security policy blocked the request. Please run: ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY; in your Supabase SQL editor.");
    }
    throw error;
  }

  // 2. Persist permanent connection record in Supabase so chat is never removed
  const participants = [cleanFrom, cleanTo].sort();
  const connId = `conn_${participants[0]}_${participants[1]}`;
  supabase
    .from('messages')
    .upsert({
      id: connId,
      type: 'connection',
      sender: cleanFrom,
      receiver: cleanTo,
      body: JSON.stringify({ status: 'connected', initiatedBy: cleanFrom, timestamp: Date.now() }),
      created_at: Date.now(),
    })
    .then(() => {})
    .catch(() => {});

  // 3. Ensure local SQLite contact & conversation exist immediately so chat is never missing
  try {
    const contactId = `contact_${cleanTo}`;
    await insertContact({
      id: contactId,
      handle: cleanTo,
      nickname: fromNickname || cleanTo,
      avatarId: fromAvatar || 'avatar_rose',
    });
    await upsertConversation({
      id: `chat_${participants[0]}_${participants[1]}`,
      contactId,
      lastMsg: 'Chat request sent 💌',
      lastTime: Date.now(),
      unread: 0,
    });
  } catch (_) {}

  // 4. Broadcast realtime notice to recipient
  try {
    let userChannel = supabase.getChannels().find((c) => c.topic === `realtime:user_${cleanTo}`);
    if (!userChannel) {
      userChannel = supabase.channel(`user_${cleanTo}`);
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 1200);
        userChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timer);
            resolve();
          }
        });
      });
    }
    await userChannel.send({
      type: 'broadcast',
      event: 'incoming_connection_request',
      payload: {
        fromHandle: cleanFrom,
        fromNickname,
        fromAvatar,
        reqId,
      },
    });
  } catch (bErr) {
    console.log('Request broadcast notice:', bErr.message);
  }

  // 3. Remote Push Notification to recipient's phone via Expo/FCM
  getUserPushToken(cleanTo)
    .then((token) => {
      if (token) {
        sendExpoPushNotification({
          toToken: token,
          title: 'New Connection Request 💌',
          body: `${fromNickname || ('@' + cleanFrom)} wants to connect with you!`,
          channelId: 'requests_sound_v1',
          priority: 'high',
          data: {
            type: 'request',
            fromHandle: cleanFrom,
            fromNickname: fromNickname || cleanFrom,
          },
        });
      }
    })
    .catch(() => {});

  return data;
};

/**
 * Fetch all pending connection requests received by this handle
 */
export const fetchPendingConnectionRequests = async (myHandle) => {
  if (!myHandle) return [];
  const clean = myHandle.replace('@', '').trim().toLowerCase();

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('receiver', clean)
    .eq('type', 'contact_req')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('fetchPendingConnectionRequests error:', error.message);
    return [];
  }

  return (data || [])
    .map((row) => {
      try {
        const bodyObj = JSON.parse(row.body);
        return {
          id: row.id,
          sender: row.sender,
          receiver: row.receiver,
          nickname: bodyObj.senderNickname || row.sender,
          avatar: bodyObj.senderAvatar || 'avatar_rose',
          sentAt: row.created_at,
          status: bodyObj.status || 'pending',
        };
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
};

/**
 * Fetch all outgoing connection requests sent by this handle
 */
export const fetchSentConnectionRequests = async (myHandle) => {
  if (!myHandle) return [];
  const clean = myHandle.replace('@', '').trim().toLowerCase();

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('sender', clean)
    .eq('type', 'contact_req')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('fetchSentConnectionRequests error:', error.message);
    return [];
  }

  return (data || [])
    .map((row) => {
      try {
        const bodyObj = JSON.parse(row.body);
        return {
          id: row.id,
          sender: row.sender,
          receiver: row.receiver,
          sentAt: row.created_at,
          status: bodyObj.status || 'pending',
        };
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
};

/**
 * Fetch and process durable acceptance receipts sent to this handle
 */
export const fetchAndProcessPendingAcceptances = async (myHandle) => {
  if (!myHandle) return [];
  const clean = myHandle.replace('@', '').trim().toLowerCase();

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('receiver', clean)
      .eq('type', 'contact_accepted');

    if (error || !data || data.length === 0) return [];

    const processed = [];
    for (const row of data) {
      try {
        const bodyObj = JSON.parse(row.body);
        processed.push({
          id: row.id,
          byHandle: bodyObj.byHandle || row.sender,
          byNickname: bodyObj.byNickname || row.sender,
          byAvatar: bodyObj.byAvatar || 'avatar_rose',
        });
      } catch (_) {}
    }

    // Immediately remove from server relay queue (zero-storage)
    const ids = data.map((r) => r.id);
    await supabase.from('messages').delete().in('id', ids);

    return processed;
  } catch (err) {
    console.log('fetchAndProcessPendingAcceptances notice:', err.message);
    return [];
  }
};

/**
 * Accept a connection request
 */
export const acceptConnectionRequest = async ({ reqId, fromHandle, toHandle, myNickname, myAvatar }) => {
  const cleanFrom = fromHandle.replace('@', '').trim().toLowerCase();
  const cleanTo = toHandle.replace('@', '').trim().toLowerCase();

  // 1. Store durable acceptance receipt in Supabase for the sender
  const acceptId = `acc_${cleanTo}_${cleanFrom}_${Date.now()}`;
  try {
    await supabase.from('messages').insert({
      id: acceptId,
      type: 'contact_accepted',
      sender: cleanTo,
      receiver: cleanFrom,
      body: JSON.stringify({
        type: 'connection_request_accepted',
        status: 'accepted',
        byHandle: cleanTo,
        byNickname: myNickname || cleanTo,
        byAvatar: myAvatar || 'avatar_rose',
        acceptedAt: Date.now(),
      }),
      created_at: Date.now(),
    });
  } catch (err) {
    console.warn('[acceptConnectionRequest] Durable receipt note:', err.message);
  }

  // 2. Persist permanent connection record in Supabase so neither user is EVER asked to connect again
  const participants = [cleanFrom, cleanTo].sort();
  const connId = `conn_${participants[0]}_${participants[1]}`;
  supabase
    .from('messages')
    .upsert({
      id: connId,
      type: 'connection',
      sender: cleanTo,
      receiver: cleanFrom,
      body: JSON.stringify({ status: 'connected', acceptedBy: cleanTo, timestamp: Date.now() }),
      created_at: Date.now(),
    })
    .then(() => {})
    .catch(() => {});

  // 3. Ensure local SQLite contact & conversation exist
  try {
    const contactId = `contact_${cleanFrom}`;
    await insertContact({
      id: contactId,
      handle: cleanFrom,
      nickname: cleanFrom,
      avatarId: 'avatar_rose',
    });
    await upsertConversation({
      id: `chat_${participants[0]}_${participants[1]}`,
      contactId,
      lastMsg: 'Connected! Say hi 💕',
      lastTime: Date.now(),
      unread: 0,
    });
  } catch (_) {}

  // 4. Remove the pending request from Supabase
  if (reqId) {
    await supabase.from('messages').delete().eq('id', reqId);
  }
  await supabase
    .from('messages')
    .delete()
    .eq('type', 'contact_req')
    .eq('receiver', cleanTo)
    .eq('sender', cleanFrom);

  // 5. Broadcast realtime acceptance to sender's user channel
  try {
    let userChannel = supabase.getChannels().find((c) => c.topic === `realtime:user_${cleanFrom}`);
    if (!userChannel) {
      userChannel = supabase.channel(`user_${cleanFrom}`);
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 1200);
        userChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timer);
            resolve();
          }
        });
      });
    }
    await userChannel.send({
      type: 'broadcast',
      event: 'connection_request_accepted',
      payload: {
        byHandle: cleanTo,
        byNickname: myNickname || cleanTo,
        byAvatar: myAvatar || 'avatar_rose',
      },
    });
  } catch (bErr) {
    console.log('Acceptance broadcast notice:', bErr.message);
  }

  return true;
};

/**
 * Decline/cancel a connection request
 */
export const declineConnectionRequest = async (reqId) => {
  if (!reqId) return;
  const { error } = await supabase.from('messages').delete().eq('id', reqId);
  if (error) {
    console.warn('declineConnectionRequest error:', error.message);
  }
  return true;
};

/**
 * Check connection relationship between two handles
 * Returns: { status: 'self' | 'connected' | 'pending_sent' | 'pending_received' | 'none', contact?, reqId? }
 */
export const checkConnectionStatus = async (myHandle, targetHandle) => {
  if (!myHandle || !targetHandle) return { status: 'none' };
  const cleanMy = myHandle.replace('@', '').trim().toLowerCase();
  const cleanTarget = targetHandle.replace('@', '').trim().toLowerCase();

  if (cleanMy === cleanTarget) return { status: 'self' };

  // 1. Check local SQLite contacts first
  try {
    const localContact = await getContactByHandle(cleanTarget);
    if (localContact) {
      return { status: 'connected', contact: localContact };
    }
  } catch (_) {}

  // 2. Check local SQLite conversations or messages
  try {
    const isConn = await isConversationOrContactConnected(cleanMy, cleanTarget);
    if (isConn) {
      const contact = {
        handle: cleanTarget,
        nickname: cleanTarget,
        avatar_id: 'avatar_rose',
      };
      return { status: 'connected', contact };
    }
  } catch (_) {}

  // 3. Check permanent connection record in Supabase (type: 'connection')
  try {
    const participants = [cleanMy, cleanTarget].sort();
    const connId = `conn_${participants[0]}_${participants[1]}`;
    const { data: permConn } = await supabase
      .from('messages')
      .select('id, body')
      .eq('id', connId)
      .maybeSingle();

    if (permConn) {
      // Auto-heal local SQLite
      const contactId = `contact_${cleanTarget}`;
      await insertContact({
        id: contactId,
        handle: cleanTarget,
        nickname: cleanTarget,
        avatarId: 'avatar_rose',
      });
      await upsertConversation({
        id: `chat_${participants[0]}_${participants[1]}`,
        contactId,
        lastMsg: 'Connected! Say hi 💕',
        lastTime: Date.now(),
        unread: 0,
      });
      return {
        status: 'connected',
        contact: { handle: cleanTarget, nickname: cleanTarget, avatar_id: 'avatar_rose' },
      };
    }
  } catch (_) {}

  // 4. Check if cleanTarget sent a pending request to cleanMy
  try {
    const { data: incoming } = await supabase
      .from('messages')
      .select('id, body, sender')
      .eq('receiver', cleanMy)
      .eq('type', 'contact_req')
      .eq('sender', cleanTarget)
      .maybeSingle();

    if (incoming) {
      return { status: 'pending_received', reqId: incoming.id };
    }
  } catch (_) {}

  // 5. Check if cleanMy sent a pending request to cleanTarget
  try {
    const { data: outgoing } = await supabase
      .from('messages')
      .select('id, body')
      .eq('sender', cleanMy)
      .eq('receiver', cleanTarget)
      .eq('type', 'contact_req')
      .maybeSingle();

    if (outgoing) {
      return { status: 'pending_sent', reqId: outgoing.id };
    }
  } catch (_) {}

  return { status: 'none' };
};

/**
 * Send real-time screenshot request to partner in a conversation
 */
export const requestScreenshotPermission = async (conversationId, requesterHandle, requesterNickname) => {
  try {
    const roomChannel = supabase.getChannels().find((c) => c.topic === `realtime:room_${conversationId}`);
    if (roomChannel) {
      roomChannel.send({
        type: 'broadcast',
        event: 'screenshot_request',
        payload: { requesterHandle, requesterNickname, timestamp: Date.now() },
      });
    }
  } catch (err) {
    console.warn('Screenshot request notice:', err.message);
  }
};

/**
 * Send real-time approval/denial of screenshot request to partner
 */
export const respondScreenshotPermission = async (conversationId, responderHandle, approved, durationSeconds = 60) => {
  try {
    const roomChannel = supabase.getChannels().find((c) => c.topic === `realtime:room_${conversationId}`);
    if (roomChannel) {
      roomChannel.send({
        type: 'broadcast',
        event: 'screenshot_response',
        payload: { responderHandle, approved, durationSeconds, timestamp: Date.now() },
      });
    }
  } catch (err) {
    console.warn('Screenshot response notice:', err.message);
  }
};

/**
 * Notify partner when a screenshot is taken (with permission or attempted)
 */
export const notifyScreenshotTaken = async (conversationId, actorHandle) => {
  try {
    const roomChannel = supabase.getChannels().find((c) => c.topic === `realtime:room_${conversationId}`);
    if (roomChannel) {
      roomChannel.send({
        type: 'broadcast',
        event: 'screenshot_taken',
        payload: { actorHandle, timestamp: Date.now() },
      });
    }
  } catch (err) {
    console.warn('Screenshot taken notify notice:', err.message);
  }
};
