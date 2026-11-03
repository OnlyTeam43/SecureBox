// client/src/components/levelPatterns.ts
// 25 Geometric Archetypes mathematically ported from BrickBreakerGameScreen.js
// Scaled smoothly across 300 arcade levels with 12 distinct tiers

export interface TierInfo {
  index: number;
  label: string;
  name: string;
  start: number;
  end: number;
}

export const TIERS: TierInfo[] = [
  { index: 0, label: '1–25', name: 'Meadow Scout', start: 1, end: 25 },
  { index: 1, label: '26–50', name: 'Forest Wanderer', start: 26, end: 50 },
  { index: 2, label: '51–75', name: 'Canyon Adventurer', start: 51, end: 75 },
  { index: 3, label: '76–100', name: 'Mountain Climber', start: 76, end: 100 },
  { index: 4, label: '101–125', name: 'Sky Guardian', start: 101, end: 125 },
  { index: 5, label: '126–150', name: 'Solar Knight', start: 126, end: 150 },
  { index: 6, label: '151–175', name: 'Astral Sentinel', start: 151, end: 175 },
  { index: 7, label: '176–200', name: 'Cosmic Champion', start: 176, end: 200 },
  { index: 8, label: '201–225', name: 'Nebula Master', start: 201, end: 225 },
  { index: 9, label: '226–250', name: 'Vortex Sovereign', start: 226, end: 250 },
  { index: 10, label: '251–275', name: 'Eternal Titan', start: 251, end: 275 },
  { index: 11, label: '276–300', name: 'Celestial Legend', start: 276, end: 300 },
];

export const LEVEL_PATTERNS: Array<(r: number, c: number) => boolean> = [
  // 1: Classic Full Matrix
  (_r, _c) => true,
  // 2: Grand Pyramid
  (r, c) => c >= 3 - Math.floor(r * 0.5) && c <= 4 + Math.floor(r * 0.5),
  // 3: Inverted Pyramid
  (r, c) => c >= Math.floor(r * 0.5) && c <= 7 - Math.floor(r * 0.5),
  // 4: Royal Diamond
  (r, c) => Math.abs(c - 3.5) + Math.abs(r - 3.5) <= 4.2,
  // 5: Checkerboard Bastion
  (r, c) => (r + c) % 2 === 0,
  // 6: Castle Ramparts
  (r, c) => r >= 2 || (r === 0 && c % 2 === 0) || (r === 1 && c % 2 === 0),
  // 7: Twin Watchtowers
  (_r, c) => c < 3 || c > 4,
  // 8: Fortress Citadel
  (r, c) => r >= 1 && r <= 6 && c >= 1 && c <= 6,
  // 9: Venetian Blinds
  (r, _c) => r % 2 === 0,
  // 10: Iron Gates
  (_r, c) => c % 2 === 0,
  // 11: Space Invader
  (r, c) => {
    const inv = [
      [0, 1, 0, 0, 0, 0, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 0, 1, 1, 0, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 1, 0, 1, 1, 0, 1, 0],
      [1, 0, 1, 0, 0, 1, 0, 1],
      [0, 0, 1, 0, 0, 1, 0, 0],
    ];
    return r < 8 && c < 8 && inv[r][c] === 1;
  },
  // 12: Grand Cross
  (r, c) => (r >= 3 && r <= 4) || (c >= 3 && c <= 4),
  // 13: X-Nexus
  (r, c) => Math.abs(r - c) <= 1 || Math.abs(7 - r - c) <= 1,
  // 14: Moat & Keep
  (r, c) =>
    r === 0 || r === 7 || c === 0 || c === 7 || (r >= 3 && r <= 4 && c >= 3 && c <= 4),
  // 15: Concentric Rings
  (r, c) =>
    r === 0 ||
    r === 7 ||
    c === 0 ||
    c === 7 ||
    (r >= 2 && r <= 5 && c >= 2 && c <= 5 && !(r >= 3 && r <= 4 && c >= 3 && c <= 4)),
  // 16: Falcon Wings
  (r, c) => Math.abs(c - 3.5) <= r + 0.5 && r <= 5,
  // 17: DNA Helix
  (r, c) =>
    c === Math.round(3.5 + 2.5 * Math.sin(r * 0.9)) ||
    c === Math.round(3.5 - 2.5 * Math.sin(r * 0.9)) ||
    r % 2 === 0,
  // 18: Labyrinth Slits
  (r, c) =>
    (r % 2 === 0 && (r % 4 === 0 ? c < 6 : c > 1)) ||
    (r % 2 === 1 && (c === 0 || c === 7)),
  // 19: King's Crown
  (r, c) =>
    r >= 4 ||
    (r === 2 && (c === 0 || c === 3 || c === 4 || c === 7)) ||
    (r === 3 && (c <= 1 || c >= 6 || c === 3 || c === 4)),
  // 20: Heart
  (r, c) => {
    if (r === 0) return c === 1 || c === 2 || c === 5 || c === 6;
    if (r === 1) return c !== 3 && c !== 4;
    if (r === 2 || r === 3) return true;
    if (r === 4) return c >= 1 && c <= 6;
    if (r === 5) return c >= 2 && c <= 5;
    if (r === 6) return c === 3 || c === 4;
    return false;
  },
  // 21: Honeycomb
  (r, c) => ((r % 2 === 0 && c % 2 === 0) || (r % 2 === 1 && c % 2 === 1)) && r < 7,
  // 22: Shield of Valor
  (r, c) => c >= Math.max(0, r - 3) && c <= Math.min(7, 10 - r),
  // 23: Arrowhead
  (r, c) => Math.abs(c - 3.5) <= r && r <= 6,
  // 24: Chrono Hourglass
  (r, c) =>
    (r <= 3 && c >= r && c <= 7 - r) || (r >= 4 && c >= 7 - r && c <= r),
  // 25: Cavern Stalactites
  (r, c) => r <= (c % 2 === 0 ? 6 : 3),
];

