// src/services/soundGenerator.js
// Procedural audio tone generator producing valid base64 WAV URIs for expo-av

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function uint8ToBase64(u8) {
  let res = '';
  const len = u8.length;
  for (let i = 0; i < len; i += 3) {
    const a = u8[i];
    const b = i + 1 < len ? u8[i + 1] : 0;
    const c = i + 2 < len ? u8[i + 2] : 0;
    res +=
      BASE64_CHARS[a >> 2] +
      BASE64_CHARS[((a & 3) << 4) | (b >> 4)] +
      (i + 1 < len ? BASE64_CHARS[((b & 15) << 2) | (c >> 6)] : '=') +
      (i + 2 < len ? BASE64_CHARS[c & 63] : '=');
  }
  return res;
}

function createWavUri(sampleRate, durationSec, toneFn) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // 'RIFF'
  view.setUint32(4, 36 + dataSize, true);
  view.setUint32(8, 0x57415645, false); // 'WAVE'

  // Format chunk
  view.setUint32(12, 0x666d7420, false); // 'fmt '
  view.setUint32(16, 16, true);          // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);           // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true);           // Channels (1 mono)
  view.setUint32(24, sampleRate, true);  // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true);           // BlockAlign
  view.setUint16(34, 16, true);          // BitsPerSample

  // Data chunk
  view.setUint32(36, 0x64617461, false); // 'data'
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const sample = toneFn(i / sampleRate, i);
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF, true);
    offset += 2;
  }

  return 'data:audio/wav;base64,' + uint8ToBase64(new Uint8Array(buffer));
}

// 1. Outgoing ringback tone: 440Hz + 480Hz for 0.9s, then 1.1s silence (2s loop)
export const getOutgoingRingToneUri = () => {
  return createWavUri(8000, 2.0, (t) => {
    if (t < 0.9) {
      // Soft fade in & fade out envelope
      const env = Math.sin((Math.PI * t) / 0.9);
      const s1 = Math.sin(2 * Math.PI * 440 * t);
      const s2 = Math.sin(2 * Math.PI * 480 * t);
      return (s1 + s2) * 0.25 * env;
    }
    return 0;
  });
};

// 2. Incoming melodious chime: gentle romantic arpeggio (C5 -> E5 -> G5 -> C6)
export const getIncomingRingToneUri = () => {
  return createWavUri(8000, 2.2, (t) => {
    // 4 notes: each 0.45s long with exponential decay
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const noteIdx = Math.floor(t / 0.45);
    if (noteIdx < notes.length) {
      const noteTime = t - noteIdx * 0.45;
      const decay = Math.exp(-noteTime * 4.5);
      const freq = notes[noteIdx];
      // Fundamental + gentle overtone
      const s1 = Math.sin(2 * Math.PI * freq * noteTime);
      const s2 = Math.sin(2 * Math.PI * freq * 2 * noteTime) * 0.3;
      return (s1 + s2) * 0.35 * decay;
    }
    return 0;
  });
};

// 3. Call connected chime: rising two-tone chime (587Hz -> 880Hz)
export const getConnectedToneUri = () => {
  return createWavUri(8000, 0.4, (t) => {
    if (t < 0.18) {
      const decay = Math.exp(-t * 6);
      return Math.sin(2 * Math.PI * 587.33 * t) * 0.4 * decay;
    } else {
      const t2 = t - 0.18;
      const decay = Math.exp(-t2 * 6);
      return Math.sin(2 * Math.PI * 880 * t2) * 0.4 * decay;
    }
  });
};

// 4. Call ended / hangup tone: descending two-tone chime
export const getEndedToneUri = () => {
  return createWavUri(8000, 0.4, (t) => {
    if (t < 0.18) {
      const decay = Math.exp(-t * 8);
      return Math.sin(2 * Math.PI * 659.25 * t) * 0.4 * decay;
    } else {
      const t2 = t - 0.18;
      const decay = Math.exp(-t2 * 8);
      return Math.sin(2 * Math.PI * 440 * t2) * 0.4 * decay;
    }
  });
};

// ── ANIMAL SMASH / BRICK BREAKER ARCADE SFX ──

// 5. Paddle hit: punchy, rubbery upward pitch sweep (260Hz -> 420Hz)
export const getGamePaddleToneUri = () => {
  return createWavUri(11025, 0.08, (t) => {
    const env = Math.exp(-t * 35);
    const freq = 260 + (t / 0.08) * 160;
    return Math.sin(2 * Math.PI * freq * t) * 0.5 * env;
  });
};

// 6. Brick hit: bright crisp crystal/glass pop (680Hz + 1360Hz overtone)
export const getGameBrickToneUri = () => {
  return createWavUri(11025, 0.07, (t) => {
    const env = Math.exp(-t * 40);
    const s1 = Math.sin(2 * Math.PI * 680 * t);
    const s2 = Math.sin(2 * Math.PI * 1360 * t) * 0.3;
    return (s1 + s2) * 0.5 * env;
  });
};

// 7. Steel / unbreakable brick hit: heavy metallic ricochet clang
export const getGameSteelToneUri = () => {
  return createWavUri(11025, 0.12, (t) => {
    const env = Math.exp(-t * 22);
    const s1 = Math.sin(2 * Math.PI * 880 * t);
    const s2 = Math.sin(2 * Math.PI * 1420 * t) * 0.6;
    const s3 = Math.sin(2 * Math.PI * 2200 * t) * 0.3;
    return (s1 + s2 + s3) * 0.4 * env;
  });
};

// 8. Wall bounce: snappy arcade perimeter tick (420Hz)
export const getGameWallToneUri = () => {
  return createWavUri(11025, 0.04, (t) => {
    const env = Math.exp(-t * 60);
    return Math.sin(2 * Math.PI * 420 * t) * 0.35 * env;
  });
};

// 9. Gift power-up caught: joyful 3-note rising magical chime (G5 -> B5 -> E6)
export const getGameGiftToneUri = () => {
  return createWavUri(11025, 0.22, (t) => {
    const notes = [784, 988, 1318]; // G5, B5, E6
    const noteIdx = Math.min(Math.floor(t / 0.07), notes.length - 1);
    const noteTime = t - noteIdx * 0.07;
    const env = Math.exp(-noteTime * 20);
    return Math.sin(2 * Math.PI * notes[noteIdx] * noteTime) * 0.45 * env;
  });
};

// 10. Ball lost / life lost: comic sad descending slide (440Hz -> 140Hz)
export const getGameLostToneUri = () => {
  return createWavUri(11025, 0.28, (t) => {
    const env = Math.exp(-t * 10);
    const freq = Math.max(140, 440 - (t / 0.28) * 300);
    return Math.sin(2 * Math.PI * freq * t) * 0.5 * env;
  });
};

// 11. Level cleared / victory: triumphant 4-note ascending fanfare (C5 -> E5 -> G5 -> C6)
export const getGameWinToneUri = () => {
  return createWavUri(11025, 0.45, (t) => {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const noteIdx = Math.min(Math.floor(t / 0.11), notes.length - 1);
    const noteTime = t - noteIdx * 0.11;
    const env = Math.exp(-noteTime * 12);
    const s1 = Math.sin(2 * Math.PI * notes[noteIdx] * noteTime);
    const s2 = Math.sin(2 * Math.PI * notes[noteIdx] * 2 * noteTime) * 0.25;
    return (s1 + s2) * 0.45 * env;
  });
};
