// src/screens/main/ChatScreen.js
// Unified Curious Animal Chat Screen styled with the Claude AI Design System.
// Combines rich chat history (bubbles, media photos, swipe-reply, ticks)
// with the interactive Animal Stage (Panda & Cat reactive talking/typing companions)
// and the Claude pill composer with terracotta send button.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  Animated,
  Image,
  PanResponder,
  Modal,
  Keyboard,
  AppState,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenCapture from 'expo-screen-capture';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowUp,
  Plus,
  Phone,
  Video,
  ChevronLeft,
  Lock,
  MoreVertical,
  X,
  Trash2,
  CornerDownRight,
  Clock,
  Shield,
  ShieldCheck,
  Check,
  CheckCheck,
} from 'lucide-react-native';

import { useUserStore } from '../../store/useUserStore';
import { useBadgeStore } from '../../store/useBadgeStore';
import { CharacterAvatar } from '../../animal_ui/components/CharacterAvatar.js';
import { SpeechBubble } from '../../animal_ui/components/SpeechBubble.js';
import { character as timing } from '../../animal_ui/theme/motion.js';
import {
  getMessages,
  insertMessage,
  markConversationRead,
  updateConversationLastMessage,
  deleteMessagesBatch,
  clearConversationMessages,
  markSentMessagesRead,
  markSentMessagesDelivered,
  ensureConversationExists,
} from '../../db/database';
import {
  saveIncomingBase64ToVault,
  saveOutgoingImageToVault,
  requestStoragePermissionAndInit,
} from '../../services/mediaVault';
import {
  supabase,
  sendMessageToSupabase,
  fetchAndClearPendingMessages,
  subscribeToConversation,
  subscribeToGlobalPresence,
  broadcastMessageDelete,
  deleteConversationFromSupabase,
  broadcastTypingStatus,
  markMessagesSeenInSupabase,
  markMessagesDeliveredInSupabase,
  requestScreenshotPermission,
  respondScreenshotPermission,
  notifyScreenshotTaken,
} from '../../services/supabase';
import {
  setActiveConversation,
  notifySecurityAlert,
  notifyScreenshotRequest,
} from '../../services/notificationService';

// Claude Theme Palette
const PALETTE = {
  bg: '#FAF9F5',
  surface: '#FFFFFF',
  surfaceMuted: '#F0EEE6',
  text: '#141413',
  textSecondary: '#5E5D59',
  textMuted: '#87867F',
  border: 'rgba(20,20,19,0.12)',
  borderStrong: 'rgba(20,20,19,0.22)',
  brand: '#D97757', // Claude clay terracotta
  onBrand: '#FFFFFF',
  info: '#2C84DB',
  danger: '#C0392B',
  bubbleMe: '#F0EEE6',
  bubbleThem: '#FFFFFF',
};

// Hook for mouth talking animation trigger on new message
function useRecentlyChanged(value, ms) {
  const [active, setActive] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!value) return;
    setActive(true);
    const id = setTimeout(() => setActive(false), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return active;
}

