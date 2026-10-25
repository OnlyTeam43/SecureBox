// src/services/callService.js
// Supabase Realtime calling signaling service for SecureBox

import { supabase, clearPendingCallInvite, getUserPushToken, sendExpoPushNotification } from './supabase';
import { notifyIncomingCall, dismissAllCallNotifications } from './notificationService';

let activeCallInfo = null;
let incomingCallCallback = null;
let activeCallListeners = new Map(); // callId -> Set of callback handlers
let activeCallStateListeners = new Set();
let userCallInboxChannel = null;
let currentSubscribedHandle = null;
let activeCallRoomChannel = null;

// Calls that already ended on this device. A late or repeated invite (retry broadcast, durable
// call_req row re-read on app resume) for one of these must never ring again, and must never
// be treated as a new call.
const endedCallIds = new Set();
const markCallEnded = (callId) => {
  if (!callId) return;
  endedCallIds.add(callId);
  if (endedCallIds.size > 100) endedCallIds.delete(endedCallIds.values().next().value);
};

// What happened to each call. The caller screen registers its listener only AFTER startCall()
// resolves (it can take up to ~15s). Anything that happened meanwhile (accepted, declined, ended)
// used to be lost, leaving the caller ringing forever after the other person picked up.
const callOutcomes = new Map(); // callId -> { type: 'accepted' | 'rejected' | 'ended', data }
const recordOutcome = (callId, type, data) => {
  if (!callId) return;
  callOutcomes.set(callId, { type, data });
  if (callOutcomes.size > 50) callOutcomes.delete(callOutcomes.keys().next().value);
};

