// src/screens/main/CallsScreen.js
// Dedicated Calls Tab — Call history, active call resume card, quick call-backs
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  StatusBar,
  Animated,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import {
  PhoneIcon,
  VideoIcon,
  TrashIcon,
  UserAvatarIcon,
  CallIncomingIcon,
  CallOutgoingIcon,
  CallMissedIcon,
  EndCallIcon,
} from '../../components/Icons';
import {
  getCallLogs,
  clearAllCallLogs,
  deleteCallLog,
  markCallLogsAsSeen,
} from '../../db/database';
import { callService } from '../../services/callService';
import { webrtcService } from '../../services/webrtcService';
import { callAudioService } from '../../services/callAudioService';
import { getAvatar } from '../../constants/avatars';
import { useUserStore } from '../../store/useUserStore';
import { useBadgeStore } from '../../store/useBadgeStore';

export default function CallsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const myHandle = useUserStore((s) => s.handle);
  const [callLogs, setCallLogs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  const [duration, setDuration] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Listen to active ongoing call state
  useEffect(() => {
    const unsub = callService.subscribeToActiveCall((call) => {
      setActiveCall(call);
    });
    return unsub;
  }, []);

  // Live timer for active call card
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

  // Pulse animation for active call badge
  useEffect(() => {
    if (!activeCall) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [activeCall, pulseAnim]);

  const loadData = async () => {
    try {
      const logs = await getCallLogs();
      setCallLogs(logs || []);
      await markCallLogsAsSeen();
      useBadgeStore.getState().refreshBadges(myHandle);
    } catch (err) {
      console.warn('loadCallLogs error:', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [myHandle])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleClearHistory = () => {
    if (callLogs.length === 0) return;
    Alert.alert(
      'Clear Call History',
      'Are you sure you want to delete all call history logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearAllCallLogs();
            setCallLogs([]);
            useBadgeStore.getState().refreshBadges(myHandle);
          },
        },
      ]
    );
  };

  const handleDeleteItem = (id) => {
    Alert.alert('Delete Call Log', 'Delete this call from your history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCallLog(id);
          setCallLogs((prev) => prev.filter((item) => item.id !== id));
          useBadgeStore.getState().refreshBadges(myHandle);
        },
      },
    ]);
  };

  const handleStartCall = (contactHandle, contactNickname, contactAvatarId, type = 'voice') => {
    navigation.navigate('Call', {
      contactHandle,
      contactNickname,
      contactAvatarId,
      callType: type,
      isIncoming: false,
      isResume: false,
    });
  };

  const handleResumeActiveCall = () => {
    if (!activeCall) return;
    navigation.navigate('Call', {
      callId: activeCall.callId,
      contactHandle: activeCall.partnerHandle,
      contactNickname: activeCall.partnerNickname,
      contactAvatarId: activeCall.partnerAvatarId,
      callType: activeCall.callType,
      isIncoming: false,
      isResume: true,
    });
  };

  const handleEndActiveCall = async () => {
    if (!activeCall) return;
    const cid = activeCall.callId;
    const ph = activeCall.partnerHandle;
    webrtcService.cleanup();
    await callService.endCall(cid, ph);
    await callAudioService.playEndedChime();
  };

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatLogTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${timeStr}`;

    const isYesterday =
      new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString() === date.toDateString();
    if (isYesterday) return `Yesterday, ${timeStr}`;

    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  const renderActiveCard = () => {
    if (!activeCall || (activeCall.status !== 'connected' && activeCall.status !== 'calling')) {
      return null;
    }

    const displayName =
      activeCall.partnerNickname || activeCall.partnerHandle?.replace('@', '') || 'Partner';

    return (
      <View style={styles.activeCard}>
        <TouchableOpacity
          style={styles.activeCardContent}
          onPress={handleResumeActiveCall}
          activeOpacity={0.85}
        >
          <Animated.View style={[styles.activeDot, { transform: [{ scale: pulseAnim }] }]} />
          <View style={styles.activeCardText}>
            <View style={styles.activeCardTitleRow}>
              <Text style={styles.activeCardTitle} numberOfLines={1}>
                {displayName}
              </Text>
              <View style={styles.activeTypeBadge}>
                {activeCall.callType === 'video' ? (
                  <VideoIcon size={12} color="#ffffff" />
                ) : (
                  <PhoneIcon size={12} color="#ffffff" />
                )}
                <Text style={styles.activeTypeText}>
                  {activeCall.callType === 'video' ? 'Video' : 'Voice'}
                </Text>
              </View>
            </View>
            <Text style={styles.activeCardSubtitle}>
              {activeCall.status === 'connected'
                ? `Connected • ${formatDuration(duration)} • Tap to return`
                : 'Calling... • Tap to view'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.activeHangupBtn}
            onPress={handleEndActiveCall}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <EndCallIcon size={14} color="#ffffff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const isMissed = item.direction === 'missed';
    const isIncoming = item.direction === 'incoming';
    const isOutgoing = item.direction === 'outgoing';

    const isImg =
      item.contact_avatar_id &&
      (item.contact_avatar_id.startsWith('data:') ||
        item.contact_avatar_id.startsWith('file:') ||
        item.contact_avatar_id.startsWith('http'));
    const presetAvatar = !isImg && item.contact_avatar_id ? getAvatar(item.contact_avatar_id) : null;

    const displayName = item.contact_nickname || item.contact_handle || 'Unknown';

    return (
      <TouchableOpacity
        style={styles.logRow}
        onLongPress={() => handleDeleteItem(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrap}>
          {isImg ? (
            <Image source={{ uri: item.contact_avatar_id }} style={styles.avatarImg} />
          ) : presetAvatar ? (
            <Image source={presetAvatar} style={styles.avatarImg} />
          ) : (
            <UserAvatarIcon size={36} color={Colors.accent.primary} />
          )}
        </View>

        <View style={styles.infoCol}>
          <Text style={[styles.logName, isMissed && styles.logNameMissed]} numberOfLines={1}>
            {displayName}
          </Text>

          <View style={styles.logSubRow}>
            {isMissed ? (
              <CallMissedIcon size={14} color="#ff3b30" />
            ) : isIncoming ? (
              <CallIncomingIcon size={14} color="#25d366" />
            ) : (
              <CallOutgoingIcon size={14} color="#0084ff" />
            )}

            <Text style={[styles.logTime, isMissed && styles.logTimeMissed]}>
              {isMissed ? 'Missed Call' : item.duration > 0 ? formatDuration(item.duration) : ''}
              {' • '}
              {formatLogTime(item.timestamp)}
            </Text>
          </View>
        </View>

        {/* Quick Call Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.quickCallBtn}
            onPress={() =>
              handleStartCall(
                item.contact_handle,
                item.contact_nickname,
                item.contact_avatar_id,
                'voice'
              )
            }
          >
            <PhoneIcon size={18} color={Colors.accent.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCallBtn}
            onPress={() =>
              handleStartCall(
                item.contact_handle,
                item.contact_nickname,
                item.contact_avatar_id,
                'video'
              )
            }
          >
            <VideoIcon size={18} color={Colors.accent.primary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0911" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Calls</Text>
          <Text style={styles.subtitle}>
            {callLogs.length} recent {callLogs.length === 1 ? 'call' : 'calls'}
          </Text>
        </View>

        {callLogs.length > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClearHistory}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <TrashIcon size={18} color="#ff3b30" />
          </TouchableOpacity>
        )}
      </View>

      {/* Active Call Floating Card (if call is running in background) */}
      {renderActiveCard()}

      {/* Call History List */}
      <FlatList
        data={callLogs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          callLogs.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <PhoneIcon size={44} color={Colors.accent.primary} />
            </View>
            <Text style={styles.emptyTitle}>No Call History</Text>
            <Text style={styles.emptySubtitle}>
              Voice and HD video calls with your partners will appear here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0911',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 2,
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  activeCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b1b22',
    borderRadius: Radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.35)',
    elevation: 6,
    shadowColor: '#25d366',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    gap: 10,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#25d366',
  },
  activeCardText: {
    flex: 1,
  },
  activeCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  activeTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(224, 82, 122, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  activeTypeText: {
    fontSize: 10,
    color: '#ffb3c6',
    fontWeight: '600',
  },
  activeCardSubtitle: {
    fontSize: 11,
    color: '#25d366',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  activeHangupBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ff3b30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingVertical: Spacing.sm,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    gap: 12,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1f1622',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  logName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  logNameMissed: {
    color: '#ff5c5c',
  },
  logSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  logTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  logTimeMissed: {
    color: '#ff5c5c',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickCallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(224, 82, 122, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(224, 82, 122, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.45)',
    textAlign: 'center',
    lineHeight: 18,
  },
});
