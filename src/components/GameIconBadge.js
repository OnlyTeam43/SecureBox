// src/components/GameIconBadge.js
// Wrap the animal icon on the game screen:  <GameIconBadge><AnimalIcon /></GameIconBadge>
// Shows the unread count and pulses with a terracotta halo when a new message arrives.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useBadgeStore } from '../store/useBadgeStore';

export default function GameIconBadge({ children, size = 20 }) {
  const count = useBadgeStore((s) => s.unreadMessagesCount + s.pendingRequestsCount);
  const tick = useBadgeStore((s) => s.pingTick);
  const scale = useRef(new Animated.Value(1)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scale.setValue(1);
    halo.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.timing(halo, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [tick, scale, halo]);

  const haloStyle = {
    opacity: halo.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.7, 0] }),
    transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
  };

  return (
    <View>
      <Animated.View pointerEvents="none" style={[styles.halo, haloStyle]} />
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
      {count > 0 && (
        <View style={[styles.badge, { minWidth: size, height: size, borderRadius: size / 2 }]}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : String(count)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  halo: { ...StyleSheet.absoluteFillObject, borderRadius: 999, borderWidth: 3, borderColor: '#D97757' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#E53935',
    borderWidth: 2,
    borderColor: '#FAF9F5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
