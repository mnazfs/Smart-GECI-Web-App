import { useMap } from 'react-leaflet';
// AOI Layer component that renders GeoJSON only after map is available
const AOILayer = ({ geojson }: { geojson: any }) => {
  const map = useMap();
  if (!geojson || !map) return null;
  return (
    <GeoJSON
      data={geojson}
      style={() => ({
        fillColor: '#ff0000',
        fillOpacity: 0.6,
        color: '#000000',
        weight: 3,
      })}
      onEachFeature={(_feature, layer) => {
        // Auto-zoom to AOI only once
        // Type guard to ensure getBounds exists before calling
        if (map && layer && typeof (layer as any).getBounds === 'function') {
          const bounds = (layer as any).getBounds();
          if (bounds && bounds.isValid()) {
            map.fitBounds(bounds, { padding: [30, 30] });
          }
        }
      }}
    />
  );
};
import { MapContainer, TileLayer, WMSTileLayer, useMapEvents, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import type { LayerState } from './LayerControls';
import L from 'leaflet';
import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';


/**
 * Location analysis response from backend /api/analysis/location endpoint
 * Contains raster values and heat mitigation recommendations for a clicked point
 */
interface LocationAnalysis {
  lat: number;
  lon: number;
  data_status: string;          // "ok", "nodata", or "outside_coverage" - indicates data availability
  message?: string;             // Optional message for outside_coverage status
  lst: number | null;          // Land Surface Temperature in Celsius
  ndvi: number | null;          // Normalized Difference Vegetation Index
  ndbi: number | null;          // Normalized Difference Built-up Index
  uhi_class: number | null;    // UHI classification: 0 | 1 | 2 (from UHI_CLASS raster)
  uhi_label: string;           // UHI classification label: "Low" | "Moderate" | "High"
  uhi_description: string;      // Brief zone characteristic description
  recommendations: string[];     // Rule-based recommendations
}

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface UHIMapProps {
  layers: LayerState;
  opacity: number;
  onStatsUpdate?: (stats: any) => void;
  onLocationAnalysis?: (data: LocationAnalysis) => void;
  onAOIAnalysis?: (data: any) => void;
  drawMode?: boolean;
}

interface CustomWMSTileLayerProps {
  url: string;
  layerName: string;
  opacity: number;
}

/**
 * Custom WMS TileLayer component that renders GeoServer raster layers
 * Supports transparency and opacity control for layer blending
 */
const CustomWMSTileLayer = ({ url, layerName, opacity }: CustomWMSTileLayerProps) => {
  return (
    <WMSTileLayer
      url={url}
      layers={layerName}
      format="image/png"
      transparent={true}
      version="1.1.1"
      opacity={opacity}
      attribution="© GeoServer"
    />
  );
};

/**
 * Handles map click events to fetch and display location-specific raster analysis
 * Fetches LST, NDVI, NDBI values from backend and updates parent component state
 */
const MapClickHandler = ({ 
  activeLayer, 
  onLocationAnalysis 
}: { 
  activeLayer: string | null;
  onLocationAnalysis?: (data: LocationAnalysis) => void;
}) => {
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lon: number } | null>(null);
  
  useMapEvents({
    async click(e) {
      const { lat, lng } = e.latlng;
      
      // Store clicked coordinates for potential future use
      setClickedCoords({ lat, lon: lng });
      
      // Show loading popup
      const loadingPopup = L.popup()
        .setLatLng(e.latlng)
        .setContent(`
          <div class="p-3">
            <h3 class="font-semibold text-sm mb-2">🔍 Analyzing Location...</h3>
            <div class="text-xs text-muted-foreground">
              Fetching raster data from GeoServer...
            </div>
          </div>
        `)
        .openOn(e.target);
      
      // Call backend API
      try {
        const response = await fetch(
          `http://localhost:8000/api/analysis/location?lat=${lat}&lon=${lng}`
        );
        
        if (!response.ok) {
          // Handle different error types
          if (response.status === 400) {
            // Handle AOI boundary validation error
            const errorData = await response.json();
            if (errorData.error && errorData.error.includes('outside the AOI coverage')) {
              throw new Error('OUTSIDE_AOI');
            }
            throw new Error(errorData.error || 'Invalid request');
          } else if (response.status === 404) {
            const errorData = await response.json();
            throw new Error(errorData.detail?.message || 'Location outside coverage area');
          } else if (response.status === 503) {
            throw new Error('GeoServer connection failed. Check if GeoServer is running.');
            throw new Error(`API error: ${response.status}`);
          }
        }
        
        const data: LocationAnalysis = await response.json();
        
        // Update parent component with location analysis data
        if (onLocationAnalysis) {
          onLocationAnalysis(data);
        }
        
        // Check if location is outside UHI raster coverage
        if (data.data_status === 'outside_coverage') {
          // Show outside coverage message in popup
          loadingPopup.setContent(`
            <div class="p-3">
              <h3 class="font-semibold text-sm mb-2 text-orange-400">📍 Outside UHI Coverage</h3>
              <div class="text-xs space-y-2">
                <div>Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
                <div class="mt-2 p-2 bg-orange-500/10 rounded border border-orange-500/20">
          `);
          return;
        }
        
        // Check if data is available (legacy)
        if (data.data_status === 'nodata') {
          // Show nodata message in popup
          loadingPopup.setContent(`
            <div class="p-3">
              <h3 class="font-semibold text-sm mb-2 text-yellow-400">⚠️ No Data Available</h3>
              <div class="text-xs space-y-2">
                <div>Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
                <div class="mt-2 p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
                  <div class="text-yellow-300 text-xs leading-relaxed">
                    ${data.recommendations[0] || 'Raster data unavailable at this location.'}
                  </div>
                </div>
                <div class="text-muted-foreground text-xs mt-2">
                  💡 Click within the Idukki region where coverage is available.
                </div>
              </div>
            </div>
          `);
          return;
        }
        
        if (data.data_status === 'outside_bounds') {
          // Show out of bounds message in popup
          loadingPopup.setContent(`
            <div class="p-3">
              <h3 class="font-semibold text-sm mb-2 text-orange-400">📍 Outside Coverage Area</h3>
              <div class="text-xs space-y-2">
                <div>Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
                <div class="mt-2 p-2 bg-orange-500/10 rounded border border-orange-500/20">
                  <div class="text-orange-300 text-xs leading-relaxed">
                    ${data.recommendations[0] || 'This location is outside the raster coverage extent.'}
                  </div>
                </div>
                <div class="text-muted-foreground text-xs mt-2">
                  🗺️ The analysis is limited to the Idukki study region.
                </div>
              </div>
            </div>
          `);
          return;
        }
        
        // Format values for display
        const formatValue = (val: number | null, decimals: number = 2) => 
          val !== null ? val.toFixed(decimals) : 'N/A';
        
        // Build recommendations HTML
        const recommendationsHtml = data.recommendations
          .map(rec => `<li class="text-xs leading-relaxed">${rec}</li>`)
          .join('');
        
        // Update popup with results (stats only, no recommendations)
        loadingPopup.setContent(`
          <div class="p-3 max-w-xs">
            <h3 class="font-semibold text-sm mb-2">📍 Location Analysis</h3>
            
            <div class="text-xs space-y-1">
              <div class="flex justify-between">
                <span class="text-muted-foreground">Coordinates:</span>
                <span class="font-mono">${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">LST:</span>
                <span class="font-semibold">${formatValue(data.lst)}°C</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">NDVI:</span>
                <span class="font-semibold">${formatValue(data.ndvi, 3)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">NDBI:</span>
                <span class="font-semibold">${formatValue(data.ndbi, 3)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">UHI Class:</span>
                <span class="font-semibold px-2 py-0.5 rounded text-xs ${
                  data.uhi_label === 'High' ? 'bg-red-500/20 text-red-400' :
                  data.uhi_label === 'Moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-green-500/20 text-green-400'
                }">${data.uhi_label}</span>
              </div>
            </div>
            
            <div class="border-t border-border pt-2 mt-2">
              <div class="text-xs text-muted-foreground">
                📊 View full analysis in the left panel
              </div>
            </div>
          </div>
        `);
        
      } catch (error) {
        // Handle specific error cases
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        // Special handling for AOI boundary violations
        if (errorMessage === 'OUTSIDE_AOI') {
          loadingPopup.setContent(`
            <div class="p-3">
              <h3 class="font-semibold text-sm mb-2 text-orange-400">🚫 Outside Study Area</h3>
              <div class="text-xs space-y-2">
                <div>Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
                <div class="mt-2 p-2 bg-orange-500/10 rounded border border-orange-500/30">
                  <div class="text-orange-300 text-xs leading-relaxed font-medium">
                    Selected point is outside the study area (AOI). Please click inside the highlighted boundary.
                  </div>
                </div>
                <div class="text-muted-foreground text-xs mt-2">
                  🗺️ The purple/highlighted boundary shows the valid analysis area.
                </div>
              </div>
            </div>
          `);
          // Do NOT call onLocationAnalysis - no successful analysis to report
          return;
        }
        
        // Show error popup for other failures
        loadingPopup.setContent(`
          <div class="p-3">
            <h3 class="font-semibold text-sm mb-2 text-red-400">⚠️ Analysis Failed</h3>
            <div class="text-xs text-muted-foreground space-y-2">
              <div class="font-medium">${errorMessage}</div>
              ${errorMessage.includes('outside coverage') ? `
                <div class="mt-2 p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
                  <div class="text-yellow-400 text-xs">
                    💡 Tip: Click within the Idukki region where raster layers are available.
                  </div>
                </div>
              ` : `
                <div class="mt-2">
                  <div class="font-semibold mb-1">Check:</div>
                  <div>✓ Backend API: <code class="text-xs">http://localhost:8000</code></div>
                  <div>✓ GeoServer: <code class="text-xs">http://localhost:8080/geoserver</code></div>
                  <div class="mt-2 text-xs opacity-75">
                    Run: <code>python backend/main.py</code>
                  </div>
                </div>
              `}
            </div>
          </div>
        `);
      }
    },
  });
  
  return null;
};


