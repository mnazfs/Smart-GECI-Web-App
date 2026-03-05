import requests
def publish_aoi_shapefile_to_geoserver(unique_id: str, filename: str, workspace: str = "smartgeci") -> bool:
        """
        Publish uploaded AOI shapefile to GeoServer via REST API.
        - Creates a new datastore (type: Shapefile)
        - Publishes the layer and enables it
        """
        geoserver_rest_url = "http://localhost:8080/geoserver/rest"
        geoserver_user = "admin"
        geoserver_pass = "geoserver"
        datastore_name = f"aoi_{unique_id}"
        shapefile_url = f"file:data/aoi_uploads/{unique_id}/{filename}.shp"

        # 1. Create datastore
        ds_payload = f"""
        <dataStore>
            <name>{datastore_name}</name>
            <connectionParameters>
                <entry key='url'>{shapefile_url}</entry>
            </connectionParameters>
            <type>Shapefile</type>
        </dataStore>
        """
        ds_url = f"{geoserver_rest_url}/workspaces/{workspace}/datastores"
        ds_headers = {"Content-Type": "text/xml"}
        ds_resp = requests.post(ds_url, data=ds_payload, headers=ds_headers, auth=(geoserver_user, geoserver_pass))
        if ds_resp.status_code not in [201, 200]:
                print(f"Failed to create datastore: {ds_resp.text}")
                return False

        # 2. Publish layer (featuretype) with nativeCRS and enable
        layer_name = Path(filename).stem
        ft_payload = f"""
        <featureType>
            <name>{layer_name}</name>
            <nativeCRS>EPSG:4326</nativeCRS>
            <srs>EPSG:4326</srs>
            <enabled>true</enabled>
        </featureType>
        """
        ft_url = f"{geoserver_rest_url}/workspaces/{workspace}/datastores/{datastore_name}/featuretypes"
        ft_headers = {"Content-Type": "text/xml"}
        ft_resp = requests.post(ft_url, data=ft_payload, headers=ft_headers, auth=(geoserver_user, geoserver_pass))
        if ft_resp.status_code not in [201, 200]:
                print(f"Failed to publish layer: {ft_resp.text}")
                return False

        # 3. Recalculate bounding box and enable layer
        # Use PUT to update featuretype with bbox
        bbox_payload = f"""
        <featureType>
            <enabled>true</enabled>
            <nativeCRS>EPSG:4326</nativeCRS>
            <srs>EPSG:4326</srs>
            <recalculateBoundingBox>true</recalculateBoundingBox>
        </featureType>
        """
        bbox_url = f"{geoserver_rest_url}/workspaces/{workspace}/datastores/{datastore_name}/featuretypes/{layer_name}"
        bbox_resp = requests.put(bbox_url, data=bbox_payload, headers=ft_headers, auth=(geoserver_user, geoserver_pass))
        if bbox_resp.status_code not in [200, 201]:
                print(f"Failed to update bounding box: {bbox_resp.text}")
                return False

        print(f"AOI shapefile published and bounding box recalculated for layer: {layer_name}")
        return True
import uuid
import shutil
import subprocess
def move_shapefile_to_geoserver(extracted_dir: str) -> str:
    geoserver_data_dir = r"C:\ProgramData\GeoServer\data\aoi_uploads"
    unique_id = str(uuid.uuid4())
    target_dir = os.path.join(geoserver_data_dir, unique_id)
    os.makedirs(target_dir, exist_ok=True)

    # Move .shp, .dbf, .shx, .prj files, preserving names
    for fname in os.listdir(extracted_dir):
        if fname.lower().endswith(('.shp', '.dbf', '.shx', '.prj')):
            shutil.move(os.path.join(extracted_dir, fname), os.path.join(target_dir, fname))

    # Grant read access to Users group (GeoServer service user)
    subprocess.run(['icacls', target_dir, '/grant', 'Users:R', '/T'], check=True)

    return target_dir
"""
FastAPI Backend for GIS Dashboard

Provides REST API endpoints for raster analytics and statistics.
"""

import io
import os
import logging
import tempfile
import zipfile
from pathlib import Path
from typing import Optional, Literal

import geopandas as gpd
import numpy as np
import rasterio
import requests
from rasterio.io import MemoryFile
from shapely.geometry import shape, mapping
from shapely.validation import explain_validity

from fastapi import FastAPI, HTTPException, Query, Body, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from analytics.raster_stats import compute_raster_stats

# Configure logging for production demos
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


# Pydantic models for AOI analysis
class AOIAnalysisRequest(BaseModel):
    """Request model for AOI-based analysis"""
    geometry: dict = Field(
        ...,
        description="GeoJSON geometry object (Polygon or MultiPolygon)",
        examples=[{
            "type": "Polygon",
            "coordinates": [[[76.7, 9.88], [76.75, 9.88], [76.75, 9.90], [76.7, 9.90], [76.7, 9.88]]]
        }]
    )
    crs: str = Field(
        default="EPSG:4326",
        description="Coordinate Reference System (only EPSG:4326 supported)",
        pattern="^EPSG:4326$"
    )
    analysis_type: Literal["uhi"] = Field(
        default="uhi",
        description="Type of analysis to perform (currently only 'uhi' supported)"
    )
    
    @field_validator('geometry')
    @classmethod
    def validate_geometry(cls, v: dict) -> dict:
        """Validate that geometry is a valid GeoJSON Polygon or MultiPolygon"""
        # Check geometry type
        geom_type = v.get('type')
        if geom_type not in ['Polygon', 'MultiPolygon']:
            raise ValueError(
                f"Invalid geometry type: '{geom_type}'. Only Polygon and MultiPolygon are supported."
            )
        
        # Validate coordinates exist
        if 'coordinates' not in v:
            raise ValueError("Geometry must have 'coordinates' field")
        
        # Attempt to parse with Shapely to validate structure
        try:
            geom = shape(v)
            
            # Check if geometry is valid
            if not geom.is_valid:
                reason = explain_validity(geom)
                raise ValueError(f"Invalid geometry: {reason}")
            
            # Check if geometry is empty
            if geom.is_empty:
                raise ValueError("Geometry cannot be empty")
            
        except Exception as e:
            raise ValueError(f"Failed to parse geometry: {str(e)}")
        
        return v


app = FastAPI(
    title="GIS Dashboard API",
    description="Analytics API for Urban Heat Island mapping",
    version="1.0.0"
)

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "GIS Dashboard API",
        "version": "1.0.0"
    }


@app.get("/api/analytics/summary")
def get_analytics_summary():
    """
    Compute raster statistics for all layers.
    
    Returns statistics (min, max, mean, std, pixels) for:
    - LST (Land Surface Temperature from Idukki_LST layer)
    - NDVI (Normalized Difference Vegetation Index from Idukki_NDVI layer)
    - NDBI (Normalized Difference Built-up Index from Idukki_NDBI layer)
    - UHI (Urban Heat Island from Idukki_UHI layer)
    
    Returns:
        dict: Statistics for each layer with normalized keys
        
    Raises:
        HTTPException: If any layer computation fails
    """
    # Map frontend keys to GeoServer layer names
    layer_mapping = {
        "LST": "Idukki_LST",
        "NDVI": "Idukki_NDVI",
        "NDBI": "Idukki_NDBI",
        "UHI": "Idukki_UHI"
    }
    
    results = {}
    errors = {}
    
    for api_key, geoserver_layer in layer_mapping.items():
        try:
            stats = compute_raster_stats(geoserver_layer)
            results[api_key] = stats
        except Exception as e:
            errors[api_key] = str(e)
    
    # If all layers failed, return 500
    if not results and errors:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Failed to compute statistics for all layers",
                "errors": errors
            }
        )
    
    # If some layers succeeded, return results with optional errors
    response = results
    if errors:
        response["_errors"] = errors
    
    return response


