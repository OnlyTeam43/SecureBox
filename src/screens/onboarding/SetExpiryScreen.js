// src/screens/onboarding/SetExpiryScreen.js
// User picks their default disappearing message duration

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
} from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { EXPIRY_OPTIONS } from '../../constants/avatars';
import { useUserStore } from '../../store/useUserStore';

export default function SetExpiryScreen({ navigation }) {
  const setDefaultExpiry = useUserStore((s) => s.setDefaultExpiry);
  const [selected, setSelected] = useState(null); // index into EXPIRY_OPTIONS

  const handleDone = () => {
    const option = selected !== null ? EXPIRY_OPTIONS[selected] : EXPIRY_OPTIONS[0];
    setDefaultExpiry(option.value);
    navigation.replace('MainTabs');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.primary} />

      <View style={styles.top}>
        <Text style={styles.icon}>⏳</Text>
        <Text style={styles.heading}>Disappearing messages</Text>
        <Text style={styles.sub}>
          How long should messages last before they vanish?{'\n'}
          You can change this per conversation anytime.
        </Text>
      </View>

      <View style={styles.options}>
        {EXPIRY_OPTIONS.map((opt, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.option, selected === i && styles.optionSelected]}
            onPress={() => setSelected(i)}
            activeOpacity={0.8}
          >
            <Text style={[styles.optionText, selected === i && styles.optionTextSelected]}>
              {opt.label}
            </Text>
            {selected === i && <Text style={styles.check}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.doneBtn} onPress={handleDone} activeOpacity={0.85}>
        <Text style={styles.doneBtnText}>Done — Let's go 💌</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    padding: Spacing.lg,
    justifyContent: 'space-between',
  },
  top: { marginTop: Spacing.xxl, alignItems: 'center' },
  icon: { fontSize: 56, marginBottom: Spacing.md },
  heading: {
    fontSize: Typography.sizes.xxl,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  sub: {
    fontSize: Typography.sizes.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  options: { gap: Spacing.sm },
  option: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.md,
    paddingVertical: 18,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  optionSelected: {
    borderColor: Colors.accent.primary,
    backgroundColor: Colors.accent.glow,
  },
  optionText: {
    fontSize: Typography.sizes.md,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  optionTextSelected: { color: Colors.accent.light, fontWeight: '700' },
  check: { color: Colors.accent.primary, fontSize: Typography.sizes.lg, fontWeight: '700' },
  doneBtn: {
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  doneBtnText: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
  },
});
