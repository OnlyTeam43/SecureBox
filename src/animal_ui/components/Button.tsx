import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useColors } from '../theme/ThemeProvider';
import { radius, spacing, type } from '../theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'brand';

export function Button({
  label,
  onPress,
  variant = 'secondary',
  icon,
  loading,
  fullWidth,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const look = {
    primary: { bg: c.text, fg: c.onPrimary, border: 'transparent' },
    secondary: { bg: c.surface, fg: c.text, border: c.borderStrong },
    ghost: { bg: 'transparent', fg: c.text, border: 'transparent' },
    danger: { bg: c.danger, fg: c.onDanger, border: 'transparent' },
    brand: { bg: c.brand, fg: c.onBrand, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: look.bg,
          borderColor: look.border,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={look.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[type.bodyMedium, { color: look.fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
