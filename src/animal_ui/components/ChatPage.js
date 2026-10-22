import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatScene } from './ChatScene';
import { Composer } from './Composer';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { useColors } from '../theme/ThemeProvider';
import { radius, spacing, type } from '../theme/tokens';
import { layout } from '../theme/layout';

export function ChatPage(p) {
  const c = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Claude Minimalist Header */}
        <View style={styles.header}>
          <IconButton icon="back" label="Back" variant="ghost" size={layout.headerIcon} onPress={p.onBack} />
          <View style={styles.titleBox}>
            <Text style={[type.title, { color: c.text }]} numberOfLines={1}>
              {p.friend?.name || 'Friend'}
            </Text>
            <View style={styles.sub}>
              <Icon name="lock" size={11} color={c.textMuted} />
              <Text style={[type.caption, { color: c.textMuted }]}>End-to-end encrypted</Text>
            </View>
          </View>

          {/* Action Icons */}
          <IconButton icon="phone" label="Voice call" variant="ghost" size={layout.headerIcon} onPress={p.onVoiceCall} />
          <IconButton icon="video" label="Video call" variant="ghost" size={layout.headerIcon} onPress={p.onVideoCall} />

          {/* Switch to WhatsApp List / History Toggle Pill */}
          {p.onSwitchView && (
            <TouchableOpacity
              onPress={p.onSwitchView}
              style={[styles.switchPill, { borderColor: c.borderStrong, backgroundColor: c.surface }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.switchPillText, { color: c.textSecondary }]}>💬 Feed</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Optional Custom Content */}
        {p.children}

        {/* Two-Character Interactive Stage */}
        <ChatScene
          me={p.me}
          friend={p.friend}
          onPressMe={p.onPressMe}
          onPressFriend={p.onPressFriend}
        />

        {/* Claude Rounded Input Box */}
        <View style={styles.composerWrap}>
          <Composer onSend={p.onSend} onTypingChange={p.onTypingChange} onAdd={p.onAdd} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    height: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    gap: 4,
  },
  titleBox: { flex: 1, alignItems: 'center' },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  switchPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    marginLeft: 4,
  },
  switchPillText: {
    fontSize: 11,
    fontWeight: '500',
  },
  composerWrap: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.sm,
  },
});
