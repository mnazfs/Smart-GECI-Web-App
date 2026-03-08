"""
Spatial executor — runs PostGIS queries based on map context and spatial intent.
Uses parameterized queries and psycopg2.sql for identifier safety.
"""
import os
import json
import logging
from typing import List, Optional, Dict, Any

try:
    import psycopg2
    from psycopg2 import sql
    from psycopg2.extras import RealDictCursor
except ImportError:
    raise ImportError(
        "psycopg2 is required for spatial queries. "
        "Install with: pip install psycopg2-binary"
    )

from app.spatial.spatial_models import SpatialIntent, SpatialFeature, SpatialResult

logger = logging.getLogger(__name__)

_MAX_FEATURES_PER_TABLE = 10
_MAX_FEATURES_TOTAL = 20


# ── DB connection ──────────────────────────────────────────────────────────────

def _get_db_connection():
    """Create a PostgreSQL connection using environment variables."""
    db_host = os.getenv("DB_HOST")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME")
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")

    if not all([db_host, db_name, db_user, db_password]):
        raise ValueError(
            "Missing required DB credentials. "
            "Set DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD."
        )

    return psycopg2.connect(
        host=db_host,
        port=db_port,
        dbname=db_name,
        user=db_user,
        password=db_password,
    )


# ── Schema helpers ─────────────────────────────────────────────────────────────