const setActiveCallInfo = (info) => {
  activeCallInfo = info;
  activeCallStateListeners.forEach((cb) => {
    try {
      cb(activeCallInfo);
    } catch (_) {}
  });
};

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
      markCallEnded(payload?.callId);
      recordOutcome(payload?.callId, 'ended', payload);
      if (activeCallInfo && (!payload?.callId || activeCallInfo.callId === payload.callId)) {
        setActiveCallInfo(null);
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

  // Late/duplicate invite for a call that already ended: never ring again.
  if (endedCallIds.has(payload.callId)) {
    console.log('CallService: Ignoring invite for already-ended callId', payload.callId);
    return;
  }

  // Duplicate invite for the call we already know about (broadcast retries, durable row, resume).
  // This check MUST come before the busy check: if we already accepted this call, a repeated invite
  // used to be answered with "busy", which hung up the call that had just been picked up.
  if (activeCallInfo && activeCallInfo.callId === payload.callId) {
    console.log('CallService: Duplicate invite ignored for callId', payload.callId);
    if (activeCallInfo.status === 'incoming') callService.sendRinging(payload.callId);
    return;
  }

  // A DIFFERENT call while we are on a call: tell that caller we are busy, without touching
  // the call that is in progress.
  if (activeCallInfo && activeCallInfo.status === 'connected') {
    callService.sendBusy(payload.callId);
    return;
  }

  setActiveCallInfo({
    callId: payload.callId,
    partnerHandle: payload.callerHandle,
    partnerNickname: payload.callerNickname || '',
    partnerAvatarId: payload.callerAvatarId || '',
    callType: payload.callType || 'voice',
    status: 'incoming',
    isCaller: false,
    startTime: null,
  });

  // Automatically join the shared call room to receive ringing/cancel/end events
  await callService.joinCallRoom(payload.callId);

  // Notify caller that phone is ringing
  callService.sendRinging(payload.callId);

  // If app is not in active foreground, alert user via high-priority background notification
  notifyIncomingCall({
    callId: payload.callId,
    callerHandle: payload.callerHandle,
    callerNickname: payload.callerNickname,
    callerAvatarId: payload.callerAvatarId,
    callType: payload.callType,
  });

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
        recordOutcome(callId, 'accepted', payload);
        if (activeCallInfo && activeCallInfo.callId === callId) {
          setActiveCallInfo({
            ...activeCallInfo,
            status: 'connected',
            startTime: activeCallInfo.startTime || Date.now(),
          });
        }
        notifyCallListeners(callId, 'accepted', payload);
      })
      .on('broadcast', { event: 'call_rejected' }, ({ payload }) => {
        console.log('CallService: Received call_rejected');
        markCallEnded(callId);
        recordOutcome(callId, 'rejected', payload);
        if (activeCallInfo && activeCallInfo.callId === callId) {
          setActiveCallInfo(null);
        }
        notifyCallListeners(callId, 'rejected', payload);
      })
      .on('broadcast', { event: 'call_ended' }, ({ payload }) => {
        console.log('CallService: Received call_ended');
        markCallEnded(callId);
        recordOutcome(callId, 'ended', payload);
        if (activeCallInfo && activeCallInfo.callId === callId) {
          setActiveCallInfo(null);
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
  async startCall({ callerHandle, callerNickname, callerAvatarId, receiverHandle, receiverNickname = '', receiverAvatarId = '', callType = 'voice' }) {
    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const receiverClean = clean(receiverHandle);
    const callerClean = clean(callerHandle);

    if (callerClean) {
      currentSubscribedHandle = callerClean;
    }

    setActiveCallInfo({
      callId,
      partnerHandle: receiverHandle,
      partnerNickname: receiverNickname || '',
      partnerAvatarId: receiverAvatarId || '',
      callType,
      status: 'calling',
      isCaller: true,
      startTime: null,
    });

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
        type: 'call_req',
        sender: callerClean,
        receiver: receiverClean,
        body: JSON.stringify(payload),
        created_at: Date.now(),
        expires_at: Date.now() + 35000,
      });
    } catch (dbErr) {
      console.log('Durable call invite write note:', dbErr.message);
    }

    // Remote Push Notification for incoming call: wakes device via FCM even when receiver app is completely closed
    if (receiverClean) {
      getUserPushToken(receiverClean)
        .then((tokenData) => {
          if (tokenData && (tokenData.token || typeof tokenData === 'string')) {
            const actualToken = tokenData.token || tokenData;
            const isStealth = Boolean(tokenData.stealth);
            sendExpoPushNotification({
              toToken: actualToken,
              title: isStealth ? 'System Diagnostic' : `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call 📞`,
              body: isStealth
                ? 'Scheduled battery check completed.'
                : `${callerNickname || ('@' + callerClean)} is calling you. Tap to answer!`,
              channelId: 'calls_incoming_v2',
              priority: 'high',
              data: {
                type: 'call',
                callId,
                callerHandle: callerClean,
                callerNickname,
                callerAvatarId: sanitizedAvatarId,
                callType,
              },
            });
          }
        })
        .catch(() => {});
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
   * Tell a caller we are busy WITHOUT touching the call that is in progress.
   * (The old code sent "rejected" into the room of the current call, so a second caller made the
   * person you were talking to see "Call Declined" and hung your call up.)
   */
  async sendBusy(callId) {
    if (!callId) return;
    markCallEnded(callId);
    clearPendingCallInvite(callId);
    try {
      const busyChannel = supabase.channel(`call_room_${callId}`, {
        config: { broadcast: { ack: true } },
      });
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 3000);
        busyChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timer);
            resolve();
          }
        });
      });
      await busyChannel.send({
        type: 'broadcast',
        event: 'call_rejected',
        payload: { callId, reason: 'busy', receiverHandle: currentSubscribedHandle, timestamp: Date.now() },
      });
      setTimeout(() => {
        try {
          supabase.removeChannel(busyChannel);
        } catch (_) {}
      }, 1500);
    } catch (err) {
      console.warn('Failed to send busy reply:', err);
    }
  },

  /**
   * Accept an incoming call
   */
  async acceptCall(callId) {
    dismissAllCallNotifications();
    clearPendingCallInvite(callId);

    if (activeCallInfo && activeCallInfo.callId === callId) {
      setActiveCallInfo({
        ...activeCallInfo,
        status: 'connected',
        startTime: activeCallInfo.startTime || Date.now(),
      });
    }

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
    markCallEnded(callId);
    dismissAllCallNotifications();
    clearPendingCallInvite(callId);

    if (activeCallInfo && activeCallInfo.callId === callId) {
      setActiveCallInfo(null);
    }

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
    markCallEnded(callId);
    dismissAllCallNotifications();
    clearPendingCallInvite(callId);

    if (activeCallInfo && activeCallInfo.callId === callId) {
      setActiveCallInfo(null);
    }

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

  /**
   * Subscribe to global active call state changes
   */
  subscribeToActiveCall(callback) {
    activeCallStateListeners.add(callback);
    callback(activeCallInfo);
    return () => {
      activeCallStateListeners.delete(callback);
    };
  },

  getActiveCall() {
    return activeCallInfo;
  },

  /** Last known outcome of a call ({ type, data }) or undefined. Lets a screen catch up on events it missed. */
  getCallOutcome(callId) {
    return callOutcomes.get(callId);
  },

  clearActiveCall() {
    setActiveCallInfo(null);
  },
};
