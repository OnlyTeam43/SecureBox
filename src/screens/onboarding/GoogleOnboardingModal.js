// src/screens/onboarding/GoogleOnboardingModal.js
// 100% Real Google Sign-In Onboarding Modal for SecureBox
// Auto-fetches real user identity from Google (Name, Email, Profile Picture)
// Zero manual forms, zero mock accounts, 1-tap instant setup.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { X, Shield, Sparkles } from 'lucide-react-native';

import { executeOneTapGoogleSignIn } from '../../services/googleAuthService';

// Official Google G SVG Icon
function GoogleIcon({ size = 22 }) {
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

export default function GoogleOnboardingModal({ visible, onClose, onComplete }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  // 1-Tap Google Sign-In Handler
  const handleGoogleSignInPress = async () => {
    setLoading(true);
    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (_) {}

      const res = await executeOneTapGoogleSignIn();

      if (res.success) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (_) {}

        if (onComplete) {
          onComplete(res.user);
        } else if (onClose) {
          onClose();
        }
        return;
      }

      if (res.cancelled) {
        // User dismissed the Google sheet
        return;
      }

      if (res.error) {
        Alert.alert('Google Sign-In', res.error);
      }
    } catch (err) {
      console.error('[GoogleOnboarding] Error:', err);
      Alert.alert(
        'Google Sign-In Error',
        err.message || 'Unable to connect to Google Play Services. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="dark-content" />
      <View style={styles.backdrop}>
        <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          {/* Header with close button */}
          <View style={styles.header}>
            <View style={styles.shieldBadge}>
              <Shield size={16} color="#D97757" />
              <Text style={styles.shieldBadgeText}>Secure Verification</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={20} color="#87867F" />
            </TouchableOpacity>
          </View>

          {/* Title & Description */}
          <View style={styles.titleWrap}>
            <Text style={styles.title}>Continue with Google</Text>
            <Text style={styles.subtitle}>
              Zero-typing onboarding. Your name, email, and avatar are automatically secured from your Google account.
            </Text>
          </View>

          {/* Benefits list */}
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Sparkles size={16} color="#2E7D32" style={styles.benefitIcon} />
              <Text style={styles.benefitText}>Instant identity setup — no forms to type</Text>
            </View>
            <View style={styles.benefitItem}>
              <Sparkles size={16} color="#2E7D32" style={styles.benefitIcon} />
              <Text style={styles.benefitText}>Auto-generated private unique @handle</Text>
            </View>
            <View style={styles.benefitItem}>
              <Sparkles size={16} color="#2E7D32" style={styles.benefitIcon} />
              <Text style={styles.benefitText}>End-to-end encrypted Supabase vault</Text>
            </View>
          </View>

          {/* 1-Tap Google Button */}
          <TouchableOpacity
            style={[styles.googleBtn, loading && { opacity: 0.8 }]}
            onPress={handleGoogleSignInPress}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#1f1f1f" />
            ) : (
              <>
                <GoogleIcon size={22} />
                <Text style={styles.googleBtnText}>Sign in with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.legalNotice}>
            By continuing, SecureBox creates an encrypted chat profile linked to your verified Google account.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 20, 19, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FAF9F5',
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(20, 20, 19, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  shieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(217, 119, 87, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  shieldBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97757',
    letterSpacing: 0.3,
  },
  closeBtn: {
    padding: 4,
  },
  titleWrap: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#141413',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#63625D',
    lineHeight: 20,
  },
  benefitsList: {
    backgroundColor: 'rgba(20, 20, 19, 0.04)',
    borderRadius: 16,
    padding: 14,
    gap: 10,
    marginBottom: 24,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitIcon: {
    marginRight: 10,
  },
  benefitText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#383734',
  },
  googleBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E0D8',
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 14,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#141413',
    letterSpacing: 0.2,
  },
  legalNotice: {
    fontSize: 11,
    color: '#87867F',
    textAlign: 'center',
    lineHeight: 16,
  },
});
