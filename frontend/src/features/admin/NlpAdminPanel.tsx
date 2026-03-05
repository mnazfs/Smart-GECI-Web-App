import { useEffect, useRef, useState } from "react";
import {
  buildRag,
  fetchRagStatus,
  fetchNlpHealth,
  type RagStatusResponse,
} from "@/services/nlpService";
import { Database, Loader2, RefreshCw, Wifi, WifiOff } from "lucide-react";

const IDLE_POLL = 10_000;
const BUILDING_POLL = 2_500;

const NlpAdminPanel = () => {
  const [status, setStatus] = useState<RagStatusResponse | null>(null);
  const [serviceOnline, setServiceOnline] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [buildMsg, setBuildMsg] = useState<string | null>(null);
  const [buildMsgType, setBuildMsgType] = useState<"success" | "error" | "info">("info");
  const [building, setBuilding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const schedulePoll = (delay: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(async () => {
      try {
        const s = await fetchRagStatus();
        setStatus(s);
        if (!s.building && timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = setInterval(async () => {
            try {
              setStatus(await fetchRagStatus());
            } catch { /* ignore */ }
          }, IDLE_POLL);
        }
      } catch { /* ignore */ }
    }, delay);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const [health, s] = await Promise.all([fetchNlpHealth(), fetchRagStatus()]);
        setServiceOnline(health.success);
        setStatus(s);
        schedulePoll(s.building ? BUILDING_POLL : IDLE_POLL);
      } catch {
        setServiceOnline(false);
        setStatusError("NLP service is unreachable.");
      }
    };
    init();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBuild = async () => {
    setBuildMsg(null);
    setBuilding(true);
    try {
      const result = await buildRag();
      setBuildMsg(result.message);
      setBuildMsgType(result.success ? "success" : "info");
      if (result.success) {
        const s = await fetchRagStatus();
        setStatus(s);
        schedulePoll(BUILDING_POLL);
      }
    } catch (e) {
      setBuildMsg(e instanceof Error ? e.message : "Build request failed.");
      setBuildMsgType("error");
    } finally {
      setBuilding(false);
    }
  };

  const isBuilding = status?.building ?? false;
  const progress = status?.progress ?? 0;
  const isReady = status?.vectorstore_ready ?? false;

  return (
    <div className="space-y-6">
      {/* Service health */}
      <div className="flex items-center gap-2">
        {serviceOnline === null ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : serviceOnline ? (
          <Wifi className="h-4 w-4 text-green-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-destructive" />
        )}
        <span className="text-sm font-medium text-foreground">
          NLP Service:{" "}
          <span
            className={
              serviceOnline === null
                ? "text-muted-foreground"
                : serviceOnline
                ? "text-green-600 dark:text-green-400"
                : "text-destructive"
            }
          >
            {serviceOnline === null ? "Checking…" : serviceOnline ? "Online" : "Offline"}
          </span>
        </span>
      </div>

      {/* Knowledge base status */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Knowledge Base</span>
          </div>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              isReady
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : isBuilding
                ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isReady ? "Ready" : isBuilding ? `Building ${Math.round(progress)}%` : "Not built"}
          </span>
        </div>

        {/* Progress bar */}
        {isBuilding && (
          <div className="space-y-1">
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Building knowledge base… {Math.round(progress)}% — please wait
            </p>
          </div>
        )}

        {statusError && (
          <p className="text-xs text-destructive">{statusError}</p>
        )}
      </div>

      {/* Build / Rebuild button */}
      <div className="space-y-2">
        <button
          onClick={handleBuild}
          disabled={building || isBuilding || !serviceOnline}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {building || isBuilding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isReady ? "Rebuild Knowledge Base" : "Build Knowledge Base"}
        </button>
        <p className="text-xs text-muted-foreground">
          {isReady
            ? "Rebuilds the vector store from the latest knowledge files."
            : "Indexes the knowledge files so the GECI Assistant can answer questions."}
        </p>
      </div>

      {/* Feedback after build request */}
      {buildMsg && (
        <div
          className={`px-3 py-2 rounded-md text-xs ${
            buildMsgType === "error"
              ? "bg-destructive/10 text-destructive"
              : buildMsgType === "success"
              ? "bg-green-500/10 text-green-700 dark:text-green-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {buildMsg}
        </div>
      )}
    </div>
  );
};

export default NlpAdminPanel;
