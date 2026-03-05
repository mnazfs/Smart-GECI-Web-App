import { Thermometer, Leaf, Building2, Lightbulb } from 'lucide-react';
import { type UHIZone, getUHIColor, getSuggestedAction } from '../data/uhiData';

interface ZonePopupProps {
  zone: UHIZone;
}

const ZonePopup = ({ zone }: ZonePopupProps) => {
  const uhiColor = getUHIColor(zone.uhiClass);
  const suggestion = getSuggestedAction(zone);

  return (
    <div className="p-4 min-w-[260px]">
      <div className="flex items-center gap-2 mb-3">
        <div 
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: uhiColor }}
        />
        <h3 className="font-semibold text-foreground">{zone.name}</h3>
      </div>
      
      <div className="space-y-3">
        {/* LST */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Thermometer className="w-4 h-4 text-lst" />
            <span className="text-sm">LST</span>
          </div>
          <span className="font-mono font-medium text-lst">{zone.lst}°C</span>
        </div>
        
        {/* UHI Class */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">UHI Class</span>
          <span 
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ 
              backgroundColor: `${uhiColor}20`,
              color: uhiColor 
            }}
          >
            {zone.uhiClass}
          </span>
        </div>
        
        {/* NDVI */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Leaf className="w-4 h-4 text-ndvi" />
            <span className="text-sm">NDVI</span>
          </div>
          <span className="font-mono font-medium text-ndvi">{zone.ndvi.toFixed(2)}</span>
        </div>
        
        {/* NDBI */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="w-4 h-4 text-ndbi" />
            <span className="text-sm">NDBI</span>
          </div>
          <span className="font-mono font-medium text-ndbi">{zone.ndbi.toFixed(2)}</span>
        </div>
        
        {/* Area */}
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-sm text-muted-foreground">Area</span>
          <span className="font-mono text-sm text-foreground">{zone.area} km²</span>
        </div>
      </div>
      
      {/* Suggested Action */}
      {zone.uhiClass !== 'Low' && (
        <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-primary mb-1">Suggested Action</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{suggestion}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZonePopup;
