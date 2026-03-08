"""
Map context handler — checks whether a request payload contains map_context
and, if so, delegates to the spatial processing pipeline.

This is the single integration point between the existing mode handler
and the new spatial module.  All paths without map_context return None
so the calling code follows its normal flow unchanged.
"""
from typing import Optional, Dict, Any

from app.spatial.spatial_router import process_spatial_query


def process_map_context(query: str, payload: dict) -> Optional[Dict[str, Any]]:
    """
    Check for map_context in the request payload.

    Args:
        query:   User's natural language query.
        payload: Full request payload (may or may not contain map_context).

    Returns:
        Spatial processing result dict, or None if map_context is absent.

    Result shape (when map_context present):
        {
            "spatial_results": [...],
            "geojson":         {...},
            "map_actions":     [...],
            "spatial_text":    "...",
        }
    """
    raw_ctx = payload.get("map_context")
    if not raw_ctx or not isinstance(raw_ctx, dict):
        return None

    # Validate mandatory fields
    if "type" not in raw_ctx or "geometry" not in raw_ctx:
        print("⚠️  map_context missing required fields (type, geometry) — skipping")
        return None

    try:
        print(
            f"🗺️  Map context received: type={raw_ctx.get('type')}, "
            f"layer={raw_ctx.get('layer')}"
        )
        return process_spatial_query(query, raw_ctx)
    except Exception as e:
        print(f"⚠️  map_context processing failed: {e}")
        return None
