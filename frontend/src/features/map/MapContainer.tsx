import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import { useLayerStore } from "@/store/layerStore";
import { useMapStore } from "@/store/mapStore";
import { useAuthStore } from "@/store/authStore";
import { useNlpMapStore } from "@/store/nlpMapStore";
import { useNlpPopupStore } from "@/store/nlpPopupStore";
import { useMapContextStore } from "@/map-nlp/MapContextProvider";
import { registerMap, applyMapActions } from "@/map-nlp/mapActionRenderer";
import { apiClient } from "@/services/api";
import type { FacilityMetadata } from "@/types/layer";

// In development, requests go through the Vite proxy (/geoserver → http://localhost:8080/geoserver)
// to avoid CORS. In production set VITE_GEOSERVER_URL to the public GeoServer origin.
const GEOSERVER_WMS_URL =
  import.meta.env.VITE_GEOSERVER_URL ||
  "/geoserver/wms";

/**
 * Convert a GeoServer feature (from WMS GetFeatureInfo or WFS GeoJSON) into
 * the FacilityMetadata shape consumed by MetadataPanel.
 */
function featureToMetadata(
  feature: GeoJSON.Feature,
  geoserverName: string,
  latlng: L.LatLng
): FacilityMetadata {
  const props = feature.properties ?? {};

  const name = String(
    props.name ?? props.Name ?? props.NAME ??
    props.room_name ?? props.ROOM_NAME ??
    feature.id ??
    "Feature"
  );

  const type = String(
    props.type ?? props.Type ?? props.TYPE ??
    props.category ?? props.CATEGORY ??
    geoserverName
  );

  const description = String(
    props.description ?? props.DESCRIPTION ?? props.desc ?? ""
  );

  const skipKeys = new Set([
    "name", "Name", "NAME",
    "type", "Type", "TYPE",
    "description", "DESCRIPTION", "desc",
    "geom", "the_geom", "geometry",
  ]);

  const properties: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    if (skipKeys.has(k) || v === null || v === undefined) continue;
    properties[k] =
      typeof v === "object" ? JSON.stringify(v, null, 2) : String(v);
  }

  return {
    id: String(feature.id ?? props.id ?? props.fid ?? ""),
    name,
    type,
    description,
    location: { lat: latlng.lat, lng: latlng.lng },
    properties,
  };
}

