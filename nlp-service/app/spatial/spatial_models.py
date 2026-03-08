"""Pydantic models for the spatial NLP module."""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Literal


class SpatialIntent(BaseModel):
    """Detected spatial intent from a user query."""
    intent: Literal["nearby_search", "inside_area", "distance_query", "highlight_feature"]
    target_layer: Optional[str] = None
    distance: float = 100.0


class SpatialFeature(BaseModel):
    """A single spatially retrieved feature from PostGIS."""
    feature_id: Optional[str] = None
    table_name: str
    properties: Dict[str, Any]
    geojson: Optional[Dict[str, Any]] = None
    distance_m: Optional[float] = None


class SpatialResult(BaseModel):
    """Aggregated result from a spatial query."""
    features: List[SpatialFeature]
    geojson: Dict[str, Any]
    summary_text: str
