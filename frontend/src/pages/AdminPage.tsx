import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Layers, GitBranch } from "lucide-react";

const LayerRegistryPage = lazy(
  () => import("@/features/admin/LayerRegistryPage")
);
const LayerHierarchyEditor = lazy(
  () => import("@/features/admin/LayerHierarchyEditor")
);

type AdminTab = "registry" | "hierarchy";

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>("registry");

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/"
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="Back to map"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Admin Console</h1>
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
