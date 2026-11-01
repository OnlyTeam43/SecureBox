// src/store/useBadgeStore.js  (REPLACES the old file)
import { create } from 'zustand';
import { getTotalUnreadMessagesCount, getUnseenMissedCallsCount } from '../db/database';
import { playInAppPing } from '../services/inAppPing';

export const useBadgeStore = create((set) => ({
  unreadMessagesCount: 0,
  pendingRequestsCount: 0,
  missedCallsCount: 0,
  pingTick: 0, // goes up by 1 on every in-app notification; the game icon pulses when it changes

  setUnreadMessagesCount: (count) => set({ unreadMessagesCount: Math.max(0, Number(count) || 0) }),
  setPendingRequestsCount: (count) => set({ pendingRequestsCount: Math.max(0, Number(count) || 0) }),
  setMissedCallsCount: (count) => set({ missedCallsCount: Math.max(0, Number(count) || 0) }),

  decrementUnread: (count = 1) =>
    set((s) => ({ unreadMessagesCount: Math.max(0, s.unreadMessagesCount - (Number(count) || 1)) })),

  // Sound + game icon pulse. This used to be an empty function.
  showInAppNotification: () => {
    playInAppPing();
    set((s) => ({ pingTick: s.pingTick + 1 }));
  },
  clearInAppNotification: () => {},

  refreshBadges: async () => {
    try {
      const [unreadMsgs, unseenCalls] = await Promise.all([
        getTotalUnreadMessagesCount().catch(() => 0),
        getUnseenMissedCallsCount().catch(() => 0),
      ]);
      set({
        unreadMessagesCount: Number(unreadMsgs) || 0,
        missedCallsCount: Number(unseenCalls) || 0,
      });
    } catch (err) {
      console.warn('refreshBadges error:', err);
    }
  },
}));
