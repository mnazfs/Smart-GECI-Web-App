from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from app.routes import generate
from app import config
from app.rag.knowledge_loader import load_documents
from app.rag.db_loader import load_database_documents, get_available_tables, get_all_available_tables
from app.rag.vector_store import VectorStore
from app.rag.vector_store_instance import set_vector_store, get_vector_store
from app.rag.table_registry import load_registry, reset_registry, register_table
from app.services.rag_incremental_loader import add_table_to_vectorstore
import asyncio
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

class BuildRagRequest(BaseModel):
    selected_tables: Optional[List[str]] = None


class AddTableRequest(BaseModel):
    table_name: str


def build_vector_store(selected_tables: Optional[List[str]] = None):
    """
    Build RAG vector store with progress tracking.
    Updates global state: vectorstore, rag_building, rag_progress

    Args:
        selected_tables: Optional list of table names to include in the RAG.
            If None or empty, all public tables are included.
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
        if selected_tables:
            print(f"\n🗄️  Loading PostGIS documents from selected tables: {selected_tables}...")
        else:
            print("\n🗄️  Loading PostGIS documents from all tables...")
        rag_progress = 30
        
        try:
            db_docs = load_database_documents(selected_tables=selected_tables)
            
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

        # ── Reset registry to reflect what was just built ──────────────────────
        print("📋 Updating table registry…")
        reset_registry()
        tables_to_register = selected_tables if selected_tables else []
        if not tables_to_register:
            # Full build with no explicit selection — register every public table
            try:
                tables_to_register = [t["table_name"] for t in get_available_tables()]
            except Exception:
                tables_to_register = []
        for tbl in tables_to_register:
            register_table(tbl, row_docs=0, summary_doc=True)
        print(f"✓ Registry updated with {len(tables_to_register)} table(s)")
    
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

@app.get("/db-tables")
async def get_db_tables():
    """Return all available tables from the connected PostgreSQL database.

    Each entry includes an `in_kb` boolean indicating whether the table
    has already been indexed in the vector store.
    """
    try:
        tables = get_available_tables()
        registry = load_registry()
        indexed = registry.get("tables", {})
        for t in tables:
            t["in_kb"] = t["table_name"] in indexed
        return {"success": True, "tables": tables}
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/kb/tables")
async def get_kb_tables():
    """Return every user-accessible table across all non-system schemas.

    Unlike /db-tables (which is limited to the 'public' schema), this endpoint
    spans all schemas so that application tables such as users, feedback, and
    layer_registry are visible alongside the PostGIS spatial tables.

    Each entry includes an `in_kb` boolean indicating whether the table has
    already been indexed in the vector store.
    """
    try:
        tables = get_all_available_tables()
        registry = load_registry()
        indexed = registry.get("tables", {})
        for t in tables:
            t["in_kb"] = t["table_name"] in indexed
        return {"success": True, "tables": tables}
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/rag/tables-status")
async def get_rag_tables_status():
    """Return all public DB tables with their knowledge-base indexed status.

    Response: list of {"table": str, "in_kb": bool}
    """
    try:
        db_tables = get_available_tables()
        registry = load_registry()
        indexed = registry.get("tables", {})
        return [
            {"table": t["table_name"], "in_kb": t["table_name"] in indexed}
            for t in db_tables
        ]
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/add-table")
async def add_table_endpoint(body: AddTableRequest):
    """Incrementally add a single PostGIS table to the vector store.

    Does NOT rebuild the full index — only encodes the new table's documents
    and appends them to the existing FAISS index.

    Body: { "table_name": "<name>" }
    """
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, add_table_to_vectorstore, body.table_name
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.post("/build-rag")
async def build_rag(background_tasks: BackgroundTasks, body: BuildRagRequest = BuildRagRequest()):
    """Trigger RAG vector store build in background.

    Accepts an optional JSON body: { "selected_tables": ["table1", "table2"] }
    If selected_tables is omitted or empty, all public tables are used.
    """
    global rag_building

    if rag_building:
        return {
            "success": False,
            "message": "RAG is already building",
            "progress": rag_progress
        }

    background_tasks.add_task(build_vector_store, body.selected_tables)

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
