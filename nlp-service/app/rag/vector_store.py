"""Vector store for RAG similarity search using FAISS"""
import numpy as np
import pickle
import os
from typing import List
from sentence_transformers import SentenceTransformer
import faiss


class VectorStore:
    """
    In-memory vector store using FAISS for similarity search
    
    Uses sentence-transformers (all-MiniLM-L6-v2) for embeddings
    and FAISS for efficient nearest neighbor search
    """
    
    def __init__(self, documents: List[str]):
        """
        Initialize vector store with knowledge documents
        
        Args:
            documents: List of text chunks to index
            
        Raises:
            Exception: If model loading or indexing fails
        """
        print("🤖 Initializing VectorStore...")
        
        # Store documents
        self.documents = documents
        
        if not documents or len(documents) == 0:
            print("⚠️  No documents provided, creating empty vector store")
            self.index = None
            self.model = None
            return
        
        print(f"📚 Loading sentence-transformer model: all-MiniLM-L6-v2")
        
        # Load sentence-transformer model
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        
        print(f"✓ Model loaded")
        print(f"📊 Encoding {len(documents)} document chunks...")
        
        # Generate embeddings for all documents
        self.embeddings = self.model.encode(
            documents,
            convert_to_numpy=True,
            show_progress_bar=True
        )
        
        print(f"✓ Generated {self.embeddings.shape[0]} embeddings")
        print(f"  Embedding dimension: {self.embeddings.shape[1]}")
        
        # Build FAISS index
        print("🔨 Building FAISS index...")
        dimension = self.embeddings.shape[1]
        
        # Use IndexFlatL2 for exact L2 distance search (no compression)
        self.index = faiss.IndexFlatL2(dimension)
        
        # Add embeddings to index
        self.index.add(self.embeddings.astype('float32'))
        
        print(f"✓ FAISS index built with {self.index.ntotal} vectors")
        print("✨ VectorStore ready!\n")
    
    def retrieve(self, query: str, k: int = 3) -> List[str]:
        """
        Retrieve top k most similar documents for a query
        
        Args:
            query: Query text to search for
            k: Number of results to return (default: 3)
            
        Returns:
            List of top k most similar document chunks
            
        Raises:
            Exception: If retrieval fails
        """
        # Handle empty vector store
        if self.index is None or self.model is None:
            print("⚠️  Vector store is empty, returning no results")
            return []
        
        # Ensure k doesn't exceed number of documents
        k = min(k, len(self.documents))
        
        if k <= 0:
            return []
        
        try:
            print(f"🔍 Retrieving top {k} chunks for query: \"{query}\"")
            
            # Embed the query
            query_embedding = self.model.encode(
                [query],
                convert_to_numpy=True
            )
            
            # Perform similarity search
            distances, indices = self.index.search(
                query_embedding.astype('float32'),
                k
            )
            
            # Extract top k documents
            results = []
            for i, idx in enumerate(indices[0]):
                if idx < len(self.documents):
                    distance = distances[0][i]
                    doc_content = self.documents[idx]
                    results.append(doc_content)
                    
                    # Log document with preview
                    print(f"  {i+1}. Document {idx} (distance: {distance:.4f})")
                    
                    # Show document content preview (first 200 chars)
                    preview = doc_content[:200] if len(doc_content) > 200 else doc_content
                    if len(doc_content) > 200:
                        preview += "..."
                    print(f"     Content: {preview}")
                    print()  # Empty line for readability
            
            print(f"✓ Retrieved {len(results)} chunks\n")
            return results
            
        except Exception as e:
            print(f"❌ Error during retrieval: {str(e)}")
            raise Exception(f"Vector store retrieval failed: {str(e)}")
    
    def add_documents(self, documents: List[str], folder_path: str = "vector_store"):
        """
        Incrementally add new documents to the existing vector store.

        Encodes the new documents, appends them to the existing FAISS index
        and document list, then persists the updated store to disk.

        Args:
            documents: List of text chunks to add
            folder_path: Path used to persist the updated store (default: "vector_store")
        """
        if not documents:
            print("⚠️  No documents to add")
            return

        print(f"➕ Adding {len(documents)} new document(s) to vector store…")

        # Lazily initialise the embedding model if the store was empty
        if self.model is None:
            print("📚 Loading sentence-transformer model: all-MiniLM-L6-v2")
            self.model = SentenceTransformer('all-MiniLM-L6-v2')

        # Encode new documents
        new_embeddings = self.model.encode(
            documents,
            convert_to_numpy=True,
            show_progress_bar=True
        )

        # Bootstrap a fresh FAISS index if the store was previously empty
        if self.index is None:
            dimension = new_embeddings.shape[1]
            self.index = faiss.IndexFlatL2(dimension)
            self.embeddings = new_embeddings
        else:
            self.embeddings = np.vstack([self.embeddings, new_embeddings])

        self.index.add(new_embeddings.astype('float32'))
        self.documents.extend(documents)

        print(f"✓ Vector store now contains {len(self.documents)} document(s)")
        self.save_local(folder_path)

    def save_local(self, folder_path: str):
        """
        Save the vector store to disk
        
        Args:
            folder_path: Path to folder where index and documents will be saved
        """
        if self.index is None or self.model is None:
            print("⚠️  Cannot save empty vector store")
            return
        
        # Create folder if it doesn't exist
        os.makedirs(folder_path, exist_ok=True)
        
        # Save FAISS index
        index_path = os.path.join(folder_path, "faiss_index.bin")
        faiss.write_index(self.index, index_path)
        
        # Save documents and embeddings
        data_path = os.path.join(folder_path, "documents.pkl")
        with open(data_path, 'wb') as f:
            pickle.dump({
                'documents': self.documents,
                'embeddings': self.embeddings
            }, f)
        
        print(f"✅ Vector store saved to disk at: {folder_path}")
    
    @classmethod
    def load_local(cls, folder_path: str):
        """
        Load a vector store from disk
        
        Args:
            folder_path: Path to folder containing saved index and documents
            
        Returns:
            VectorStore instance loaded from disk
        """
        index_path = os.path.join(folder_path, "faiss_index.bin")
        data_path = os.path.join(folder_path, "documents.pkl")
        
        if not os.path.exists(index_path) or not os.path.exists(data_path):
            raise FileNotFoundError(f"Vector store not found at {folder_path}")
        
        print(f"📂 Loading vector store from: {folder_path}")
        
        # Load FAISS index
        index = faiss.read_index(index_path)
        
        # Load documents and embeddings
        with open(data_path, 'rb') as f:
            data = pickle.load(f)
        
        # Create instance without initializing
        instance = cls.__new__(cls)
        instance.documents = data['documents']
        instance.embeddings = data['embeddings']
        instance.index = index
        instance.model = SentenceTransformer('all-MiniLM-L6-v2')
        
        print(f"✅ Vector store loaded with {len(instance.documents)} documents")
        
        return instance
    
    def get_stats(self) -> dict:
        """
        Get statistics about the vector store
        
        Returns:
            Dictionary with store statistics
        """
        if self.index is None:
            return {
                "total_documents": 0,
                "index_size": 0,
                "embedding_dimension": 0,
                "model": None
            }
        
        return {
            "total_documents": len(self.documents),
            "index_size": self.index.ntotal,
            "embedding_dimension": self.embeddings.shape[1],
            "model": "all-MiniLM-L6-v2"
        }


# ============================================================================
# METADATA-BASED RETRIEVAL HELPER FUNCTIONS
# ============================================================================

def retrieve_summary_docs(vectorstore, query, k=3):
    """
    Retrieve only summary documents from the vector store
    
    Args:
        vectorstore: VectorStore instance
        query: Query text
        k: Number of summary docs to return
        
    Returns:
        List of summary document strings
    """
    docs = vectorstore.retrieve(query, k=10)
    return [d for d in docs if d.startswith("[SUMMARY:")][:k]


def retrieve_row_docs(vectorstore, query, k=5):
    """
    Retrieve only row documents from the vector store
    
    Args:
        vectorstore: VectorStore instance
        query: Query text
        k: Number of row docs to return
        
    Returns:
        List of row document strings
    """
    docs = vectorstore.retrieve(query, k=15)
    return [d for d in docs if not d.startswith("[SUMMARY:")][:k]
