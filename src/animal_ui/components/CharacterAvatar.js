import React, { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { VIEWBOX_RATIO, characterSvg } from '../characters/characters';
import { character as timing, easing } from '../theme/motion';

export function CharacterAvatar({
  character,
  state = 'idle',
  size = 150,
  tilt = 0,
}) {
  const [beat, setBeat] = useState(false);
  const bob = useRef(new Animated.Value(0)).current;

  // Two-frame flip: mouth open/closed while talking, paws up/down while typing.
  useEffect(() => {
    if (state !== 'talking' && state !== 'typing') {
      setBeat(false);
      return;
    }
    const id = setInterval(
      () => setBeat((b) => !b),
      state === 'talking' ? timing.talkFrame : timing.typeFrame,
    );
    return () => clearInterval(id);
  }, [state]);

  // Little bounce while talking.
  useEffect(() => {
    bob.setValue(0);
    if (state !== 'talking') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -timing.bobHeight, duration: timing.bobHalf, easing: easing.out, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: timing.bobHalf, easing: easing.inOut, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, bob]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size * VIEWBOX_RATIO,
        transform: [{ rotate: `${tilt}deg` }, { translateY: bob }],
      }}
    >
      <SvgXml xml={characterSvg(character, state, { beat })} width="100%" height="100%" />
    </Animated.View>
  );
}
