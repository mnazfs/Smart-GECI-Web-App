import { useMemo } from "react";
import { useLayerStore } from "@/store/layerStore";
import { useAuthStore } from "@/store/authStore";

export const useMapLayers = () => {
  const role = useAuthStore((s) => s.role);
  const activeLayerIds = useLayerStore((s) => s.activeLayerIds);
  const layerTree = useLayerStore((s) => s.layerTree);
  const getVisibleLayers = useLayerStore((s) => s.getVisibleLayers);
  const visibleLayers = useMemo(() => getVisibleLayers(role), [layerTree, role, getVisibleLayers]);

  return {
    visibleLayers,
    activeLayerIds,
    role,
  };
};
