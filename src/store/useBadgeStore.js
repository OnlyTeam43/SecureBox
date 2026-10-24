// src/store/useBadgeStore.js
import { create } from 'zustand';
import {
  getTotalUnreadMessagesCount,
  getUnseenMissedCallsCount,
} from '../db/database';

export const useBadgeStore = create((set, get) => ({
  unreadMessagesCount: 0,
  pendingRequestsCount: 0,
  missedCallsCount: 0,
  inAppNotification: null,

  setUnreadMessagesCount: (count) => set({ unreadMessagesCount: Math.max(0, Number(count) || 0) }),
  setPendingRequestsCount: (count) => set({ pendingRequestsCount: Math.max(0, Number(count) || 0) }),
  setMissedCallsCount: (count) => set({ missedCallsCount: Math.max(0, Number(count) || 0) }),

  decrementUnread: (count = 1) => {
    set((state) => ({
      unreadMessagesCount: Math.max(0, state.unreadMessagesCount - (Number(count) || 1)),
    }));
  },

  showInAppNotification: () => {},

  clearInAppNotification: () => {},

  refreshBadges: async (myHandle) => {
    try {
      const [unreadMsgs, unseenCalls] = await Promise.all([
        getTotalUnreadMessagesCount().catch(() => 0),
        getUnseenMissedCallsCount().catch(() => 0),
      ]);

      set({
        unreadMessagesCount: Number(unreadMsgs) || 0,
        missedCallsCount: Number(unseenCalls) || 0,
        pendingRequestsCount: 0,
      });
    } catch (err) {
      console.warn('refreshBadges error:', err);
    }
  },
}));
