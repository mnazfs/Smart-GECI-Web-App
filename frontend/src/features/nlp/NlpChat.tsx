import { useRef, useState } from "react";
import { askQuestion } from "@/services/nlpService";
import { Send, Loader2, AlertTriangle } from "lucide-react";

const RAG_NOT_READY_MSG =
  "Knowledge base not initialized. Please build RAG from admin panel.";

interface Message {
  id: number;
  role: "user" | "assistant" | "warning" | "error";
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
      const answer = await askQuestion(trimmed);

      if (answer === RAG_NOT_READY_MSG) {
        addMessage({ role: "warning", text: answer });
      } else {
        addMessage({ role: "assistant", text: answer });
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