@app.get("/api/analytics/layer/{layer_name}")
def get_layer_stats(layer_name: str):
    """
    Compute raster statistics for a specific layer.
    
    Args:
        layer_name: Name of the layer (Idukki_LST, Idukki_NDVI, Idukki_NDBI, or Idukki_UHI)
        
    Returns:
        dict: Statistics for the layer
        
    Raises:
        HTTPException: If layer computation fails
    """
    try:
        stats = compute_raster_stats(layer_name)
        return {
            "layer": layer_name,
            "statistics": stats
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"Failed to compute statistics for layer '{layer_name}'",
                "error": str(e)
            }
        )


def validate_point_within_aoi(
    lat: float,
    lon: float,
    geoserver_url: str = "http://localhost:8080/geoserver",
    workspace: str = "smartgeci",
    layer_name: str = "smartgeci_aoi"
) -> tuple[bool, Optional[str]]:
    """
    Validate if a point intersects the AOI polygon via GeoServer WFS.
    
    This is the ONLY spatial validation check performed. We do NOT use hardcoded
    bounding boxes because:
    - Raster CRS may differ from EPSG:4326 (lat/lon comparison becomes meaningless)
    - Hardcoded bounds can be out of sync with actual raster extent
    - GeoServer naturally returns None/NaN for points outside raster coverage
    
    Architecture:
    1. AOI polygon check (this function) - authoritative boundary
    2. Raster read operation - returns None if outside coverage (natural validation)
    3. No manual lat/lon range checks needed
    
    Args:
        lat: Latitude coordinate
        lon: Longitude coordinate
        geoserver_url: Base URL of GeoServer
        workspace: GeoServer workspace name
        layer_name: WFS layer name for the AOI polygon
        
    Returns:
        tuple: (is_valid, error_message)
            - is_valid: True if point intersects AOI, False otherwise
            - error_message: Error description if validation fails, None if valid
            
    Note:
        Uses POINT geometry with CQL_FILTER: INTERSECTS(geom, POINT(lon lat))
        EPSG:4326 axis order: longitude first, latitude second for POINT geometry
    """
    wfs_url = f"{geoserver_url}/{workspace}/wfs"
    
    # Construct CQL_FILTER with POINT geometry (lon, lat order for EPSG:4326)
    cql_filter = f"INTERSECTS(geom, POINT({lon} {lat}))"
    
    params = {
        'service': 'WFS',
        'version': '2.0.0',
        'request': 'GetFeature',
        'typeName': f"{workspace}:{layer_name}",
        'outputFormat': 'application/json',
        'CQL_FILTER': cql_filter
    }
    
    try:
        logger.info(f"AOI Validation: Checking point ({lat:.6f}, {lon:.6f}) against {workspace}:{layer_name}")
        logger.debug(f"WFS URL: {wfs_url}")
        logger.debug(f"CQL_FILTER: {cql_filter}")
        
        response = requests.get(wfs_url, params=params, timeout=15)
        
        # Check HTTP status
        if response.status_code != 200:
            # Special handling for 404/400 - layer doesn't exist or misconfigured, skip validation
            if response.status_code in [400, 404]:
                logger.warning(
                    f"⚠️ AOI layer '{workspace}:{layer_name}' unavailable (HTTP {response.status_code}). "
                    f"Skipping AOI validation - will rely on raster extent for spatial validation. "
                    f"This is normal if the AOI polygon layer hasn't been published yet."
                )
                return True, None  # Allow request to proceed without AOI validation
            
            # Other errors (500, 503, etc.) - report as validation failure
            error_msg = (
                f"GeoServer WFS returned HTTP {response.status_code}. "
                f"Unable to validate AOI boundary. Check that workspace '{workspace}' "
                f"and layer '{layer_name}' exist in GeoServer."
            )
            logger.error(f"❌ WFS AOI validation failed: {error_msg}")
            return False, error_msg
        
        # Parse GeoJSON response
        geojson = response.json()
        feature_count = len(geojson.get('features', []))
        
        logger.debug(f"WFS response: {feature_count} features returned")
        
        if feature_count == 0:
            logger.warning(f"⚠️ Point ({lat:.6f}, {lon:.6f}) is OUTSIDE the AOI boundary")
            return False, "Selected point is outside the AOI coverage"
        
        logger.info(f"✓ Point ({lat:.6f}, {lon:.6f}) is WITHIN the AOI boundary")
        return True, None
        
    except requests.RequestException as e:
        error_msg = (
            f"Failed to connect to GeoServer WFS for AOI validation: {str(e)}. "
            f"Ensure GeoServer is running at {geoserver_url}"
        )
        logger.error(f"❌ WFS connection error: {error_msg}")
        return False, error_msg
        
    except Exception as e:
        error_msg = f"Unexpected error during AOI validation: {type(e).__name__}: {str(e)}"
        logger.error(f"❌ AOI validation error: {error_msg}")
        return False, error_msg

def fetch_pixel_value_from_wcs(
    coverage_id: str,
    lat: float,
    lon: float,
    workspace: str = "smartgeci",
    geoserver_url: str = "http://localhost:8080/geoserver",
    window_size: int = 5
) -> Optional[float]:
    """
    Fetch mean pixel value from a spatial window around the clicked coordinate.
    
    Samples a small window (e.g., 5x5 pixels) instead of a single point to reduce
    NoData errors and spatial noise. Computes the mean of valid pixels in the window.
    
    Args:
        coverage_id: The coverage identifier (e.g., "smartgeci__Idukki_LST")
        lat: Latitude of the point
        lon: Longitude of the point
        workspace: GeoServer workspace name
        geoserver_url: Base URL of GeoServer
        window_size: Size of the sampling window in pixels (default: 5 for 5x5)
        
    Returns:
        The mean pixel value from the spatial window, or None if no valid pixels found
        
    Note:
        Returns None if all pixels in the window are NoData or outside coverage area
    """
    # Log incoming request
    logger.info(f"WCS Request for {coverage_id}: lat={lat:.6f}, lon={lon:.6f}, window={window_size}x{window_size}")
    
    wcs_url = f"{geoserver_url}/{workspace}/wcs"
    
    # Create a larger bounding box to capture a window of pixels
    # Approximate pixel size: 0.0001 degrees (~11m at equator)
    # For 5x5 window: buffer = 2.5 * 0.0001 = 0.00025 degrees
    pixel_size = 0.0001
    buffer = (window_size / 2.0) * pixel_size
    
    # WCS 2.0 with EPSG:4326 axis order:
    # EPSG:4326 officially defines axis order as (Latitude, Longitude), not (Lon, Lat).
    # While we use explicit axis names "Lat" and "Long" (which GeoServer interprets correctly),
    # the subset parameters should follow CRS axis order: Lat first, then Long.
    # This ensures compliance with OGC WCS 2.0 specification and prevents ambiguity.
    subset_lat = f"Lat({lat - buffer},{lat + buffer})"
    subset_lon = f"Long({lon - buffer},{lon + buffer})"
    
    params = {
        'service': 'WCS',
        'version': '2.0.1',
        'request': 'GetCoverage',
        'coverageId': coverage_id,
        'format': 'image/geotiff',
        'subset': [subset_lat, subset_lon]  # Lat first, then Long (EPSG:4326 axis order)
    }
    
    # Build and log the full WCS URL for debugging
    # Note: requests.get will properly encode the repeated 'subset' parameter
    try:
        from urllib.parse import urlencode
        # Manually encode to show the actual URL structure
        encoded_params = urlencode(params, doseq=True)
        full_url = f"{wcs_url}?{encoded_params}"
        logger.debug(f"WCS URL: {full_url}")
    except Exception:
        logger.debug(f"WCS URL: {wcs_url} (params encoding failed)")
    
    try:
        # Download coverage subset into memory
        response = requests.get(wcs_url, params=params, timeout=30)
        
        # Log HTTP response status
        logger.info(f"GeoServer response for {coverage_id}: HTTP {response.status_code}")
        
        # Check if GeoServer returned an error
        if response.status_code != 200:
            # Log detailed error information
            logger.warning(
                f"❌ GeoServer ERROR: {response.status_code} for {coverage_id} at "
                f"lat={lat:.6f}, lon={lon:.6f}. Response length: {len(response.content)} bytes. "
                f"Point may be outside raster coverage area or GeoServer encountered an error."
            )
            # Log response body for 500 errors (server errors)
            if response.status_code >= 500:
                logger.error(f"GeoServer 5xx Error Body (first 500 chars): {response.text[:500]}")
            return None
        
        # Log successful response
        logger.debug(f"✓ Received GeoTIFF response: {len(response.content)} bytes")
        
        # Read GeoTIFF from memory
        with MemoryFile(response.content) as memfile:
            with memfile.open() as dataset:
                # Read first band
                band_data = dataset.read(1)
                nodata = dataset.nodata
                
                logger.debug(f"Raster dimensions: {band_data.shape}, NoData value: {nodata}")
                
                # Filter out NoData values and NaN
                if nodata is not None:
                    # Create mask: True for valid pixels, False for NoData/NaN
                    valid_mask = (band_data != nodata) & ~np.isnan(band_data)
                    valid_pixels = band_data[valid_mask]
                else:
                    # No NoData value defined, just filter NaN
                    valid_pixels = band_data[~np.isnan(band_data)]
                
                # Check if we have any valid pixels
                if len(valid_pixels) == 0:
                    logger.warning(
                        f"⚠️ NoData: All pixels in {window_size}x{window_size} window are NoData/NaN "
                        f"for {coverage_id} at lat={lat:.6f}, lon={lon:.6f}"
                    )
                    return None
                
                # Compute mean of valid pixels
                mean_value = float(np.mean(valid_pixels))
                
                logger.info(
                    f"✓ Valid data: Sampled {len(valid_pixels)}/{window_size*window_size} pixels "
                    f"for {coverage_id}, mean={mean_value:.3f}"
                )
                
                return mean_value
                
    except requests.RequestException as e:
        # Network or connection error
        logger.error(f"❌ Network error for {coverage_id} at lat={lat:.6f}, lon={lon:.6f}: {str(e)}")
        return None
    except Exception as e:
        # Raster reading error or other issues
        logger.error(f"❌ Raster processing error for {coverage_id}: {type(e).__name__}: {str(e)}")
        return None


