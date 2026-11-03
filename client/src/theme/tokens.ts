// client/src/theme/tokens.ts
// SecureBox — Claude AI Minimalist & Animal UI Theme Tokens

export const Colors = {
  // Backgrounds — Claude signature warm ivory, soft warm paper surfaces
  bg: {
    primary: '#FAF9F5',       // Claude signature warm ivory
    secondary: '#F5F3EC',     // Warm card/surface
    elevated: '#FFFFFF',      // Pure elevated cards & modals
    overlay: 'rgba(20, 20, 19, 0.45)',
    chatBg: '#FAF9F5',        // Consistent chat canvas
  },

  // Accent — Claude warm terracotta clay & copper
  accent: {
    primary: '#D97757',       // Claude iconic terracotta clay
    secondary: '#C06143',     // Deep terracotta
    light: '#F5D5C8',         // Pastel terracotta blush
    soft: '#FAF0EB',          // Ultra-light clay highlight
    glow: 'rgba(217, 119, 87, 0.15)',
    glowStrong: 'rgba(217, 119, 87, 0.28)',
  },

  // Text — sharp, warm charcoal and refined stone greys
  text: {
    primary: '#141413',       // Crisp Claude dark charcoal
    secondary: '#5E5D59',     // Muted subtitle text
    placeholder: '#87867F',   // Placeholder stone grey
    inverse: '#FFFFFF',
    replyTitle: '#D97757',
  },

  // Bubbles — Claude clean styling
  bubble: {
    sent: '#FAF0EB',          // Sent soft clay tint
    sentBorder: 'rgba(20, 20, 19, 0.12)',
    received: '#FFFFFF',      // White for received messages
    receivedBorder: 'rgba(20, 20, 19, 0.08)',
  },

  // Status
  status: {
    online: '#2E7D32',        // Refined forest emerald
    offline: '#87867F',
    error: '#C62828',
    sent: '#87867F',
    delivered: '#87867F',
    seen: '#D97757',          // Terracotta seen status
  },

  border: 'rgba(20, 20, 19, 0.12)',
  borderStrong: 'rgba(20, 20, 19, 0.25)',
  divider: 'rgba(20, 20, 19, 0.08)',
  icon: '#5E5D59',
  iconActive: '#D97757',
};

// 8-tier Claude Arcade Brick Palette (from BrickBreakerGameScreen.js)
export const BrickRowColors = [
  { color: '#D97757', border: '#B85D3F', points: 60 }, // Row 0: Terracotta Red
  { color: '#E28743', border: '#C06B2B', points: 50 }, // Row 1: Amber Coral
  { color: '#D4A346', border: '#B5872A', points: 40 }, // Row 2: Gold Ocre
  { color: '#5E9473', border: '#467558', points: 35 }, // Row 3: Emerald Sage
  { color: '#4A8B88', border: '#336B68', points: 30 }, // Row 4: Earthy Teal
  { color: '#5B7C99', border: '#43617A', points: 25 }, // Row 5: Slate Blue
  { color: '#7E6B8F', border: '#625073', points: 20 }, // Row 6: Muted Violet
  { color: '#B37D80', border: '#946164', points: 15 }, // Row 7: Soft Rose Clay
];

export const Typography = {
  fonts: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    serif: 'Georgia, serif',
  },
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 26,
    display: 32,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
  weights: {
    regular: 400,
    medium: 500,
    bold: 600,
    heavy: 700,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 9999,
};
