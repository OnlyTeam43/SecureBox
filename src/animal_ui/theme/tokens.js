import { Platform, StyleSheet } from 'react-native';

// Flat Claude-style palette. One accent (clay) for send/brand actions, one blue for info.
// No gradients, no shadows. Hairline borders do the separating.
export const lightColors = {
  bg: '#FAF9F5',
  surface: '#FFFFFF',
  surfaceMuted: '#F0EEE6',
  text: '#141413',
  textSecondary: '#5E5D59',
  textMuted: '#87867F',
  border: 'rgba(20,20,19,0.12)',
  borderStrong: 'rgba(20,20,19,0.25)',
  onPrimary: '#FAF9F5',
  brand: '#D97757',
  onBrand: '#FFFFFF',
  info: '#2C84DB',
  bgInfo: '#E7F0FB',
  danger: '#C0392B',
  onDanger: '#FFFFFF',
  bgDanger: '#FBE9E7',
  success: '#2F7D4F',
  bgSuccess: '#E6F2EA',
};

export const darkColors = {
  bg: '#262624',
  surface: '#30302E',
  surfaceMuted: '#1F1E1D',
  text: '#FAF9F5',
  textSecondary: '#C2C0B6',
  textMuted: '#9C9A92',
  border: 'rgba(250,249,245,0.12)',
  borderStrong: 'rgba(250,249,245,0.25)',
  onPrimary: '#141413',
  brand: '#D97757',
  onBrand: '#FFFFFF',
  info: '#5AA3EA',
  bgInfo: '#1E2F44',
  danger: '#E5675A',
  onDanger: '#FFFFFF',
  bgDanger: '#44231F',
  success: '#5DB982',
  bgSuccess: '#1F3A2A',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };
export const border = { width: StyleSheet.hairlineWidth };

export const fonts = {
  sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  voice: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
};

// Two weights only: 400 regular, 500 medium. Sentence case everywhere.
export const type = {
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyMedium: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '500' },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '500' },
  timer: { fontSize: 28, lineHeight: 34, fontWeight: '500' },
};