def classify_uhi(uhi_class_value: Optional[int]) -> dict:
    """
    Map UHI_CLASS raster value to human-readable UHI classification.
    
    The UHI classification is determined by the GeoServer raster layer
    `smartgeci:Idukki_UHI`, which is the single source of truth for UHI intensity.
    This function translates the pixel value into a readable format.
    
    IMPORTANT: Raster encoding mapping (adjust based on your actual data):
    - Values < 5: Low UHI (cooling zones)
    - Values 5-9: Moderate UHI (potential heat accumulation)
    - Values >= 10: High UHI (urban heat hotspots)
    
    If your raster uses different encoding (e.g., exact values 0/1/2), 
    adjust the thresholds below accordingly.
    
    Args:
        uhi_class_value: Pixel value from UHI raster (numeric or None)
        
    Returns:
        dict: {
            "uhi_class": Mapped numeric value (0, 1, 2, or None),
            "uhi_label": Human-readable label ("Low", "Moderate", "High", or "Unknown"),
            "uhi_description": Brief description of zone characteristics
        }
    """
    # Handle missing data
    if uhi_class_value is None:
        return {
            "uhi_class": None,
            "uhi_label": "Unknown",
            "uhi_description": "UHI classification data unavailable"
        }
    
    # Convert to float for range comparison
    raw_value = float(uhi_class_value)
    
    # Map raster value to classification using range-based logic
    # Adjust these thresholds based on your actual raster value distribution
    if raw_value < 5:
        # Low UHI intensity (cooling zones)
        return {
            "uhi_class": 0,
            "uhi_label": "Low",
            "uhi_description": "Acts as a cooling or neutral zone"
        }
    elif raw_value < 10:
        # Moderate UHI intensity (potential heat accumulation)
        return {
            "uhi_class": 1,
            "uhi_label": "Moderate",
            "uhi_description": "Potential heat accumulation zone"
        }
    else:
        # High UHI intensity (urban heat hotspots)
        return {
            "uhi_class": 2,
            "uhi_label": "High",
            "uhi_description": "Urban heat hotspot requiring mitigation"
        }


def fetch_aoi_raster_from_wcs(
    coverage_id: str,
    geometry: dict,
    workspace: str = "smartgeci",
    geoserver_url: str = "http://localhost:8080/geoserver"
) -> Optional[np.ndarray]:
    """
    Fetch raster data clipped to AOI geometry using GeoServer WCS.
    
    Uses WCS GetCoverage with CLIP parameter to extract only the raster
    pixels within the provided geometry. Returns a numpy array of valid
    pixel values for statistical analysis.
    
    Args:
        coverage_id: The coverage identifier (e.g., "smartgeci__Idukki_UHI")
        geometry: GeoJSON geometry object (Polygon or MultiPolygon)
        workspace: GeoServer workspace name
        geoserver_url: Base URL of GeoServer
        
    Returns:
        numpy.ndarray: Array of valid pixel values (NoData filtered), or None if request fails
        
    Note:
        Uses WCS 2.0.1 with CLIP extension to clip raster to AOI boundary
    """
    logger.info(f"WCS GetCoverage request for {coverage_id} with AOI clip")
    
    wcs_url = f"{geoserver_url}/{workspace}/wcs"
    
    # Convert GeoJSON geometry to WKT for CLIP parameter
    try:
        from shapely.geometry import shape
        from shapely import wkt
        
        geom = shape(geometry)
        geom_wkt = wkt.dumps(geom)
        
        # Get bounding box for subset parameters
        minx, miny, maxx, maxy = geom.bounds
        logger.info(f"AOI bounds: [{minx:.6f}, {miny:.66f}, {maxx:.6f}, {maxy:.6f}]")
        
    except Exception as e:
        logger.error(f"Failed to process geometry for WCS: {e}")
        return None
    
    # WCS 2.0.1 GetCoverage with CLIP
    # Note: CLIP is a WCS extension that may require specific GeoServer configuration
    params = {
        'service': 'WCS',
        'version': '2.0.1',
        'request': 'GetCoverage',
        'coverageId': coverage_id,
        'format': 'image/geotiff',
        'subset': [
            f"Lat({miny},{maxy})",
            f"Long({minx},{maxx})"
        ]
    }
    
    # Add CLIP parameter if supported by GeoServer
    # This requires the WCS CLIP extension to be enabled
    try:
        # Try with CLIP parameter (GeoServer 2.15+)
        clip_params = params.copy()
        clip_params['CLIP'] = geom_wkt
        clip_params['CLIPCRS'] = 'EPSG:4326'
        
        logger.debug(f"Attempting WCS GetCoverage with CLIP")
        
        response = requests.get(wcs_url, params=clip_params, timeout=60)
        
        # If CLIP not supported, fall back to bounding box only
        if response.status_code != 200:
            logger.warning(f"WCS CLIP parameter not supported or failed (HTTP {response.status_code}). Falling back to bbox subset.")
            response = requests.get(wcs_url, params=params, timeout=60)
        
        if response.status_code != 200:
            logger.error(f"WCS GetCoverage failed: HTTP {response.status_code}")
            logger.error(f"Response: {response.text[:500]}")
            return None
        
        logger.info(f"Received GeoTIFF response: {len(response.content)} bytes")
        
        # Read GeoTIFF from memory
        with MemoryFile(response.content) as memfile:
            with memfile.open() as dataset:
                # Read first band
                band_data = dataset.read(1)
                nodata = dataset.nodata
                
                logger.info(f"Raster dimensions: {band_data.shape}")
                logger.info(f"NoData value: {nodata}")
                
                # Filter out NoData values and NaN
                if nodata is not None:
                    valid_mask = (band_data != nodata) & ~np.isnan(band_data)
                    valid_pixels = band_data[valid_mask]
                else:
                    valid_pixels = band_data[~np.isnan(band_data)]
                
                # Check if we have valid pixels
                if len(valid_pixels) == 0:
                    logger.warning(f"No valid pixels found in AOI for {coverage_id}")
                    return None
                
                logger.info(f"Extracted {len(valid_pixels)} valid pixels from AOI")
                
                return valid_pixels
                
    except requests.RequestException as e:
        logger.error(f"Network error during WCS request: {e}")
        return None
    except Exception as e:
        logger.error(f"Error processing WCS response: {type(e).__name__}: {e}")
        return None


