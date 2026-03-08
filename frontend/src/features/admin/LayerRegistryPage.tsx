import { useEffect } from "react";
import { useLayerStore } from "@/store/layerStore";
import { flattenTree } from "@/features/layers/layerUtils";
import { Lock, Unlock, Database, RefreshCw } from "lucide-react";

interface LayerRegistryPageProps {
  onSync: () => void;
  syncing: boolean;
  syncMsg: string | null;
}

const LayerRegistryPage = ({ onSync, syncing, syncMsg }: LayerRegistryPageProps) => {
  const adminLayerTree = useLayerStore((s) => s.adminLayerTree);
  const fetchAdminLayers = useLayerStore((s) => s.fetchAdminLayers);
  const allLayers = flattenTree(adminLayerTree);

  useEffect(() => {
    fetchAdminLayers();
  }, [fetchAdminLayers]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold text-foreground">
            Layer Registry
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {syncMsg && (
            <p className="text-xs text-muted-foreground max-w-xs text-right">{syncMsg}</p>
          )}
          <button
            onClick={onSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync from GeoServer"}
          </button>
        </div>
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
              <th className="text-center py-2 px-3 font-medium text-muted-foreground">
                Render
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
                <td className="py-2.5 px-3 text-center">
                  <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                    layer.renderMode === 'wfs'
                      ? 'bg-blue-500/10 text-blue-600'
                      : 'bg-green-500/10 text-green-600'
                  }`}>
                    {(layer.renderMode ?? 'wms').toUpperCase()}
                  </span>
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
