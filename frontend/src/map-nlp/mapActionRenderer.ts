/**
 * mapActionRenderer — interprets map_action objects returned by the NLP service
 * and applies them to the active Leaflet map instance.
 *
 * The module keeps a module-level reference to the map (set by MapContainer
 * via registerMap).  This avoids prop-drilling and works across the SPA's
 * navigation lifecycle: if the user is on the NLP page, actions are queued
 * in the nlpMapStore and applied the next time MapContainer mounts.
 */
import L from "leaflet";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MapAction {
  type: "highlight" | "draw_geometry" | "zoom_to" | "add_layer";
  /** Source PostGIS table name (used for highlight) */
  layer?: string;
  /** List of feature IDs to highlight */
  feature_ids?: string[];
  /** GeoJSON FeatureCollection to draw as an overlay */
  geometry?: GeoJSON.GeoJsonObject;
  /** [minLon, minLat, maxLon, maxLat] bounding box for zoom_to */
  bbox?: [number, number, number, number];
  /** Human-readable label (for debugging / UI display) */
  label?: string;
}

// ── Internal state ────────────────────────────────────────────────────────────

// Active Leaflet map instance — set by MapContainer on mount/unmount
let _map: L.Map | null = null;

// Temporary NLP overlay layers keyed by a stable ID
const _nlpLayers = new Map<string, L.Layer>();

// ── Map registration ──────────────────────────────────────────────────────────

/**
 * Register (or deregister) the Leaflet map instance.
 * Called by MapContainer on mount and unmount.
 */
export function registerMap(map: L.Map | null): void {
  _map = map;
  if (!map) {
    _nlpLayers.clear();
  }
}

// ── Layer management ──────────────────────────────────────────────────────────

/** Remove all temporary NLP overlay layers from the map. */
export function clearNlpLayers(): void {
  if (!_map) return;
  _nlpLayers.forEach((layer) => {
    if (_map!.hasLayer(layer)) _map!.removeLayer(layer);
  });
  _nlpLayers.clear();
}

// ── Individual action handlers ────────────────────────────────────────────────

/**
 * highlight — WMS layers can't be highlighted client-side without extra WFS
 * calls, so we simply log the request.  For WFS layers the feature is already
 * rendered on the map and is visible without extra work.
 */
function _highlightFeature(action: MapAction): void {
  console.info(
    `[NLP] highlight | layer: ${action.layer} | ids: ${action.feature_ids?.join(", ")}`
  );
}

/**
 * draw_geometry — render GeoJSON as an orange temporary overlay.
 * Clears any previous NLP overlay first.
 */
function _drawGeometry(action: MapAction): void {
  if (!_map || !action.geometry) return;

  clearNlpLayers();

  const geoLayer = L.geoJSON(action.geometry, {
    style: {
      color: "#f97316",
      weight: 2,
      opacity: 0.9,
      fillColor: "#f97316",
      fillOpacity: 0.2,
    },
    pointToLayer: (_feature, latlng) =>
      L.circleMarker(latlng, {
        radius: 8,
        color: "#f97316",
        weight: 2,
        fillColor: "#f97316",
        fillOpacity: 0.6,
      }),
  }).addTo(_map);

  _nlpLayers.set("nlp_results", geoLayer);
}

/**
 * zoom_to — fit the viewport to the given bounding box with padding.
 */
function _zoomTo(action: MapAction): void {
  if (!_map || !action.bbox || action.bbox.length < 4) return;

  const [minLon, minLat, maxLon, maxLat] = action.bbox;

  // Only zoom if the bbox covers a meaningful area (avoid zooming to a single point)
  const meaningful =
    Math.abs(maxLon - minLon) > 0.000005 ||
    Math.abs(maxLat - minLat) > 0.000005;

  if (meaningful) {
    _map.fitBounds(
      [
        [minLat, minLon],
        [maxLat, maxLon],
      ],
      { padding: [40, 40], maxZoom: 18 }
    );
  } else {
    // Single-point fallback: centre and zoom in
    _map.setView(
      [(minLat + maxLat) / 2, (minLon + maxLon) / 2],
      17
    );
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Apply a list of map actions.
 * If the map is not yet registered (user is on a different page), the actions
 * are silently ignored — the nlpMapStore will re-apply them when MapContainer mounts.
 *
 * Processing order: highlight → draw_geometry → zoom_to
 */
export function applyMapActions(actions: MapAction[]): void {
  if (!_map || !actions.length) return;

  const highlights = actions.filter((a) => a.type === "highlight");
  const draws = actions.filter((a) => a.type === "draw_geometry");
  const zooms = actions.filter((a) => a.type === "zoom_to");

  highlights.forEach(_highlightFeature);
  draws.forEach(_drawGeometry);
  zooms.forEach(_zoomTo); // zoom last so it accounts for drawn geometry bounds
}
