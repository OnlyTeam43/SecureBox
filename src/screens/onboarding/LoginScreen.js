// src/screens/onboarding/LoginScreen.js
// Login with @handle / WhatsApp + Password OR Instant 4-digit Recovery PIN reset

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { useUserStore } from '../../store/useUserStore';
import {
  verifyLoginCredentials,
  verifyRecoveryPin,
  resetUserPassword,
} from '../../services/supabase';

export default function LoginScreen({ navigation }) {
  // Mode: 'login' | 'recovery'
  const [mode, setMode] = useState('login');

  // Login fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Recovery fields
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [recoveryPin, setRecoveryPin] = useState('');
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);

  // Store actions
  const storedHandle = useUserStore((s) => s.handle);
  const storedPassword = useUserStore((s) => s.password);
  const setProfile = useUserStore((s) => s.setProfile);
  const setPassword_ = useUserStore((s) => s.setPassword);
  const completeSetup = useUserStore((s) => s.completeSetup);

  // Standard Login
  const handleLogin = async () => {
    const cleanId = identifier.replace('@', '').trim().toLowerCase();
    if (!cleanId) return Alert.alert('Enter handle', 'Please enter your @handle or WhatsApp number');
    if (!password) return Alert.alert('Enter Password', 'Please enter your password');

    // 1. Check local match first
    if (storedHandle && cleanId === storedHandle.toLowerCase() && password === storedPassword) {
      completeSetup();
      return navigation.replace('MainTabs');
    }

    // 2. Supabase remote check
    setLoading(true);
    try {
      let user = await verifyLoginCredentials(cleanId, password);

      // If not found by handle, try finding user by WhatsApp phone
      if (!user) {
        const cleanPhone = cleanId.replace(/[^0-9+]/g, '');
        if (cleanPhone) {
          const { data: phoneUser } = await verifyLoginCredentials(cleanPhone, password);
          if (phoneUser) user = phoneUser;
        }
      }

      if (user) {
        const rawPhone = user.mobile_number || '';
        const phone = rawPhone.includes('#') ? rawPhone.split('#')[0] : rawPhone;
        const pin = rawPhone.includes('#') ? rawPhone.split('#')[1] : null;

        setProfile(user.handle, user.nickname, user.avatar_id, phone, null, pin);
        setPassword_(password);
        completeSetup();
        navigation.replace('MainTabs');
      } else {
        Alert.alert('Login Failed', 'Invalid handle or password. Tap "Forgot Password?" to recover with your 4-digit PIN.');
      }
    } catch (err) {
      console.error('Login error:', err);
      Alert.alert('Login Error', err.message || 'Could not reach server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Verify 4-digit Recovery PIN
  const handleVerifyRecoveryPin = async () => {
    if (!recoveryIdentifier.trim()) {
      return Alert.alert('Required', 'Please enter your WhatsApp number or @handle');
    }
    if (!recoveryPin || recoveryPin.trim().length !== 4) {
      return Alert.alert('Enter 4-Digit PIN', 'Please enter the 4-digit recovery PIN sent to your WhatsApp');
    }

    setLoading(true);
    try {
      const result = await verifyRecoveryPin(recoveryIdentifier, recoveryPin);
      if (result.success && result.user) {
        setVerifiedUser(result.user);
      } else {
        Alert.alert('Verification Failed', result.error || 'Invalid 4-digit Recovery PIN.');
      }
    } catch (err) {
      console.error('Recovery error:', err);
      Alert.alert('Error', err.message || 'Could not verify recovery PIN.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Reset Password and Unlock
  const handleResetPassword = async () => {
    if (!verifiedUser) return;
    if (newPassword.length < 6) {
      return Alert.alert('Password Too Short', 'Password must be at least 6 characters.');
    }
    if (newPassword !== confirmNewPassword) {
      return Alert.alert('Mismatch', 'Passwords do not match.');
    }

    setLoading(true);
    try {
      await resetUserPassword(verifiedUser.handle, newPassword);

      const rawPhone = verifiedUser.mobile_number || '';
      const phone = rawPhone.includes('#') ? rawPhone.split('#')[0] : rawPhone;
      const pin = rawPhone.includes('#') ? rawPhone.split('#')[1] : null;

      setProfile(verifiedUser.handle, verifiedUser.nickname, verifiedUser.avatar_id, phone, null, pin);
      setPassword_(newPassword);
      completeSetup();

      Alert.alert(
        'Password Reset Successful! 🎉',
        `Welcome back, ${verifiedUser.nickname}! Your password has been updated.`,
        [
          {
            text: 'Unlock App',
            onPress: () => navigation.replace('MainTabs'),
          },
        ]
      );
    } catch (err) {
      console.error('Reset password error:', err);
      Alert.alert('Error', err.message || 'Could not reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <StatusBar barStyle="dark-content" backgroundColor={Colors.bg.primary} />

        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.hero}>
          <Text style={styles.logo}>💌</Text>
          <Text style={styles.heading}>
            {mode === 'login' ? 'Welcome back' : 'Account Recovery'}
          </Text>
          <Text style={styles.sub}>
            {mode === 'login'
              ? 'Unlock your private and intimate space'
              : 'Recover your account using your WhatsApp 4-digit PIN'}
          </Text>
        </View>

        {mode === 'login' ? (
          /* ── LOGIN FORM ── */
          <View style={styles.form}>
            <Text style={styles.label}>Your @handle or WhatsApp</Text>
            <View style={styles.handleRow}>
              <Text style={styles.at}>@</Text>
              <TextInput
                style={[styles.input, styles.handleInput]}
                placeholder="yourhandle or phone"
                placeholderTextColor={Colors.text.placeholder}
                value={identifier}
                onChangeText={setIdentifier}
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
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.loginBtnText}>Unlock 🔓</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => {
                setMode('recovery');
                setRecoveryIdentifier(identifier);
                setVerifiedUser(null);
              }}
            >
              <Text style={styles.forgotBtnText}>Forgot Password? Recover with WhatsApp PIN</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── RECOVERY FORM ── */
          <View style={styles.form}>
            {!verifiedUser ? (
              <>
                <Text style={styles.label}>WhatsApp Number or @handle</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+91 98765 43210 or yourhandle"
                  placeholderTextColor={Colors.text.placeholder}
                  value={recoveryIdentifier}
                  onChangeText={setRecoveryIdentifier}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={[styles.label, { marginTop: Spacing.md }]}>
                  4-Digit Recovery PIN
                </Text>
                <TextInput
                  style={[styles.input, styles.pinInput]}
                  placeholder="••••"
                  placeholderTextColor={Colors.text.placeholder}
                  value={recoveryPin}
                  onChangeText={(t) => setRecoveryPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  textAlign="center"
                  letterSpacing={12}
                />
                <Text style={styles.hint}>
                  Enter the 4-digit PIN sent to your WhatsApp during registration.
                </Text>

                <TouchableOpacity
                  style={[styles.loginBtn, loading && { opacity: 0.7 }]}
                  onPress={handleVerifyRecoveryPin}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.loginBtnText}>Verify Recovery PIN ✓</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.verifiedCard}>
                  <Text style={styles.verifiedCardTitle}>✓ Identity Verified</Text>
                  <Text style={styles.verifiedCardSub}>
                    Account: @{verifiedUser.handle} ({verifiedUser.nickname})
                  </Text>
                </View>

                <Text style={styles.label}>Set New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="New password (min 6 chars)"
                  placeholderTextColor={Colors.text.placeholder}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />

                <Text style={[styles.label, { marginTop: Spacing.sm }]}>
                  Confirm New Password
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm new password"
                  placeholderTextColor={Colors.text.placeholder}
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  secureTextEntry
                />

                <TouchableOpacity
                  style={[styles.loginBtn, loading && { opacity: 0.7 }]}
                  onPress={handleResetPassword}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.loginBtnText}>Reset Password & Unlock 🔓</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.backToLoginBtn}
              onPress={() => {
                setMode('login');
                setVerifiedUser(null);
              }}
            >
              <Text style={styles.backToLoginText}>← Back to Login</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  contentContainer: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl + 4,
    paddingBottom: Spacing.xxl + 16,
  },
  back: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  backText: { fontSize: 26, color: Colors.text.primary },
  hero: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: 4,
  },
  logo: { fontSize: 52, marginBottom: Spacing.xs },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  sub: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
  },
  form: { gap: Spacing.xs },
  label: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
    fontWeight: '700',
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
    paddingHorizontal: Spacing.md,
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
  pinInput: {
    fontSize: 24,
    fontWeight: '800',
    backgroundColor: '#ffffff',
    borderColor: Colors.accent.primary + '66',
  },
  hint: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.placeholder,
    marginTop: 4,
    marginBottom: Spacing.xs,
  },
  loginBtn: {
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.lg,
    shadowColor: Colors.accent.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: Typography.sizes.md,
    fontWeight: '700',
  },
  forgotBtn: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    padding: Spacing.xs,
  },
  forgotBtnText: {
    color: Colors.accent.primary,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  backToLoginBtn: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    padding: Spacing.xs,
  },
  backToLoginText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  verifiedCard: {
    backgroundColor: '#10b98118',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#10b98144',
    marginBottom: Spacing.md,
  },
  verifiedCardTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '800',
    color: '#10b981',
  },
  verifiedCardSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.primary,
    marginTop: 2,
    fontWeight: '600',
  },
});
