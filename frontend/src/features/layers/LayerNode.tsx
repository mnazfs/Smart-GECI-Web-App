import { memo, useCallback } from "react";
import { ChevronRight, ChevronDown, Eye, EyeOff, Lock } from "lucide-react";
import type { LayerNode as LayerNodeType } from "@/types/layer";
import { useLayerStore } from "@/store/layerStore";
import { useAuthStore } from "@/store/authStore";

interface LayerNodeProps {
  node: LayerNodeType;
  depth: number;
}

const LayerNode = memo(({ node, depth }: LayerNodeProps) => {
  const activeLayerIds = useLayerStore((s) => s.activeLayerIds);
  const expandedNodes = useLayerStore((s) => s.expandedNodes);
  const toggleLayer = useLayerStore((s) => s.toggleLayer);
  const toggleExpand = useLayerStore((s) => s.toggleExpand);
  const role = useAuthStore((s) => s.role);

  const isActive = activeLayerIds.includes(node.id);
  const isExpanded = expandedNodes.includes(node.id);
  const hasChildren = node.children && node.children.length > 0;

  const handleToggle = useCallback(() => {
    toggleLayer(node.id, role);
  }, [node.id, role, toggleLayer]);

  const handleExpand = useCallback(() => {
    toggleExpand(node.id);
  }, [node.id, toggleExpand]);

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1.5 px-2 rounded-md hover:bg-muted/60 transition-colors cursor-pointer group"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={handleExpand}
            className="p-0.5 rounded hover:bg-muted"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        <button
          onClick={handleToggle}
          className="p-0.5 rounded hover:bg-muted"
          aria-label={isActive ? "Hide layer" : "Show layer"}
        >
          {isActive ? (
            <Eye className="h-3.5 w-3.5 text-accent" />
          ) : (
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        <span className="text-sm font-medium text-panel-foreground flex-1 truncate">
          {node.name}
        </span>

        {node.restricted && (
          <Lock className="h-3 w-3 text-warning opacity-70" />
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <LayerNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
});

LayerNode.displayName = "LayerNode";

export default LayerNode;
