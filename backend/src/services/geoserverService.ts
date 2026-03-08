import axios, { AxiosError } from 'axios';
import { env } from '../config/env';
import { LayerRepository } from '../repositories/layerRepository';
import type { Layer } from '../models/layer';

// ─── GeoServer REST API shapes ────────────────────────────────────────────────

interface GeoServerLayerRef {
  name: string;
  href: string;
}

interface GeoServerFeatureTypesResponse {
  featureTypes:
    | { featureType: GeoServerLayerRef[] }
    | ''
    | null
    | undefined;
}

interface GeoServerFeatureTypeResponse {
  featureType: {
    name:       string;
    nativeName: string;
    title:      string;
  };
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
 * Fetches all feature type names from a specific GeoServer datastore via
 * the REST API.
 *
 * GET /rest/workspaces/{workspace}/datastores/{store}/featuretypes
 *
 * Returns a deduplicated list of "<workspace>:<layerName>" strings
 * (the format GeoServer uses as WMS layer names).
 */
async function fetchGeoServerLayerNames(workspace: string, store: string): Promise<string[]> {
  const url =
    `/rest/workspaces/${encodeURIComponent(workspace)}/datastores/${encodeURIComponent(store)}/featuretypes`;

  const response = await geoserverClient.get<GeoServerFeatureTypesResponse>(url);
  const body = response.data;

  // GeoServer returns `{ featureTypes: '' }` (falsy) when there are no layers
  if (!body.featureTypes) return [];

  const refs = body.featureTypes.featureType;
  if (!refs || refs.length === 0) return [];

  // ref.name is the local layer name; prefix with workspace for WMS usage
  return [...new Set(refs.map(r =>
    r.name.includes(':') ? r.name : `${workspace}:${r.name}`
  ))];
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
  const store = env.GEOSERVER_DATASTORE;

  // ── 1. Fetch layer names from GeoServer ────────────────────────────────
  let geoserverNames: string[];
  try {
    geoserverNames = await fetchGeoServerLayerNames(workspace, store);
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

// ─── fetchWfsFeatures ───────────────────────────────────────────────────────

/**
 * Fetches GeoJSON features for a layer from GeoServer WFS.
 *
 * Uses the existing authenticated geoserverClient so no extra credentials
 * are needed. The response is returned as a parsed JS object (GeoJSON
 * FeatureCollection) and forwarded directly to the browser by the controller.
 *
 * @param layerName - The GeoServer layer name (e.g. "smart_geci:CSE")
 */
export async function fetchWfsFeatures(layerName: string): Promise<unknown> {
  const response = await geoserverClient.get('/ows', {
    params: {
      service:      'WFS',
      version:      '2.0.0',
      request:      'GetFeature',
      typeName:     layerName,
      outputFormat: 'application/json',
    },
    // GeoServer returns JSON — don't treat it as application/json by default
    // when the response Content-Type might be text/plain; force JSON parse.
    responseType: 'json',
  });
  return response.data;
}

// ─── fetchGetFeatureInfo ───────────────────────────────────────────────────────

export interface GetFeatureInfoParams {
  layers: string;
  bbox: string;
  width: number;
  height: number;
  x: number;
  y: number;
  srs?: string;
}

/**
 * Issues a WMS GetFeatureInfo request to GeoServer and returns the parsed
 * GeoJSON FeatureCollection. Runs server-side so the browser is never
 * exposed to a cross-origin request.
 */
export async function fetchGetFeatureInfo(
  params: GetFeatureInfoParams,
): Promise<unknown> {
  const response = await geoserverClient.get('/wms', {
    params: {
      service:      'WMS',
      version:      '1.1.1',
      request:      'GetFeatureInfo',
      layers:       params.layers,
      query_layers: params.layers,
      srs:          params.srs ?? 'EPSG:4326',
      bbox:         params.bbox,
      width:        params.width,
      height:       params.height,
      x:            params.x,
      y:            params.y,
      info_format:  'application/json',
      feature_count: 1,
    },
    responseType: 'json',
  });
  return response.data;
}

// ─── fetchFeatureTypeTitle ──────────────────────────────────────────────────

/**
 * Fetches the GeoServer feature-type title for a given layer, which matches
 * the actual PostGIS table name.
 *
 * GeoServer distinguishes three identifiers for each published layer:
 *   name       – the published WMS/WFS service name
 *   nativeName – the underlying data-store object name
 *   title      – human-readable label; in Smart GECI this equals the
 *                PostGIS table name
 *
 * GET /rest/workspaces/{ws}/datastores/{ds}/featuretypes/{name}
 *
 * @param layerName  Short layer name without workspace prefix.
 * @returns The title string, or null if the layer is not found.
 */
export async function fetchFeatureTypeTitle(
  layerName: string,
): Promise<string | null> {
  const workspace = env.GEOSERVER_WORKSPACE;
  const datastore = env.GEOSERVER_DATASTORE;

  try {
    const response = await geoserverClient.get<GeoServerFeatureTypeResponse>(
      `/rest/workspaces/${encodeURIComponent(workspace)}/datastores/${encodeURIComponent(datastore)}/featuretypes/${encodeURIComponent(layerName)}`,
    );
    return response.data.featureType.title ?? null;
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 404) {
      return null;
    }
    throw err;
  }
}

// ─── publishLayerToGeoServer ────────────────────────────────────────────────

/**
 * Publishes a PostGIS table as a GeoServer feature type (WMS/WFS layer).
 *
 * If GeoServer returns 409 (already exists) or 500, falls back to a PUT
 * with bbox recalculation to refresh the existing feature type.
 */
export async function publishLayerToGeoServer(layerName: string): Promise<void> {
  const workspace = env.GEOSERVER_WORKSPACE;
  const datastore = env.GEOSERVER_DATASTORE;

  const body = {
    featureType: {
      name: layerName,
      nativeName: layerName,
      srs: 'EPSG:4326',
      enabled: true,
      store: {
        '@class': 'dataStore',
        name: `${workspace}:${datastore}`,
      },
    },
  };

  try {
    await geoserverClient.post(
      `/rest/workspaces/${encodeURIComponent(workspace)}/datastores/${encodeURIComponent(datastore)}/featuretypes`,
      body,
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    if (
      err instanceof AxiosError &&
      (err.response?.status === 409 || err.response?.status === 500)
    ) {
      // Fallback: update existing feature type and recalculate bounding boxes
      await geoserverClient.put(
        `/rest/workspaces/${encodeURIComponent(workspace)}/datastores/${encodeURIComponent(datastore)}/featuretypes/${encodeURIComponent(layerName)}?recalculate=nativebbox,latlonbbox`,
        body,
        { headers: { 'Content-Type': 'application/json' } },
      );
    } else {
      throw err;
    }
  }
}

// ─── deleteGeoServerLayer ────────────────────────────────────────────────────

/**
 * Removes a feature type (and its associated layer/styles) from GeoServer.
 *
 * Uses ?recurse=true so the published layer and default styles are also
 * cleaned up in one call.
 */
export async function deleteGeoServerLayer(layerName: string): Promise<void> {
  const workspace = env.GEOSERVER_WORKSPACE;
  const datastore = env.GEOSERVER_DATASTORE;

  try {
    await geoserverClient.delete(
      `/rest/workspaces/${encodeURIComponent(workspace)}/datastores/${encodeURIComponent(datastore)}/featuretypes/${encodeURIComponent(layerName)}?recurse=true`,
    );
  } catch (err) {
    // 404 = already gone — treat as success
    if (err instanceof AxiosError && err.response?.status === 404) return;
    throw err;
  }
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
