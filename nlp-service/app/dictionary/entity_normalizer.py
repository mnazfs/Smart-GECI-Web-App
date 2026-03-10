"""Normalizes user queries by replacing entity synonyms with canonical names."""
import re
from typing import Dict, List
from app.dictionary.dictionary_loader import get_entity_dictionary

try:
    from rapidfuzz import fuzz as _fuzz
    _RAPIDFUZZ_AVAILABLE = True
except ImportError:
    _RAPIDFUZZ_AVAILABLE = False

# Fuzzy similarity threshold (0-100). Scores at or above this are treated as a match.
_FUZZY_THRESHOLD = 85


def normalize_entities(query: str) -> Dict[str, object]:
    """
    Detect entity synonyms in *query* and replace them with canonical names.

    Args:
        query: Raw user query string.

    Returns:
        {
            "normalized_query": str,   # query with synonyms replaced
            "entities": list[str]      # canonical entity names that were detected
        }

    Behaviour:
        * For each canonical entity, synonyms are tried longest-first so that more
          specific phrases always win over single-word keys (e.g. "cse block" beats "cs").
        * Once a synonym for a canonical entity is matched and replaced, no further
          synonyms for that same entity are tried — this prevents the replacement text
          itself from being re-matched by a shorter synonym.
        * If rapidfuzz is installed, a fuzzy fallback is applied when no exact match
          was found for **any** entity.
        * If nothing matches the original query is returned unchanged.
    """
    dictionary = get_entity_dictionary()
    if not dictionary:
        return {"normalized_query": query, "entities": []}

    normalized = query
    detected_entities: List[str] = []

    # --- EXACT MATCHING (per canonical entity, break after first hit) ---
    for canonical, synonyms in dictionary.items():
        # Try longest synonyms first to prefer specific phrases over short tokens
        sorted_synonyms = sorted(synonyms, key=len, reverse=True)
        for synonym in sorted_synonyms:
            # Use word-boundary-aware pattern so "cs" does not hit "access" etc.
            # \b works for alphanumeric word boundaries; for phrases with spaces it
            # also does the right thing (space acts as a boundary naturally).
            pattern = re.compile(r'\b' + re.escape(synonym) + r'\b', re.IGNORECASE)
            if pattern.search(normalized):
                normalized = pattern.sub(canonical, normalized)
                if canonical not in detected_entities:
                    detected_entities.append(canonical)
                break  # Do NOT try shorter synonyms for this canonical entity

    # --- FUZZY MATCHING FALLBACK ---
    # Only runs when rapidfuzz is available and no exact match was found at all.
    if _RAPIDFUZZ_AVAILABLE and not detected_entities:
        lower_query = query.lower()
        best_canonical = None
        best_synonym = None
        best_score = 0

        for canonical, synonyms in dictionary.items():
            for synonym in synonyms:
                score = _fuzz.partial_ratio(synonym, lower_query)
                if score >= _FUZZY_THRESHOLD and score > best_score:
                    best_score = score
                    best_canonical = canonical
                    best_synonym = synonym

        if best_canonical and best_synonym:
            pattern = re.compile(r'\b' + re.escape(best_synonym) + r'\b', re.IGNORECASE)
            if pattern.search(normalized):
                normalized = pattern.sub(best_canonical, normalized)
            else:
                # Fuzzy hit but the token is not verbatim — append canonical as a hint
                normalized = f"{normalized} [{best_canonical}]"
            detected_entities.append(best_canonical)

    return {
        "normalized_query": normalized,
        "entities": detected_entities,
    }

