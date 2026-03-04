import axios, { AxiosError } from 'axios';
import { env } from '../config/env';
import { LayerRepository } from '../repositories/layerRepository';
import type { Layer } from '../models/layer';

// ─── GeoServer REST API shapes ────────────────────────────────────────────────

interface GeoServerLayerRef {
  name: string;
  href: string;
}

interface GeoServerLayersResponse {
  layers:
    | { layer: GeoServerLayerRef[] }
    | ''          // GeoServer returns empty string when workspace has no layers
    | null
    | undefined;
}

// ─── Axios instance ───────────────────────────────────────────────────────────

const geoserverClient = axios.create({
  baseURL: env.GEOSERVER_URL,
  timeout: 15_000,
  auth: {
    username: env.GEOSERVER_USER,
    password: env.GEOSERVER_PASSWORD,
  },
  headers: {
    Accept: 'application/json',
  },
});

// ─── Result types ─────────────────────────────────────────────────────────────

export interface SyncResult {
  workspace:    string;
  total:        number;  // layers returned by GeoServer
  inserted:     number;  // newly added to layer_registry
  skipped:      number;  // already existed — not touched
  layers:       Layer[]; // the newly inserted Layer records
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Fetches all layer names from a GeoServer workspace via the REST API.
 *
 * GET /rest/workspaces/{workspace}/layers
 *
 * Returns a deduplicated list of "<workspace>:<layerName>" strings
 * (the format GeoServer uses as WMS layer names).
 */
async function fetchGeoServerLayerNames(workspace: string): Promise<string[]> {
  const url = `/rest/workspaces/${encodeURIComponent(workspace)}/layers`;

  const response = await geoserverClient.get<GeoServerLayersResponse>(url);
  const body = response.data;

  // GeoServer returns `{ layers: '' }` (falsy) when there are no layers
  if (!body.layers) return [];

  const refs = body.layers.layer;
  if (!refs || refs.length === 0) return [];

  // Each ref.name is already "<workspace>:<layerName>"
  return [...new Set(refs.map(r => r.name))];
}

/**
 * Derives a human-readable display name from a GeoServer layer identifier.
 *
 * "smart_geci:main_building" → "Main Building"
 */
function toDisplayName(geoserverName: string): string {
  const localName = geoserverName.includes(':')
    ? geoserverName.split(':')[1]!
    : geoserverName;

  return localName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ─── syncWorkspaceLayers ─────────────────────────────────────────────────────

/**
 * Pulls all layers from the given GeoServer workspace and registers any
 * unknown ones in `layer_registry`.
 *
 * Rules:
 * - Existing rows (matched by geoserver_name) are left untouched.
 * - New rows are inserted with: parent_id = NULL, restricted = false.
 * - Returns a full SyncResult so the caller can surface counts to the client.
 *
 * Throws an AppError-compatible Error (re-thrown with context) so the
 * Express error handler can respond with the correct HTTP status.
 */
export async function syncWorkspaceLayers(workspace: string): Promise<SyncResult> {
  // ── 1. Fetch layer names from GeoServer ────────────────────────────────
  let geoserverNames: string[];
  try {
    geoserverNames = await fetchGeoServerLayerNames(workspace);
  } catch (err) {
    const message = buildGeoServerErrorMessage(err, workspace);
    throw new Error(message);
  }

  // ── 2. For each layer: check existence, insert if new ──────────────────
  const inserted: Layer[] = [];
  let skipped = 0;

  for (const geoserverName of geoserverNames) {
    const existing = await LayerRepository.findByGeoserverName(geoserverName);

    if (existing !== null) {
      skipped++;
      continue;
    }

    const newLayer = await LayerRepository.insertLayer({
      name:          toDisplayName(geoserverName),
      geoserverName: geoserverName,
      parentId:      null,
      restricted:    false,
      visible:       true,
    });

    inserted.push(newLayer);
  }

  return {
    workspace,
    total:    geoserverNames.length,
    inserted: inserted.length,
    skipped,
    layers:   inserted,
  };
}

// ─── error helpers ────────────────────────────────────────────────────────────

function buildGeoServerErrorMessage(err: unknown, workspace: string): string {
  if (err instanceof AxiosError) {
    const status = err.response?.status;

    if (status === 401 || status === 403) {
      return `GeoServer authentication failed (${status}). Check GEOSERVER_USER / GEOSERVER_PASSWORD.`;
    }
    if (status === 404) {
      return `GeoServer workspace "${workspace}" not found (404). Verify GEOSERVER_DEFAULT_WORKSPACE.`;
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return `Cannot reach GeoServer at ${env.GEOSERVER_URL}. Verify GEOSERVER_URL and that GeoServer is running.`;
    }
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
      return `GeoServer request timed out for workspace "${workspace}".`;
    }
    return `GeoServer API error: ${err.message}`;
  }

  return err instanceof Error
    ? `Unexpected error syncing GeoServer layers: ${err.message}`
    : `Unexpected error syncing GeoServer layers.`;
}
