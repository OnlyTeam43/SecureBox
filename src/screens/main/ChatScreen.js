// src/screens/main/ChatScreen.js
// WhatsApp/Instagram-styled clean white and light pink chat with real vector icons, quoted swipe-reply, and instant online status

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  StatusBar, Alert, Animated, Image, PanResponder, Modal, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenCapture from 'expo-screen-capture';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { getAvatar } from '../../constants/avatars';
import {
  getMessages, insertMessage, purgeExpiredMessages,
  markConversationRead, updateConversationLastMessage,
  deleteMessagesBatch, clearConversationMessages,
  markSentMessagesRead, markSentMessagesDelivered,
} from '../../db/database';
import { useUserStore } from '../../store/useUserStore';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  saveIncomingBase64ToVault,
  saveOutgoingImageToVault,
  requestStoragePermissionAndInit,
} from '../../services/mediaVault';
import {
  sendMessageToSupabase,
  fetchMessagesFromSupabase,
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
  PhoneIcon,
  VideoIcon,
  GalleryIcon,
  SendIcon,
  BackArrowIcon,
  TrashIcon,
  ReplyIcon,
  CheckIcon,
  DoubleCheckIcon,
  UserAvatarIcon,
  ClockIcon,
  ShieldLockIcon,
  SettingsIcon,
  ChevronRightIcon,
} from '../../components/Icons';

