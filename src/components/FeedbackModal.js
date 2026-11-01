// src/components/FeedbackModal.js
// In-App Feedback & Bug Reporting Modal

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { X, Send, Mail } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Radius } from '../theme';
import { saveFeedbackToDB } from '../db/database';
import { supabase } from '../services/supabase';
import { useUserStore } from '../store/useUserStore';

const CATEGORIES = [
  { id: 'bug', label: '🐛 Bug Report' },
  { id: 'feature', label: '💡 Feature Idea' },
  { id: 'general', label: '💬 Feedback' },
];

export default function FeedbackModal({ visible, onClose }) {
  const myHandle = useUserStore((s) => s.handle);
  const [category, setCategory] = useState('bug');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const deviceInfo = `SecureBox v1.0.0 | ${Platform.OS} ${Platform.Version} | User: @${myHandle || 'guest'}`;

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert('Message Required', 'Please describe the issue or feedback before sending.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Save to local SQLite
      await saveFeedbackToDB({
        category,
        content: content.trim(),
        deviceInfo,
      });

      // 2. Attempt sync to Supabase
      try {
        if (supabase) {
          await supabase.from('app_feedback').insert({
            user_handle: myHandle || 'anonymous',
            category,
            content: content.trim(),
            device_info: deviceInfo,
            created_at: new Date().toISOString(),
          });
        }
      } catch (_) {}

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}

      setContent('');
      onClose();
      Alert.alert(
        'Thank You! 💌',
        'Your feedback has been safely submitted to the Team43 developer team.'
      );
    } catch (err) {
      console.warn('Feedback submit note:', err);
      Alert.alert('Notice', 'Feedback saved locally. Thank you!');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEmail = () => {
    const subject = encodeURIComponent(`SecureBox Feedback [${category.toUpperCase()}]`);
    const body = encodeURIComponent(`${content.trim()}\n\n---\nDiagnostic Info:\n${deviceInfo}`);
    const mailUrl = `mailto:support@kanelijo.com?subject=${subject}&body=${body}`;
    Linking.openURL(mailUrl).catch(() => {
      Alert.alert('Email Support', 'You can email our team directly at support@kanelijo.com');
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <TouchableOpacity style={styles.backdropPress} activeOpacity={1} onPress={onClose} />
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Send Feedback & Bug Reports</Text>
              <Text style={styles.subtitle}>Direct connection to Team43 developers</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Category Selector */}
          <View style={styles.categoriesRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryPill,
                  category === cat.id && styles.categoryPillActive,
                ]}
                onPress={() => setCategory(cat.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryText,
                    category === cat.id && styles.categoryTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Message Input */}
          <TextInput
            style={styles.input}
            placeholder="Describe what happened or what you'd love to see..."
            placeholderTextColor={Colors.text.placeholder}
            multiline
            numberOfLines={5}
            value={content}
            onChangeText={setContent}
            textAlignVertical="top"
          />

          {/* Device diagnostic info chip */}
          <View style={styles.diagBox}>
            <Text style={styles.diagText} numberOfLines={1}>
              📋 {deviceInfo}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.emailBtn}
              onPress={handleOpenEmail}
              activeOpacity={0.75}
            >
              <Mail size={16} color={Colors.text.secondary} />
              <Text style={styles.emailBtnText}>Email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Send size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.submitBtnText}>Submit Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdropPress: {
    flex: 1,
  },
  content: {
    backgroundColor: Colors.bg.elevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  title: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  categoriesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  categoryPillActive: {
    backgroundColor: Colors.accent.primary,
    borderColor: Colors.accent.primary,
  },
  categoryText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  categoryTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  input: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: 12,
    color: Colors.text.primary,
    fontSize: Typography.sizes.sm,
    minHeight: 110,
  },
  diagBox: {
    backgroundColor: Colors.bg.secondary,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
  },
  diagText: {
    fontSize: 11,
    color: Colors.text.placeholder,
    fontFamily: 'monospace',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.divider,
    gap: 6,
  },
  emailBtnText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent.primary,
    paddingVertical: 12,
    borderRadius: Radius.full,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: Typography.sizes.sm,
  },
});
