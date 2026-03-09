import { create } from "zustand";
import {
  getConversations,
  createConversation,
  deleteConversation,
  renameConversation,
} from "@/services/conversationService";
import type { ConversationSummary } from "@/services/conversationService";

interface ConversationState {
  /** Full list of the user's conversations, newest first */
  conversations: ConversationSummary[];
  /** ID of the currently open conversation, or null for a fresh unsaved chat */
  activeConversationId: string | null;
  /** True while the list is being fetched */
  loading: boolean;

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Load (or refresh) the full conversation list from the API */
  fetchConversations: () => Promise<void>;

  /** Switch to an existing conversation (by ID) or a blank chat (null) */
  setActiveConversation: (id: string | null) => void;

  /**
   * Create a new conversation on the server, prepend it to the list,
   * and set it as active.  Returns the new conversation ID.
   */
  createNew: (title?: string) => Promise<string>;

  /** Permanently delete a conversation from the server and the list */
  removeConversation: (id: string) => Promise<void>;

  /** Update the title of an existing conversation in place */
  updateTitle: (id: string, title: string) => Promise<void>;

  /**
   * Optimistically update the updatedAt timestamp for the active conversation
   * so it stays at the top of the list after a new message is sent.
   */
  bumpConversation: (id: string) => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations:        [],
  activeConversationId: null,
  loading:              false,

  fetchConversations: async () => {
    set({ loading: true });
    try {
      const conversations = await getConversations();
      set({ conversations, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  createNew: async (title) => {
    const conv = await createConversation(title);
    set((s) => ({
      conversations:        [conv, ...s.conversations],
      activeConversationId: conv.id,
    }));
    return conv.id;
  },

  removeConversation: async (id) => {
    await deleteConversation(id);
    set((s) => {
      const conversations = s.conversations.filter((c) => c.id !== id);
      const activeConversationId =
        s.activeConversationId === id
          ? (conversations[0]?.id ?? null)
          : s.activeConversationId;
      return { conversations, activeConversationId };
    });
  },

  updateTitle: async (id, title) => {
    const updated = await renameConversation(id, title);
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? updated : c,
      ),
    }));
  },

  bumpConversation: (id) => {
    const now = new Date().toISOString();
    set((s) => {
      const updated = s.conversations.map((c) =>
        c.id === id ? { ...c, updatedAt: now } : c,
      );
      // re-sort by updatedAt DESC
      updated.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      return { conversations: updated };
    });
  },
}));
