import { Thermometer, Leaf, Building2, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import type { Statistics } from '../data/uhiData';

interface StatsPanelProps {
  stats: Statistics;
}

const StatsPanel = ({ stats }: StatsPanelProps) => {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">Statistics Overview</h2>
        <p className="text-sm text-muted-foreground">UHI metrics for Idukki region</p>
      </div>
      
      {/* Mean LST */}
      <div className="stat-card group">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Mean LST</p>
            <p className="data-value text-lst">{stats.meanLST}°C</p>
          </div>
          <div className="p-2 rounded-lg bg-lst/10 text-lst">
            <Thermometer className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 text-uhi-low">
            <TrendingDown className="w-3 h-3" />
            {stats.minLST}°C
          </span>
          <span className="text-border">—</span>
          <span className="flex items-center gap-1 text-uhi-high">
            <TrendingUp className="w-3 h-3" />
            {stats.maxLST}°C
          </span>
        </div>
      </div>
      
      {/* Mean NDVI */}
      <div className="stat-card group">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Mean NDVI</p>
            <p className="data-value text-ndvi">{stats.meanNDVI}</p>
          </div>
          <div className="p-2 rounded-lg bg-ndvi/10 text-ndvi">
            <Leaf className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-uhi-high via-uhi-moderate to-uhi-low rounded-full transition-all duration-500"
              style={{ width: `${Math.max(0, stats.meanNDVI * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Vegetation density index</p>
        </div>
      </div>
      
      {/* Mean NDBI */}
      <div className="stat-card group">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Mean NDBI</p>
            <p className="data-value text-ndbi">{stats.meanNDBI}</p>
          </div>
          <div className="p-2 rounded-lg bg-ndbi/10 text-ndbi">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-uhi-low via-uhi-moderate to-uhi-high rounded-full transition-all duration-500"
              style={{ width: `${Math.max(0, stats.meanNDBI * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Built-up area density</p>
        </div>
      </div>
      
      {/* High Heat Zones */}
      <div className="stat-card group border-uhi-high/20">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">High Heat Zones</p>
            <p className="data-value text-uhi-high">{stats.highHeatZones}</p>
          </div>
          <div className="p-2 rounded-lg bg-uhi-high/10 text-uhi-high animate-pulse-glow">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Out of {stats.totalZones} monitored zones
        </p>
      </div>
      
      {/* Legend */}
      <div className="stat-card mt-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">UHI Classification</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-uhi-low" />
            <span className="text-sm text-foreground">Low (&lt;30°C)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-uhi-moderate" />
            <span className="text-sm text-foreground">Moderate (30-35°C)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-uhi-high" />
            <span className="text-sm text-foreground">High (&gt;35°C)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;
