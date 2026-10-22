import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CharacterAvatar } from './CharacterAvatar.js';
import { IconButton } from './IconButton.js';
import { useColors } from '../theme/ThemeProvider.js';
import { spacing, type } from '../theme/tokens.js';
import { layout } from '../theme/layout.js';

export function callState(opts) {
  if (opts.deafened) return 'deafen';
  if (opts.muted) return 'mute';
  if (opts.kind === 'video') return opts.cameraOn ? 'video' : 'cameraoff';
  return 'call';
}

const mmss = (s) => `${Math.floor(s / 60)}:${`0${s % 60}`.slice(-2)}`;

export function CallScreen(p) {
  const c = useColors();
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const mine = callState({ kind: p.kind, muted: p.muted, deafened: p.deafened, cameraOn: p.cameraOn });
  const theirs = p.friend?.state ?? (p.kind === 'video' ? 'video' : 'call');

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={styles.header}>
        <Text style={[type.title, { color: c.text }]}>{p.friend?.name || 'Friend'}</Text>
        <Text style={[type.timer, { color: c.textSecondary }]}>{mmss(seconds)}</Text>
      </View>

      <View style={styles.stage}>
        <CharacterAvatar character={p.friend?.character || 'cat'} state={theirs} size={layout.callCharacterSize} tilt={-layout.tiltDeg} />
        <CharacterAvatar character={p.me?.character || 'panda'} state={mine} size={layout.callCharacterSize} tilt={layout.tiltDeg} />
      </View>

      <View style={styles.controls}>
        <IconButton icon={p.muted ? 'micOff' : 'mic'} label={p.muted ? 'Unmute' : 'Mute'} variant={p.muted ? 'selected' : 'default'} onPress={p.onToggleMute} />
        <IconButton icon={p.deafened ? 'headphonesOff' : 'headphones'} label={p.deafened ? 'Undeafen' : 'Deafen'} variant={p.deafened ? 'selected' : 'default'} onPress={p.onToggleDeafen} />
        {p.kind === 'video' && (
          <IconButton icon={p.cameraOn ? 'video' : 'videoOff'} label={p.cameraOn ? 'Turn camera off' : 'Turn camera on'} variant={p.cameraOn ? 'default' : 'selected'} onPress={p.onToggleCamera} />
        )}
        {p.kind === 'video' && p.onFlipCamera && (
          <IconButton icon="flipCamera" label="Flip camera" onPress={p.onFlipCamera} />
        )}
        <IconButton icon="hangUp" label="End call" variant="danger" onPress={p.onEnd} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: layout.screenPadding },
  header: { alignItems: 'center', paddingTop: spacing.xl, gap: spacing.xs },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: layout.controlGap,
    paddingBottom: spacing.xxl,
  },
});
