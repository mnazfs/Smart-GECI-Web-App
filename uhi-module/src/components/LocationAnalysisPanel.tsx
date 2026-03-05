import { MapPin, Thermometer, Leaf, Building2, AlertCircle } from 'lucide-react';

/**
 * TypeScript interface for location analysis response from backend API
 * Matches the JSON structure returned by /api/analysis/location endpoint
 */
interface LocationAnalysisData {
  lat: number;
  lon: number;
  data_status: string;          // "ok", "nodata", or "outside_coverage"
  message?: string;             // Optional message for outside_coverage status
  lst: number | null;          // Land Surface Temperature in Celsius
  ndvi: number | null;          // Normalized Difference Vegetation Index
  ndbi: number | null;          // Normalized Difference Built-up Index
  uhi_class: number | null;    // UHI classification value (0, 1, 2) from UHI_CLASS raster
  uhi_label: string;           // Human-readable UHI label ("Low", "Moderate", "High")
  uhi_description: string;      // Brief zone characteristic description
  recommendations: string[];     // Rule-based mitigation recommendations
}

interface LocationAnalysisPanelProps {
  data: LocationAnalysisData | null;
}

/**
 * Displays location-specific raster analysis results
 * Updates dynamically when user clicks on the map
 */
const LocationAnalysisPanel = ({ data }: LocationAnalysisPanelProps) => {
  if (!data) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground mb-1">Location Analysis</h2>
          <p className="text-sm text-muted-foreground">Click on the map to analyze a location</p>
        </div>
        
        <div className="stat-card border-dashed">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MapPin className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Click anywhere on the map to view<br/>location-specific analysis
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check for outside_coverage status (location outside UHI raster extent)
  if (data.data_status === 'outside_coverage') {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold text-foreground">Location Analysis</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <AlertCircle className="w-3 h-3" />
              Outside Coverage
            </span>
          </div>
          <p className="text-sm text-muted-foreground font-mono">
            {data.lat.toFixed(4)}, {data.lon.toFixed(4)}
          </p>
        </div>

        <div className="stat-card bg-orange-500/5 border-orange-500/20">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-orange-300 mb-2">Outside UHI Coverage Area</h3>
              <p className="text-xs text-orange-300/90 leading-relaxed">
                {data.message || 'This location is outside the UHI raster coverage area. Please click within the classified urban heat island zone.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check for nodata status (legacy)
  if (data.data_status === 'nodata') {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold text-foreground">Location Analysis</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
              <AlertCircle className="w-3 h-3" />
              No Data
            </span>
          </div>
          <p className="text-sm text-muted-foreground font-mono">
            {data.lat.toFixed(4)}, {data.lon.toFixed(4)}
          </p>
        </div>

        <div className="stat-card bg-yellow-500/5 border-yellow-500/20">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-400/50 mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-2">No Raster Data Available</h3>
            <p className="text-xs text-muted-foreground leading-relaxed px-4">
              This location is within the study region but has no available raster data. 
              This may occur in areas where satellite imagery was masked (e.g., cloud cover, 
              water bodies, or data gaps during processing).
            </p>
            <div className="mt-4 p-3 bg-background/50 rounded-md border border-yellow-500/10">
              <p className="text-xs text-foreground font-medium mb-1">📍 Location Status:</p>
              <p className="text-xs text-muted-foreground">
                Coordinates are valid, but LST, NDVI, and NDBI values are unavailable at this point.
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              💡 Try clicking a nearby location or areas with visible land cover on the map.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check for outside bounds status
  if (data.data_status === 'outside_bounds') {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground mb-1">Location Analysis</h2>
          <p className="text-sm text-muted-foreground font-mono">
            {data.lat.toFixed(4)}, {data.lon.toFixed(4)}
          </p>
        </div>

        <div className="stat-card bg-orange-500/5 border-orange-500/20">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <MapPin className="w-12 h-12 text-orange-400/50 mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-2">Outside Coverage Area</h3>
            <p className="text-xs text-muted-foreground leading-relaxed px-4">
              {data.recommendations[0] || 'This location is outside the raster coverage extent.'}
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              🗺️ Analysis is limited to the Idukki study region.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const formatValue = (val: number | null, decimals: number = 2, unit: string = '') => 
    val !== null ? `${val.toFixed(decimals)}${unit}` : 'N/A';

  const getUHIColor = (uhi_class: string) => {
    switch (uhi_class) {
      case 'High':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'Moderate':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Low':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground mb-1">Location Analysis</h2>
        <p className="text-sm text-muted-foreground font-mono">
          {data.lat.toFixed(4)}, {data.lon.toFixed(4)}
        </p>
      </div>

      {/* Recommended Actions - Shown First */}
      {data.recommendations && data.recommendations.length > 0 && (
        <div className="stat-card bg-primary/5 border-primary/20">
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            💡 Recommended Actions
          </h3>
          {data.recommendations.length > 1 && (
            <p className="text-xs text-foreground font-medium mb-2">
              Multiple interventions are recommended for this location:
            </p>
          )}
          <ul className="space-y-2">
            {data.recommendations.map((rec, index) => (
              <li key={index} className="text-xs text-muted-foreground leading-relaxed pl-4 relative">
                <span className="absolute left-0 top-1">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* LST Value */}
      <div className="stat-card group">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Land Surface Temperature
            </p>
            <p className="data-value text-lst">
              {formatValue(data.lst, 2, '°C')}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-lst/10 text-lst">
            <Thermometer className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* UHI Classification */}
      <div className="stat-card group">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              UHI Classification
            </p>
            <div className="mt-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold border ${getUHIColor(data.uhi_label)}`}>
                <AlertCircle className="w-4 h-4" />
                {data.uhi_label}
              </span>
            </div>
            {data.uhi_description && (
              <p className="text-xs font-medium text-foreground mt-2">
                {data.uhi_description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* NDVI Value */}
      <div className="stat-card group">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Vegetation Index (NDVI)
            </p>
            <p className="data-value text-ndvi">
              {formatValue(data.ndvi, 3)}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-ndvi/10 text-ndvi">
            <Leaf className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* NDBI Value */}
      <div className="stat-card group">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Built-up Index (NDBI)
            </p>
            <p className="data-value text-ndbi">
              {formatValue(data.ndbi, 3)}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-ndbi/10 text-ndbi">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationAnalysisPanel;
