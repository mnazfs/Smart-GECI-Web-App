import { useLayerStore } from "@/store/layerStore";
import { useAuthStore } from "@/store/authStore";

export const useMapLayers = () => {
  const role = useAuthStore((s) => s.role);
  const activeLayerIds = useLayerStore((s) => s.activeLayerIds);
  const getVisibleLayers = useLayerStore((s) => s.getVisibleLayers);

  const visibleLayers = getVisibleLayers(role);

  return {
    visibleLayers,
    activeLayerIds,
    role,
  };
};
