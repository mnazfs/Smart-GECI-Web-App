"""
Spatial intent detection — rule-based with optional LLM fallback.
Detects the type of spatial operation requested and the target layer.
Does NOT affect the existing intent classification pipeline.
"""
import re
from typing import Optional
from app.spatial.spatial_models import SpatialIntent

# Common layer name synonyms → canonical table names
LAYER_ALIASES: dict = {
    "building": "buildings",
    "buildings": "buildings",
    "bus stop": "bus_stops",
    "bus stops": "bus_stops",
    "bus": "bus_stops",
    "lab": "laboratories",
    "labs": "laboratories",
    "laboratories": "laboratories",
    "library": "library",
    "libraries": "library",
    "parking": "parking",
    "toilet": "toilets",
    "toilets": "toilets",
    "restroom": "toilets",
    "canteen": "canteens",
    "cafeteria": "canteens",
    "hostel": "hostels",
    "hostels": "hostels",
    "department": "departments",
    "departments": "departments",
    "road": "roads",
    "roads": "roads",
    "path": "pathways",
    "pathways": "pathways",
    "gate": "gates",
    "gates": "gates",
    "facility": "facilities",
    "facilities": "facilities",
}

_NEARBY_PATTERNS = [
    r"\b(near|nearby|close to|closest|nearest|around)\b",
    r"\bwithin\s+\d+\s*(m|meter|meters|metre|metres|km|kilometer|kilometres)\b",
]

_INSIDE_PATTERNS = [
    r"\b(inside|within|contained in|in this area|in the area|in this region)\b",
]

_DISTANCE_PATTERNS = [
    r"\b(distance|how far|how close|meters away|km away|distance from)\b",
]

_HIGHLIGHT_PATTERNS = [
    r"\b(show|highlight|mark|locate|find|where is|where are|display|point out)\b",
]


def _match(patterns: list, text: str) -> bool:
    for p in patterns:
        if re.search(p, text, re.IGNORECASE):
            return True
    return False


def _extract_layer(query: str) -> Optional[str]:
    """Return canonical table name if a known layer alias appears in the query."""
    ql = query.lower()
    # Check multi-word aliases first (longest match)
    for alias in sorted(LAYER_ALIASES, key=len, reverse=True):
        if alias in ql:
            return LAYER_ALIASES[alias]
    return None


def _extract_distance(query: str) -> float:
    """Extract distance in metres from the query. Default: 100 m."""
    match = re.search(r'(\d+(?:\.\d+)?)\s*(m|meter|meters|metre|metres)\b', query, re.IGNORECASE)
    if match:
        return float(match.group(1))
    match = re.search(r'(\d+(?:\.\d+)?)\s*(km|kilometer|kilometres)\b', query, re.IGNORECASE)
    if match:
        return float(match.group(1)) * 1000
    return 100.0


def detect_spatial_intent(query: str) -> SpatialIntent:
    """
    Detect spatial intent from the query using rule-based matching.

    Args:
        query: User's natural language query.

    Returns:
        SpatialIntent with intent type, optional target layer, and distance.
    """
    target_layer = _extract_layer(query)
    distance = _extract_distance(query)

    if _match(_INSIDE_PATTERNS, query):
        intent = "inside_area"
    elif _match(_DISTANCE_PATTERNS, query):
        intent = "distance_query"
    elif _match(_NEARBY_PATTERNS, query):
        intent = "nearby_search"
    elif _match(_HIGHLIGHT_PATTERNS, query):
        intent = "highlight_feature"
    else:
        # Default when map context is present
        intent = "nearby_search"

    return SpatialIntent(intent=intent, target_layer=target_layer, distance=distance)
