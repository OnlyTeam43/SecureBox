// src/components/PermissionsModal.js
// In-App Permissions Transparency & Privacy Disclosure

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { X, Camera, Mic, Image, Bell, ShieldCheck, ExternalLink } from 'lucide-react-native';
import { Colors, Typography, Radius } from '../theme';

const PERMISSIONS = [
  {
    id: 'camera',
    title: 'Camera',
    desc: 'Used only during active video calls and when capturing photos directly into your secret vault. Never accessed in the background.',
    icon: Camera,
  },
  {
    id: 'mic',
    title: 'Microphone',
    desc: 'Used solely for live encrypted peer-to-peer voice and video calls. Audio is never stored on servers.',
    icon: Mic,
  },
  {
    id: 'storage',
    title: 'Photo Library & Storage',
    desc: 'Used only when you choose to import private photos from your device into the hidden sandbox vault.',
    icon: Image,
  },
  {
    id: 'notifications',
    title: 'Notifications',
    desc: 'Wakes the app for incoming calls and new messages. In Decoy Mode, alerts can be camouflaged as system notes.',
    icon: Bell,
  },
];

export default function PermissionsModal({ visible, onClose }) {
  const handleOpenSettings = () => {
    Linking.openSettings().catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropPress} activeOpacity={1} onPress={onClose} />
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconBox}>
                <ShieldCheck size={20} color={Colors.accent.primary} />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.title}>Permissions & Privacy</Text>
                <Text style={styles.subtitle}>100% Transparent Device Access</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.intro}>
              SecureBox accesses only the minimum hardware capabilities necessary for private communication and vault security.
            </Text>

            {PERMISSIONS.map((p) => {
              const IconComp = p.icon;
              return (
                <View key={p.id} style={styles.permCard}>
                  <View style={styles.permIconBox}>
                    <IconComp size={18} color={Colors.accent.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.permTitle}>{p.title}</Text>
                    <Text style={styles.permDesc}>{p.desc}</Text>
                  </View>
                </View>
              );
            })}

            <View style={styles.guaranteeBox}>
              <Text style={styles.guaranteeTitle}>Our Privacy Standard</Text>
              <Text style={styles.guaranteeText}>
                • No GPS location tracking{'\n'}
                • No address book uploads{'\n'}
                • No third-party ad SDKs or trackers{'\n'}
                • Instant Erase permanently destroys all on-device data in &lt;200ms
              </Text>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={handleOpenSettings}
              activeOpacity={0.8}
            >
              <ExternalLink size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.settingsBtnText}>Manage in Phone Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(217,119,87,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  scroll: {
    marginTop: 12,
  },
  intro: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  permCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  permIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(217,119,87,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  permTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  permDesc: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    lineHeight: 16,
  },
  guaranteeBox: {
    backgroundColor: 'rgba(94,148,115,0.08)',
    borderRadius: Radius.md,
    padding: 14,
    marginTop: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(94,148,115,0.2)',
  },
  guaranteeTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: '800',
    color: '#3E7B54',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  guaranteeText: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  actions: {
    paddingTop: 8,
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent.primary,
    paddingVertical: 14,
    borderRadius: Radius.full,
  },
  settingsBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: Typography.sizes.sm,
  },
});
