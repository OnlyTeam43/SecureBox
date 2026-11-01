// src/components/ErrorBoundary.js
// Graceful Error Boundary with Diagnostic Logging and Safe Recovery

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../theme';
import { recordCrash } from '../services/crashService';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    recordCrash(error, {
      componentStack: errorInfo?.componentStack,
      isFatal: true,
    }).catch(() => {});
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'An unexpected runtime error occurred.';

      return (
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="dark-content" backgroundColor={Colors.bg.primary} />
          <View style={styles.container}>
            <View style={styles.content}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconText}>🛡️</Text>
              </View>

              <Text style={styles.title}>SecureBox Protected</Text>
              <Text style={styles.subtitle}>
                An interface error was caught. Your encrypted chats, calls, and private media vault remain completely safe.
              </Text>

              <View style={styles.errorBox}>
                <Text style={styles.errorLabel}>DIAGNOSTIC REPORT</Text>
                <ScrollView style={styles.errorScroll} nestedScrollEnabled>
                  <Text style={styles.errorText} numberOfLines={4}>
                    {errorMsg}
                  </Text>
                </ScrollView>
              </View>

              <TouchableOpacity
                style={styles.restartBtn}
                onPress={this.handleRestart}
                activeOpacity={0.8}
              >
                <Text style={styles.restartBtnText}>Restart SecureBox</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.lg,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(217,119,87,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontSize: Typography.sizes.lg,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  errorBox: {
    width: '100%',
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  errorLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.accent.primary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  errorScroll: {
    maxHeight: 70,
  },
  errorText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontFamily: 'monospace',
  },
  restartBtn: {
    width: '100%',
    backgroundColor: Colors.accent.primary,
    paddingVertical: 14,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restartBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: Typography.sizes.sm,
  },
});
