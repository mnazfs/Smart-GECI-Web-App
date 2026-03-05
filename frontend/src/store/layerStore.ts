import { create } from 'zustand';
import type { LayerNode } from '@/types/layer';
import type { UserRole } from '@/types/auth';
import { fetchLayerHierarchy, setLayerParent, setLayerRestricted } from '@/services/layerService';

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

// ─── mock seed data (replaced by backend response later) ────────────────────

const MOCK_LAYER_TREE: LayerNode[] = [
  {
    id: 'buildings',
    name: 'Buildings',
    geoserverName: 'smart_geci:buildings',
    parentId: null,
    restricted: false,
    children: [
      {
        id: 'main_building',
        name: 'Main Building',
        geoserverName: 'smart_geci:main_building',
        parentId: 'buildings',
        restricted: false,
      },
      {
        id: 'science_lab',
        name: 'Science Laboratory',
        geoserverName: 'smart_geci:science_lab',
        parentId: 'buildings',
        restricted: false,
      },
      {
        id: 'admin_block',
        name: 'Administration Block',
        geoserverName: 'smart_geci:admin_block',
        parentId: 'buildings',
        restricted: true,
      },
    ],
  },
  {
    id: 'infrastructure',
    name: 'Infrastructure',
    geoserverName: 'smart_geci:infrastructure',
    parentId: null,
    restricted: false,
    children: [
      {
        id: 'water_network',
        name: 'Water Network',
        geoserverName: 'smart_geci:water_network',
        parentId: 'infrastructure',
        restricted: false,
      },
      {
        id: 'power_grid',
        name: 'Power Grid',
        geoserverName: 'smart_geci:power_grid',
        parentId: 'infrastructure',
        restricted: true,
      },
      {
        id: 'fiber_optic',
        name: 'Fiber Optic Network',
        geoserverName: 'smart_geci:fiber_optic',
        parentId: 'infrastructure',
        restricted: true,
      },
    ],
  },
  {
    id: 'security',
    name: 'Security',
    geoserverName: 'smart_geci:security',
    parentId: null,
    restricted: true,
    children: [
      {
        id: 'cctv_zones',
        name: 'CCTV Zones',
        geoserverName: 'smart_geci:cctv_zones',
        parentId: 'security',
        restricted: true,
      },
      {
        id: 'access_control',
        name: 'Access Control Points',
        geoserverName: 'smart_geci:access_control',
        parentId: 'security',
        restricted: true,
      },
    ],
  },
  {
    id: 'green_spaces',
    name: 'Green Spaces',
    geoserverName: 'smart_geci:green_spaces',
    parentId: null,
    restricted: false,
    children: [
      {
        id: 'parks',
        name: 'Parks & Gardens',
        geoserverName: 'smart_geci:parks',
        parentId: 'green_spaces',
        restricted: false,
      },
      {
        id: 'sports_fields',
        name: 'Sports Fields',
        geoserverName: 'smart_geci:sports_fields',
        parentId: 'green_spaces',
        restricted: false,
      },
    ],
  },
];

// ─── store interface ──────────────────────────────────────────────────────────

interface LayerState {
  layerTree: LayerNode[];
  activeLayerIds: string[];
  expandedNodes: string[];
  isLoading: boolean;
  error: string | null;

  fetchLayers: () => Promise<void>;
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
  layerTree: MOCK_LAYER_TREE,
  activeLayerIds: [],
  expandedNodes: ['buildings', 'infrastructure', 'green_spaces'],
  isLoading: false,
  error: null,

  fetchLayers: async () => {
    set({ isLoading: true, error: null });
    try {
      const tree = await fetchLayerHierarchy();
      set({ layerTree: Array.isArray(tree) ? tree : MOCK_LAYER_TREE, isLoading: false });
    } catch {
      // Fall back to mock data so the app remains usable without a backend
      set({ isLoading: false, error: 'Could not load layers from server. Using cached data.' });
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
      // Re-fetch to get the canonical server state after the parent change
      await get().fetchLayers();
    } catch {
      set({ error: 'Failed to update layer parent. Please try again.' });
    }
  },

  toggleRestricted: async (id) => {
    const node = findNodeInTree(get().layerTree, id);
    if (!node) return;
    try {
      await setLayerRestricted(id, !node.restricted);
      // Re-fetch so the tree reflects the server-side change
      await get().fetchLayers();
    } catch {
      set({ error: 'Failed to update layer restriction. Please try again.' });
    }
  },
}));
