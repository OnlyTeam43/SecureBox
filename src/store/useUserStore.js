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

      // Deep link pending invite handle (e.g. user clicked securebox://invite/alex)
      pendingInviteHandle: null,

      // Stealth / Calculator Decoy Mode
      isStealthModeEnabled: false,
      stealthPin: '1357', // Default PIN for calculator unlock
      stealthDuressPin: '9999', // Emergency duress PIN that silently nukes all data
      stealthDecoyPin: '0000', // Decoy PIN that unlocks fake innocent study chats
      isStealthUnlocked: false,
      isDecoyUnlocked: false,
      isStealthNotificationsEnabled: false, // Disguises lock screen push notifications

      // Claude Animal Scene Preferences
      chatViewMode: 'classic', // 'classic' | 'claude'
      myCharacter: 'panda', // 'panda' | 'cat' | 'puppy'

      // Actions
      setProfile: (handle, nickname, avatarId, mobileNumber = null, avatarUri = null, recoveryPin = null) =>
        set({ handle, nickname, avatarId, mobileNumber, avatarUri, recoveryPin }),

      setPendingInviteHandle: (inviteHandle) => set({ pendingInviteHandle: inviteHandle }),
      clearPendingInviteHandle: () => set({ pendingInviteHandle: null }),

      setChatViewMode: (chatViewMode) => set({ chatViewMode }),
      setMyCharacter: (myCharacter) => set({ myCharacter }),

      setRecoveryPin: (recoveryPin) => set({ recoveryPin }),

      setAvatarUri: (avatarUri) => set({ avatarUri, avatarId: avatarUri }),

      setPassword: (password) => set({ password }),

      setDefaultExpiry: (seconds) => set({ defaultExpiry: seconds }),

      setStealthModeEnabled: (enabled) => set({ isStealthModeEnabled: enabled }),
      setStealthPin: (pin) => set({ stealthPin: pin }),
      setStealthDuressPin: (pin) => set({ stealthDuressPin: pin }),
      setStealthDecoyPin: (pin) => set({ stealthDecoyPin: pin }),
      setStealthUnlocked: (unlocked) => set({ isStealthUnlocked: unlocked }),
      setDecoyUnlocked: (unlocked) => set({ isDecoyUnlocked: unlocked }),
      setStealthNotificationsEnabled: (enabled) => set({ isStealthNotificationsEnabled: enabled }),

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
          pendingInviteHandle: null,
          isStealthModeEnabled: false,
          stealthPin: '1357',
          stealthDuressPin: '9999',
          stealthDecoyPin: '0000',
          isStealthUnlocked: false,
          isDecoyUnlocked: false,
          isStealthNotificationsEnabled: false,
          chatViewMode: 'classic',
          myCharacter: 'panda',
        }),
    }),
    {
      name: 'securebox-user',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
