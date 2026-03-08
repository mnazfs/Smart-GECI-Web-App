/**
 * nlpMapStore — Zustand store for bridging NLP spatial results with the Leaflet map.
 *
 * Flow:
 *   1. NlpChat receives map_actions from the NLP service response.
 *   2. NlpChat calls setPendingActions(actions).
 *   3. When MapContainer mounts (user navigates to the map page),
 *      it reads pendingActions, applies them via applyMapActions(), then clears them.
 */
import { create } from "zustand";
import type { MapAction } from "@/map-nlp/mapActionRenderer";

interface NlpMapState {
  /** Map actions queued for the next time MapContainer is active. */
  pendingActions: MapAction[];
  setPendingActions: (actions: MapAction[]) => void;
  clearPendingActions: () => void;
}

export const useNlpMapStore = create<NlpMapState>((set) => ({
  pendingActions: [],
  setPendingActions: (actions) => set({ pendingActions: actions }),
  clearPendingActions: () => set({ pendingActions: [] }),
}));
