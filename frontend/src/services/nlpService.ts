const NLP_SERVICE_URL =
  import.meta.env.VITE_NLP_SERVICE_URL || "http://localhost:8001";

// ── Types ────────────────────────────────────────────────────────────────────

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

/** POST /build-rag — start building the knowledge base */
export async function buildRag(): Promise<BuildRagResponse> {
  const response = await fetch(`${NLP_SERVICE_URL}/build-rag`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok)
    throw new Error(`Build RAG request failed: ${response.status}`);
  return response.json();
}
