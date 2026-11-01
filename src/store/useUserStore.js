// src/store/useUserStore.js
// Global user state — persisted via MMKV / AsyncStorage

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useUserStore = create(
  persist(
    (set, get) => ({
      // Hydration state — ensures routes are not evaluated before AsyncStorage finishes loading
      _hasHydrated: false,
      setHasHydrated: (val) => set({ _hasHydrated: Boolean(val) }),

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

      // Stealth / Animal Game Decoy Mode (Default FALSE: Opens directly to chats like WhatsApp!)
      isStealthModeEnabled: false,
      isStealthUnlocked: false,
      isDecoyUnlocked: false,
      isStealthNotificationsEnabled: false, // Disguises lock screen push notifications

      // Claude Animal Scene Preferences
      chatViewMode: 'claude', // 'claude'
      myCharacter: 'panda', // 'panda' | 'cat' | 'puppy'
      gameHighScore: 0, // Brick Breaker game high score
      gameMaxUnlockedLevel: 3, // Levels 1, 2, 3 unlocked by default, higher levels unlock on level up
      gameCurrentLevel: 1, // Present level player is currently playing / reached
      hasSeenAppTour: false, // Whether fresh first-time user has completed or skipped the feature tour

      // Basic usage metrics (anonymous on-device counters)
      appLaunchCount: 0,
      messagesSentCount: 0,
      callsMadeCount: 0,
      incrementLaunchCount: () => set((s) => ({ appLaunchCount: (s.appLaunchCount || 0) + 1 })),
      incrementMessagesSent: () => set((s) => ({ messagesSentCount: (s.messagesSentCount || 0) + 1 })),
      incrementCallsMade: () => set((s) => ({ callsMadeCount: (s.callsMadeCount || 0) + 1 })),

      // Actions
      setProfile: (handle, nickname, avatarId, mobileNumber = null, avatarUri = null, recoveryPin = null) =>
        set({ handle, nickname, avatarId, mobileNumber, avatarUri, recoveryPin }),

      setPendingInviteHandle: (inviteHandle) => set({ pendingInviteHandle: inviteHandle }),
      clearPendingInviteHandle: () => set({ pendingInviteHandle: null }),

      setChatViewMode: (chatViewMode) => set({ chatViewMode }),
      setMyCharacter: (myCharacter) => set({ myCharacter }),
      setGameHighScore: (score) => set((state) => ({ gameHighScore: Math.max(state.gameHighScore || 0, score) })),
      setGameMaxUnlockedLevel: (level) =>
        set((state) => ({ gameMaxUnlockedLevel: Math.max(state.gameMaxUnlockedLevel || 3, level) })),
      setGameCurrentLevel: (level) =>
        set({ gameCurrentLevel: Math.max(1, Number(level) || 1) }),
      setHasSeenAppTour: (seen) => set({ hasSeenAppTour: Boolean(seen) }),

      setRecoveryPin: (recoveryPin) => set({ recoveryPin }),

      setAvatarUri: (avatarUri) => set({ avatarUri, avatarId: avatarUri }),

      setPassword: (password) => set({ password }),

      setDefaultExpiry: (seconds) => set({ defaultExpiry: seconds }),

      // Timestamp of the most recent successful Google sign-in (ms since epoch, not persisted)
      lastSignInAt: null,
      setLastSignInAt: (ts) => set({ lastSignInAt: ts }),

      // Timestamp of when stealth was last unlocked — used for the 30-second grace period (not persisted)
      stealthUnlockedAt: null,
      setStealthUnlockedAt: (ts) => set({ stealthUnlockedAt: ts }),

      setStealthModeEnabled: (enabled) => set({ isStealthModeEnabled: enabled }),
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
          isStealthUnlocked: false,
          isDecoyUnlocked: false,
          isStealthNotificationsEnabled: false,
          chatViewMode: 'claude',
          myCharacter: 'panda',
          gameHighScore: 0,
          gameMaxUnlockedLevel: 3,
          gameCurrentLevel: 1,
          hasSeenAppTour: false,
        }),
    }),
    {
      name: 'securebox-user',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      migrate: (persistedState, version) => {
        if (!version || version < 2) {
          // Reset stealth mode default to false for existing installs
          return {
            ...persistedState,
            isStealthModeEnabled: false,
          };
        }
        return persistedState;
      },
      partialize: (state) => {
        // Do not persist in-memory transient flags (timestamps and unlock state reset on each cold start)
        const { _hasHydrated, isStealthUnlocked, isDecoyUnlocked, lastSignInAt, stealthUnlockedAt, ...rest } = state;
        return rest;
      },
    }
  )
);

// Fallback check to ensure _hasHydrated flips to true if hydration finished synchronously
if (useUserStore.persist?.hasHydrated?.()) {
  useUserStore.setState({ _hasHydrated: true });
} else {
  useUserStore.persist?.onFinishHydration?.(() => {
    useUserStore.setState({ _hasHydrated: true });
  });
}
