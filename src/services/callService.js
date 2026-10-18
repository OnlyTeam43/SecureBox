// src/services/callService.js
// Supabase Realtime calling signaling service for SecureBox

import { supabase } from './supabase';

let activeCallInfo = null;
let incomingCallCallback = null;
let activeCallListeners = new Map(); // callId -> Set of callback handlers
let userCallInboxChannel = null;
let currentSubscribedHandle = null;
let activeCallRoomChannel = null;

const clean = (h) => (h ? h.replace('@', '').trim().toLowerCase() : '');

/**
 * Initialize global incoming call receiver for the logged-in user.
 * Subscribes to a dedicated channel 'call_user_<handle>' that cannot collide with chat messages.
 * Safe to call multiple times — re-subscribes if the channel was dropped.
 */
export const initCallReceiver = (myHandle, onIncomingCall) => {
  if (!myHandle) return;
  const myClean = clean(myHandle);

  // Always update the callback so fresh closure is used
  incomingCallCallback = onIncomingCall;

  // If already subscribed to this handle's channel, just refresh the callback and return
  if (userCallInboxChannel && currentSubscribedHandle === myClean) {
    return;
  }

  // Tear down any stale subscription
  if (userCallInboxChannel) {
    try {
      supabase.removeChannel(userCallInboxChannel);
    } catch (_) {}
    userCallInboxChannel = null;
  }

  currentSubscribedHandle = myClean;
  const channelName = `call_user_${myClean}`;

  const channel = supabase.channel(channelName, {
    config: { broadcast: { ack: true } },
  });

  channel
    .on('broadcast', { event: 'call_invite' }, async ({ payload }) => {
      console.log('CallService: Received call_invite for callId:', payload?.callId, 'from:', payload?.callerHandle);
      await processIncomingCallPayload(payload);
    })
    .on('broadcast', { event: 'call_ended' }, ({ payload }) => {
      console.log('CallService: Received call_ended for callId:', payload?.callId);
      if (activeCallInfo && (!payload?.callId || activeCallInfo.callId === payload.callId)) {
        activeCallInfo = null;
      }
      if (payload?.callId) {
        notifyCallListeners(payload.callId, 'ended', payload);
      }
    })
    .subscribe((status) => {
      console.log(`CallService: Call inbox [${channelName}] status: ${status}`);
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        userCallInboxChannel = null;
        currentSubscribedHandle = null;
      }
    });

  userCallInboxChannel = channel;
};

/**
 * Universally process an incoming call payload (from Realtime broadcast or Postgres Changes)
 */
export const processIncomingCallPayload = async (payload) => {
  if (!payload || !payload.callId) return;
  const callerClean = clean(payload.callerHandle);
  if (callerClean === currentSubscribedHandle) return;

  // If user is already on another call, automatically respond busy
  if (activeCallInfo && activeCallInfo.status === 'connected') {
    callService.rejectCall(payload.callId, 'busy');
    return;
  }

  // Deduplicate: ignore if we already have this callId incoming
  if (activeCallInfo && activeCallInfo.callId === payload.callId) {
    console.log('CallService: Duplicate invite ignored for callId', payload.callId);
    callService.sendRinging(payload.callId);
    return;
  }

  activeCallInfo = {
    callId: payload.callId,
    partnerHandle: payload.callerHandle,
    partnerNickname: payload.callerNickname,
    partnerAvatarId: payload.callerAvatarId,
    callType: payload.callType || 'voice',
    status: 'incoming',
    isCaller: false,
    startTime: null,
  };

  // Automatically join the shared call room to receive ringing/cancel/end events
  await callService.joinCallRoom(payload.callId);

  // Notify caller that phone is ringing
  callService.sendRinging(payload.callId);

  if (incomingCallCallback) {
    incomingCallCallback(payload);
  }
};

const notifyCallListeners = (callId, eventType, data) => {
  const listeners = activeCallListeners.get(callId);
  if (listeners) {
    listeners.forEach((callback) => {
      try {
        callback(eventType, data);
      } catch (err) {
        console.warn('Call listener callback error:', err);
      }
    });
  }
};

