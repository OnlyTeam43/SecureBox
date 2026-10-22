import { spacing } from './tokens.js';

export const layout = {
  screenPadding: spacing.lg, // 16
  gutter: spacing.md, // 12 between the two character columns
  chatCharacterSize: 150, // avatar width on the chat scene
  callCharacterSize: 140, // avatar width on the call screen
  bubbleMinHeight: 64,
  bubbleTail: 10,
  tiltDeg: 5, // characters lean toward each other
  controlSize: 56, // round call buttons
  controlGap: 16,
  composerHeight: 52,
  headerHeight: 56,
  composerRadius: 24, // big rounded Claude-style input box
  composerPadding: 12,
  composerMinHeight: 56,
  composerMaxLines: 5,
  sendSize: 36,
  headerIcon: 40,
};
