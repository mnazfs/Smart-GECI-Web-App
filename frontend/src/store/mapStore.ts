import { create } from "zustand";
import type { FacilityMetadata } from "@/types/layer";

interface MapState {
  center: [number, number];
  zoom: number;
  selectedMetadata: FacilityMetadata | null;
  metadataPanelOpen: boolean;
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  setSelectedMetadata: (metadata: FacilityMetadata | null) => void;
  openMetadataPanel: () => void;
  closeMetadataPanel: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  center: [9.8516, 76.9395], // 9°51'05.9"N 76°56'22.1"E
  zoom: 16,
  selectedMetadata: null,
  metadataPanelOpen: false,

  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setSelectedMetadata: (metadata) =>
    set({ selectedMetadata: metadata, metadataPanelOpen: !!metadata }),
  openMetadataPanel: () => set({ metadataPanelOpen: true }),
  closeMetadataPanel: () =>
    set({ metadataPanelOpen: false, selectedMetadata: null }),
}));
