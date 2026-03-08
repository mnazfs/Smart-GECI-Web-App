import { useState, useMemo } from "react";
import { Layers, ChevronLeft, ChevronRight } from "lucide-react";
import { useLayerStore } from "@/store/layerStore";
import { useAuthStore } from "@/store/authStore";
import LayerTree from "./LayerTree";

const LayerPanel = () => {
  const [collapsed, setCollapsed] = useState(false);
  const role = useAuthStore((s) => s.role);
  const layerTree = useLayerStore((s) => s.layerTree);
  const getVisibleLayers = useLayerStore((s) => s.getVisibleLayers);
  const visibleLayers = useMemo(() => getVisibleLayers(role), [layerTree, role, getVisibleLayers]);

  return (
    <div
      className={`relative bg-panel border-r border-panel-border transition-all duration-300 flex flex-col ${
        collapsed ? "w-10" : "w-72"
      }`}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-3 z-10 bg-panel border border-panel-border rounded-full p-0.5 shadow-sm hover:bg-muted transition-colors"
        aria-label={collapsed ? "Expand panel" : "Collapse panel"}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-panel-border">
            <Layers className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-panel-foreground">
              Layers
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <LayerTree layers={visibleLayers} />
          </div>
          {role === "guest" && (
            <div className="px-4 py-2 border-t border-panel-border">
              <p className="text-xs text-muted-foreground">
                Login to access restricted layers
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LayerPanel;
