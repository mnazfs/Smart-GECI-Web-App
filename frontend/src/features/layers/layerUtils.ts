import type { LayerNode } from "@/types/layer";
import type { UserRole } from "@/types/auth";

export function flattenTree(nodes: LayerNode[]): LayerNode[] {
  const result: LayerNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children) {
      result.push(...flattenTree(node.children));
    }
  }
  return result;
}

export function isLayerVisible(layer: LayerNode, role: UserRole): boolean {
  if (!layer.restricted) return true;
  return role === "authorized" || role === "admin";
}
