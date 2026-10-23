// src/screens/onboarding/GoogleOnboardingModal.js
// 100% Real Google Sign-In & Profile Setup Modal for SecureBox
// Auto-fetches real identity from Google (Name, Email, Profile Picture)
// Allows user to confirm/customize their @handle and set their 4-digit secret PIN.

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { X, Shield, Sparkles, Check, Lock } from 'lucide-react-native';

import GoogleIcon from '../../components/GoogleIcon';
import { CharacterBall } from '../../animal_ui/components/CharacterBall.js';
import {
  initiateGoogleAuth,
  completeGoogleRegistration,
} from '../../services/googleAuthService';
import { checkHandleAvailability } from '../../services/supabase';

export default function GoogleOnboardingModal({
  visible,
  initialProfile = null,
  onClose,
  onComplete,
}) {
  const insets = useSafeAreaInsets();

  // 'INIT' | 'SETUP'
  const [step, setStep] = useState(initialProfile ? 'SETUP' : 'INIT');
  const [profile, setProfile] = useState(initialProfile);

  // Form Fields
  const [handle, setHandle] = useState(initialProfile?.suggestedHandle || '');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  // Loading & Validation
  const [authLoading, setAuthLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);
  const [handleStatus, setHandleStatus] = useState(null); // { available: boolean, reason: string }
  const handleDebounceRef = useRef(null);

  // Sync when initialProfile changes
  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
      setHandle(initialProfile.suggestedHandle || '');
      setStep('SETUP');
      // Check initial suggested handle
      if (initialProfile.suggestedHandle) {
        checkHandle(initialProfile.suggestedHandle);
      }
    } else {
      setStep('INIT');
    }
  }, [initialProfile, visible]);

  // Handle availability checking
  const checkHandle = async (candidate) => {
    const clean = (candidate || '').replace('@', '').trim().toLowerCase();
    if (!clean || clean.length < 3) {
      setHandleStatus({ available: false, reason: 'At least 3 characters required' });
      setIsCheckingHandle(false);
      return;
    }

    setIsCheckingHandle(true);
    try {
      const res = await checkHandleAvailability(clean);
      setHandleStatus(res);
    } catch (_) {
      setHandleStatus({ available: true, reason: 'Available' });
    } finally {
      setIsCheckingHandle(false);
    }
  };

  const handleHandleChange = (text) => {
    const clean = text.replace(/[^a-zA-Z0-9_.]/g, '').toLowerCase();
    setHandle(clean);

    if (handleDebounceRef.current) {
      clearTimeout(handleDebounceRef.current);
    }

    if (!clean || clean.length < 3) {
      setHandleStatus({ available: false, reason: 'At least 3 characters required' });
      return;
    }

    setIsCheckingHandle(true);
    handleDebounceRef.current = setTimeout(() => {
      checkHandle(clean);
    }, 400);
  };

  // Step 1: User taps "Sign in with Google"
  const handleGoogleSignInPress = async () => {
    setAuthLoading(true);
    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (_) {}

      const res = await initiateGoogleAuth();

      if (res.success) {
        if (res.exists) {
          // Returning user -> instantly complete!
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (_) {}
          if (onComplete) onComplete(res.user);
          else if (onClose) onClose();
          return;
        }

        // New user -> proceed to Step 2 Setup
        setProfile(res.profile);
        setHandle(res.profile.suggestedHandle || '');
        setStep('SETUP');
        checkHandle(res.profile.suggestedHandle || '');
        return;
      }

      if (res.cancelled) {
        return;
      }

      if (res.error) {
        Alert.alert('Google Sign-In', res.error);
      }
    } catch (err) {
      console.error('[GoogleOnboarding] Error:', err);
      Alert.alert(
        'Google Sign-In Error',
        err.message || 'Unable to connect to Google Play Services.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  // Step 2: User completes Handle & PIN setup
  const handleCompleteRegistration = async () => {
    const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
    const cleanPin = pin.trim().replace(/[^0-9]/g, '');

    if (cleanHandle.length < 3) {
      Alert.alert('Handle Required', 'Please enter a valid handle with at least 3 characters.');
      return;
    }

    if (handleStatus && !handleStatus.available) {
      Alert.alert('Handle Unavailable', handleStatus.reason || 'This handle is already taken.');
      return;
    }

    if (cleanPin.length !== 4) {
      Alert.alert('4-Digit PIN Required', 'Please set a 4-digit secret PIN to unlock your vault.');
      return;
    }

    setSubmitLoading(true);
    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (_) {}

      const res = await completeGoogleRegistration({
        authUserId: profile.authUserId,
        name: profile.name,
        email: profile.email,
        photo: profile.photo,
        handle: cleanHandle,
        pin: cleanPin,
      });

      if (res.success) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (_) {}

        if (onComplete) {
          onComplete(res.user);
        } else if (onClose) {
          onClose();
        }
      }
    } catch (err) {
      console.error('[GoogleOnboarding] Registration error:', err);
      Alert.alert('Setup Error', err.message || 'Could not complete registration. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const isFormValid =
    handle.trim().length >= 3 &&
    pin.trim().length === 4 &&
    (!handleStatus || handleStatus.available) &&
    !isCheckingHandle;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            {/* Header with close button */}
            <View style={styles.header}>
              <View style={styles.shieldBadge}>
                <Shield size={16} color="#D97757" />
                <Text style={styles.shieldBadgeText}>
                  {step === 'SETUP' ? 'Profile & PIN Setup' : 'Secure Verification'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={20} color="#87867F" />
              </TouchableOpacity>
            </View>

            {step === 'INIT' ? (
              // ── STEP 1: INITIAL GOOGLE SIGN-IN PROMPT ──
              <View>
                <View style={styles.titleWrap}>
                  <Text style={styles.title}>Continue with Google</Text>
                  <Text style={styles.subtitle}>
                    Instant identity setup from your Google account. You will customize your private @handle and 4-digit vault PIN.
                  </Text>
                </View>

                {/* Benefits list */}
                <View style={styles.benefitsList}>
                  <View style={styles.benefitItem}>
                    <Sparkles size={16} color="#2E7D32" style={styles.benefitIcon} />
                    <Text style={styles.benefitText}>Instant identity setup from Google</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Sparkles size={16} color="#2E7D32" style={styles.benefitIcon} />
                    <Text style={styles.benefitText}>Choose your custom secret @handle</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Sparkles size={16} color="#2E7D32" style={styles.benefitIcon} />
                    <Text style={styles.benefitText}>Set your 4-digit stealth game unlock PIN</Text>
                  </View>
                </View>

                {/* Google Sign-In Action Button */}
                <TouchableOpacity
                  style={[styles.googleBtn, authLoading && { opacity: 0.8 }]}
                  onPress={handleGoogleSignInPress}
                  disabled={authLoading}
                  activeOpacity={0.85}
                >
                  {authLoading ? (
                    <ActivityIndicator color="#1f1f1f" />
                  ) : (
                    <>
                      <GoogleIcon size={22} />
                      <Text style={styles.googleBtnText}>Sign in with Google</Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={styles.legalNotice}>
                  By continuing, SecureBox creates an encrypted vault profile linked to your Google account.
                </Text>
              </View>
            ) : (
              // ── STEP 2: PROFILE CONFIRMATION & PIN SETUP ──
              <View>
                <View style={styles.titleWrap}>
                  <Text style={styles.title}>Customize Your Vault</Text>
                  <Text style={styles.subtitle}>
                    Review your Google identity, pick your unique @handle, and set your secret unlock PIN.
                  </Text>
                </View>

                {/* Verified Google Account Banner */}
                <View style={styles.googleAccountCard}>
                  {profile?.photo ? (
                    <Image source={{ uri: profile.photo }} style={styles.googleAvatar} />
                  ) : (
                    <View style={styles.googleAvatarFallback}>
                      <CharacterBall character="panda" size={36} />
                    </View>
                  )}
                  <View style={styles.googleAccountInfo}>
                    <View style={styles.googleAccountNameRow}>
                      <Text style={styles.googleAccountName} numberOfLines={1}>
                        {profile?.name || 'Google User'}
                      </Text>
                      <View style={styles.verifiedTag}>
                        <Check size={12} color="#FFFFFF" strokeWidth={3} />
                        <Text style={styles.verifiedTagText}>Google</Text>
                      </View>
                    </View>
                    <Text style={styles.googleAccountEmail} numberOfLines={1}>
                      {profile?.email || ''}
                    </Text>
                  </View>
                </View>

                {/* Field 1: Unique @handle */}
                <View style={styles.fieldSection}>
                  <Text style={styles.fieldLabel}>Choose your secret @handle</Text>
                  <Text style={styles.fieldSubLabel}>
                    Friends use this unique handle to find and message you
                  </Text>
                  <View style={styles.inputRow}>
                    <Text style={styles.inputPrefix}>@</Text>
                    <TextInput
                      style={styles.textInput}
                      value={handle}
                      onChangeText={handleHandleChange}
                      placeholder="yourhandle"
                      placeholderTextColor="#87867F"
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={24}
                    />
                    {isCheckingHandle && (
                      <ActivityIndicator size="small" color="#D97757" style={{ marginRight: 8 }} />
                    )}
                  </View>
                  {handle.length >= 3 && handleStatus && (
                    <View style={styles.statusRow}>
                      {handleStatus.available ? (
                        <>
                          <Check size={14} color="#2E7D32" strokeWidth={2.5} />
                          <Text style={styles.statusAvailableText}>@{handle} is available</Text>
                        </>
                      ) : (
                        <Text style={styles.statusTakenText}>
                          {handleStatus.reason || 'This handle is taken'}
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                {/* Field 2: 4-Digit Secret Unlock PIN */}
                <View style={styles.fieldSection}>
                  <View style={styles.labelWithIcon}>
                    <Lock size={15} color="#D97757" />
                    <Text style={styles.fieldLabel}>Set 4-Digit Secret Vault PIN</Text>
                  </View>
                  <Text style={styles.fieldSubLabel}>
                    You will enter this PIN on the animal game screen to reveal your chats
                  </Text>
                  <View style={styles.pinInputRow}>
                    <TextInput
                      style={styles.pinTextInput}
                      value={pin}
                      onChangeText={(t) => setPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
                      placeholder="1357"
                      placeholderTextColor="#A09E96"
                      keyboardType="number-pad"
                      secureTextEntry={!showPin}
                      maxLength={4}
                    />
                    <TouchableOpacity
                      style={styles.pinToggleBtn}
                      onPress={() => setShowPin(!showPin)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.pinToggleBtnText}>{showPin ? 'Hide' : 'Show'}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.pinTipText}>
                    💡 Remember this PIN! If you forget, you can also unlock with Google.
                  </Text>
                </View>

                {/* Complete Button */}
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    (!isFormValid || submitLoading) && { opacity: 0.6 },
                  ]}
                  onPress={handleCompleteRegistration}
                  disabled={!isFormValid || submitLoading}
                  activeOpacity={0.85}
                >
                  {submitLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Enter SecureBox</Text>
                  )}
                </TouchableOpacity>

                {/* Switch Google Account Option */}
                <TouchableOpacity
                  style={styles.switchAccountBtn}
                  onPress={() => setStep('INIT')}
                  disabled={submitLoading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.switchAccountText}>Use a different Google account</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 20, 19, 0.65)',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: '#FAF9F5',
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
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
    letterSpacing: 0.2,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(20, 20, 19, 0.05)',
  },
  titleWrap: {
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#141413',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#87867F',
  },
  benefitsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    gap: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(20, 20, 19, 0.06)',
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
    color: '#141413',
    fontWeight: '500',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 20, 19, 0.15)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f1f1f',
  },
  legalNotice: {
    fontSize: 11,
    lineHeight: 15,
    color: '#87867F',
    textAlign: 'center',
    marginTop: 14,
  },
  googleAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 20, 19, 0.08)',
    marginBottom: 16,
  },
  googleAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E4DE',
    marginRight: 12,
  },
  googleAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FAF9F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(20, 20, 19, 0.08)',
  },
  googleAccountInfo: {
    flex: 1,
  },
  googleAccountNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  googleAccountName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#141413',
    flexShrink: 1,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  verifiedTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  googleAccountEmail: {
    fontSize: 12,
    color: '#87867F',
    marginTop: 2,
  },
  fieldSection: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141413',
  },
  fieldSubLabel: {
    fontSize: 12,
    color: '#87867F',
    marginTop: 2,
    marginBottom: 8,
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(20, 20, 19, 0.12)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  inputPrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D97757',
    marginRight: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#141413',
    height: '100%',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
    paddingLeft: 4,
  },
  statusAvailableText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
  },
  statusTakenText: {
    fontSize: 12,
    color: '#D32F2F',
    fontWeight: '600',
  },
  pinInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(20, 20, 19, 0.12)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  pinTextInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#141413',
    letterSpacing: 8,
    height: '100%',
  },
  pinToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(20, 20, 19, 0.05)',
    borderRadius: 8,
  },
  pinToggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#87867F',
  },
  pinTipText: {
    fontSize: 11,
    color: '#87867F',
    marginTop: 6,
    paddingLeft: 4,
  },
  primaryBtn: {
    backgroundColor: '#D97757',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#D97757',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  switchAccountBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  switchAccountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#87867F',
  },
});
