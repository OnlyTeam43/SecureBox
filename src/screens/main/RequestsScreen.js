// src/screens/main/RequestsScreen.js
// Connection / Chat Requests tab between Messages and Profile

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';
import * as Crypto from 'expo-crypto';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { useUserStore } from '../../store/useUserStore';
import {
  findUserByHandle,
  sendConnectionRequest,
  fetchPendingConnectionRequests,
  fetchSentConnectionRequests,
  acceptConnectionRequest,
  declineConnectionRequest,
  subscribeToMyMessages,
  checkConnectionStatus,
  fetchAndProcessPendingAcceptances,
} from '../../services/supabase';
import { insertContact, upsertConversation } from '../../db/database';
import { UserAvatarIcon } from '../../components/Icons';
import { useBadgeStore } from '../../store/useBadgeStore';

export default function RequestsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const myHandle = useUserStore((s) => s.handle);
  const myNickname = useUserStore((s) => s.nickname);
  const myAvatarId = useUserStore((s) => s.avatarId);

  const [activeTab, setActiveTab] = useState('received'); // 'received' | 'sent'
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Search to send request state
  const [searchHandle, setSearchHandle] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [sendingRequest, setSendingRequest] = useState(false);

  const loadRequests = async () => {
    if (!myHandle) return;
    try {
      // 1. Process durable acceptance notifications from Supabase
      const acceptedList = await fetchAndProcessPendingAcceptances(myHandle);
      if (acceptedList && acceptedList.length > 0) {
        for (const acc of acceptedList) {
          const partnerHandle = acc.byHandle.toLowerCase();
          const partnerNick = acc.byNickname || partnerHandle;
          const partnerAvatar = acc.byAvatar || 'avatar_rose';

          const participants = [myHandle.toLowerCase(), partnerHandle].sort();
          const convId = `chat_${participants[0]}_${participants[1]}`;
          const contactId = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            partnerHandle
          );

          await insertContact({
            id: contactId,
            handle: partnerHandle,
            nickname: partnerNick,
            avatarId: partnerAvatar,
          });

          await upsertConversation({
            id: convId,
            contactId,
            lastMsg: 'Connected! Say hi 💕',
            lastTime: Date.now(),
            unread: 0,
          });
        }
      }

      // 2. Fetch pending requests
      const [pending, sent] = await Promise.all([
        fetchPendingConnectionRequests(myHandle),
        fetchSentConnectionRequests(myHandle),
      ]);
      setReceivedRequests(pending || []);
      setSentRequests(sent || []);
      useBadgeStore.getState().refreshBadges(myHandle);
    } catch (err) {
      console.warn('Load requests error:', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [myHandle])
  );

  // Real-time listener for incoming requests and accepted notifications
  useEffect(() => {
    if (!myHandle) return;
    const unsubscribe = subscribeToMyMessages(
      myHandle,
      () => {},
      async (statusEvent) => {
        if (!statusEvent) return;
        if (statusEvent.event === 'incoming_connection_request') {
          loadRequests();
        } else if (statusEvent.event === 'connection_request_accepted') {
          const partnerHandle = statusEvent.byHandle.toLowerCase();
          const partnerNick = statusEvent.byNickname || partnerHandle;
          const partnerAvatar = statusEvent.byAvatar || 'avatar_rose';

          // Add to local SQLite contacts & conversation
          const participants = [myHandle.toLowerCase(), partnerHandle].sort();
          const convId = `chat_${participants[0]}_${participants[1]}`;
          const contactId = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            partnerHandle
          );

          await insertContact({
            id: contactId,
            handle: partnerHandle,
            nickname: partnerNick,
            avatarId: partnerAvatar,
          });

          await upsertConversation({
            id: convId,
            contactId,
            lastMsg: 'Connected! Say hi 💕',
            lastTime: Date.now(),
            unread: 0,
          });

          loadRequests();
          Alert.alert(
            'Request Accepted! 🎉',
            `@${partnerHandle} accepted your chat request! You can now start chatting.`
          );
        }
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [myHandle]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  // Search handle in Supabase
  const handleSearchUser = async () => {
    const clean = searchHandle.replace('@', '').trim().toLowerCase();
    if (!clean) return;

    if (clean === myHandle?.toLowerCase()) {
      return Alert.alert('Self Connection', "You cannot send a connection request to yourself.");
    }

    setSearching(true);
    setSearchResult(null);
    try {
      // Check full connection status
      const connStatus = await checkConnectionStatus(myHandle, clean);

      if (connStatus.status === 'connected') {
        setSearching(false);
        const contact = connStatus.contact;
        const participants = [myHandle.toLowerCase(), clean].sort();
        const convId = `chat_${participants[0]}_${participants[1]}`;
        return Alert.alert(
          'Already Connected 💕',
          `You and @${clean} are already connected!`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Chat Now',
              onPress: () => {
                setSearchHandle('');
                navigation.navigate('Chat', {
                  conversationId: convId,
                  contactHandle: contact.handle,
                  contactNickname: contact.nickname,
                  contactAvatarId: contact.avatar_id,
                });
              },
            },
          ]
        );
      }

      if (connStatus.status === 'pending_sent') {
        setSearching(false);
        return Alert.alert(
          'Request Already Sent ⏳',
          `You already sent a connection request to @${clean}. Waiting for them to accept!`
        );
      }

      if (connStatus.status === 'pending_received') {
        setSearching(false);
        setActiveTab('received');
        return Alert.alert(
          'Request Waiting! 💌',
          `@${clean} has already sent you a connection request! Tap "Accept" in the Received list below.`
        );
      }

      const remote = await findUserByHandle(clean);
      if (remote) {
        setSearchResult(remote);
      } else {
        Alert.alert('User Not Found', `No user found with handle @${clean}`);
      }
    } catch (err) {
      console.warn('Search error:', err);
      Alert.alert('Search Error', err.message || 'Could not search user');
    } finally {
      setSearching(false);
    }
  };

  // Send Connection Request
  const handleSendRequest = async () => {
    if (!searchResult) return;
    setSendingRequest(true);
    try {
      await sendConnectionRequest({
        fromHandle: myHandle,
        toHandle: searchResult.handle,
        fromNickname: myNickname,
        fromAvatar: myAvatarId,
      });

      Alert.alert(
        'Request Sent! 💌',
        `Connection request sent to @${searchResult.handle}. Once they accept, they will appear in your Messages!`
      );
      setSearchResult(null);
      setSearchHandle('');
      await loadRequests();
    } catch (err) {
      console.error('Send request error:', err);
      Alert.alert('Error', err.message || 'Could not send request');
    } finally {
      setSendingRequest(false);
    }
  };

  // Accept Connection Request
  const handleAccept = async (req) => {
    try {
      const senderHandle = req.sender.toLowerCase();
      const senderNick = req.nickname || senderHandle;
      const senderAvatar = req.avatar || 'avatar_rose';

      // 1. Accept in Supabase & notify sender
      await acceptConnectionRequest({
        reqId: req.id,
        fromHandle: senderHandle,
        toHandle: myHandle,
        myNickname,
        myAvatar: myAvatarId,
      });

      // 2. Add contact and conversation to local SQLite
      const participants = [myHandle.toLowerCase(), senderHandle].sort();
      const convId = `chat_${participants[0]}_${participants[1]}`;
      const contactId = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        senderHandle
      );

      await insertContact({
        id: contactId,
        handle: senderHandle,
        nickname: senderNick,
        avatarId: senderAvatar,
      });

      await upsertConversation({
        id: convId,
        contactId,
        lastMsg: 'Connected! Say hi 💕',
        lastTime: Date.now(),
        unread: 0,
      });

      await loadRequests();

      Alert.alert(
        'Connected! 💕',
        `You and @${senderHandle} are now connected!`,
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Chat Now',
            onPress: () =>
              navigation.navigate('Chat', {
                conversationId: convId,
                contactHandle: senderHandle,
                contactNickname: senderNick,
                contactAvatarId: senderAvatar,
              }),
          },
        ]
      );
    } catch (err) {
      console.error('Accept error:', err);
      Alert.alert('Error', 'Could not accept connection request');
    }
  };

  // Decline Request
  const handleDecline = async (reqId) => {
    try {
      await declineConnectionRequest(reqId);
      await loadRequests();
    } catch (err) {
      console.warn('Decline error:', err);
    }
  };

  const renderReceivedItem = ({ item }) => {
    const isImage = item.avatar && (item.avatar.startsWith('data:') || item.avatar.startsWith('file:') || item.avatar.startsWith('http'));

    let timeAgo = '';
    try {
      timeAgo = formatDistanceToNow(new Date(item.sentAt), { addSuffix: true });
    } catch (_) {
      timeAgo = 'recently';
    }

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarCircle}>
            {isImage ? (
              <Image source={{ uri: item.avatar }} style={styles.avatarPhoto} />
            ) : (
              <UserAvatarIcon size={34} color={Colors.accent.primary} />
            )}
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardNickname}>{item.nickname}</Text>
            <Text style={styles.cardHandle}>@{item.sender}</Text>
            <Text style={styles.cardTime}>Requested {timeAgo}</Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => handleAccept(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.acceptBtnText}>Accept ✓</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.declineBtn}
            onPress={() => handleDecline(item.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.declineBtnText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSentItem = ({ item }) => {
    let timeAgo = '';
    try {
      timeAgo = formatDistanceToNow(new Date(item.sentAt), { addSuffix: true });
    } catch (_) {
      timeAgo = 'recently';
    }

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarCircle}>
            <UserAvatarIcon size={34} color={Colors.accent.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardNickname}>@{item.receiver}</Text>
            <Text style={styles.cardTime}>Sent {timeAgo}</Text>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>⏳ Pending Acceptance</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => handleDecline(item.id)}
            style={styles.cancelSentBtn}
          >
            <Text style={styles.cancelSentText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.sm }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg.primary} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Requests</Text>
        <Text style={styles.subtitle}>
          Connect with your intimate partner before chatting
        </Text>
      </View>

      {/* Search & Send Request Box */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <Text style={styles.atSign}>@</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search handle to connect..."
            placeholderTextColor={Colors.text.placeholder}
            value={searchHandle}
            onChangeText={(t) => {
              setSearchHandle(t.toLowerCase().replace(/[^a-z0-9_.]/g, ''));
              setSearchResult(null);
            }}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={handleSearchUser}
          />
          <TouchableOpacity
            style={[styles.searchBtn, searching && { opacity: 0.7 }]}
            onPress={handleSearchUser}
            disabled={searching || !searchHandle.trim()}
          >
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.searchBtnText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Found User Preview Card */}
        {searchResult && (
          <View style={styles.previewCard}>
            <View style={styles.previewInfo}>
              <View style={styles.previewAvatar}>
                {searchResult.avatar_id && (searchResult.avatar_id.startsWith('data:') || searchResult.avatar_id.startsWith('file:') || searchResult.avatar_id.startsWith('http')) ? (
                  <Image source={{ uri: searchResult.avatar_id }} style={styles.avatarPhoto} />
                ) : (
                  <UserAvatarIcon size={30} color={Colors.accent.primary} />
                )}
              </View>
              <View>
                <Text style={styles.previewNick}>{searchResult.nickname || searchResult.handle}</Text>
                <Text style={styles.previewHandle}>@{searchResult.handle}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.sendReqBtn, sendingRequest && { opacity: 0.7 }]}
              onPress={handleSendRequest}
              disabled={sendingRequest}
              activeOpacity={0.85}
            >
              {sendingRequest ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.sendReqBtnText}>Send Request 💕</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Segment Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'received' && styles.tabItemActive]}
          onPress={() => setActiveTab('received')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'received' && styles.tabTextActive,
            ]}
          >
            Received {receivedRequests.length > 0 ? `(${receivedRequests.length})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'sent' && styles.tabItemActive]}
          onPress={() => setActiveTab('sent')}
        >
          <Text
            style={[styles.tabText, activeTab === 'sent' && styles.tabTextActive]}
          >
            Sent {sentRequests.length > 0 ? `(${sentRequests.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Requests List */}
      <FlatList
        data={activeTab === 'received' ? receivedRequests : sentRequests}
        keyExtractor={(item) => item.id}
        renderItem={activeTab === 'received' ? renderReceivedItem : renderSentItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>
              {activeTab === 'received' ? '💌' : '⏳'}
            </Text>
            <Text style={styles.emptyTitle}>
              {activeTab === 'received'
                ? 'No Pending Requests'
                : 'No Sent Requests'}
            </Text>
            <Text style={styles.emptySub}>
              {activeTab === 'received'
                ? 'When someone wants to chat with you, their request will appear here.'
                : 'Search any @handle above to send a chat request.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  searchSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: 'hidden',
  },
  atSign: {
    paddingLeft: Spacing.md,
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: Colors.accent.primary,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: Spacing.xs,
    fontSize: Typography.sizes.sm,
    color: Colors.text.primary,
  },
  searchBtn: {
    backgroundColor: Colors.accent.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: {
    color: '#ffffff',
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
  },
  previewCard: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.accent.glow,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.accent.primary + '33',
  },
  previewInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  previewAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewNick: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  previewHandle: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
  },
  sendReqBtn: {
    backgroundColor: Colors.accent.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: Radius.full,
  },
  sendReqBtnText: {
    color: '#ffffff',
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: Colors.divider,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
  },
  tabItem: {
    paddingVertical: Spacing.sm + 2,
    marginRight: Spacing.xl,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: Colors.accent.primary,
  },
  tabText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.text.placeholder,
  },
  tabTextActive: {
    color: Colors.accent.primary,
    fontWeight: '700',
  },
  listContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl + 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPhoto: {
    width: '100%',
    height: '100%',
  },
  cardInfo: { flex: 1 },
  cardNickname: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  cardHandle: {
    fontSize: Typography.sizes.xs,
    color: Colors.accent.primary,
    fontWeight: '600',
  },
  cardTime: {
    fontSize: Typography.sizes.xs - 1,
    color: Colors.text.placeholder,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider + '55',
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  acceptBtnText: {
    color: '#ffffff',
    fontSize: Typography.sizes.xs + 1,
    fontWeight: '700',
  },
  declineBtn: {
    flex: 1,
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  declineBtnText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.xs + 1,
    fontWeight: '600',
  },
  pendingBadge: {
    marginTop: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  pendingBadgeText: {
    fontSize: Typography.sizes.xs - 2,
    color: '#b45309',
    fontWeight: '700',
  },
  cancelSentBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  cancelSentText: {
    fontSize: Typography.sizes.xs,
    color: Colors.status.error,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl + 10,
  },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.sm },
  emptyTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  emptySub: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
    lineHeight: 18,
  },
});
