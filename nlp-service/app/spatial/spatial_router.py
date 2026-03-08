"""
Spatial router — orchestrates intent detection, PostGIS execution, and
map action generation for a single spatial query + map context pair.
"""
from typing import Dict, Any

from app.spatial.spatial_models import SpatialIntent
from app.spatial.spatial_intent import detect_spatial_intent
from app.spatial.spatial_executor import (
    execute_nearby_search,
    execute_inside_polygon,
    execute_distance_query,
)
from app.spatial.spatial_tools import build_map_actions


def process_spatial_query(query: str, map_context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main entry point for spatial processing.

    Args:
        query:       User's natural language query.
        map_context: Validated map context dict with keys:
                     type, geometry, layer (opt), feature_id (opt).

    Returns:
        {
            "spatial_results": [feature dicts, ...],
            "geojson":         GeoJSON FeatureCollection,
            "map_actions":     [action dicts, ...],
            "spatial_text":    human-readable summary for RAG injection,
        }
    """
    try:
        ctx_type: str = map_context.get("type", "point")
        geometry: Dict[str, Any] = map_context.get("geometry", {})
        target_layer: str | None = map_context.get("layer")
        geom_type: str = geometry.get("type", "")

        # 1. Detect spatial intent
        intent: SpatialIntent = detect_spatial_intent(query)

        # If the map context itself carries a layer hint, prefer it
        if target_layer and not intent.target_layer:
            intent = SpatialIntent(
                intent=intent.intent,
                target_layer=target_layer,
                distance=intent.distance,
            )

        print(
            f"🗺️  Spatial intent: {intent.intent} | "
            f"layer: {intent.target_layer} | "
            f"dist: {intent.distance} m"
        )

        # 2. Route to the appropriate spatial executor
        if intent.intent == "inside_area" or ctx_type == "polygon" or geom_type == "Polygon":
            spatial_result = execute_inside_polygon(geometry, intent)
        elif intent.intent == "distance_query":
            spatial_result = execute_distance_query(geometry, intent)
        else:
            # nearby_search / highlight_feature → point-based ST_DWithin
            spatial_result = execute_nearby_search(geometry, intent)

        # 3. Build frontend map actions
        map_actions = build_map_actions(spatial_result, ctx_type)

        print(
            f"🗺️  Spatial done: {len(spatial_result.features)} feature(s), "
            f"{len(map_actions)} action(s)"
        )

        return {
            "spatial_results": [f.dict() for f in spatial_result.features],
            "geojson": spatial_result.geojson,
            "map_actions": map_actions,
            "spatial_text": spatial_result.summary_text,
        }

    except Exception as e:
        print(f"❌ Spatial processing error: {e}")
        return {
            "spatial_results": [],
            "geojson": {"type": "FeatureCollection", "features": []},
            "map_actions": [],
            "spatial_text": "",
        }
