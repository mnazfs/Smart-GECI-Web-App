"""Global vector store instance for RAG"""

# Global vector store instance
_vector_store = None


def set_vector_store(store):
    """
    Set the global vector store instance
    
    Args:
        store: VectorStore instance
    """
    global _vector_store
    _vector_store = store


def get_vector_store():
    """
    Get the global vector store instance
    
    Returns:
        VectorStore instance or None if not initialized
    """
    return _vector_store
