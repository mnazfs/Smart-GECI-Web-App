import { BarChart3, MapPin, AlertTriangle, TrendingUp, Leaf, Thermometer, Building2, Upload, Pencil } from 'lucide-react';
import { useRef } from 'react';

interface UHIDistribution {
  count_low: number;
  count_moderate: number;
  count_high: number;
  percentage_low: number;
  percentage_moderate: number;
  percentage_high: number;
  dominant_class: string;
  severity_index: number;
  total_pixels: number;
}

interface AOIRecommendations {
  zone_type: string;
  title: string;
  explanation: string;
  priority_level: string;
  key_actions: string[];
}

interface AOIStatistics {
  uhi?: { min: number; max: number; mean: number; median: number; std: number; count: number };
  lst?: { min: number; max: number; mean: number; median: number; std: number; count: number } | null;
  ndvi?: { min: number; max: number; mean: number; median: number; std: number; count: number } | null;
  ndbi?: { min: number; max: number; mean: number; median: number; std: number; count: number } | null;
}

interface AOIAnalysisData {
  status: string;
  area_sq_km: number;
  uhi_distribution: UHIDistribution;
  recommendations: AOIRecommendations;
  statistics: AOIStatistics;
}

interface AOIAnalysisPanelProps {
  data: AOIAnalysisData | null;
  onClear?: () => void;
  onFileUpload?: (file: File) => void;
  onDrawStart?: () => void;
  onDrawEnd?: () => void;
  isUploading?: boolean;
  isDrawing?: boolean;
}

const AOIAnalysisPanel = ({ data, onClear, onFileUpload, onDrawStart, isUploading }: AOIAnalysisPanelProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  if (!data) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground mb-1">AOI Analysis</h2>
          <p className="text-sm text-muted-foreground">Draw a polygon or upload shapefile</p>
        </div>
        
        <div className="stat-card border-dashed">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MapPin className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Use the draw tool or upload a shapefile<br/>to analyze an area of interest
            </p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="space-y-3">
          {/* <button
            onClick={onDrawStart}
            className="w-full glass-panel rounded-lg px-4 py-3 flex items-center justify-center gap-2 hover:bg-secondary transition-colors"
          >
            <Pencil className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Draw Polygon on Map</span>
          </button> */}
          
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              className="hidden"
              id="shapefile-upload-panel"
              disabled={isUploading}
            />
            <label
              htmlFor="shapefile-upload-panel"
              className={`w-full glass-panel rounded-lg px-4 py-3 flex items-center justify-center gap-2 cursor-pointer hover:bg-secondary transition-colors ${
                isUploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Upload className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {isUploading ? 'Processing...' : 'Upload Shapefile (.zip)'}
              </span>
            </label>
          </div>
        </div>
      </div>
    );
  }

  const getPriorityColor = (level: string) => {
    switch (level) {
      case 'Critical':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'High':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
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
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-foreground">AOI Analysis</h2>
          {onClear && (
            <button
              onClick={onClear}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Area: {data.area_sq_km.toFixed(2)} km²
        </p>
      </div>

      {/* Priority and Zone Type */}
      <div className="stat-card group">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Zone Classification
            </p>
            <h3 className="text-sm font-semibold text-foreground mb-2">
              {data.recommendations.zone_type}
            </h3>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border ${getPriorityColor(data.recommendations.priority_level)}`}>
              <AlertTriangle className="w-3 h-3" />
              {data.recommendations.priority_level} Priority
            </span>
          </div>
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Severity Index */}
      <div className="stat-card group">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Severity Index
            </p>
            <div className="flex items-baseline gap-2">
              <p className="data-value text-primary">
                {data.uhi_distribution.severity_index.toFixed(3)}
              </p>
              <span className="text-xs text-muted-foreground">/ 1.000</span>
            </div>
            <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-500"
                style={{ width: `${data.uhi_distribution.severity_index * 100}%` }}
              />
            </div>
          </div>
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* UHI Distribution Chart */}
      <div className="stat-card">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
          UHI Class Distribution
        </p>
        <div className="space-y-3">
          {/* Low UHI */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-green-400 font-medium">Low UHI</span>
              <span className="text-foreground font-semibold">
                {data.uhi_distribution.percentage_low.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${data.uhi_distribution.percentage_low}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.uhi_distribution.count_low.toLocaleString()} pixels
            </p>
          </div>

          {/* Moderate UHI */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-yellow-400 font-medium">Moderate UHI</span>
              <span className="text-foreground font-semibold">
                {data.uhi_distribution.percentage_moderate.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 transition-all duration-500"
                style={{ width: `${data.uhi_distribution.percentage_moderate}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.uhi_distribution.count_moderate.toLocaleString()} pixels
            </p>
          </div>

          {/* High UHI */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-red-400 font-medium">High UHI</span>
              <span className="text-foreground font-semibold">
                {data.uhi_distribution.percentage_high.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all duration-500"
                style={{ width: `${data.uhi_distribution.percentage_high}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.uhi_distribution.count_high.toLocaleString()} pixels
            </p>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      {data.statistics.lst && (
        <div className="stat-card group">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Mean LST
              </p>
              <p className="data-value text-lst">
                {data.statistics.lst.mean.toFixed(2)}°C
              </p>
            </div>
            <div className="p-2 rounded-lg bg-lst/10 text-lst">
              <Thermometer className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {data.statistics.ndvi && (
        <div className="stat-card group">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Mean NDVI
              </p>
              <p className="data-value text-ndvi">
                {data.statistics.ndvi.mean.toFixed(3)}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-ndvi/10 text-ndvi">
              <Leaf className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {data.statistics.ndbi && (
        <div className="stat-card group">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Mean NDBI
              </p>
              <p className="data-value text-ndbi">
                {data.statistics.ndbi.mean.toFixed(3)}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-ndbi/10 text-ndbi">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="stat-card bg-primary/5 border-primary/20">
        <h3 className="text-sm font-semibold text-foreground mb-2">
          {data.recommendations.title}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          {data.recommendations.explanation}
        </p>
        <div className="space-y-2 mt-3">
          <p className="text-xs font-semibold text-foreground">Key Actions:</p>
          {data.recommendations.key_actions.map((action, index) => (
            <div key={index} className="text-xs text-muted-foreground leading-relaxed pl-4 relative">
              <span className="absolute left-0 top-1">•</span>
              {action}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AOIAnalysisPanel;
