import { LayerRepository } from '../repositories/layerRepository';
import type { Layer, LayerTreeNode } from '../models/layer';

// ─── buildTree ────────────────────────────────────────────────────────────────

/**
 * Converts a flat list of Layer records into a nested tree.
 *
 * Algorithm — O(n), two passes:
 *   Pass 1: build a Map<id, LayerTreeNode> for O(1) parent lookup
 *   Pass 2: attach each node to its parent's children array, or to roots[]
 *
 * Rules:
 * - Only `visible = true` layers are included in the result.
 * - A node whose `parentId` points to a non-existent (or invisible) parent
 *   is promoted to a root node rather than being silently dropped.
 * - Children arrays are sorted alphabetically by name for deterministic output.
 */
function buildTree(layers: Layer[]): LayerTreeNode[] {
  // ── Pass 1: create node map (visible layers only) ────────────────────────
  const nodeMap = new Map<string, LayerTreeNode>();

  for (const layer of layers) {
    if (!layer.visible) continue;

    nodeMap.set(layer.id, {
      id:            layer.id,
      name:          layer.name,
      geoserverName: layer.geoserverName,
      parentId:      layer.parentId,
      restricted:    layer.restricted,
      children:      [],
    });
  }

  // ── Pass 2: wire children to parents ─────────────────────────────────────
  const roots: LayerTreeNode[] = [];

  nodeMap.forEach(node => {
    if (node.parentId !== null && nodeMap.has(node.parentId)) {
      // Safe: we confirmed the parent exists in the map
      nodeMap.get(node.parentId)!.children.push(node);
    } else {
      // Root node (no parent, or parent is invisible / not in registry)
      roots.push(node);
    }
  });

  // ── Sort children at every level alphabetically by name ──────────────────
  function sortChildren(nodes: LayerTreeNode[]): void {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach(n => sortChildren(n.children));
  }

  sortChildren(roots);
  roots.sort((a, b) => a.name.localeCompare(b.name));

  return roots;
}

// ─── getLayerHierarchy ────────────────────────────────────────────────────────

/**
 * Fetches all layers from the database and returns a nested tree.
 *
 * Only visible layers are included.
 * Does NOT use recursive SQL — the tree is assembled in memory.
 */
export async function getLayerHierarchy(): Promise<LayerTreeNode[]> {
  const flat = await LayerRepository.getAllLayers();
  return buildTree(flat);
}
