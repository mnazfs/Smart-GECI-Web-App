"""RAG (Retrieval Augmented Generation) mode for knowledge queries"""
import json
# COMMENTED FOR GROQ MIGRATION - DO NOT DELETE (rollback safety)
# import requests
from typing import Dict, List, Optional
from app import config
from app.rag.vector_store_instance import get_vector_store
from app.rag.vector_store import retrieve_summary_docs, retrieve_row_docs
from app.services.llm_provider import generate_response


def generate_rag_answer(
    query: str,
    spatial_context: Optional[str] = None,
    entities: Optional[List[str]] = None,
) -> dict:
    """
    Generate answer using RAG (Retrieval Augmented Generation)
    
    Args:
        query: User's knowledge question
        
    Returns:
        Dict with answer in format:
        {
            "answer": "..."
        }
        
    Process:
        1. Retrieve top 3 relevant documents from vector store
        2. Build prompt with strict context-only instructions
        3. Call LLM to generate answer
        4. Return strict JSON response
    """
    try:
        # Ensure RAG exists
        vector_store = get_vector_store()
        
        if vector_store is None:
            return {
                "answer": "Knowledge base not initialized. Please build RAG from admin panel."
            }
        
        print(f"🔍 Starting two-phase RAG retrieval for: \"{query}\"")
        
        # -------------------------
        # PHASE 1 – SUMMARY RETRIEVAL
        # -------------------------
        print("\n📊 PHASE 1: Retrieving summary documents...")
        summary_docs = retrieve_summary_docs(vector_store, query, k=3)
        
        if not summary_docs or len(summary_docs) == 0:
            print("⚠️  No summary documents found, skipping to Phase 2")
            summary_context = ""
        else:
            summary_context = "\n\n".join(summary_docs)
            print(f"✓ Retrieved {len(summary_docs)} summary documents")
            print(f"\n{'='*80}")
            print("📄 SUMMARY CONTEXT")
            print('='*80)
            print(summary_context[:500] + "..." if len(summary_context) > 500 else summary_context)
            print('='*80 + '\n')
        
        # Inject spatial results (if any) as additional context for the LLM
        spatial_section = ""
        if spatial_context:
            spatial_section = f"\nSpatial Results (from map context):\n{spatial_context}\n"

        # Inject detected entity names as grounding context for the LLM
        entity_section = ""
        if entities:
            entity_lines = "\n".join(f"- {e}" for e in entities)
            entity_section = f"\nDetected Entities:\n{entity_lines}\n"

        phase1_prompt = f"""Context:
{summary_context}{spatial_section}{entity_section}
Question:
{query}

Answer clearly using only the provided context.
If exact numeric or specific values are not available, answer generally.
"""

        print("🤖 Phase 1: Calling LLM with summary context...")
        phase1_answer = generate_response(
            system_prompt="You are a precise geospatial AI assistant for Smart GECI.",
            user_prompt=phase1_prompt
        ).strip()
        
        print(f"✓ Phase 1 answer: {phase1_answer[:200]}{'...' if len(phase1_answer) > 200 else ''}")
        print(f"[Phase1 Answer]: {phase1_answer}")
        
        # -------------------------
        # SELF-EVALUATION
        # -------------------------
        print("\n🔍 Self-evaluation: Checking if Phase 2 needed...")
        
        evaluation_prompt = f"""User Question: {query}

Answer Given: {phase1_answer}

Does this answer lack exact numeric values or specific details needed to fully answer the question?

Reply ONLY with YES or NO."""

        evaluation_result = generate_response(
            system_prompt="You are evaluating answer completeness.",
            user_prompt=evaluation_prompt
        ).strip().upper()
        
        print(f"📊 Evaluation result: {evaluation_result}")
        print(f"[Evaluation Result]: {evaluation_result}")
        
        # -------------------------
        # PHASE 2 – ROW RETRIEVAL (IF NEEDED)
        # -------------------------
        if evaluation_result == "YES":
            print("[Phase2 Triggered]")
            print("\n📊 PHASE 2: Retrieving row documents for precise details...")
            row_docs = retrieve_row_docs(vector_store, query, k=5)
            
            if not row_docs or len(row_docs) == 0:
                print("⚠️  No row documents found, using Phase 1 answer")
                final_answer = phase1_answer
            else:
                row_context = "\n\n".join(row_docs)
                print(f"✓ Retrieved {len(row_docs)} row documents")
                print(f"\n{'='*80}")
                print("📄 ROW CONTEXT")
                print('='*80)
                print(row_context[:500] + "..." if len(row_context) > 500 else row_context)
                print('='*80 + '\n')

                phase2_prompt = f"""Context:
{row_context}

Question:
{query}

Provide a precise and complete answer using the context."""

                print("🤖 Phase 2: Calling LLM with row context...")
                final_answer = generate_response(
                    system_prompt="You are a precise geospatial AI assistant.",
                    user_prompt=phase2_prompt
                ).strip()
                
                print(f"✓ Phase 2 answer (final): {final_answer[:200]}{'...' if len(final_answer) > 200 else ''}")
        else:
            print("[Phase2 Skipped]")
            print("✓ Phase 1 answer sufficient, skipping Phase 2")
            final_answer = phase1_answer
        
        # -------------------------
        # RETURN RESPONSE
        # -------------------------
        print(f"\n✨ Final answer generated successfully\n")
        
        return {
            "answer": final_answer
        }
        
    except Exception as e:
        print(f"❌ Error generating RAG answer: {str(e)}")
        return {
            "answer": f"An error occurred while processing your question: {str(e)}"
        }
