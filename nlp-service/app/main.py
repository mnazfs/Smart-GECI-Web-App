from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from app.routes import generate
from app import config
from app.rag.knowledge_loader import load_documents
from app.rag.db_loader import load_database_documents
from app.rag.vector_store import VectorStore
from app.rag.vector_store_instance import set_vector_store, get_vector_store
import os

# Global RAG state
vectorstore = None
rag_building = False
rag_progress = 0

app = FastAPI(
    title="NLP Service",
    description="Natural Language Processing service using Ollama",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(generate.router, prefix="/api", tags=["generate"])

def build_vector_store():
    """
    Build RAG vector store with progress tracking.
    Updates global state: vectorstore, rag_building, rag_progress
    """
    global vectorstore, rag_building, rag_progress
    
    rag_building = True
    rag_progress = 0
    
    print("\n" + "="*80)
    print("🚀 Building RAG Vector Store")
    print("="*80 + "\n")
    
    all_documents = []
    
    try:
        # STEP 1: Load static knowledge documents (20% progress)
        print("📚 Loading static knowledge documents...")
        rag_progress = 10
        
        knowledge_folder = config.KNOWLEDGE_FOLDER
        
        if os.path.exists(knowledge_folder):
            static_docs = load_documents(knowledge_folder)
            
            if static_docs and len(static_docs) > 0:
                all_documents.extend(static_docs)
                print(f"📚 Loaded {len(static_docs)} static knowledge documents")
            else:
                print("📚 Loaded 0 static knowledge documents")
        else:
            print(f"⚠️  Knowledge folder does not exist: {knowledge_folder}")
            print("📚 Loaded 0 static knowledge documents")
        
        rag_progress = 20
        
        # STEP 2: Load database documents with table summarization (20% -> 70% progress)
        print("\n🗄️  Loading PostGIS documents...")
        rag_progress = 30
        
        try:
            db_docs = load_database_documents()
            
            if db_docs and len(db_docs) > 0:
                all_documents.extend(db_docs)
                print(f"🗄️  Loaded {len(db_docs)} PostGIS documents")
            else:
                print("🗄️  Loaded 0 PostGIS documents")
            
            rag_progress = 70
                
        except ValueError as e:
            # Configuration error (missing env vars)
            print(f"⚠️  Database configuration incomplete: {str(e)}")
            print("🗄️  Loaded 0 PostGIS documents")
            rag_progress = 70
        except Exception as e:
            # Any other database error
            print(f"⚠️  Failed to load database documents: {str(e)}")
            print("🗄️  Loaded 0 PostGIS documents")
            rag_progress = 70
        
        # STEP 3: Build FAISS index (70% -> 100% progress)
        print(f"\n🔨 Building FAISS index...")
        rag_progress = 80
        
        if len(all_documents) > 0:
            # Log all documents before building index
            print(f"\n{'='*80}")
            print(f"📋 DOCUMENT INVENTORY ({len(all_documents)} documents)")
            print('='*80)
            for i, doc in enumerate(all_documents, 1):
                # Show preview (first 150 chars)
                preview = doc[:150] if len(doc) > 150 else doc
                if len(doc) > 150:
                    preview += "..."
                print(f"\n{i}. Document Preview:")
                print(f"   {preview}")
            print('\n' + '='*80 + '\n')
            
            rag_progress = 90
            
            vector_store = VectorStore(all_documents)
            set_vector_store(vector_store)
            vectorstore = vector_store
            print(f"✅ FAISS index built with {len(all_documents)} vectors")
            
            # Save vectorstore to disk
            vector_store.save_local("vector_store")
            print("✅ Vector store saved to disk.")
        else:
            print("⚠️  No documents available - creating empty vector store")
            vector_store = VectorStore([])
            set_vector_store(vector_store)
            vectorstore = vector_store
            print("✅ FAISS index built with 0 vectors")
        
        rag_progress = 100
    
    except Exception as e:
        print(f"❌ Error initializing vector store: {str(e)}")
        print("⚠️  Continuing with empty vector store")
        vector_store = VectorStore([])
        set_vector_store(vector_store)
        vectorstore = vector_store
        rag_progress = 100
    
    finally:
        rag_building = False
    
    print("\n" + "="*80)
    print("✨ RAG Vector Store build complete")
    print("="*80 + "\n")


def load_vector_store():
    """
    Load existing RAG vector store from disk.
    Updates global state: vectorstore
    """
    global vectorstore
    
    if os.path.exists("vector_store"):
        print("📂 Loading existing vector store from disk...")
        try:
            vector_store = VectorStore.load_local("vector_store")
            set_vector_store(vector_store)
            vectorstore = vector_store
            print("✅ Vector store loaded successfully.")
        except Exception as e:
            print(f"❌ Error loading vector store: {str(e)}")
            print("⚠️  Vector store will be None until manually built.")
            vectorstore = None
    else:
        print("⚠️  No existing vector store found.")
        vectorstore = None


@app.on_event("startup")
async def startup_event():
    """Load vector store from disk at application startup"""
    
    print("\n" + "="*80)
    print("🚀 Starting NLP Service - Loading RAG Vector Store")
    print("="*80 + "\n")
    
    load_vector_store()
    
    print("\n" + "="*80)
    print("✨ NLP Service Ready")
    print("="*80 + "\n")


# ⚠️ AUTO BUILD DISABLED - Old startup logic kept for reference
# @app.on_event("startup")
# async def startup_event():
#     """Initialize vector store at application startup"""
#     
#     print("\n" + "="*80)
#     print("🚀 Starting NLP Service - Initializing RAG Vector Store")
#     print("="*80 + "\n")
#     
#     all_documents = []
#     
#     try:
#         # Load static knowledge documents
#         print("📚 Loading static knowledge documents...")
#         knowledge_folder = config.KNOWLEDGE_FOLDER
#         
#         if os.path.exists(knowledge_folder):
#             static_docs = load_documents(knowledge_folder)
#             
#             if static_docs and len(static_docs) > 0:
#                 all_documents.extend(static_docs)
#                 print(f"📚 Loaded {len(static_docs)} static knowledge documents")
#             else:
#                 print("📚 Loaded 0 static knowledge documents")
#         else:
#             print(f"⚠️  Knowledge folder does not exist: {knowledge_folder}")
#             print("📚 Loaded 0 static knowledge documents")
#         
#         # Load database documents
#         print("\n🗄️  Loading PostGIS documents...")
#         try:
#             db_docs = load_database_documents()
#             
#             if db_docs and len(db_docs) > 0:
#                 all_documents.extend(db_docs)
#                 print(f"🗄️  Loaded {len(db_docs)} PostGIS documents")
#             else:
#                 print("🗄️  Loaded 0 PostGIS documents")
#                 
#         except ValueError as e:
#             # Configuration error (missing env vars)
#             print(f"⚠️  Database configuration incomplete: {str(e)}")
#             print("🗄️  Loaded 0 PostGIS documents")
#         except Exception as e:
#             # Any other database error
#             print(f"⚠️  Failed to load database documents: {str(e)}")
#             print("🗄️  Loaded 0 PostGIS documents")
#         
#         # Build vector store with all documents
#         print(f"\n🔨 Building FAISS index...")
#         
#         if len(all_documents) > 0:
#             # Log all documents before building index
#             print(f"\n{'='*80}")
#             print(f"📋 DOCUMENT INVENTORY ({len(all_documents)} documents)")
#             print('='*80)
#             for i, doc in enumerate(all_documents, 1):
#                 # Show preview (first 150 chars)
#                 preview = doc[:150] if len(doc) > 150 else doc
#                 if len(doc) > 150:
#                     preview += "..."
#                 print(f"\n{i}. Document Preview:")
#                 print(f"   {preview}")
#             print('\n' + '='*80 + '\n')
#             
#             vector_store = VectorStore(all_documents)
#             set_vector_store(vector_store)
#             print(f"✅ FAISS index built with {len(all_documents)} vectors")
#         else:
#             print("⚠️  No documents available - creating empty vector store")
#             set_vector_store(VectorStore([]))
#             print("✅ FAISS index built with 0 vectors")
#     
#     except Exception as e:
#         print(f"❌ Error initializing vector store: {str(e)}")
#         print("⚠️  Continuing with empty vector store")
#         set_vector_store(VectorStore([]))
#     
#     print("\n" + "="*80)
#     print("✨ NLP Service startup complete")
#     print("="*80 + "\n")

@app.post("/build-rag")
async def build_rag(background_tasks: BackgroundTasks):
    """Trigger RAG vector store build in background"""
    global rag_building

    if rag_building:
        return {
            "success": False,
            "message": "RAG is already building",
            "progress": rag_progress
        }

    background_tasks.add_task(build_vector_store)

    return {
        "success": True,
        "message": "RAG build started in background"
    }

@app.get("/rag-status")
async def rag_status():
    """Get RAG build status and progress"""
    return {
        "building": rag_building,
        "progress": rag_progress,
        "vectorstore_ready": vectorstore is not None
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "success": True,
        "message": "NLP service healthy",
        "vector_store_ready": get_vector_store() is not None
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=config.PORT,
        reload=True
    )
