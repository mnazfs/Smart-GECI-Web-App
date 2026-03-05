import { useEffect } from "react";
import { useLayerStore } from "@/store/layerStore";
import { Lock, Unlock, ChevronRight } from "lucide-react";
import type { LayerNode } from "@/types/layer";
import { flattenTree } from "@/features/layers/layerUtils";

// Collect the id of a node and all its descendants — used to exclude them
// from the parent selector so the user can't create a cycle.
function getDescendantIds(node: LayerNode): string[] {
  return [
    node.id,
    ...(node.children ?? []).flatMap(getDescendantIds),
  ];
}

interface LayerRowProps {
  layer: LayerNode;
  depth: number;
  allLayers: LayerNode[];   // flat list — drives the parent <select>
  onToggleRestricted: (id: string) => void;
  onSetParent: (id: string, parentId: string | null) => void;
  onSetRenderMode: (id: string, mode: 'wms' | 'wfs') => void;
}

const LayerRow = ({
  layer,
  depth,
  allLayers,
  onToggleRestricted,
  onSetParent,
  onSetRenderMode,
}: LayerRowProps) => {
  const hasChildren = !!(layer.children && layer.children.length > 0);

  // Exclude self + all descendants to prevent cycles
  const excluded = new Set(getDescendantIds(layer));
  const parentCandidates = allLayers.filter((l) => !excluded.has(l.id));

  return (
    <>
      <div
        className="flex items-center gap-2 px-3 py-2.5 bg-card border border-border rounded-lg mb-1.5"
        style={{ marginLeft: depth * 20 }}
      >
        {depth > 0 && (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
        )}

        {/* Layer name + geoserver id */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {layer.name}
          </p>
          <p className="text-xs text-muted-foreground font-mono truncate">
            {layer.geoserverName}
          </p>
        </div>

        {hasChildren && (
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted shrink-0">
            {layer.children!.length}{" "}
            child{layer.children!.length !== 1 ? "ren" : ""}
          </span>
        )}

        {/* Parent selector */}
        <select
          value={layer.parentId ?? ""}
          onChange={(e) =>
            onSetParent(layer.id, e.target.value === "" ? null : e.target.value)
          }
          className="text-xs rounded-md border border-input bg-background text-foreground px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring shrink-0 max-w-[160px]"
          title="Set parent layer"
        >
          <option value="">— Root (no parent) —</option>
          {parentCandidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>

        {/* Render-mode toggle: WMS / WFS pill */}
        <div className="flex items-center rounded-md border border-input overflow-hidden shrink-0 text-xs font-medium">
          <button
            onClick={() => onSetRenderMode(layer.id, 'wms')}
            className={`px-2 py-1 transition-colors ${
              (layer.renderMode ?? 'wms') === 'wms'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
            title="Use WMS tile layer"
          >
            WMS
          </button>
          <button
            onClick={() => onSetRenderMode(layer.id, 'wfs')}
            className={`px-2 py-1 transition-colors ${
              layer.renderMode === 'wfs'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
            title="Use WFS GeoJSON vector layer"
          >
            WFS
          </button>
        </div>

        {/* Lock toggle */}
        <button
          onClick={() => onToggleRestricted(layer.id)}
          className={`p-1.5 rounded-md transition-colors shrink-0 ${
            layer.restricted
              ? "bg-destructive/10 text-destructive"
              : "bg-success/10 text-success"
          }`}
          title={
            layer.restricted
              ? "Restricted — click to make public"
              : "Public — click to restrict"
          }
        >
          {layer.restricted ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            <Unlock className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {layer.children?.map((child) => (
        <LayerRow
          key={child.id}
          layer={child}
          depth={depth + 1}
          allLayers={allLayers}
          onToggleRestricted={onToggleRestricted}
          onSetParent={onSetParent}
          onSetRenderMode={onSetRenderMode}
        />
      ))}
    </>
  );
};

const LayerHierarchyEditor = () => {
  const adminLayerTree = useLayerStore((s) => s.adminLayerTree);
  const fetchAdminLayers = useLayerStore((s) => s.fetchAdminLayers);
  const moveLayer = useLayerStore((s) => s.moveLayer);
  const toggleRestricted = useLayerStore((s) => s.toggleRestricted);
  const setRenderMode = useLayerStore((s) => s.setRenderMode);

  useEffect(() => {
    fetchAdminLayers();
  }, [fetchAdminLayers]);

  // Flat list used to populate every row's parent selector
  const allLayers = flattenTree(adminLayerTree);

  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        Layer Hierarchy
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Use the dropdown on each row to assign or change its parent.
        Select "Root" to make it a top-level layer.
        Click the lock icon to toggle access restriction.
      </p>

      <div>
        {adminLayerTree.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No layers registered. Use "Sync from GeoServer" to import layers.
          </p>
        ) : (
          adminLayerTree.map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              depth={0}
              allLayers={allLayers}
              onToggleRestricted={toggleRestricted}
              onSetParent={moveLayer}
              onSetRenderMode={setRenderMode}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default LayerHierarchyEditor;
