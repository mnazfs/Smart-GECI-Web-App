"""
Spatial tools — converts spatial query results into map rendering instructions
(map_actions) consumed by the frontend Leaflet integration.
"""
from typing import List, Dict, Any
from app.spatial.spatial_models import SpatialResult


def build_map_actions(
    spatial_result: SpatialResult,
    map_context_type: str,
) -> List[Dict[str, Any]]:
    """
    Convert spatial results into a list of map action dicts.

    Possible action types understood by the frontend:
        highlight     – mark feature IDs on a named layer
        draw_geometry – render a GeoJSON FeatureCollection as a temporary overlay
        zoom_to       – fit the viewport to a bounding box

    Args:
        spatial_result:   Results from the spatial executor.
        map_context_type: "point" | "polygon" | "feature" | "viewport"

    Returns:
        Ordered list of map action dicts.
    """
    actions: List[Dict[str, Any]] = []

    if not spatial_result.features:
        return actions

    # ── 1. Highlight action per source table ──────────────────────────────────
    tables: Dict[str, List] = {}
    for feat in spatial_result.features:
        tables.setdefault(feat.table_name, []).append(feat)

    for table_name, feats in tables.items():
        ids = [f.feature_id for f in feats if f.feature_id]
        actions.append(
            {
                "type": "highlight",
                "layer": table_name,
                "feature_ids": ids,
                "label": f"{len(feats)} result(s) in {table_name}",
            }
        )

    # ── 2. Draw GeoJSON overlay ───────────────────────────────────────────────
    has_geometries = any(f.geojson is not None for f in spatial_result.features)
    if has_geometries:
        actions.append(
            {
                "type": "draw_geometry",
                "geometry": spatial_result.geojson,
                "label": f"Spatial results ({len(spatial_result.features)} feature(s))",
            }
        )

        # ── 3. Zoom to bounding box of results ────────────────────────────────
        coords_list = []
        for feat in spatial_result.features:
            if not feat.geojson:
                continue
            geom = feat.geojson
            geom_type = geom.get("type", "")
            raw_coords = geom.get("coordinates", [])

            if geom_type == "Point" and len(raw_coords) >= 2:
                coords_list.append((raw_coords[0], raw_coords[1]))

            elif geom_type in ("Polygon", "MultiPolygon"):
                ring = (
                    raw_coords[0]
                    if geom_type == "Polygon"
                    else (raw_coords[0][0] if raw_coords else [])
                )
                coords_list.extend(
                    (c[0], c[1]) for c in ring[:8] if len(c) >= 2
                )

            elif geom_type in ("LineString", "MultiLineString"):
                line = (
                    raw_coords
                    if geom_type == "LineString"
                    else (raw_coords[0] if raw_coords else [])
                )
                coords_list.extend(
                    (c[0], c[1]) for c in line[:4] if len(c) >= 2
                )

        if coords_list:
            min_lon = min(c[0] for c in coords_list)
            max_lon = max(c[0] for c in coords_list)
            min_lat = min(c[1] for c in coords_list)
            max_lat = max(c[1] for c in coords_list)
            actions.append(
                {
                    "type": "zoom_to",
                    "bbox": [min_lon, min_lat, max_lon, max_lat],
                    "label": "Zoom to spatial results",
                }
            )

    return actions
