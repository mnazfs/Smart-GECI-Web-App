"""Intent classification for natural language queries"""
import json
# COMMENTED FOR GROQ MIGRATION - DO NOT DELETE (rollback safety)
# import requests
from typing import Dict
from app import config
from app.services.llm_provider import generate_response


def classify_intent(query: str) -> dict:
    """
    Classify the intent of a natural language query
    
    Args:
        query: The user's natural language query
        
    Returns:
        Dict with intent classification in format:
        {
            "intent": "sql_query" | "knowledge_query" | "geo_query"
        }
        
    Intent Rules:
        - sql_query: Numeric, count, field-based queries
        - knowledge_query: Definition/explanation questions
        - geo_query: Nearest, within, distance, location queries
    """
    
    # FIX 3: Deterministic pre-check for common knowledge patterns
    query_lower = query.lower().strip()
    knowledge_patterns = [
        "what is", "what are", "what's",
        "define", "definition of",
        "explain", "explanation of",
        "describe", "description of",
        "tell me about", "can you explain",
        "how does", "why does"
    ]
    
    for pattern in knowledge_patterns:
        if query_lower.startswith(pattern):
            print(f"🎯 Pre-check matched knowledge pattern: '{pattern}'")
            return {"intent": "knowledge_query"}
    
    # FIX 1: Strengthened prompt with semantic examples
    prompt = f"""You are an intent classifier for a Smart Campus AI system.

Return ONLY valid JSON:
{{
  "intent": "sql_query" | "knowledge_query" | "geo_query"
}}

Rules:

- If the question asks for explanation, definition, description, or conceptual information about Smart GECI, GIS, AI, sustainability, or the system itself → knowledge_query.

- If the question asks for numeric data, counts, building attributes, database fields, student numbers, bus data → sql_query.

- If the question involves spatial reasoning such as nearest, closest, within, distance, buffer, location-based queries → geo_query.

Examples:

"What is Smart GECI?" → knowledge_query
"Explain GIS integration." → knowledge_query
"How does the AI system work?" → knowledge_query
"Define sustainability in smart campus." → knowledge_query
"How many floors in CSE building?" → sql_query
"Show all students in department." → sql_query
"List buildings with more than 5 floors." → sql_query
"What is the total bus count?" → sql_query
"Which building is closest to library?" → geo_query
"Find buildings within 200 meters." → geo_query
"Distance from A to B building?" → geo_query
"Nearest bus stop to CSE." → geo_query

Query: "{query}"

Return JSON only. No explanation.

Format:
{{"intent": "knowledge_query"}}
OR
{{"intent": "sql_query"}}
OR
{{"intent": "geo_query"}}"""

    # FIX 2: Improved error handling with retry and safer default
    max_retries = 2
    
    for attempt in range(max_retries):
        try:
            # REPLACED OLLAMA with GROQ
            # url = f"{config.OLLAMA_URL}/api/generate"
            # body = {"model": config.OLLAMA_MODEL, "prompt": prompt, "temperature": 0, "stream": False}
            # response = requests.post(url, json=body, timeout=60)
            # response.raise_for_status()
            # result = response.json()
            # response_text = result.get("response", "").strip()
            
            response_text = generate_response(
                system_prompt="You are an intent classifier for Smart GECI. Classify user queries into: sql_query, knowledge_query, or geo_query.",
                user_prompt=prompt
            ).strip()
            
            # Clean response: remove markdown code blocks if present
            if response_text.startswith("```"):
                lines = response_text.split("\n")
                # Remove first and last line if they are code block markers
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                response_text = "\n".join(lines).strip()
            
            # Parse JSON response
            intent_data = json.loads(response_text)
            
            # Validate intent value
            valid_intents = ["sql_query", "knowledge_query", "geo_query"]
            if "intent" not in intent_data or intent_data["intent"] not in valid_intents:
                if attempt < max_retries - 1:
                    print(f"⚠️  Invalid intent on attempt {attempt + 1}, retrying...")
                    continue
                # Default to knowledge_query if invalid (safer than sql_query)
                print(f"⚠️  Invalid intent, defaulting to knowledge_query")
                return {"intent": "knowledge_query"}
            
            return intent_data
            
        except json.JSONDecodeError as e:
            if attempt < max_retries - 1:
                print(f"⚠️  Error on attempt {attempt + 1}: {str(e)}, retrying...")
                continue
            else:
                # Default to knowledge_query on error (safer than sql_query)
                print(f"❌ Error classifying intent after {max_retries} attempts: {str(e)}")
                print(f"⚠️  Defaulting to knowledge_query for safety")
                return {"intent": "knowledge_query"}
        except Exception as e:
            # Unexpected error - also default to knowledge_query
            print(f"❌ Unexpected error classifying intent: {str(e)}")
            print(f"⚠️  Defaulting to knowledge_query for safety")
            return {"intent": "knowledge_query"}