def compute_aoi_statistics(pixel_values: np.ndarray) -> dict:
    """
    Compute statistical metrics for AOI raster data.
    
    Args:
        pixel_values: Array of valid pixel values
        
    Returns:
        dict: Statistics including min, max, mean, median, std, count
    """
    if pixel_values is None or len(pixel_values) == 0:
        return {
            "min": None,
            "max": None,
            "mean": None,
            "median": None,
            "std": None,
            "count": 0
        }
    
    return {
        "min": float(np.min(pixel_values)),
        "max": float(np.max(pixel_values)),
        "mean": float(np.mean(pixel_values)),
        "median": float(np.median(pixel_values)),
        "std": float(np.std(pixel_values)),
        "count": int(len(pixel_values))
    }


def analyze_uhi_class_distribution(uhi_pixels: np.ndarray) -> dict:
    """
    Analyze UHI_CLASS pixel distribution and compute classification metrics.
    
    UHI_CLASS encoding (based on raster value ranges):
    - Class 0 (Low): values < 5
    - Class 1 (Moderate): values 5-9
    - Class 2 (High): values >= 10
    
    Args:
        uhi_pixels: Array of UHI_CLASS pixel values (NoData already filtered)
        
    Returns:
        dict: {
            "count_low": Number of Low UHI pixels,
            "count_moderate": Number of Moderate UHI pixels,
            "count_high": Number of High UHI pixels,
            "percentage_low": Percentage of Low UHI pixels,
            "percentage_moderate": Percentage of Moderate UHI pixels,
            "percentage_high": Percentage of High UHI pixels,
            "dominant_class": "Low", "Moderate", or "High",
            "severity_index": Weighted severity score (0.0 to 1.0),
            "total_pixels": Total valid pixels analyzed
        }
    """
    if uhi_pixels is None or len(uhi_pixels) == 0:
        return {
            "count_low": 0,
            "count_moderate": 0,
            "count_high": 0,
            "percentage_low": 0.0,
            "percentage_moderate": 0.0,
            "percentage_high": 0.0,
            "dominant_class": "Unknown",
            "severity_index": 0.0,
            "total_pixels": 0
        }
    
    # Classify pixels based on value ranges
    # Low: < 5, Moderate: 5-9, High: >= 10
    count_low = int(np.sum(uhi_pixels < 5))
    count_moderate = int(np.sum((uhi_pixels >= 5) & (uhi_pixels < 10)))
    count_high = int(np.sum(uhi_pixels >= 10))
    
    total_pixels = len(uhi_pixels)
    
    # Compute percentages
    percentage_low = (count_low / total_pixels * 100) if total_pixels > 0 else 0.0
    percentage_moderate = (count_moderate / total_pixels * 100) if total_pixels > 0 else 0.0
    percentage_high = (count_high / total_pixels * 100) if total_pixels > 0 else 0.0
    
    # Determine dominant class
    counts = {
        "Low": count_low,
        "Moderate": count_moderate,
        "High": count_high
    }
    dominant_class = max(counts, key=counts.get) if total_pixels > 0 else "Unknown"
    
    # Compute severity index (weighted score: Low=0, Moderate=0.5, High=1.0)
    # severity_index = (0*count_low + 0.5*count_moderate + 1.0*count_high) / total_pixels
    severity_index = (0.5 * count_moderate + 1.0 * count_high) / total_pixels if total_pixels > 0 else 0.0
    
    logger.info(f"UHI Class Distribution:")
    logger.info(f"  - Low: {count_low} pixels ({percentage_low:.1f}%)")
    logger.info(f"  - Moderate: {count_moderate} pixels ({percentage_moderate:.1f}%)")
    logger.info(f"  - High: {count_high} pixels ({percentage_high:.1f}%)")
    logger.info(f"  - Dominant: {dominant_class}")
    logger.info(f"  - Severity Index: {severity_index:.3f}")
    
    return {
        "count_low": count_low,
        "count_moderate": count_moderate,
        "count_high": count_high,
        "percentage_low": round(percentage_low, 2),
        "percentage_moderate": round(percentage_moderate, 2),
        "percentage_high": round(percentage_high, 2),
        "dominant_class": dominant_class,
        "severity_index": round(severity_index, 3),
        "total_pixels": total_pixels
    }


