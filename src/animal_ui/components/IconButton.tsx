import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Icon, IconName } from './Icon';
import { useColors } from '../theme/ThemeProvider';
import { layout } from '../theme/layout';

// default: plain round button. selected: the toggle is on (muted, deafened, camera off).
// danger: end call. brand: send.
export type IconButtonVariant = 'default' | 'ghost' | 'selected' | 'danger' | 'brand';

export function IconButton({
  icon,
  label,
  onPress,
  variant = 'default',
  size = layout.controlSize,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  variant?: IconButtonVariant;
  size?: number;
}) {
  const c = useColors();
  const look = {
    default: { bg: c.surface, fg: c.text, border: c.borderStrong },
    ghost: { bg: 'transparent', fg: c.text, border: 'transparent' },
    selected: { bg: c.bgDanger, fg: c.danger, border: 'transparent' },
    danger: { bg: c.danger, fg: c.onDanger, border: 'transparent' },
    brand: { bg: c.brand, fg: c.onBrand, border: 'transparent' },
  }[variant];

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
