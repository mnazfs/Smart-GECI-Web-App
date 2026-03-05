import { LayerRepository }         from '../repositories/layerRepository';
import type { Layer, LayerTreeNode } from '../models/layer';
import { canViewRestricted }         from '../types/role';
import type { UserRole }             from '../types/role';
import { AppError }                 from '../middleware/errorHandler';

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
      renderMode:    layer.renderMode,
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

// ─── setLayerParent ───────────────────────────────────────────────────────────

/**
 * Reassigns the parent of a layer.  Pass `newParentId: null` to promote a
 * layer to root level.
 *
 * Validation (all throw 400 via AppError):
 *   1. Target layer must exist.
 *   2. Self-parenting is rejected (`id === newParentId`).
 *   3. Setting a *descendant* of `id` as its new parent would create a cycle —
 *      detected by walking the current parent chain of `newParentId` upward.
 *
 * Re-uses `getAllLayers()` so only one round-trip is needed regardless of
 * tree depth.
 */
export async function setLayerParent(
  id:          string,
  newParentId: string | null,
): Promise<Layer> {
  const allLayers = await LayerRepository.getAllLayers();

  // ── 1. Target must exist ──────────────────────────────────────────────────
  const target = allLayers.find(l => l.id === id);
  if (!target) {
    throw new AppError(`Layer ${id} not found`, 404);
  }

  if (newParentId !== null) {
    // ── 2. Self-parenting guard ─────────────────────────────────────────────
    if (newParentId === id) {
      throw new AppError('A layer cannot be its own parent', 400);
    }

    // ── 3. Cycle guard ──────────────────────────────────────────────────────
    // Build an O(1) lookup: layerId → parentId using the CURRENT tree state.
    // We then walk upward from newParentId; if we encounter `id` it means
    // newParentId is already a descendant of id, creating a cycle.
    const parentMap = new Map<string, string | null>(
      allLayers.map(l => [l.id, l.parentId]),
    );

    // Also check the proposed parent exists in the registry
    if (!parentMap.has(newParentId)) {
      throw new AppError(`Parent layer ${newParentId} not found`, 404);
    }

    let cursor: string | null = newParentId;
    while (cursor !== null) {
      if (cursor === id) {
        throw new AppError(
          'Cannot set parent: this would create a circular hierarchy',
          400,
        );
      }
      cursor = parentMap.get(cursor) ?? null;
    }
  }

  const updated = await LayerRepository.updateLayerParent({ id, parentId: newParentId });
  // updateLayerParent returns null only if the row disappeared between our
  // SELECT and the UPDATE — treat it as a 404.
  if (!updated) {
    throw new AppError(`Layer ${id} not found`, 404);
  }

  return updated;
}

// ─── setLayerRestricted ───────────────────────────────────────────────────────

/**
 * Sets the `restricted` access-control flag on a layer.
 * Returns the updated layer or throws a 404 AppError if not found.
 */
export async function setLayerRestricted(
  id:         string,
  restricted: boolean,
): Promise<Layer> {
  const updated = await LayerRepository.updateRestricted({ id, restricted });
  if (!updated) {
    throw new AppError(`Layer ${id} not found`, 404);
  }
  return updated;
}
