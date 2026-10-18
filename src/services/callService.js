// src/services/callService.js
// Supabase Realtime calling signaling service for SecureBox

import { supabase } from './supabase';

// Active call state in memory
let activeCallInfo = null; // { callId, partnerHandle, partnerNickname, partnerAvatarId, callType, status, isCaller, startTime }
let incomingCallCallback = null;
let activeCallListeners = new Map(); // callId -> Set of callback handlers
let userSubscriptionChannel = null;
let currentSubscribedHandle = null;

const clean = (h) => (h ? h.replace('@', '').trim().toLowerCase() : '');

/**
 * Helper to get or create a Supabase broadcast channel for any target handle
 */
const getTargetChannel = async (targetHandle) => {
  const targetClean = clean(targetHandle);
  if (!targetClean) return null;

  const topicName = `realtime:user_${targetClean}`;
  let channel = supabase.getChannels().find((c) => c.topic === topicName);

  if (!channel) {
    channel = supabase.channel(`user_${targetClean}`);
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 1200);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer);
          resolve();
        }
      });
    });
  }
  return channel;
};

/**
 * Initialize global call receiver for the logged-in user
 */
export const initCallReceiver = (myHandle, onIncomingCall) => {
  if (!myHandle) return;
  const myClean = clean(myHandle);

  incomingCallCallback = onIncomingCall;

  if (userSubscriptionChannel && currentSubscribedHandle === myClean) {
    return;
  }

  if (userSubscriptionChannel) {
    try {
      supabase.removeChannel(userSubscriptionChannel);
    } catch (_) {}
    userSubscriptionChannel = null;
  }

  currentSubscribedHandle = myClean;
  const channelName = `user_${myClean}`;

  const channel = supabase.channel(channelName);

  channel
    // 1. Incoming Call Invite
    .on('broadcast', { event: 'call_invite' }, ({ payload }) => {
      if (!payload || !payload.callId) return;
      const callerClean = clean(payload.callerHandle);
      if (callerClean === myClean) return; // ignore self-broadcast

      // If user is already on another call, automatically respond busy
      if (activeCallInfo && activeCallInfo.status === 'connected') {
        callService.rejectCall(payload.callId, payload.callerHandle, 'busy');
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

      // Notify caller that phone is ringing
      callService.sendRinging(payload.callId, payload.callerHandle);

      if (incomingCallCallback) {
        incomingCallCallback(payload);
      }
    })

    // 2. Ringing confirmation from receiver
    .on('broadcast', { event: 'call_ringing' }, ({ payload }) => {
      if (!payload || !payload.callId) return;
      notifyCallListeners(payload.callId, 'ringing', payload);
    })

    // 3. Call Accepted by receiver
    .on('broadcast', { event: 'call_accepted' }, ({ payload }) => {
      if (!payload || !payload.callId) return;
      if (activeCallInfo && activeCallInfo.callId === payload.callId) {
        activeCallInfo.status = 'connected';
        activeCallInfo.startTime = Date.now();
      }
      notifyCallListeners(payload.callId, 'accepted', payload);
    })

    // 4. Call Rejected / Busy / Timeout
    .on('broadcast', { event: 'call_rejected' }, ({ payload }) => {
      if (!payload || !payload.callId) return;
      if (activeCallInfo && activeCallInfo.callId === payload.callId) {
        activeCallInfo = null;
      }
      notifyCallListeners(payload.callId, 'rejected', payload);
    })

    // 5. Call Ended / Hung up
    .on('broadcast', { event: 'call_ended' }, ({ payload }) => {
      if (!payload || !payload.callId) return;
      if (activeCallInfo && activeCallInfo.callId === payload.callId) {
        activeCallInfo = null;
      }
      notifyCallListeners(payload.callId, 'ended', payload);
    })

    // 6. WebRTC / Audio stream signaling packet
    .on('broadcast', { event: 'call_signal' }, ({ payload }) => {
      if (!payload || !payload.callId) return;
      notifyCallListeners(payload.callId, 'signal', payload);
    })
    .subscribe();

  userSubscriptionChannel = channel;
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
   * Initiate an outgoing call
   */
  async startCall({ callerHandle, callerNickname, callerAvatarId, receiverHandle, callType = 'voice' }) {
    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

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

    const payload = {
      callId,
      callerHandle,
      callerNickname,
      callerAvatarId,
      receiverHandle,
      callType,
      timestamp: Date.now(),
    };

    try {
      const channel = await getTargetChannel(receiverHandle);
      if (channel) {
        await channel.send({
          type: 'broadcast',
          event: 'call_invite',
          payload,
        });
      }
    } catch (err) {
      console.warn('Failed to send call invite:', err);
    }

    return callId;
  },

  /**
   * Send ringing confirmation to the caller
   */
  async sendRinging(callId, callerHandle) {
    try {
      const channel = await getTargetChannel(callerHandle);
      if (channel) {
        await channel.send({
          type: 'broadcast',
          event: 'call_ringing',
          payload: { callId, receiverHandle: currentSubscribedHandle, timestamp: Date.now() },
        });
      }
    } catch (err) {
      console.warn('Failed to send ringing notice:', err);
    }
  },

  /**
   * Accept an incoming call
   */
  async acceptCall(callId, callerHandle) {
    if (activeCallInfo && activeCallInfo.callId === callId) {
      activeCallInfo.status = 'connected';
      activeCallInfo.startTime = Date.now();
    }

    try {
      const channel = await getTargetChannel(callerHandle);
      if (channel) {
        await channel.send({
          type: 'broadcast',
          event: 'call_accepted',
          payload: { callId, receiverHandle: currentSubscribedHandle, timestamp: Date.now() },
        });
      }
    } catch (err) {
      console.warn('Failed to send call accept:', err);
    }
  },

  /**
   * Reject / decline an incoming call
   */
  async rejectCall(callId, callerHandle, reason = 'declined') {
    if (activeCallInfo && activeCallInfo.callId === callId) {
      activeCallInfo = null;
    }

    try {
      const channel = await getTargetChannel(callerHandle);
      if (channel) {
        await channel.send({
          type: 'broadcast',
          event: 'call_rejected',
          payload: { callId, reason, receiverHandle: currentSubscribedHandle, timestamp: Date.now() },
        });
      }
    } catch (err) {
      console.warn('Failed to send call reject:', err);
    }
  },

  /**
   * Hang up an active or ringing call
   */
  async endCall(callId, partnerHandle) {
    if (activeCallInfo && activeCallInfo.callId === callId) {
      activeCallInfo = null;
    }

    try {
      const channel = await getTargetChannel(partnerHandle);
      if (channel) {
        await channel.send({
          type: 'broadcast',
          event: 'call_ended',
          payload: { callId, senderHandle: currentSubscribedHandle, timestamp: Date.now() },
        });
      }
    } catch (err) {
      console.warn('Failed to send call end:', err);
    }
  },

  /**
   * Send WebRTC signaling packet (offer, answer, ICE candidate)
   */
  async sendSignal(callId, partnerHandle, signalData) {
    try {
      const channel = await getTargetChannel(partnerHandle);
      if (channel) {
        await channel.send({
          type: 'broadcast',
          event: 'call_signal',
          payload: { callId, senderHandle: currentSubscribedHandle, signalData, timestamp: Date.now() },
        });
      }
    } catch (err) {
      console.warn('Failed to send call signal:', err);
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
