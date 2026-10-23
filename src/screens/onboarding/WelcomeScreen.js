// src/screens/onboarding/WelcomeScreen.js
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { CharacterAvatar } from '../../animal_ui/components/CharacterAvatar.js';
import GoogleIcon from '../../components/GoogleIcon';
import GoogleOnboardingModal from './GoogleOnboardingModal';
import { initiateGoogleAuth } from '../../services/googleAuthService';

export default function WelcomeScreen({ navigation }) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [pendingProfile, setPendingProfile] = useState(null);

  // 1-Tap Real Google Sign-In
  const handleGoogleSignInPress = async () => {
    setGoogleLoading(true);
    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (_) {}

      const res = await initiateGoogleAuth();

      if (res.success) {
        if (res.exists) {
          // Returning user -> Instant unlock!
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (_) {}

          navigation.replace('MainTabs');
          return;
        }

        // New user -> Open Setup Modal so they can confirm handle & choose PIN!
        setPendingProfile(res.profile);
        setShowGoogleModal(true);
        return;
      }

      if (res.cancelled) {
        // User closed the Google account selector sheet
        return;
      }

      if (res.error) {
        Alert.alert('Google Sign-In', res.error);
      }
    } catch (err) {
      console.error('[WelcomeScreen] Google Sign-In error:', err);
      Alert.alert('Google Sign-In Error', err.message || 'Unable to connect to Google Play Services.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg.primary} />

      <View style={styles.hero}>
        <View style={styles.companionsRow}>
          <CharacterAvatar character="panda" state="idle" size={90} tilt={-6} />
          <CharacterAvatar character="cat" state="idle" size={90} tilt={6} />
        </View>

        <Text style={styles.title}>SecureBox</Text>
        <Text style={styles.tagline}>
          Intimate, end-to-end private messaging & calling with your favorite companion.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.googleBtn, googleLoading && { opacity: 0.8 }]}
          onPress={handleGoogleSignInPress}
          disabled={googleLoading}
          activeOpacity={0.85}
        >
          {googleLoading ? (
            <ActivityIndicator color="#1f1f1f" />
          ) : (
            <>
              <GoogleIcon size={20} />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>Sign in with Handle / PIN</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.note}>1-Tap Google Verification · Zero Typing Setup</Text>

      {/* Google Onboarding & Profile Setup Modal for New Users */}
      <GoogleOnboardingModal
        visible={showGoogleModal}
        initialProfile={pendingProfile}
        onClose={() => {
          setShowGoogleModal(false);
          setPendingProfile(null);
        }}
        onComplete={() => {
          setShowGoogleModal(false);
          setPendingProfile(null);
          navigation.replace('MainTabs');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  companionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.sizes.display,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: Typography.sizes.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 290,
  },
  actions: {
    width: '100%',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  googleBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  googleBtnText: {
    color: '#1f1f1f',
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  primaryBtn: {
    backgroundColor: Colors.accent.primary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    alignItems: 'center',
    shadowColor: Colors.accent.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.12)',
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  note: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.placeholder,
    textAlign: 'center',
  },
});
