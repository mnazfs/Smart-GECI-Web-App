import LayerPanel from "@/features/layers/LayerPanel";
import MapContainer from "@/features/map/MapContainer";
import MetadataPanel from "@/features/metadata/MetadataPanel";

const MapPage = () => {
  return (
    <div className="flex flex-1 overflow-hidden relative">
      <LayerPanel />
      <div className="flex-1 relative">
        <MapContainer />
        <MetadataPanel />
      </div>
    </div>
  );
};

export default MapPage;
