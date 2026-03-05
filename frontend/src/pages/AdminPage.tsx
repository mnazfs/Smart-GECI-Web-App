import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Layers, GitBranch, RefreshCw } from "lucide-react";
import { syncLayersFromGeoServer } from "@/services/layerService";
import { useLayerStore } from "@/store/layerStore";

const LayerRegistryPage = lazy(
  () => import("@/features/admin/LayerRegistryPage")
);
const LayerHierarchyEditor = lazy(
  () => import("@/features/admin/LayerHierarchyEditor")
);

type AdminTab = "registry" | "hierarchy";

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>("registry");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const fetchLayers = useLayerStore((s) => s.fetchLayers);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await syncLayersFromGeoServer();
      setSyncMsg(
        `Sync complete — ${result.inserted} new layer${
          result.inserted !== 1 ? "s" : ""
        } added, ${result.skipped} skipped.`
      );
      await fetchLayers();
    } catch {
      setSyncMsg("Sync failed. Is the backend running and GeoServer reachable?");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              aria-label="Back to map"
            >
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </Link>
            <h1 className="text-xl font-bold text-foreground">Admin Console</h1>
          </div>

          <div className="flex items-center gap-3">
            {syncMsg && (
              <p className="text-xs text-muted-foreground max-w-xs text-right">
                {syncMsg}
              </p>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync from GeoServer"}
            </button>
          </div>
        </div>

        <div className="flex gap-1 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab("registry")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "registry"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-4 w-4" />
            Layer Registry
          </button>
          <button
            onClick={() => setActiveTab("hierarchy")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "hierarchy"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <GitBranch className="h-4 w-4" />
            Hierarchy Editor
          </button>
        </div>

        <Suspense
          fallback={
            <div className="text-sm text-muted-foreground">Loading...</div>
          }
        >
          {activeTab === "registry" ? (
            <LayerRegistryPage />
          ) : (
            <LayerHierarchyEditor />
          )}
        </Suspense>
      </div>
    </div>
  );
};

export default AdminPage;
