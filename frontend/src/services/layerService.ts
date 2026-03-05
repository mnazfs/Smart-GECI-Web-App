import { apiClient } from "./api";
import type { LayerNode } from "@/types/layer";

export const layerService = {
  fetchLayerTree: async (): Promise<LayerNode[]> => {
    const response = await apiClient.get<LayerNode[]>("/layers/tree");
    return response.data;
  },

  updateLayerTree: async (tree: LayerNode[]): Promise<void> => {
    await apiClient.put("/layers/tree", tree);
  },
};
