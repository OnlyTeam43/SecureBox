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

export default function ActiveCallBanner({ navigationRef }) {
  const insets = useSafeAreaInsets();
  const [activeCall, setActiveCall] = useState(null);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [duration, setDuration] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Subscribe to call state changes
  useEffect(() => {
    const unsub = callService.subscribeToActiveCall((call) => {
      setActiveCall(call);
    });
    return unsub;
  }, []);

  // Listen to navigation state changes to hide banner on CallScreen
  useEffect(() => {
    if (!navigationRef?.current) return;

    const updateRoute = () => {
      try {
        const route = navigationRef.current.getCurrentRoute();
        setCurrentRoute(route ? route.name : null);
      } catch (_) {}
    };

    updateRoute();
    const unsub = navigationRef.current.addListener('state', updateRoute);
    return unsub;
  }, [navigationRef]);

  // Pulse animation for green indicator
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
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

  // Only show banner when call is connected and user is NOT on the Call screen
  if (!activeCall || activeCall.status !== 'connected' || currentRoute === 'Call') {
    return null;
  }

  const handleReturnToCall = () => {
    if (navigationRef?.current) {
      navigationRef.current.navigate('Call', {
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
    <View style={[styles.container, { top: Math.max(insets.top, 12) + 4 }]}>
      <TouchableOpacity
        style={styles.pill}
        onPress={handleReturnToCall}
        activeOpacity={0.85}
      >
        <Animated.View style={[styles.indicator, { transform: [{ scale: pulseAnim }] }]} />

        <View style={styles.iconWrap}>
          {activeCall.callType === 'video' ? (
            <VideoIcon size={14} color="#ffffff" />
          ) : (
            <PhoneIcon size={14} color="#ffffff" />
          )}
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.timer}>{formatDuration(duration)} • Tap to return</Text>
        </View>

        <TouchableOpacity
          style={styles.hangupBtn}
          onPress={handleEndCall}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b1b1e',
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 10,
    width: '100%',
    maxWidth: 420,
    gap: 10,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#25d366',
    shadowColor: '#25d366',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 3,
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
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 11,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontVariant: ['tabular-nums'],
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
