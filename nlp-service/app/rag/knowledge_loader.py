"""Knowledge document loader for RAG pipeline"""
import os
from typing import List
from pathlib import Path


def load_documents(folder_path: str) -> List[str]:
    """
    Load and chunk documents from a knowledge folder
    
    Args:
        folder_path: Path to folder containing .txt files
        
    Returns:
        List of text chunks (400 words each)
        
    Raises:
        FileNotFoundError: If folder_path does not exist
        Exception: If document loading fails
    """
    chunks = []
    
    try:
        # Validate folder path
        folder = Path(folder_path)
        if not folder.exists():
            raise FileNotFoundError(f"Knowledge folder not found: {folder_path}")
        
        if not folder.is_dir():
            raise ValueError(f"Path is not a directory: {folder_path}")
        
        # Find all .txt files in the folder
        txt_files = list(folder.glob("*.txt"))
        
        if not txt_files:
            print(f"⚠️  No .txt files found in {folder_path}")
            return chunks
        
        print(f"📚 Found {len(txt_files)} .txt file(s) in {folder_path}")
        
        # Process each text file
        for txt_file in txt_files:
            print(f"📄 Loading: {txt_file.name}")
            
            try:
                # Read file content
                with open(txt_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Split into chunks of 400 words
                file_chunks = split_into_chunks(content, chunk_size=400)
                chunks.extend(file_chunks)
                
                print(f"  ✓ Loaded {len(file_chunks)} chunk(s) from {txt_file.name}")
                
            except Exception as e:
                print(f"  ⚠️  Failed to load {txt_file.name}: {str(e)}")
                continue
        
        print(f"✓ Total chunks loaded: {len(chunks)}")
        return chunks
        
    except Exception as e:
        print(f"❌ Error loading documents: {str(e)}")
        raise


def split_into_chunks(text: str, chunk_size: int = 400) -> List[str]:
    """
    Split text into chunks of approximately chunk_size words
    
    Args:
        text: Text to split
        chunk_size: Target number of words per chunk (default: 400)
        
    Returns:
        List of text chunks
    """
    if not text or not text.strip():
        return []
    
    # Split text into words (whitespace-separated tokens)
    words = text.split()
    
    if len(words) == 0:
        return []
    
    chunks = []
    current_chunk = []
    
    for word in words:
        current_chunk.append(word)
        
        # When we reach chunk_size words, create a chunk
        if len(current_chunk) >= chunk_size:
            chunks.append(' '.join(current_chunk))
            current_chunk = []
    
    # Add remaining words as final chunk
    if current_chunk:
        chunks.append(' '.join(current_chunk))
    
    return chunks
