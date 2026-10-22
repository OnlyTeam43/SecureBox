import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CharacterAvatar } from './CharacterAvatar';
import { SpeechBubble } from './SpeechBubble';
import { CharacterId, CharacterState } from '../characters/characters';
import { useColors } from '../theme/ThemeProvider';
import { spacing, type } from '../theme/tokens';
import { layout } from '../theme/layout';
import { character as timing } from '../theme/motion';

// True for a short time after `value` changes (not on first render).
function useRecentlyChanged(value: string | undefined, ms: number) {
  const [active, setActive] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setActive(true);
    const id = setTimeout(() => setActive(false), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return active;
}

export interface ScenePerson {
  character: CharacterId;
  name: string;
  message?: string;
  typing?: boolean;
  /** Force a state (mute, call, video...). Leave empty for automatic idle, talking, typing. */
  state?: CharacterState;
}

export function ChatScene({
  me,
  friend,
  onPressMe,
  onPressFriend,
}: {
  me: ScenePerson;
  friend: ScenePerson;
  onPressMe?: () => void;
  onPressFriend?: () => void;
}) {
  const c = useColors();
  const meTalking = useRecentlyChanged(me.message, timing.talkHold);
  const friendTalking = useRecentlyChanged(friend.message, timing.talkHold);

  const pick = (p: ScenePerson, talking: boolean): CharacterState =>
    p.typing ? 'typing' : p.state ?? (talking ? 'talking' : 'idle');
  const myState = pick(me, meTalking);
  const friendState = pick(friend, friendTalking);

  return (
    <View style={styles.scene}>
      <View style={styles.column}>
        <SpeechBubble text={me.message} typing={myState === 'typing'} />
        <Pressable onPress={onPressMe} style={styles.avatar}>
          <CharacterAvatar character={me.character} state={myState} size={layout.chatCharacterSize} tilt={layout.tiltDeg} />
        </Pressable>
        <Text style={[type.caption, styles.name, { color: c.textSecondary }]}>{me.name}</Text>
      </View>
      <View style={styles.column}>
        <SpeechBubble text={friend.message} typing={friendState === 'typing'} />
        <Pressable onPress={onPressFriend} style={styles.avatar}>
          <CharacterAvatar character={friend.character} state={friendState} size={layout.chatCharacterSize} tilt={-layout.tiltDeg} />
        </Pressable>
        <Text style={[type.caption, styles.name, { color: c.textSecondary }]}>{friend.name}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: layout.gutter,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.xl,
  },
  column: { flex: 1, alignItems: 'stretch' },
  avatar: { alignItems: 'center', marginTop: spacing.md + 2 },
  name: { textAlign: 'center', marginTop: spacing.xs },
});
