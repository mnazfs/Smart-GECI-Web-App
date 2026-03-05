import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildRag,
  fetchRagStatus,
  type RagStatusResponse,
} from "@/services/nlpService";
import { Database, Loader2 } from "lucide-react";

interface RagManagerProps {
  /** Whether the current user is an admin. Non-admins see status only. */
  isAdmin: boolean;
  /** Called when vectorstore_ready changes. */
  onReadyChange?: (ready: boolean) => void;
}

const IDLE_POLL = 10_000;
const BUILDING_POLL = 2_500;

const RagManager = ({ isAdmin, onReadyChange }: RagManagerProps) => {
  const [status, setStatus] = useState<RagStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buildMsg, setBuildMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const schedulePoll = useCallback((delay: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(async () => {
      try {
        const s = await fetchRagStatus();
        setStatus(s);
        onReadyChange?.(s.vectorstore_ready);

        // Switch to faster polling while building, slower when idle
        if (!s.building) {
          schedulePoll(IDLE_POLL);
        }
      } catch {
        // silently ignore status poll errors
      }
    }, delay);
  }, [onReadyChange]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const init = async () => {
      try {
        const s = await fetchRagStatus();
        setStatus(s);
        onReadyChange?.(s.vectorstore_ready);
        schedulePoll(s.building ? BUILDING_POLL : IDLE_POLL);
      } catch {
        setError("Cannot reach NLP service.");
      }
    };
    init();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBuild = async () => {
    setBuildMsg(null);
    try {
      const result = await buildRag();
      setBuildMsg(result.message);
      if (result.success) {
        schedulePoll(BUILDING_POLL);
        // Refresh immediately
        const s = await fetchRagStatus();
        setStatus(s);
      }
    } catch (e) {
      setBuildMsg(e instanceof Error ? e.message : "Build request failed.");
    }
  };

  if (error) {
    return (
      <p className="text-xs text-destructive">{error}</p>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Checking knowledge base…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Status row */}
      <div className="flex items-center gap-2 text-xs">
        <Database className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {status.vectorstore_ready ? (
          <span className="text-green-600 dark:text-green-400 font-medium">
            Knowledge base ready
          </span>
        ) : status.building ? (
          <span className="text-yellow-600 dark:text-yellow-400 font-medium">
            Building… {Math.round(status.progress)}%
          </span>
        ) : (
          <span className="text-muted-foreground">
            Knowledge base not built
          </span>
        )}
      </div>

      {/* Progress bar (visible while building) */}
      {status.building && (
        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-500 rounded-full"
            style={{ width: `${Math.min(status.progress, 100)}%` }}
          />
        </div>
      )}

      {/* Build button — admin only, hidden when ready or building */}
      {isAdmin && !status.vectorstore_ready && !status.building && (
        <button
          onClick={handleBuild}
          className="self-start flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
        >
          <Database className="h-3.5 w-3.5" />
          Build Knowledge Base
        </button>
      )}

      {/* Feedback message after requesting build */}
      {buildMsg && (
        <p className="text-xs text-muted-foreground">{buildMsg}</p>
      )}
    </div>
  );
};

export default RagManager;
