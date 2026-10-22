// src/screens/onboarding/WelcomeScreen.js
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
} from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { CharacterAvatar } from '../../animal_ui/components/CharacterAvatar.js';

export default function WelcomeScreen({ navigation }) {
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
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('CreateProfile')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>I have an account</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.note}>Direct APK Updates · Instant WhatsApp Recovery</Text>
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
