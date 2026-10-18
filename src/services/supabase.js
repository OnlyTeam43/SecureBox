// src/services/supabase.js
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SUPABASE_URL = 'https://yuxivpghynubmuqwqrhr.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1eGl2cGdoeW51Ym11cXdxcmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNDgyNDEsImV4cCI6MjEwNzgyNDI0MX0.r_DxN6RXt84PzFXcWzD5S9X_qo9_utTmR0c3BmOMYvU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Register or update user handle, phone & nickname in Supabase
 */
export const registerUserInSupabase = async ({ handle, nickname, avatarId, mobileNumber, password }) => {
  const cleanHandle = handle.replace('@', '').trim().toLowerCase();
  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        handle: cleanHandle,
        nickname: nickname.trim(),
        avatar_id: avatarId,
        mobile_number: mobileNumber?.trim() || null,
        password: password,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'handle' }
    )
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
    .select('id, handle, nickname, avatar_id')
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
 * Send message in real-time purely via WebSocket broadcast
 * ZERO-STORAGE POLICY: Messages are NEVER saved into Supabase database.
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
  const payload = {
    id,
    conversation_id: conversationId,
    sender,
    receiver,
    body,
    media_uri: mediaUri || null,
    sent_at: sentAt,
    expires_at: expiresAt || null,
    reply_to: replyTo || null,
  };

  const receiverClean = receiver ? receiver.replace('@', '').trim().toLowerCase() : '';

  // 1. Direct instantaneous delivery to the active chat room via WebSocket broadcast
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
      payload,
    });
  } catch (err) {
    console.warn('Room broadcast error:', err);
  }

  // 2. Direct delivery to the partner's inbox channel via WebSocket broadcast
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
        payload,
      });
    } catch (err) {
      console.warn('User broadcast error:', err);
    }
  }

  // NEVER STORE CHAT MESSAGES ON SUPABASE!
  // All messages live exclusively in the user's local device storage.
  return payload;
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
  try {
    const roomChannel = supabase.getChannels().find((c) => c.topic === `realtime:room_${conversationId}`);
    if (roomChannel) {
      roomChannel.send({
        type: 'broadcast',
        event: 'messages_seen',
        payload: { viewerHandle, conversationId, seenAt: Date.now() },
      });
    }
    if (partnerHandle) {
      const clean = partnerHandle.replace('@', '').trim().toLowerCase();
      const userChannel = supabase.getChannels().find((c) => c.topic === `realtime:user_${clean}`);
      if (userChannel) {
        userChannel.send({
          type: 'broadcast',
          event: 'messages_seen',
          payload: { viewerHandle, conversationId, seenAt: Date.now() },
        });
      }
    }
  } catch (err) {
    console.log('Seen broadcast error:', err.message);
  }
};

/**
 * Mark messages in a conversation as delivered in real-time
 */
export const markMessagesDeliveredInSupabase = async (conversationId, receiverHandle, partnerHandle = null) => {
  try {
    const roomChannel = supabase.getChannels().find((c) => c.topic === `realtime:room_${conversationId}`);
    if (roomChannel) {
      roomChannel.send({
        type: 'broadcast',
        event: 'messages_delivered',
        payload: { receiverHandle, conversationId, deliveredAt: Date.now() },
      });
    }
    if (partnerHandle) {
      const clean = partnerHandle.replace('@', '').trim().toLowerCase();
      const userChannel = supabase.getChannels().find((c) => c.topic === `realtime:user_${clean}`);
      if (userChannel) {
        userChannel.send({
          type: 'broadcast',
          event: 'messages_delivered',
          payload: { receiverHandle, conversationId, deliveredAt: Date.now() },
        });
      }
    }
  } catch (err) {
    console.log('Delivered broadcast error:', err.message);
  }
};

/**
 * Broadcast message deletion in real-time
 */
export const broadcastMessageDelete = async (conversationId, messageIds) => {
  try {
    const roomChannel = supabase.getChannels().find((c) => c.topic === `realtime:room_${conversationId}`);
    if (roomChannel) {
      roomChannel.send({
        type: 'broadcast',
        event: 'delete_messages',
        payload: { messageIds },
      });
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
  try {
    await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId);
  } catch (err) {
    console.warn('deleteConversationFromSupabase error:', err);
  }
};

/**
 * Permanently delete all messages for multiple conversations in Supabase
 */
export const deleteConversationsBatchFromSupabase = async (conversationIds) => {
  if (!conversationIds || conversationIds.length === 0) return;
  try {
    await supabase
      .from('messages')
      .delete()
      .in('conversation_id', conversationIds);
  } catch (err) {
    console.warn('deleteConversationsBatchFromSupabase error:', err);
  }
};

/**
 * Realtime subscription for incoming messages sent to this user handle
 */
export const subscribeToMyMessages = (myHandle, onIncomingMessage, onMessageStatusEvent = null) => {
  if (!myHandle) return () => {};
  const clean = myHandle.replace('@', '').trim().toLowerCase();
  const channelName = `user_${clean}`;

  const existing = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`);
  if (existing) {
    try {
      supabase.removeChannel(existing);
    } catch (_) {}
  }

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
            onIncomingMessage(payload.new);
          }
        } catch (_) {}
      }
    )
    .on('broadcast', { event: 'incoming_msg' }, ({ payload }) => {
      try {
        if (payload && payload.receiver?.toLowerCase() === clean) {
          onIncomingMessage(payload);
        }
      } catch (_) {}
    })
    .on('broadcast', { event: 'messages_seen' }, ({ payload }) => {
      try {
        if (onMessageStatusEvent) onMessageStatusEvent({ event: 'messages_seen', ...payload });
      } catch (_) {}
    })
    .on('broadcast', { event: 'messages_delivered' }, ({ payload }) => {
      try {
        if (onMessageStatusEvent) onMessageStatusEvent({ event: 'messages_delivered', ...payload });
      } catch (_) {}
    })
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch (_) {}
  };
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
