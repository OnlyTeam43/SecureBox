// src/store/useBadgeStore.js
import { create } from 'zustand';
import {
  getTotalUnreadMessagesCount,
  getUnseenMissedCallsCount,
} from '../db/database';
import { fetchPendingConnectionRequests } from '../services/supabase';

export const useBadgeStore = create((set, get) => ({
  unreadMessagesCount: 0,
  pendingRequestsCount: 0,
  missedCallsCount: 0,
  inAppNotification: null,

  setUnreadMessagesCount: (count) => set({ unreadMessagesCount: count || 0 }),
  setPendingRequestsCount: (count) => set({ pendingRequestsCount: count || 0 }),
  setMissedCallsCount: (count) => set({ missedCallsCount: count || 0 }),

  showInAppNotification: (notification) => {
    set({ inAppNotification: notification });
  },

  clearInAppNotification: () => {
    set({ inAppNotification: null });
  },

  refreshBadges: async (myHandle) => {
    try {
      const [unreadMsgs, unseenCalls] = await Promise.all([
        getTotalUnreadMessagesCount().catch(() => 0),
        getUnseenMissedCallsCount().catch(() => 0),
      ]);

      let pendingReqs = get().pendingRequestsCount;
      if (myHandle) {
        try {
          const reqs = await fetchPendingConnectionRequests(myHandle);
          pendingReqs = Array.isArray(reqs) ? reqs.length : 0;
        } catch (_) {}
      }

      set({
        unreadMessagesCount: Number(unreadMsgs) || 0,
        missedCallsCount: Number(unseenCalls) || 0,
        pendingRequestsCount: Number(pendingReqs) || 0,
      });
    } catch (err) {
      console.warn('refreshBadges error:', err);
    }
  },
}));
