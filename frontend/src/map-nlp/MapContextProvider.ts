/**
 * MapContextProvider — Zustand store that holds the user's current map context
 * for spatial NLP queries, as well as the active map-interaction mode.
 *
 * Interaction modes
 *   "idle"         – no special map behaviour (default)
 *   "pick_point"   – next map click captures a GeoJSON Point
 *   "draw_polygon" – successive clicks build polygon vertices;
 *                    double-click finalises the polygon
 *
 * When setMapContext() is called the mode automatically resets to "idle".
 */
import { create } from "zustand";

export type InteractionMode = "idle" | "pick_point" | "draw_polygon";

export interface MapContext {
  /** Spatial context type */
  type: "point" | "polygon" | "feature" | "viewport";
  /** GeoJSON geometry object */
  geometry: {
    type: string;
    coordinates: unknown;
  };
  /** Optional hint for which PostGIS table to query */
  layer?: string;
  /** Optional specific feature identifier */
  feature_id?: string;
}

interface MapContextState {
  /** Currently captured map context, or null if none */
  mapContext: MapContext | null;
  /** Current map interaction mode */
  interactionMode: InteractionMode;
  setMapContext: (ctx: MapContext) => void;
  clearMapContext: () => void;
  setInteractionMode: (mode: InteractionMode) => void;
}

export const useMapContextStore = create<MapContextState>((set) => ({
  mapContext: null,
  interactionMode: "idle",
  // Capturing a context always resets the interaction mode to idle
  setMapContext: (ctx) => set({ mapContext: ctx, interactionMode: "idle" }),
  clearMapContext: () => set({ mapContext: null }),
  setInteractionMode: (mode) => set({ interactionMode: mode }),
}));
