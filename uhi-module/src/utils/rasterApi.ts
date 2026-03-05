/**
 * Raster Analytics API
 * 
 * API client for fetching raster statistics from the backend.
 */

/**
 * Statistics for a single raster layer
 */
export type RasterStats = {
  min: number;
  max: number;
  mean: number;
  std: number;
  pixels: number;
};

/**
 * Complete summary of all raster layers
 */
export type RasterSummary = {
  LST: RasterStats;
  NDVI: RasterStats;
  NDBI: RasterStats;
  UHI: RasterStats;
};

/**
 * Base URL for the analytics API
 */
const API_BASE_URL = 'http://localhost:8000';

/**
 * Fetch raster statistics summary for all layers.
 * 
 * Retrieves min, max, mean, std, and pixel count for:
 * - LST (Land Surface Temperature)
 * - NDVI (Normalized Difference Vegetation Index)
 * - NDBI (Normalized Difference Built-up Index)
 * - UHI (Urban Heat Island)
 * 
 * @returns Promise resolving to RasterSummary object
 * @throws Error if the API request fails
 * 
 * @example
 * ```ts
 * const summary = await fetchRasterSummary();
 * console.log(`LST range: ${summary.LST.min}°C - ${summary.LST.max}°C`);
 * console.log(`Mean NDVI: ${summary.NDVI.mean}`);
 * ```
 */
export async function fetchRasterSummary(): Promise<RasterSummary> {
  const response = await fetch(`${API_BASE_URL}/api/analytics/summary`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch raster summary: ${response.status} ${response.statusText}`);
  }
  
  const data: RasterSummary = await response.json();
  return data;
}

/**
 * Fetch statistics for a specific layer.
 * 
 * @param layerName - The layer to fetch stats for (LST, NDVI, NDBI, or UHI)
 * @returns Promise resolving to RasterStats for the specified layer
 * @throws Error if the API request fails
 * 
 * @example
 * ```ts
 * const lstStats = await fetchLayerStats('LST');
 * console.log(`Temperature range: ${lstStats.min}°C - ${lstStats.max}°C`);
 * ```
 */
export async function fetchLayerStats(layerName: 'LST' | 'NDVI' | 'NDBI' | 'UHI'): Promise<RasterStats> {
  const response = await fetch(`${API_BASE_URL}/api/analytics/layer/${layerName}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch stats for layer ${layerName}: ${response.status} ${response.statusText}`);
  }
  
  const data: { layer: string; statistics: RasterStats } = await response.json();
  return data.statistics;
}
