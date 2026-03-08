import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Layers, GitBranch, Database, PackageOpen, Users } from "lucide-react";
import { syncLayersFromGeoServer } from "@/services/layerService";
import { useLayerStore } from "@/store/layerStore";

const LayerRegistryPage = lazy(
  () => import("@/features/admin/LayerRegistryPage")
);
const LayerHierarchyEditor = lazy(
  () => import("@/features/admin/LayerHierarchyEditor")
);
const LayerManagement = lazy(
  () => import("@/features/admin/LayerManagement")
);
const NlpAdminPanel = lazy(
  () => import("@/features/admin/NlpAdminPanel")
);
const UserManagement = lazy(
  () => import("@/features/admin/UserManagement")
);

type AdminTab = "registry" | "hierarchy" | "nlp" | "layers" | "users";

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
            Layer Config
          </button>
          <button
            onClick={() => setActiveTab("layers")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "layers"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <PackageOpen className="h-4 w-4" />
            Layer Update
          </button>
          <button
            onClick={() => setActiveTab("nlp")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "nlp"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Database className="h-4 w-4" />
            Knowledge Base
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "users"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
            Users
          </button>
        </div>

        <Suspense
          fallback={
            <div className="text-sm text-muted-foreground">Loading...</div>
          }
        >
          {activeTab === "registry" ? (
            <LayerRegistryPage onSync={handleSync} syncing={syncing} syncMsg={syncMsg} />
          ) : activeTab === "hierarchy" ? (
            <LayerHierarchyEditor />
          ) : activeTab === "layers" ? (
            <LayerManagement />
          ) : activeTab === "nlp" ? (
            <NlpAdminPanel />
          ) : (
            <UserManagement />
          )}
        </Suspense>
      </div>
    </div>
  );
};

export default AdminPage;