def generate_aoi_recommendations(uhi_distribution: dict, area_sq_km: float) -> dict:
    """
    Generate AOI-level recommendations based on UHI class distribution.
    
    Uses percentage-based rules to classify the overall AOI thermal profile
    and provide actionable recommendations.
    
    Classification Rules:
    - Severe Heat Action Zone: percentage_high > 40%
    - Heat Mitigation Priority: percentage_high + percentage_moderate > 60%
    - Conservation Priority Zone: percentage_low > 70%
    - Mixed Urban Thermal Zone: All other cases
    
    Args:
        uhi_distribution: UHI class distribution metrics from analyze_uhi_class_distribution
        area_sq_km: Area of AOI in square kilometers
        
    Returns:
        dict: {
            "zone_type": Classification label,
            "title": Recommendation title,
            "explanation": Detailed explanation and action items,
            "priority_level": "Critical", "High", "Moderate", or "Low",
            "key_actions": List of specific action items
        }
    """
    pct_high = uhi_distribution.get('percentage_high', 0)
    pct_moderate = uhi_distribution.get('percentage_moderate', 0)
    pct_low = uhi_distribution.get('percentage_low', 0)
    severity_index = uhi_distribution.get('severity_index', 0)
    
    logger.info(f"Generating AOI recommendations based on distribution:")
    logger.info(f"  - High: {pct_high:.1f}%, Moderate: {pct_moderate:.1f}%, Low: {pct_low:.1f}%")
    
    # Rule 1: Severe Heat Action Zone (>40% high UHI)
    if pct_high > 40:
        logger.info("→ Classification: Severe Heat Action Zone")
        return {
            "zone_type": "Severe Heat Action Zone",
            "title": "🚨 CRITICAL: Severe Urban Heat Island - Immediate Intervention Required",
            "explanation": (
                f"This {area_sq_km:.2f} km² area exhibits severe heat stress with {pct_high:.1f}% "
                f"classified as High UHI intensity. This represents a critical public health risk "
                f"requiring immediate cooling interventions. The severity index of {severity_index:.2f} "
                f"indicates an urgent need for comprehensive heat mitigation strategies."
            ),
            "priority_level": "Critical",
            "key_actions": [
                "🏗️ EMERGENCY COOLING DEPLOYMENT: Install emergency shade structures (tensile fabrics, pop-up canopies) "
                "and activate misting stations at pedestrian gathering points within 30 days.",
                
                "🌳 RAPID URBAN FORESTRY BLITZ: Launch accelerated tree planting campaign targeting 500+ mature native trees "
                f"across the {area_sq_km:.2f} km² zone. Prioritize containerized mature specimens for immediate canopy coverage.",
                
                "🏢 MANDATORY COOL ROOF PROGRAM: Enforce white/reflective roof installations on commercial and public buildings. "
                "Offer subsidized cool roof coatings for residential structures to reduce surface heat absorption.",
                
                "💧 WATER FEATURE INTEGRATION: Deploy evaporative cooling infrastructure including bioswales, rain gardens, "
                "and permeable pavement to reduce runoff and create cooling microclimates.",
                
                "📊 CONTINUOUS THERMAL MONITORING: Establish real-time temperature sensor network to track intervention "
                "effectiveness and guide adaptive management strategies."
            ]
        }
    
    # Rule 2: Heat Mitigation Priority (>60% high+moderate)
    if (pct_high + pct_moderate) > 60:
        logger.info("→ Classification: Heat Mitigation Priority")
        return {
            "zone_type": "Heat Mitigation Priority",
            "title": "⚠️ HIGH PRIORITY: Heat Accumulation Zone - Targeted Mitigation Required",
            "explanation": (
                f"This {area_sq_km:.2f} km² area shows significant heat accumulation with {pct_high + pct_moderate:.1f}% "
                f"classified as Moderate-to-High UHI intensity ({pct_high:.1f}% High, {pct_moderate:.1f}% Moderate). "
                f"Without intervention, thermal conditions will likely intensify. The severity index of {severity_index:.2f} "
                f"indicates proactive mitigation is essential to prevent escalation to severe heat stress."
            ),
            "priority_level": "High",
            "key_actions": [
                "🌱 STRATEGIC GREENING PROGRAM: Expand urban tree canopy coverage to 30-40% through systematic street tree "
                f"planting across {area_sq_km:.2f} km². Focus on heat-vulnerable corridors and parking areas.",
                
                "🏙️ GREEN INFRASTRUCTURE NETWORK: Create interconnected green corridors linking parks and vegetated spaces "
                "to enhance cooling air circulation and reduce heat island formation.",
                
                "🏠 COOL SURFACE INITIATIVE: Implement cool pavement programs for high-traffic areas and parking lots. "
                "Apply reflective coatings to reduce surface temperatures by 10-15°C.",
                
                "🌿 COMMUNITY GREENING INCENTIVES: Launch residential yard greening programs with native plant subsidies. "
                "Promote vertical gardens and green walls on building facades.",
                
                "📈 HEAT TREND MONITORING: Conduct seasonal thermal assessments using remote sensing to track mitigation "
                "effectiveness and adjust strategies based on measurable cooling outcomes."
            ]
        }
    
    # Rule 3: Conservation Priority Zone (>70% low UHI)
    if pct_low > 70:
        logger.info("→ Classification: Conservation Priority Zone")
        return {
            "zone_type": "Conservation Priority Zone",
            "title": "✅ CONSERVATION PRIORITY: Critical Cooling Asset - Protection Required",
            "explanation": (
                f"This {area_sq_km:.2f} km² area functions as a vital cooling corridor with {pct_low:.1f}% "
                f"classified as Low UHI intensity. This zone provides essential thermal regulation services "
                f"that benefit surrounding areas. The low severity index of {severity_index:.2f} confirms excellent "
                f"natural cooling capacity that must be preserved through strict conservation policies."
            ),
            "priority_level": "Moderate",
            "key_actions": [
                "🛡️ STRICT VEGETATION PROTECTION ORDINANCE: Implement tree removal permits requiring 3:1 replacement ratios. "
                "Prohibit any net loss of vegetated area through development regulations.",
                
                "🌳 ECOLOGICAL CORRIDOR DESIGNATION: Formally designate this zone as a protected cooling corridor in urban plans. "
                "Prevent impervious surface expansion and maintain current land-use patterns.",
                
                "🏞️ GREEN SPACE ENHANCEMENT: Where possible, increase vegetation density through native species plantings "
                "to strengthen existing cooling capacity without altering land use.",
                
                "📋 CONSERVATION EASEMENTS: Establish voluntary conservation agreements with property owners to maintain "
                "vegetated landscapes. Offer tax incentives for preservation of natural cooling features.",
                
                "🔍 LONG-TERM MONITORING: Conduct annual thermal assessments to ensure conservation status is maintained. "
                "Early detection of thermal degradation allows rapid intervention before cooling capacity is compromised."
            ]
        }
    
    # Rule 4: Mixed Urban Thermal Zone (default)
    logger.info("→ Classification: Mixed Urban Thermal Zone")
    return {
        "zone_type": "Mixed Urban Thermal Zone",
        "title": "📊 BALANCED MANAGEMENT: Mixed Thermal Profile - Adaptive Strategy Required",
        "explanation": (
            f"This {area_sq_km:.2f} km² area exhibits a mixed thermal profile with varied UHI intensities "
            f"({pct_high:.1f}% High, {pct_moderate:.1f}% Moderate, {pct_low:.1f}% Low). The heterogeneous "
            f"thermal landscape requires spatially-targeted interventions focusing on localized heat hotspots "
            f"while preserving existing cooling zones. The severity index of {severity_index:.2f} suggests "
            f"a balanced approach combining mitigation and conservation strategies."
        ),
        "priority_level": "Moderate",
        "key_actions": [
            "🎯 SPATIAL TARGETING: Use high-resolution thermal mapping to identify and prioritize specific heat hotspots "
            f"within the {area_sq_km:.2f} km² zone for focused cooling interventions.",
            
            "🌳 SELECTIVE GREENING: Deploy strategic tree planting in identified heat accumulation pockets. "
            "Focus on areas with low vegetation and high built-up density.",
            
            "🔄 HYBRID APPROACH: Combine aggressive cooling measures in high-UHI zones with conservation practices "
            "in low-UHI zones to optimize resource allocation and maximize cooling benefits.",
            
            "🏘️ NEIGHBORHOOD-SCALE INTERVENTIONS: Implement block-by-block cooling strategies tailored to local "
            "thermal conditions. Engage residents in identifying priority areas for green infrastructure.",
            
            "📊 ADAPTIVE MANAGEMENT: Conduct quarterly thermal assessments to track spatial changes in UHI distribution. "
            "Adjust intervention priorities based on evolving heat patterns and mitigation effectiveness."
        ]
    }


