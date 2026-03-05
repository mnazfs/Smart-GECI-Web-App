import { apiClient } from "./api";
import type { LayerNode } from "@/types/layer";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface BackendLayer {
  id: string;
  name: string;
  geoserverName: string;
  parentId: string | null;
  restricted: boolean;
  visible: boolean;
}

/**
 * Admin view: fetches all layers (flat, unfiltered by role) from
 * GET /api/layers and builds a LayerNode tree client-side.
 * This always shows restricted layers regardless of JWT state.
 */
export async function fetchAdminLayerTree(): Promise<LayerNode[]> {
  const response = await apiClient.get<ApiResponse<BackendLayer[]>>("/layers");
  const flat = response.data.data;

  const nodeMap = new Map<string, LayerNode>();
  for (const layer of flat) {
    nodeMap.set(layer.id, {
      id: layer.id,
      name: layer.name,
      geoserverName: layer.geoserverName,
      parentId: layer.parentId,
      restricted: layer.restricted,
      children: [],
    });
  }

  const roots: LayerNode[] = [];
  nodeMap.forEach((node) => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
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
  await apiClient.patch(`/layers/${id}/restricted`, { restricted });
}

export interface SyncResult {
  workspace: string;
  total: number;
  inserted: number;
  skipped: number;
}

/**
 * Admin-only: triggers a GeoServer workspace sync on the backend.
 * New layers found in GeoServer are inserted into layer_registry.
 */
export async function syncLayersFromGeoServer(
  workspace?: string
): Promise<SyncResult> {
  const body = workspace ? { workspace } : {};
  const response = await apiClient.post<ApiResponse<SyncResult>>("/layers/sync", body);
  return response.data.data;
}

// Legacy object kept for any code that imports the named export `layerService`
export const layerService = {
  fetchLayerTree: fetchLayerHierarchy,
  updateLayerTree: async (_tree: LayerNode[]): Promise<void> => {
    // Tree structure is updated via individual layer endpoints — no-op
  },
};
