import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme/ThemeProvider';
import { fonts, radius, spacing } from '../theme/tokens';
import { layout } from '../theme/layout';
import { duration, easing } from '../theme/motion';

function Dot({ index, color }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 150),
        Animated.timing(y, { toValue: -5, duration: 220, easing: easing.out, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 220, easing: easing.inOut, useNativeDriver: true }),
        Animated.delay(450 - index * 150),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [index, y]);
  return <Animated.View style={[styles.dot, { backgroundColor: color, transform: [{ translateY: y }] }]} />;
}

export function SpeechBubble({ text, typing }) {
  const c = useColors();
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: duration.base, easing: easing.out, useNativeDriver: true }).start();
  }, [text, typing, fade]);

  const tail = layout.bubbleTail;
  return (
    <Animated.View
      style={[
        styles.bubble,
        { backgroundColor: c.surface, borderColor: c.borderStrong, opacity: fade },
      ]}
    >
      {typing ? (
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <Dot key={i} index={i} color={c.textSecondary} />
          ))}
        </View>
      ) : (
        <Text style={[styles.text, { color: c.text, fontFamily: fonts.voice }]}>{text}</Text>
      )}
      <View
        style={[
          styles.tail,
          {
            width: tail,
            height: tail,
            marginLeft: -tail / 2,
            bottom: -tail / 2 - 1,
            backgroundColor: c.surface,
            borderColor: c.borderStrong,
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    minHeight: layout.bubbleMinHeight,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  text: { fontSize: 15, lineHeight: 21 },
  dots: { flexDirection: 'row', gap: 4, height: 21, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  tail: {
    position: 'absolute',
    left: '50%',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    transform: [{ rotate: '45deg' }],
  },
});