def _get_spatial_tables(conn, target_layer: Optional[str] = None) -> List[Dict[str, str]]:
    """
    Return tables with spatial columns from geometry_columns.

    Args:
        conn: Active psycopg2 connection.
        target_layer: Optional exact table name to filter to.

    Returns:
        List of {"table_name": ..., "geom_col": ...} dicts.
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        if target_layer:
            cur.execute(
                """
                SELECT f_table_name AS table_name,
                       f_geometry_column AS geom_col
                FROM   geometry_columns
                WHERE  f_table_schema = 'public'
                  AND  f_table_name   = %s
                LIMIT  1
                """,
                (target_layer,),
            )
        else:
            cur.execute(
                """
                SELECT f_table_name AS table_name,
                       f_geometry_column AS geom_col
                FROM   geometry_columns
                WHERE  f_table_schema = 'public'
                ORDER  BY f_table_name
                LIMIT  10
                """
            )
        return [dict(r) for r in cur.fetchall()]


# ── Row → Feature conversion ───────────────────────────────────────────────────

def _rows_to_features(
    rows: list,
    table_name: str,
    geom_col: str,
) -> List[SpatialFeature]:
    features = []
    for row in rows:
        row = dict(row)
        geojson_str = row.pop("_geojson_str", None)
        dist = row.pop("_dist_m", None)

        geom: Optional[Dict[str, Any]] = None
        if geojson_str:
            try:
                geom = json.loads(geojson_str)
            except Exception:
                pass

        # Remove raw geometry column from properties
        row.pop(geom_col, None)

        feature_id = str(
            row.get("id") or row.get("fid") or row.get("gid") or ""
        ) or None

        features.append(
            SpatialFeature(
                feature_id=feature_id,
                table_name=table_name,
                properties={k: str(v) if v is not None else "" for k, v in row.items()},
                geojson=geom,
                distance_m=float(dist) if dist is not None else None,
            )
        )
    return features


# ── Spatial query functions ────────────────────────────────────────────────────

def execute_nearby_search(
    geometry: Dict[str, Any],
    intent: SpatialIntent,
) -> SpatialResult:
    """
    Find features near a point using ST_DWithin.

    Args:
        geometry: GeoJSON Point geometry.
        intent:   Detected spatial intent (provides target layer and distance).

    Returns:
        SpatialResult with matched features.
    """
    coords = geometry.get("coordinates", [])
    if not coords or len(coords) < 2:
        return SpatialResult(
            features=[],
            geojson={"type": "FeatureCollection", "features": []},
            summary_text="No coordinates provided in map context.",
        )

    lon, lat = float(coords[0]), float(coords[1])
    distance = intent.distance
    all_features: List[SpatialFeature] = []

    try:
        conn = _get_db_connection()
        try:
            tables = _get_spatial_tables(conn, intent.target_layer)
            for tbl in tables:
                table_name = tbl["table_name"]
                geom_col = tbl["geom_col"]
                try:
                    with conn.cursor(cursor_factory=RealDictCursor) as cur:
                        query = sql.SQL(
                            """
                            SELECT *,
                                ST_AsGeoJSON({geom}) AS _geojson_str,
                                ST_Distance(
                                    {geom}::geography,
                                    ST_SetSRID(ST_Point(%s, %s), 4326)::geography
                                ) AS _dist_m
                            FROM {table}
                            WHERE ST_DWithin(
                                {geom}::geography,
                                ST_SetSRID(ST_Point(%s, %s), 4326)::geography,
                                %s
                            )
                            ORDER BY _dist_m
                            LIMIT %s
                            """
                        ).format(
                            geom=sql.Identifier(geom_col),
                            table=sql.Identifier(table_name),
                        )
                        cur.execute(query, (lon, lat, lon, lat, distance, _MAX_FEATURES_PER_TABLE))
                        all_features.extend(
                            _rows_to_features(cur.fetchall(), table_name, geom_col)
                        )
                except Exception as e:
                    logger.warning("Nearby search failed for %s: %s", table_name, e)
        finally:
            conn.close()
    except Exception as e:
        logger.error("DB connection error in execute_nearby_search: %s", e)
        return SpatialResult(
            features=[],
            geojson={"type": "FeatureCollection", "features": []},
            summary_text=f"Database error: {e}",
        )

    return _build_result(all_features)


def execute_inside_polygon(
    geometry: Dict[str, Any],
    intent: SpatialIntent,
) -> SpatialResult:
    """
    Find features inside / intersecting a polygon using ST_Intersects.

    Args:
        geometry: GeoJSON Polygon geometry.
        intent:   Detected spatial intent.

    Returns:
        SpatialResult with matched features.
    """
    polygon_geojson = json.dumps(geometry)
    all_features: List[SpatialFeature] = []

    try:
        conn = _get_db_connection()
        try:
            tables = _get_spatial_tables(conn, intent.target_layer)
            for tbl in tables:
                table_name = tbl["table_name"]
                geom_col = tbl["geom_col"]
                try:
                    with conn.cursor(cursor_factory=RealDictCursor) as cur:
                        query = sql.SQL(
                            """
                            SELECT *,
                                ST_AsGeoJSON({geom}) AS _geojson_str
                            FROM {table}
                            WHERE ST_Intersects(
                                {geom},
                                ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)
                            )
                            LIMIT %s
                            """
                        ).format(
                            geom=sql.Identifier(geom_col),
                            table=sql.Identifier(table_name),
                        )
                        cur.execute(query, (polygon_geojson, _MAX_FEATURES_PER_TABLE))
                        all_features.extend(
                            _rows_to_features(cur.fetchall(), table_name, geom_col)
                        )
                except Exception as e:
                    logger.warning("Inside polygon search failed for %s: %s", table_name, e)
        finally:
            conn.close()
    except Exception as e:
        logger.error("DB connection error in execute_inside_polygon: %s", e)
        return SpatialResult(
            features=[],
            geojson={"type": "FeatureCollection", "features": []},
            summary_text=f"Database error: {e}",
        )

    return _build_result(all_features)


def execute_distance_query(
    geometry: Dict[str, Any],
    intent: SpatialIntent,
) -> SpatialResult:
    """Distance queries expand the search radius and reuse nearby search."""
    if intent.distance <= 100:
        intent = SpatialIntent(
            intent=intent.intent,
            target_layer=intent.target_layer,
            distance=500.0,
        )
    return execute_nearby_search(geometry, intent)


# ── Result builder ─────────────────────────────────────────────────────────────

def _build_result(features: List[SpatialFeature]) -> SpatialResult:
    """Assemble a SpatialResult from a flat list of features."""
    capped = features[:_MAX_FEATURES_TOTAL]

    geojson_features = []
    for f in capped:
        if f.geojson:
            props = dict(f.properties)
            if f.distance_m is not None:
                props["_distance_m"] = round(f.distance_m, 1)
            props["_table"] = f.table_name
            geojson_features.append(
                {
                    "type": "Feature",
                    "id": f.feature_id,
                    "geometry": f.geojson,
                    "properties": props,
                }
            )

    # Build human-readable summary for RAG context injection
    if capped:
        lines = []
        for f in capped[:10]:
            name = (
                f.properties.get("name")
                or f.properties.get("Name")
                or f.properties.get("NAME")
                or f"Feature in {f.table_name}"
            )
            if f.distance_m is not None:
                lines.append(f"- {name} ({f.table_name}): {f.distance_m:.0f} m away")
            else:
                lines.append(f"- {name} ({f.table_name})")
        summary_text = "\n".join(lines)
    else:
        summary_text = "No spatial features found near the selected location."

    return SpatialResult(
        features=capped,
        geojson={"type": "FeatureCollection", "features": geojson_features},
        summary_text=summary_text,
    )
