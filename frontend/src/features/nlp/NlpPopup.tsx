import { useState, useEffect } from "react";
import {
  MessageSquare,
  ChevronUp,
  ChevronDown,
  Settings,
  AlertTriangle,
  MapPin,
  Pentagon,
  History,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useNlpPopupStore } from "@/store/nlpPopupStore";
import { useMapContextStore } from "@/map-nlp/MapContextProvider";
import { useConversationStore } from "@/store/conversationStore";
import NlpServiceStatus from "@/features/nlp/NlpServiceStatus";
import RagManager from "@/features/nlp/RagManager";
import NlpChat from "@/features/nlp/NlpChat";
import ConversationSidebar from "@/features/nlp/ConversationSidebar";
import type { HealthResponse } from "@/services/nlpService";

/**
 * NlpPopup — floating GECI Assistant panel.
 *
 * Collapsed: a narrow bar at the bottom-right corner of the screen.
 *   Click it to expand.
 *
 * Expanded: a panel covering 1/3 of screen width (from the right edge)
 *   and 1/2 of screen height, anchored to the bottom-right corner.
 *   Contains a header, optional collapsible Knowledge-Base settings,
 *   and the full NlpChat widget.
 *
 * Visibility: only rendered for authenticated users.
 * The NlpServiceStatus poller is always mounted so the status dot
 * in the collapsed bar stays up-to-date without extra polling on expand.
 */
const NlpPopup = () => {
  const { isOpen, open, close } = useNlpPopupStore();
  const { role } = useAuthStore();
  const interactionMode = useMapContextStore((s) => s.interactionMode);
  const isWaiting = interactionMode !== "idle";

  // Conversation store
  const fetchConversations    = useConversationStore((s) => s.fetchConversations);
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation);

  const isAuthenticated = role !== "guest";
  const isAdmin = role === "admin";

  const [serviceOnline,  setServiceOnline]  = useState(false);
  const [ragReady,       setRagReady]       = useState(false);
  const [settingsOpen,   setSettingsOpen]   = useState(false);
  const [historyOpen,    setHistoryOpen]    = useState(false);

  // Load conversation list whenever the panel is opened
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchConversations();
    }
  }, [isOpen, isAuthenticated, fetchConversations]);

  const handleHealthChange = (health: HealthResponse | null) => {
    setServiceOnline(!!health?.success);
    setRagReady(!!health?.vector_store_ready);
  };

  const handleNewChat = async () => {
    // Clear active conversation — NlpChat will create one on first message
    setActiveConversation(null);
  };

  if (!isAuthenticated) return null;

  return (
    <>
      {/* ── Always-mounted hidden service poller ──────────────────────────── */}
      {/* Keeps serviceOnline / ragReady fresh even when the panel is closed.  */}
      <div className="hidden" aria-hidden="true">
        <NlpServiceStatus onHealthChange={handleHealthChange} />
      </div>

      {/* ── Collapsed bar ─────────────────────────────────────────────────── */}
      {!isOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Open GECI Assistant"
          onClick={open}
          onKeyDown={(e) => e.key === "Enter" && open()}
          className="
            fixed bottom-0 right-6 z-50
            flex items-center gap-2 h-10 px-4
            rounded-t-lg cursor-pointer select-none
            bg-navbar border border-border border-b-0
            text-navbar-foreground shadow-lg
            hover:opacity-90 transition-opacity
          "
        >
          <MessageSquare className="h-3.5 w-3.5 text-accent shrink-0" />
          {isWaiting ? (
            <span className="flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-blue-400">
              {interactionMode === "pick_point" ? (
                <><MapPin className="h-3 w-3" />Click map to pin…</>
              ) : (
                <><Pentagon className="h-3 w-3" />Drawing on map…</>
              )}
            </span>
          ) : (
            <span className="text-xs font-medium whitespace-nowrap">Ask GECI</span>
          )}
          <span
            className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors ${
              serviceOnline ? "bg-green-500" : "bg-red-400/80"
            }`}
            title={serviceOnline ? "Service online" : "Service offline"}
          />
          <ChevronUp className="h-3 w-3 ml-0.5 opacity-50 shrink-0" />
        </div>
      )}

      {/* ── Expanded panel ─────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className={`
            fixed bottom-0 right-0 z-50
            h-[50vh] min-h-[360px] flex flex-col
            bg-background border-l border-t border-border shadow-2xl
            overflow-hidden transition-[width] duration-200
            ${historyOpen ? "w-[52vw] min-w-[520px]" : "w-[33vw] min-w-[320px]"}
          `}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-navbar text-navbar-foreground shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="h-3.5 w-3.5 text-accent shrink-0" />
              <span className="text-sm font-semibold truncate">Ask GECI</span>
              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors ${
                  serviceOnline ? "bg-green-500" : "bg-red-400/80"
                }`}
                title={serviceOnline ? "Service online" : "Service offline"}
              />
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              {/* Chat history toggle */}
              <button
                onClick={() => setHistoryOpen((v) => !v)}
                className={`p-1.5 rounded transition-colors ${
                  historyOpen
                    ? "bg-navbar-foreground/20 text-navbar-foreground"
                    : "hover:bg-navbar-foreground/10 text-navbar-foreground/70 hover:text-navbar-foreground"
                }`}
                aria-label="Toggle chat history"
                title="Chat History"
              >
                <History className="h-3.5 w-3.5" />
              </button>

              {/* Knowledge base settings toggle */}
              <button
                onClick={() => setSettingsOpen((v) => !v)}
                className={`p-1.5 rounded transition-colors ${
                  settingsOpen
                    ? "bg-navbar-foreground/20 text-navbar-foreground"
                    : "hover:bg-navbar-foreground/10 text-navbar-foreground/70 hover:text-navbar-foreground"
                }`}
                aria-label="Toggle knowledge base settings"
                title="Knowledge Base"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>

              {/* Minimise */}
              <button
                onClick={close}
                className="p-1.5 rounded hover:bg-navbar-foreground/10 text-navbar-foreground/70 hover:text-navbar-foreground transition-colors"
                aria-label="Minimise"
                title="Minimise"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* ── Collapsible KB settings ──────────────────────────────────── */}
          {settingsOpen && (
            <div className="shrink-0 border-b border-border bg-muted/40 px-4 py-3 overflow-y-auto max-h-44">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Knowledge Base
              </p>
              {/* RagManager handles its own polling; ragReady updated via onReadyChange */}
              <RagManager isAdmin={isAdmin} onReadyChange={setRagReady} />

              {!serviceOnline && (
                <div className="mt-2 flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  NLP service is unreachable.
                </div>
              )}
            </div>
          )}

          {/* ── Body: optional sidebar + chat ────────────────────────────── */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Conversation history sidebar */}
            {historyOpen && (
              <ConversationSidebar onNewChat={handleNewChat} />
            )}

            {/* Chat area */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <NlpChat ragReady={ragReady} serviceOnline={serviceOnline} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NlpPopup;
