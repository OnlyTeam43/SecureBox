import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CharacterAvatar } from './CharacterAvatar';
import { IconButton } from './IconButton';
import { CharacterId, CharacterState } from '../characters/characters';
import { useColors } from '../theme/ThemeProvider';
import { spacing, type } from '../theme/tokens';
import { layout } from '../theme/layout';

export type CallKind = 'voice' | 'video';

// Priority: deafened > muted > camera. A deafened character covers its ears
// even if the mic is also off.
export function callState(opts: {
  kind: CallKind;
  muted: boolean;
  deafened: boolean;
  cameraOn: boolean;
}): CharacterState {
  if (opts.deafened) return 'deafen';
  if (opts.muted) return 'mute';
  if (opts.kind === 'video') return opts.cameraOn ? 'video' : 'cameraoff';
  return 'call';
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${`0${s % 60}`.slice(-2)}`;

export interface CallScreenProps {
  kind: CallKind;
  me: { character: CharacterId };
  friend: { character: CharacterId; name: string; state?: CharacterState };
  muted: boolean;
  deafened: boolean;
  cameraOn: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleCamera: () => void;
  onFlipCamera?: () => void;
  onEnd: () => void;
}

export function CallScreen(p: CallScreenProps) {
  const c = useColors();
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const mine = callState({ kind: p.kind, muted: p.muted, deafened: p.deafened, cameraOn: p.cameraOn });
  const theirs: CharacterState = p.friend.state ?? (p.kind === 'video' ? 'video' : 'call');

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={styles.header}>
        <Text style={[type.title, { color: c.text }]}>{p.friend.name}</Text>
        <Text style={[type.timer, { color: c.textSecondary }]}>{mmss(seconds)}</Text>
      </View>

      <View style={styles.stage}>
        <CharacterAvatar character={p.friend.character} state={theirs} size={layout.callCharacterSize} tilt={-layout.tiltDeg} />
        <CharacterAvatar character={p.me.character} state={mine} size={layout.callCharacterSize} tilt={layout.tiltDeg} />
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
