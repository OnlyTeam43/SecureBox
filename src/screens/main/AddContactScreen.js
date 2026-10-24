// src/screens/main/AddContactScreen.js
// Add someone by their @handle

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  StatusBar, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { AVATARS } from '../../constants/avatars';
import { findUserByHandle, sendConnectionRequest, checkConnectionStatus } from '../../services/supabase';
import { insertContact, upsertConversation } from '../../db/database';
import { useUserStore } from '../../store/useUserStore';

export default function AddContactScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const myHandle = useUserStore((s) => s.handle);
  const myNickname = useUserStore((s) => s.nickname);
  const myAvatarId = useUserStore((s) => s.avatarId);

  const [handle, setHandle] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0].id);
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    const cleanHandle = handle.replace('@', '').trim().toLowerCase();
    if (!cleanHandle || cleanHandle.length < 3)
      return Alert.alert('Invalid handle', 'Enter a valid @handle (min 3 chars).');

    if (cleanHandle === myHandle?.toLowerCase()) {
      return Alert.alert('Self Connection', 'You cannot send a connection request to yourself.');
    }

    setLoading(true);
    try {
      // 1. Check existing connection or pending status
      const connStatus = await checkConnectionStatus(myHandle, cleanHandle);

      if (connStatus.status === 'connected' || connStatus.status === 'pending_sent') {
        setLoading(false);
        const contact = connStatus.contact || { handle: cleanHandle, nickname: cleanHandle, avatar_id: 'avatar_rose' };
        const participants = [myHandle.toLowerCase(), cleanHandle].sort();
        const convId = `chat_${participants[0]}_${participants[1]}`;
        const contactId = `contact_${cleanHandle}`;
        await insertContact({
          id: contactId,
          handle: cleanHandle,
          nickname: contact.nickname || cleanHandle,
          avatarId: contact.avatar_id || 'avatar_rose',
        });
        await upsertConversation({
          id: convId,
          contactId,
          lastMsg: 'Connected! Say hi 💕',
          lastTime: Date.now(),
          unread: 0,
        });
        return navigation.navigate('Chat', {
          conversationId: convId,
          contactHandle: cleanHandle,
          contactNickname: contact.nickname || cleanHandle,
          contactAvatarId: contact.avatar_id || 'avatar_rose',
        });
      }

      if (connStatus.status === 'pending_received') {
        setLoading(false);
        return Alert.alert(
          'Request Waiting! 💌',
          `@${cleanHandle} has already sent you a connection request! Go to your Requests tab to accept.`,
          [
            { text: 'Go to Requests', onPress: () => navigation.navigate('Requests') },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }

      // 2. Verify if handle exists in Supabase
      const remoteUser = await findUserByHandle(cleanHandle);
      if (!remoteUser) {
        setLoading(false);
        return Alert.alert('User Not Found', `No user found with @${cleanHandle}`);
      }

      // 3. Send connection request
      await sendConnectionRequest({
        fromHandle: myHandle,
        toHandle: cleanHandle,
        fromNickname: myNickname || nickname.trim(),
        fromAvatar: myAvatarId,
      });

      const participants = [myHandle.toLowerCase(), cleanHandle].sort();
      const convId = `chat_${participants[0]}_${participants[1]}`;
      const contactId = `contact_${cleanHandle}`;
      await insertContact({
        id: contactId,
        handle: cleanHandle,
        nickname: nickname.trim() || remoteUser.nickname || cleanHandle,
        avatarId: selectedAvatar || remoteUser.avatar_id || 'avatar_rose',
      });
      await upsertConversation({
        id: convId,
        contactId,
        lastMsg: 'Chat request sent 💌',
        lastTime: Date.now(),
        unread: 0,
      });

      setLoading(false);
      Alert.alert(
        'Connected! 💌',
        `Chat created with @${cleanHandle}! You can start chatting right away.`,
        [
          {
            text: 'Chat Now 💕',
            onPress: () => {
              navigation.navigate('Chat', {
                conversationId: convId,
                contactHandle: cleanHandle,
                contactNickname: nickname.trim() || remoteUser.nickname || cleanHandle,
                contactAvatarId: selectedAvatar || remoteUser.avatar_id || 'avatar_rose',
              });
            },
          },
        ]
      );
    } catch (e) {
      console.error('Error adding contact:', e);
      Alert.alert('Error', `Could not send request: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Add someone</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={styles.sub}>Enter their @handle to connect</Text>

      {/* Handle input */}
      <Text style={styles.label}>Their @handle</Text>
      <View style={styles.handleRow}>
        <Text style={styles.at}>@</Text>
        <TextInput
          style={[styles.input, styles.handleInput]}
          placeholder="theirhandle"
          placeholderTextColor={Colors.text.placeholder}
          value={handle}
          onChangeText={(t) => setHandle(t.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
        />
      </View>

      {/* Nickname */}
      <Text style={styles.label}>Your nickname for them</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. My love, Babe..."
        placeholderTextColor={Colors.text.placeholder}
        value={nickname}
        onChangeText={setNickname}
        maxLength={30}
      />

      {/* Avatar picker */}
      <Text style={styles.label}>Pick an avatar for them</Text>
      <View style={styles.avatarGrid}>
        {AVATARS.map((av) => (
          <TouchableOpacity
            key={av.id}
            style={[styles.avatarItem, selectedAvatar === av.id && styles.avatarSelected]}
            onPress={() => setSelectedAvatar(av.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.avatarEmoji}>{av.emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.addBtn, loading && { opacity: 0.6 }]}
        onPress={handleAdd}
        disabled={loading}
        activeOpacity={0.85}
      >
        <Text style={styles.addBtnText}>{loading ? 'Adding...' : 'Start chatting 💌'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },
  container: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  backIcon: { fontSize: 22, color: Colors.text.primary },
  heading: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  sub: {
    fontSize: Typography.sizes.md,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    color: Colors.text.primary,
    fontSize: Typography.sizes.md,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  handleRow: { flexDirection: 'row', alignItems: 'center' },
  at: {
    color: Colors.accent.primary,
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.bg.secondary,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRightWidth: 0,
    borderRadius: Radius.md,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  handleInput: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  avatarItem: {
    width: 54,
    height: 54,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarSelected: {
    borderColor: Colors.accent.primary,
    backgroundColor: Colors.accent.glow,
  },
  avatarEmoji: { fontSize: 28 },
  addBtn: {
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  addBtnText: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
  },
});
