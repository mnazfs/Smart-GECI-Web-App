from typing import Dict, Any
# COMMENTED FOR GROQ MIGRATION - DO NOT DELETE (rollback safety)
# from app.services.ollama_client import call_ollama
from app.services.llm_provider import generate_response
from app.services.prompt_builder import (
    build_planning_prompt,
    build_refinement_prompt,
    build_formatting_prompt,
    PromptBuilder
)
from app.services.response_parser import ResponseParser
from app.models.query_plan import QueryPlan
from app.models.sql_builder import build_sql
from app.modes.intent import classify_intent
from app.modes.rag import generate_rag_answer


def parse_schema(schema_text: str) -> Dict[str, Dict[str, Any]]:
    """
    Parse schema text to extract tables and columns
    
    Args:
        schema_text: Schema description text
        
    Returns:
        Dictionary mapping table names to their column lists
    """
    schema_cache = {}
    lines = schema_text.split('\n')
    current_table = None
    
    for line in lines:
        line = line.strip()
        
        # Detect table line
        if line.startswith('Table: '):
            table_name = line.replace('Table: ', '').strip().strip('"')
            current_table = table_name
            schema_cache[current_table] = {"columns": []}
        
        # Detect column line (starts with dash or contains "Column:")
        elif current_table and ('Column:' in line or line.startswith('-')):
            # Extract column name (before colon or parenthesis)
            if 'Column:' in line:
                col_part = line.split('Column:')[1].strip()
            else:
                col_part = line.lstrip('- ').strip()
            
            # Get the column name (first word, remove quotes)
            col_name = col_part.split()[0].strip('"').strip(',').strip(':')
            if col_name:
                schema_cache[current_table]["columns"].append(col_name)
    
    return schema_cache


def validate_plan(plan: QueryPlan, schema_cache: Dict[str, Dict[str, Any]]):
    """
    Validate query plan against schema cache
    
    Args:
        plan: QueryPlan to validate
        schema_cache: Schema cache with table and column info
        
    Raises:
        ValueError: If plan contains invalid table or columns
    """
    if plan.table not in schema_cache:
        raise ValueError(f"Invalid table in plan: {plan.table}")
    
    table_columns = schema_cache[plan.table]["columns"]
    
    for col in plan.columns:
        if col not in table_columns:
            raise ValueError(f"Invalid column: {col} not in table {plan.table}")
    
    for cond in plan.conditions:
        if cond.column not in table_columns:
            raise ValueError(f"Invalid condition column: {cond.column} not in table {plan.table}")
    
    for agg in plan.aggregations:
        if agg.column not in table_columns:
            raise ValueError(f"Invalid aggregation column: {agg.column} not in table {plan.table}")


