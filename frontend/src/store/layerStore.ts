import { create } from "zustand";
import type { LayerNode } from "@/types/layer";
import type { UserRole } from "@/types/auth";

interface LayerState {
  layerTree: LayerNode[];
  activeLayerIds: string[];
  expandedNodes: string[];
  setLayerTree: (tree: LayerNode[]) => void;
  toggleLayer: (id: string, role: UserRole) => void;
  toggleExpand: (id: string) => void;
  getVisibleLayers: (role: UserRole) => LayerNode[];
  moveLayer: (activeId: string, overId: string) => void;
  toggleRestricted: (id: string) => void;
}

const DEMO_LAYERS: LayerNode[] = [
  {
    id: "buildings",
    name: "Buildings",
    geoserverName: "campus:buildings",
    parentId: null,
    restricted: false,
    children: [
      {
        id: "academic",
        name: "Academic Buildings",
        geoserverName: "campus:academic_buildings",
        parentId: "buildings",
        restricted: false,
      },
      {
        id: "admin-buildings",
        name: "Administrative Buildings",
        geoserverName: "campus:admin_buildings",
        parentId: "buildings",
        restricted: true,
      },
    ],
  },
  {
    id: "infrastructure",
    name: "Infrastructure",
    geoserverName: "campus:infrastructure",
    parentId: null,
    restricted: false,
    children: [
      {
        id: "roads",
        name: "Roads",
        geoserverName: "campus:roads",
        parentId: "infrastructure",
        restricted: false,
      },
      {
        id: "utilities",
        name: "Utilities Network",
        geoserverName: "campus:utilities",
        parentId: "infrastructure",
        restricted: true,
      },
    ],
  },
  {
    id: "environment",
    name: "Environment",
    geoserverName: "campus:environment",
    parentId: null,
    restricted: false,
    children: [
      {
        id: "greenery",
        name: "Green Zones",
        geoserverName: "campus:greenery",
        parentId: "environment",
        restricted: false,
      },
      {
        id: "sensors",
        name: "IoT Sensors",
        geoserverName: "campus:sensors",
        parentId: "environment",
        restricted: true,
      },
    ],
  },
];

function collectChildIds(node: LayerNode): string[] {
  const ids: string[] = [];
  if (node.children) {
    for (const child of node.children) {
      ids.push(child.id);
      ids.push(...collectChildIds(child));
    }
  }
  return ids;
}

function findNode(tree: LayerNode[], id: string): LayerNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function filterByRole(nodes: LayerNode[], role: UserRole): LayerNode[] {
  return nodes.reduce<LayerNode[]>((acc, node) => {
    if (node.restricted && role === "guest") return acc;
    const filtered: LayerNode = {
      ...node,
      children: node.children ? filterByRole(node.children, role) : undefined,
    };
    acc.push(filtered);
    return acc;
  }, []);
}

export const useLayerStore = create<LayerState>((set, get) => ({
  layerTree: DEMO_LAYERS,
  activeLayerIds: [],
  expandedNodes: [],

  setLayerTree: (tree) => set({ layerTree: tree }),

  toggleLayer: (id, role) => {
    const { layerTree, activeLayerIds } = get();
    const node = findNode(layerTree, id);
    if (!node) return;
    if (node.restricted && role === "guest") return;

    const isActive = activeLayerIds.includes(id);
    const childIds = collectChildIds(node);

    if (isActive) {
      set({
        activeLayerIds: activeLayerIds.filter(
          (lid) => lid !== id && !childIds.includes(lid)
        ),
      });
    } else {
      const validChildren = childIds.filter((cid) => {
        const child = findNode(layerTree, cid);
        return child && (!child.restricted || role !== "guest");
      });
      set({
        activeLayerIds: [...new Set([...activeLayerIds, id, ...validChildren])],
      });
    }
  },

  toggleExpand: (id) => {
    const { expandedNodes } = get();
    set({
      expandedNodes: expandedNodes.includes(id)
        ? expandedNodes.filter((n) => n !== id)
        : [...expandedNodes, id],
    });
  },

  getVisibleLayers: (role) => {
    return filterByRole(get().layerTree, role);
  },

  moveLayer: (activeId, overId) => {
    const { layerTree } = get();
    // Simple reorder at top level for demo
    const fromIdx = layerTree.findIndex((n) => n.id === activeId);
    const toIdx = layerTree.findIndex((n) => n.id === overId);
    if (fromIdx === -1 || toIdx === -1) return;
    const newTree = [...layerTree];
    const [moved] = newTree.splice(fromIdx, 1);
    newTree.splice(toIdx, 0, moved);
    set({ layerTree: newTree });
  },

  toggleRestricted: (id) => {
    const { layerTree } = get();
    function toggle(nodes: LayerNode[]): LayerNode[] {
      return nodes.map((n) => ({
        ...n,
        restricted: n.id === id ? !n.restricted : n.restricted,
        children: n.children ? toggle(n.children) : undefined,
      }));
    }
    set({ layerTree: toggle(layerTree) });
  },
}));
