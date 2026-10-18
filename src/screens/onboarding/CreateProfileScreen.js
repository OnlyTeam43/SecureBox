// src/screens/onboarding/CreateProfileScreen.js
// Streamlined Onboarding: Avatar Upload, Name, Auto-Suggested Handle (min 6 chars), WhatsApp 4-digit PIN Verification & Recovery

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { useUserStore } from '../../store/useUserStore';
import {
  registerUserInSupabase,
  generateUniqueHandle,
  checkHandleAvailability,
} from '../../services/supabase';
import { dispatchWhatsAppPin, generate4DigitPin } from '../../services/whatsappService';
import { UserAvatarIcon, CameraIcon } from '../../components/Icons';

export default function CreateProfileScreen({ navigation }) {
  // Form fields
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [nickname, setNickname] = useState('');
  const [handle, setHandle] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Handle generation & validation state
  const [isGeneratingHandle, setIsGeneratingHandle] = useState(false);
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);
  const [handleStatus, setHandleStatus] = useState(null); // { available: boolean, reason: string }
  const handleDebounceRef = useRef(null);

  // WhatsApp verification state
  const [generatedPin, setGeneratedPin] = useState(null);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Submission state
  const [loading, setLoading] = useState(false);

  // Store actions
  const setProfile = useUserStore((s) => s.setProfile);
  const setPassword_ = useUserStore((s) => s.setPassword);
  const completeSetup = useUserStore((s) => s.completeSetup);

  // Pick profile photo from device gallery
  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return Alert.alert('Permission Needed', 'Please allow gallery access to pick a profile picture.');
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const photoData = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setProfilePhoto(photoData);
      }
    } catch (e) {
      console.warn('Pick photo error:', e);
    }
  };

  // Resend cooldown timer
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  // When Name changes, auto-suggest unique handle (>= 6 chars, never already exists)
  const handleNameChange = (text) => {
    setNickname(text);

    if (handleDebounceRef.current) {
      clearTimeout(handleDebounceRef.current);
    }

    const trimmed = text.trim();
    if (!trimmed) {
      setHandle('');
      setHandleStatus(null);
      return;
    }

    setIsGeneratingHandle(true);
    handleDebounceRef.current = setTimeout(async () => {
      try {
        const unique = await generateUniqueHandle(trimmed);
        setHandle(unique);
        const check = await checkHandleAvailability(unique);
        setHandleStatus(check);
      } catch (err) {
        console.warn('Handle generation error:', err);
      } finally {
        setIsGeneratingHandle(false);
      }
    }, 450);
  };

  // When user edits handle directly, check availability
  const handleManualHandleChange = (text) => {
    const clean = text.toLowerCase().replace(/[^a-z0-9_.]/g, '');
    setHandle(clean);

    if (handleDebounceRef.current) {
      clearTimeout(handleDebounceRef.current);
    }

    if (!clean) {
      setHandleStatus(null);
      return;
    }

    if (clean.length < 6) {
      setHandleStatus({
        available: false,
        reason: 'Handle must be at least 6 characters',
      });
      return;
    }

    setIsCheckingHandle(true);
    handleDebounceRef.current = setTimeout(async () => {
      try {
        const check = await checkHandleAvailability(clean);
        setHandleStatus(check);
      } catch (err) {
        console.warn('Check handle error:', err);
      } finally {
        setIsCheckingHandle(false);
      }
    }, 350);
  };

  // User taps "Suggest Another" button
  const handleSuggestAnother = async () => {
    setIsGeneratingHandle(true);
    try {
      const baseName = nickname.trim() || 'user';
      const unique = await generateUniqueHandle(baseName);
      setHandle(unique);
      const check = await checkHandleAvailability(unique);
      setHandleStatus(check);
    } catch (err) {
      console.warn('Suggest another error:', err);
    } finally {
      setIsGeneratingHandle(false);
    }
  };

  // Send WhatsApp 4-digit PIN
  const handleSendCode = async () => {
    const cleanPhone = mobileNumber.replace(/[^0-9+]/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      return Alert.alert(
        'Valid Number Needed',
        'Please enter your full WhatsApp number including country code (e.g. +91 98765 43210).'
      );
    }

    setIsSendingCode(true);
    try {
      const pin = generate4DigitPin();
      setGeneratedPin(pin);
      setIsPhoneVerified(false);
      setVerificationCode('');

      await dispatchWhatsAppPin(cleanPhone, pin);

      setIsCodeSent(true);
      setResendTimer(45); // 45 second cooldown

      // Display in-app banner for rapid testing
      Alert.alert(
        '💌 WhatsApp PIN Sent!',
        `Your 4-digit SecureBox Recovery PIN is: ${pin}\n\nSent to: ${cleanPhone}\n\nPlease enter this code below to verify your WhatsApp number.`
      );
    } catch (err) {
      console.error('Send WhatsApp code error:', err);
      Alert.alert('Delivery Error', err.message || 'Could not send WhatsApp PIN. Please check number.');
    } finally {
      setIsSendingCode(false);
    }
  };

  // Verify PIN entered by user
  const handleCodeChange = (text) => {
    const clean = text.replace(/[^0-9]/g, '').slice(0, 4);
    setVerificationCode(clean);

    if (clean.length === 4) {
      if (generatedPin && clean === generatedPin) {
        setIsPhoneVerified(true);
      } else {
        setIsPhoneVerified(false);
        Alert.alert('Incorrect PIN', 'The 4-digit code does not match. Please check and try again.');
      }
    } else {
      setIsPhoneVerified(false);
    }
  };

  // Submit and Complete Account Creation
  const handleFinish = async () => {
    if (!nickname.trim()) {
      return Alert.alert('Enter Name', 'Please enter your name or what your partner calls you.');
    }
    if (!handle || handle.length < 6) {
      return Alert.alert('Invalid Handle', 'Handle must be at least 6 characters long.');
    }
    if (handleStatus && !handleStatus.available) {
      return Alert.alert('Handle Unavailable', handleStatus.reason || 'This handle is already taken.');
    }
    if (!isPhoneVerified) {
      return Alert.alert(
        'Verify WhatsApp',
        'Please verify your WhatsApp number with the 4-digit PIN to enable account recovery and receive APK updates.'
      );
    }
    if (password.length < 6) {
      return Alert.alert('Password Too Short', 'Password must be at least 6 characters.');
    }
    if (password !== confirmPassword) {
      return Alert.alert('Password Mismatch', 'Passwords do not match.');
    }

    setLoading(true);
    try {
      const cleanPhone = mobileNumber.replace(/[^0-9+]/g, '');
      const avatarPayload = profilePhoto || 'avatar_rose';

      // Register in Supabase with handle, nickname, avatar, phone + recovery PIN, and password
      await registerUserInSupabase({
        handle,
        nickname: nickname.trim(),
        avatarId: avatarPayload,
        mobileNumber: cleanPhone,
        password,
        recoveryPin: generatedPin,
      });

      // Save to local Zustand store
      setProfile(handle, nickname.trim(), avatarPayload, cleanPhone, profilePhoto, generatedPin);
      setPassword_(password);
      completeSetup();

      Alert.alert(
        'Account Created! 💌',
        `Welcome to SecureBox, ${nickname}!\nYour handle: @${handle}\nRecovery PIN: ${generatedPin}`,
        [
          {
            text: 'Continue',
            onPress: () => navigation.replace('SetExpiry'),
          },
        ]
      );
    } catch (err) {
      console.error('Registration failed:', err);
      Alert.alert(
        'Registration Failed',
        err.message || 'Could not register unique handle in Supabase. Please check your connection.'
      );
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
        style={styles.root}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <StatusBar barStyle="dark-content" backgroundColor={Colors.bg.primary} />

        {/* Back Button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>

        {/* Header */}
        <Text style={styles.heading}>Create your account</Text>
        <Text style={styles.sub}>
          Direct APK updates & instant WhatsApp recovery. No email needed.
        </Text>

        {/* Avatar Photo Picker */}
        <View style={styles.avatarPickerSection}>
          <TouchableOpacity style={styles.avatarTouchable} onPress={handlePickPhoto} activeOpacity={0.8}>
            <View style={styles.avatarCircle}>
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.avatarPhoto} />
              ) : (
                <UserAvatarIcon size={46} color={Colors.accent.primary} />
              )}
            </View>
            <View style={styles.cameraBadge}>
              <CameraIcon size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePickPhoto}>
            <Text style={styles.changePhotoText}>
              {profilePhoto ? 'Change Photo' : 'Upload Profile Picture'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Step 1: Name */}
        <Text style={styles.label}>Name / Nickname</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Alex, Sam, Tanisha..."
          placeholderTextColor={Colors.text.placeholder}
          value={nickname}
          onChangeText={handleNameChange}
          maxLength={30}
        />

        {/* Step 2: Auto-Suggested Handle */}
        <View style={styles.handleLabelRow}>
          <Text style={styles.label}>Unique @handle (min 6 characters)</Text>
          {nickname.trim().length > 0 && (
            <TouchableOpacity
              onPress={handleSuggestAnother}
              disabled={isGeneratingHandle}
              style={styles.suggestBtn}
            >
              <Text style={styles.suggestBtnText}>🎲 Suggest another</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.handleRow}>
          <Text style={styles.at}>@</Text>
          <TextInput
            style={[styles.input, styles.handleInput]}
            placeholder="handle (min 6 chars)"
            placeholderTextColor={Colors.text.placeholder}
            value={handle}
            onChangeText={handleManualHandleChange}
            autoCapitalize="none"
            maxLength={25}
          />
          {(isGeneratingHandle || isCheckingHandle) && (
            <View style={styles.handleSpinner}>
              <ActivityIndicator size="small" color={Colors.accent.primary} />
            </View>
          )}
        </View>

        {/* Handle Availability Status */}
        {handle.length > 0 && (
          <View style={styles.statusContainer}>
            {handle.length < 6 ? (
              <Text style={styles.statusError}>✕ Must be at least 6 characters ({handle.length}/6)</Text>
            ) : handleStatus?.available ? (
              <Text style={styles.statusSuccess}>✓ @{handle} is available!</Text>
            ) : handleStatus?.available === false ? (
              <Text style={styles.statusError}>✕ {handleStatus.reason || 'Handle already taken'}</Text>
            ) : null}
          </View>
        )}

        {/* Step 3: WhatsApp Number */}
        <Text style={[styles.label, { marginTop: Spacing.md }]}>WhatsApp Number</Text>
        <View style={styles.phoneRow}>
          <TextInput
            style={[styles.input, styles.phoneInput]}
            placeholder="+91 98765 43210"
            placeholderTextColor={Colors.text.placeholder}
            value={mobileNumber}
            onChangeText={(t) => {
              setMobileNumber(t);
              setIsPhoneVerified(false);
            }}
            keyboardType="phone-pad"
            maxLength={20}
            editable={!isPhoneVerified}
          />
          <TouchableOpacity
            style={[
              styles.sendCodeBtn,
              (mobileNumber.replace(/[^0-9]/g, '').length < 8 || isSendingCode || resendTimer > 0) &&
                styles.sendCodeBtnDisabled,
            ]}
            onPress={handleSendCode}
            disabled={
              mobileNumber.replace(/[^0-9]/g, '').length < 8 || isSendingCode || resendTimer > 0
            }
            activeOpacity={0.8}
          >
            {isSendingCode ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendCodeBtnText}>
                {resendTimer > 0
                  ? `${resendTimer}s`
                  : isCodeSent
                  ? 'Resend'
                  : 'Send Code'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          Used to send you official APK updates and your 4-digit Recovery PIN.
        </Text>

        {/* Step 4: 4-Digit PIN Input (appears once code is sent) */}
        {isCodeSent && (
          <View style={styles.pinSection}>
            <View style={styles.pinHeaderRow}>
              <Text style={styles.label}>Enter 4-Digit Recovery PIN</Text>
              {isPhoneVerified && <Text style={styles.verifiedBadge}>✓ Verified</Text>}
            </View>
            <TextInput
              style={[
                styles.input,
                styles.pinInput,
                isPhoneVerified && styles.pinInputVerified,
              ]}
              placeholder="••••"
              placeholderTextColor={Colors.text.placeholder}
              value={verificationCode}
              onChangeText={handleCodeChange}
              keyboardType="number-pad"
              maxLength={4}
              textAlign="center"
              letterSpacing={12}
            />
            {isPhoneVerified ? (
              <Text style={styles.statusSuccess}>
                ✓ WhatsApp verified! This PIN will also recover your password if forgotten.
              </Text>
            ) : (
              <Text style={styles.hint}>
                Check your WhatsApp message or the alert popup for your 4-digit code.
              </Text>
            )}
          </View>
        )}

        {/* Step 5: Password */}
        <Text style={[styles.label, { marginTop: Spacing.md }]}>Password (min 6 chars)</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={Colors.text.placeholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={styles.label}>Confirm Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={Colors.text.placeholder}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            (!isPhoneVerified ||
              !handleStatus?.available ||
              password.length < 6 ||
              password !== confirmPassword ||
              loading) &&
              styles.primaryBtnDisabled,
          ]}
          onPress={handleFinish}
          disabled={
            !isPhoneVerified ||
            !handleStatus?.available ||
            password.length < 6 ||
            password !== confirmPassword ||
            loading
          }
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Finish Setup ✓</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },
  container: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl + 4,
    paddingBottom: Spacing.xxl + 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  backBtnText: {
    fontSize: 26,
    color: Colors.text.primary,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  sub: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  avatarPickerSection: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarTouchable: {
    position: 'relative',
    marginBottom: 6,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.accent.light,
    overflow: 'hidden',
  },
  avatarPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.accent.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  changePhotoText: {
    fontSize: Typography.sizes.xs,
    color: Colors.accent.primary,
    fontWeight: '700',
  },
  label: {
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  handleLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  suggestBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  suggestBtnText: {
    fontSize: Typography.sizes.xs,
    color: Colors.accent.primary,
    fontWeight: '700',
  },
  input: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    color: Colors.text.primary,
    fontSize: Typography.sizes.md,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  at: {
    color: Colors.accent.primary,
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.md,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRightWidth: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  handleInput: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  handleSpinner: {
    position: 'absolute',
    right: 12,
  },
  statusContainer: {
    marginTop: 4,
    marginBottom: 4,
  },
  statusSuccess: {
    fontSize: Typography.sizes.xs,
    color: '#10b981',
    fontWeight: '700',
  },
  statusError: {
    fontSize: Typography.sizes.xs,
    color: '#ef4444',
    fontWeight: '600',
  },
  phoneRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  phoneInput: {
    flex: 1,
  },
  sendCodeBtn: {
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 95,
  },
  sendCodeBtnDisabled: {
    opacity: 0.5,
  },
  sendCodeBtnText: {
    color: '#ffffff',
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
  },
  pinSection: {
    backgroundColor: Colors.accent.glow,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accent.primary + '33',
    marginTop: Spacing.sm,
  },
  pinHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  verifiedBadge: {
    fontSize: Typography.sizes.xs,
    color: '#10b981',
    fontWeight: '800',
    backgroundColor: '#10b98122',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  pinInput: {
    fontSize: 22,
    fontWeight: '800',
    backgroundColor: '#ffffff',
  },
  pinInputVerified: {
    borderColor: '#10b981',
    borderWidth: 2,
  },
  hint: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.placeholder,
    marginTop: 4,
    marginBottom: Spacing.xs,
  },
  primaryBtn: {
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.xl,
    shadowColor: Colors.accent.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.4,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
