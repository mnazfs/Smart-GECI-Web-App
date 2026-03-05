import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import { useLayerStore } from "@/store/layerStore";
import { useMapStore } from "@/store/mapStore";
import { useAuthStore } from "@/store/authStore";
import { metadataService } from "@/services/metadataService";

const GEOSERVER_URL =
  import.meta.env.VITE_GEOSERVER_URL ||
  "https://geoserver.example.com/geoserver/wms";

const MapContainer = () => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapLayersRef = useRef<Record<string, L.TileLayer.WMS>>({});

  const { center, zoom, setSelectedMetadata } = useMapStore();
  const activeLayerIds = useLayerStore((s) => s.activeLayerIds);
  const layerTree = useLayerStore((s) => s.layerTree);
  const role = useAuthStore((s) => s.role);

  const findLayerById = useCallback(
    (id: string): { geoserverName: string } | null => {
      const search = (
        nodes: typeof layerTree
      ): { geoserverName: string } | null => {
        for (const node of nodes) {
          if (node.id === id) return { geoserverName: node.geoserverName };
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

      const wmsLayer = L.tileLayer.wms(GEOSERVER_URL, {
        layers: layer.geoserverName,
        format: "image/png",
        transparent: true,
      });

      wmsLayer.addTo(map);
      mapLayersRef.current[layerId] = wmsLayer;
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
