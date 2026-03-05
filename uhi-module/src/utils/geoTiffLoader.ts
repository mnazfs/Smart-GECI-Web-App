// @ts-nocheck - GeoTIFF libraries lack type definitions
import parseGeoraster from 'georaster';
import GeoRasterLayer from 'georaster-layer-for-leaflet';
import type { Map as LeafletMap } from 'leaflet';

export interface GeoTiffData {
  georaster: any;
  layer: any;
  min: number;
  max: number;
  values: number[][];
}

/**
 * Load a GeoTIFF file and create a Leaflet layer with AUTO-DETECTED color scale
 * @param url - Path to GeoTIFF file
 * @param _map - Leaflet map instance (not used, kept for compatibility)
 * @param colorScaleFactory - Function that creates color scale given (min, max)
 * @param opacity - Layer opacity (0-1)
 */
export const loadGeoTiff = async (
  url: string,
  _map: LeafletMap,
  colorScaleFactory: ((min: number, max: number) => (value: number) => string) | ((value: number) => string),
  opacity: number = 0.7
): Promise<GeoTiffData> => {
  try {
    console.log(`Fetching GeoTIFF from: ${url}`);
    
    // Fetch the GeoTIFF file
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`File not found (${response.status}). Please place ${url.split('/').pop()} in the public/data/ folder.`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log(`Loaded ${arrayBuffer.byteLength} bytes`);
    
    // Check if file is suspiciously small (likely a 404 HTML page)
    if (arrayBuffer.byteLength < 1024) {
      // Check if it's HTML
      const decoder = new TextDecoder();
      const text = decoder.decode(arrayBuffer.slice(0, Math.min(100, arrayBuffer.byteLength)));
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        throw new Error(`File not found. The server returned an HTML page instead of a GeoTIFF file. Please place the actual .tif file in public/data/ folder.`);
      }
    }
    
    // Check if it's a valid TIFF file (should start with II or MM)
    const view = new DataView(arrayBuffer);
    const byte1 = view.getUint8(0);
    const byte2 = view.getUint8(1);
    
    if (!((byte1 === 0x49 && byte2 === 0x49) || (byte1 === 0x4D && byte2 === 0x4D))) {
      // Log the actual bytes for debugging
      const firstBytes = Array.from(new Uint8Array(arrayBuffer.slice(0, Math.min(20, arrayBuffer.byteLength))))
        .map(b => '0x' + b.toString(16).padStart(2, '0'))
        .join(' ');
      console.error(`First bytes: ${firstBytes}`);
      throw new Error(`Not a valid TIFF file. Expected to start with 0x49 0x49 (II) or 0x4D 0x4D (MM), but got 0x${byte1.toString(16)} 0x${byte2.toString(16)}. The file may be corrupted, in the wrong format, or missing.`);
    }
    
    console.log('Valid TIFF byte order detected');
    
    // Parse the georaster
    const georaster = await parseGeoraster(arrayBuffer);
    console.log('Georaster parsed successfully', georaster);
    
    // Get min and max values
    const min = georaster.mins[0];
    const max = georaster.maxs[0];
    
    console.log('🔍 DEBUGGING GeoTIFF:', {
      url: url.split('/').pop(),
      min: min,
      max: max,
      dimensions: `${georaster.width}x${georaster.height}`,
      projection: georaster.projection,
      noDataValue: georaster.noDataValue
    });
    
    // Analyze data distribution
    const values = georaster.values[0].flat().filter((v: number) => 
      v !== georaster.noDataValue && !isNaN(v)
    );
    const sorted = values.sort((a: number, b: number) => a - b);
    const p10 = sorted[Math.floor(values.length * 0.1)];
    const p50 = sorted[Math.floor(values.length * 0.5)];
    const p90 = sorted[Math.floor(values.length * 0.9)];
    
    console.log('📊 DATA DISTRIBUTION:', {
      '10th percentile': p10?.toFixed(3),
      '50th percentile (median)': p50?.toFixed(3),
      '90th percentile': p90?.toFixed(3),
      'range span': `${((max - min) / Math.abs(max)).toFixed(2)}x of max value`
    });
    
    // 🔑 CRITICAL: Determine the color scale to use
    // If colorScaleFactory accepts (min, max), use dynamic range
    // Otherwise use the provided static color function
    let colorScale: (value: number) => string;
    if (typeof colorScaleFactory === 'function' && colorScaleFactory.length === 2) {
      // Factory function - create dynamic color scale
      colorScale = (colorScaleFactory as (min: number, max: number) => (value: number) => string)(min, max);
      console.log(`✅ Using DYNAMIC color scale (range: ${min.toFixed(2)} to ${max.toFixed(2)})`);
      
      // Test the color scale with sample values
      const testLow = colorScale(min);
      const testMid = colorScale((min + max) / 2);
      const testHigh = colorScale(max);
      console.log(`   Color samples: LOW=${testLow} | MID=${testMid} | HIGH=${testHigh}`);
    } else {
      // Static color function
      colorScale = colorScaleFactory as (value: number) => string;
      console.log('ℹ️ Using STATIC color scale');
    }
    
    // 🔑 CRITICAL: Create a NEW GeoRasterLayer instance with captured colorScale
    // Each layer MUST have its own unique layer instance and color function
    const layerName = url.split('/').pop()?.replace('.tif', '') || 'unknown';
    let pixelCount = 0;
    
    const layer = new GeoRasterLayer({
      georaster: georaster,
      opacity: opacity,
      projection: 4326, // Explicit EPSG:4326 for lat/lng GeoTIFFs
      pixelValuesToColorFn: (pixelValues: number[]) => {
        const value = pixelValues[0];
        if (value === georaster.noDataValue || isNaN(value)) {
          return null; // Transparent for no-data values
        }
        // Color scale is captured in this closure - unique per layer
        const color = colorScale(value);
        
        // Log first few pixels to verify correct color function is being used
        if (pixelCount < 3) {
          console.log(`🎨 [${layerName}] Pixel #${pixelCount}: value=${value.toFixed(3)} → color=${color}`);
          pixelCount++;
        }
        
        // Random sampling to verify pixel values are different across layers
        if (Math.random() < 0.0001) {
          console.log(`🧪 PIXEL SAMPLE [${layerName}]: ${value.toFixed(3)}`);
        }
        
        return color;
      },
      resolution: 256, // Adjust for performance
    });
    
    console.log('✅ GeoRasterLayer created with unique color scale');
    
    return {
      georaster,
      layer,
      min,
      max,
      values: georaster.values,
    };
  } catch (error) {
    console.error('Error loading GeoTIFF:', error);
    if (error instanceof Error) {
      throw new Error(`GeoTIFF loading failed: ${error.message}`);
    }
    throw error;
  }
};

