from pydantic import BaseModel
from typing import Dict, Any, Optional, Literal


class MapContext(BaseModel):
    """
    Optional spatial context attached to a RAG request payload.
    When present, the NLP service runs a PostGIS query before calling the LLM
    and injects the spatial results as additional context.
    """
    type: Literal["point", "polygon", "feature", "viewport"]
    geometry: Dict[str, Any]          # GeoJSON geometry object
    layer: Optional[str] = None       # hint for the target PostGIS table
    feature_id: Optional[str] = None  # specific feature to highlight


class GenerateRequest(BaseModel):
    """Request model for text generation"""
    mode: str
    payload: Dict[str, Any]


class GenerateResponse(BaseModel):
    """Response model for text generation"""
    success: bool
    data: Dict[str, Any]
