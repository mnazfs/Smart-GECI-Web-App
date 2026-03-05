import { useMapStore } from "@/store/mapStore";

export const useMetadata = () => {
  const { selectedMetadata, metadataPanelOpen, closeMetadataPanel } =
    useMapStore();

  return {
    selectedMetadata,
    metadataPanelOpen,
    closeMetadataPanel,
  };
};
