import { useRef, useState } from "react";
import { askQuestionWithMapContext } from "@/services/nlpService";
import { useMapContextStore } from "@/map-nlp/MapContextProvider";
import { useNlpPopupStore } from "@/store/nlpPopupStore";
import { useNlpMapStore } from "@/store/nlpMapStore";
import { Send, Loader2, AlertTriangle, MapPin, Pentagon, X } from "lucide-react";

const RAG_NOT_READY_MSG =
  "Knowledge base not initialized. Please build RAG from admin panel.";

interface Message {
  id: number;
  role: "user" | "assistant" | "warning" | "error" | "spatial_info";
  text: string;
}

interface NlpChatProps {
  /** Disable input and show a blocking message when RAG is not ready. */
  ragReady: boolean;
  /** Whether the service is reachable at all. */
  serviceOnline: boolean;
}

const NlpChat = ({ ragReady, serviceOnline }: NlpChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const nextId = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Map-context store
  const mapContext = useMapContextStore((s) => s.mapContext);
  const interactionMode = useMapContextStore((s) => s.interactionMode);
  const clearMapContext = useMapContextStore((s) => s.clearMapContext);
  const setInteractionMode = useMapContextStore((s) => s.setInteractionMode);

  // Popup store — used to minimise the panel so the user can interact with map
  const closePopup = useNlpPopupStore((s) => s.close);

  // NLP map actions
  const setPendingActions = useNlpMapStore((s) => s.setPendingActions);

  // Label for the captured context chip
  const contextLabel = (() => {
    if (!mapContext) return null;
    if (mapContext.type === "polygon") return "Polygon area";
    if (mapContext.type === "point") {
      const [lng, lat] = mapContext.geometry.coordinates as [number, number];
      return `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
    }
    return mapContext.type;
  })();

  const handleStartPickPoint = () => {
    setInteractionMode("pick_point");
    closePopup(); // minimise so the map is fully accessible
  };

  const handleStartDrawPolygon = () => {
    setInteractionMode("draw_polygon");
    closePopup();
  };

  const handleCancelInteraction = () => {
    setInteractionMode("idle");
  };

  const addMessage = (msg: Omit<Message, "id">) => {
    const id = ++nextId.current;
    setMessages((prev) => [...prev, { ...msg, id }]);
    // Scroll to bottom after render
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      50
    );
    return id;
  };

  const disabled = loading || !ragReady || !serviceOnline;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || disabled) return;

    setQuery("");
    addMessage({ role: "user", text: trimmed });
    setLoading(true);

    try {
      // Use the spatially captured context (if any) from the store
      const result = await askQuestionWithMapContext(trimmed, mapContext ?? undefined);

      if (result.answer === RAG_NOT_READY_MSG) {
        addMessage({ role: "warning", text: result.answer });
      } else {
        addMessage({ role: "assistant", text: result.answer });
      }

      // Handle spatial map actions
      if (result.map_actions && result.map_actions.length > 0) {
        setPendingActions(result.map_actions);
        addMessage({
          role: "spatial_info",
          text: `📍 ${result.map_actions.filter((a) => a.type === "highlight" || a.type === "draw_geometry").length > 0 ? "Spatial results found" : "Spatial context used"}. Navigate to the map to see them highlighted.`,
        });
      }
    } catch (err) {
      addMessage({
        role: "error",
        text:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center mt-8">
            Ask a question about GECI data…
          </p>
        )}

        {messages.map((msg) => {
          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[80%] px-3 py-2 rounded-lg bg-accent text-accent-foreground text-sm">
                  {msg.text}
                </div>
              </div>
            );
          }

          if (msg.role === "assistant") {
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[80%] px-3 py-2 rounded-lg bg-muted text-foreground text-sm whitespace-pre-wrap">
                  {msg.text}
                </div>
              </div>
            );
          }

          if (msg.role === "warning") {
            return (
              <div
                key={msg.id}
                className="flex items-start gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-sm"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {msg.text}
              </div>
            );
          }

          if (msg.role === "spatial_info") {
            return (
              <div
                key={msg.id}
                className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {msg.text}
              </div>
            );
          }

          // error
          return (
            <div
              key={msg.id}
              className="px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm"
            >
              {msg.text}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Thinking… (this may take up to 20 seconds)
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Map context toolbar — only shown when service is online */}
      {serviceOnline && (
        <div className="shrink-0 border-t border-border px-3 py-2 bg-muted/20">

          {/* Active-mode banner */}
          {interactionMode !== "idle" && (
            <div className="flex items-center justify-between mb-2 px-2.5 py-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs">
              <span className="flex items-center gap-1.5">
                {interactionMode === "pick_point" ? (
                  <>
                    <MapPin className="h-3 w-3 shrink-0" />
                    Click a point on the map…
                  </>
                ) : (
                  <>
                    <Pentagon className="h-3 w-3 shrink-0" />
                    Click to add vertices, double&#8209;click to finish…
                  </>
                )}
              </span>
              <button
                onClick={handleCancelInteraction}
                className="ml-2 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                aria-label="Cancel"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Captured context chip */}
          {mapContext && interactionMode === "idle" && (
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${
                mapContext.type === "polygon"
                  ? "bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-500/30"
                  : "bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-blue-500/30"
              }`}>
                {mapContext.type === "polygon" ? (
                  <Pentagon className="h-3 w-3 shrink-0" />
                ) : (
                  <MapPin className="h-3 w-3 shrink-0" />
                )}
                {contextLabel}
              </span>
              <button
                onClick={clearMapContext}
                title="Clear context"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Pick / Draw buttons */}
          {interactionMode === "idle" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartPickPoint}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <MapPin className="h-3 w-3" />
                Pin point
              </button>
              <button
                type="button"
                onClick={handleStartDrawPolygon}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Pentagon className="h-3 w-3" />
                Draw area
              </button>
            </div>
          )}
        </div>
      )}

      {/* Disabled overlay message */}
      {(!ragReady || !serviceOnline) && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-md bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-xs flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {!serviceOnline
            ? "NLP service is offline. Chat is unavailable."
            : "Knowledge base is not ready. Please build it from settings."}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-4 pb-4"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          placeholder={
            !serviceOnline
              ? "Service offline"
              : !ragReady
              ? "Knowledge base not ready"
              : "Type your question…"
          }
          className="flex-1 px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={disabled || !query.trim()}
          className="p-2 rounded-md bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};

export default NlpChat;
