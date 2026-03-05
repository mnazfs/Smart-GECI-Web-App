import { apiClient } from "./api";
import type { LayerNode } from "@/types/layer";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Fetches the full layer hierarchy from the backend.
 * The backend filters restricted layers based on the JWT role automatically.
 */
export async function fetchLayerHierarchy(): Promise<LayerNode[]> {
  const response = await apiClient.get<ApiResponse<LayerNode[]>>("/layers/hierarchy");
  return response.data.data;
}

/**
 * Admin-only: reassigns the parent of a layer (or promotes to root when parentId is null).
 */
export async function setLayerParent(
  id: string,
  parentId: string | null
): Promise<void> {
  await apiClient.put(`/layers/${id}/parent`, { parentId });
}

/**
 * Admin-only: sets the restricted flag on a single layer.
 */
export async function setLayerRestricted(
  id: string,
  restricted: boolean
): Promise<void> {
  await apiClient.put(`/layers/${id}/restricted`, { restricted });
}

// Legacy object kept for any code that imports the named export `layerService`
export const layerService = {
  fetchLayerTree: fetchLayerHierarchy,
  updateLayerTree: async (_tree: LayerNode[]): Promise<void> => {
    // Tree structure is updated via individual layer endpoints — no-op
  },
};
