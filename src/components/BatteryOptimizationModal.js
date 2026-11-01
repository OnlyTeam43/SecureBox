// src/components/BatteryOptimizationModal.js
// Background Performance & Battery Optimization Guide

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
import { X, BatteryCharging, ExternalLink, Zap } from 'lucide-react-native';
import { Colors, Typography, Radius } from '../theme';

export default function BatteryOptimizationModal({ visible, onClose }) {
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
                <BatteryCharging size={20} color={Colors.accent.primary} />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.title}>Instant Call & Chat Delivery</Text>
                <Text style={styles.subtitle}>Battery & Background Optimization</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.intro}>
              Some Android manufacturers (Samsung, Xiaomi, OnePlus, Vivo, Oppo) aggressively kill background apps, which can delay incoming calls or messages until you unlock your phone.
            </Text>

            <View style={styles.recommendBox}>
              <View style={styles.recommendHeader}>
                <Zap size={16} color={Colors.accent.primary} style={{ marginRight: 6 }} />
                <Text style={styles.recommendTitle}>Recommended Setting</Text>
              </View>
              <Text style={styles.recommendText}>
                Set SecureBox battery usage to <Text style={{ fontWeight: '800', color: Colors.text.primary }}>Unrestricted</Text> (or "Don't optimize").
              </Text>
            </View>

            <Text style={styles.brandTitle}>Quick Steps by Brand:</Text>

            <View style={styles.stepCard}>
              <Text style={styles.brandName}>Samsung (One UI)</Text>
              <Text style={styles.brandSteps}>
                Settings → Apps → SecureBox → Battery → Select <Text style={{ fontWeight: '700' }}>Unrestricted</Text>. Remove from "Sleeping apps".
              </Text>
            </View>

            <View style={styles.stepCard}>
              <Text style={styles.brandName}>Xiaomi / Redmi / POCO (MIUI / HyperOS)</Text>
              <Text style={styles.brandSteps}>
                Settings → Apps → Manage Apps → SecureBox → Enable <Text style={{ fontWeight: '700' }}>Autostart</Text>. Battery Saver → Select <Text style={{ fontWeight: '700' }}>No restrictions</Text>.
              </Text>
            </View>

            <View style={styles.stepCard}>
              <Text style={styles.brandName}>OnePlus / Realme / Oppo (ColorOS / OxygenOS)</Text>
              <Text style={styles.brandSteps}>
                Settings → Apps → SecureBox → Battery usage → Enable <Text style={{ fontWeight: '700' }}>Allow background activity</Text>.
              </Text>
            </View>

            <View style={styles.stepCard}>
              <Text style={styles.brandName}>Google Pixel & Stock Android</Text>
              <Text style={styles.brandSteps}>
                Settings → Apps → SecureBox → App battery usage → Select <Text style={{ fontWeight: '700' }}>Unrestricted</Text>.
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
              <Text style={styles.settingsBtnText}>Open App Battery Settings</Text>
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
    marginBottom: 14,
  },
  recommendBox: {
    backgroundColor: 'rgba(217,119,87,0.08)',
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(217,119,87,0.2)',
  },
  recommendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  recommendTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: '800',
    color: Colors.accent.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  recommendText: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  brandTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: '800',
    color: Colors.text.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  stepCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  brandName: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  brandSteps: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    lineHeight: 17,
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