def handle_mode(mode: str, payload: dict) -> dict:
    """
    Handle generation request based on mode
    
    Args:
        mode: Generation mode (planning, refinement, formatting)
        payload: Request payload containing input and context
        
    Returns:
        Dictionary with mode-specific response
        
    Raises:
        Exception: If mode is unknown or processing fails
    """
    if mode == "planning":
        query = payload.get("query", "")
        schema = payload.get("schema", "")
        
        prompt = build_planning_prompt(query, schema)
        # REPLACED: response = call_ollama(prompt)
        raw_text = generate_response(
            system_prompt="You are a SQL query planner for Smart GECI. Generate structured query plans in JSON format.",
            user_prompt=prompt
        )
        print(f"📝 Raw LLM response for planning:\n{raw_text}\n")
        
        try:
            parsed = ResponseParser.extract_json_from_response(raw_text)
            print(f"📋 Planning JSON parsed successfully:\n{parsed}\n")
            
            # Create QueryPlan from parsed JSON
            plan = QueryPlan(**parsed)
            print(f"✓ QueryPlan created: {plan}\n")
            
            # Parse schema and validate plan
            schema_cache = parse_schema(schema)
            print(f"📊 Parsed schema: {len(schema_cache)} tables\n")
            
            validate_plan(plan, schema_cache)
            print(f"✅ Plan validation passed\n")
            
            # Build SQL from QueryPlan
            generated_sql = build_sql(plan)
            print(f"🔨 Generated SQL:\n{generated_sql}\n")
            
            # Return SQL and plan data
            return {
                "sql": generated_sql,
                "plan": parsed
            }
        except Exception as e:
            print(f"❌ Failed to parse JSON from LLM response: {str(e)}")
            raise Exception(f"Failed to parse LLM response as JSON: {str(e)}")
    
    elif mode == "refinement":
        original_query = payload.get("original_query", "")
        execution_results = payload.get("execution_results", {})
        
        prompt = build_refinement_prompt(original_query, execution_results)
        # REPLACED: response = call_ollama(prompt)
        raw_text = generate_response(
            system_prompt="You are a data refinement assistant for Smart GECI. Refine query results into structured JSON.",
            user_prompt=prompt
        )
        print(f"📝 Raw LLM response for refinement:\n{raw_text}\n")
        
        try:
            parsed = ResponseParser.extract_json_from_response(raw_text)
            return parsed
        except Exception as e:
            print(f"❌ Failed to parse JSON from LLM response: {str(e)}")
            raise Exception(f"Failed to parse LLM response as JSON: {str(e)}")
    
    elif mode == "formatting":
        original_query = payload.get("query", "")
        final_data = payload.get("final_data", {})
        
        prompt = build_formatting_prompt(original_query, final_data)
        # REPLACED: response = call_ollama(prompt)
        raw_text = generate_response(
            system_prompt="You are a response formatter for Smart GECI. Format query results into human-readable summaries.",
            user_prompt=prompt
        )
        print(f"📝 Raw LLM response for formatting:\n{raw_text}\n")
        
        try:
            parsed = ResponseParser.extract_json_from_response(raw_text)
            return {
                "summary": parsed.get("summary", "")
            }
        except Exception as e:
            print(f"❌ Failed to parse JSON from LLM response: {str(e)}")
            raise Exception(f"Failed to parse LLM response as JSON: {str(e)}")
    
    elif mode == "table_selection":
        query = payload.get("query", "")
        schema = payload.get("schema", "")
        
        prompt = PromptBuilder.build_prompt(
            user_input=query,
            mode="table_selection",
            context={"schema": schema}
        )
        # REPLACED: response = call_ollama(prompt)
        raw_text = generate_response(
            system_prompt="You are a database table selector for Smart GECI. Select appropriate tables for queries.",
            user_prompt=prompt
        )
        print(f"📝 Raw LLM response for table_selection:\n{raw_text}\n")
        
        try:
            parsed = ResponseParser.extract_json_from_response(raw_text)
            return parsed
        except Exception as e:
            print(f"❌ Failed to parse JSON from LLM response: {str(e)}")
            raise Exception(f"Failed to parse LLM response as JSON: {str(e)}")
    
    elif mode == "intent":
        query = payload.get("query", "")
        
        if not query:
            raise Exception("Query is required for intent classification")
        
        # Call classify_intent to get intent classification
        intent_result = classify_intent(query)
        print(f"🎯 Intent classified: {intent_result}\n")
        
        return intent_result
    
    elif mode == "rag":
        query = payload.get("query", "")

        if not query:
            raise Exception("Query is required for RAG")

        # NEW: Check for optional spatial map context
        # Import is local to avoid circular-import risk at module level
        from app.services.map_context_handler import process_map_context
        spatial_data = process_map_context(query, payload)
        spatial_context: str | None = spatial_data.get("spatial_text") if spatial_data else None
        map_actions: list = spatial_data.get("map_actions", []) if spatial_data else []

        # Call generate_rag_answer — spatial_context is injected when present
        rag_result = generate_rag_answer(query, spatial_context=spatial_context)
        print(f"📚 RAG answer generated\n")

        # Extend response with map_actions when spatial data is available
        # Clients that don't understand map_actions safely ignore the extra field
        if map_actions:
            rag_result["map_actions"] = map_actions

        return rag_result
    
    else:
        raise Exception(f"Unknown mode: {mode}")

