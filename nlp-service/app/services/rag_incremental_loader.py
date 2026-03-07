"""Incremental table ingestion for the RAG vector store.

Allows a single PostGIS table to be added to the existing FAISS index
without triggering a full rebuild.
"""
import logging
from typing import Any, Dict

from app.rag.db_loader import load_database_documents
from app.rag.table_registry import is_table_indexed, register_table
from app.rag.vector_store_instance import get_vector_store

logger = logging.getLogger(__name__)


def add_table_to_vectorstore(table_name: str) -> Dict[str, Any]:
    """
    Incrementally ingest a single PostGIS table into the current vector store.

    Steps:
    1. Guard against duplicate ingestion via the table registry.
    2. Verify the vector store is initialised.
    3. Load row + summary documents for the table via the existing db_loader.
    4. Append documents to the vector store (encodes + FAISS add + disk save).
    5. Record the table in the registry.

    Args:
        table_name: Name of the public-schema table to ingest.

    Returns:
        Dict with keys:
          success (bool)  — whether ingestion succeeded.
          message (str)   — human-readable outcome.
          added_docs (int, optional) — number of documents added on success.
    """
    # 1. Duplicate guard
    if is_table_indexed(table_name):
        return {
            "success": False,
            "message": f"Table '{table_name}' is already in the knowledge base.",
        }

    # 2. Vector store must exist
    vector_store = get_vector_store()
    if vector_store is None:
        return {
            "success": False,
            "message": (
                "Vector store is not initialised. "
                "Please build the knowledge base first using the Build button."
            ),
        }

    # 3. Load documents for this single table
    logger.info(f"Loading documents for table: {table_name}")
    try:
        docs = load_database_documents(selected_tables=[table_name])
    except Exception as e:
        logger.error(f"Failed to load documents for table '{table_name}': {e}")
        return {
            "success": False,
            "message": f"Failed to load data from table '{table_name}': {str(e)}",
        }

    if not docs:
        return {
            "success": False,
            "message": f"No documents could be loaded from table '{table_name}'.",
        }

    # Classify documents for registry metadata
    summary_docs = [d for d in docs if d.startswith("[SUMMARY:")]
    row_docs = [d for d in docs if not d.startswith("[SUMMARY:")]

    # 4. Append to vector store (also persists to disk inside add_documents)
    try:
        vector_store.add_documents(docs)
    except Exception as e:
        logger.error(f"Failed to add documents to vector store: {e}")
        return {
            "success": False,
            "message": f"Vector store update failed: {str(e)}",
        }

    # 5. Update registry
    register_table(
        table_name,
        row_docs=len(row_docs),
        summary_doc=len(summary_docs) > 0,
    )

    logger.info(
        f"Table '{table_name}' ingested: "
        f"{len(summary_docs)} summary doc(s), {len(row_docs)} row doc(s)."
    )

    return {
        "success": True,
        "message": (
            f"Table '{table_name}' added to the knowledge base — "
            f"{len(summary_docs)} summary doc(s), {len(row_docs)} row doc(s)."
        ),
        "added_docs": len(docs),
    }
