import { useEffect, useRef, useState } from "react";
import { useLayerStore } from "@/store/layerStore";
import { flattenTree } from "@/features/layers/layerUtils";
import { downloadLayer, uploadLayer, deleteLayerFromGeoServer } from "@/services/layerService";
import { Upload, Download, Trash2, PackageOpen } from "lucide-react";

type MessageState = { text: string; type: "success" | "error" } | null;

const LayerManagement = () => {
  const adminLayerTree  = useLayerStore((s) => s.adminLayerTree);
  const fetchAdminLayers = useLayerStore((s) => s.fetchAdminLayers);

  const [uploading, setUploading]       = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [message, setMessage]           = useState<MessageState>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAdminLayers();
  }, [fetchAdminLayers]);

  const allLayers = flattenTree(adminLayerTree);

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset the input so the same file can be re-selected if needed
    e.target.value = "";

    setUploading(true);
    setMessage(null);
    try {
      const result = await uploadLayer(file);
      setMessage({
        text: `Uploaded "${result.tableName}" — ${result.features} feature${result.features !== 1 ? "s" : ""} imported and published.`,
        type: "success",
      });
      await fetchAdminLayers();
    } catch {
      setMessage({ text: "Upload failed. Ensure the file is a valid .gpkg.", type: "error" });
    } finally {
      setUploading(false);
    }
  };

  // ── Download ────────────────────────────────────────────────────────────────

  const handleDownload = async (geoserverName: string) => {
    setDownloadingId(geoserverName);
    setMessage(null);
    try {
      await downloadLayer(geoserverName);
    } catch {
      setMessage({ text: "Download failed.", type: "error" });
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (geoserverName: string) => {
    const name = geoserverName.includes(":")
      ? geoserverName.split(":").pop()!
      : geoserverName;

    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete layer "${name}"? This removes it from GeoServer and PostGIS. This action cannot be undone.`)) {
      return;
    }

    setDeletingId(geoserverName);
    setMessage(null);
    try {
      await deleteLayerFromGeoServer(name);
      setMessage({ text: `Layer "${name}" deleted.`, type: "success" });
      await fetchAdminLayers();
    } catch {
      setMessage({ text: `Failed to delete "${name}".`, type: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <PackageOpen className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold text-foreground">Layer Management</h3>
        </div>

        {/* Upload GPKG button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Uploading…" : "Upload GPKG"}
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".gpkg"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Upload a GeoPackage to import features into PostGIS and publish on GeoServer.
        Download any layer as GPKG, or permanently delete a layer.
      </p>

      {/* Status message */}
      {message && (
        <div
          className={`mb-4 px-3 py-2 rounded-md text-xs font-medium ${
            message.type === "success"
              ? "bg-green-500/10 text-green-700 dark:text-green-400"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Layer table */}
      {allLayers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No layers registered. Upload a GPKG or sync from GeoServer.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                  GeoServer Layer
                </th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {allLayers.map((layer) => (
                <tr
                  key={layer.id}
                  className="border-b border-border hover:bg-muted/40 transition-colors"
                >
                  <td className="py-2.5 px-3 font-medium text-foreground">{layer.name}</td>
                  <td className="py-2.5 px-3 text-muted-foreground font-mono text-xs">
                    {layer.geoserverName}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* Layer Download */}
                      <button
                        onClick={() => handleDownload(layer.geoserverName)}
                        disabled={downloadingId === layer.geoserverName}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-muted text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={`Download ${layer.name} as GPKG`}
                      >
                        <Download className="h-3 w-3" />
                        {downloadingId === layer.geoserverName ? "…" : "Download"}
                      </button>

                      {/* Layer Deletion */}
                      <button
                        onClick={() => handleDelete(layer.geoserverName)}
                        disabled={deletingId === layer.geoserverName}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={`Delete ${layer.name}`}
                      >
                        <Trash2 className="h-3 w-3" />
                        {deletingId === layer.geoserverName ? "…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LayerManagement;