def generate_recommendations(
    lst: Optional[float],
    ndvi: Optional[float],
    ndbi: Optional[float],
    uhi_label: str
) -> list:
    """
    Generate UHI class-specific recommendations for urban heat mitigation.
    
    Recommendations depend ONLY on the UHI classification from the raster layer.
    LST, NDVI, and NDBI are not used for decision logic.
    
    Mapping rules:
    - "High" (uhi_class = 2) → Severe Urban Heat Island - Aggressive interventions
    - "Moderate" (uhi_class = 1) → Heat Accumulation Zone - Targeted mitigation
    - "Low" (uhi_class = 0) → Cooling/Conservation Zone - Maintenance and protection
    
    Args:
        lst: Land Surface Temperature in Celsius (unused, for potential future enhancement)
        ndvi: Normalized Difference Vegetation Index (unused, for potential future enhancement)
        ndbi: Normalized Difference Built-up Index (unused, for potential future enhancement)
        uhi_label: UHI classification label ("High", "Moderate", "Low", or "Unknown")
        
    Returns:
        List of recommendation strings (empty if Unknown class)
    """
    recommendations = []
    
    # Handle Unknown classification (insufficient data)
    if uhi_label == "Unknown":
        logger.info("No recommendations for Unknown UHI classification")
        return []
    
    # HIGH UHI (uhi_class = 2): Severe Urban Heat Island
    # Aggressive cooling and greening actions required
    if uhi_label == "High":
        logger.info(f"Generating AGGRESSIVE recommendations for High UHI (class=2)")
        
        recommendations.append(
            "⚠️ CRITICAL ACTION REQUIRED: Deploy rapid urban cooling strategies immediately. "
            "Install emergency shade structures (tensile fabrics, pergolas), activate misting stations, "
            "apply reflective coatings to pavements and rooftops, and establish cooling centers for public safety."
        )
        
        recommendations.append(
            "🌳 ACCELERATED GREENING MANDATE: Launch intensive urban forestry campaign with fast-growing native species. "
            "Create instant green corridors using containerized mature trees, install modular green walls on buildings, "
            "and establish pop-up pocket parks with shade canopies to rapidly introduce evapotranspirative cooling."
        )
        
        recommendations.append(
            "🏗️ INFRASTRUCTURE RETROFIT PROGRAM: Transform heat-absorbing surfaces into cooling assets. "
            "Mandate white/cool roof installations on commercial buildings, convert parking lots to permeable green parking, "
            "implement bioswale networks for stormwater cooling, and integrate water features for evaporative temperature reduction."
        )
        
        logger.info(f"Generated {len(recommendations)} AGGRESSIVE intervention recommendations")
        return recommendations
    
    # MODERATE UHI (uhi_class = 1): Heat Accumulation Zone
    # Targeted mitigation and monitoring
    if uhi_label == "Moderate":
        logger.info(f"Generating TARGETED recommendations for Moderate UHI (class=1)")
        
        recommendations.append(
            "📊 TARGETED MITIGATION: Implement strategic cooling interventions to prevent escalation. "
            "Expand tree canopy coverage to 30-40% through systematic street tree planting, establish green corridors "
            "connecting parks, and deploy cool roof programs prioritizing high-exposure buildings."
        )
        
        recommendations.append(
            "🌱 VEGETATION ENHANCEMENT PLAN: Address cooling capacity deficit with multi-scale greening. "
            "Plant shade trees along pedestrian routes, create neighborhood micro-forests (Miyawaki method), "
            "establish vegetated buffer zones between built-up areas, and incentivize residential yard greening."
        )
        
        recommendations.append(
            "🔍 CONTINUOUS MONITORING PROTOCOL: Track thermal trends to guide adaptive management. "
            "Install temperature sensors at key locations, monitor seasonal heat patterns via remote sensing, "
            "assess vegetation health changes, and adjust mitigation strategies based on real-time data to prevent UHI intensification."
        )
        
        logger.info(f"Generated {len(recommendations)} TARGETED mitigation recommendations")
        return recommendations
    
    # LOW UHI (uhi_class = 0): Cooling/Conservation Zone
    # Maintenance and protection of existing cooling capacity
    if uhi_label == "Low":
        logger.info(f"Generating CONSERVATION recommendations for Low UHI (class=0)")
        
        recommendations.append(
            "✅ CONSERVATION PRIORITY ZONE: This area functions as a critical cooling asset with excellent thermal regulation. "
            "Implement strict protection policies: prohibit tree removal without replacement permits, establish vegetated area "
            "preservation ordinances, prevent impervious surface expansion, and designate as an ecological cooling corridor. "
            "Maintain current land-use patterns and green infrastructure to preserve natural cooling capacity that benefits surrounding areas."
        )
        
        logger.info(f"Generated {len(recommendations)} CONSERVATION recommendations")
        return recommendations
    
    # Should not reach here if UHI classification logic is correct
    logger.warning(f"Unexpected UHI label '{uhi_label}' - no recommendations generated")
    return []


@app.get("/api/analysis/location")
def get_location_analysis(
    lat: float = Query(..., description="Latitude in decimal degrees"),
    lon: float = Query(..., description="Longitude in decimal degrees")
):
    """
    Get raster values at a specific location from GeoServer WCS coverages.
    
    Fetches single-pixel values for LST, NDVI, and NDBI at the given coordinates
    and classifies UHI intensity.
    
    Args:
        lat: Latitude coordinate
        lon: Longitude coordinate
        
    Returns:
        dict: Location analysis containing lat, lon, lst, ndvi, ndbi, and uhi_class
        
    Raises:
        HTTPException: If WCS requests fail or coordinates are invalid
    """
    try:
        # Log incoming request
        logger.info(f"\n{'='*60}")
        logger.info(f"Location Analysis Request: lat={lat:.6f}, lon={lon:.6f}")
        logger.info(f"{'='*60}")
        
        # VALIDATION FLOW:
        # STEP 1: Validate point is within AOI polygon via WFS (authoritative boundary)
        # STEP 2: Extract raster pixel values via WCS (LST, NDVI, NDBI)
        # STEP 3: If raster returns None/NaN, handle as nodata (natural spatial validation)
        # STEP 4: Classify UHI and generate recommendations
        
        # STEP 1: Validate point is within AOI polygon boundary (WFS check)
        is_valid, error_message = validate_point_within_aoi(lat, lon)
        
        if not is_valid:
            logger.error(f"AOI validation failed: {error_message}")
            raise HTTPException(
                status_code=400,
                detail={
                    "error": error_message or "Selected point is outside the AOI coverage"
                }
            )
        
        if error_message is None:
            # AOI validation passed or was skipped
            logger.info("Point is within AOI boundary (or AOI validation skipped) - proceeding with raster extraction")
        else:
            logger.info("AOI validation was skipped - proceeding with raster extraction")
        
        # STEP 2: Fetch pixel values from each coverage
        # UHI_CLASS is REQUIRED - the authoritative classification source
        # LST, NDVI, NDBI are OPTIONAL - fetched for informational display only
        uhi_class = fetch_pixel_value_from_wcs("smartgeci__Idukki_UHI", lat, lon)
        lst = fetch_pixel_value_from_wcs("smartgeci__Idukki_LST", lat, lon)
        ndvi = fetch_pixel_value_from_wcs("smartgeci__Idukki_NDVI", lat, lon)
        ndbi = fetch_pixel_value_from_wcs("smartgeci__Idukki_NDBI", lat, lon)
        
        # Log fetched raster values
        logger.info(f"Input Raster Values:")
        logger.info(f"  - UHI_CLASS: {int(uhi_class)}" if uhi_class is not None else "  - UHI_CLASS: None (CRITICAL - outside coverage or NoData)")
        logger.info(f"  - LST:  {lst:.2f}°C" if lst is not None else "  - LST:  None (optional - outside coverage or NoData)")
        logger.info(f"  - NDVI: {ndvi:.3f}" if ndvi is not None else "  - NDVI: None (optional - outside coverage or NoData)")
        logger.info(f"  - NDBI: {ndbi:.3f}" if ndbi is not None else "  - NDBI: None (optional - outside coverage or NoData)")
        
        # STEP 3: Check if UHI_CLASS is available (REQUIRED for analysis)
        # UHI_CLASS is the single source of truth - without it, analysis cannot proceed
        if uhi_class is None:
            logger.warning(
                f"UHI raster value is None for point ({lat:.6f}, {lon:.6f}). "
                f"Point is outside UHI raster coverage (not a server error)."
            )
            return {
                "lat": lat,
                "lon": lon,
                "data_status": "outside_coverage",
                "message": "Location outside UHI raster coverage",
                "lst": lst,  # Include optional values if available
                "ndvi": ndvi,
                "ndbi": ndbi,
                "uhi_class": None,
                "uhi_label": "Unknown",
                "uhi_description": "Outside coverage area",
                "recommendations": []
            }
        
        # Log optional data availability (for informational purposes only)
        missing_optional = []
        if lst is None:
            missing_optional.append("LST")
        if ndvi is None:
            missing_optional.append("NDVI")
        if ndbi is None:
            missing_optional.append("NDBI")
        
        if missing_optional:
            logger.info(f"Optional data missing (non-critical): {', '.join(missing_optional)}")
        
        # Classify UHI using the UHI_CLASS raster layer (authoritative source)
        uhi_result = classify_uhi(uhi_class)
        logger.info(f"UHI Classification: {uhi_result['uhi_label']} (class value: {uhi_result['uhi_class']})")
        
        # Generate recommendations based on UHI class label
        # Optional raster values (LST, NDVI, NDBI) can enhance recommendations if available
        recommendations = generate_recommendations(lst, ndvi, ndbi, uhi_result['uhi_label'])
        
        # Log final recommendations
        logger.info(f"Final Recommendations ({len(recommendations)}):")
        for idx, rec in enumerate(recommendations, 1):
            # Truncate long recommendations for readability
            rec_preview = rec[:80] + '...' if len(rec) > 80 else rec
            logger.info(f"  {idx}. {rec_preview}")
        logger.info(f"{'='*60}\n")
        
        return {
            "lat": lat,
            "lon": lon,
            "data_status": "ok",
            "lst": lst,
            "ndvi": ndvi,
            "ndbi": ndbi,
            "uhi_class": uhi_result["uhi_class"],
            "uhi_label": uhi_result["uhi_label"],
            "uhi_description": uhi_result["uhi_description"],
            "recommendations": recommendations
        }
    
    except HTTPException:
        # Re-raise HTTPExceptions (like our 404 above)
        raise
    except requests.RequestException as e:
        # Log detailed error for debugging
        logger.error(f"Network error connecting to GeoServer: {e}")
        
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Failed to connect to GeoServer. Ensure GeoServer is running at http://localhost:8080/geoserver",
                "error": str(e),
                "hint": "Verify GeoServer is running and workspace 'smartgeci' exists with Idukki_LST, Idukki_NDVI, Idukki_NDBI layers"
            }
        )
    except Exception as e:
        logger.error(f"Unexpected error in location analysis: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Failed to analyze location",
                "error": str(e)
            }
        )


