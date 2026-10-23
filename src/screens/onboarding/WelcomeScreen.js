// src/screens/onboarding/WelcomeScreen.js
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { CharacterAvatar } from '../../animal_ui/components/CharacterAvatar.js';
import { executeOneTapGoogleSignIn } from '../../services/googleAuthService';

// Official Google G SVG Icon
function GoogleIcon({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.29 21.36 7.37 24 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.29 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </Svg>
  );
}

export default function WelcomeScreen({ navigation }) {
  const [googleLoading, setGoogleLoading] = useState(false);

  // 1-Tap Real Google Sign-In
  const handleGoogleSignInPress = async () => {
    setGoogleLoading(true);
    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (_) {}

      const res = await executeOneTapGoogleSignIn();

      if (res.success) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (_) {}

        navigation.replace('MainTabs');
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
