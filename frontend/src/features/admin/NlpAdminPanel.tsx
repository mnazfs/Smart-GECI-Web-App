import { useEffect, useRef, useState } from "react";
import {
  buildRag,
  fetchRagStatus,
  fetchNlpHealth,
  fetchAllDbTables,
  addTableToKB,
  type RagStatusResponse,
  type DbTable,
} from "@/services/nlpService";
import { CheckCircle2, CircleDashed, Database, Loader2, PlusCircle, RefreshCw, Wifi, WifiOff, Table2, AlertCircle } from "lucide-react";

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

  // Table selection state
  const [dbTables, setDbTables] = useState<DbTable[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);

  // Incremental add state
  const [addingToKB, setAddingToKB] = useState(false);
  const [addTableMsg, setAddTableMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

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

  const loadTables = async () => {
    setTablesLoading(true);
    setTablesError(null);
    try {
      const result = await fetchAllDbTables();
      setDbTables(result.tables);
      // Pre-select all tables by default
      setSelectedTables(new Set(result.tables.map((t) => t.table_name)));
    } catch (e) {
      setTablesError(e instanceof Error ? e.message : "Failed to fetch tables.");
    } finally {
      setTablesLoading(false);
    }
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
    loadTables();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBuild = async () => {
    setBuildMsg(null);
    setBuilding(true);
    // Clear incremental msg when a full rebuild starts
    setAddTableMsg(null);
    try {
      const result = await buildRag(Array.from(selectedTables));
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

  const toggleTable = (name: string) => {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedTables.size === dbTables.length) {
      setSelectedTables(new Set());
    } else {
      setSelectedTables(new Set(dbTables.map((t) => t.table_name)));
    }
  };

  // Selected tables that are not yet in the KB
  const selectedNotInKB = dbTables.filter(
    (t) => selectedTables.has(t.table_name) && !t.in_kb
  );

  const handleAddSelectedToKB = async () => {
    if (selectedNotInKB.length === 0) return;
    setAddTableMsg(null);
    setAddingToKB(true);
    let added = 0;
    let lastError: string | null = null;
    for (const table of selectedNotInKB) {
      try {
        await addTableToKB(table.table_name);
        added++;
      } catch (e) {
        lastError = e instanceof Error ? e.message : `Failed to add ${table.table_name}.`;
      }
    }
    // Refresh so badges update
    await loadTables();
    if (added > 0 && !lastError) {
      setAddTableMsg({
        text: `${added} table${added !== 1 ? "s" : ""} added to the knowledge base.`,
        type: "success",
      });
    } else if (added > 0 && lastError) {
      setAddTableMsg({
        text: `${added} table${added !== 1 ? "s" : ""} added. Some failed: ${lastError}`,
        type: "error",
      });
    } else {
      setAddTableMsg({ text: lastError ?? "Failed to add tables.", type: "error" });
    }
    setAddingToKB(false);
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

      {/* Database table selection */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Database Tables</span>
          </div>
          <div className="flex items-center gap-2">
            {tablesLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            {!tablesLoading && (
              <button
                onClick={loadTables}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Refresh table list"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Select which database tables to include when building the knowledge base.
        </p>

        {tablesError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-xs">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {tablesError}
          </div>
        )}

        {!tablesError && dbTables.length > 0 && (
          <div className="space-y-2">
            {/* Select all toggle */}
            <label className="flex items-center gap-2 cursor-pointer pb-1 border-b border-border">
              <input
                type="checkbox"
                className="rounded border-border accent-accent h-3.5 w-3.5"
                checked={selectedTables.size === dbTables.length && dbTables.length > 0}
                onChange={toggleAll}
              />
              <span className="text-xs font-medium text-foreground">
                Select all ({dbTables.length} tables)
              </span>
            </label>

            {/* Table list */}
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {dbTables.map((table) => (
                <label
                  key={table.table_name}
                  className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="rounded border-border accent-accent h-3.5 w-3.5 flex-shrink-0"
                    checked={selectedTables.has(table.table_name)}
                    onChange={() => toggleTable(table.table_name)}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium text-foreground truncate block">
                      {table.table_name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {table.columns.length} columns
                      {table.row_estimate > 0 && ` · ~${table.row_estimate.toLocaleString()} rows`}
                    </span>
                  </div>

                  {/* KB status badge */}
                  {table.in_kb ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 flex-shrink-0">
                      <CheckCircle2 className="h-3 w-3" />
                      Added to KB
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground flex-shrink-0">
                      <CircleDashed className="h-3 w-3" />
                      Not Added
                    </span>
                  )}
                </label>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground pt-1">
              {selectedTables.size} of {dbTables.length} tables selected
            </p>
          </div>
        )}

        {!tablesError && !tablesLoading && dbTables.length === 0 && (
          <p className="text-xs text-muted-foreground">No tables found in the database.</p>
        )}
      </div>

      {/* Build / Rebuild + Add to KB buttons */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleBuild}
            disabled={building || isBuilding || !serviceOnline || selectedTables.size === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {building || isBuilding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isReady ? "Rebuild Knowledge Base" : "Build Knowledge Base"}
          </button>

          {/* Incremental add — only enabled when KB exists and there are selected non-indexed tables */}
          <button
            onClick={handleAddSelectedToKB}
            disabled={addingToKB || isBuilding || building || !serviceOnline || !isReady || selectedNotInKB.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-accent text-accent hover:bg-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addingToKB ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="h-4 w-4" />
            )}
            {addingToKB ? "Adding…" : "Add to KB"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {selectedTables.size === 0
            ? "Select at least one table to build the knowledge base."
            : isReady
            ? selectedNotInKB.length > 0
              ? `${selectedNotInKB.length} selected table(s) not yet in KB. Use "Add to KB" to append without rebuilding.`
              : `All selected tables are already in the knowledge base. Use "Rebuild" to re-index.`
            : `Indexes ${selectedTables.size} selected table(s) so the GECI Assistant can answer questions.`}
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

      {/* Feedback after incremental add-table */}
      {addTableMsg && (
        <div
          className={`px-3 py-2 rounded-md text-xs ${
            addTableMsg.type === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-green-500/10 text-green-700 dark:text-green-400"
          }`}
        >
          {addTableMsg.text}
        </div>
      )}
    </div>
  );
};

export default NlpAdminPanel;
