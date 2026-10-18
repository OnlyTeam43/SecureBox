// src/screens/onboarding/WelcomeScreen.js

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
} from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../theme';

export default function WelcomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.primary} />

      <View style={styles.hero}>
        <Text style={styles.logo}>💌</Text>
        <Text style={styles.title}>SecureBox</Text>
        <Text style={styles.tagline}>
          Just the two of you.{'\n'}Private. Intimate. Yours.
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
    gap: Spacing.md,
  },
  logo: {
    fontSize: 72,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: Typography.sizes.display,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: Typography.sizes.lg,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 26,
    marginTop: Spacing.sm,
  },
  actions: {
    width: '100%',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  primaryBtn: {
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  secondaryBtnText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.md,
    fontWeight: '500',
  },
  note: {
    color: Colors.text.placeholder,
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.md,
  },
});
