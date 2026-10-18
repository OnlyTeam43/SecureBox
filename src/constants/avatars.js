// src/constants/avatars.js
// Built-in avatar set — emoji-based, no external images needed

export const AVATARS = [
  { id: 'avatar_rose',     emoji: '🌹', label: 'Rose' },
  { id: 'avatar_moon',     emoji: '🌙', label: 'Moon' },
  { id: 'avatar_star',     emoji: '⭐', label: 'Star' },
  { id: 'avatar_fire',     emoji: '🔥', label: 'Fire' },
  { id: 'avatar_butterfly', emoji: '🦋', label: 'Butterfly' },
  { id: 'avatar_cherry',   emoji: '🍒', label: 'Cherry' },
  { id: 'avatar_heart',    emoji: '💜', label: 'Heart' },
  { id: 'avatar_snow',     emoji: '❄️', label: 'Snow' },
  { id: 'avatar_ghost',    emoji: '👻', label: 'Ghost' },
  { id: 'avatar_cat',      emoji: '🐱', label: 'Cat' },
  { id: 'avatar_wolf',     emoji: '🐺', label: 'Wolf' },
  { id: 'avatar_fox',      emoji: '🦊', label: 'Fox' },
  { id: 'avatar_owl',      emoji: '🦉', label: 'Owl' },
  { id: 'avatar_cloud',    emoji: '☁️', label: 'Cloud' },
  { id: 'avatar_lightning', emoji: '⚡', label: 'Lightning' },
  { id: 'avatar_galaxy',   emoji: '🌌', label: 'Galaxy' },
];

export const getAvatar = (id) =>
  AVATARS.find((a) => a.id === id) || AVATARS[0];

// Expiry options
export const EXPIRY_OPTIONS = [
  { label: 'Never',   value: null },
  { label: '1 minute', value: 60 },
  { label: '1 hour',  value: 3600 },
  { label: '24 hours', value: 86400 },
  { label: '7 days',  value: 604800 },
];
