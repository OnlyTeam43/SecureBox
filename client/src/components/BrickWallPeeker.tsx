// client/src/components/BrickWallPeeker.tsx
import React from 'react';

interface BrickWallPeekerProps {
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}

export const BrickWallPeeker: React.FC<BrickWallPeekerProps> = ({
  width = 44,
  height = 36,
  style,
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 64 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle', overflow: 'visible', ...style }}
    >
      <defs>
        <filter id="wallShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1" floodColor="#000000" floodOpacity="0.12" />
        </filter>
        <clipPath id="peekerClip">
          <rect x="0" y="0" width="64" height="24" />
        </clipPath>
      </defs>

      {/* ─── PANDA PEEKING FROM BEHIND THE BRICKS ───────────────── */}
      <g className="panda-peeker-anim">
        {/* Ears */}
        <circle cx="23" cy="11" r="5" fill="#2C2C2A" />
        <circle cx="41" cy="11" r="5" fill="#2C2C2A" />
        <circle cx="23" cy="11" r="2.5" fill="#1A1A18" />
        <circle cx="41" cy="11" r="2.5" fill="#1A1A18" />

        {/* Head */}
        <circle cx="32" cy="17" r="14" fill="#FFFFFF" stroke="#2C2C2A" strokeWidth="1.6" />

        {/* Eye Patches */}
        <ellipse cx="27" cy="15" rx="3.5" ry="4" transform="rotate(12 27 15)" fill="#2C2C2A" />
        <ellipse cx="37" cy="15" rx="3.5" ry="4" transform="rotate(-12 37 15)" fill="#2C2C2A" />

        {/* Pupils (twinkles) */}
        <circle cx="27.5" cy="14.2" r="1.3" fill="#FFFFFF" />
        <circle cx="36.5" cy="14.2" r="1.3" fill="#FFFFFF" />

        {/* Cute blush cheeks */}
        <circle cx="23" cy="19.5" r="2.2" fill="#F4C0D1" opacity="0.8" />
        <circle cx="41" cy="19.5" r="2.2" fill="#F4C0D1" opacity="0.8" />

        {/* Tiny nose */}
        <ellipse cx="32" cy="18" rx="1.8" ry="1.2" fill="#2C2C2A" />
      </g>

      {/* ─── BRICK WALL (Foreground camouflage) ─────────────────── */}
      <g filter="url(#wallShadow)">
        {/* Wall Mortar Base */}
        <rect x="2" y="22" width="60" height="28" rx="4" fill="#874834" />

        {/* Top Brick Row */}
        <rect x="3" y="23" width="18" height="8" rx="1.5" fill="#D97757" />
        <rect x="23" y="23" width="18" height="8" rx="1.5" fill="#E28743" />
        <rect x="43" y="23" width="18" height="8" rx="1.5" fill="#D97757" />

        {/* Top Brick Highlights */}
        <line x1="4" y1="24" x2="20" y2="24" stroke="#F5A88B" strokeWidth="1" strokeLinecap="round" />
        <line x1="24" y1="24" x2="40" y2="24" stroke="#F8BA7B" strokeWidth="1" strokeLinecap="round" />
        <line x1="44" y1="24" x2="60" y2="24" stroke="#F5A88B" strokeWidth="1" strokeLinecap="round" />

        {/* Middle Brick Row (offset bond) */}
        <rect x="3" y="32" width="8" height="8" rx="1.5" fill="#C66547" />
        <rect x="13" y="32" width="18" height="8" rx="1.5" fill="#D97757" />
        <rect x="33" y="32" width="18" height="8" rx="1.5" fill="#C66547" />
        <rect x="53" y="32" width="8" height="8" rx="1.5" fill="#D97757" />

        {/* Bottom Brick Row */}
        <rect x="3" y="41" width="18" height="8" rx="1.5" fill="#D97757" />
        <rect x="23" y="41" width="18" height="8" rx="1.5" fill="#E28743" />
        <rect x="43" y="41" width="18" height="8" rx="1.5" fill="#C66547" />
      </g>

      {/* ─── LITTLE PAWS GRIPPING OVER TOP BRICK EDGE ───────────── */}
      {/* Left Paw */}
      <ellipse cx="23" cy="23.5" rx="3.6" ry="2.6" fill="#2C2C2A" />
      <ellipse cx="21" cy="22.5" rx="1.2" ry="1.2" fill="#1A1A18" />
      <ellipse cx="23" cy="22" rx="1.2" ry="1.2" fill="#1A1A18" />
      <ellipse cx="25" cy="22.5" rx="1.2" ry="1.2" fill="#1A1A18" />

      {/* Right Paw */}
      <ellipse cx="41" cy="23.5" rx="3.6" ry="2.6" fill="#2C2C2A" />
      <ellipse cx="39" cy="22.5" rx="1.2" ry="1.2" fill="#1A1A18" />
      <ellipse cx="41" cy="22" rx="1.2" ry="1.2" fill="#1A1A18" />
      <ellipse cx="43" cy="22.5" rx="1.2" ry="1.2" fill="#1A1A18" />
    </svg>
  );
};
