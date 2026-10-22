// src/theme/colors.js
// SecureBox — Claude AI Minimalist & Animal UI Palette

export const Colors = {
  // Backgrounds — Claude signature warm ivory, soft warm paper surfaces
  bg: {
    primary: '#FAF9F5',       // Claude signature warm ivory
    secondary: '#F5F3EC',     // Warm card/surface
    elevated: '#FFFFFF',      // Pure elevated cards & modals
    overlay: 'rgba(20,20,19,0.5)',
    chatBg: '#FAF9F5',        // Consistent chat canvas
  },

  // Accent — Claude warm terracotta clay & copper
  accent: {
    primary: '#D97757',       // Claude iconic terracotta clay
    secondary: '#C06143',     // Deep terracotta
    light: '#F5D5C8',         // Pastel terracotta blush
    soft: '#FAF0EB',          // Ultra-light clay highlight
    glow: 'rgba(217,119,87,0.15)',
    glowStrong: 'rgba(217,119,87,0.28)',
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
    sent: '#F5F3EC',          // Sent bubble warm surface
    sentPink: '#FAF0EB',      // Sent soft clay tint
    sentBorder: 'rgba(20,20,19,0.12)',
    received: '#FFFFFF',      // White for received messages
    receivedBorder: 'rgba(20,20,19,0.08)',
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

  divider: 'rgba(20,20,19,0.08)',
  icon: '#5E5D59',
  iconActive: '#D97757',
};
