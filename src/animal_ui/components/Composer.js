import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { useColors } from '../theme/ThemeProvider';
import { radius, spacing, type } from '../theme/tokens';
import { layout } from '../theme/layout';

export function Composer({
  onSend,
  onTypingChange,
  onAdd,
  placeholder = 'Say something sweet',
}) {
  const c = useColors();
  const [draft, setDraft] = useState('');
  const hasText = draft.trim().length > 0;

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
    onTypingChange?.(false);
  };

  return (
    <View
      style={[
        styles.box,
        { backgroundColor: c.surface, borderColor: c.borderStrong },
      ]}
    >
      <TextInput
        value={draft}
        onChangeText={(t) => {
          setDraft(t);
          onTypingChange?.(t.trim().length > 0);
        }}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        multiline
        numberOfLines={1}
        style={[
          type.body,
          styles.input,
          { color: c.text, maxHeight: type.body.lineHeight * layout.composerMaxLines },
        ]}
      />
      <View style={styles.row}>
        <IconButton icon="add" label="Add" variant="ghost" size={layout.sendSize} onPress={onAdd} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          onPress={submit}
          style={({ pressed }) => [
            styles.send,
            {
              backgroundColor: hasText ? c.brand : c.surfaceMuted,
              transform: [{ scale: pressed && hasText ? 0.96 : 1 }],
            },
          ]}
        >
          <Icon name="sendUp" size={18} color={hasText ? c.onBrand : c.textMuted} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: layout.composerRadius,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: layout.composerPadding + 4,
    paddingTop: layout.composerPadding,
    paddingBottom: spacing.sm,
    minHeight: layout.composerMinHeight + 20,
  },
  input: { paddingTop: 4, paddingBottom: 4, textAlignVertical: 'top' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginLeft: -spacing.sm,
  },
  send: {
    width: layout.sendSize,
    height: layout.sendSize,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