// Swipeable Message Row Component
// - For sent messages (isMe): pull right-to-left (dx < 0) to reply
// - For received messages: pull left-to-right (dx > 0) to reply
// - Reply icon ONLY renders during active user drag — zero permanent arrow on sent messages!
function SwipeableMessageRow({ item, isMe, inSelectionMode, isSelected, onToggleSelect, onSwipeReply, children }) {
  const panX = useRef(new Animated.Value(0)).current;
  const replyOpacity = useRef(new Animated.Value(0)).current;
  const [swiping, setSwiping] = useState(false);
  const [swipeDir, setSwipeDir] = useState(isMe ? 'left' : 'right');

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (inSelectionMode) return false;
        const isHorizontal = Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dy) < 18;
        if (!isHorizontal) return false;

        if (isMe) {
          // Sent message: pull from right to left
          return gestureState.dx < -8;
        } else {
          // Partner message: pull from left to right (or right to left)
          return Math.abs(gestureState.dx) > 8;
        }
      },
      onPanResponderGrant: () => {
        setSwiping(true);
      },
      onPanResponderMove: (_, gestureState) => {
        if (isMe || gestureState.dx < 0) {
          // Pulling left (towards screen center for sent messages)
          setSwipeDir('left');
          const clamped = Math.max(gestureState.dx, -65);
          panX.setValue(clamped);
          replyOpacity.setValue(Math.min(Math.abs(clamped) / 45, 1));
        } else {
          // Pulling right (towards screen center for partner messages)
          setSwipeDir('right');
          const clamped = Math.min(gestureState.dx, 65);
          panX.setValue(clamped);
          replyOpacity.setValue(Math.min(clamped / 45, 1));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const triggered = isMe ? gestureState.dx < -38 : Math.abs(gestureState.dx) > 38;
        if (triggered) {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch (_) {}
          onSwipeReply(item);
        }

        Animated.parallel([
          Animated.spring(panX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }),
          Animated.timing(replyOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setSwiping(false);
        });
      },
      onPanResponderTerminate: () => {
        Animated.parallel([
          Animated.spring(panX, { toValue: 0, useNativeDriver: true }),
          Animated.timing(replyOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        ]).start(() => {
          setSwiping(false);
        });
      },
    })
  ).current;

  return (
    <View style={styles.swipeRowWrapper}>
      {/* Reply icon ONLY mounts when actively swiping — completely removes permanent arrow! */}
      {swiping && (
        <Animated.View
          style={[
            styles.swipeIconBackdrop,
            swipeDir === 'left' ? styles.swipeIconRight : styles.swipeIconLeft,
            { opacity: replyOpacity },
          ]}
          pointerEvents="none"
        >
          <View style={styles.replyIconCircle}>
            <ReplyIcon size={16} color={Colors.accent.primary} />
          </View>
        </Animated.View>
      )}

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.msgRow,
          isMe ? styles.msgRowMe : styles.msgRowThem,
          { transform: [{ translateX: panX }] },
          isSelected && styles.msgRowSelected,
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={() => onToggleSelect(item.id)}
          onPress={() => {
            if (inSelectionMode) onToggleSelect(item.id);
          }}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// Shuffling Keyboard Typing Indicator Component (3 keyboard buttons shuffle / bounce)
function ShufflingKeyboardTyping({ partnerNickname }) {
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;
  const [keys, setKeys] = useState(['S', 'E', 'C']);

  useEffect(() => {
    const createKeyAnim = (anim, delay) => {
      return Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: -7,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 2,
              duration: 160,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 140,
              useNativeDriver: true,
            }),
            Animated.delay(260),
          ])
        ),
      ]);
    };

    const animSequence = Animated.parallel([
      createKeyAnim(anim1, 0),
      createKeyAnim(anim2, 160),
      createKeyAnim(anim3, 320),
    ]);
    animSequence.start();

    // Shuffling letters across keyboard buttons periodically
    const keySets = [
      ['S', 'E', 'C'],
      ['B', 'O', 'X'],
      ['K', 'E', 'Y'],
      ['L', 'O', 'V'],
      ['A', 'S', 'D'],
    ];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % keySets.length;
      setKeys(keySets[idx]);
    }, 1100);

    return () => {
      animSequence.stop();
      clearInterval(interval);
    };
  }, []);

  return (
    <View style={styles.typingRow}>
      <View style={styles.typingBox}>
        <View style={styles.keyboardCluster}>
          <Animated.View style={[styles.keyCap, { transform: [{ translateY: anim1 }] }]}>
            <Text style={styles.keyCapText}>{keys[0]}</Text>
          </Animated.View>
          <Animated.View style={[styles.keyCap, { transform: [{ translateY: anim2 }] }]}>
            <Text style={styles.keyCapText}>{keys[1]}</Text>
          </Animated.View>
          <Animated.View style={[styles.keyCap, { transform: [{ translateY: anim3 }] }]}>
            <Text style={styles.keyCapText}>{keys[2]}</Text>
          </Animated.View>
        </View>
        <Text style={styles.typingLabel}>
          {partnerNickname ? `${partnerNickname} is typing...` : 'typing...'}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen({ route, navigation }) {
  const { conversationId, contactHandle, contactNickname, contactAvatarId } = route.params || {};
  const insets = useSafeAreaInsets();

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [partnerLastSeen, setPartnerLastSeen] = useState(null);

  // Realtime Typing Indicator State
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const myTypingTimerRef = useRef(null);
  const isTypingRef = useRef(false);

  // Screenshot Ban & Confirmation States
  const [screenshotAllowed, setScreenshotAllowed] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [requestPending, setRequestPending] = useState(false);
  const [incomingScreenshotRequest, setIncomingScreenshotRequest] = useState(null);

  // Header Menu & Settings States
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [viewingPhotoUri, setViewingPhotoUri] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const highlightTimerRef = useRef(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const shouldScrollToEndRef = useRef(true);

  const flatRef = useRef(null);
  const screenshotAllowedRef = useRef(false);
  screenshotAllowedRef.current = screenshotAllowed;

  const myHandle = useUserStore((s) => s.handle);
  const myNickname = useUserStore((s) => s.nickname);
  const defaultExpiry = useUserStore((s) => s.defaultExpiry);
  const setDefaultExpiry = useUserStore((s) => s.setDefaultExpiry);
  const avatar = getAvatar(contactAvatarId);

  const inSelectionMode = selectedMessageIds.length > 0;

  // Listen to keyboard visibility to eliminate empty bottom gap and keep messages in view
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        setTimeout(() => {
          flatRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Cleanup typing timers on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (myTypingTimerRef.current) clearTimeout(myTypingTimerRef.current);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (isTypingRef.current) {
        broadcastTypingStatus(conversationId, myHandle, false);
      }
    };
  }, [conversationId, myHandle]);

  // Screen Capture Protection: Strict Ban & Detection by Default
  useEffect(() => {
    // 1. Immediately prevent screenshots and screen recordings on mount
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});

    // 2. Add listener to detect when a screenshot is attempted / captured
    const subscription = ScreenCapture.addScreenshotListener(() => {
      notifyScreenshotTaken(conversationId, myHandle);
      if (!screenshotAllowedRef.current) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch (_) {}
      }
    });

    return () => {
      subscription?.remove();
      ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    };
  }, [conversationId, myHandle]);

  // Countdown timer when screenshot permission is granted
  useEffect(() => {
    if (!screenshotAllowed || countdownSeconds <= 0) return;

    const interval = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setScreenshotAllowed(false);
          ScreenCapture.preventScreenCaptureAsync().catch(() => {});
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch (_) {}
          // No full-screen popup or blocking alert here
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [screenshotAllowed, countdownSeconds]);

  // Load messages from SQLite and sync from Supabase
  const loadMessages = useCallback(async () => {
    try {
      await purgeExpiredMessages();
      const localData = await getMessages(conversationId, 60);
      setMessages(localData.reverse()); // oldest first
      await markConversationRead(conversationId, myHandle);
      markMessagesDeliveredInSupabase(conversationId, myHandle, contactHandle);
      markMessagesSeenInSupabase(conversationId, myHandle, contactHandle);
      shouldScrollToEndRef.current = true;
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 150);

      // Background fetch latest from Supabase
      const remoteData = await fetchMessagesFromSupabase(conversationId);
      if (remoteData && remoteData.length > 0) {
        for (const rMsg of remoteData) {
          if (!rMsg.body && !rMsg.media_uri) continue;
          let localMedia = null;
          if (rMsg.media_uri) {
            localMedia = await saveIncomingBase64ToVault(rMsg.id, rMsg.media_uri);
          }
          await insertMessage({
            id: rMsg.id,
            conversationId: rMsg.conversation_id,
            sender: rMsg.sender,
            type: rMsg.media_uri ? 'image' : 'text',
            body: rMsg.body,
            mediaUri: localMedia,
            sentAt: rMsg.sent_at,
            expiresAt: rMsg.expires_at,
          });
        }
        const updatedLocal = await getMessages(conversationId, 60);
        setMessages(updatedLocal.reverse());
        shouldScrollToEndRef.current = true;
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 150);
      }
    } catch (e) {
      console.warn('Chat load error:', e);
    }
  }, [conversationId, myHandle, contactHandle]);

  useEffect(() => {
    loadMessages();

    // 1. Realtime listener for incoming messages, seen status, deletions & screenshot permissions
    const unsubscribeMessages = subscribeToConversation(
      conversationId,
      async (newMsg) => {
        if (newMsg && newMsg.sender !== myHandle) {
          let localMedia = null;
          if (newMsg.media_uri) {
            localMedia = await saveIncomingBase64ToVault(newMsg.id, newMsg.media_uri);
          }
          const storedMsg = {
            id: newMsg.id,
            conversationId: newMsg.conversation_id,
            sender: newMsg.sender,
            type: newMsg.media_uri ? 'image' : 'text',
            body: newMsg.body,
            mediaUri: localMedia,
            replyTo: newMsg.reply_to || null,
            sentAt: newMsg.sent_at,
            expiresAt: newMsg.expires_at,
          };
          await insertMessage(storedMsg);
          await updateConversationLastMessage(
            conversationId,
            newMsg.media_uri ? 'Photo' : (newMsg.body || ''),
            newMsg.sent_at,
            newMsg.sender
          );
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, storedMsg];
          });
          markMessagesDeliveredInSupabase(conversationId, myHandle, contactHandle);
          markMessagesSeenInSupabase(conversationId, myHandle, contactHandle);
          shouldScrollToEndRef.current = true;
          setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
        }
      },
      async (secEvent) => {
        if (!secEvent) return;

        // 0. Partner typing status in realtime
        if (secEvent.event === 'typing_status') {
          if (secEvent.sender?.toLowerCase() !== myHandle?.toLowerCase()) {
            setIsPartnerTyping(!!secEvent.isTyping);
            if (secEvent.isTyping) {
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = setTimeout(() => {
                setIsPartnerTyping(false);
              }, 4000);
            }
          }
          return;
        }

        // 0b. Partner deleted messages in realtime
        if (secEvent.event === 'delete_messages' && secEvent.payload?.messageIds) {
          const ids = secEvent.payload.messageIds;
          await deleteMessagesBatch(ids);
          setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
          return;
        }

        // 0c. Partner viewed messages in realtime -> update my sent messages to pink 2 ticks
        if (secEvent.event === 'messages_seen') {
          if (secEvent.viewerHandle?.toLowerCase() !== myHandle?.toLowerCase()) {
            setMessages((prev) =>
              prev.map((m) =>
                m.sender?.toLowerCase() === myHandle?.toLowerCase()
                  ? { ...m, read: 1, delivered: 1 }
                  : m
              )
            );
            await markSentMessagesRead(conversationId, myHandle);
          }
          return;
        }

        // 0d. Partner received messages in realtime -> update my sent messages to grey 2 ticks
        if (secEvent.event === 'messages_delivered') {
          if (secEvent.receiverHandle?.toLowerCase() !== myHandle?.toLowerCase()) {
            setMessages((prev) =>
              prev.map((m) =>
                m.sender?.toLowerCase() === myHandle?.toLowerCase() && !m.read
                  ? { ...m, delivered: 1 }
                  : m
              )
            );
            await markSentMessagesDelivered(conversationId, myHandle);
          }
          return;
        }

        // 1. Partner requests screenshot permission
        if (secEvent.event === 'screenshot_request') {
          if (secEvent.requesterHandle?.toLowerCase() !== myHandle?.toLowerCase()) {
            setIncomingScreenshotRequest({
              requesterHandle: secEvent.requesterHandle,
              requesterNickname: secEvent.requesterNickname || secEvent.requesterHandle,
            });
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch (_) {}
          }
        }

        // 2. Partner responds to our screenshot request
        if (secEvent.event === 'screenshot_response') {
          if (secEvent.responderHandle?.toLowerCase() !== myHandle?.toLowerCase()) {
            setRequestPending(false);
            if (secEvent.approved) {
              const duration = secEvent.durationSeconds || 60;
              setCountdownSeconds(duration);
              setScreenshotAllowed(true);
              ScreenCapture.allowScreenCaptureAsync().catch((err) => {
                console.warn('Allow screenshot error:', err);
              });
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (_) {}
            } else {
              setScreenshotAllowed(false);
              ScreenCapture.preventScreenCaptureAsync().catch(() => {});
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              } catch (_) {}
            }
          }
        }

        // 3. Notification that a screenshot was taken
        if (secEvent.event === 'screenshot_taken') {
          if (secEvent.actorHandle?.toLowerCase() !== myHandle?.toLowerCase()) {
            Alert.alert('Security Alert', `@${secEvent.actorHandle} took a screenshot in this chat.`);
          }
        }
      }
    );

    // 2. Realtime presence tracking for partner's online/last seen status across the entire app
    const unsubscribePresence = subscribeToGlobalPresence(
      myHandle,
      contactHandle,
      ({ isOnline, lastSeen }) => {
        setIsPartnerOnline(isOnline);
        if (lastSeen) setPartnerLastSeen(lastSeen);
      }
    );

    return () => {
      if (unsubscribeMessages) unsubscribeMessages();
      if (unsubscribePresence) unsubscribePresence();
    };
  }, [conversationId, contactHandle, loadMessages, myHandle]);

  const toggleSelectMessage = (id) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    setSelectedMessageIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((mId) => mId !== id);
      }
      return [...prev, id];
    });
  };

  const deleteSelectedMessages = async () => {
    if (selectedMessageIds.length === 0) return;
    Alert.alert(
      'Delete Messages',
      `Delete ${selectedMessageIds.length} message(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const idsToDelete = [...selectedMessageIds];
            setSelectedMessageIds([]);
            await deleteMessagesBatch(idsToDelete);
            broadcastMessageDelete(conversationId, idsToDelete);
            setMessages((prev) => prev.filter((m) => !idsToDelete.includes(m.id)));
          },
        },
      ]
    );
  };

  const handleShieldPress = () => {
    if (screenshotAllowed) {
      Alert.alert(
        'Screenshot Unlocked',
        `Screenshot capture is currently UNLOCKED with lover's permission (${countdownSeconds}s remaining).\n\nWhen the timer reaches 0, screenshots and screen recordings will automatically be banned again.`,
        [{ text: 'OK' }]
      );
    } else if (requestPending) {
      Alert.alert(
        'Pending Confirmation',
        `Waiting for @${contactNickname || contactHandle} to confirm your screenshot permission request.`,
        [
          { text: 'Wait' },
          { text: 'Cancel Request', style: 'destructive', onPress: () => setRequestPending(false) },
        ]
      );
    } else {
      Alert.alert(
        'Screenshot Protection Active',
        `Screenshots and screen recordings are strictly banned in this private chat.\n\nTo capture a screenshot, a confirmation request must be sent to @${contactNickname || contactHandle}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Request Permission',
            onPress: async () => {
              setRequestPending(true);
              await requestScreenshotPermission(conversationId, myHandle, myNickname);
              Alert.alert(
                'Request Sent',
                `A confirmation message was sent to @${contactNickname || contactHandle}. Screenshot will unlock only if they approve.`
              );
            },
          },
        ]
      );
    }
  };

  const handleInputChange = (text) => {
    setInputText(text);

    if (text.length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        broadcastTypingStatus(conversationId, myHandle, true);
      }
      if (myTypingTimerRef.current) clearTimeout(myTypingTimerRef.current);
      myTypingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        broadcastTypingStatus(conversationId, myHandle, false);
      }, 2500);
    } else {
      if (myTypingTimerRef.current) clearTimeout(myTypingTimerRef.current);
      if (isTypingRef.current) {
        isTypingRef.current = false;
        broadcastTypingStatus(conversationId, myHandle, false);
      }
    }
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');

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

    // Clean JSON or structured format for reply (no extra emojis added)
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
      delivered: 1,
      read: 0,
    };

    try {
      await insertMessage(msg);
      await updateConversationLastMessage(conversationId, text, now, myHandle, 'sent');
      setMessages((prev) => [...prev, msg]);
      setHighlightedMessageId(null);
      shouldScrollToEndRef.current = true;
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);

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
    } catch (e) {
      console.error('Failed to send message:', e);
      Alert.alert('Error', `Failed to send message: ${e?.message || e}`);
    }
  };

  const pickAndSendImage = async () => {
    try {
      // Request storage permission + initialize hidden vault on first photo access
      const permitted = await requestStoragePermissionAndInit();
      if (!permitted) {
        Alert.alert(
          'Storage Permission Required',
          'SecureBox needs device storage access to securely encrypt and save photos.\n\nAll media is stored privately in the SecureBox encrypted vault — never visible to your device gallery.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Also request gallery picker permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Gallery Access Needed', 'Allow SecureBox to access your gallery to send photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        const now = Date.now();
        const expiresAt = defaultExpiry ? now + defaultExpiry * 1000 : null;
        const id = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          `${myHandle}-${now}-img-${Math.random()}`
        );

        const asset = result.assets[0];
        // Save into hidden, encrypted app sandbox vault (.nomedia) with auto-resizing
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
          mediaUri: vaultUri,
          sentAt: now,
          expiresAt,
          delivered: 1,
          read: 0,
        };

        await insertMessage(msg);
        await updateConversationLastMessage(conversationId, 'Photo', now, myHandle, 'sent');
        setMessages((prev) => [...prev, msg]);
        setHighlightedMessageId(null);
        shouldScrollToEndRef.current = true;
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);

        // Send base64 image data to Supabase so receiver can download & save to their own vault
        sendMessageToSupabase({
          id,
          conversationId,
          sender: myHandle,
          receiver: contactHandle,
          body: 'Photo',
          mediaUri: base64DataUri,
          sentAt: now,
          expiresAt,
        });
      }
    } catch (e) {
      console.error('Failed to send image:', e);
      Alert.alert('Error', `Failed to send photo: ${e?.message || e}`);
    }
  };

  const scrollToMessageById = (replyToId) => {
    if (!replyToId || !messages || messages.length === 0) return;
    const idx = messages.findIndex((m) => m.id === replyToId);
    if (idx !== -1) {
      // Highlight message until user starts scrolling (keeps highlight as requested)
      setHighlightedMessageId(replyToId);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);

      try {
        flatRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
      } catch (_) {
        // Fallback if scrollToIndex fails
        flatRef.current?.scrollToOffset({ offset: idx * 80, animated: true });
      }
    }
  };

  const renderMessage = ({ item, index }) => {
    const isMe = item.sender === myHandle;
    const mediaUri = item.media_uri || item.mediaUri;

    // Do NOT render empty messages where both body and media are deleted (prevents floating timestamp bug)
    if (!item.body && !mediaUri) {
      return null;
    }

    const timeStr = new Date(item.sent_at || item.sentAt).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit',
    });
    const hasExpiry = item.expires_at || item.expiresAt;
    const isSelected = selectedMessageIds.includes(item.id);
    const isHighlighted = highlightedMessageId === item.id;

    // Parse reply metadata if present
    let replyData = null;
    if (item.replyTo || item.reply_to) {
      try {
        replyData = JSON.parse(item.replyTo || item.reply_to);
      } catch (_) {}
    }
    const hasReply = !!replyData;

    return (
      <SwipeableMessageRow
        item={item}
        isMe={isMe}
        inSelectionMode={inSelectionMode}
        isSelected={isSelected}
        onToggleSelect={toggleSelectMessage}
        onSwipeReply={setReplyingTo}
      >
        <View style={[
          styles.bubble,
          isMe ? styles.bubbleMe : styles.bubbleThem,
          hasReply && styles.bubbleWithReply,
          isHighlighted && styles.bubbleHighlighted,
        ]}>
          {/* WhatsApp-Style Quoted Reply Box inside bubble — tap scrolls to original */}
          {replyData && (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => scrollToMessageById(replyData.replyToId)}
              style={[styles.quotedBox, isMe ? styles.quotedBoxMe : styles.quotedBoxThem]}
            >
              <View style={[styles.quotedBar, isMe ? styles.quotedBarMe : styles.quotedBarThem]} />
              <View style={styles.quotedContent}>
                <Text style={styles.quotedAuthor}>{replyData.replyAuthor}</Text>
                <Text style={styles.quotedText} numberOfLines={2}>
                  {replyData.replySnippet}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {mediaUri && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                if (inSelectionMode) {
                  toggleSelectMessage(item.id);
                } else {
                  setViewingPhotoUri(mediaUri);
                }
              }}
            >
              <Image source={{ uri: mediaUri }} style={styles.messageImage} resizeMode="cover" />
            </TouchableOpacity>
          )}

          {item.body && (!mediaUri || item.body !== 'Photo') && (
            <Text style={[styles.msgText, hasReply && styles.msgTextWithReply]}>{item.body}</Text>
          )}

          <View style={styles.msgMeta}>
            {hasExpiry && <ClockIcon size={11} color="#8a8187" />}
            <Text style={styles.msgTime}>{timeStr}</Text>
            {isMe && (
              <View style={styles.tickRow}>
                {item.read === 1 || item.read === true ? (
                  <DoubleCheckIcon size={14} color="#e0527a" />
                ) : (item.delivered === 1 || isPartnerOnline) ? (
                  <DoubleCheckIcon size={14} color="#8a8187" />
                ) : (
                  <CheckIcon size={14} color="#8a8187" />
                )}
              </View>
            )}
          </View>
        </View>
      </SwipeableMessageRow>
    );
  };

  // Status subtitle: Online or Last seen
  let onlineSubtitle = 'offline';
  if (isPartnerOnline) {
    onlineSubtitle = 'online';
  } else if (partnerLastSeen) {
    onlineSubtitle = `last seen ${new Date(partnerLastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg.primary} />

      {/* Header */}
      {inSelectionMode ? (
        <View style={[styles.header, styles.selectionHeader]}>
          <TouchableOpacity onPress={() => setSelectedMessageIds([])} style={styles.headerBtn}>
            <Text style={styles.selectionCancelText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.selectionCountText}>{selectedMessageIds.length} Selected</Text>
          <TouchableOpacity onPress={deleteSelectedMessages} style={styles.deleteHeaderBtn}>
            <TrashIcon size={18} color="#fff" />
            <Text style={styles.deleteHeaderText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <BackArrowIcon size={24} color={Colors.text.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerCenter}
            onPress={() => setShowHeaderMenu(true)}
            activeOpacity={0.7}
          >
            <View style={styles.avatarWrap}>
              <View style={styles.avatarCircle}>
                {contactAvatarId && (contactAvatarId.startsWith('data:') || contactAvatarId.startsWith('file:') || contactAvatarId.startsWith('http')) ? (
                  <Image source={{ uri: contactAvatarId }} style={styles.headerAvatarPhoto} />
                ) : (
                  <UserAvatarIcon size={22} color={Colors.accent.primary} />
                )}
              </View>
              {isPartnerOnline && <View style={styles.onlineDot} />}
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerName} numberOfLines={1}>{contactNickname || 'Lover'}</Text>
              <View style={styles.headerSubRow}>
                <Text style={styles.headerHandle}>@{contactHandle ? contactHandle.replace('@', '') : ''}</Text>
                <Text style={styles.headerDot}>•</Text>
                <Text style={[styles.headerStatus, isPartnerOnline && styles.headerStatusOnline]}>
                  {onlineSubtitle}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Real Phone Call Icon */}
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() =>
              navigation.navigate('Call', {
                contactHandle,
                contactNickname,
                contactAvatarId,
                callType: 'voice',
              })
            }
          >
            <PhoneIcon size={22} color={Colors.text.primary} />
          </TouchableOpacity>

          {/* Real Video Call Icon */}
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() =>
              navigation.navigate('Call', {
                contactHandle,
                contactNickname,
                contactAvatarId,
                callType: 'video',
              })
            }
          >
            <VideoIcon size={22} color={Colors.text.primary} />
          </TouchableOpacity>

          {/* Screenshot Shield Permission Button */}
          <TouchableOpacity
            style={[
              styles.actionIconBtn,
              screenshotAllowed && styles.actionIconBtnAllowed,
              requestPending && !screenshotAllowed && styles.actionIconBtnPending,
            ]}
            onPress={handleShieldPress}
          >
            <ShieldLockIcon
              size={20}
              color={screenshotAllowed ? '#28a745' : requestPending ? '#e69500' : Colors.text.primary}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Screenshot Permission Banners */}
      {screenshotAllowed && (
        <View style={styles.secBannerAllowed}>
          <ShieldLockIcon size={14} color="#155724" />
          <Text style={styles.secBannerAllowedText}>
            Screenshot Allowed · {countdownSeconds}s remaining
          </Text>
        </View>
      )}
      {requestPending && !screenshotAllowed && (
        <View style={styles.secBannerPending}>
          <Text style={styles.secBannerPendingText}>
            ⏳ Waiting for lover to confirm screenshot request...
          </Text>
        </View>
      )}

      {/* Messages & Chat Input Area */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
      >
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => renderMessage({ item, index })}
          style={styles.messagesContainer}
          contentContainerStyle={styles.msgList}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={() => setHighlightedMessageId(null)}
          onContentSizeChange={() => {
            if (shouldScrollToEndRef.current) {
              shouldScrollToEndRef.current = false;
              flatRef.current?.scrollToEnd({ animated: true });
            }
          }}
          onScrollToIndexFailed={(info) => {
            // Fallback: scroll to offset estimate if exact index isn't yet laid out
            const wait = new Promise((resolve) => setTimeout(resolve, 350));
            wait.then(() => {
              flatRef.current?.scrollToIndex({ index: info.index, animated: true });
            });
          }}
        />

        {/* WhatsApp / Instagram Style Reply Banner */}
        {replyingTo && (
          <View style={styles.replyBar}>
            <View style={styles.replyBarColor} />
            <View style={styles.replyContent}>
              <Text style={styles.replyAuthor}>
                {replyingTo.sender === myHandle ? 'You' : contactNickname}
              </Text>
              <Text style={styles.replySnippet} numberOfLines={1}>
                {replyingTo.body || 'Photo'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyCloseBtn}>
              <Text style={styles.replyCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Shuffling Keyboard Typing Indicator Box */}
        {isPartnerTyping && <ShufflingKeyboardTyping partnerNickname={contactNickname} />}

        {/* WhatsApp-Style Input Bar */}
        <View style={[styles.inputBar, { paddingBottom: isKeyboardVisible ? 8 : Math.max(insets.bottom, 8) }]}>
          {/* Gallery Button with Real Icon */}
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={pickAndSendImage}
            activeOpacity={0.7}
          >
            <GalleryIcon size={22} color={Colors.icon} />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder={replyingTo ? "Type a reply..." : "Type a message..."}
            placeholderTextColor={Colors.text.placeholder}
            value={inputText}
            onChangeText={handleInputChange}
            multiline
            maxLength={2000}
          />

          {/* Send Button with Real Icon */}
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim()}
            activeOpacity={0.8}
          >
            <SendIcon size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Real-time Confirmation Modal for Partner's Screenshot Request */}
      <Modal visible={!!incomingScreenshotRequest} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconCircle}>
              <ShieldLockIcon size={32} color={Colors.accent.primary} />
            </View>
            <Text style={styles.confirmHeading}>Screenshot Request</Text>
            <Text style={styles.confirmText}>
              <Text style={{ fontWeight: '700' }}>
                @{incomingScreenshotRequest?.requesterNickname || incomingScreenshotRequest?.requesterHandle}
              </Text>{' '}
              wants to take a screenshot in this private chat.
            </Text>
            <Text style={styles.confirmSubtext}>
              Screenshots and screen recordings are strictly banned by default. Do you allow it for 60 seconds?
            </Text>

            <View style={styles.confirmActionsRow}>
              <TouchableOpacity
                style={styles.denyButton}
                onPress={() => {
                  respondScreenshotPermission(conversationId, myHandle, false);
                  setIncomingScreenshotRequest(null);
                }}
              >
                <Text style={styles.denyButtonText}>Deny</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.allowButton}
                onPress={() => {
                  respondScreenshotPermission(conversationId, myHandle, true, 60);
                  setIncomingScreenshotRequest(null);
                  try {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  } catch (_) {}
                }}
              >
                <Text style={styles.allowButtonText}>Allow (60s)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header Profile, Settings & Media Locker Modal */}
      <Modal visible={showHeaderMenu} transparent animationType="slide" onRequestClose={() => setShowHeaderMenu(false)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setShowHeaderMenu(false)} />
          <View style={styles.sheetContainer}>
            {/* Handle Drag Bar */}
            <View style={styles.sheetHandleBar} />

            {/* Profile Header Card */}
            <View style={styles.sheetProfileCard}>
              <View style={styles.sheetAvatarCircle}>
                {contactAvatarId && (contactAvatarId.startsWith('data:') || contactAvatarId.startsWith('file:') || contactAvatarId.startsWith('http')) ? (
                  <Image source={{ uri: contactAvatarId }} style={styles.sheetAvatarPhoto} />
                ) : (
                  <UserAvatarIcon size={38} color={Colors.accent.primary} />
                )}
              </View>
              <Text style={styles.sheetName}>{contactNickname || 'Lover'}</Text>
              <Text style={styles.sheetHandle}>@{contactHandle ? contactHandle.replace('@', '') : ''}</Text>
              <View style={styles.sheetStatusPill}>
                {isPartnerOnline && <View style={styles.sheetOnlineDot} />}
                <Text style={[styles.sheetStatusText, isPartnerOnline && styles.sheetStatusOnlineText]}>
                  {onlineSubtitle}
                </Text>
              </View>
            </View>

            {/* Action Items List */}
            <View style={styles.sheetMenuSection}>
              {/* Media Locker */}
              <TouchableOpacity
                style={styles.sheetMenuItem}
                activeOpacity={0.7}
                onPress={() => {
                  setShowHeaderMenu(false);
                  navigation.navigate('MediaGallery', {
                    conversationId,
                    contactNickname,
                  });
                }}
              >
                <View style={[styles.sheetIconWrap, { backgroundColor: '#fef1f5' }]}>
                  <GalleryIcon size={20} color={Colors.accent.primary} />
                </View>
                <View style={styles.sheetMenuTexts}>
                  <Text style={styles.sheetMenuTitle}>Media Locker</Text>
                  <Text style={styles.sheetMenuSub}>Photos, images & shared files in this chat</Text>
                </View>
                <ChevronRightIcon size={18} color="#b3a9af" />
              </TouchableOpacity>

              {/* Disappearing Messages Settings */}
              <TouchableOpacity
                style={styles.sheetMenuItem}
                activeOpacity={0.7}
                onPress={() => setShowExpiryPicker(true)}
              >
                <View style={[styles.sheetIconWrap, { backgroundColor: '#f3eefe' }]}>
                  <ClockIcon size={20} color="#7c4dff" />
                </View>
                <View style={styles.sheetMenuTexts}>
                  <Text style={styles.sheetMenuTitle}>Disappearing Messages</Text>
                  <Text style={styles.sheetMenuSub}>
                    {defaultExpiry === null
                      ? 'Off (Keep forever)'
                      : defaultExpiry === 30
                      ? '30 seconds'
                      : defaultExpiry === 300
                      ? '5 minutes'
                      : defaultExpiry === 3600
                      ? '1 hour'
                      : defaultExpiry === 86400
                      ? '24 hours'
                      : '7 days'}
                  </Text>
                </View>
                <ChevronRightIcon size={18} color="#b3a9af" />
              </TouchableOpacity>

              {/* Screenshot Protection Status */}
              <View style={styles.sheetMenuItem}>
                <View style={[styles.sheetIconWrap, { backgroundColor: '#eafbf3' }]}>
                  <ShieldLockIcon size={20} color={screenshotAllowed ? '#10b981' : '#059669'} />
                </View>
                <View style={styles.sheetMenuTexts}>
                  <Text style={styles.sheetMenuTitle}>Screenshot Protection</Text>
                  <Text style={styles.sheetMenuSub}>
                    {screenshotAllowed
                      ? `Unlocked (${countdownSeconds}s remaining)`
                      : 'Active (Bilateral consent required)'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, screenshotAllowed && styles.statusBadgeUnlocked]}>
                  <Text style={[styles.statusBadgeText, screenshotAllowed && styles.statusBadgeUnlockedText]}>
                    {screenshotAllowed ? 'UNLOCKED' : 'ENFORCED'}
                  </Text>
                </View>
              </View>

              {/* Clear Chat History */}
              <TouchableOpacity
                style={styles.sheetMenuItem}
                activeOpacity={0.7}
                onPress={() => {
                  Alert.alert(
                    'Clear Chat',
                    'Are you sure you want to delete all messages in this conversation?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Clear All',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await clearConversationMessages(conversationId);
                            await deleteConversationFromSupabase(conversationId);
                            setMessages([]);
                            setShowHeaderMenu(false);
                          } catch (err) {
                            console.warn('Clear chat error:', err);
                          }
                        },
                      },
                    ]
                  );
                }}
              >
                <View style={[styles.sheetIconWrap, { backgroundColor: '#fee2e2' }]}>
                  <TrashIcon size={18} color="#ef4444" />
                </View>
                <View style={styles.sheetMenuTexts}>
                  <Text style={[styles.sheetMenuTitle, { color: '#ef4444' }]}>Clear Chat History</Text>
                  <Text style={styles.sheetMenuSub}>Erase all local messages in this conversation</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.sheetCloseBtn}
              onPress={() => setShowHeaderMenu(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.sheetCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Disappearing Messages Expiry Selector Modal */}
      <Modal visible={showExpiryPicker} transparent animationType="fade" onRequestClose={() => setShowExpiryPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.expiryBox}>
            <View style={styles.expiryHeaderRow}>
              <ClockIcon size={24} color={Colors.accent.primary} />
              <Text style={styles.expiryTitle}>Disappearing Messages</Text>
            </View>
            <Text style={styles.expirySubtitle}>
              New messages sent in this chat will self-destruct after the chosen time.
            </Text>

            <View style={styles.expiryOptionsList}>
              {[
                { label: 'Off (Keep Forever)', value: null },
                { label: '30 seconds', value: 30 },
                { label: '5 minutes', value: 300 },
                { label: '1 hour', value: 3600 },
                { label: '24 hours (1 day)', value: 86400 },
                { label: '7 days (1 week)', value: 604800 },
              ].map((opt) => {
                const isSelected = defaultExpiry === opt.value;
                return (
                  <TouchableOpacity
                    key={String(opt.value)}
                    style={[styles.expiryOptionItem, isSelected && styles.expiryOptionSelected]}
                    onPress={() => {
                      setDefaultExpiry(opt.value);
                      setShowExpiryPicker(false);
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch (_) {}
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.expiryOptionText, isSelected && styles.expiryOptionSelectedText]}>
                      {opt.label}
                    </Text>
                    {isSelected && <CheckIcon size={16} color={Colors.accent.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.expiryCancelBtn}
              onPress={() => setShowExpiryPicker(false)}
            >
              <Text style={styles.expiryCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Full-Screen Photo Viewer Modal */}
      <Modal visible={!!viewingPhotoUri} transparent animationType="fade" onRequestClose={() => setViewingPhotoUri(null)}>
        <View style={styles.photoViewerBg}>
          <TouchableOpacity style={styles.photoViewerClose} onPress={() => setViewingPhotoUri(null)} activeOpacity={0.8}>
            <Text style={styles.photoViewerCloseText}>✕ Close</Text>
          </TouchableOpacity>
          {viewingPhotoUri && (
            <Image
              source={{ uri: viewingPhotoUri }}
              style={styles.photoViewerFull}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.chatBg },
  chatArea: {
    flex: 1,
    backgroundColor: Colors.bg.chatBg,
  },
  messagesContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.bg.primary,
    gap: Spacing.sm,
  },
  selectionHeader: {
    backgroundColor: Colors.accent.soft,
    justifyContent: 'space-between',
  },
  headerBtn: { padding: 4 },
  selectionCancelText: { fontSize: 20, color: Colors.text.primary, fontWeight: '700' },
  selectionCountText: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: Colors.text.primary,
    flex: 1,
    marginLeft: 12,
  },
  deleteHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.status.error,
    borderRadius: Radius.full,
  },
  deleteHeaderText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: Typography.sizes.xs,
  },
  backBtn: { padding: Spacing.xs },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: { position: 'relative' },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.accent.light,
    overflow: 'hidden',
  },
  headerAvatarPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.status.online,
    borderWidth: 2,
    borderColor: Colors.bg.primary,
  },
  headerInfo: { flex: 1 },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  headerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  headerHandle: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  headerDot: {
    fontSize: 10,
    color: Colors.text.placeholder,
  },
  headerStatus: {
    fontSize: 12,
    color: Colors.text.placeholder,
  },
  headerStatusOnline: {
    color: Colors.status.online,
    fontWeight: '600',
  },
  actionIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg.secondary,
  },
  swipeRowWrapper: {
    position: 'relative',
    justifyContent: 'center',
    marginVertical: 1,
  },
  swipeIconBackdrop: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    zIndex: 0,
  },
  swipeIconRight: {
    right: 14,
  },
  swipeIconLeft: {
    left: 14,
  },
  replyIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffe8f0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f5c6d6',
  },
  msgList: {
    padding: Spacing.md,
    paddingBottom: 16,
    gap: Spacing.xs,
  },
  msgRow: {
    marginVertical: 1,
  },
  msgRowMe: { alignItems: 'flex-end' },
  msgRowThem: { alignItems: 'flex-start' },
  msgRowSelected: {
    backgroundColor: Colors.accent.soft,
    borderRadius: Radius.md,
  },
  bubble: {
    maxWidth: '78%',
    minWidth: 70,
    borderRadius: 15,
    paddingHorizontal: 11,
    paddingTop: 6,
    paddingBottom: 5,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleWithReply: {
    minWidth: 175,
    maxWidth: '82%',
    paddingTop: 6,
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  bubbleMe: {
    backgroundColor: Colors.bubble.sentPink, // Clean romantic light pink for me
    borderBottomRightRadius: 2,
    borderWidth: 1,
    borderColor: Colors.bubble.sentBorder,
  },
  bubbleThem: {
    backgroundColor: Colors.bubble.received, // Clean pure white for partner
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: Colors.bubble.receivedBorder,
  },
  bubbleHighlighted: {
    backgroundColor: '#ffd6e5', // Romantic rose glow when scrolled to
    borderColor: Colors.accent.primary,
    borderWidth: 1.5,
    transform: [{ scale: 1.02 }],
    shadowColor: Colors.accent.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  quotedBox: {
    flexDirection: 'row',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 5,
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'hidden',
  },
  quotedBoxMe: {
    backgroundColor: 'rgba(224, 82, 122, 0.12)',
  },
  quotedBoxThem: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  quotedBar: {
    width: 3.5,
    borderRadius: 2,
    marginRight: 8,
  },
  quotedBarMe: {
    backgroundColor: Colors.accent.primary,
  },
  quotedBarThem: {
    backgroundColor: '#e0527a',
  },
  quotedContent: {
    flex: 1,
    justifyContent: 'center',
  },
  quotedAuthor: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accent.primary,
    marginBottom: 2,
  },
  quotedText: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 16,
  },
  msgText: {
    fontSize: 15,
    color: Colors.text.primary,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  msgTextWithReply: {
    paddingHorizontal: 3,
    marginTop: 2,
  },
  msgMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
    marginTop: 1,
  },
  expiryIcon: { fontSize: 10 },
  msgTime: {
    fontSize: 10,
    color: Colors.text.placeholder,
  },
  tickRow: {
    marginLeft: 2,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  replyBarColor: {
    width: 4,
    height: '100%',
    backgroundColor: Colors.accent.primary,
    borderRadius: 2,
    marginRight: 10,
  },
  replyContent: { flex: 1 },
  replyAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent.primary,
  },
  replySnippet: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  replyCloseBtn: { padding: 4 },
  replyCloseText: { color: Colors.text.placeholder, fontSize: 16, fontWeight: '700' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingTop: 8,
    backgroundColor: Colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: 8,
  },
  attachBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: Colors.text.primary,
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#e6dfe3',
  },
  messageImage: {
    width: 220,
    height: 180,
    borderRadius: 10,
    marginBottom: 3,
  },
  actionIconBtnAllowed: {
    backgroundColor: '#d4edda',
  },
  actionIconBtnPending: {
    backgroundColor: '#fff3cd',
  },
  secBannerAllowed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#d4edda',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#c3e6cb',
  },
  secBannerAllowedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#155724',
  },
  secBannerPending: {
    backgroundColor: '#fff3cd',
    paddingVertical: 7,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ffeeba',
  },
  secBannerPendingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#856404',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  confirmBox: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  confirmHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  confirmText: {
    fontSize: 15,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
    lineHeight: 22,
  },
  confirmSubtext: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 18,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  denyButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.secondary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  denyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  allowButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
  },
  allowButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Bottom Sheet Header Menu Styles
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    backgroundColor: Colors.bg.primary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  sheetHandleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#e2d9dd',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetProfileCard: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  sheetAvatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.accent.light,
    overflow: 'hidden',
    marginBottom: 10,
  },
  sheetAvatarPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  sheetName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  sheetHandle: {
    fontSize: Typography.sizes.sm,
    color: Colors.accent.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  sheetStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.bg.secondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginTop: 8,
  },
  sheetOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.status.online,
  },
  sheetStatusText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  sheetStatusOnlineText: {
    color: Colors.status.online,
    fontWeight: '700',
  },
  sheetMenuSection: {
    gap: 10,
    marginBottom: 20,
  },
  sheetMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bg.secondary,
    gap: 14,
  },
  sheetIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetMenuTexts: {
    flex: 1,
  },
  sheetMenuTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  sheetMenuSub: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  statusBadgeUnlocked: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  statusBadgeUnlockedText: {
    color: '#d97706',
  },
  sheetCloseBtn: {
    backgroundColor: Colors.bg.secondary,
    paddingVertical: 14,
    borderRadius: Radius.full,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  sheetCloseBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },

  // Expiry Picker Modal Styles
  expiryBox: {
    width: '88%',
    backgroundColor: Colors.bg.primary,
    borderRadius: 24,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 25,
  },
  expiryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  expiryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  expirySubtitle: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  expiryOptionsList: {
    gap: 8,
    marginBottom: 16,
  },
  expiryOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  expiryOptionSelected: {
    backgroundColor: Colors.accent.soft,
    borderColor: Colors.accent.light,
  },
  expiryOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  expiryOptionSelectedText: {
    fontWeight: '700',
    color: Colors.accent.primary,
  },
  expiryCancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  expiryCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.secondary,
  },

  // Shuffling Keyboard Typing Indicator Styles
  typingRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  typingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#f2e5ea',
    shadowColor: '#e0527a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
    gap: 8,
  },
  keyboardCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingTop: 4,
  },
  keyCap: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: '#fffdfd',
    borderWidth: 1,
    borderColor: '#ecd8df',
    borderBottomWidth: 3,
    borderBottomColor: '#d6aebb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  keyCapText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.accent.primary,
  },
  typingLabel: {
    fontSize: 12,
    color: '#9c8e95',
    fontWeight: '600',
    fontStyle: 'italic',
  },

  // Full-Screen Photo Viewer Styles
  photoViewerBg: {
    flex: 1,
    backgroundColor: '#050304',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  photoViewerCloseText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  photoViewerFull: {
    width: '100%',
    height: '82%',
  },
});