/**
 * Main UHI Map Component
 */
const UHIMapReactLeaflet = ({ layers, opacity, onStatsUpdate, onLocationAnalysis, onAOIAnalysis, drawMode = false }: UHIMapProps) => {
  const [loadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // AOI state for rendering
  const [aoiGeoJSON, setAoiGeoJSON] = useState<any>(null);
  const [aoiWMS, setAoiWMS] = useState<{ url: string; layers: string; styles: string } | null>(null);
  const mapRef = useRef<any>(null);
  const aoiZoomedRef = useRef(false);

    // Fit map to AOI WMS bounds after layer is added
    useEffect(() => {
      const fetchAndFitBounds = async () => {
        if (!aoiWMS || !mapRef.current) return;
        try {
          // WMS GetCapabilities request
          const url = `${aoiWMS.url}?service=WMS&version=1.1.1&request=GetCapabilities`;
          const resp = await fetch(url);
          const xml = await resp.text();
          // Parse XML
          const parser = new window.DOMParser();
          const xmlDoc = parser.parseFromString(xml, 'text/xml');
          // Find Layer element for AOI
          const layers = xmlDoc.getElementsByTagName('Layer');
          let bbox = null;
          for (let i = 0; i < layers.length; i++) {
            const nameEl = layers[i].getElementsByTagName('Name')[0];
            if (nameEl && nameEl.textContent === aoiWMS.layers) {
              // Try LatLonBoundingBox (WMS 1.1.1)
              const bboxEl = layers[i].getElementsByTagName('LatLonBoundingBox')[0];
              if (bboxEl) {
                bbox = [
                  [parseFloat(bboxEl.getAttribute('miny') || '0'), parseFloat(bboxEl.getAttribute('minx') || '0')],
                  [parseFloat(bboxEl.getAttribute('maxy') || '0'), parseFloat(bboxEl.getAttribute('maxx') || '0')],
                ];
                break;
              }
            }
          }
          if (bbox && mapRef.current) {
            mapRef.current.fitBounds(bbox, { padding: [40, 40] });
          }
        } catch (err) {
          console.warn('Failed to fit map to AOI WMS bounds:', err);
        }
      };
      fetchAndFitBounds();
    }, [aoiWMS]);

  
  // Map center: Idukki, Kerala
  const center: [number, number] = [9.8369, 77.0080];
  const geoServerURL = 'http://localhost:8080/geoserver/wms';
  
  // Determine which layer is currently active for display purposes
  const activeLayer = Object.entries(layers).find(([_, isActive]) => isActive)?.[0] || null;
  
  // Handle file upload for shapefile analysis
  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) {
      return;
    }
    
    // Validate file is a ZIP
    if (!file.name.endsWith('.zip')) {
      alert('Please upload a .zip file containing shapefile components (.shp, .shx, .dbf, .prj)');
      return;
    }
    
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('http://localhost:8000/api/analysis/shapefile', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Upload failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Shapefile analysis result:', data);

      // Create a valid GeoJSON Feature for AOI (for local rendering)
      const geometry = data.geometry;
      if (!geometry || !geometry.type || !geometry.coordinates) {
        alert('Could not parse AOI geometry from shapefile upload.');
        console.error('AOI geometry invalid or missing:', data.geometry);
        return;
      }
      const properties = {
        uhi_class: data.uhi_classification?.uhi_class,
        uhi_label: data.uhi_classification?.uhi_label,
        area_sq_km: data.area_sq_km,
        priority_level: data.recommendations?.priority_level
      };
      const featureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry,
            properties
          }
        ]
      };
      setAoiGeoJSON(featureCollection);
      aoiZoomedRef.current = false;

      // Prepare AOI WMS info for rendering
      if (data.workspace && data.layer_name && data.wms_url) {
        setAoiWMS({
          url: data.wms_url,
          layers: `${data.workspace}:${data.layer_name}`,
          styles: 'uhi_aoi_fill',
        });
      }
  // Zoom to AOI when it changes, only once per AOI load
  useEffect(() => {
    if (aoiGeoJSON && mapRef.current && !aoiZoomedRef.current) {
      const leaflet = window.L || L;
      const layer = leaflet.geoJSON(aoiGeoJSON);
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [30, 30] });
        aoiZoomedRef.current = true;
      }
    }
  }, [aoiGeoJSON]);

      if (onAOIAnalysis) {
        onAOIAnalysis(data);
      }
    } catch (error) {
      console.error('Failed to upload shapefile:', error);
      alert(`Failed to process shapefile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  
  return (
    <div className="relative w-full h-full">
      {loadError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] glass-panel rounded-lg px-4 py-3 bg-red-500/10 border-red-500 max-w-md">
          <div className="text-sm text-red-500 font-semibold mb-1">⚠️ GeoServer Connection Failed</div>
          <div className="text-xs text-red-400">{loadError}</div>
          <div className="text-xs text-muted-foreground mt-2">
            🌐 Ensure GeoServer is running: <code className="text-xs">http://localhost:8080/geoserver</code>
          </div>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={11}
        style={{ height: '100%', width: '100%', minHeight: '400px' }}
        className="rounded-xl overflow-hidden"
        crs={L.CRS.EPSG3857}
        ref={mapRef}
      >
        {/* Base map - Dark theme */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {/* WMS Layers - Conditionally render based on user selection */}
        {layers.lst && (
          <CustomWMSTileLayer
            url={geoServerURL}
            layerName="smartgeci:Idukki_LST"
            opacity={opacity}
          />
        )}

        {layers.uhi && (
          <CustomWMSTileLayer
            url={geoServerURL}
            layerName="smartgeci:Idukki_UHI"
            opacity={opacity}
          />
        )}

        {layers.ndvi && (
          <CustomWMSTileLayer
            url={geoServerURL}
            layerName="smartgeci:Idukki_NDVI"
            opacity={opacity}
          />
        )}

        {layers.ndbi && (
          <CustomWMSTileLayer
            url={geoServerURL}
            layerName="smartgeci:Idukki_NDBI"
            opacity={opacity}
          />
        )}


        {/* AOI WMS layer - render above rasters */}
        {aoiWMS && (
          <WMSTileLayer
            url={aoiWMS.url}
            layers={aoiWMS.layers}
            styles={aoiWMS.styles}
            format="image/png"
            transparent={true}
            zIndex={100}
          />
        )}
        {/* AOI GeoJSON vector layer (optional, for local preview) */}
        {aoiGeoJSON && <AOILayer geojson={aoiGeoJSON} />}

        {/* Click handler for location analysis - fetches raster values from backend */}
        <MapClickHandler activeLayer={activeLayer} onLocationAnalysis={onLocationAnalysis} />
      </MapContainer>
    </div>
  );
};

export default UHIMapReactLeaflet;

