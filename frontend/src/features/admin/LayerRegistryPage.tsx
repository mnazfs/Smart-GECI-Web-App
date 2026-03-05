import { useLayerStore } from "@/store/layerStore";
import { flattenTree } from "@/features/layers/layerUtils";
import { Lock, Unlock, Database } from "lucide-react";

const LayerRegistryPage = () => {
  const layerTree = useLayerStore((s) => s.layerTree);
  const allLayers = flattenTree(layerTree);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Database className="h-5 w-5 text-accent" />
        <h3 className="text-lg font-semibold text-foreground">
          Layer Registry
        </h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        All registered GeoServer layers and their configuration.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                Name
              </th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                GeoServer Layer
              </th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                Parent
              </th>
              <th className="text-center py-2 px-3 font-medium text-muted-foreground">
                Access
              </th>
            </tr>
          </thead>
          <tbody>
            {allLayers.map((layer) => (
              <tr
                key={layer.id}
                className="border-b border-border hover:bg-muted/40 transition-colors"
              >
                <td className="py-2.5 px-3 font-medium text-foreground">
                  {layer.name}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground font-mono text-xs">
                  {layer.geoserverName}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground">
                  {layer.parentId || "—"}
                </td>
                <td className="py-2.5 px-3 text-center">
                  {layer.restricted ? (
                    <span className="inline-flex items-center gap-1 text-xs text-destructive">
                      <Lock className="h-3 w-3" /> Restricted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-success">
                      <Unlock className="h-3 w-3" /> Public
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LayerRegistryPage;
