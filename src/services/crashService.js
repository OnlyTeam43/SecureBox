// src/services/crashService.js
// Client-side Crash & Error Monitoring Engine
// Captures unhandled runtime errors, logs diagnostics into local SQLite database,
// and optionally syncs reports to Supabase when online.

import { Platform } from 'react-native';
import { logCrashToDB, getCrashLogsFromDB } from '../db/database';
import { supabase } from './supabase';

const APP_VERSION = '1.0.0';
let isInitialized = false;

/**
 * Initialize global error handlers
 */
export const initCrashMonitoring = () => {
  if (isInitialized) return;
  isInitialized = true;

  // React Native global JS error handler
  if (typeof global !== 'undefined' && global.ErrorUtils) {
    const defaultHandler = global.ErrorUtils.getGlobalHandler && global.ErrorUtils.getGlobalHandler();
    global.ErrorUtils.setGlobalHandler(async (error, isFatal) => {
      try {
        await recordCrash(error, { isFatal, source: 'global_handler' });
      } catch (_) {}
      if (defaultHandler) {
        defaultHandler(error, isFatal);
      }
    });
  }
};

/**
 * Record a crash or error into the local database and backend
 */
export const recordCrash = async (error, extraInfo = {}) => {
  try {
    const errorMessage = error?.message || String(error || 'Unknown Error');
    const stackTrace = error?.stack || '';
    const componentStack = extraInfo?.componentStack || '';
    const isFatal = Boolean(extraInfo?.isFatal);

    // 1. Persist crash details into local SQLite
    await logCrashToDB({
      errorMessage: `${isFatal ? '[FATAL] ' : ''}${errorMessage}`,
      stackTrace,
      componentStack,
    });

    // 2. Attempt ephemeral report to Supabase if network is available
    try {
      if (supabase) {
        await supabase.from('crash_reports').insert({
          error_message: errorMessage,
          stack_trace: stackTrace.substring(0, 1500),
          component_stack: componentStack.substring(0, 1500),
          is_fatal: isFatal,
          platform: Platform.OS,
          os_version: String(Platform.Version || ''),
          app_version: APP_VERSION,
          created_at: new Date().toISOString(),
        });
      }
    } catch (_) {
      // Supabase table may not exist or device is offline — local DB already captured it
    }
  } catch (err) {
    console.error('[CrashService] Failed to record crash:', err);
  }
};

export const getRecentCrashes = async (limit = 10) => {
  try {
    return await getCrashLogsFromDB(limit);
  } catch (_) {
    return [];
  }
};
