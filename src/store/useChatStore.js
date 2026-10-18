// src/store/useChatStore.js
// In-memory chat state — messages loaded from SQLite per conversation

import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
  // Map of conversationId -> messages[]
  conversations: {},

  // Currently open conversation
  activeConversationId: null,

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setMessages: (conversationId, messages) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [conversationId]: messages,
      },
    })),

  appendMessage: (conversationId, message) =>
    set((state) => {
      const existing = state.conversations[conversationId] || [];
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: [...existing, message],
        },
      };
    }),

  removeMessage: (conversationId, messageId) =>
    set((state) => {
      const existing = state.conversations[conversationId] || [];
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: existing.filter((m) => m.id !== messageId),
        },
      };
    }),

  clearConversation: (conversationId) =>
    set((state) => {
      const next = { ...state.conversations };
      delete next[conversationId];
      return { conversations: next };
    }),
}));
