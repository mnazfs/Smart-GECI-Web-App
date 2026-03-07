"""Table registry — tracks which PostGIS tables have been indexed in the vector store."""
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict

REGISTRY_PATH = os.path.join("vector_store", "table_registry.json")


def load_registry() -> Dict[str, Any]:
    """
    Load the table registry from disk.

    Returns:
        Registry dict: {"tables": {table_name: {...metadata...}}}
        Returns an empty registry structure if the file does not exist.
    """
    if not os.path.exists(REGISTRY_PATH):
        return {"tables": {}}
    try:
        with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {"tables": {}}


def save_registry(registry: Dict[str, Any]) -> None:
    """
    Persist the registry to disk, creating the directory if necessary.

    Args:
        registry: Registry dict to save.
    """
    os.makedirs(os.path.dirname(REGISTRY_PATH), exist_ok=True)
    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2)


def is_table_indexed(table_name: str) -> bool:
    """
    Return True if the table is already recorded in the registry.

    Args:
        table_name: Name of the database table.
    """
    registry = load_registry()
    return table_name in registry.get("tables", {})


def register_table(table_name: str, row_docs: int = 0, summary_doc: bool = True) -> None:
    """
    Add or update a table entry in the registry.

    Args:
        table_name:  Name of the database table.
        row_docs:    Number of individual row documents indexed.
        summary_doc: Whether a summary document was indexed for this table.
    """
    registry = load_registry()
    registry["tables"][table_name] = {
        "added_at": datetime.now(timezone.utc).isoformat(),
        "row_docs": row_docs,
        "summary_doc": summary_doc,
    }
    save_registry(registry)


def reset_registry() -> None:
    """Clear all table entries from the registry."""
    save_registry({"tables": {}})
