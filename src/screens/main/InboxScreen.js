// src/screens/main/InboxScreen.js
// Clean White/Light Pink conversation list with last seen, text status, and multi-select delete

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  StatusBar, RefreshControl, Alert, ActivityIndicator, Image, AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import {
  getAllConversations,
  insertContact,
  upsertConversation,
  insertMessage,
  incrementConversationUnread,
  deleteConversationsBatch,
  markSentMessagesRead,
  markSentMessagesDelivered,
} from '../../db/database';
import {
  findUserByHandle,
  subscribeToMyMessages,
  subscribeToGlobalPresence,
  deleteConversationsBatchFromSupabase,
  markMessagesDeliveredInSupabase,
  sendConnectionRequest,
  fetchAndClearPendingMessages,
  fetchAndProcessPendingAcceptances,
  checkConnectionStatus,
} from '../../services/supabase';
import { saveIncomingBase64ToVault } from '../../services/mediaVault';
import { useUserStore } from '../../store/useUserStore';
import { formatDistanceToNow } from 'date-fns';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import * as ScreenCapture from 'expo-screen-capture';
import { TrashIcon, UserAvatarIcon, CheckIcon, DoubleCheckIcon, ShareIcon } from '../../components/Icons';
import {
  notifyIncomingMessage,
  notifyConnectionRequest,
  notifyRequestAccepted,
} from '../../services/notificationService';
import { shareProfileInvite } from '../../services/inviteService';
import { useBadgeStore } from '../../store/useBadgeStore';

