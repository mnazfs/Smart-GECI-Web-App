/**
 * mapContextUtils — utility functions for building MapContext objects
 * from various Leaflet and application sources.
 *
 * All functions are plain (non-hook) helpers so they can be called
 * anywhere including outside React components.
 */
import type { MapContext } from "./MapContextProvider";
import { useMapStore } from "@/store/mapStore";

/**
 * Build a Point MapContext from a Leaflet LatLng.
 */
export function contextFromLatLng(
  lat: number,
  lng: number,
  layer?: string
): MapContext {
  return {
    type: "point",
    geometry: {
      type: "Point",
      coordinates: [lng, lat], // GeoJSON order: [lon, lat]
    },
    layer,
  };
}

/**
 * Build a Polygon MapContext from an array of [lat, lng] pairs.
 *
 * @param latLngs  Array of {lat, lng} tuples forming the polygon ring.
 */
export function contextFromPolygon(
  latLngs: Array<{ lat: number; lng: number }>,
  layer?: string
): MapContext {
  const ring = latLngs.map((ll) => [ll.lng, ll.lat] as [number, number]);
  // Close the ring if not already closed
  if (
    ring.length > 0 &&
    (ring[0][0] !== ring[ring.length - 1][0] ||
      ring[0][1] !== ring[ring.length - 1][1])
  ) {
    ring.push(ring[0]);
  }
  return {
    type: "polygon",
    geometry: {
      type: "Polygon",
      coordinates: [ring],
    },
    layer,
  };
}

/**
 * Build a viewport MapContext from a Leaflet map bounds array.
 *
 * @param bounds  [[southLat, westLng], [northLat, eastLng]]
 */
export function contextFromBounds(
  bounds: [[number, number], [number, number]]
): MapContext {
  const [[s, w], [n, e]] = bounds;
  return {
    type: "viewport",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [w, s],
          [e, s],
          [e, n],
          [w, n],
          [w, s],
        ],
      ],
    },
  };
}

/**
 * Build a Point MapContext from the currently stored map center.
 * Reads directly from the Zustand mapStore (no React hook required).
 */
export function contextFromStoredCenter(layer?: string): MapContext {
  const [lat, lng] = useMapStore.getState().center;
  return contextFromLatLng(lat, lng, layer);
}
