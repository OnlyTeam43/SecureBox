// src/store/useUserStore.js
// Global user state — persisted via MMKV / AsyncStorage

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useUserStore = create(
  persist(
    (set, get) => ({
      // User identity
      handle: null,        // @handle — unique login ID
      nickname: null,      // Display name
      avatarId: null,      // Avatar key or base64 data URI
      avatarUri: null,     // Uploaded profile picture URI
      mobileNumber: null,  // Mobile number for recovery / APK updates
      recoveryPin: null,   // 4-digit WhatsApp recovery PIN
      password: null,      // User password
      isSetup: false,      // Has onboarding been completed?

      // Disappearing messages default
      defaultExpiry: null, // null = never, or seconds (3600, 86400, etc.)

      // Actions
      setProfile: (handle, nickname, avatarId, mobileNumber = null, avatarUri = null, recoveryPin = null) =>
        set({ handle, nickname, avatarId, mobileNumber, avatarUri, recoveryPin }),

      setRecoveryPin: (recoveryPin) => set({ recoveryPin }),

      setAvatarUri: (avatarUri) => set({ avatarUri, avatarId: avatarUri }),

      setPassword: (password) => set({ password }),

      setDefaultExpiry: (seconds) => set({ defaultExpiry: seconds }),

      completeSetup: () => set({ isSetup: true }),

      reset: () =>
        set({
          handle: null,
          nickname: null,
          avatarId: null,
          avatarUri: null,
          mobileNumber: null,
          recoveryPin: null,
          password: null,
          isSetup: false,
          defaultExpiry: null,
        }),
    }),
    {
      name: 'securebox-user',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
