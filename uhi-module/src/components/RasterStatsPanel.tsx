import { useEffect, useState } from 'react';
import { Thermometer, Leaf, Building2, Flame } from 'lucide-react';
import { fetchRasterSummary, type RasterSummary } from '../utils/rasterApi';

const RasterStatsPanel = () => {
  const [stats, setStats] = useState<RasterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchRasterSummary();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load statistics');
        console.error('Error fetching raster stats:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Raster Statistics</h2>
          <p className="text-sm text-muted-foreground">Loading data from GeoServer...</p>
        </div>
        <div className="stat-card">
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-8 bg-muted rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Raster Statistics</h2>
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">Raster Statistics</h2>
        <p className="text-sm text-muted-foreground">Computed from GeoServer WCS</p>
      </div>

      {/* LST Statistics */}
      <div className="stat-card group">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Land Surface Temperature
            </p>
            <p className="data-value text-lst">{stats.LST.mean.toFixed(2)}°C</p>
          </div>
          <div className="p-2 rounded-lg bg-lst/10 text-lst">
            <Thermometer className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Min:</span>
            <span className="ml-2 font-medium">{stats.LST.min.toFixed(2)}°C</span>
          </div>
          <div>
            <span className="text-muted-foreground">Max:</span>
            <span className="ml-2 font-medium">{stats.LST.max.toFixed(2)}°C</span>
          </div>
          <div>
            <span className="text-muted-foreground">Std Dev:</span>
            <span className="ml-2 font-medium">{stats.LST.std.toFixed(2)}°C</span>
          </div>
          <div>
            <span className="text-muted-foreground">Pixels:</span>
            <span className="ml-2 font-medium">{stats.LST.pixels.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* NDVI Statistics */}
      <div className="stat-card group">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Vegetation Index (NDVI)
            </p>
            <p className="data-value text-ndvi">{stats.NDVI.mean.toFixed(3)}</p>
          </div>
          <div className="p-2 rounded-lg bg-ndvi/10 text-ndvi">
            <Leaf className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Min:</span>
            <span className="ml-2 font-medium">{stats.NDVI.min.toFixed(3)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Max:</span>
            <span className="ml-2 font-medium">{stats.NDVI.max.toFixed(3)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Std Dev:</span>
            <span className="ml-2 font-medium">{stats.NDVI.std.toFixed(3)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Pixels:</span>
            <span className="ml-2 font-medium">{stats.NDVI.pixels.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* NDBI Statistics */}
      <div className="stat-card group">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Built-up Index (NDBI)
            </p>
            <p className="data-value text-ndbi">{stats.NDBI.mean.toFixed(3)}</p>
          </div>
          <div className="p-2 rounded-lg bg-ndbi/10 text-ndbi">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Min:</span>
            <span className="ml-2 font-medium">{stats.NDBI.min.toFixed(3)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Max:</span>
            <span className="ml-2 font-medium">{stats.NDBI.max.toFixed(3)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Std Dev:</span>
            <span className="ml-2 font-medium">{stats.NDBI.std.toFixed(3)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Pixels:</span>
            <span className="ml-2 font-medium">{stats.NDBI.pixels.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* UHI Statistics */}
      <div className="stat-card group">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Urban Heat Island
            </p>
            <p className="data-value text-uhi">{stats.UHI.mean.toFixed(2)}°C</p>
          </div>
          <div className="p-2 rounded-lg bg-uhi/10 text-uhi">
            <Flame className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Min:</span>
            <span className="ml-2 font-medium">{stats.UHI.min.toFixed(2)}°C</span>
          </div>
          <div>
            <span className="text-muted-foreground">Max:</span>
            <span className="ml-2 font-medium">{stats.UHI.max.toFixed(2)}°C</span>
          </div>
          <div>
            <span className="text-muted-foreground">Std Dev:</span>
            <span className="ml-2 font-medium">{stats.UHI.std.toFixed(2)}°C</span>
          </div>
          <div>
            <span className="text-muted-foreground">Pixels:</span>
            <span className="ml-2 font-medium">{stats.UHI.pixels.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RasterStatsPanel;