// Swipeable Message Row for Quoted Reply
function SwipeableMessageRow({ item, isMe, inSelectionMode, onSwipeReply, children }) {
  const panX = useRef(new Animated.Value(0)).current;
  const [swiping, setSwiping] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (inSelectionMode) return false;
        const isHorizontal = Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dy) < 18;
        return isHorizontal && (isMe ? gestureState.dx < -8 : gestureState.dx > 8);
      },
      onPanResponderGrant: () => setSwiping(true),
      onPanResponderMove: (_, gestureState) => {
        const clamped = isMe
          ? Math.max(gestureState.dx, -60)
          : Math.min(gestureState.dx, 60);
        panX.setValue(clamped);
      },
      onPanResponderRelease: (_, gestureState) => {
        setSwiping(false);
        const triggered = isMe ? gestureState.dx < -40 : gestureState.dx > 40;
        if (triggered) {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch (_) {}
          onSwipeReply(item);
        }
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 200,
          friction: 20,
        }).start();
      },
    })
  ).current;

  return (
    <View style={styles.swipeRowWrapper}>
      <Animated.View style={{ transform: [{ translateX: panX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

export default function ChatScreen({ route, navigation }) {
  const {
    conversationId,
    contactHandle,
    contactNickname,
    contactAvatarId,
  } = route.params || {};

  const insets = useSafeAreaInsets();
  const myHandle = useUserStore((s) => s.handle);
  const myNickname = useUserStore((s) => s.nickname);
  const myAvatarId = useUserStore((s) => s.avatarId || s.avatarUri);
  const defaultExpiry = useUserStore((s) => s.defaultExpiry);
  const setDefaultExpiry = useUserStore((s) => s.setDefaultExpiry);

  const myCharacter = useUserStore((s) => s.myCharacter) || 'panda';
  const setMyCharacter = useUserStore((s) => s.setMyCharacter);

  const [friendCharacter, setFriendCharacter] = useState('cat');
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [pickingFor, setPickingFor] = useState('me');

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [viewingPhotoUri, setViewingPhotoUri] = useState(null);
  const [isAnimalStageExpanded, setIsAnimalStageExpanded] = useState(true);

  // Online & Typing states
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [partnerLastSeen, setPartnerLastSeen] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  // Latest messages for speech bubbles
  const [myLastMessage, setMyLastMessage] = useState('');
  const [friendLastMessage, setFriendLastMessage] = useState('');

  // Screenshot defense states
  const [screenshotAllowed, setScreenshotAllowed] = useState(false);
  const [requestPending, setRequestPending] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(60);
  const screenshotAllowedRef = useRef(false);

  // Selection & Header menu states
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const inSelectionMode = selectedMessageIds.length > 0;
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);

  const flatRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const myTypingTimerRef = useRef(null);
  const isTypingRef = useRef(false);

  // Talking animations
  const meTalking = useRecentlyChanged(myLastMessage, timing.talkHold);
  const friendTalking = useRecentlyChanged(friendLastMessage, timing.talkHold);

  const myAnimalState = isTyping ? 'typing' : meTalking ? 'talking' : 'idle';
  const friendAnimalState = isPartnerTyping ? 'typing' : friendTalking ? 'talking' : 'idle';

  // Load messages from SQLite database
  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      await ensureConversationExists(conversationId, contactHandle, contactNickname, contactAvatarId);
      const dbMsgs = await getMessages(conversationId);
      const sorted = (dbMsgs || []).reverse(); // Oldest first, newest at bottom
      setMessages(sorted);

      const myMsgs = sorted.filter((m) => m.sender === myHandle);
      const friendMsgs = sorted.filter((m) => m.sender !== myHandle);

      if (myMsgs.length > 0) {
        setMyLastMessage(myMsgs[myMsgs.length - 1].body || '📷 Photo');
      }
      if (friendMsgs.length > 0) {
        setFriendLastMessage(friendMsgs[friendMsgs.length - 1].body || '📷 Photo');
      }
    } catch (err) {
      console.warn('ChatScreen loadMessages note:', err.message);
    }
  }, [conversationId, contactHandle, contactNickname, contactAvatarId, myHandle]);

  // Realtime listeners & setup
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    setActiveConversation(conversationId);
    loadMessages();

    // 1. Subscribe to realtime messages, typing status, delivery/read ACKs & deletions
    const unsubscribeMessages = subscribeToConversation(
      conversationId,
      async (newMsg) => {
        if (newMsg && newMsg.sender !== myHandle) {
          let mediaDataUri = newMsg.media_uri;
          let fullBody = newMsg.body;

          // If incoming was lightweight broadcast with has_media: true, fetch full payload
          if (newMsg.has_media && !mediaDataUri) {
            try {
              const { data: fullMsg } = await supabase
                .from('messages')
                .select('body, media_uri')
                .eq('id', newMsg.id)
                .maybeSingle();
              if (fullMsg) {
                mediaDataUri = fullMsg.media_uri;
                fullBody = fullMsg.body || fullBody;
              }
            } catch (_) {}
          }

          // ZERO-STORAGE: Immediately delete message row from Supabase!
          try {
            await supabase.from('messages').delete().eq('id', newMsg.id);
          } catch (_) {}

          let localMedia = null;
          if (mediaDataUri) {
            localMedia = await saveIncomingBase64ToVault(newMsg.id, mediaDataUri);
          }
          const storedMsg = {
            id: newMsg.id,
            conversationId: newMsg.conversation_id || conversationId,
            sender: newMsg.sender,
            type: (mediaDataUri || newMsg.has_media) ? 'image' : 'text',
            body: fullBody,
            mediaUri: localMedia,
            sentAt: newMsg.sent_at || Date.now(),
            expiresAt: newMsg.expires_at || null,
            replyTo: newMsg.reply_to || null,
            read: 1,
            delivered: 1,
          };
          await insertMessage(storedMsg);
          await updateConversationLastMessage(
            conversationId,
            localMedia ? 'Photo' : (fullBody || ''),
            newMsg.sent_at || Date.now(),
            newMsg.sender
          );
          await markConversationRead(conversationId, myHandle);
          useBadgeStore.getState().refreshBadges(myHandle);

          setFriendLastMessage(fullBody || '📷 Photo');
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, storedMsg];
          });
          markMessagesDeliveredInSupabase(conversationId, myHandle, contactHandle);
          markMessagesSeenInSupabase(conversationId, myHandle, contactHandle);

          setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch (_) {}
        }
      },
      async (secEvent) => {
        if (!secEvent) return;

        // Delivery ACK event (double tick)
        if (secEvent.event === 'messages_delivered') {
          setMessages((prev) =>
            prev.map((m) => (m.sender === myHandle && m.delivered === 0 ? { ...m, delivered: 1 } : m))
          );
          await markSentMessagesDelivered(conversationId, myHandle);
          return;
        }

        // Read ACK event (blue double tick)
        if (secEvent.event === 'messages_seen') {
          setMessages((prev) =>
            prev.map((m) => (m.sender === myHandle ? { ...m, read: 1, delivered: 1 } : m))
          );
          await markSentMessagesRead(conversationId, myHandle);
          return;
        }

        // Deletion event ("Delete for Everyone")
        if (secEvent.event === 'delete_messages') {
          const delIds = secEvent.payload?.messageIds || secEvent.messageIds || [];
          if (delIds.length > 0) {
            setMessages((prev) => prev.filter((m) => !delIds.includes(m.id)));
            await deleteMessagesBatch(delIds);
            loadMessages();
          }
          return;
        }

        // Typing event
        if (secEvent.event === 'typing_status') {
          if (secEvent.sender?.toLowerCase() !== myHandle?.toLowerCase()) {
            setIsPartnerTyping(!!secEvent.isTyping);
            if (secEvent.isTyping) {
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = setTimeout(() => setIsPartnerTyping(false), 4000);
            }
          }
          return;
        }

        // Screenshot events
        if (secEvent.event === 'screenshot_request' && secEvent.requesterHandle !== myHandle) {
          Alert.alert(
            'Screenshot Request 🛡️',
            `@${secEvent.requesterHandle} requested permission to take a screenshot. Allow for 60 seconds?`,
            [
              {
                text: 'Deny',
                style: 'cancel',
                onPress: () => respondScreenshotPermission(conversationId, myHandle, false),
              },
              {
                text: 'Allow',
                onPress: () => respondScreenshotPermission(conversationId, myHandle, true, 60),
              },
            ]
          );
        }

        if (secEvent.event === 'screenshot_response' && secEvent.responderHandle !== myHandle) {
          setRequestPending(false);
          if (secEvent.approved) {
            setScreenshotAllowed(true);
            ScreenCapture.allowScreenCaptureAsync().catch(() => {});
          } else {
            setScreenshotAllowed(false);
            ScreenCapture.preventScreenCaptureAsync().catch(() => {});
          }
        }
      }
    );

    // 2. Subscribe to partner global online presence
    const unsubscribePresence = subscribeToGlobalPresence(
      myHandle,
      contactHandle,
      ({ isOnline, lastSeen }) => {
        setIsPartnerOnline(isOnline);
        if (lastSeen) setPartnerLastSeen(lastSeen);
      }
    );

    return () => {
      setActiveConversation(null);
      markConversationRead(conversationId, myHandle);
      useBadgeStore.getState().refreshBadges(myHandle);
      if (unsubscribeMessages) unsubscribeMessages();
      if (unsubscribePresence) unsubscribePresence();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (myTypingTimerRef.current) clearTimeout(myTypingTimerRef.current);
      if (isTypingRef.current) {
        broadcastTypingStatus(conversationId, myHandle, false);
      }
    };
  }, [conversationId, contactHandle, loadMessages, myHandle]);

  // Sync queued pending messages on resume
  useEffect(() => {
    const sync = async () => {
      try {
        const queued = await fetchAndClearPendingMessages(myHandle);
        if (queued && queued.length > 0) {
          for (const msg of queued) {
            let localMedia = null;
            if (msg.media_uri) {
              localMedia = await saveIncomingBase64ToVault(msg.id, msg.media_uri);
            }
            await insertMessage({
              id: msg.id,
              conversationId: msg.conversation_id || conversationId,
              sender: msg.sender,
              type: msg.media_uri ? 'image' : 'text',
              body: msg.body,
              mediaUri: localMedia,
              sentAt: msg.sent_at || msg.created_at || Date.now(),
              expiresAt: msg.expires_at || null,
              delivered: 1,
              read: 1,
            });
          }
          await loadMessages();
        }
        markMessagesDeliveredInSupabase(conversationId, myHandle, contactHandle);
        markMessagesSeenInSupabase(conversationId, myHandle, contactHandle);
      } catch (_) {}
    };
    sync();
  }, [conversationId, contactHandle, loadMessages, myHandle]);

  // Handle typing status
  const handleTyping = (text) => {
    setInputText(text);
    const hasText = text.trim().length > 0;
    setIsTyping(hasText);

    if (hasText) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        broadcastTypingStatus(conversationId, myHandle, true);
      }
      if (myTypingTimerRef.current) clearTimeout(myTypingTimerRef.current);
      myTypingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        broadcastTypingStatus(conversationId, myHandle, false);
      }, 3000);
    } else if (isTypingRef.current) {
      isTypingRef.current = false;
      broadcastTypingStatus(conversationId, myHandle, false);
    }
  };

  // Send message
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    setIsTyping(false);

    if (myTypingTimerRef.current) clearTimeout(myTypingTimerRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      broadcastTypingStatus(conversationId, myHandle, false);
    }

    const replying = replyingTo;
    setReplyingTo(null);

    const now = Date.now();
    const expiresAt = defaultExpiry ? now + defaultExpiry * 1000 : null;
    const id = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${myHandle}-${now}-${Math.random()}`
    );

    let replyPayload = null;
    if (replying) {
      replyPayload = {
        replyToId: replying.id,
        replyAuthor: replying.sender === myHandle ? 'You' : contactNickname,
        replySnippet: replying.body ? (replying.body.length > 50 ? replying.body.slice(0, 50) + '...' : replying.body) : 'Photo',
      };
    }

    const msg = {
      id,
      conversationId,
      sender: myHandle,
      type: 'text',
      body: text,
      replyTo: replyPayload ? JSON.stringify(replyPayload) : null,
      sentAt: now,
      expiresAt,
      delivered: 0,
      read: 0,
    };

    setMyLastMessage(text);
    try {
      await ensureConversationExists(conversationId, contactHandle, contactNickname, contactAvatarId);
      await insertMessage(msg);
      await updateConversationLastMessage(conversationId, text, now, myHandle, 'sent');
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);

      sendMessageToSupabase({
        id,
        conversationId,
        sender: myHandle,
        receiver: contactHandle,
        body: text,
        mediaUri: null,
        sentAt: now,
        expiresAt,
        replyTo: replyPayload ? JSON.stringify(replyPayload) : null,
      });

      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (_) {}
    } catch (e) {
      console.warn('Failed to send message:', e);
      Alert.alert('Error', `Failed to send: ${e?.message || e}`);
    }
  };

  // Send photo / media (GIANT FULL SIZE - user device local storage)
  const handlePickPhoto = async () => {
    try {
      const permitted = await requestStoragePermissionAndInit();
      if (!permitted) {
        return Alert.alert('Storage Access Needed', 'Allow storage access to encrypt and save private photos.');
      }
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return Alert.alert('Gallery Access Needed', 'Allow gallery access to select photos.');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 1.0, // GIANT FULL SIZE: 1.0 full original resolution!
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const now = Date.now();
        const id = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          `${myHandle}-${now}-${Math.random()}`
        );

        // Save giant full-size media directly into private local vault (.secure_media/)
        const { vaultUri, base64DataUri } = await saveOutgoingImageToVault(
          asset.uri,
          asset.width,
          asset.height
        );

        const msg = {
          id,
          conversationId,
          sender: myHandle,
          type: 'image',
          body: 'Photo',
          mediaUri: vaultUri || asset.uri,
          sentAt: now,
          read: 0,
          delivered: 0,
        };

        setMyLastMessage('📷 Photo');
        await ensureConversationExists(conversationId, contactHandle, contactNickname, contactAvatarId);
        await insertMessage(msg);
        await updateConversationLastMessage(conversationId, 'Photo', now, myHandle, 'sent');
        setMessages((prev) => [...prev, msg]);
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);

        sendMessageToSupabase({
          id,
          conversationId,
          sender: myHandle,
          receiver: contactHandle,
          body: 'Photo',
          mediaUri: base64DataUri,
          sentAt: now,
        });
      }
    } catch (err) {
      console.warn('Send image error:', err);
    }
  };

  const handleMessageLongPress = (msgItem) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    const isMyMsg = msgItem.sender === myHandle;
    const options = [];

    if (isMyMsg) {
      options.push({
        text: 'Delete for Everyone',
        style: 'destructive',
        onPress: async () => {
          await deleteMessagesBatch([msgItem.id]);
          await broadcastMessageDelete(conversationId, [msgItem.id], contactHandle);
          setMessages((prev) => prev.filter((m) => m.id !== msgItem.id));
          loadMessages();
        },
      });
    }

    options.push({
      text: 'Delete for Me',
      style: 'destructive',
      onPress: async () => {
        await deleteMessagesBatch([msgItem.id]);
        setMessages((prev) => prev.filter((m) => m.id !== msgItem.id));
        loadMessages();
      },
    });

    options.push({
      text: 'Cancel',
      style: 'cancel',
    });

    Alert.alert('Message Options', isMyMsg ? 'Delete this message?' : 'Delete message from this device?', options);
  };

  // Render individual chat bubble
  const renderMessageItem = ({ item }) => {
    const isMe = item.sender === myHandle;
    const mediaUri = item.media_uri || item.mediaUri;
    const timeStr = new Date(item.sent_at || item.sentAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    let replyData = null;
    if (item.replyTo || item.reply_to) {
      try {
        replyData = JSON.parse(item.replyTo || item.reply_to);
      } catch (_) {}
    }

    const hasValidPhoto =
      mediaUri &&
      (mediaUri.startsWith('file:') || mediaUri.startsWith('data:') || mediaUri.startsWith('http'));

    const isShortText =
      !hasValidPhoto &&
      !replyData &&
      item.body &&
      item.body.length < 32 &&
      !item.body.includes('\n');

    return (
      <SwipeableMessageRow
        item={item}
        isMe={isMe}
        inSelectionMode={inSelectionMode}
        onSwipeReply={setReplyingTo}
      >
        <TouchableOpacity
          activeOpacity={0.88}
          onLongPress={() => handleMessageLongPress(item)}
          style={[
            styles.bubbleWrap,
            isMe ? styles.bubbleWrapMe : styles.bubbleWrapThem,
          ]}
        >
          <View
            style={[
              styles.bubble,
              isMe ? styles.bubbleMe : styles.bubbleThem,
              replyData && styles.bubbleWithReply,
            ]}
          >
            {/* Quoted Reply Snippet */}
            {replyData && (
              <View style={[styles.replySnippetBox, isMe ? styles.replyBoxMe : styles.replyBoxThem]}>
                <View style={[styles.replyBar, isMe ? styles.replyBarMe : styles.replyBarThem]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.replyAuthor}>{replyData.replyAuthor}</Text>
                  <Text style={styles.replyText} numberOfLines={1}>{replyData.replySnippet}</Text>
                </View>
              </View>
            )}

            {/* Media Image */}
            {hasValidPhoto && (
              <TouchableOpacity activeOpacity={0.9} onPress={() => setViewingPhotoUri(mediaUri)}>
                <Image source={{ uri: mediaUri }} style={styles.messagePhoto} resizeMode="cover" />
              </TouchableOpacity>
            )}

            {/* Inline Short Text */}
            {isShortText ? (
              <View style={styles.inlineShortRow}>
                <Text style={[styles.bodyText, { color: PALETTE.text }]}>{item.body}</Text>
                <View style={styles.metaRowInline}>
                  {item.expires_at ? <Clock size={10} color={PALETTE.textMuted} /> : null}
                  <Text style={styles.timeText}>{timeStr}</Text>
                  {isMe && (
                    item.read === 1 ? (
                      <CheckCheck size={13} color={PALETTE.brand} />
                    ) : item.delivered === 1 ? (
                      <CheckCheck size={13} color={PALETTE.textMuted} />
                    ) : (
                      <Check size={13} color={PALETTE.textMuted} />
                    )
                  )}
                </View>
              </View>
            ) : (
              <>
                {item.body && (!hasValidPhoto || item.body !== 'Photo') && (
                  <Text style={[styles.bodyText, { color: PALETTE.text }]}>{item.body}</Text>
                )}
                <View style={styles.metaRow}>
                  {item.expires_at ? <Clock size={10} color={PALETTE.textMuted} /> : null}
                  <Text style={styles.timeText}>{timeStr}</Text>
                  {isMe && (
                    item.read === 1 ? (
                      <CheckCheck size={13} color={PALETTE.brand} />
                    ) : item.delivered === 1 ? (
                      <CheckCheck size={13} color={PALETTE.textMuted} />
                    ) : (
                      <Check size={13} color={PALETTE.textMuted} />
                    )
                  )}
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </SwipeableMessageRow>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor={PALETTE.bg} />

      {/* Claude Minimalist Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={24} color={PALETTE.text} />
        </TouchableOpacity>

        {/* Center: Contact Info */}
        <TouchableOpacity style={styles.headerTitleBox} onPress={() => setShowHeaderMenu(true)}>
          <View style={styles.headerAvatarWrap}>
            <View style={styles.headerAvatarCircle}>
              <Text style={styles.headerAvatarLetter}>
                {(contactNickname || contactHandle || 'F').charAt(0).toUpperCase()}
              </Text>
            </View>
            {isPartnerOnline && <View style={styles.onlineDot} />}
          </View>

          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.headerName} numberOfLines={1}>
              {contactNickname || contactHandle || 'Friend'}
            </Text>
            <View style={styles.headerSubRow}>
              <Lock size={10} color={PALETTE.textMuted} />
              <Text style={styles.headerSubText}>
                {isPartnerOnline ? 'online now' : partnerLastSeen ? 'recently active' : 'end-to-end encrypted'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Action Buttons */}
        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => navigation.navigate('Call', {
            contactHandle,
            contactNickname,
            contactAvatarId,
            callType: 'voice',
          })}
        >
          <Phone size={19} color={PALETTE.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => navigation.navigate('Call', {
            contactHandle,
            contactNickname,
            contactAvatarId,
            callType: 'video',
          })}
        >
          <Video size={20} color={PALETTE.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => {
            if (screenshotAllowed) {
              Alert.alert('Screenshot Shield', 'Screenshot is currently allowed for this chat.');
            } else {
              setRequestPending(true);
              requestScreenshotPermission(conversationId, myHandle);
              Alert.alert('Shield Request Sent', 'Requested partner permission for 60-second screenshot access.');
            }
          }}
        >
          {screenshotAllowed ? (
            <ShieldCheck size={19} color="#2F7D4F" />
          ) : (
            <Shield size={19} color={PALETTE.text} />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerActionBtn} onPress={() => setShowHeaderMenu(true)}>
          <MoreVertical size={19} color={PALETTE.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Message Stream */}
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messageListContent}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        />

        {/* 🎭 The Interactive Animal Stage (Sitting right above composer) */}
        {isAnimalStageExpanded ? (
          <View style={styles.animalStageContainer}>
            {/* Minimize handle */}
            <TouchableOpacity
              onPress={() => setIsAnimalStageExpanded(false)}
              style={styles.stageToggleHandle}
            >
              <Text style={styles.stageToggleText}>
                {myCharacter === 'panda' ? '🐼' : myCharacter === 'cat' ? '🐱' : '🐶'}
                {'  Tap to minimize companions  '}
                {friendCharacter === 'panda' ? '🐼' : friendCharacter === 'cat' ? '🐱' : '🐶'}
              </Text>
            </TouchableOpacity>

            <View style={styles.animalColumnsRow}>
              {/* Left Column: My Character */}
              <View style={styles.animalColumn}>
                <SpeechBubble
                  text={myLastMessage || 'Ready to chat 🌿'}
                  typing={isTyping}
                />
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setPickingFor('me');
                    setShowCharacterModal(true);
                  }}
                  style={styles.characterAvatarWrap}
                >
                  <CharacterAvatar
                    character={myCharacter}
                    state={myAnimalState}
                    size={95}
                    tilt={4}
                  />
                </TouchableOpacity>
                <Text style={styles.animalNameLabel}>You ({myCharacter})</Text>
              </View>

              {/* Right Column: Friend Character */}
              <View style={styles.animalColumn}>
                <SpeechBubble
                  text={friendLastMessage || 'Waiting... ✨'}
                  typing={isPartnerTyping}
                />
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setPickingFor('friend');
                    setShowCharacterModal(true);
                  }}
                  style={styles.characterAvatarWrap}
                >
                  <CharacterAvatar
                    character={friendCharacter}
                    state={friendAnimalState}
                    size={95}
                    tilt={-4}
                  />
                </TouchableOpacity>
                <Text style={styles.animalNameLabel}>
                  {contactNickname || contactHandle || 'Friend'} ({friendCharacter})
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setIsAnimalStageExpanded(true)}
            style={styles.collapsedStageBar}
          >
            <Text style={styles.collapsedStageText}>
              🐼 Expand Animated Stage 🐱
            </Text>
          </TouchableOpacity>
        )}

        {/* Quoted Reply Preview Bar */}
        {replyingTo && (
          <View style={styles.replyPreviewBar}>
            <CornerDownRight size={16} color={PALETTE.brand} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.replyPreviewAuthor}>
                Replying to {replyingTo.sender === myHandle ? 'yourself' : contactNickname}
              </Text>
              <Text style={styles.replyPreviewSnippet} numberOfLines={1}>
                {replyingTo.body || 'Photo'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ padding: 4 }}>
              <X size={16} color={PALETTE.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* 🎨 Claude Pill Composer */}
        <View style={styles.composerWrapper}>
          <View style={styles.composerBox}>
            <TextInput
              style={styles.composerInput}
              value={inputText}
              onChangeText={handleTyping}
              placeholder="Say something sweet..."
              placeholderTextColor={PALETTE.textMuted}
              multiline
              maxLength={2000}
            />
            <View style={styles.composerControlsRow}>
              {/* Photo attachment button */}
              <TouchableOpacity
                onPress={handlePickPhoto}
                style={styles.composerAddBtn}
                activeOpacity={0.7}
              >
                <Plus size={18} color={PALETTE.textSecondary} />
              </TouchableOpacity>

              {/* Terracotta Clay circular send button */}
              <TouchableOpacity
                onPress={handleSend}
                disabled={!inputText.trim()}
                style={[
                  styles.composerSendBtn,
                  inputText.trim() ? styles.composerSendActive : styles.composerSendDisabled,
                ]}
                activeOpacity={0.8}
              >
                <ArrowUp size={18} color={inputText.trim() ? PALETTE.onBrand : PALETTE.textMuted} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Character Selector Modal */}
      <Modal
        visible={showCharacterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCharacterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCharacterModal(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Choose {pickingFor === 'me' ? 'Your' : `${contactNickname || 'Friend'}'s`} Persona
            </Text>
            <Text style={styles.modalSubtitle}>
              Tap to switch animated companion on the stage
            </Text>

            <View style={styles.modalCharactersRow}>
              {[
                { id: 'panda', name: 'Panda 🐼' },
                { id: 'cat', name: 'Cat 🐱' },
                { id: 'puppy', name: 'Puppy 🐶' },
              ].map((item) => {
                const active = (pickingFor === 'me' ? myCharacter : friendCharacter) === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => {
                      if (pickingFor === 'me') {
                        setMyCharacter(item.id);
                      } else {
                        setFriendCharacter(item.id);
                      }
                      setShowCharacterModal(false);
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch (_) {}
                    }}
                    style={[
                      styles.modalOption,
                      active && styles.modalOptionActive,
                    ]}
                  >
                    <CharacterAvatar character={item.id} state="idle" size={75} />
                    <Text style={[styles.modalOptionText, active && { color: PALETTE.brand, fontWeight: '700' }]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Header More Options Sheet */}
      <Modal
        visible={showHeaderMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHeaderMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowHeaderMenu(false)}
        >
          <View style={styles.menuSheetCard}>
            <Text style={styles.menuSheetTitle}>Chat Settings</Text>

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                setShowHeaderMenu(false);
                setShowExpiryPicker(true);
              }}
            >
              <Clock size={18} color={PALETTE.text} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.menuRowLabel}>Disappearing Messages</Text>
                <Text style={styles.menuRowSub}>
                  {defaultExpiry ? `${defaultExpiry} seconds` : 'Off (Keep Forever)'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                setShowHeaderMenu(false);
                Alert.alert(
                  'Clear History',
                  'Erase all local messages in this conversation?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear All',
                      style: 'destructive',
                      onPress: async () => {
                        await clearConversationMessages(conversationId);
                        setMessages([]);
                        setMyLastMessage('');
                        setFriendLastMessage('');
                      },
                    },
                  ]
                );
              }}
            >
              <Trash2 size={18} color={PALETTE.danger} />
              <Text style={[styles.menuRowLabel, { color: PALETTE.danger, marginLeft: 10 }]}>
                Clear Chat History
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Expiry Selector Modal */}
      <Modal
        visible={showExpiryPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExpiryPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowExpiryPicker(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Disappearing Messages</Text>
            <Text style={styles.modalSubtitle}>New messages will automatically purge after:</Text>
            {[
              { label: 'Off (Keep Forever)', value: null },
              { label: '30 seconds', value: 30 },
              { label: '5 minutes', value: 300 },
              { label: '1 hour', value: 3600 },
              { label: '24 hours', value: 86400 },
            ].map((opt) => (
              <TouchableOpacity
                key={String(opt.value)}
                style={styles.expiryItem}
                onPress={() => {
                  setDefaultExpiry(opt.value);
                  setShowExpiryPicker(false);
                }}
              >
                <Text style={styles.expiryItemText}>{opt.label}</Text>
                {defaultExpiry === opt.value && <Check size={16} color={PALETTE.brand} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full-Screen Photo Viewer Modal */}
      <Modal
        visible={!!viewingPhotoUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingPhotoUri(null)}
      >
        <View style={styles.photoViewerBackdrop}>
          <TouchableOpacity style={styles.photoCloseBtn} onPress={() => setViewingPhotoUri(null)}>
            <X size={26} color="#FFFFFF" />
          </TouchableOpacity>
          {viewingPhotoUri ? (
            <Image
              source={{ uri: viewingPhotoUri }}
              style={styles.photoFullImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PALETTE.bg,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.border,
    backgroundColor: PALETTE.bg,
  },
  headerBtn: {
    padding: 6,
  },
  headerTitleBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  headerAvatarWrap: {
    position: 'relative',
  },
  headerAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: PALETTE.surfaceMuted,
    borderWidth: 1,
    borderColor: PALETTE.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: PALETTE.text,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2F7D4F',
    borderWidth: 1.5,
    borderColor: PALETTE.bg,
  },
  headerName: {
    fontSize: 15,
    fontWeight: '600',
    color: PALETTE.text,
  },
  headerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  headerSubText: {
    fontSize: 11,
    color: PALETTE.textMuted,
  },
  headerActionBtn: {
    padding: 8,
    marginLeft: 2,
  },
  chatArea: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  swipeRowWrapper: {
    marginVertical: 1,
  },
  bubbleWrap: {
    flexDirection: 'row',
    width: '100%',
  },
  bubbleWrapMe: {
    justifyContent: 'flex-end',
  },
  bubbleWrapThem: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleMe: {
    backgroundColor: PALETTE.bubbleMe,
    borderColor: PALETTE.borderStrong,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: PALETTE.bubbleThem,
    borderColor: PALETTE.border,
    borderBottomLeftRadius: 4,
  },
  bubbleWithReply: {
    minWidth: 180,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 20,
  },
  inlineShortRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  metaRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
    color: PALETTE.textMuted,
  },
  messagePhoto: {
    width: 220,
    height: 160,
    borderRadius: 12,
    marginBottom: 4,
  },
  replySnippetBox: {
    flexDirection: 'row',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  replyBoxMe: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  replyBoxThem: {
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  replyBar: {
    width: 3,
    borderRadius: 2,
    marginRight: 6,
  },
  replyBarMe: {
    backgroundColor: PALETTE.brand,
  },
  replyBarThem: {
    backgroundColor: PALETTE.textSecondary,
  },
  replyAuthor: {
    fontSize: 11,
    fontWeight: '700',
    color: PALETTE.brand,
    marginBottom: 1,
  },
  replyText: {
    fontSize: 12,
    color: PALETTE.textSecondary,
  },
  // Animal Stage Container
  animalStageContainer: {
    backgroundColor: PALETTE.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PALETTE.border,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  stageToggleHandle: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  stageToggleText: {
    fontSize: 11,
    color: PALETTE.textMuted,
    fontWeight: '500',
  },
  animalColumnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
    minHeight: 120,
    paddingBottom: 4,
  },
  animalColumn: {
    flex: 1,
    alignItems: 'stretch',
  },
  characterAvatarWrap: {
    alignItems: 'center',
    marginTop: 8,
  },
  animalNameLabel: {
    textAlign: 'center',
    fontSize: 11,
    color: PALETTE.textSecondary,
    marginTop: 2,
  },
  collapsedStageBar: {
    backgroundColor: PALETTE.surfaceMuted,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PALETTE.border,
    alignItems: 'center',
    paddingVertical: 6,
  },
  collapsedStageText: {
    fontSize: 11,
    color: PALETTE.brand,
    fontWeight: '600',
  },
  replyPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.surfaceMuted,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PALETTE.border,
  },
  replyPreviewAuthor: {
    fontSize: 11,
    fontWeight: '700',
    color: PALETTE.brand,
  },
  replyPreviewSnippet: {
    fontSize: 12,
    color: PALETTE.textSecondary,
  },
  // Claude Composer
  composerWrapper: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    paddingTop: 4,
    backgroundColor: PALETTE.bg,
  },
  composerBox: {
    borderRadius: 24,
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.borderStrong,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    minHeight: 52,
  },
  composerInput: {
    fontSize: 15,
    lineHeight: 20,
    color: PALETTE.text,
    maxHeight: 100,
    paddingTop: 0,
    paddingBottom: 4,
  },
  composerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  composerAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PALETTE.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerSendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerSendActive: {
    backgroundColor: PALETTE.brand,
  },
  composerSendDisabled: {
    backgroundColor: PALETTE.surfaceMuted,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: PALETTE.surface,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.borderStrong,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: PALETTE.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: PALETTE.textSecondary,
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalCharactersRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  modalOption: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  modalOptionActive: {
    borderColor: PALETTE.brand,
    backgroundColor: PALETTE.surfaceMuted,
  },
  modalOptionText: {
    fontSize: 12,
    color: PALETTE.text,
    marginTop: 6,
  },
  menuSheetCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: PALETTE.surface,
    borderRadius: 16,
    padding: 16,
  },
  menuSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: PALETTE.text,
    marginBottom: 14,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.border,
  },
  menuRowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: PALETTE.text,
  },
  menuRowSub: {
    fontSize: 12,
    color: PALETTE.textSecondary,
    marginTop: 2,
  },
  expiryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.border,
  },
  expiryItemText: {
    fontSize: 14,
    color: PALETTE.text,
  },
  photoViewerBackdrop: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCloseBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  photoFullImage: {
    width: '100%',
    height: '80%',
  },
});
