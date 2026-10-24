// src/components/BubbleAlert.js
// Custom speech-bubble styled alert dialog matching our signature warm Claude & Animal aesthetic.
// Replaces harsh system dialogs with soft rounded pill/bubble cards, smooth spring animation,
// terracotta clay buttons, and light haptics.

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Alert as NativeAlert,
} from 'react-native';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

// Global listener for imperative alert triggers
let globalAlertHandler = null;

/**
 * Trigger our custom bubble alert from anywhere in the app.
 * Matches Alert.alert signature: bubbleAlert(title, message, buttons, options)
 */
export const bubbleAlert = (title, message, buttons, options = {}) => {
  if (globalAlertHandler) {
    globalAlertHandler({
      title: title || '',
      message: message || '',
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }],
      options,
    });
  } else {
    // Fallback if modal not yet mounted
    NativeAlert.alert(title, message, buttons, options);
  }
};

/**
 * Monkey-patches React Native's NativeAlert.alert so that ALL alerts across
 * the entire codebase automatically display in our signature bubble style!
 */
export const installBubbleAlert = () => {
  NativeAlert.alert = (title, message, buttons, options) => {
    bubbleAlert(title, message, buttons, options);
  };
};

export default function BubbleAlertModal() {
  const [alertConfig, setAlertConfig] = useState(null);
  const [visible, setVisible] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    globalAlertHandler = (config) => {
      setAlertConfig(config);
      setVisible(true);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (_) {}

      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 200,
          friction: 14,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    };

    return () => {
      globalAlertHandler = null;
    };
  }, [scaleAnim, opacityAnim]);

  const dismiss = (callback) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}

    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setAlertConfig(null);
      if (typeof callback === 'function') {
        callback();
      }
    });
  };

  if (!visible || !alertConfig) return null;

  const { title, message, buttons = [] } = alertConfig;

  // Determine top badge emoji / icon based on title / message content
  let badgeEmoji = '💬';
  const lower = `${title} ${message}`.toLowerCase();
  if (lower.includes('delete') || lower.includes('remove') || lower.includes('clear')) {
    badgeEmoji = '🗑️';
  } else if (lower.includes('request') || lower.includes('connect') || lower.includes('chat')) {
    badgeEmoji = '💌';
  } else if (lower.includes('screenshot') || lower.includes('security') || lower.includes('shield')) {
    badgeEmoji = '🛡️';
  } else if (lower.includes('error') || lower.includes('failed') || lower.includes('invalid')) {
    badgeEmoji = '⚠️';
  } else if (lower.includes('logged out') || lower.includes('sign out')) {
    badgeEmoji = '👋';
  } else if (lower.includes('accept') || lower.includes('success')) {
    badgeEmoji = '🎉';
  }

  const isMultiButton = buttons.length > 2;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => dismiss()}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.bubbleContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Top Emoji Badge */}
          <View style={styles.badgeWrap}>
            <View style={styles.badgeCircle}>
              <Text style={styles.badgeEmoji}>{badgeEmoji}</Text>
            </View>
          </View>

          {/* Alert Title */}
          {Boolean(title) && <Text style={styles.titleText}>{title}</Text>}

          {/* Alert Body / Message */}
          {Boolean(message) && <Text style={styles.messageText}>{message}</Text>}

          {/* Speech-Bubble Subtle Tail Notch */}
          <View style={styles.bubbleTail} />

          {/* Action Buttons */}
          <View
            style={[
              styles.buttonsWrap,
              isMultiButton ? styles.buttonsWrapCol : styles.buttonsWrapRow,
            ]}
          >
            {buttons.map((btn, index) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              const isPrimary = !isDestructive && !isCancel;

              let btnStyle = styles.btnPrimary;
              let btnTextStyle = styles.btnTextPrimary;

              if (isDestructive) {
                btnStyle = styles.btnDestructive;
                btnTextStyle = styles.btnTextDestructive;
              } else if (isCancel) {
                btnStyle = styles.btnCancel;
                btnTextStyle = styles.btnTextCancel;
              }

              return (
                <TouchableOpacity
                  key={`btn_${index}_${btn.text}`}
                  style={[
                    styles.buttonBase,
                    btnStyle,
                    !isMultiButton && buttons.length === 2 && styles.buttonHalf,
                  ]}
                  activeOpacity={0.82}
                  onPress={() => dismiss(btn.onPress)}
                >
                  <Text style={[styles.btnTextBase, btnTextStyle]}>{btn.text}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 20, 19, 0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  bubbleContainer: {
    width: Math.min(width - 48, 330),
    backgroundColor: '#FAF9F5',
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(217, 119, 87, 0.22)',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: 'center',
    shadowColor: '#141413',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
  },
  badgeWrap: {
    marginBottom: 12,
  },
  badgeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FBE9E7',
    borderWidth: 1.5,
    borderColor: 'rgba(217, 119, 87, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeEmoji: {
    fontSize: 22,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#141413',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#5E5D59',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  bubbleTail: {
    width: 14,
    height: 14,
    backgroundColor: '#FAF9F5',
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: 'rgba(217, 119, 87, 0.22)',
    transform: [{ rotate: '45deg' }],
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
  },
  buttonsWrap: {
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  buttonsWrapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buttonsWrapCol: {
    flexDirection: 'column',
  },
  buttonBase: {
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonHalf: {
    flex: 1,
  },
  btnPrimary: {
    backgroundColor: '#D97757',
  },
  btnTextPrimary: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  btnDestructive: {
    backgroundColor: '#C0392B',
  },
  btnTextDestructive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  btnCancel: {
    backgroundColor: '#F0EEE6',
    borderWidth: 1,
    borderColor: 'rgba(20,20,19,0.08)',
  },
  btnTextCancel: {
    color: '#5E5D59',
    fontWeight: '600',
  },
  btnTextBase: {
    fontSize: 14,
    textAlign: 'center',
  },
});
