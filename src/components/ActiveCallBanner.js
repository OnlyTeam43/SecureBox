// src/components/ActiveCallBanner.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { callService } from '../services/callService';
import { webrtcService } from '../services/webrtcService';
import { callAudioService } from '../services/callAudioService';
import { EndCallIcon, PhoneIcon, VideoIcon } from './Icons';

export default function ActiveCallBanner({ navigationRef, currentRouteName }) {
  const insets = useSafeAreaInsets();
  const [activeCall, setActiveCall] = useState(null);
  const [duration, setDuration] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Subscribe to call state changes
  useEffect(() => {
    const unsub = callService.subscribeToActiveCall((call) => {
      setActiveCall(call);
    });
    return unsub;
  }, []);

  // Pulse animation for green indicator
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.35,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Duration timer
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'connected') {
      setDuration(0);
      return;
    }

    const compute = () => {
      if (activeCall.startTime) {
        setDuration(Math.max(0, Math.floor((Date.now() - activeCall.startTime) / 1000)));
      } else {
        setDuration((prev) => prev + 1);
      }
    };

    compute();
    const interval = setInterval(compute, 1000);
    return () => clearInterval(interval);
  }, [activeCall]);

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Determine current route: check prop or navigationRef
  let activeRoute = currentRouteName;
  if (!activeRoute && navigationRef) {
    try {
      activeRoute = navigationRef.getCurrentRoute()?.name;
    } catch (_) {}
  }

  // Only show banner when call is active (connected or calling) and user is NOT on the Call screen
  const isCallActive =
    activeCall &&
    (activeCall.status === 'connected' || activeCall.status === 'calling');

  if (!isCallActive || activeRoute === 'Call') {
    return null;
  }

  const isConnected = activeCall.status === 'connected';

  const handleReturnToCall = () => {
    if (navigationRef) {
      navigationRef.navigate('Call', {
        callId: activeCall.callId,
        contactHandle: activeCall.partnerHandle,
        contactNickname: activeCall.partnerNickname,
        contactAvatarId: activeCall.partnerAvatarId,
        callType: activeCall.callType,
        isIncoming: false,
        isResume: true,
      });
    }
  };

  const handleEndCall = async () => {
    const callId = activeCall.callId;
    const partnerHandle = activeCall.partnerHandle;
    webrtcService.cleanup();
    await callService.endCall(callId, partnerHandle);
    await callAudioService.playEndedChime();
  };

  const displayName =
    activeCall.partnerNickname ||
    activeCall.partnerHandle?.replace('@', '') ||
    'Partner';

  return (
    <View
      style={[
        styles.container,
        { top: Math.max(insets.top, 12) + 2 },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.pill}
        onPress={handleReturnToCall}
        activeOpacity={0.88}
      >
        <Animated.View
          style={[
            styles.indicator,
            isConnected ? styles.indicatorLive : styles.indicatorCalling,
            { transform: [{ scale: pulseAnim }] },
          ]}
        />

        <View style={styles.iconWrap}>
          {activeCall.callType === 'video' ? (
            <VideoIcon size={14} color="#ffffff" />
          ) : (
            <PhoneIcon size={14} color="#ffffff" />
          )}
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.name} numberOfLines={1}>
            {isConnected ? 'Connected Call' : 'Calling...'} • {displayName}
          </Text>
          <Text style={styles.timer}>
            {isConnected ? `${formatDuration(duration)} • Tap to return` : 'Tap to return'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.hangupBtn}
          onPress={handleEndCall}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <EndCallIcon size={14} color="#ffffff" />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 99998,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161c',
    borderRadius: 30,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(37, 211, 102, 0.45)',
    shadowColor: '#25d366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
    width: '100%',
    maxWidth: 420,
    gap: 10,
  },
  indicator: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  indicatorLive: {
    backgroundColor: '#25d366',
    shadowColor: '#25d366',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 6,
    elevation: 4,
  },
  indicatorCalling: {
    backgroundColor: '#f59e0b',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 6,
    elevation: 4,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  name: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  timer: {
    color: '#25d366',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  hangupBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ff3b30',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
