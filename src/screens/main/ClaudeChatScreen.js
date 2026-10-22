// src/screens/main/ClaudeChatScreen.js
// Curious Animal Scene Chat Screen styled with the Claude AI Design System.
// Two reactive animated characters (me & friend) sitting on stage with speech bubbles,
// paw-tapping typing animations, mouth-moving bounce on speaking, and the Claude pill composer.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import * as ScreenCapture from 'expo-screen-capture';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';

import {
  ChatPage,
  CharacterAvatar,
  useColors,
  spacing,
  radius,
  type,
} from '../../animal_ui/index.js';
import { useUserStore } from '../../store/useUserStore';
import { useBadgeStore } from '../../store/useBadgeStore';
import {
  getMessagesByConversation,
  insertMessage,
  updateConversationLastMessage,
  markConversationRead,
} from '../../db/database';
import {
  subscribeToConversation,
  sendMessageToSupabase,
  broadcastTypingStatus,
  markMessagesDeliveredInSupabase,
  markMessagesSeenInSupabase,
  saveIncomingBase64ToVault,
  fetchAndClearPendingMessages,
} from '../../services/supabase';
import { setActiveConversation } from '../../services/notificationService';

export default function ClaudeChatScreen({ route, navigation }) {
  const {
    conversationId,
    contactHandle,
    contactNickname,
    contactAvatarId,
  } = route.params || {};

  const colors = useColors();
  const myHandle = useUserStore((s) => s.handle);
  const myNickname = useUserStore((s) => s.nickname);
  const defaultExpiry = useUserStore((s) => s.defaultExpiry);

  const [messages, setMessages] = useState([]);
  const [myLastMessage, setMyLastMessage] = useState('');
  const [friendLastMessage, setFriendLastMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  // Character personas: user can be panda, cat, or puppy
  const [myCharacter, setMyCharacter] = useState('panda');
  const [friendCharacter, setFriendCharacter] = useState('cat');
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [pickingFor, setPickingFor] = useState('me'); // 'me' | 'friend'

  const typingTimeoutRef = useRef(null);
  const myTypingTimerRef = useRef(null);
  const isTypingRef = useRef(false);

  // Load chat messages from local SQLite database
  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const dbMsgs = await getMessagesByConversation(conversationId);
      setMessages(dbMsgs || []);

      // Extract last message from me and friend
      const myMsgs = (dbMsgs || []).filter((m) => m.sender === myHandle);
      const friendMsgs = (dbMsgs || []).filter((m) => m.sender !== myHandle);

      if (myMsgs.length > 0) {
        setMyLastMessage(myMsgs[myMsgs.length - 1].body || '📷 Sent a photo');
      }
      if (friendMsgs.length > 0) {
        setFriendLastMessage(friendMsgs[friendMsgs.length - 1].body || '📷 Sent a photo');
      }
    } catch (err) {
      console.warn('ClaudeChat: loadMessages error:', err);
    }
  }, [conversationId, myHandle]);

  // Realtime subscription & screenshot defense
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    setActiveConversation(conversationId);
    loadMessages();

    // 1. Subscribe to realtime messages & typing status
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
            sentAt: newMsg.sent_at,
            expiresAt: newMsg.expires_at,
            read: 1,
          };
          await insertMessage(storedMsg);
          await updateConversationLastMessage(
            conversationId,
            newMsg.media_uri ? 'Photo' : (newMsg.body || ''),
            newMsg.sent_at,
            newMsg.sender
          );
          await markConversationRead(conversationId, myHandle);
          useBadgeStore.getState().refreshBadges(myHandle);

          setFriendLastMessage(newMsg.body || '📷 Sent a photo');
          setMessages((prev) => [...prev, storedMsg]);
          markMessagesDeliveredInSupabase(conversationId, myHandle, contactHandle);
          markMessagesSeenInSupabase(conversationId, myHandle, contactHandle);

          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch (_) {}
        }
      },
      async (secEvent) => {
        if (!secEvent) return;
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
        }
      }
    );

    return () => {
      setActiveConversation(null);
      markConversationRead(conversationId, myHandle);
      useBadgeStore.getState().refreshBadges(myHandle);
      if (unsubscribeMessages) unsubscribeMessages();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (myTypingTimerRef.current) clearTimeout(myTypingTimerRef.current);
      if (isTypingRef.current) {
        broadcastTypingStatus(conversationId, myHandle, false);
      }
    };
  }, [conversationId, contactHandle, loadMessages, myHandle]);

  // Sync queued messages on mount
  useEffect(() => {
    const sync = async () => {
      try {
        const queued = await fetchAndClearPendingMessages(myHandle);
        if (queued && queued.length > 0) {
          for (const msg of queued) {
            await insertMessage({
              id: msg.id,
              conversationId: msg.conversation_id || conversationId,
              sender: msg.sender,
              type: msg.media_uri ? 'image' : 'text',
              body: msg.body,
              sentAt: msg.sent_at,
              expiresAt: msg.expires_at,
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

  // Handle typing input changes
  const handleTypingChange = (typing) => {
    setIsTyping(typing);
    if (typing) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        broadcastTypingStatus(conversationId, myHandle, true);
      }
      if (myTypingTimerRef.current) clearTimeout(myTypingTimerRef.current);
      myTypingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        broadcastTypingStatus(conversationId, myHandle, false);
      }, 3000);
    } else {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        broadcastTypingStatus(conversationId, myHandle, false);
      }
    }
  };

  // Send message
  const handleSendMessage = async (text) => {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();
    setMyLastMessage(cleanText);

    if (myTypingTimerRef.current) clearTimeout(myTypingTimerRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      broadcastTypingStatus(conversationId, myHandle, false);
    }

    const now = Date.now();
    const expiresAt = defaultExpiry ? now + defaultExpiry * 1000 : null;
    const id = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${myHandle}-${now}-${Math.random()}`
    );

    const msg = {
      id,
      conversationId,
      sender: myHandle,
      type: 'text',
      body: cleanText,
      sentAt: now,
      expiresAt,
      delivered: 0,
      read: 0,
    };

    try {
      await insertMessage(msg);
      await updateConversationLastMessage(conversationId, cleanText, now, myHandle, 'sent');
      setMessages((prev) => [...prev, msg]);

      sendMessageToSupabase({
        id,
        conversationId,
        sender: myHandle,
        receiver: contactHandle,
        body: cleanText,
        mediaUri: null,
        sentAt: now,
        expiresAt,
      });

      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (_) {}
    } catch (err) {
      console.warn('ClaudeChat: sendMessage error:', err);
      Alert.alert('Error', 'Failed to send message: ' + (err?.message || err));
    }
  };

  // Launch voice call
  const handleVoiceCall = () => {
    navigation.navigate('Call', {
      contactHandle,
      contactNickname,
      contactAvatarId,
      callType: 'voice',
    });
  };

  // Launch video call
  const handleVideoCall = () => {
    navigation.navigate('Call', {
      contactHandle,
      contactNickname,
      contactAvatarId,
      callType: 'video',
    });
  };

  // Switch to classic WhatsApp feed view
  const handleSwitchToClassicView = () => {
    navigation.replace('Chat', {
      conversationId,
      contactHandle,
      contactNickname,
      contactAvatarId,
    });
  };

  // Send photo
  const handleAddAttachment = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return Alert.alert('Permission Needed', 'Please allow gallery access to send photos.');
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        const now = Date.now();
        const id = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          `${myHandle}-${now}-${Math.random()}`
        );

        setMyLastMessage('📷 Sent a photo');
        await insertMessage({
          id,
          conversationId,
          sender: myHandle,
          type: 'image',
          body: 'Photo',
          mediaUri: asset.uri,
          sentAt: now,
          read: 1,
        });

        sendMessageToSupabase({
          id,
          conversationId,
          sender: myHandle,
          receiver: contactHandle,
          body: 'Photo',
          mediaUri: dataUri,
          sentAt: now,
        });
      }
    } catch (err) {
      console.warn('Send photo error:', err);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      <ChatPage
        me={{
          character: myCharacter,
          name: myNickname || 'You',
          message: myLastMessage || 'Say something sweet 🌿',
          typing: isTyping,
        }}
        friend={{
          character: friendCharacter,
          name: contactNickname || contactHandle || 'Friend',
          message: friendLastMessage || 'Waiting to chat... ✨',
          typing: isPartnerTyping,
        }}
        onSend={handleSendMessage}
        onTypingChange={handleTypingChange}
        onBack={() => navigation.goBack()}
        onVoiceCall={handleVoiceCall}
        onVideoCall={handleVideoCall}
        onAdd={handleAddAttachment}
        onSwitchView={handleSwitchToClassicView}
        onPressMe={() => {
          setPickingFor('me');
          setShowCharacterPicker(true);
        }}
        onPressFriend={() => {
          setPickingFor('friend');
          setShowCharacterPicker(true);
        }}
      />

      {/* Character Picker Modal */}
      <Modal
        visible={showCharacterPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCharacterPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowCharacterPicker(false)}
        >
          <View style={[styles.pickerCard, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
            <Text style={[type.title, { color: colors.text, marginBottom: spacing.xs }]}>
              Choose {pickingFor === 'me' ? 'Your' : `${contactNickname || 'Friend'}'s`} Character
            </Text>
            <Text style={[type.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              Pick an animal companion for the interactive chat scene
            </Text>

            <View style={styles.charRow}>
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
                      setShowCharacterPicker(false);
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch (_) {}
                    }}
                    style={[
                      styles.charOption,
                      active && { borderColor: colors.brand, backgroundColor: colors.surfaceMuted },
                    ]}
                  >
                    <CharacterAvatar character={item.id} state="idle" size={80} />
                    <Text style={[type.caption, { color: active ? colors.brand : colors.text, marginTop: 6, fontWeight: '500' }]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    alignItems: 'center',
  },
  charRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: spacing.sm,
  },
  charOption: {
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
});
