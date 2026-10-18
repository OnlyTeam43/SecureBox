// src/screens/onboarding/LoginScreen.js
// Login with @handle + PIN

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  StatusBar, Alert,
} from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { useUserStore } from '../../store/useUserStore';
import { getAvatar } from '../../constants/avatars';
import { verifyLoginCredentials } from '../../services/supabase';

export default function LoginScreen({ navigation }) {
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const storedHandle = useUserStore((s) => s.handle);
  const storedPassword = useUserStore((s) => s.password);
  const avatarId = useUserStore((s) => s.avatarId);
  const nickname = useUserStore((s) => s.nickname);
  const setProfile = useUserStore((s) => s.setProfile);
  const setPassword_ = useUserStore((s) => s.setPassword);
  const completeSetup = useUserStore((s) => s.completeSetup);
  const avatar = getAvatar(avatarId);

  const handleLogin = async () => {
    const cleanHandle = handle.replace('@', '').trim().toLowerCase();
    if (!cleanHandle) return Alert.alert('Enter handle', 'Please enter your @handle');
    if (!password) return Alert.alert('Enter Password', 'Please enter your password');

    // 1. Check local match first
    if (storedHandle && cleanHandle === storedHandle && password === storedPassword) {
      completeSetup();
      return navigation.replace('MainTabs');
    }

    // 2. Fallback to Supabase remote check
    setLoading(true);
    try {
      const user = await verifyLoginCredentials(cleanHandle, password);
      if (user) {
        setProfile(user.handle, user.nickname, user.avatar_id, user.mobile_number);
        setPassword_(password);
        completeSetup();
        navigation.replace('MainTabs');
      } else {
        Alert.alert('Login Failed', 'Invalid @handle or password. Please check your credentials.');
      }
    } catch (err) {
      console.error('Login error:', err);
      Alert.alert('Login Error', err.message || 'Could not reach server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.primary} />

      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      <View style={styles.hero}>
        {avatarId && <Text style={styles.avatar}>{avatar.emoji}</Text>}
        <Text style={styles.heading}>Welcome back</Text>
        {nickname && <Text style={styles.sub}>{nickname}</Text>}
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Your @handle</Text>
        <View style={styles.handleRow}>
          <Text style={styles.at}>@</Text>
          <TextInput
            style={[styles.input, styles.handleInput]}
            placeholder="yourhandle"
            placeholderTextColor={Colors.text.placeholder}
            value={handle}
            onChangeText={(t) => setHandle(t.toLowerCase())}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Text style={[styles.label, { marginTop: Spacing.md }]}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={Colors.text.placeholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.loginBtn, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.loginBtnText}>{loading ? 'Verifying...' : 'Unlock 🔓'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    padding: Spacing.lg,
  },
  back: { marginTop: Spacing.xl, marginBottom: Spacing.md },
  backText: { fontSize: 22, color: Colors.text.primary },
  hero: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  avatar: { fontSize: 64, marginBottom: Spacing.sm },
  heading: {
    fontSize: Typography.sizes.xxl,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  sub: {
    fontSize: Typography.sizes.md,
    color: Colors.text.secondary,
  },
  form: { gap: Spacing.xs },
  label: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
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
  loginBtn: {
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  loginBtnText: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
  },
});
