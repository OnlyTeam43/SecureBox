// src/screens/main/ProfileScreen.js
// My own profile — view handle, profile picture upload, nickname, settings

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Alert, Image, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { EXPIRY_OPTIONS } from '../../constants/avatars';
import { useUserStore } from '../../store/useUserStore';
import { UserAvatarIcon, CameraIcon } from '../../components/Icons';
import { updateUserAvatarInSupabase } from '../../services/supabase';
import { updateContactAvatar } from '../../db/database';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { handle, nickname, avatarId, avatarUri, mobileNumber, defaultExpiry, setAvatarUri } = useUserStore();
  const [uploading, setUploading] = React.useState(false);

  const displayPhoto = avatarUri || (avatarId && (avatarId.startsWith('data:') || avatarId.startsWith('file:') || avatarId.startsWith('http')) ? avatarId : null);

  const expiryLabel =
    EXPIRY_OPTIONS.find((o) => o.value === defaultExpiry)?.label || 'Never';

  const handlePickProfilePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return Alert.alert('Permission Needed', 'Please allow gallery access to set your profile picture.');
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

        // 1. Update in local store
        setAvatarUri(photoData);

        // 2. Persist to Supabase so partners can see it
        await updateUserAvatarInSupabase(handle, photoData);

        // 3. Update SQLite contacts
        await updateContactAvatar(handle, photoData);

        Alert.alert('Profile Updated', 'Your profile picture has been updated!');
      }
    } catch (err) {
      console.warn('Profile photo pick error:', err);
      Alert.alert('Error', 'Failed to update profile picture. Please try again.');
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Delete everything?',
      'This will wipe all messages, contacts, and your profile from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            useUserStore.getState().reset();
            navigation.replace('Onboarding');
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.lg }]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg.primary} />

      {/* Avatar + Identity */}
      <View style={styles.hero}>
        <TouchableOpacity style={styles.avatarTouchable} onPress={handlePickProfilePhoto} activeOpacity={0.8}>
          <View style={styles.avatarCircle}>
            {displayPhoto ? (
              <Image source={{ uri: displayPhoto }} style={styles.avatarPhoto} />
            ) : (
              <UserAvatarIcon size={52} color={Colors.accent.primary} />
            )}
          </View>
          <View style={styles.cameraBadge}>
            <CameraIcon size={14} color="#fff" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={handlePickProfilePhoto} style={styles.changePhotoBtn}>
          <Text style={styles.changePhotoText}>
            {displayPhoto ? 'Change Photo' : 'Upload Profile Picture'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.nickname}>{nickname}</Text>
        <View style={styles.handleRow}>
          <Text style={styles.handleAt}>@</Text>
          <Text style={styles.handle}>{handle}</Text>
        </View>
        {mobileNumber ? (
          <Text style={styles.handleHint}>{mobileNumber} • Recovery</Text>
        ) : (
          <Text style={styles.handleHint}>Share this handle to connect</Text>
        )}
      </View>

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>

        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('SetExpiry')}>
          <View>
            <Text style={styles.rowLabel}>Disappearing Messages</Text>
            <Text style={styles.rowSub}>Default: {expiryLabel}</Text>
          </View>
          <Text style={styles.rowArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('MediaGallery')}>
          <View>
            <Text style={styles.rowLabel}>Shared Media Gallery</Text>
            <Text style={styles.rowSub}>View private photos exchanged</Text>
          </View>
          <Text style={styles.rowArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.row}>
          <Text style={styles.rowLabel}>App Lock (Password / Biometric)</Text>
          <Text style={styles.rowArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Colors.status.error }]}>Danger Zone</Text>

        <TouchableOpacity style={[styles.row, styles.dangerRow]} onPress={handleReset}>
          <Text style={styles.dangerText}>Delete all data & reset</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>SecureBox · Private & Intimate messaging</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },
  container: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  hero: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.xs,
  },
  avatarTouchable: {
    position: 'relative',
    marginBottom: 4,
  },
  avatarCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
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
    borderRadius: 52,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: Colors.accent.primary,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  changePhotoBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  changePhotoText: {
    fontSize: Typography.sizes.xs,
    color: Colors.accent.primary,
    fontWeight: '700',
  },
  nickname: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  handleRow: { flexDirection: 'row', alignItems: 'center' },
  handleAt: {
    color: Colors.accent.primary,
    fontSize: Typography.sizes.md,
    fontWeight: '700',
  },
  handle: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.md,
  },
  handleHint: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.placeholder,
    marginTop: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  sectionTitle: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  rowLabel: {
    fontSize: Typography.sizes.md,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  rowSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.placeholder,
    marginTop: 2,
  },
  rowArrow: { color: Colors.text.placeholder, fontSize: Typography.sizes.md },
  dangerRow: { borderTopColor: Colors.status.error + '33' },
  dangerText: {
    fontSize: Typography.sizes.md,
    color: Colors.status.error,
    fontWeight: '600',
  },
  footer: {
    textAlign: 'center',
    color: Colors.text.placeholder,
    fontSize: Typography.sizes.xs,
    marginTop: Spacing.xl,
  },
});
