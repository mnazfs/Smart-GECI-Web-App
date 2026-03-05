import { X } from "lucide-react";
import { useMapStore } from "@/store/mapStore";

const MetadataPanel = () => {
  const { selectedMetadata, metadataPanelOpen, closeMetadataPanel } =
    useMapStore();

  if (!metadataPanelOpen || !selectedMetadata) return null;

  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-panel border-l border-panel-border shadow-lg z-[1000] flex flex-col animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border">
        <h3 className="text-sm font-semibold text-panel-foreground">
          Feature Info
        </h3>
        <button
          onClick={closeMetadataPanel}
          className="p-1 rounded hover:bg-muted transition-colors"
          aria-label="Close panel"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <h4 className="text-base font-bold text-foreground">
            {selectedMetadata.name}
          </h4>
          <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-accent text-accent-foreground">
            {selectedMetadata.type}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          {selectedMetadata.description}
        </p>

        <div>
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Location
          </h5>
          <p className="text-sm text-foreground">
            {selectedMetadata.location.lat.toFixed(6)},{" "}
            {selectedMetadata.location.lng.toFixed(6)}
          </p>
        </div>

        <div>
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Properties
          </h5>
          <div className="space-y-1.5">
            {Object.entries(selectedMetadata.properties).map(([key, value]) => (
              <div
                key={key}
                className="flex justify-between text-sm border-b border-panel-border pb-1.5"
              >
                <span className="text-muted-foreground">{key}</span>
                <span className="font-medium text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetadataPanel;
