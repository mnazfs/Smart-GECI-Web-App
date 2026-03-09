import { useState } from "react";
import { MessageSquarePlus, Trash2, MessageSquare, Loader2 } from "lucide-react";
import { useConversationStore } from "@/store/conversationStore";

/** Format a date string as a human-readable relative label */
function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return "Just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface ConversationSidebarProps {
  onNewChat: () => void;
}

const ConversationSidebar = ({ onNewChat }: ConversationSidebarProps) => {
  const conversations        = useConversationStore((s) => s.conversations);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const loading              = useConversationStore((s) => s.loading);
  const setActive            = useConversationStore((s) => s.setActiveConversation);
  const remove               = useConversationStore((s) => s.removeConversation);

  const [hoveredId,  setHoveredId]  = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await remove(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full w-52 shrink-0 border-r border-border bg-muted/20">
      {/* New chat button */}
      <button
        onClick={onNewChat}
        className="flex items-center gap-2 mx-3 mt-3 mb-2 px-3 py-2 rounded-md text-xs font-medium bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
      >
        <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />
        New Chat
      </button>

      <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        History
      </p>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            No conversations yet.
          </p>
        )}

        {conversations.map((conv) => {
          const isActive  = conv.id === activeConversationId;
          const isHovered = conv.id === hoveredId;

          return (
            <button
              key={conv.id}
              onClick={() => setActive(conv.id)}
              onMouseEnter={() => setHoveredId(conv.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`group w-full flex items-start gap-2 px-3 py-2 text-left transition-colors ${
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-60" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate leading-tight">
                  {conv.title}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {relativeDate(conv.updatedAt)}
                </p>
              </div>

              {/* Delete button — visible on hover */}
              {(isHovered || isActive) && (
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  disabled={deletingId === conv.id}
                  className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Delete conversation"
                >
                  {deletingId === conv.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ConversationSidebar;