@app.post("/api/analysis/aoi")
def analyze_aoi(request: AOIAnalysisRequest = Body(...)):
    """
    Analyze Area of Interest (AOI) using GeoJSON geometry.
    
    Validates the input geometry and CRS, then performs the requested analysis.
    Currently supports UHI (Urban Heat Island) analysis only.
    
    Args:
        request: AOIAnalysisRequest containing:
            - geometry: GeoJSON Polygon or MultiPolygon
            - crs: Coordinate Reference System (must be EPSG:4326)
            - analysis_type: Type of analysis (currently only "uhi")
    
    Returns:
        dict: Analysis results including:
            - geometry: Input geometry
            - crs: Input CRS
            - analysis_type: Type of analysis performed
            - status: Analysis status
            - area_sq_km: Area of AOI in square kilometers
            - statistics: Computed statistics for the AOI
    
    Raises:
        HTTPException: If validation fails or analysis encounters errors
    """
    try:
        logger.info(f"\n{'='*60}")
        logger.info(f"AOI Analysis Request")
        logger.info(f"  - Geometry Type: {request.geometry.get('type')}")
        logger.info(f"  - CRS: {request.crs}")
        logger.info(f"  - Analysis Type: {request.analysis_type}")
        logger.info(f"{'='*60}")
        
        # Parse geometry with Shapely
        try:
            geom = shape(request.geometry)
            logger.info(f"Geometry parsed successfully: {geom.geom_type}")
            logger.info(f"  - Valid: {geom.is_valid}")
            logger.info(f"  - Bounds: {geom.bounds}")
        except Exception as e:
            logger.error(f"Failed to parse geometry: {e}")
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Invalid geometry",
                    "message": str(e)
                }
            )
        
        # Validate CRS is EPSG:4326
        if request.crs != "EPSG:4326":
            logger.error(f"Invalid CRS: {request.crs}")
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Invalid CRS",
                    "message": f"Only EPSG:4326 is supported, received: {request.crs}"
                }
            )
        
        # Calculate area in square kilometers
        # Note: For EPSG:4326, this is an approximation
        # For accurate area calculation, reproject to a projected CRS
        from shapely.ops import transform
        import pyproj
        
        # Create transformer from WGS84 to Web Mercator for area calculation
        wgs84 = pyproj.CRS('EPSG:4326')
        web_mercator = pyproj.CRS('EPSG:3857')
        project = pyproj.Transformer.from_crs(wgs84, web_mercator, always_xy=True).transform
        
        # Transform and calculate area
        geom_projected = transform(project, geom)
        area_sq_m = geom_projected.area
        area_sq_km = area_sq_m / 1_000_000
        
        logger.info(f"AOI Area: {area_sq_km:.2f} km²")
        
        # Perform analysis based on analysis_type
        if request.analysis_type == "uhi":
            logger.info("Performing UHI analysis for AOI...")
            
            # Fetch raster data clipped to AOI geometry
            logger.info("Fetching UHI_CLASS raster from GeoServer WCS...")
            uhi_pixels = fetch_aoi_raster_from_wcs("smartgeci__Idukki_UHI", request.geometry)
            
            logger.info("Fetching LST raster from GeoServer WCS...")
            lst_pixels = fetch_aoi_raster_from_wcs("smartgeci__Idukki_LST", request.geometry)
            
            logger.info("Fetching NDVI raster from GeoServer WCS...")
            ndvi_pixels = fetch_aoi_raster_from_wcs("smartgeci__Idukki_NDVI", request.geometry)
            
            logger.info("Fetching NDBI raster from GeoServer WCS...")
            ndbi_pixels = fetch_aoi_raster_from_wcs("smartgeci__Idukki_NDBI", request.geometry)
            
            # Check if we have any valid data
            if uhi_pixels is None or len(uhi_pixels) == 0:
                logger.warning("No valid UHI data found within AOI")
                return {
                    "geometry": request.geometry,
                    "crs": request.crs,
                    "analysis_type": request.analysis_type,
                    "status": "no_data",
                    "area_sq_km": round(area_sq_km, 3),
                    "message": "AOI is outside raster coverage or contains no valid data",
                    "statistics": {}
                }
            
            # Compute statistics for each layer
            uhi_stats = compute_aoi_statistics(uhi_pixels)
            lst_stats = compute_aoi_statistics(lst_pixels) if lst_pixels is not None else None
            ndvi_stats = compute_aoi_statistics(ndvi_pixels) if ndvi_pixels is not None else None
            ndbi_stats = compute_aoi_statistics(ndbi_pixels) if ndbi_pixels is not None else None
            
            # Analyze UHI class distribution
            uhi_distribution = analyze_uhi_class_distribution(uhi_pixels)
            
            logger.info(f"Statistics computed:")
            logger.info(f"  - UHI: {uhi_stats['count']} pixels, mean={uhi_stats['mean']:.2f}")
            if lst_stats:
                logger.info(f"  - LST: {lst_stats['count']} pixels, mean={lst_stats['mean']:.2f}°C")
            if ndvi_stats:
                logger.info(f"  - NDVI: {ndvi_stats['count']} pixels, mean={ndvi_stats['mean']:.3f}")
            if ndbi_stats:
                logger.info(f"  - NDBI: {ndbi_stats['count']} pixels, mean={ndbi_stats['mean']:.3f}")
            
            # Classify overall AOI based on dominant class or mean UHI value
            # Use dominant class if available, otherwise fall back to mean
            if uhi_distribution['dominant_class'] != "Unknown":
                uhi_label = uhi_distribution['dominant_class']
                uhi_classification = classify_uhi(uhi_stats['mean'])
                uhi_classification['uhi_label'] = uhi_label  # Override with dominant class
                logger.info(f"AOI UHI Classification: {uhi_label} (dominant class)")
            else:
                mean_uhi = uhi_stats['mean']
                uhi_classification = classify_uhi(mean_uhi)
                logger.info(f"AOI UHI Classification: {uhi_classification['uhi_label']} (mean value: {mean_uhi:.2f})")
            
            # Generate AOI-level recommendations based on distribution
            aoi_recommendations = generate_aoi_recommendations(uhi_distribution, area_sq_km)
            
            logger.info(f"Generated recommendations: {aoi_recommendations['zone_type']} ({aoi_recommendations['priority_level']} priority)")
            
            result = {
                "geometry": request.geometry,
                "crs": request.crs,
                "analysis_type": request.analysis_type,
                "status": "success",
                "area_sq_km": round(area_sq_km, 3),
                "uhi_classification": uhi_classification,
                "uhi_distribution": uhi_distribution,
                "recommendations": aoi_recommendations,
                "statistics": {
                    "uhi": uhi_stats,
                    "lst": lst_stats,
                    "ndvi": ndvi_stats,
                    "ndbi": ndbi_stats
                }
            }
            
            logger.info(f"AOI analysis completed successfully")
            logger.info(f"{'='*60}\n")
            
            return result
        
        else:
            # Should not reach here due to Literal type constraint
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Invalid analysis_type",
                    "message": f"Unsupported analysis type: {request.analysis_type}"
                }
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in AOI analysis: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Failed to analyze AOI",
                "error": str(e)
            }
        )