/**
 * Color scale for LST (blue to red heatmap)
 * Dynamically adjusts to actual data range
 */
export const createLSTColorScale = (min: number, max: number) => {
  return (value: number): string | null => {
    // 🔥 TRANSPARENCY: Show only EXTREME heat zones (top 30% of range)
    const threshold = min + (max - min) * 0.7; // Top 30% hottest areas
    if (value < threshold) return null;
    
    // Normalize value between 0-1 based on actual min/max
    const normalized = (value - min) / (max - min);
    const clamped = Math.max(0, Math.min(1, normalized));
    
    // Blue to Red gradient
    const r = Math.round(255 * clamped);
    const g = Math.round(255 * (1 - Math.abs(clamped - 0.5) * 2));
    const b = Math.round(255 * (1 - clamped));
    
    return `rgb(${r}, ${g}, ${b})`;
  };
};

// Default LST color scale (20-45°C range)
export const lstColorScale = createLSTColorScale(20, 45);

/**
 * Color scale for UHI classification
 */
export const uhiColorScale = (value: number): string | null => {
  // 🔥 TRANSPARENCY: Show ONLY HIGH UHI intensity zones
  if (value < 2.66) return null; // Only class 3 (High)
  
  return '#ef4444'; // Red - High intensity only
};

/**
 * Color scale for NDVI (green to brown)
 * Dynamically adjusts to actual data range
 */
export const createNDVIColorScale = (min: number, max: number) => {
  return (value: number): string | null => {
    // 🔥 TRANSPARENCY: Show only DENSE vegetation (top 40% of range)
    const threshold = min + (max - min) * 0.6; // Top 40% greenest areas
    if (value < threshold) return null;
    
    // Normalize to 0-1 based on actual range
    const normalized = (value - min) / (max - min);
    const clamped = Math.max(0, Math.min(1, normalized));
    
    if (clamped < 0.25) return '#8b4513'; // Brown - bare soil/urban
    if (clamped < 0.5) return '#daa520';  // Gold - sparse vegetation
    if (clamped < 0.75) return '#9acd32'; // Yellow-green - moderate vegetation
    return '#228b22';                      // Dark green - dense vegetation
  };
};

// Default NDVI color scale (-1 to 1 range)
export const ndviColorScale = createNDVIColorScale(-1, 1);

/**
 * Color scale for NDBI (grey to yellow)
 * Dynamically adjusts to actual data range
 */
export const createNDBIColorScale = (min: number, max: number) => {
  return (value: number): string | null => {
    // 🔥 TRANSPARENCY: Show only INTENSE built-up areas (top 50% of range)
    const threshold = min + (max - min) * 0.5; // Top 50% most urban
    if (value < threshold) return null;
    
    // Normalize to 0-1 based on actual range
    const normalized = (value - min) / (max - min);
    const clamped = Math.max(0, Math.min(1, normalized));
    
    const r = Math.round(150 + 105 * clamped);
    const g = Math.round(150 + 105 * clamped);
    const b = Math.round(150 * (1 - clamped));
    
    return `rgb(${r}, ${g}, ${b})`;
  };
};

// Default NDBI color scale (-1 to 1 range)
export const ndbiColorScale = createNDBIColorScale(-1, 1);

/**
 * Get pixel value at specific coordinates
 */
export const getPixelValue = (
  georaster: any,
  lat: number,
  lng: number
): number | null => {
  try {
    const values = georaster.getValues({
      left: lng,
      right: lng,
      top: lat,
      bottom: lat,
    });
    
    if (values && values[0] && values[0][0]) {
      const value = values[0][0][0];
      if (value === georaster.noDataValue || isNaN(value)) {
        return null;
      }
      return value;
    }
    return null;
  } catch (error) {
    console.error('Error getting pixel value:', error);
    return null;
  }
};

/**
 * Calculate statistics from georaster
 */
export const calculateGeoStats = (georaster: any) => {
  const values = georaster.values[0];
  const flatValues = values.flat().filter((v: number) => 
    v !== georaster.noDataValue && !isNaN(v)
  );
  
  if (flatValues.length === 0) {
    return { min: 0, max: 0, mean: 0, count: 0 };
  }
  
  const sum = flatValues.reduce((a: number, b: number) => a + b, 0);
  const mean = sum / flatValues.length;
  
  return {
    min: Math.min(...flatValues),
    max: Math.max(...flatValues),
    mean: mean,
    count: flatValues.length,
  };
};
