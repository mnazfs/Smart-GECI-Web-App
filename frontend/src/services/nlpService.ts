const NLP_SERVICE_URL =
  import.meta.env.VITE_NLP_SERVICE_URL || "http://localhost:8001";

// ── Types ────────────────────────────────────────────────────────────────────

/** Spatial context attached to a RAG query (mirrors backend MapContext model). */
export interface MapContext {
  type: "point" | "polygon" | "feature" | "viewport";
  geometry: { type: string; coordinates: unknown };
  layer?: string;
  feature_id?: string;
}

// MapAction is defined in mapActionRenderer — re-exported here for convenience
export type { MapAction } from "@/map-nlp/mapActionRenderer";
import type { MapAction } from "@/map-nlp/mapActionRenderer";

/** Extended response shape for spatial-aware RAG queries. */
export interface NlpSpatialResponse {
  answer: string;
  /** Present only when map_context was supplied and spatial features were found. */
  map_actions?: MapAction[];
}

export interface HealthResponse {
  success: boolean;
  message: string;
  vector_store_ready: boolean;
}

export interface RagStatusResponse {
  building: boolean;
  progress: number;
  vectorstore_ready: boolean;
}

export interface BuildRagResponse {
  success: boolean;
  message: string;
  progress?: number;
}

export interface DbTableColumn {
  column_name: string;
  data_type: string;
}

export interface DbTable {
  table_name: string;
  table_schema: string;
  row_estimate: number;
  columns: DbTableColumn[];
  in_kb: boolean;
}

export interface DbTablesResponse {
  success: boolean;
  tables: DbTable[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Ask the NLP service a question using the RAG pipeline.
 * Returns the plain-string LLM answer.
 */
export async function askQuestion(query: string): Promise<string> {
  const response = await fetch(`${NLP_SERVICE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "rag",
      payload: { query },
    }),
  });

  if (!response.ok) {
    throw new Error(`NLP service error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.data?.error || "Query failed");
  }

  return data.data.answer as string;
}

/**
 * Ask the NLP service a question with an optional spatial map context.
 *
 * Backward-compatible: when mapContext is omitted the call is identical to
 * askQuestion() but also surfaces map_actions if the service returns them.
 *
 * @param query      Natural language question.
 * @param mapContext Optional GeoJSON-based spatial context from the Leaflet map.
 */
export async function askQuestionWithMapContext(
  query: string,
  mapContext?: MapContext
): Promise<NlpSpatialResponse> {
  const payload: Record<string, unknown> = { query };
  if (mapContext) {
    payload.map_context = mapContext;
  }

  const response = await fetch(`${NLP_SERVICE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "rag", payload }),
  });

  if (!response.ok) {
    throw new Error(`NLP service error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.data?.error || "Query failed");
  }

  return {
    answer: data.data.answer as string,
    map_actions: data.data.map_actions as MapAction[] | undefined,
  };
}

/** Poll GET /health */
export async function fetchNlpHealth(): Promise<HealthResponse> {
  const response = await fetch(`${NLP_SERVICE_URL}/health`);
  if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
  return response.json();
}

/** Poll GET /rag-status */
export async function fetchRagStatus(): Promise<RagStatusResponse> {
  const response = await fetch(`${NLP_SERVICE_URL}/rag-status`);
  if (!response.ok)
    throw new Error(`RAG status check failed: ${response.status}`);
  return response.json();
}

/** GET /db-tables — list all available database tables */
export async function fetchDbTables(): Promise<DbTablesResponse> {
  const response = await fetch(`${NLP_SERVICE_URL}/db-tables`);
  if (!response.ok)
    throw new Error(`Fetch tables failed: ${response.status}`);
  return response.json();
}

/**
 * GET /api/kb/tables — list every user-accessible table across ALL non-system
 * schemas (not just 'public').  Use this in the Knowledge Base tab so that
 * application tables (users, feedback, layer_registry, …) appear alongside
 * the PostGIS spatial tables.
 */
export async function fetchAllDbTables(): Promise<DbTablesResponse> {
  const response = await fetch(`${NLP_SERVICE_URL}/api/kb/tables`);
  if (!response.ok)
    throw new Error(`Fetch all tables failed: ${response.status}`);
  return response.json();
}

/** POST /build-rag — start building the knowledge base */
export async function buildRag(
  selectedTables?: string[]
): Promise<BuildRagResponse> {
  const response = await fetch(`${NLP_SERVICE_URL}/build-rag`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selected_tables: selectedTables ?? [] }),
  });
  if (!response.ok)
    throw new Error(`Build RAG request failed: ${response.status}`);
  return response.json();
}

/** POST /rag/add-table — incrementally add a single table to the knowledge base */
export async function addTableToKB(
  tableName: string
): Promise<{ success: boolean; message: string; added_docs?: number }> {
  const response = await fetch(`${NLP_SERVICE_URL}/rag/add-table`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table_name: tableName }),
  });
  if (!response.ok) {
    // Surface the detail message from FastAPI 400 responses
    let detail = `Add table request failed: ${response.status}`;
    try {
      const err = await response.json();
      if (err.detail) detail = err.detail;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return response.json();
}
