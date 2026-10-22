// src/animal_ui/components/CharacterBall.js
// Scalable SVG Character Head used as the ball in Brick Breaker game & avatars
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Polygon } from 'react-native-svg';

export function CharacterBall({ character = 'panda', size = 36 }) {
  if (character === 'cat') {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {/* Cat Ears */}
          <Polygon points="16,42 22,12 48,28" fill="#FAC775" stroke="#854F0B" strokeWidth="2.5" />
          <Polygon points="22,38 26,18 42,28" fill="#F4A56C" />
          <Polygon points="84,42 78,12 52,28" fill="#FAC775" stroke="#854F0B" strokeWidth="2.5" />
          <Polygon points="78,38 74,18 58,28" fill="#F4A56C" />

          {/* Cat Head */}
          <Circle cx="50" cy="54" r="38" fill="#FAC775" stroke="#854F0B" strokeWidth="2.5" />

          {/* Cheeks */}
          <Circle cx="24" cy="62" r="5" fill="#F4C0D1" />
          <Circle cx="76" cy="62" r="5" fill="#F4C0D1" />

          {/* Whiskers */}
          <Path d="M12 58 L28 60 M12 66 L28 64 M88 58 L72 60 M88 66 L72 64" stroke="#854F0B" strokeWidth="2" strokeLinecap="round" />

          {/* Eyes */}
          <Circle cx="36" cy="50" r="4.5" fill="#412402" />
          <Circle cx="64" cy="50" r="4.5" fill="#412402" />
          <Circle cx="37.5" cy="48.5" r="1.6" fill="#FFFFFF" />
          <Circle cx="65.5" cy="48.5" r="1.6" fill="#FFFFFF" />

          {/* Nose & Mouth */}
          <Polygon points="46,58 54,58 50,62" fill="#D4537E" />
          <Path d="M44 65 Q50 70 56 65" stroke="#854F0B" strokeWidth="2" fill="none" strokeLinecap="round" />
        </Svg>
      </View>
    );
  }

  if (character === 'puppy') {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {/* Puppy Floppy Ears */}
          <Ellipse cx="16" cy="46" rx="11" ry="22" fill="#854F0B" transform="rotate(15 16 46)" />
          <Ellipse cx="84" cy="46" rx="11" ry="22" fill="#854F0B" transform="rotate(-15 84 46)" />

          {/* Puppy Head */}
          <Circle cx="50" cy="54" r="38" fill="#F5C4B3" stroke="#993C1D" strokeWidth="2.5" />

          {/* Muzzle */}
          <Ellipse cx="50" cy="66" rx="18" ry="13" fill="#FAECE7" />

          {/* Cheeks */}
          <Circle cx="26" cy="62" r="4.5" fill="#F4C0D1" />
          <Circle cx="74" cy="62" r="4.5" fill="#F4C0D1" />

          {/* Eyes */}
          <Circle cx="36" cy="48" r="4.5" fill="#2C2C2A" />
          <Circle cx="64" cy="48" r="4.5" fill="#2C2C2A" />
          <Circle cx="37.5" cy="46.5" r="1.6" fill="#FFFFFF" />
          <Circle cx="65.5" cy="46.5" r="1.6" fill="#FFFFFF" />

          {/* Nose & Mouth */}
          <Ellipse cx="50" cy="60" rx="5.5" ry="4" fill="#2C2C2A" />
          <Path d="M45 68 Q50 72 55 68" stroke="#993C1D" strokeWidth="2" fill="none" strokeLinecap="round" />
        </Svg>
      </View>
    );
  }

  // Default: Panda 🐼
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Panda Ears */}
        <Circle cx="20" cy="22" r="14" fill="#2C2C2A" />
        <Circle cx="80" cy="22" r="14" fill="#2C2C2A" />

        {/* Panda Head */}
        <Circle cx="50" cy="54" r="38" fill="#FFFFFF" stroke="#2C2C2A" strokeWidth="2.5" />

        {/* Eye Patches */}
        <Ellipse cx="35" cy="48" rx="9" ry="11" fill="#2C2C2A" transform="rotate(20 35 48)" />
        <Ellipse cx="65" cy="48" rx="9" ry="11" fill="#2C2C2A" transform="rotate(-20 65 48)" />

        {/* Pupils */}
        <Circle cx="36" cy="47" r="3.2" fill="#FFFFFF" />
        <Circle cx="64" cy="47" r="3.2" fill="#FFFFFF" />

        {/* Cheeks */}
        <Circle cx="22" cy="64" r="5" fill="#F4C0D1" />
        <Circle cx="78" cy="64" r="5" fill="#F4C0D1" />

        {/* Snout & Smile */}
        <Ellipse cx="50" cy="61" rx="5.5" ry="4" fill="#2C2C2A" />
        <Path d="M44 68 Q50 73 56 68" stroke="#2C2C2A" strokeWidth="2" fill="none" strokeLinecap="round" />
      </Svg>
    </View>
  );
}
export default CharacterBall;
