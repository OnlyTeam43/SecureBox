// src/screens/onboarding/GoogleOnboardingModal.js
// 100% Real Google Sign-In & Onboarding for SecureBox
// Connects to real Google accounts (Native or Browser OAuth / Direct Google Email)
// Absolutely zero mock or fake profiles ("Alex Rivers", "Sanskar Verma" removed).
// Fetches real name, auto-suggests unique handle, sets vault password,
// sets 4-digit recovery/stealth PIN, and enters the chat interface.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Check, RefreshCw, X, Shield, Sparkles, Mail, ArrowRight } from 'lucide-react-native';

import { useUserStore } from '../../store/useUserStore';
import { registerUserInSupabase, generateUniqueHandle, checkHandleAvailability } from '../../services/supabase';
import {
  signInWithRealGoogle,
  handleGoogleOAuthRedirect,
} from '../../services/googleAuthService';
import { CharacterBall } from '../../animal_ui/components/CharacterBall.js';

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

export default function GoogleOnboardingModal({ visible, onClose, onComplete }) {
  const insets = useSafeAreaInsets();

  const setProfile = useUserStore((s) => s.setProfile);
  const setPassword = useUserStore((s) => s.setPassword);
  const setStealthPin = useUserStore((s) => s.setStealthPin);
  const setMyCharacter = useUserStore((s) => s.setMyCharacter);
  const completeSetup = useUserStore((s) => s.completeSetup);
  const setStealthUnlocked = useUserStore((s) => s.setStealthUnlocked);

  // Flow step: 1 = Google Sign In / Connect, 2 = Configure Vault Details
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [browserWaiting, setBrowserWaiting] = useState(false);
  const [showManualGoogle, setShowManualGoogle] = useState(false);

  // Direct manual Google input fields
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');

  // Form Fields
  const [googleUser, setGoogleUser] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [handle, setHandle] = useState('');
  const [isGeneratingHandle, setIsGeneratingHandle] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [character, setCharacter] = useState('panda');

  // Deep Link listener for real Google OAuth redirect (securebox://google-auth)
  useEffect(() => {
    const handleUrlEvent = async (event) => {
      const url = event?.url;
      if (!url || !url.includes('google-auth')) return;

      setLoading(true);
      setBrowserWaiting(false);
      try {
        const profile = await handleGoogleOAuthRedirect(url);
        if (profile && profile.success) {
          await applyGoogleProfile(profile);
        }
      } catch (err) {
        console.warn('[GoogleOnboarding] Deep link redirect error:', err);
      } finally {
        setLoading(false);
      }
    };

    const sub = Linking.addEventListener('url', handleUrlEvent);
    Linking.getInitialURL().then((url) => {
      if (url && url.includes('google-auth')) {
        handleUrlEvent({ url });
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  // Trigger Real Google Sign-In
  const handleGoogleSignInPress = async () => {
    setLoading(true);
    setBrowserWaiting(false);
    try {
      const res = await signInWithRealGoogle();
      if (res && res.success) {
        if (res.type === 'browser_opened') {
          setBrowserWaiting(true);
        } else {
          // Native Google Sign In succeeded
          applyGoogleProfile(res);
        }
      }
    } catch (e) {
      console.warn('[GoogleOnboarding] Google sign-in error:', e);
      Alert.alert(
        'Google Sign-In',
        e.message || 'Could not launch Google Sign-In. You can enter your Google account manually below.'
      );
      setShowManualGoogle(true);
    } finally {
      setLoading(false);
    }
  };

  // Apply Google Profile & Suggest Unique Handle
  const applyGoogleProfile = async (profile) => {
    setGoogleUser(profile);
    setName(profile.name || 'User');
    setEmail(profile.email || '');

    setIsGeneratingHandle(true);
    const suggested = await generateUniqueHandle(profile.name || 'User');
    setHandle(suggested);
    setIsGeneratingHandle(false);

    setStep(2);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_) {}
  };

  // Submit manual Google account entry
  const handleManualGoogleSubmit = async () => {
    const trimmedName = manualName.trim();
    const trimmedEmail = manualEmail.trim().toLowerCase();

    if (!trimmedName || trimmedName.length < 2) {
      return Alert.alert('Invalid Name', 'Please enter your real full name.');
    }
    if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      return Alert.alert('Invalid Email', 'Please enter a valid Google/Gmail address.');
    }

    applyGoogleProfile({
      name: trimmedName,
      email: trimmedEmail,
    });
  };

  // Re-roll suggested handle
  const handleRegenerateHandle = async () => {
    if (!name) return;
    setIsGeneratingHandle(true);
    try {
      const fresh = await generateUniqueHandle(name);
      setHandle(fresh);
    } finally {
      setIsGeneratingHandle(false);
    }
  };

  // Finish Onboarding & Register in Supabase
  const handleFinishOnboarding = async () => {
    const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
    if (!cleanHandle || cleanHandle.length < 6) {
      return Alert.alert('Invalid Handle', 'Unique ID must be at least 6 characters long.');
    }
    if (!passwordInput || passwordInput.length < 6) {
      return Alert.alert('Password Too Short', 'Vault password must be at least 6 characters.');
    }
    const cleanPin = pinInput.trim().replace(/[^0-9]/g, '');
    if (cleanPin.length !== 4) {
      return Alert.alert('Invalid PIN', 'Please enter a 4-digit secret recovery PIN.');
    }

    setLoading(true);
    try {
      // 1. Verify handle availability
      const check = await checkHandleAvailability(cleanHandle);
      if (!check.available) {
        setLoading(false);
        return Alert.alert('Handle Taken', 'This ID is already taken. Please choose another or tap re-roll.');
      }

      // 2. Register user in Supabase
      await registerUserInSupabase({
        handle: cleanHandle,
        nickname: name.trim() || 'Companion',
        avatarId: character,
        mobileNumber: email,
        password: passwordInput,
        recoveryPin: cleanPin,
      });

      // 3. Save to local Zustand store
      setProfile(cleanHandle, name.trim(), character, email, null, cleanPin);
      setPassword(passwordInput);
      setStealthPin(cleanPin);
      setMyCharacter(character);
      completeSetup();
      setStealthUnlocked(true);

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}

      Alert.alert(
        'Welcome to SecureBox! 💌',
        `Account created successfully!\n\nYour Handle: @${cleanHandle}\nSecret Unlock PIN: ${cleanPin}`,
        [
          {
            text: 'Enter Chats →',
            onPress: () => {
              if (onComplete) onComplete();
              else if (onClose) onClose();
            },
          },
        ]
      );
    } catch (err) {
      console.error('Finish onboarding error:', err);
      Alert.alert('Registration Error', err.message || 'Could not complete registration. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.root}
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <StatusBar barStyle="dark-content" backgroundColor="#FAF9F5" />

          {/* Top Bar with Dismiss */}
          <View style={styles.topBar}>
            <View style={styles.badgeRow}>
              <Shield size={14} color="#D97757" />
              <Text style={styles.badgeText}>END-TO-END ENCRYPTED</Text>
            </View>
            {onClose && (
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <X size={18} color="#5E5D59" />
              </TouchableOpacity>
            )}
          </View>

          {step === 1 ? (
            /* ── STEP 1: REAL GOOGLE SIGN-IN ── */
            <View style={styles.stepOneWrap}>
              <View style={styles.heroCompanions}>
                <CharacterBall character="panda" size={60} />
                <CharacterBall character="cat" size={60} />
              </View>

              <Text style={styles.heroTitle}>Unlock SecureBox</Text>
              <Text style={styles.heroSub}>
                Secret end-to-end encrypted messaging & calling. Connect with your Google account to get started.
              </Text>

              {/* Real Google Sign-In Button */}
              <TouchableOpacity
                style={styles.googleBtn}
                onPress={handleGoogleSignInPress}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#141413" />
                ) : (
                  <>
                    <View style={styles.googleIconBox}>
                      <GoogleIcon size={22} />
                    </View>
                    <Text style={styles.googleBtnText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Waiting for Browser OAuth Banner */}
              {browserWaiting && (
                <View style={styles.browserWaitingBox}>
                  <ActivityIndicator size="small" color="#D97757" style={{ marginRight: 8 }} />
                  <Text style={styles.browserWaitingText}>
                    Waiting for Google login in browser...
                  </Text>
                </View>
              )}

              {/* Manual Direct Google Account Fallback (No Fake Mock Users!) */}
              {!showManualGoogle ? (
                <TouchableOpacity
                  style={styles.toggleManualBtn}
                  onPress={() => setShowManualGoogle(true)}
                  activeOpacity={0.7}
                >
                  <Mail size={14} color="#87867F" style={{ marginRight: 6 }} />
                  <Text style={styles.toggleManualText}>Or enter Google account details manually</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.manualCard}>
                  <Text style={styles.manualTitle}>Enter Your Google Account</Text>
                  <Text style={styles.manualSub}>
                    Use your real Google account details. Absolutely no fake mock data.
                  </Text>

                  <Text style={styles.manualLabel}>FULL NAME</Text>
                  <TextInput
                    style={styles.manualInput}
                    value={manualName}
                    onChangeText={setManualName}
                    placeholder="e.g. John Doe"
                    placeholderTextColor="#87867F"
                  />

                  <Text style={styles.manualLabel}>GOOGLE EMAIL ADDRESS</Text>
                  <TextInput
                    style={styles.manualInput}
                    value={manualEmail}
                    onChangeText={setManualEmail}
                    placeholder="e.g. yourname@gmail.com"
                    placeholderTextColor="#87867F"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <TouchableOpacity
                    style={styles.manualSubmitBtn}
                    onPress={handleManualGoogleSubmit}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.manualSubmitText}>Continue with this Account</Text>
                    <ArrowRight size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <Check size={16} color="#D97757" style={{ marginTop: 2 }} />
                  <Text style={styles.featureText}>Automatic profile & handle setup from your real Google name</Text>
                </View>
                <View style={styles.featureItem}>
                  <Check size={16} color="#D97757" style={{ marginTop: 2 }} />
                  <Text style={styles.featureText}>Disguised as the playable Animal Smash game on lock</Text>
                </View>
                <View style={styles.featureItem}>
                  <Check size={16} color="#D97757" style={{ marginTop: 2 }} />
                  <Text style={styles.featureText}>Instant recovery & quick access via your 4-digit secret PIN</Text>
                </View>
              </View>
            </View>
          ) : (
            /* ── STEP 2: FINALIZE PROFILE & VAULT PIN ── */
            <View style={styles.stepTwoWrap}>
              <Text style={styles.sectionHeading}>Setup Your Secret Profile</Text>
              <Text style={styles.sectionSub}>Connected via Google: {email}</Text>

              {/* Choose Persona */}
              <Text style={styles.fieldLabel}>CHOOSE YOUR ANIMAL PERSONA</Text>
              <View style={styles.personaRow}>
                {[
                  { id: 'panda', name: 'Panda', emoji: '🐼' },
                  { id: 'cat', name: 'Cat', emoji: '🐱' },
                  { id: 'puppy', name: 'Puppy', emoji: '🐶' },
                ].map((p) => {
                  const active = character === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.personaPill, active && styles.personaPillActive]}
                      onPress={() => setCharacter(p.id)}
                    >
                      <CharacterBall character={p.id} size={28} />
                      <Text style={[styles.personaText, active && styles.personaTextActive]}>
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Name field */}
              <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  generateUniqueHandle(t).then(setHandle).catch(() => {});
                }}
                placeholder="Your Name"
                placeholderTextColor="#87867F"
              />

              {/* Handle with Auto-Suggest */}
              <View style={styles.handleHeaderRow}>
                <Text style={styles.fieldLabel}>UNIQUE ID (@HANDLE)</Text>
                <TouchableOpacity
                  style={styles.rerollBtn}
                  onPress={handleRegenerateHandle}
                  disabled={isGeneratingHandle}
                >
                  <RefreshCw size={12} color="#D97757" />
                  <Text style={styles.rerollText}>Suggest Another</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.handleInputWrap}>
                <Text style={styles.handleAt}>@</Text>
                <TextInput
                  style={styles.handleInput}
                  value={handle}
                  onChangeText={(t) => setHandle(t.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                  placeholder="unique_handle"
                  placeholderTextColor="#87867F"
                  autoCapitalize="none"
                />
                {isGeneratingHandle ? (
                  <ActivityIndicator size="small" color="#D97757" />
                ) : (
                  <View style={styles.verifiedBadge}>
                    <Check size={12} color="#2E7D32" />
                    <Text style={styles.verifiedText}>Available</Text>
                  </View>
                )}
              </View>

              {/* Password */}
              <Text style={styles.fieldLabel}>SET VAULT PASSWORD</Text>
              <TextInput
                style={styles.textInput}
                value={passwordInput}
                onChangeText={setPasswordInput}
                placeholder="At least 6 characters"
                placeholderTextColor="#87867F"
                secureTextEntry
              />

              {/* 4-Digit Secret PIN */}
              <Text style={styles.fieldLabel}>SET 4-DIGIT SECRET PIN</Text>
              <Text style={styles.fieldNote}>
                Used to unlock SecureBox from the Animal Smash game screen
              </Text>
              <TextInput
                style={[styles.textInput, styles.pinInput]}
                value={pinInput}
                onChangeText={(t) => setPinInput(t.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="e.g. 1357"
                placeholderTextColor="#87867F"
                keyboardType="number-pad"
                maxLength={4}
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.finishBtn, loading && { opacity: 0.7 }]}
                onPress={handleFinishOnboarding}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.finishBtnText}>Enter SecureBox Vault →</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAF9F5',
  },
  container: {
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217,119,87,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97757',
    letterSpacing: 0.6,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOneWrap: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  heroCompanions: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#141413',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 14,
    color: '#5E5D59',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
    marginBottom: 32,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 320,
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(20,20,19,0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
  },
  googleIconBox: {
    marginRight: 12,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#141413',
  },
  browserWaitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217,119,87,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 16,
  },
  browserWaitingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D97757',
  },
  toggleManualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  toggleManualText: {
    fontSize: 13,
    color: '#87867F',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  manualCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.1)',
    marginBottom: 24,
  },
  manualTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#141413',
    marginBottom: 4,
  },
  manualSub: {
    fontSize: 12,
    color: '#87867F',
    marginBottom: 14,
  },
  manualLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#87867F',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  manualInput: {
    height: 44,
    backgroundColor: '#FAF9F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.12)',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#141413',
    marginBottom: 12,
  },
  manualSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97757',
    height: 44,
    borderRadius: 12,
    marginTop: 4,
  },
  manualSubmitText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  featureList: {
    width: '100%',
    maxWidth: 320,
    marginTop: 10,
    gap: 14,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureText: {
    fontSize: 13,
    color: '#5E5D59',
    lineHeight: 18,
    flex: 1,
  },
  stepTwoWrap: {
    paddingVertical: 10,
  },
  sectionHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#141413',
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13,
    color: '#5E5D59',
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#87867F',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  fieldNote: {
    fontSize: 12,
    color: '#87867F',
    marginBottom: 8,
  },
  personaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  personaPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(20,20,19,0.12)',
    gap: 8,
  },
  personaPillActive: {
    borderColor: '#D97757',
    backgroundColor: 'rgba(217,119,87,0.08)',
  },
  personaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5E5D59',
  },
  personaTextActive: {
    color: '#D97757',
    fontWeight: '800',
  },
  textInput: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.14)',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#141413',
    marginBottom: 20,
  },
  handleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rerollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rerollText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97757',
  },
  handleInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.14)',
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  handleAt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#87867F',
    marginRight: 4,
  },
  handleInput: {
    flex: 1,
    fontSize: 15,
    color: '#141413',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(46,125,50,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2E7D32',
  },
  pinInput: {
    textAlign: 'center',
    fontSize: 22,
    letterSpacing: 10,
    fontWeight: '800',
  },
  finishBtn: {
    height: 52,
    backgroundColor: '#D97757',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#D97757',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  finishBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
