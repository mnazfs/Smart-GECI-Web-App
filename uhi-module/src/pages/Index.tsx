import { useState } from 'react';
import { Layers, Download, ChevronLeft, ChevronRight, MapPin, Activity, Target, Map } from 'lucide-react';
import UHIMapReactLeaflet from '../components/UHIMapReactLeaflet';
import RasterStatsPanel from '../components/RasterStatsPanel';
import LocationAnalysisPanel from '../components/LocationAnalysisPanel';
import AOIAnalysisPanel from '../components/AOIAnalysisPanel';
import LayerControls, { type LayerState } from '../components/LayerControls';
import ExportPanel from '../components/ExportPanel';
import { uhiZones } from '../data/uhiData';

/**
 * Location analysis data structure returned by backend API
 * Used to display point-specific raster values and recommendations
 */
interface LocationAnalysisData {
  lat: number;
  lon: number;
  data_status: string;
  lst: number | null;
  ndvi: number | null;
  ndbi: number | null;
  uhi_class: string;
  uhi_reason: string;
  uhi_description: string;
  recommendations: string[];
}

interface AOIAnalysisData {
  status: string;
  area_sq_km: number;
  uhi_distribution: any;
  recommendations: any;
  statistics: any;
}

const Index = () => {
  const [leftTab, setLeftTab] = useState<'statistics' | 'location' | 'aoi'>('statistics');
  const [rightTab, setRightTab] = useState<'layers' | 'export'>('layers');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [layers, setLayers] = useState<LayerState>({
    lst: false,
    uhi: true,
    ndvi: false,
    ndbi: false,
  });
  const [opacity, setOpacity] = useState(0.7);
  const [locationAnalysis, setLocationAnalysis] = useState<LocationAnalysisData | null>(null);
  const [aoiAnalysis, setAOIAnalysis] = useState<AOIAnalysisData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  
  const toggleLayer = (layer: keyof LayerState) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };
  
  const handleLocationAnalysis = (data: LocationAnalysisData | null) => {
    setLocationAnalysis(data);
    if (data) {
      setLeftTab('location');
    }
  };
  
  const handleAOIAnalysis = (data: AOIAnalysisData | null) => {
    setAOIAnalysis(data);
    if (data) {
      setLeftTab('aoi');
    }
  };
  
  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert('Please upload a zipped shapefile (.zip)');
      return;
    }
    
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('analysis_type', 'uhi');
      
      const response = await fetch('http://localhost:8000/api/analysis/aoi/shapefile', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail?.message || `Upload failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Shapefile analysis result:', data);
      handleAOIAnalysis(data);
    } catch (error) {
      console.error('Failed to upload shapefile:', error);
      alert(`Failed to process shapefile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleDrawStart = () => {
    setDrawMode(true);
  };
  
  const handleDrawEnd = () => {
    setDrawMode(false);
  };
  
  const leftTabs = [
    { id: 'statistics' as const, label: 'Statistics', icon: Activity },
    { id: 'location' as const, label: 'Location', icon: Target },
    { id: 'aoi' as const, label: 'AOI Analysis', icon: Map },
  ];
  
  const rightTabs = [
    { id: 'layers' as const, label: 'Layers', icon: Layers },
    { id: 'export' as const, label: 'Export', icon: Download },
  ];

  return (
    <div className="h-screen overflow-hidden bg-background flex">
      {/* Left Sidebar - Raster Statistics */}
      <aside 
        className={`relative flex flex-col glass-panel border-r transition-all duration-300 ${
          leftCollapsed ? 'w-0 overflow-hidden' : 'w-80'
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">Raster Analytics</h1>
              <p className="text-xs text-muted-foreground">GeoServer Insights</p>
            </div>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b border-border">
          {leftTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setLeftTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                leftTab === id
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {leftTab === 'statistics' && <RasterStatsPanel />}
          {leftTab === 'location' && <LocationAnalysisPanel data={locationAnalysis} />}
          {leftTab === 'aoi' && (
            <AOIAnalysisPanel 
              data={aoiAnalysis} 
              onClear={() => setAOIAnalysis(null)}
              onFileUpload={handleFileUpload}
              onDrawStart={handleDrawStart}
              onDrawEnd={handleDrawEnd}
              isUploading={isUploading}
              isDrawing={drawMode}
            />
          )}
        </div>
        
        {/* Pitch Line */}
        <div className="p-4 border-t border-border bg-secondary/30">
          <p className="text-xs text-muted-foreground leading-relaxed italic">
            {leftTab === 'statistics' 
              ? "Real-time statistics computed from GeoServer WCS coverages."
              : leftTab === 'location'
              ? "Click anywhere on the map to analyze location-specific heat metrics."
              : "Draw a polygon or upload a shapefile to analyze area-based UHI patterns."}
          </p>
        </div>
      </aside>
      
      {/* Left Collapse Toggle Button */}
      <button
        onClick={() => setLeftCollapsed(!leftCollapsed)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-[1000] p-2 glass-panel rounded-r-lg border-l-0 transition-all duration-300 hover:bg-secondary"
        style={{ left: leftCollapsed ? 0 : '320px' }}
      >
        {leftCollapsed ? (
          <ChevronRight className="w-4 h-4 text-foreground" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-foreground" />
        )}
      </button>
      
      {/* Main Map Area */}
      <main className="flex-1 relative">
        {/* Map Title Overlay */}
        <div className="absolute top-4 left-4 z-[1000] glass-panel rounded-lg px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
            <span className="text-sm font-medium text-foreground">Live UHI Analysis</span>
          </div>
        </div>
        
        {/* Heat Gradient Legend */}
        <div className="absolute bottom-8 left-4 z-[1000] glass-panel rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-2">Temperature Scale</p>
          <div className="heat-gradient h-2 w-40 rounded-full" />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground">25°C</span>
            <span className="text-xs text-muted-foreground">40°C</span>
          </div>
        </div>
        
        {/* Active Layers Indicator */}
        <div className="absolute top-4 right-4 z-[1000] glass-panel rounded-lg px-3 py-2 mr-80">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {Object.values(layers).filter(Boolean).length} layers active
            </span>
          </div>
        </div>
        
        {/* Map Component */}
        <UHIMapReactLeaflet 
          layers={layers} 
          opacity={opacity}
          onStatsUpdate={() => {}}
          onLocationAnalysis={handleLocationAnalysis}
          onAOIAnalysis={handleAOIAnalysis}
          drawMode={drawMode}
        />
      </main>

      {/* Right Collapse Toggle Button */}
      <button
        onClick={() => setRightCollapsed(!rightCollapsed)}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-[1000] p-2 glass-panel rounded-l-lg border-r-0 transition-all duration-300 hover:bg-secondary"
        style={{ right: rightCollapsed ? 0 : '320px' }}
      >
        {rightCollapsed ? (
          <ChevronLeft className="w-4 h-4 text-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-foreground" />
        )}
      </button>
      
      {/* Right Sidebar - Layer Controls & Export */}
      <aside 
        className={`relative flex flex-col glass-panel border-l transition-all duration-300 ${
          rightCollapsed ? 'w-0 overflow-hidden' : 'w-80'
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">Idukki UHI</h1>
              <p className="text-xs text-muted-foreground">Interactive Dashboard</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mt-3">
            An Urban Heat Decision Support Platform integrating Earth Observation data to guide climate-resilient urban planning.
          </p>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b border-border">
          {rightTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setRightTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                rightTab === id
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        
        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {rightTab === 'layers' && (
            <LayerControls
              layers={layers}
              onToggleLayer={toggleLayer}
              opacity={opacity}
              onOpacityChange={setOpacity}
            />
          )}
          {rightTab === 'export' && <ExportPanel zones={uhiZones} />}
        </div>
        
        {/* Pitch Line */}
        <div className="p-4 border-t border-border bg-secondary/30">
          <p className="text-xs text-muted-foreground leading-relaxed italic">
            "Visualize heat hotspots, correlate with vegetation and built-up density, and prioritize cooling interventions effectively."
          </p>
        </div>
      </aside>
    </div>
  );
};

export default Index;
