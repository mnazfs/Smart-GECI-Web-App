import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import { useLayerStore } from "@/store/layerStore";
import { useMapStore } from "@/store/mapStore";
import { useAuthStore } from "@/store/authStore";
import { metadataService } from "@/services/metadataService";
import { apiClient } from "@/services/api";

const GEOSERVER_WMS_URL =
  import.meta.env.VITE_GEOSERVER_URL ||
  "http://localhost:8080/geoserver/wms";

const MapContainer = () => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapLayersRef = useRef<Record<string, L.Layer>>({});;

  const { center, zoom, setSelectedMetadata } = useMapStore();
  const activeLayerIds = useLayerStore((s) => s.activeLayerIds);
  const layerTree = useLayerStore((s) => s.layerTree);
  const role = useAuthStore((s) => s.role);

  const findLayerById = useCallback(
    (id: string): { geoserverName: string; renderMode: 'wms' | 'wfs' } | null => {
      const search = (
        nodes: typeof layerTree
      ): { geoserverName: string; renderMode: 'wms' | 'wfs' } | null => {
        for (const node of nodes) {
          if (node.id === id) return { geoserverName: node.geoserverName, renderMode: node.renderMode ?? 'wms' };
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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: center,
      zoom: zoom,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    map.on("click", async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const metadata = await metadataService.fetchByLocation(lat, lng);
      if (metadata) {
        setSelectedMetadata(metadata);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove layers not in activeLayerIds
    Object.keys(mapLayersRef.current).forEach((layerId) => {
      if (!activeLayerIds.includes(layerId)) {
        map.removeLayer(mapLayersRef.current[layerId]);
        delete mapLayersRef.current[layerId];
      }
    });

    // Add new active layers
    activeLayerIds.forEach((layerId) => {
      if (mapLayersRef.current[layerId]) return;
      const layer = findLayerById(layerId);
      if (!layer) return;

      if (layer.renderMode === 'wfs') {
        // WFS: proxy through backend to avoid CORS, then add as a vector layer
        const geoJsonLayer = L.geoJSON(undefined, {
          style: { color: '#2563eb', weight: 2, fillOpacity: 0.15 },
        }).addTo(map);

        // Store immediately so duplicate-add guard works while fetch is in flight
        mapLayersRef.current[layerId] = geoJsonLayer;

        apiClient.get(`/layers/${layerId}/wfs-data`)
          .then((res) => geoJsonLayer.addData(res.data as GeoJSON.GeoJsonObject))
          .catch((e) => console.warn(`WFS fetch failed for ${layer.geoserverName}:`, e));
      } else {
        // WMS: standard tile layer
        const wmsLayer = L.tileLayer.wms(GEOSERVER_WMS_URL, {
          layers: layer.geoserverName,
          format: "image/png",
          transparent: true,
        });

        wmsLayer.addTo(map);
        mapLayersRef.current[layerId] = wmsLayer;
      }
    });
  }, [activeLayerIds, findLayerById, role]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      data-testid="map-container"
    />
  );
};

export default MapContainer;
