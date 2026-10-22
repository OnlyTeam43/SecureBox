import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Icon } from './Icon.js';
import { useColors } from '../theme/ThemeProvider.js';
import { layout } from '../theme/layout.js';

export function IconButton({
  icon,
  label,
  onPress,
  variant = 'default',
  size = layout.controlSize,
}) {
  const c = useColors();
  const look = {
    default: { bg: c.surface, fg: c.text, border: c.borderStrong },
    ghost: { bg: 'transparent', fg: c.text, border: 'transparent' },
    selected: { bg: c.bgDanger, fg: c.danger, border: 'transparent' },
    danger: { bg: c.danger, fg: c.onDanger, border: 'transparent' },
    brand: { bg: c.brand, fg: c.onBrand, border: 'transparent' },
  }[variant] || { bg: c.surface, fg: c.text, border: c.borderStrong };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: look.bg,
          borderColor: look.border,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.42)} color={look.fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});
