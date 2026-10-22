import { Easing } from 'react-native';

export const duration = { fast: 120, base: 200, slow: 320 };
export const easing = {
  out: Easing.out(Easing.cubic),
  inOut: Easing.inOut(Easing.cubic),
};

// Character animation timings (ms)
export const character = {
  talkFrame: 140, // mouth open/closed flip
  typeFrame: 260, // paws up/down flip
  bobHalf: 250, // one half of a bounce
  bobHeight: 8, // px
  talkHold: 1800, // how long a character keeps talking after a message
};
