import { LayerRepository }         from '../repositories/layerRepository';
import type { Layer, LayerTreeNode } from '../models/layer';
import { canViewRestricted }         from '../types/role';
import type { UserRole }             from '../types/role';

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
 * - Restricted layers are excluded when `role` cannot view restricted content.
 *   Their visible children are orphaned and promoted to root automatically.
 * - A node whose `parentId` points to a non-existent (or invisible/filtered-out)
 *   parent is promoted to a root node rather than being silently dropped.
 * - Children arrays are sorted alphabetically by name for deterministic output.
 */
function buildTree(layers: Layer[], role: UserRole): LayerTreeNode[] {
  const showRestricted = canViewRestricted(role);

  // ── Pass 1: create node map (visible + role-permitted layers only) ────────
  const nodeMap = new Map<string, LayerTreeNode>();

  for (const layer of layers) {
    if (!layer.visible) continue;
    if (layer.restricted && !showRestricted) continue;

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
 * Only visible layers are included.  Restricted layers are also filtered out
 * unless `role` is `'authorized'` or `'admin'`.
 * Does NOT use recursive SQL — the tree is assembled in memory.
 *
 * @param role - The requesting user's role.  Defaults to `'guest'` (most
 *               restrictive) so callers that have not yet wired up role
 *               extraction still receive a safe response.
 */
export async function getLayerHierarchy(role: UserRole = 'guest'): Promise<LayerTreeNode[]> {
  const flat = await LayerRepository.getAllLayers();
  return buildTree(flat, role);
}
