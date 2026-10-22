// src/components/InAppNotificationBanner.js
// Global In-App Notification Toast — slides down smoothly when messages, requests or call alerts arrive
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBadgeStore } from '../store/useBadgeStore';
import { Colors, Radius, Spacing } from '../theme';
import {
  MessageTabIcon,
  UserCheckIcon,
  PhoneIcon,
  UserAvatarIcon,
} from './Icons';
import { getAvatar } from '../constants/avatars';
import { CharacterBall } from '../animal_ui/components/CharacterBall.js';

export default function InAppNotificationBanner({ navigationRef }) {
  const insets = useSafeAreaInsets();
  const inAppNotification = useBadgeStore((s) => s.inAppNotification);
  const clearInAppNotification = useBadgeStore((s) => s.clearInAppNotification);

  const translateY = useRef(new Animated.Value(-120)).current;
  const timerRef = useRef(null);

  // PanResponder to allow user to swipe up to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 5,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -10) {
          hideBanner();
        }
      },
    })
  ).current;

  const hideBanner = () => {
    Animated.timing(translateY, {
      toValue: -120,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      clearInAppNotification();
    });
  };

  useEffect(() => {
    if (inAppNotification) {
      if (timerRef.current) clearTimeout(timerRef.current);

      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }).start();

      // Auto dismiss after 4 seconds
      timerRef.current = setTimeout(() => {
        hideBanner();
      }, 4000);

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [inAppNotification]);

  if (!inAppNotification) return null;

  const handlePress = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    hideBanner();

    if (!navigationRef || !navigationRef.isReady || !navigationRef.isReady()) return;

    if (inAppNotification.type === 'chat' && inAppNotification.data) {
      navigationRef.navigate('Chat', {
        conversationId: inAppNotification.data.conversationId,
        contactHandle: inAppNotification.data.contactHandle,
        contactNickname: inAppNotification.data.contactNickname || inAppNotification.data.contactHandle,
        contactAvatarId: inAppNotification.data.contactAvatarId || 'avatar_rose',
      });
    } else if (inAppNotification.type === 'request') {
      navigationRef.navigate('MainTabs', {
        screen: 'Requests',
      });
    } else if (inAppNotification.type === 'call') {
      navigationRef.navigate('MainTabs', {
        screen: 'Calls',
      });
    }
  };

  const isImg =
    inAppNotification.avatar &&
    (inAppNotification.avatar.startsWith('data:') ||
      inAppNotification.avatar.startsWith('file:') ||
      inAppNotification.avatar.startsWith('http'));
  const presetAvatar = !isImg && inAppNotification.avatar ? getAvatar(inAppNotification.avatar) : null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: Math.max(insets.top, 12) + 2,
          transform: [{ translateY }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {/* Type Icon Badge */}
        <View style={styles.iconCircle}>
          {inAppNotification.type === 'chat' ? (
            <MessageTabIcon size={14} color={Colors.accent.primary} />
          ) : inAppNotification.type === 'request' ? (
            <UserCheckIcon size={14} color={Colors.accent.primary} />
          ) : (
            <PhoneIcon size={14} color={Colors.accent.primary} />
          )}
        </View>

        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {isImg ? (
            <Image source={{ uri: inAppNotification.avatar }} style={styles.avatarImg} />
          ) : presetAvatar ? (
            <Image source={presetAvatar} style={styles.avatarImg} />
          ) : (
            <CharacterBall character={inAppNotification?.avatar || 'panda'} size={28} />
          )}
        </View>

        {/* Content */}
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {inAppNotification.title || 'New Notification'}
          </Text>
          <Text style={styles.body} numberOfLines={1}>
            {inAppNotification.body || ''}
          </Text>
        </View>

        {/* Tap Indicator Pill */}
        <View style={styles.openBadge}>
          <Text style={styles.openText}>Open</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 99999,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b1b22',
    borderRadius: Radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(224, 82, 122, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 16,
    width: '100%',
    maxWidth: 420,
    gap: 10,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(224, 82, 122, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#261c28',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  body: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    marginTop: 2,
  },
  openBadge: {
    backgroundColor: 'rgba(224, 82, 122, 0.25)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.accent.primary,
  },
  openText: {
    color: '#ffb3c6',
    fontSize: 11,
    fontWeight: '700',
  },
});
