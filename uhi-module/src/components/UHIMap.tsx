import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LayerState } from './LayerControls';
import { createWMSLayer, type WMSLayerKey } from '../utils/createWMSLayer';

interface UHIMapProps {
  layers: LayerState;
  opacity: number;
  onStatsUpdate?: (stats: any) => void;
}

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const UHIMap = ({ layers, opacity, onStatsUpdate }: UHIMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  
  // Store WMS layers (created once, toggled on/off)
  const wmsLayersRef = useRef<{
    lst?: L.TileLayer.WMS;
    uhi?: L.TileLayer.WMS;
    ndvi?: L.TileLayer.WMS;
    ndbi?: L.TileLayer.WMS;
  }>({});
  
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Idukki coordinates
  const center: L.LatLngExpression = [9.8369, 77.0080];

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: center,
      zoom: 10,
      zoomControl: true,
      crs: L.CRS.EPSG3857, // Explicit CRS for GeoServer WMS
    });

    // Dark theme tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);

    // Add click handler for future GetFeatureInfo analysis
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      
      // Find which layer is currently active
      const activeLayer = Object.entries(layers).find(([_, isActive]) => isActive)?.[0] as WMSLayerKey | undefined;
      
      console.log('🗺️ Map clicked:', {
        lat: lat.toFixed(6),
        lng: lng.toFixed(6),
        activeLayer: activeLayer || 'none',
      });
      
      // TODO: Future enhancement - GetFeatureInfo query
      // if (activeLayer) {
      //   const url = buildGetFeatureInfoURL(activeLayer, map, e.latlng);
      //   fetch(url).then(res => res.json()).then(data => {
      //     // Display pixel value in popup
      //   });
      // }
      
      // Placeholder popup
      if (activeLayer) {
        L.popup()
          .setLatLng(e.latlng)
          .setContent(`
            <div class="p-3">
              <h3 class="font-semibold text-sm mb-2">Location Info</h3>
              <div class="text-xs space-y-1">
                <div>Layer: <strong>${activeLayer.toUpperCase()}</strong></div>
                <div>Lat: ${lat.toFixed(6)}</div>
                <div>Lng: ${lng.toFixed(6)}</div>
                <div class="text-muted-foreground mt-2">
                  Click analysis coming soon...
                </div>
              </div>
            </div>
          `)
          .openOn(map);
      }
    });

    mapRef.current = map;

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Initialize WMS layers ONCE (do not add to map yet)
  useEffect(() => {
    if (!mapRef.current) return;

    try {
      setLoading(true);
      console.log('🌍 Initializing GeoServer WMS layers...');

      // Create all WMS layers with initial opacity
      wmsLayersRef.current = {
        lst: createWMSLayer('lst', opacity),
        uhi: createWMSLayer('uhi', opacity),
        ndvi: createWMSLayer('ndvi', opacity),
        ndbi: createWMSLayer('ndbi', opacity),
      };

      console.log('✅ WMS layers initialized:', Object.keys(wmsLayersRef.current));
      
      // TODO: Future enhancement - fetch layer statistics from GeoServer
      // if (onStatsUpdate) {
      //   // Use WMS GetFeatureInfo or WCS/WPS for statistics
      //   onStatsUpdate({
      //     meanLST: 'N/A',
      //     minLST: 'N/A',
      //     maxLST: 'N/A',
      //     meanNDVI: 'N/A',
      //     meanNDBI: 'N/A',
      //     highHeatZones: 0,
      //     totalZones: 0,
      //   });
      // }
    } catch (error) {
      console.error('Error initializing WMS layers:', error);
      setLoadError('Failed to connect to GeoServer. Ensure it is running at http://localhost:8080/geoserver');
    } finally {
      setLoading(false);
    }
  }, []); // Run once on mount

  // Update WMS layer visibility (clean switching - one layer at a time)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    console.log('🔄 Updating WMS layer visibility...', layers);

    // STEP 1: Remove ALL WMS layers from map (ensures no overlap)
    Object.values(wmsLayersRef.current).forEach(layer => {
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });

    // STEP 2: Add ONLY enabled layers to map
    const layerMapping: Record<string, keyof typeof wmsLayersRef.current> = {
      lst: 'lst',
      uhi: 'uhi',
      ndvi: 'ndvi',
      ndbi: 'ndbi',
    };

    Object.entries(layers).forEach(([key, isEnabled]) => {
      if (isEnabled) {
        const layerKey = layerMapping[key];
        const wmsLayer = wmsLayersRef.current[layerKey];
        
        if (wmsLayer) {
          // Update opacity and add to map
          wmsLayer.setOpacity(opacity);
          wmsLayer.addTo(map);
          console.log(`✅ WMS layer visible: ${key.toUpperCase()}`);
        }
      }
    });

    const activeCount = Object.values(layers).filter(Boolean).length;
    console.log(`✨ Visibility update complete: ${activeCount} WMS layer(s) active`);
  }, [layers, opacity]);

      return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] glass-panel rounded-lg px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-foreground">Connecting to GeoServer...</span>
          </div>
        </div>
      )}
      {loadError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] glass-panel rounded-lg px-4 py-3 bg-red-500/10 border-red-500 max-w-md">
          <div className="text-sm text-red-500 font-semibold mb-1">⚠️ GeoServer Connection Failed</div>
          <div className="text-xs text-red-400">{loadError}</div>
          <div className="text-xs text-muted-foreground mt-2">
            🌐 Ensure GeoServer is running: <code className="text-xs">http://localhost:8080/geoserver</code>
          </div>
        </div>
      )}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full rounded-xl overflow-hidden"
        style={{ height: '100%', width: '100%', minHeight: '400px' }}
      />
    </div>
  );
};

export default UHIMap;
