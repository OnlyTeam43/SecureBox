// src/components/IncomingCallModal.js
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
  Modal,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../theme';
import { PhoneIcon, PhoneOffIcon, UserAvatarIcon } from './Icons';
import { callAudioService } from '../services/callAudioService';
import { callService } from '../services/callService';
import { navigate } from '../navigation/navigationRef';
import { getContactByHandle, insertCallLog } from '../db/database';
import { notifyMissedCall } from '../services/notificationService';
import { useBadgeStore } from '../store/useBadgeStore';
import { getAvatar } from '../constants/avatars';

export default function IncomingCallModal({ callData, onDismiss }) {
  const insets = useSafeAreaInsets();
  const [pulseAnim] = useState(new Animated.Value(1));
  const [glowAnim] = useState(new Animated.Value(0.4));
  const [callerAvatarUri, setCallerAvatarUri] = useState(callData?.callerAvatarId || null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!callData) return;
    if (callData.callerAvatarId) {
      setCallerAvatarUri(callData.callerAvatarId);
    } else if (callData.callerHandle) {
      const cleanH = callData.callerHandle.replace('@', '').trim().toLowerCase();
      getContactByHandle(cleanH)
        .then((contact) => {
          if (contact?.avatarId) {
            setCallerAvatarUri(contact.avatarId);
          }
        })
        .catch(() => {});
    }
  }, [callData]);

  useEffect(() => {
    if (!callData) return;

    // Start incoming ringtone & vibration
    callAudioService.playIncomingRing();

    // Pulsing avatar ring animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.18,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.9,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulse.start();

    // Auto timeout if not answered in 35 seconds
    timeoutRef.current = setTimeout(() => {
      handleDecline('timeout');
    }, 35000);

    // Listen for caller hanging up before answer
    const unsubscribe = callService.subscribeToCall(callData.callId, async (eventType) => {
      if (eventType === 'ended' || eventType === 'rejected') {
        callAudioService.stopAll();
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        await insertCallLog({
          id: callData.callId,
          contactHandle: callData.callerHandle,
          contactNickname: callData.callerNickname,
          contactAvatarId: callerAvatarUri || callData.callerAvatarId,
          callType: callData.callType || 'voice',
          direction: 'missed',
          timestamp: Date.now(),
          duration: 0,
          seen: 0,
        }).catch(() => {});

        notifyMissedCall({
          callerHandle: callData.callerHandle,
          callerNickname: callData.callerNickname,
          callerAvatarId: callerAvatarUri || callData.callerAvatarId,
          callType: callData.callType,
        });

        useBadgeStore.getState().refreshBadges();
        onDismiss();
      }
    });

    return () => {
      pulse.stop();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      unsubscribe();
    };
  }, [callData]);

  if (!callData) return null;

  const handleAccept = async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    await callAudioService.stopAll();

    // Log call as incoming
    await insertCallLog({
      id: callData.callId,
      contactHandle: callData.callerHandle,
      contactNickname: callData.callerNickname,
      contactAvatarId: callerAvatarUri || callData.callerAvatarId,
      callType: callData.callType || 'voice',
      direction: 'incoming',
      timestamp: Date.now(),
      duration: 0,
      seen: 1,
    }).catch(() => {});

    await callService.acceptCall(callData.callId);
    onDismiss();

    // Seamlessly navigate to active CallScreen
    navigate('Call', {
      callId: callData.callId,
      contactHandle: callData.callerHandle,
      contactNickname: callData.callerNickname,
      contactAvatarId: callerAvatarUri || callData.callerAvatarId,
      callType: callData.callType || 'voice',
      isIncoming: true,
    });
  };

  const handleDecline = async (reason = 'declined') => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    await callAudioService.stopAll();

    const isMissed = reason === 'timeout';
    await insertCallLog({
      id: callData.callId,
      contactHandle: callData.callerHandle,
      contactNickname: callData.callerNickname,
      contactAvatarId: callerAvatarUri || callData.callerAvatarId,
      callType: callData.callType || 'voice',
      direction: 'missed',
      timestamp: Date.now(),
      duration: 0,
      seen: isMissed ? 0 : 1,
    }).catch(() => {});

    if (isMissed) {
      notifyMissedCall({
        callerHandle: callData.callerHandle,
        callerNickname: callData.callerNickname,
        callerAvatarId: callerAvatarUri || callData.callerAvatarId,
        callType: callData.callType,
      });
    }

    useBadgeStore.getState().refreshBadges();

    await callService.rejectCall(callData.callId, reason);
    onDismiss();
  };

  const isImageAvatar =
    callerAvatarUri &&
    (callerAvatarUri.startsWith('data:') ||
      callerAvatarUri.startsWith('file:') ||
      callerAvatarUri.startsWith('http'));
  const presetAvatar = !isImageAvatar && callerAvatarUri ? getAvatar(callerAvatarUri) : null;

  return (
    <Modal visible={!!callData} transparent animationType="slide">
      <StatusBar barStyle="light-content" backgroundColor="#0f0911" />
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        {/* Top Info */}
        <View style={styles.topInfo}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {callData.callType === 'video' ? '📹 INCOMING VIDEO CALL' : '📞 INCOMING AUDIO CALL'}
            </Text>
          </View>
          <Text style={styles.callerName}>{callData.callerNickname || 'Unknown'}</Text>
          <Text style={styles.callerHandle}>@{callData.callerHandle?.replace('@', '')}</Text>
          <Text style={styles.callPrompt}>SecureBox encrypted call</Text>
        </View>

        {/* Pulsing Avatar */}
        <View style={styles.centerSection}>
          <Animated.View
            style={[
              styles.avatarGlow,
              {
                transform: [{ scale: pulseAnim }],
                opacity: glowAnim,
              },
            ]}
          />
          <View style={styles.avatarCircle}>
            {isImageAvatar ? (
              <Image source={{ uri: callerAvatarUri }} style={styles.avatarImage} />
            ) : presetAvatar ? (
              <Image source={presetAvatar} style={styles.avatarImage} />
            ) : (
              <UserAvatarIcon size={76} color={Colors.accent.primary} />
            )}
          </View>
        </View>

        {/* Accept & Decline Controls */}
        <View style={styles.actionsRow}>
          {/* Decline Button */}
          <View style={styles.actionCol}>
            <TouchableOpacity
              style={[styles.callBtn, styles.declineBtn]}
              onPress={() => handleDecline('declined')}
              activeOpacity={0.8}
            >
              <PhoneOffIcon size={28} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.btnLabel}>Decline</Text>
          </View>

          {/* Accept Button */}
          <View style={styles.actionCol}>
            <TouchableOpacity
              style={[styles.callBtn, styles.acceptBtn]}
              onPress={handleAccept}
              activeOpacity={0.8}
            >
              <PhoneIcon size={30} color="#ffffff" />
            </TouchableOpacity>
            <Text style={[styles.btnLabel, { color: '#25d366' }]}>Accept</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0911',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  topInfo: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  badge: {
    backgroundColor: 'rgba(224, 82, 122, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(224, 82, 122, 0.4)',
    marginBottom: Spacing.sm,
  },
  badgeText: {
    color: '#ffb3c6',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  callerName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
  },
  callerHandle: {
    fontSize: Typography.sizes.md,
    color: '#ffb3c6',
    fontWeight: '600',
  },
  callPrompt: {
    fontSize: Typography.sizes.xs,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 220,
    height: 220,
  },
  avatarGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(224, 82, 122, 0.35)',
    borderWidth: 2,
    borderColor: 'rgba(224, 82, 122, 0.6)',
  },
  avatarCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#201625',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: Colors.accent.primary,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 70,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  actionCol: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  callBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  declineBtn: {
    backgroundColor: '#ff3b30',
    shadowColor: '#ff3b30',
  },
  acceptBtn: {
    backgroundColor: '#25d366',
    shadowColor: '#25d366',
  },
  btnLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: '#ffffff',
  },
});