export const callService = {
  /**
   * Joins the dedicated symmetric room for a specific call session.
   * Both caller and receiver participate in this room.
   */
  async joinCallRoom(callId) {
    if (activeCallRoomChannel) {
      try {
        supabase.removeChannel(activeCallRoomChannel);
      } catch (_) {}
      activeCallRoomChannel = null;
    }

    const roomName = `call_room_${callId}`;
    const channel = supabase.channel(roomName, {
      config: { broadcast: { ack: true } },
    });

    channel
      .on('broadcast', { event: 'call_ringing' }, ({ payload }) => {
        console.log('CallService: Received call_ringing');
        notifyCallListeners(callId, 'ringing', payload);
      })
      .on('broadcast', { event: 'call_accepted' }, ({ payload }) => {
        console.log('CallService: Received call_accepted');
        if (activeCallInfo && activeCallInfo.callId === callId) {
          activeCallInfo.status = 'connected';
          activeCallInfo.startTime = Date.now();
        }
        notifyCallListeners(callId, 'accepted', payload);
      })
      .on('broadcast', { event: 'call_rejected' }, ({ payload }) => {
        console.log('CallService: Received call_rejected');
        if (activeCallInfo && activeCallInfo.callId === callId) {
          activeCallInfo = null;
        }
        notifyCallListeners(callId, 'rejected', payload);
      })
      .on('broadcast', { event: 'call_ended' }, ({ payload }) => {
        console.log('CallService: Received call_ended');
        if (activeCallInfo && activeCallInfo.callId === callId) {
          activeCallInfo = null;
        }
        notifyCallListeners(callId, 'ended', payload);
      })
      .on('broadcast', { event: 'call_signal' }, ({ payload }) => {
        const sender = clean(payload?.senderHandle);
        const me = currentSubscribedHandle;
        if (!me || sender !== me) {
          notifyCallListeners(callId, 'signal', payload);
        }
      });

    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 3000);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer);
          resolve();
        }
      });
    });

    activeCallRoomChannel = channel;
    return channel;
  },

  /**
   * Initiate an outgoing call.
   * Sends invite with retry until 'call_ringing' is received (confirming receiver got it).
   */
  async startCall({ callerHandle, callerNickname, callerAvatarId, receiverHandle, callType = 'voice' }) {
    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const receiverClean = clean(receiverHandle);
    const callerClean = clean(callerHandle);

    if (callerClean) {
      currentSubscribedHandle = callerClean;
    }

    activeCallInfo = {
      callId,
      partnerHandle: receiverHandle,
      partnerNickname: '',
      partnerAvatarId: '',
      callType,
      status: 'calling',
      isCaller: true,
      startTime: null,
    };

    // 1. Join the shared call session room first (so we can detect 'ringing' confirmation)
    await this.joinCallRoom(callId);

    // Keep payload lightweight (<1KB): do not send 500KB raw base64 data over WebSocket signaling
    const sanitizedAvatarId =
      callerAvatarId && callerAvatarId.length < 100 && !callerAvatarId.startsWith('data:')
        ? callerAvatarId
        : null;

    const payload = {
      callId,
      callerHandle,
      callerNickname,
      callerAvatarId: sanitizedAvatarId,
      receiverHandle,
      callType,
      timestamp: Date.now(),
    };

    // 2. Insert durable invite in Supabase messages queue so backgrounded/reconnecting receiver NEVER misses it!
    try {
      await supabase.from('messages').upsert({
        id: `call_req_${callId}`,
        conversation_id: `call_req_${receiverClean}`,
        sender: callerClean,
        receiver: receiverClean,
        body: JSON.stringify(payload),
        sent_at: Date.now(),
        expires_at: Date.now() + 35000,
      });
    } catch (dbErr) {
      console.log('Durable call invite write note:', dbErr.message);
    }

    // 3. Connect to the receiver's personal call inbox channel AND general user channel
    const targetChannelName = `call_user_${receiverClean}`;
    let targetChannel = supabase.getChannels().find((c) => c.topic === `realtime:${targetChannelName}`);

    if (!targetChannel) {
      targetChannel = supabase.channel(targetChannelName, {
        config: { broadcast: { ack: true } },
      });
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 3000);
        targetChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timer);
            resolve();
          }
        });
      });
    }

    const userChannelName = `user_${receiverClean}`;
    let userChannel = supabase.getChannels().find((c) => c.topic === `realtime:${userChannelName}`);
    if (!userChannel) {
      userChannel = supabase.channel(userChannelName);
      userChannel.subscribe();
    }

    // 4. Send invite with retry — wait up to 2s between attempts for 'ringing' confirmation
    let ringingConfirmed = false;

    const ringingListener = (eventType) => {
      if (eventType === 'ringing') ringingConfirmed = true;
    };
    if (!activeCallListeners.has(callId)) {
      activeCallListeners.set(callId, new Set());
    }
    activeCallListeners.get(callId).add(ringingListener);

    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 2000;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (ringingConfirmed) {
        console.log(`CallService: Ringing confirmed after ${attempt} attempt(s)`);
        break;
      }
      try {
        targetChannel.send({
          type: 'broadcast',
          event: 'call_invite',
          payload,
        });
        if (userChannel) {
          userChannel.send({
            type: 'broadcast',
            event: 'call_invite',
            payload,
          });
        }
        console.log(`CallService: Sent call_invite attempt ${attempt + 1}`);
      } catch (err) {
        console.warn(`Call invite send attempt ${attempt + 1} failed:`, err);
      }

      if (attempt < MAX_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    const listeners = activeCallListeners.get(callId);
    if (listeners) listeners.delete(ringingListener);

    console.log(`CallService: startCall complete. callId=${callId}, ringingConfirmed=${ringingConfirmed}`);
    return callId;
  },

  /**
   * Send ringing confirmation back to caller
   */
  async sendRinging(callId) {
    if (activeCallRoomChannel) {
      try {
        await activeCallRoomChannel.send({
          type: 'broadcast',
          event: 'call_ringing',
          payload: { callId, receiverHandle: currentSubscribedHandle, timestamp: Date.now() },
        });
      } catch (err) {
        console.warn('Failed to send ringing notice:', err);
      }
    }
  },

  /**
   * Accept an incoming call
   */
  async acceptCall(callId) {
    if (activeCallInfo && activeCallInfo.callId === callId) {
      activeCallInfo.status = 'connected';
      activeCallInfo.startTime = Date.now();
    }

    // Remove durable invite immediately
    try {
      supabase.from('messages').delete().eq('id', `call_req_${callId}`).then(() => {}).catch(() => {});
    } catch (_) {}

    if (activeCallRoomChannel) {
      try {
        await activeCallRoomChannel.send({
          type: 'broadcast',
          event: 'call_accepted',
          payload: { callId, receiverHandle: currentSubscribedHandle, timestamp: Date.now() },
        });
      } catch (err) {
        console.warn('Failed to send call accept:', err);
      }
    }
  },

  /**
   * Reject / decline an incoming call
   */
  async rejectCall(callId, reason = 'declined') {
    if (activeCallInfo && activeCallInfo.callId === callId) {
      activeCallInfo = null;
    }

    // Remove durable invite immediately
    try {
      supabase.from('messages').delete().eq('id', `call_req_${callId}`).then(() => {}).catch(() => {});
    } catch (_) {}

    if (activeCallRoomChannel) {
      try {
        await activeCallRoomChannel.send({
          type: 'broadcast',
          event: 'call_rejected',
          payload: { callId, reason, receiverHandle: currentSubscribedHandle, timestamp: Date.now() },
        });
      } catch (err) {
        console.warn('Failed to send call reject:', err);
      }
    }
  },

  /**
   * Hang up an active or ringing call
   */
  async endCall(callId, partnerHandle = null) {
    if (activeCallInfo && activeCallInfo.callId === callId) {
      activeCallInfo = null;
    }

    // Remove durable invite immediately
    try {
      supabase.from('messages').delete().eq('id', `call_req_${callId}`).then(() => {}).catch(() => {});
    } catch (_) {}

    if (activeCallRoomChannel) {
      try {
        await activeCallRoomChannel.send({
          type: 'broadcast',
          event: 'call_ended',
          payload: { callId, senderHandle: currentSubscribedHandle, timestamp: Date.now() },
        });
        supabase.removeChannel(activeCallRoomChannel);
      } catch (err) {
        console.warn('Failed to send call end:', err);
      }
      activeCallRoomChannel = null;
    }

    // Also notify partner's user channel directly in case they didn't join room yet
    if (partnerHandle) {
      const pClean = clean(partnerHandle);
      const targetChan = supabase.getChannels().find((c) => c.topic === `realtime:call_user_${pClean}`);
      if (targetChan) {
        try {
          targetChan.send({
            type: 'broadcast',
            event: 'call_ended',
            payload: { callId, senderHandle: currentSubscribedHandle, timestamp: Date.now() },
          });
        } catch (_) {}
      }
    }
  },

  /**
   * Send WebRTC signaling packet (offer, answer, ICE candidate)
   */
  async sendSignal(callId, partnerHandle, signalData, myHandle = null) {
    const sender = clean(myHandle) || currentSubscribedHandle || '';
    if (activeCallRoomChannel) {
      try {
        await activeCallRoomChannel.send({
          type: 'broadcast',
          event: 'call_signal',
          payload: { callId, senderHandle: sender, signalData, timestamp: Date.now() },
        });
      } catch (err) {
        console.warn('Failed to send call signal:', err);
      }
    }
  },

  /**
   * Register a listener for events on a specific callId
   */
  subscribeToCall(callId, callback) {
    if (!activeCallListeners.has(callId)) {
      activeCallListeners.set(callId, new Set());
    }
    activeCallListeners.get(callId).add(callback);

    return () => {
      const listeners = activeCallListeners.get(callId);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          activeCallListeners.delete(callId);
        }
      }
    };
  },

  getActiveCall() {
    return activeCallInfo;
  },

  clearActiveCall() {
    activeCallInfo = null;
  },
};
