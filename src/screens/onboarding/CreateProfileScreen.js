// src/screens/onboarding/CreateProfileScreen.js

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, StatusBar, Image, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { useUserStore } from '../../store/useUserStore';
import { registerUserInSupabase } from '../../services/supabase';
import { UserAvatarIcon, CameraIcon } from '../../components/Icons';

const HANDLE_REGEX = /^[a-z0-9_.]{3,20}$/;

export default function CreateProfileScreen({ navigation }) {
  const [nickname, setNickname] = useState('');
  const [handle, setHandle] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState(1); // 1 = identity, 2 = password
  const [loading, setLoading] = useState(false);

  const setProfile = useUserStore((s) => s.setProfile);
  const setPassword_ = useUserStore((s) => s.setPassword);
  const completeSetup = useUserStore((s) => s.completeSetup);

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

  const handleNext = () => {
    if (!nickname.trim()) return Alert.alert('Pick a nickname', 'Please enter what your partner calls you.');
    if (!HANDLE_REGEX.test(handle))
      return Alert.alert(
        'Invalid handle',
        'Use 3–20 lowercase letters, numbers, _ or . (no spaces)'
      );
    setStep(2);
  };

  const handleFinish = async () => {
    if (password.length < 6) return Alert.alert('Password too short', 'Use at least 6 characters.');
    if (password !== confirmPassword) return Alert.alert('Password mismatch', 'Passwords do not match.');

    setLoading(true);
    try {
      const avatarPayload = profilePhoto || 'avatar_rose';

      // Save unique handle, mobile number, nickname and avatar to Supabase
      await registerUserInSupabase({
        handle,
        nickname,
        avatarId: avatarPayload,
        mobileNumber,
        password,
      });

      setProfile(handle, nickname.trim(), avatarPayload, mobileNumber.trim() || null, profilePhoto);
      setPassword_(password);
      completeSetup();
      navigation.replace('SetExpiry');
    } catch (err) {
      console.error('Supabase registration error:', err);
      Alert.alert(
        'Registration Failed',
        err.message || 'Could not register unique handle in Supabase. Check internet connection.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg.primary} />

      {step === 1 ? (
        <>
          <Text style={styles.heading}>Create your identity</Text>
          <Text style={styles.sub}>Private & intimate messaging for you and your lover.</Text>

          {/* Profile Picture Picker */}
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
                {profilePhoto ? 'Change Photo' : 'Upload Profile Picture (Optional)'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Nickname */}
          <Text style={styles.label}>Nickname</Text>
          <TextInput
            style={styles.input}
            placeholder="What they call you..."
            placeholderTextColor={Colors.text.placeholder}
            value={nickname}
            onChangeText={setNickname}
            maxLength={30}
          />

          {/* Handle */}
          <Text style={styles.label}>Unique @handle</Text>
          <View style={styles.handleRow}>
            <Text style={styles.at}>@</Text>
            <TextInput
              style={[styles.input, styles.handleInput]}
              placeholder="yourhandle"
              placeholderTextColor={Colors.text.placeholder}
              value={handle}
              onChangeText={(t) => setHandle(t.toLowerCase())}
              autoCapitalize="none"
              maxLength={20}
            />
          </View>
          <Text style={styles.hint}>3–20 chars · letters, numbers, _ ·  no spaces</Text>

          {/* Mobile number for recovery */}
          <Text style={styles.label}>Mobile Number (Optional for recovery)</Text>
          <TextInput
            style={styles.input}
            placeholder="+91 9876543210 (Optional)"
            placeholderTextColor={Colors.text.placeholder}
            value={mobileNumber}
            onChangeText={setMobileNumber}
            keyboardType="phone-pad"
            maxLength={18}
          />
          <Text style={styles.hint}>Used only if you forget your password or need recovery</Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Next →</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.heading}>Set your Password</Text>
          <Text style={styles.sub}>You'll use this to unlock your private space.</Text>

          <Text style={styles.label}>Password (min 6 chars)</Text>
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

          <TouchableOpacity
            style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
            onPress={handleFinish}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Finish Setup ✓</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
            <Text style={styles.backText}>← Back to details</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },
  container: {
    padding: Spacing.xl,
    paddingTop: Spacing.xxl + 8,
    paddingBottom: Spacing.xxl,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  sub: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
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
    width: 90,
    height: 90,
    borderRadius: 45,
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
    borderRadius: 45,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.accent.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
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
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
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
  handleRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  at: {
    color: Colors.accent.primary,
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.md,
    paddingVertical: 14,
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
  hint: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.placeholder,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  primaryBtn: {
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
  },
  backBtn: { alignItems: 'center', marginTop: Spacing.md },
  backText: { color: Colors.text.secondary, fontSize: Typography.sizes.md },
});