@app.post("/api/analysis/aoi/shapefile")
async def analyze_aoi_from_shapefile(
    file: UploadFile = File(..., description="Zipped shapefile (.zip)"),
    analysis_type: Literal["uhi"] = "uhi"
):
    """
    Analyze Area of Interest (AOI) from uploaded shapefile.
    
    Accepts a zipped shapefile, extracts and validates it, converts to GeoJSON,
    reprojects to EPSG:4326 if needed, and performs the requested analysis.
    
    Args:
        file: Zipped shapefile containing .shp, .shx, .dbf, and .prj files
        analysis_type: Type of analysis to perform (currently only "uhi")
    
    Returns:
        dict: Analysis results similar to /api/analysis/aoi endpoint
    
    Raises:
        HTTPException: If file is invalid or processing fails
    """
    temp_dir = None
    
    try:
        logger.info(f"\n{'='*60}")
        logger.info(f"Shapefile Upload Request")
        logger.info(f"  - Filename: {file.filename}")
        logger.info(f"  - Content Type: {file.content_type}")
        logger.info(f"  - Analysis Type: {analysis_type}")
        logger.info(f"{'='*60}")
        
        # Validate file extension
        if not file.filename or not file.filename.lower().endswith('.zip'):
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Invalid file type",
                    "message": "File must be a zipped shapefile (.zip)"
                }
            )
        
        # Read uploaded file content
        content = await file.read()
        logger.info(f"Uploaded file size: {len(content)} bytes")
        
        # Create temporary directory for extraction
        temp_dir = tempfile.mkdtemp(prefix="shapefile_upload_")
        temp_path = Path(temp_dir)
        logger.info(f"Created temporary directory: {temp_dir}")
        
        # Extract zip file
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as zip_ref:
                # Get list of files in zip
                file_list = zip_ref.namelist()
                logger.info(f"Zip contains {len(file_list)} files: {file_list}")
                
                # Extract all files
                zip_ref.extractall(temp_path)
                logger.info("Zip extracted successfully")
        except zipfile.BadZipFile:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Invalid zip file",
                    "message": "Uploaded file is not a valid zip archive"
                }
            )
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Failed to extract zip",
                    "message": str(e)
                }
            )
        
        # Find .shp file in extracted directory
        shp_files = list(temp_path.rglob("*.shp"))
        if len(shp_files) == 0:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "No shapefile found",
                    "message": "Zip archive must contain at least one .shp file"
                }
            )
        if len(shp_files) > 1:
            logger.warning(f"Multiple shapefiles found: {[f.name for f in shp_files]}. Using first one.")
        shp_path = shp_files[0]
        logger.info(f"Found shapefile: {shp_path.name}")

        # Validate required shapefile components exist
        base_name = shp_path.stem
        base_path = shp_path.parent / base_name
        required_extensions = ['.shx', '.dbf']
        missing_components = []
        for ext in required_extensions:
            component_path = base_path.with_suffix(ext)
            if not component_path.exists():
                found = False
                for f in base_path.parent.glob(f"{base_name}*"):
                    if f.suffix.lower() == ext.lower():
                        found = True
                        break
                if not found:
                    missing_components.append(ext)
        if missing_components:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Incomplete shapefile",
                    "message": f"Missing required components: {', '.join(missing_components)}"
                }
            )
        logger.info("All required shapefile components found")

        # Read shapefile with geopandas BEFORE moving
        try:
            gdf = gpd.read_file(shp_path)
            logger.info(f"Shapefile loaded successfully")
            logger.info(f"  - Features: {len(gdf)}")
            logger.info(f"  - CRS: {gdf.crs}")
            logger.info(f"  - Geometry Types: {gdf.geom_type.unique().tolist()}")
        except Exception as e:
            logger.error(f"Failed to read shapefile: {e}")
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Failed to read shapefile",
                    "message": str(e)
                }
            )

        # Move shapefile components to GeoServer data dir AFTER reading
        geoserver_dir = move_shapefile_to_geoserver(str(shp_path.parent))
        logger.info(f"Shapefile components moved to GeoServer data dir: {geoserver_dir}")
        
        # Check if shapefile has features
        if len(gdf) == 0:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Empty shapefile",
                    "message": "Shapefile contains no features"
                }
            )
        
        # Reproject to EPSG:4326 if needed
        if gdf.crs is None:
            logger.warning("Shapefile has no CRS defined. Assuming EPSG:4326")
            gdf.set_crs("EPSG:4326", inplace=True)
        elif gdf.crs.to_string() != "EPSG:4326":
            logger.info(f"Reprojecting from {gdf.crs} to EPSG:4326")
            gdf = gdf.to_crs("EPSG:4326")
            logger.info("Reprojection completed")
        
        # Dissolve all geometries into a single MultiPolygon/Polygon
        logger.info("Dissolving geometries into single feature...")
        dissolved = gdf.dissolve()
        
        if len(dissolved) == 0:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Geometry processing failed",
                    "message": "Failed to dissolve geometries"
                }
            )
        
        # Get the geometry
        geom = dissolved.geometry.iloc[0]
        logger.info(f"Dissolved geometry type: {geom.geom_type}")
        
        # Validate geometry type (only Polygon and MultiPolygon supported)
        if geom.geom_type not in ['Polygon', 'MultiPolygon']:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Invalid geometry type",
                    "message": f"Only Polygon and MultiPolygon are supported. Found: {geom.geom_type}"
                }
            )
        
        # Check if geometry is valid
        if not geom.is_valid:
            logger.warning(f"Invalid geometry detected. Attempting to fix...")
            geom = geom.buffer(0)  # Common fix for self-intersections
            
            if not geom.is_valid:
                reason = explain_validity(geom)
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": "Invalid geometry",
                        "message": f"Geometry validation failed: {reason}"
                    }
                )
            logger.info("Geometry fixed successfully")
        
        # Convert to GeoJSON geometry
        geojson_geometry = mapping(geom)
        logger.info("Converted to GeoJSON successfully")
        
        # Create AOI analysis request
        aoi_request = AOIAnalysisRequest(
            geometry=geojson_geometry,
            crs="EPSG:4326",
            analysis_type=analysis_type
        )
        
        # Call the existing AOI analysis endpoint logic
        logger.info("Passing to AOI analysis pipeline...")
        result = analyze_aoi(aoi_request)

        # Compose workspace, layer_name, wms_url, dominant_uhi_class
        workspace = "smartgeci"
        unique_id = os.path.basename(geoserver_dir)
        layer_name = f"aoi_{unique_id}"
        wms_url = f"http://localhost:8080/geoserver/{workspace}/wms"
        dominant_uhi_class = result.get("uhi_distribution", {}).get("dominant_class", None)

        # Add upload metadata and GeoServer info to result
        result["upload_info"] = {
            "filename": file.filename,
            "feature_count": len(gdf),
            "original_crs": str(gdf.crs) if gdf.crs else None,
            "reprojected": gdf.crs is not None and gdf.crs.to_string() != "EPSG:4326"
        }
        result["workspace"] = workspace
        result["layer_name"] = layer_name
        result["wms_url"] = wms_url
        result["dominant_uhi_class"] = dominant_uhi_class

        logger.info(f"Shapefile analysis completed successfully")
        logger.info(f"{'='*60}\n")

        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in shapefile upload: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Failed to process shapefile",
                "error": str(e)
            }
        )
    finally:
        # Clean up temporary directory (after all file operations)
        if temp_dir and Path(temp_dir).exists():
            try:
                import shutil
                shutil.rmtree(temp_dir)
                logger.info(f"Cleaned up temporary directory: {temp_dir}")
            except Exception as e:
                logger.warning(f"Failed to clean up temporary directory: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
