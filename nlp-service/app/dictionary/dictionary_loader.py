"""Loads and caches the entity synonym dictionary from entities.json."""
import json
from pathlib import Path
from typing import Dict, List

_entity_dictionary: Dict[str, List[str]] = {}


def load_entity_dictionary() -> None:
    """Load entities.json into memory. Called once at application startup."""
    global _entity_dictionary
    entities_file = Path(__file__).parent / "entities.json"
    with open(entities_file, "r", encoding="utf-8") as f:
        _entity_dictionary = json.load(f)
    print(f"📖 Entity dictionary loaded: {len(_entity_dictionary)} canonical entities")


def get_entity_dictionary() -> Dict[str, List[str]]:
    """Return the cached entity dictionary. Keys are canonical names, values are synonym lists."""
    return _entity_dictionary