// Unbreakable steel candidate matching native app logic
export function isSteelCandidate(r: number, c: number, lvl: number): boolean {
  if (lvl <= 1) return false;
  if (lvl === 2) return r === 1 && (c === 2 || c === 5);
  if (lvl === 3) return r === 3 && (c === 3 || c === 4);

  const mode = lvl % 10;
  let match = false;
  if (mode === 0) match = (r === 3 || r === 4) && (c === 3 || c === 4);
  else if (mode === 1) match = (r === 1 || r === 5) && (c === 1 || c === 6);
  else if (mode === 2) match = r === 3 && (c === 2 || c === 5);
  else if (mode === 3) match = (r === 2 || r === 4) && (c === 1 || c === 6);
  else if (mode === 4) match = (r === 2 || r === 5) && (c === 3 || c === 4);
  else if (mode === 5)
    match = (r === 1 && (c === 3 || c === 4)) || (r === 6 && (c === 3 || c === 4));
  else if (mode === 6) match = r === 4 && (c >= 2 && c <= 5);
  else if (mode === 7)
    match = (r === 2 && (c === 2 || c === 5)) || (r === 4 && (c === 1 || c === 6));
  else if (mode === 8)
    match = (r === 3 && (c === 0 || c === 7)) || (r === 4 && (c === 0 || c === 7));
  else if (mode === 9)
    match = (r === 3 && (c === 2 || c === 5)) || (r === 2 && (c === 3 || c === 4));

  // Mid-wall bumpers for Level 15+
  if (!match && lvl >= 15 && r === 2 && (c === 0 || c === 7)) {
    match = true;
  }
  // Corner bumpers for Level 35+
  if (!match && lvl >= 35 && (r === 1 || r === 6) && (c === 0 || c === 7)) {
    match = true;
  }
  // Center core barrier for Level 70+
  if (!match && lvl >= 70 && r === 4 && (c === 3 || c === 4)) {
    match = true;
  }

  return match;
}

// Progressive snappy speed scaling across 300 levels
export const getLevelSpeed = (lvl: number): number => {
  return 7.0 + Math.min((lvl - 1) * 0.05, 4.8);
};

// Progressive paddle width scaling
export const getLevelPaddleWidth = (lvl: number, baseWidth: number): number => {
  return Math.max(baseWidth - (lvl - 1) * 0.12, 60);
};
