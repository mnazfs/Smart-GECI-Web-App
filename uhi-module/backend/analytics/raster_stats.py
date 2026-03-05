"""
Raster Statistics Module

Computes statistics from GeoServer WCS coverages in-memory without disk writes.
Uses WCS 2.0.1 protocol with EPSG:4326 CRS.
"""

import io
from typing import Dict

import numpy as np
import rasterio
import requests
from rasterio.io import MemoryFile


# GeoServer Configuration
GEOSERVER_BASE_URL = "http://localhost:8080/geoserver"
DEFAULT_WORKSPACE = "smartgeci"


def compute_raster_stats(coverage_id: str, workspace: str = DEFAULT_WORKSPACE) -> Dict[str, float]:
    """
    Compute statistics for a raster coverage from GeoServer WCS.
    
    Args:
        coverage_id: The coverage identifier (layer name) in GeoServer
        workspace: The GeoServer workspace name (default: smartgeci)
    
    Returns:
        Dictionary containing:
            - min: Minimum value (excluding NoData)
            - max: Maximum value (excluding NoData)
            - mean: Mean value (excluding NoData)
            - std: Standard deviation (excluding NoData)
            - pixels: Count of valid (non-NoData) pixels
    
    Raises:
        requests.RequestException: If WCS request fails
        rasterio.errors.RasterioError: If raster reading fails
        ValueError: If coverage has no valid data
    """
    # Build WCS GetCoverage request URL
    wcs_url = f"{GEOSERVER_BASE_URL}/{workspace}/wcs"
    
    params = {
        'service': 'WCS',
        'version': '2.0.1',
        'request': 'GetCoverage',
        'coverageId': f"{workspace}__{coverage_id}",  # WCS 2.0.1 format: workspace__layer
        'format': 'image/geotiff'
    }
    
    # Download coverage into memory
    response = requests.get(wcs_url, params=params, timeout=30)
    response.raise_for_status()
    
    # Read GeoTIFF from memory using rasterio
    with MemoryFile(response.content) as memfile:
        with memfile.open() as dataset:
            # Read first band
            band_data = dataset.read(1)
            
            # Get NoData value from raster metadata
            nodata = dataset.nodata
            
            # Create mask for valid data
            if nodata is not None:
                # Check for both exact match and NaN values
                valid_mask = (band_data != nodata) & (~np.isnan(band_data))
            else:
                # If no NoData value defined, just check for NaN
                valid_mask = ~np.isnan(band_data)
            
            # Apply mask
            valid_data = band_data[valid_mask]
            
            # Check if we have any valid data
            if valid_data.size == 0:
                raise ValueError(f"Coverage '{coverage_id}' contains no valid data")
            
            # Compute statistics
            stats = {
                'min': float(np.min(valid_data)),
                'max': float(np.max(valid_data)),
                'mean': float(np.mean(valid_data)),
                'std': float(np.std(valid_data)),
                'pixels': int(valid_data.size)
            }
            
            return stats


def compute_raster_stats_with_bbox(
    coverage_id: str,
    bbox: tuple,
    workspace: str = DEFAULT_WORKSPACE,
    crs: str = "EPSG:4326"
) -> Dict[str, float]:
    """
    Compute statistics for a raster coverage within a bounding box.
    
    Args:
        coverage_id: The coverage identifier (layer name) in GeoServer
        bbox: Bounding box as (minx, miny, maxx, maxy)
        workspace: The GeoServer workspace name (default: smartgeci)
        crs: Coordinate reference system (default: EPSG:4326)
    
    Returns:
        Dictionary containing min, max, mean, std, pixels
    
    Raises:
        requests.RequestException: If WCS request fails
        rasterio.errors.RasterioError: If raster reading fails
        ValueError: If coverage has no valid data
    """
    # Build WCS GetCoverage request URL with subset
    wcs_url = f"{GEOSERVER_BASE_URL}/{workspace}/wcs"
    
    minx, miny, maxx, maxy = bbox
    
    params = {
        'service': 'WCS',
        'version': '2.0.1',
        'request': 'GetCoverage',
        'coverageId': f"{workspace}__{coverage_id}",
        'format': 'image/geotiff',
        'subset': [f'Long({minx},{maxx})', f'Lat({miny},{maxy})'],
        'subsettingCrs': crs
    }
    
    # Download coverage into memory
    response = requests.get(wcs_url, params=params, timeout=30)
    response.raise_for_status()
    
    # Read GeoTIFF from memory using rasterio
    with MemoryFile(response.content) as memfile:
        with memfile.open() as dataset:
            # Read first band
            band_data = dataset.read(1)
            
            # Get NoData value
            nodata = dataset.nodata
            
            # Create mask for valid data
            if nodata is not None:
                # Check for both exact match and NaN values
                valid_mask = (band_data != nodata) & (~np.isnan(band_data))
            else:
                # If no NoData value defined, just check for NaN
                valid_mask = ~np.isnan(band_data)
            
            # Apply mask
            valid_data = band_data[valid_mask]
            
            # Check if we have any valid data
            if valid_data.size == 0:
                raise ValueError(f"Coverage '{coverage_id}' contains no valid data in bounding box")
            
            # Compute statistics
            stats = {
                'min': float(np.min(valid_data)),
                'max': float(np.max(valid_data)),
                'mean': float(np.mean(valid_data)),
                'std': float(np.std(valid_data)),
                'pixels': int(valid_data.size)
            }
            
            return stats


if __name__ == "__main__":
    # Example usage
    try:
        print("Computing statistics for Idukki_LST layer...")
        stats = compute_raster_stats("Idukki_LST")
        print(f"Idukki_LST Statistics: {stats}")
        
        print("\nComputing statistics for Idukki_UHI layer...")
        stats = compute_raster_stats("Idukki_UHI")
        print(f"Idukki_UHI Statistics: {stats}")
        
    except Exception as e:
        print(f"Error: {e}")
