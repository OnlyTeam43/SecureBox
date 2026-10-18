// src/theme/colors.js
// SecureBox — Clean White & Light Pink Romantic Palette

export const Colors = {
  // Backgrounds — clean white, warm cream, soft rose tint
  bg: {
    primary: '#ffffff',       // Pure clean white
    secondary: '#fbf7f9',     // Warm soft card/input surface
    elevated: '#f7f0f4',      // Elevated headers, modals
    overlay: 'rgba(0,0,0,0.5)',
    chatBg: '#f6f3f5',        // WhatsApp-like subtle background
  },

  // Accent — romantic light pink & vibrant rose
  accent: {
    primary: '#e0527a',       // Vibrant rose pink
    secondary: '#d1436c',     // Deep rose
    light: '#ffb3c6',         // Soft pastel blush
    soft: '#ffeef2',          // Ultra-light pink highlight
    glow: 'rgba(224,82,122,0.12)',
    glowStrong: 'rgba(224,82,122,0.25)',
  },

  // Text — sharp, readable charcoal and warm greys
  text: {
    primary: '#1c1b1f',       // Crisp dark text
    secondary: '#665e64',     // Muted subtitle text
    placeholder: '#a49ba1',
    inverse: '#ffffff',
    replyTitle: '#c93b67',
  },

  // Bubbles — WhatsApp/Instagram inspired clean styling
  bubble: {
    sent: '#dcf8c6',          // WhatsApp light green or light pink (#ffdce5)
    sentPink: '#ffe8ef',      // Romantic light pink for my messages
    sentBorder: 'rgba(224,82,122,0.15)',
    received: '#ffffff',      // Pure white for incoming messages
    receivedBorder: '#e8e2e6',
  },

  // Status
  status: {
    online: '#25d366',        // WhatsApp bright green
    offline: '#a49ba1',
    error: '#e53935',
    sent: '#8a8187',          // Grey sent status
    delivered: '#8a8187',     // Grey delivered status
    seen: '#e0527a',          // Pink seen status (SecureBox romantic pink)
  },

  divider: '#eee7eb',
  icon: '#4a4448',
  iconActive: '#e0527a',
};
