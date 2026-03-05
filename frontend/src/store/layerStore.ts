import { create } from 'zustand';
import type { LayerNode } from '@/types/layer';
import type { UserRole } from '@/types/auth';
import { setLayerParent, setLayerRestricted, setLayerRenderMode, fetchAdminLayerTree } from '@/services/layerService';

// ─── helpers ────────────────────────────────────────────────────────────────

function findNodeInTree(tree: LayerNode[], id: string): LayerNode | undefined {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findNodeInTree(node.children ?? [], id);
    if (found) return found;
  }
  return undefined;
}

function filterTreeByRole(nodes: LayerNode[] | undefined, role: UserRole): LayerNode[] {
  if (!nodes) return [];
  if (role !== 'guest') return nodes;
  return nodes
    .filter(node => !node.restricted)
    .map(node => ({ ...node, children: filterTreeByRole(node.children ?? [], role) }));
}

// ─── store interface ──────────────────────────────────────────────────────────

interface LayerState {
  layerTree: LayerNode[];
  adminLayerTree: LayerNode[];
  activeLayerIds: string[];
  expandedNodes: string[];
  isLoading: boolean;
  error: string | null;

  fetchLayers: () => Promise<void>;
  fetchAdminLayers: () => Promise<void>;
  setLayerTree: (tree: LayerNode[]) => void;
  toggleLayer: (id: string, role: UserRole) => void;
  toggleExpand: (id: string) => void;
  getVisibleLayers: (role: UserRole) => LayerNode[];
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  /** Admin: move a layer to a new parent (or root when newParentId is null). */
  moveLayer: (id: string, newParentId: string | null) => Promise<void>;
  /** Admin: toggle the restricted flag on a single layer. */
  toggleRestricted: (id: string) => Promise<void>;
  /** Admin: set the render mode (wms/wfs) on a single layer. */
  setRenderMode: (id: string, mode: 'wms' | 'wfs') => Promise<void>;
}

// ─── store ───────────────────────────────────────────────────────────────────

export const useLayerStore = create<LayerState>((set, get) => ({
  layerTree: [],
  adminLayerTree: [],
  activeLayerIds: [],
  expandedNodes: [],
  isLoading: false,
  error: null,

  fetchLayers: async () => {
    set({ isLoading: true, error: null });
    try {
      // Fetch the complete unfiltered tree from /api/layers.
      // Display filtering (hiding restricted from guests) is done
      // client-side by getVisibleLayers(role) so demo logins work correctly.
      const tree = await fetchAdminLayerTree();
      set({ layerTree: Array.isArray(tree) ? tree : [], isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Could not load layers from server.' });
    }
  },

  fetchAdminLayers: async () => {
    try {
      const tree = await fetchAdminLayerTree();
      set({ adminLayerTree: Array.isArray(tree) ? tree : [] });
    } catch {
      set({ error: 'Could not load admin layer list.' });
    }
  },

  setLayerTree: (tree) => set({ layerTree: tree }),

  toggleLayer: (id, role) => {
    const { layerTree, activeLayerIds } = get();
    const node = findNodeInTree(layerTree, id);
    if (!node) return;

    // Guests cannot toggle restricted layers
    if (node.restricted && role === 'guest') return;

    const isActive = activeLayerIds.includes(id);

    if (isActive) {
      // Turn OFF this node only
      set({ activeLayerIds: activeLayerIds.filter(lid => lid !== id) });
    } else {
      // Turn ON this node only
      set({ activeLayerIds: [...new Set([...activeLayerIds, id])] });
    }
  },

  toggleExpand: (id) => {
    const { expandedNodes } = get();
    const isExpanded = expandedNodes.includes(id);
    set({
      expandedNodes: isExpanded
        ? expandedNodes.filter(nid => nid !== id)
        : [...expandedNodes, id],
    });
  },

  getVisibleLayers: (role) => filterTreeByRole(get().layerTree ?? [], role),

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  moveLayer: async (id, newParentId) => {
    try {
      await setLayerParent(id, newParentId);
      await Promise.all([get().fetchLayers(), get().fetchAdminLayers()]);
    } catch {
      set({ error: 'Failed to update layer parent. Please try again.' });
    }
  },

  toggleRestricted: async (id) => {
    const node = findNodeInTree(get().adminLayerTree, id)
              ?? findNodeInTree(get().layerTree, id);
    if (!node) return;
    try {
      await setLayerRestricted(id, !node.restricted);
      await Promise.all([get().fetchLayers(), get().fetchAdminLayers()]);
    } catch {
      set({ error: 'Failed to update layer restriction. Please try again.' });
    }
  },

  setRenderMode: async (id, mode) => {
    try {
      await setLayerRenderMode(id, mode);
      await Promise.all([get().fetchLayers(), get().fetchAdminLayers()]);
    } catch {
      set({ error: 'Failed to update layer render mode. Please try again.' });
    }
  },
}));