export default function InboxScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  // Screen capture protection: prevent screenshots across the inbox
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
  }, []);
  const [conversations, setConversations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchHandle, setSearchHandle] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedConvIds, setSelectedConvIds] = useState([]);
  const [partnerOnlineMap, setPartnerOnlineMap] = useState({}); // { [handle]: { isOnline, lastSeen } }

  const myHandle = useUserStore((s) => s.handle);
  const myNickname = useUserStore((s) => s.nickname);
  const myAvatarId = useUserStore((s) => s.avatarId);
  const inSelectionMode = selectedConvIds.length > 0;

  const loadConversations = async () => {
    try {
      const data = await getAllConversations();
      setConversations(data || []);
      useBadgeStore.getState().refreshBadges(myHandle);
    } catch (e) {
      console.warn('Inbox load error:', e);
    }
  };

  const syncPendingMessages = useCallback(async () => {
    if (!myHandle) return;
    try {
      // 1. Process any pending connection acceptances
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

          notifyRequestAccepted({
            byHandle: partnerHandle,
            byNickname: partnerNick,
            byAvatar: partnerAvatar,
          });
        }
        await loadConversations();
      }

      // 2. Fetch pending messages
      const queued = await fetchAndClearPendingMessages(myHandle);
      if (!queued || queued.length === 0) return;

      for (const msg of queued) {
        if (!msg.sender || msg.sender.toLowerCase() === myHandle.toLowerCase()) continue;
        const senderHandle = msg.sender.toLowerCase();
        const participants = [myHandle.toLowerCase(), senderHandle].sort();
        const convId = msg.conversation_id || `chat_${participants[0]}_${participants[1]}`;

        const contactId = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          senderHandle
        );

        let contactAvatar = 'avatar_rose';
        let contactNick = senderHandle;
        try {
          const remoteUser = await findUserByHandle(senderHandle);
          if (remoteUser?.avatar_id) contactAvatar = remoteUser.avatar_id;
          if (remoteUser?.nickname) contactNick = remoteUser.nickname;
        } catch (_) {}

        await insertContact({
          id: contactId,
          handle: senderHandle,
          nickname: contactNick,
          avatarId: contactAvatar,
        });

        let localMedia = null;
        if (msg.media_uri) {
          localMedia = await saveIncomingBase64ToVault(msg.id, msg.media_uri);
        }

        await insertMessage({
          id: msg.id,
          conversationId: convId,
          sender: msg.sender,
          type: msg.media_uri ? 'image' : 'text',
          body: msg.body,
          mediaUri: localMedia,
          sentAt: msg.sent_at,
          expiresAt: msg.expires_at,
        });

        await incrementConversationUnread(
          convId,
          msg.body || 'Photo',
          msg.sent_at,
          msg.sender
        );

        markMessagesDeliveredInSupabase(convId, myHandle, msg.sender);

        notifyIncomingMessage({
          senderNickname: contactNick,
          senderHandle,
          text: msg.body || 'Sent a photo 📷',
          conversationId: convId,
          contactAvatarId: contactAvatar,
        });
      }
      await loadConversations();
    } catch (err) {
      console.log('syncPendingMessages error:', err);
    }
  }, [myHandle]);

  useFocusEffect(
    useCallback(() => {
      syncPendingMessages();
      loadConversations();
    }, [syncPendingMessages])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncPendingMessages();
      }
    });
    syncPendingMessages();
    return () => sub.remove();
  }, [syncPendingMessages]);

  // App-level realtime listener for incoming messages to update unread badge
  useEffect(() => {
    if (!myHandle) return;
    const unsubscribe = subscribeToMyMessages(myHandle, async (incoming) => {
      if (incoming && incoming.sender !== myHandle) {
        const senderHandle = incoming.sender.toLowerCase();
        const participants = [myHandle.toLowerCase(), senderHandle].sort();
        const convId = incoming.conversation_id || `chat_${participants[0]}_${participants[1]}`;

        const contactId = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          senderHandle
        );

        let contactAvatar = 'avatar_rose';
        let contactNick = senderHandle;
        try {
          const remoteUser = await findUserByHandle(senderHandle);
          if (remoteUser?.avatar_id) contactAvatar = remoteUser.avatar_id;
          if (remoteUser?.nickname) contactNick = remoteUser.nickname;
        } catch (_) {}

        await insertContact({
          id: contactId,
          handle: senderHandle,
          nickname: contactNick,
          avatarId: contactAvatar,
        });

        // Save incoming photo into private hidden sandbox vault
        let localMedia = null;
        if (incoming.media_uri) {
          localMedia = await saveIncomingBase64ToVault(incoming.id, incoming.media_uri);
        }

        await insertMessage({
          id: incoming.id,
          conversationId: convId,
          sender: incoming.sender,
          type: incoming.media_uri ? 'image' : 'text',
          body: incoming.body,
          mediaUri: localMedia,
          sentAt: incoming.sent_at,
          expiresAt: incoming.expires_at,
        });

        await incrementConversationUnread(
          convId,
          incoming.body || 'Photo',
          incoming.sent_at,
          incoming.sender
        );

        markMessagesDeliveredInSupabase(convId, myHandle, incoming.sender);
        loadConversations();

        notifyIncomingMessage({
          senderNickname: contactNick,
          senderHandle,
          text: incoming.body || 'Sent a photo 📷',
          conversationId: convId,
          contactAvatarId: contactAvatar,
        });
      }
    },
    async (statusEvent) => {
      if (!statusEvent) return;
      if (statusEvent.event === 'messages_seen') {
        if (statusEvent.conversationId) {
          await markSentMessagesRead(statusEvent.conversationId, myHandle);
          loadConversations();
        }
      } else if (statusEvent.event === 'messages_delivered') {
        if (statusEvent.conversationId) {
          await markSentMessagesDelivered(statusEvent.conversationId, myHandle);
          loadConversations();
        }
      } else if (statusEvent.event === 'connection_request_accepted') {
        const partnerHandle = statusEvent.byHandle.toLowerCase();
        const partnerNick = statusEvent.byNickname || partnerHandle;
        const partnerAvatar = statusEvent.byAvatar || 'avatar_rose';

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

        loadConversations();

        notifyRequestAccepted({
          byHandle: partnerHandle,
          byNickname: partnerNick,
          byAvatar: partnerAvatar,
        });

        Alert.alert(
          'Request Accepted! 🎉',
          `@${partnerHandle} accepted your chat request! You can now start chatting.`
        );
      } else if (statusEvent.event === 'incoming_connection_request') {
        notifyConnectionRequest({
          fromHandle: statusEvent.fromHandle,
          fromNickname: statusEvent.fromNickname,
          reqId: statusEvent.reqId,
        });

        Alert.alert(
          'New Chat Request 💌',
          `@${statusEvent.fromHandle} sent you a connection request! Check the Requests tab to accept.`
        );
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [myHandle, myNickname, myAvatarId]);

  // Global Presence: broadcast when user opens the app & listen to all contacts' presence
  useEffect(() => {
    if (!myHandle) return;
    const unsubscribePresence = subscribeToGlobalPresence(
      myHandle,
      null,
      ({ allPresences, lastSeenMap }) => {
        setPartnerOnlineMap({ allPresences, lastSeenMap });
      }
    );
    return () => {
      if (unsubscribePresence) unsubscribePresence();
    };
  }, [myHandle]);

  const onRefresh = async () => {
    setRefreshing(true);
    await syncPendingMessages();
    await loadConversations();
    setRefreshing(false);
  };

  const handleSearchAndConnect = async () => {
    const clean = searchHandle.replace('@', '').trim().toLowerCase();
    if (!clean || clean.length < 3) {
      return Alert.alert('Invalid ID', 'Please enter a valid unique @handle (min 3 chars).');
    }
    if (clean === myHandle?.toLowerCase()) {
      return Alert.alert('Self Chat', "That's your own ID! Enter your partner's unique ID.");
    }

    setSearching(true);
    try {
      // 1. Check comprehensive connection status (local contacts + pending sent + pending received)
      const connStatus = await checkConnectionStatus(myHandle, clean);

      if (connStatus.status === 'connected') {
        const contact = connStatus.contact;
        const participants = [myHandle.toLowerCase(), clean].sort();
        const convId = `chat_${participants[0]}_${participants[1]}`;
        setSearchHandle('');
        setSearching(false);
        return navigation.navigate('Chat', {
          conversationId: convId,
          contactHandle: contact.handle,
          contactNickname: contact.nickname,
          contactAvatarId: contact.avatar_id,
        });
      }

      if (connStatus.status === 'pending_sent') {
        setSearching(false);
        return Alert.alert(
          'Request Pending ⏳',
          `You already sent a chat request to @${clean}. Waiting for them to accept!`,
          [
            { text: 'View Requests', onPress: () => navigation.navigate('Requests') },
            { text: 'OK', style: 'cancel' },
          ]
        );
      }

      if (connStatus.status === 'pending_received') {
        setSearching(false);
        return Alert.alert(
          'Request Waiting! 💌',
          `@${clean} has already sent you a connection request! Go to your Requests tab to accept.`,
          [
            { text: 'Go to Requests', onPress: () => navigation.navigate('Requests') },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }

      // 2. Search in Supabase for user identity
      const remoteUser = await findUserByHandle(clean);
      if (!remoteUser) {
        setSearching(false);
        return Alert.alert(
          'User Not Found',
          `No user found with @${clean}. Please check the handle and try again.`
        );
      }

      setSearching(false);
      // 3. Prompt to send connection request
      Alert.alert(
        'Connect with @' + clean,
        `Would you like to send a chat request to ${remoteUser.nickname || clean} (@${clean})? Once they accept in their Requests tab, your private chat will begin!`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send Request 💕',
            onPress: async () => {
              try {
                await sendConnectionRequest({
                  fromHandle: myHandle,
                  toHandle: clean,
                  fromNickname: myNickname,
                  fromAvatar: myAvatarId,
                });
                setSearchHandle('');
                Alert.alert(
                  'Request Sent! 💌',
                  `Connection request sent to @${clean}! Once they accept, they will appear here in your Messages.`,
                  [
                    {
                      text: 'View Requests',
                      onPress: () => navigation.navigate('Requests'),
                    },
                    { text: 'OK', style: 'cancel' },
                  ]
                );
              } catch (reqErr) {
                Alert.alert('Error', reqErr.message || 'Could not send request');
              }
            },
          },
        ]
      );
    } catch (err) {
      console.error('Search error:', err);
      setSearching(false);
      Alert.alert('Search Error', err.message || 'Could not reach server.');
    } finally {
      setSearching(false);
    }
  };

  const toggleSelectConv = (id) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    setSelectedConvIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const deleteSelectedConversations = () => {
    if (selectedConvIds.length === 0) return;
    Alert.alert(
      'Delete Chats',
      `Delete ${selectedConvIds.length} conversation(s) and all their messages?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const idsToDelete = [...selectedConvIds];
            setSelectedConvIds([]);
            await deleteConversationsBatch(idsToDelete);
            await deleteConversationsBatchFromSupabase(idsToDelete);
            await loadConversations();
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const isSelected = selectedConvIds.includes(item.id);
    const partnerHandle = item.handle ? item.handle.replace('@', '').trim().toLowerCase() : '';
    const isPartnerOnline = !!(partnerOnlineMap.allPresences?.[partnerHandle]?.length > 0);
    const partnerLastSeen = partnerOnlineMap.lastSeenMap?.[partnerHandle];

    const timeAgo = item.last_time
      ? formatDistanceToNow(new Date(item.last_time), { addSuffix: true })
      : '';

    // Check if the current user sent the last message in this conversation
    const lastSender = (item.last_sender || item.latest_sender)?.toLowerCase();
    const isMeSender = lastSender ? (lastSender === myHandle?.toLowerCase()) : false;

    // Outgoing delivery / read status ONLY applies if *I* was the sender!
    let statusText = null;
    let statusColor = '#8a8187';
    let statusType = 'sent'; // 'sent' | 'delivered' | 'seen'

    if (isMeSender) {
      if (item.latest_read === 1 || item.last_status === 'seen') {
        statusText = 'seen';
        statusColor = '#e0527a';
        statusType = 'seen';
      } else if (item.latest_delivered === 1 || item.last_status === 'delivered') {
        statusText = 'delivered';
        statusColor = '#8a8187';
        statusType = 'delivered';
      } else {
        statusText = 'sent';
        statusColor = '#8a8187';
        statusType = 'sent';
      }
    }

    // Show "📷 Photo" emoji-prefixed label for image messages
    let rawLastMsg = item.last_msg;
    if (rawLastMsg === 'Photo') rawLastMsg = '📷 Photo';

    let subtitle = rawLastMsg;
    if (!subtitle) {
      if (isPartnerOnline) {
        subtitle = 'Online now';
      } else if (partnerLastSeen) {
        subtitle = `Last seen ${formatDistanceToNow(new Date(partnerLastSeen), { addSuffix: true })}`;
      } else {
        subtitle = 'No messages yet';
      }
    }

    const hasPhoto = item.avatar_id && (item.avatar_id.startsWith('data:') || item.avatar_id.startsWith('file:') || item.avatar_id.startsWith('http'));

    return (
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected]}
        onLongPress={() => toggleSelectConv(item.id)}
        onPress={() => {
          if (inSelectionMode) {
            toggleSelectConv(item.id);
          } else {
            navigation.navigate('Chat', {
              conversationId: item.id,
              contactHandle: item.handle,
              contactNickname: item.nickname,
              contactAvatarId: item.avatar_id,
            });
          }
        }}
        activeOpacity={0.8}
      >
        {/* Avatar with online dot */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatarCircle}>
            {hasPhoto ? (
              <Image source={{ uri: item.avatar_id }} style={styles.avatarPhoto} />
            ) : (
              <UserAvatarIcon size={26} color={Colors.accent.primary} />
            )}
          </View>
          {isPartnerOnline && <View style={styles.onlineDot} />}
        </View>

        {/* Info: 3-row layout */}
        <View style={styles.info}>
          {/* Row 1: Nickname + Timestamp */}
          <View style={styles.infoTop}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{item.nickname}</Text>
              {isPartnerOnline && <Text style={styles.onlineTag}>● online</Text>}
            </View>
            <Text style={styles.time}>{timeAgo}</Text>
          </View>

          {/* Row 2: Last message preview + status/unread badge */}
          <View style={styles.infoBottom}>
            <Text style={styles.preview} numberOfLines={1}>
              {subtitle}
            </Text>
            <View style={styles.statusBox}>
              {isMeSender && statusText ? (
                <View style={styles.statusRow}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                  {statusType === 'seen' ? (
                    <DoubleCheckIcon size={14} color="#e0527a" />
                  ) : statusType === 'delivered' ? (
                    <DoubleCheckIcon size={14} color="#8a8187" />
                  ) : (
                    <CheckIcon size={14} color="#8a8187" />
                  )}
                </View>
              ) : null}
              {!isMeSender && item.unread > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unread}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Row 3: Last seen hint — shown when offline AND last message exists */}
          {!isPartnerOnline && partnerLastSeen && rawLastMsg ? (
            <Text style={styles.lastSeenHint} numberOfLines={1}>
              last seen {formatDistanceToNow(new Date(partnerLastSeen), { addSuffix: true })}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg.primary} />

      {/* Header */}
      {inSelectionMode ? (
        <View style={[styles.header, styles.selectionHeader]}>
          <TouchableOpacity onPress={() => setSelectedConvIds([])} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.selectionTitle}>{selectedConvIds.length} Selected</Text>
          <TouchableOpacity onPress={deleteSelectedConversations} style={styles.deleteBtn}>
            <TrashIcon size={18} color="#fff" />
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Messages</Text>
            <Text style={styles.headerSub}>@{myHandle}</Text>
          </View>
          <TouchableOpacity
            style={styles.headerInviteBtn}
            onPress={() => shareProfileInvite(myHandle, myNickname)}
            activeOpacity={0.8}
          >
            <ShareIcon size={16} color={Colors.accent.primary} />
            <Text style={styles.headerInviteText}>Invite</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Horizontal Search Box */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <Text style={styles.searchPrefix}>@</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search unique ID to chat..."
            placeholderTextColor={Colors.text.placeholder}
            value={searchHandle}
            onChangeText={(t) => setSearchHandle(t.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={handleSearchAndConnect}
          />
          <TouchableOpacity
            style={[styles.searchBtn, (!searchHandle.trim() || searching) && styles.searchBtnDisabled]}
            onPress={handleSearchAndConnect}
            disabled={!searchHandle.trim() || searching}
            activeOpacity={0.8}
          >
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.searchBtnText}>Chat</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Conversations List */}
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💌</Text>
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySub}>Type your lover's unique ID in the search bar above to start chatting</Text>
          </View>
        }
        contentContainerStyle={conversations.length === 0 && styles.emptyContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: Colors.bg.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent.glow,
    borderWidth: 1,
    borderColor: Colors.accent.primary + '44',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  headerInviteText: {
    fontSize: Typography.sizes.xs,
    color: Colors.accent.primary,
    fontWeight: '700',
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.accent.soft,
  },
  cancelBtn: { padding: 4 },
  cancelBtnText: { fontSize: 20, color: Colors.text.primary, fontWeight: '700' },
  selectionTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: Colors.text.primary,
    flex: 1,
    marginLeft: 16,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.status.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  deleteBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.sizes.xs },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.accent.primary,
    marginTop: 2,
    fontWeight: '600',
  },
  searchSection: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: Colors.bg.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.divider,
    paddingHorizontal: 14,
    height: 46,
  },
  searchPrefix: {
    color: Colors.accent.primary,
    fontSize: 16,
    fontWeight: '700',
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: Typography.sizes.md,
    height: '100%',
  },
  searchBtn: {
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnDisabled: {
    backgroundColor: '#e6dfe3',
  },
  searchBtnText: {
    color: '#fff',
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.bg.primary,
    gap: Spacing.md,
  },
  rowSelected: {
    backgroundColor: Colors.accent.soft,
  },
  avatarWrap: { position: 'relative' },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.accent.light,
    overflow: 'hidden',
  },
  avatarPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.status.online,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  info: { flex: 1, gap: 4 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  onlineTag: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.status.online,
  },
  infoTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: Colors.text.primary,
    flex: 1,
  },
  time: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.placeholder,
    marginLeft: Spacing.sm,
  },
  preview: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    flex: 1,
  },
  lastSeenHint: {
    fontSize: 11,
    color: Colors.text.placeholder,
    fontStyle: 'italic',
    marginTop: 1,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: Spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  unreadBadge: {
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  emptyContainer: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 100,
    gap: Spacing.sm,
  },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.sm },
  emptyText: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
});
