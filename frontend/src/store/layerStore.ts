import { create } from 'zustand';
import type { LayerNode } from '@/types/layer';
import type { UserRole } from '@/types/auth';
import { setLayerParent, setLayerRestricted, fetchAdminLayerTree } from '@/services/layerService';

// ─── helpers ────────────────────────────────────────────────────────────────

function findNodeInTree(tree: LayerNode[], id: string): LayerNode | undefined {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findNodeInTree(node.children ?? [], id);
    if (found) return found;
  }
  return undefined;
}

function getAllDescendantIds(node: LayerNode): string[] {
  if (!node.children || node.children.length === 0) return [];
  return node.children.flatMap(child => [child.id, ...getAllDescendantIds(child)]);
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
    const descendantIds = getAllDescendantIds(node);
    const affected = [id, ...descendantIds];

    if (isActive) {
      // Turn OFF node + all descendants
      set({ activeLayerIds: activeLayerIds.filter(lid => !affected.includes(lid)) });
    } else {
      // Turn ON node + all descendants (respecting guest restrictions)
      const toAdd = role === 'guest'
        ? affected.filter(aid => {
            const n = findNodeInTree(layerTree, aid);
            return n !== undefined && !n.restricted;
          })
        : affected;
      set({ activeLayerIds: [...new Set([...activeLayerIds, ...toAdd])] });
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
}));