const MapContainer = () => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapLayersRef = useRef<Record<string, L.Layer>>({});

  // Track active WMS layers: layerId → geoserverName
  // Used by the map-click handler to issue GetFeatureInfo requests.
  const wmsLayersRef = useRef<Record<string, string>>({});

  const { center, zoom, setSelectedMetadata } = useMapStore();
  const activeLayerIds = useLayerStore((s) => s.activeLayerIds);
  const layerTree = useLayerStore((s) => s.layerTree);
  const role = useAuthStore((s) => s.role);

  // NLP spatial actions — applied once when the map is ready
  const pendingActions = useNlpMapStore((s) => s.pendingActions);
  const clearPendingActions = useNlpMapStore((s) => s.clearPendingActions);

  // Map-context interaction mode
  const interactionMode = useMapContextStore((s) => s.interactionMode);
  const setInteractionMode = useMapContextStore((s) => s.setInteractionMode);
  const setMapContext = useMapContextStore((s) => s.setMapContext);
  const openNlpPopup = useNlpPopupStore((s) => s.open);

  // Keep a ref so the existing click handler can gate-check synchronously
  // without re-creating itself whenever the mode changes.
  const interactionModeRef = useRef(interactionMode);
  useEffect(() => {
    interactionModeRef.current = interactionMode;
  }, [interactionMode]);

  const findLayerById = useCallback(
    (id: string): { geoserverName: string; renderMode: "wms" | "wfs" } | null => {
      const search = (
        nodes: typeof layerTree
      ): { geoserverName: string; renderMode: "wms" | "wfs" } | null => {
        for (const node of nodes) {
          if (node.id === id)
            return {
              geoserverName: node.geoserverName,
              renderMode: node.renderMode ?? "wms",
            };
          if (node.children) {
            const found = search(node.children);
            if (found) return found;
          }
        }
        return null;
      };
      return search(layerTree);
    },
    [layerTree]
  );

  // ── Map initialisation (runs once) ────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    // ── WMS GetFeatureInfo on map click ──────────────────────────────────────
    // Routed through /api/layers/feature-info (backend proxy) so the browser
    // never makes a cross-origin request directly to GeoServer.
    // WFS feature clicks call L.DomEvent.stopPropagation so they won't reach here.
    map.on("click", async (e: L.LeafletMouseEvent) => {
      // Skip WMS feature-info while a spatial interaction mode is active;
      // the dedicated interaction useEffect owns these clicks.
      if (interactionModeRef.current !== "idle") return;

      const geoserverNames = Object.values(wmsLayersRef.current);
      if (geoserverNames.length === 0) return;

      const size = map.getSize();
      const point = map.latLngToContainerPoint(e.latlng);
      const bounds = map.getBounds();
      const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

      // Query each active WMS layer; display the first hit.
      for (const geoserverName of geoserverNames) {
        const params = new URLSearchParams({
          layers: geoserverName,
          bbox,
          width:  String(size.x),
          height: String(size.y),
          x:      String(Math.round(point.x)),
          y:      String(Math.round(point.y)),
          srs:    "EPSG:4326",
        });

        try {
          const res = await fetch(`/api/layers/feature-info?${params}`);
          if (!res.ok) continue;
          const json = await res.json();
          if (Array.isArray(json.features) && json.features.length > 0) {
            setSelectedMetadata(
              featureToMetadata(json.features[0], geoserverName, e.latlng)
            );
            return;
          }
        } catch (err) {
          console.warn("GetFeatureInfo failed for", geoserverName, err);
        }
      }
    });

    mapRef.current = map;
    registerMap(map);

    return () => {
      registerMap(null);
      map.remove();
      mapRef.current = null;
      wmsLayersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Layer add / remove (runs whenever active layers change) ───────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove layers that are no longer active
    Object.keys(mapLayersRef.current).forEach((layerId) => {
      if (!activeLayerIds.includes(layerId)) {
        map.removeLayer(mapLayersRef.current[layerId]);
        delete mapLayersRef.current[layerId];
        delete wmsLayersRef.current[layerId];
      }
    });

    // Add newly activated layers
    activeLayerIds.forEach((layerId) => {
      if (mapLayersRef.current[layerId]) return; // already on map
      const layer = findLayerById(layerId);
      if (!layer) return;

      if (layer.renderMode === "wfs") {
        // ── WFS: fetch full GeoJSON via backend proxy, render as vector ──────
        // onEachFeature attaches a click handler that extracts feature properties.
        const geoJsonLayer = L.geoJSON(undefined, {
          style: { color: "#2563eb", weight: 2, fillOpacity: 0.15 },
          onEachFeature: (feature, featureLayer) => {
            featureLayer.on("click", (e: L.LeafletEvent) => {
              // Stop propagation so the WMS map-click handler doesn't also fire
              L.DomEvent.stopPropagation(e as L.LeafletMouseEvent);
              const latlng = (e as L.LeafletMouseEvent).latlng;
              setSelectedMetadata(
                featureToMetadata(feature, layer.geoserverName, latlng)
              );
            });
          },
        }).addTo(map);

        // Store immediately so the duplicate-add guard works while fetching
        mapLayersRef.current[layerId] = geoJsonLayer;

        apiClient
          .get(`/layers/${layerId}/wfs-data`)
          .then((res) =>
            geoJsonLayer.addData(res.data as GeoJSON.GeoJsonObject)
          )
          .catch((err) =>
            console.warn(`WFS fetch failed for ${layer.geoserverName}:`, err)
          );
      } else {
        // ── WMS: tile layer + register name for GetFeatureInfo ───────────────
        const wmsLayer = L.tileLayer.wms(GEOSERVER_WMS_URL, {
          layers: layer.geoserverName,
          format: "image/png",
          transparent: true,
        });

        wmsLayer.addTo(map);
        mapLayersRef.current[layerId] = wmsLayer;
        wmsLayersRef.current[layerId] = layer.geoserverName;
      }
    });
  }, [activeLayerIds, findLayerById, role, setSelectedMetadata]);

  // ── Apply pending NLP spatial actions when map is ready ───────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || pendingActions.length === 0) return;
    applyMapActions(pendingActions);
    clearPendingActions();
  }, [pendingActions, clearPendingActions]);

  // ── Spatial interaction modes (pick_point / draw_polygon) ─────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (interactionMode === "idle") return; // nothing to set up

    // Temporary visual layer — cleared on cleanup
    const tempGroup = L.featureGroup().addTo(map);
    let polygonVertices: L.LatLng[] = [];
    let previewLine: L.Polyline | null = null;

    // Style constants
    const VERTEX_STYLE: L.CircleMarkerOptions = {
      radius: 6,
      color: "#3b82f6",
      fillColor: "#3b82f6",
      fillOpacity: 0.85,
      weight: 2,
    };

    const cleanup = () => {
      map.off("click", handlePickPoint);
      map.off("click", handleDrawVertex);
      map.off("dblclick", handleDrawFinish);
      map.doubleClickZoom.enable();
      map.getContainer().style.cursor = "";
      tempGroup.clearLayers();
      if (map.hasLayer(tempGroup)) map.removeLayer(tempGroup);
      polygonVertices = [];
      previewLine = null;
    };

    // ── Pick-point mode ─────────────────────────────────────────────────────
    const handlePickPoint = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      L.circleMarker([lat, lng], { ...VERTEX_STYLE, radius: 9 }).addTo(tempGroup);
      setMapContext({
        type: "point",
        geometry: { type: "Point", coordinates: [lng, lat] },
      });
      // setMapContext resets interactionMode → this effect re-runs with "idle"
      // cleanup will fire in the return below; also re-open popup
      openNlpPopup();
    };

    // ── Draw-polygon mode ───────────────────────────────────────────────────
    const updatePreview = () => {
      if (previewLine) tempGroup.removeLayer(previewLine);
      if (polygonVertices.length >= 2) {
        previewLine = L.polyline(
          [...polygonVertices, polygonVertices[0]], // close visually
          { color: "#3b82f6", weight: 2, dashArray: "6 4", opacity: 0.8 }
        );
        tempGroup.addLayer(previewLine);
      }
    };

    const handleDrawVertex = (e: L.LeafletMouseEvent) => {
      polygonVertices.push(e.latlng);
      L.circleMarker(e.latlng, VERTEX_STYLE).addTo(tempGroup);
      updatePreview();
    };

    const handleDrawFinish = (e: L.LeafletMouseEvent) => {
      L.DomEvent.stop(e); // prevent dblclick zoom
      // The second click of a double-click already fired a 'click' event and
      // added a duplicate vertex — remove it.
      if (polygonVertices.length > 0) polygonVertices.pop();
      if (polygonVertices.length < 3) return; // need at least 3 vertices
      const ring = polygonVertices.map(
        (ll) => [ll.lng, ll.lat] as [number, number]
      );
      ring.push(ring[0]); // close ring
      setMapContext({
        type: "polygon",
        geometry: { type: "Polygon", coordinates: [ring] },
      });
      openNlpPopup();
    };

    // ── Escape to cancel ────────────────────────────────────────────────────
    const handleEscape = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      cleanup();
      setInteractionMode("idle");
      openNlpPopup();
      document.removeEventListener("keydown", handleEscape);
    };

    // ── Attach handlers ─────────────────────────────────────────────────────
    map.getContainer().style.cursor = "crosshair";
    document.addEventListener("keydown", handleEscape);

    if (interactionMode === "pick_point") {
      map.once("click", handlePickPoint);
    } else if (interactionMode === "draw_polygon") {
      map.doubleClickZoom.disable(); // prevent zoom on finish dblclick
      map.on("click", handleDrawVertex);
      map.on("dblclick", handleDrawFinish);
    }

    return () => {
      cleanup();
      document.removeEventListener("keydown", handleEscape);
    };
  // openNlpPopup and set* are stable Zustand references — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactionMode]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      data-testid="map-container"
    />
  );
};

export default MapContainer;
