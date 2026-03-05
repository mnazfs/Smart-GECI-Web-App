import { Thermometer, Leaf, Building2, MapPin, Eye, EyeOff } from 'lucide-react';
import { Slider } from './ui/slider';

export interface LayerState {
  lst: boolean;
  uhi: boolean;
  ndvi: boolean;
  ndbi: boolean;
}

interface LayerControlsProps {
  layers: LayerState;
  onToggleLayer: (layer: keyof LayerState) => void;
  opacity: number;
  onOpacityChange: (value: number) => void;
}

const LayerControls = ({ layers, onToggleLayer, opacity, onOpacityChange }: LayerControlsProps) => {
  const layerConfig = [
    { 
      key: 'uhi' as keyof LayerState, 
      label: 'UHI Zones', 
      icon: MapPin, 
      color: 'text-uhi-high',
      bgColor: 'bg-uhi-high/10',
      description: 'Heat island classification'
    },
    { 
      key: 'lst' as keyof LayerState, 
      label: 'LST Heatmap', 
      icon: Thermometer, 
      color: 'text-lst',
      bgColor: 'bg-lst/10',
      description: 'Land surface temperature'
    },
    { 
      key: 'ndvi' as keyof LayerState, 
      label: 'NDVI Layer', 
      icon: Leaf, 
      color: 'text-ndvi',
      bgColor: 'bg-ndvi/10',
      description: 'Vegetation index'
    },
    { 
      key: 'ndbi' as keyof LayerState, 
      label: 'NDBI Layer', 
      icon: Building2, 
      color: 'text-ndbi',
      bgColor: 'bg-ndbi/10',
      description: 'Built-up index'
    },
  ];

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground mb-1">Map Layers</h2>
        <p className="text-sm text-muted-foreground">Toggle visibility of data layers</p>
      </div>
      
      {layerConfig.map(({ key, label, icon: Icon, color, bgColor, description }) => (
        <button
          key={key}
          onClick={() => onToggleLayer(key)}
          className={`layer-toggle w-full ${layers[key] ? 'active' : ''}`}
        >
          <div className={`p-2 rounded-lg ${bgColor} ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className={`${layers[key] ? 'text-primary' : 'text-muted-foreground'}`}>
            {layers[key] ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </div>
        </button>
      ))}
      
      {/* Opacity Slider */}
      <div className="pt-4 border-t border-border mt-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-foreground">Layer Opacity</p>
          <span className="text-sm font-mono text-primary">{Math.round(opacity * 100)}%</span>
        </div>
        <Slider
          value={[opacity * 100]}
          onValueChange={(values) => onOpacityChange(values[0] / 100)}
          min={10}
          max={100}
          step={5}
          className="w-full"
        />
      </div>
    </div>
  );
};

export default LayerControls;
