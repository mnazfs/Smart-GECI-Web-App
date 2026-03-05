from typing import Dict, Any, Optional

def build_planning_prompt(query: str, schema: str) -> str:
    """
    Build prompt for SQL planning phase
    
    Args:
        query: User's natural language query
        schema: Database schema definition
        
    Returns:
        Formatted prompt string for planning
    """
    prompt = f"""You MUST return ONLY a valid JSON object.

STRICT OUTPUT RULES:
- Do NOT include any explanation.
- Do NOT include markdown.
- Do NOT include triple backticks.
- Do NOT include any text before or after JSON.
- Output must start with {{ and end with }}.
- Do NOT wrap JSON in code blocks.
- Do NOT add commentary.
- If you include anything outside JSON, the response will be rejected.

You are a database query planner.

Your task is to generate a structured query plan in JSON format.

DO NOT generate SQL.

Use ONLY the tables and columns provided in the schema.

DATABASE SCHEMA:
{schema}

USER QUERY:
{query}

Allowed operators:
- equals
- contains
- greater_than
- less_than

Allowed aggregation functions:
- COUNT
- SUM
- AVG
- MAX
- MIN

Rules:
- If user asks "how many", use operation = "count" and set aggregations = []
- If user asks for SUM/AVG/MAX/MIN of a column, use operation = "aggregate"
- If user asks for specific field, use operation = "select"
- Never invent new columns
- Never invent new tables
- Never include SQL syntax

When specifying column names:
- Use column names exactly as shown in schema
- Do NOT include double quotes around column names
- Example: use Name, not \"Name\"

Output format:
{{
  "operation": "count" | "select" | "aggregate",
  "table": "table_name",
  "columns": ["col1", "col2"],
  "aggregations": [],
  "conditions": [],
  "limit": 10
}}

For operation = "count": Set aggregations = [], columns can be []
For operation = "select": Set aggregations = [], list columns to retrieve
For operation = "aggregate": Set aggregations = [{{"function": "SUM", "column": "column_name"}}]

Aggregation object format:
{{
  "function": "COUNT" | "SUM" | "AVG" | "MAX" | "MIN",
  "column": "column_name"
}}

Condition object format:
{{
  "column": "column_name",
  "operator": "equals" | "contains" | "greater_than" | "less_than",
  "value": "value"
}}

Return ONLY the JSON object, nothing else."""
    return prompt

def build_refinement_prompt(original_query: str, execution_results: dict) -> str:
    """
    Build prompt for SQL refinement phase
    
    Args:
        original_query: Original SQL query that was executed
        execution_results: Results from executing the query
        
    Returns:
        Formatted prompt string for refinement
    """
    prompt = f"""You are a PostgreSQL/PostGIS expert. Refine the SQL query based on execution results.

ORIGINAL SQL:
{original_query}

EXECUTION RESULTS:
{execution_results}

TASK:
Improve the SQL query to better answer the user's intent.

STRICT REQUIREMENTS:
- Use ONLY SELECT statements
- Always include LIMIT clause
- Fix any errors or inefficiencies
- Return VALID JSON ONLY, no markdown, no explanations
- DO NOT introduce new columns or functions that were not present in the original SQL unless fixing a clear execution error.
- DO NOT change selected columns unless necessary.
- DO NOT include a semicolon at the end of the SQL query.
- The SQL string MUST NOT end with ';'.
- If execution returned 0 rows, adjust only the WHERE clause matching logic.

OUTPUT FORMAT (JSON ONLY):
{{
  "sql": "improved query",
  "changes_made": "brief description"
}}

Return only the JSON object, nothing else."""
    return prompt

def build_formatting_prompt(original_query: str, final_data: dict) -> str:
    """
    Build prompt for formatting results into user-friendly summary
    
    Args:
        original_query: Original user query
        final_data: Final data to be formatted
        
    Returns:
        Formatted prompt string for summary generation
    """
    prompt = f"""You are a data presentation expert. Create a user-friendly summary.

USER QUERY:
{original_query}

DATA:
{final_data}

TASK:
Generate a clear, concise summary that answers the user's question.

STRICT REQUIREMENTS:
- Be conversational and helpful
- Include key insights from the data
- Keep it brief (2-3 sentences)
- Return VALID JSON ONLY, no markdown, no explanations

OUTPUT FORMAT (JSON ONLY):
{{
  "summary": "user-friendly text summary here"
}}

Return only the JSON object, nothing else."""
    return prompt

class PromptBuilder:
    """Build prompts based on mode and context"""
    
    @staticmethod
    def build_prompt(user_input: str, mode: str, context: Optional[Dict[str, Any]] = None) -> str:
        """
        Build a prompt based on the mode and context
        
        Args:
            user_input: The user's input text
            mode: The generation mode
            context: Additional context information
            
        Returns:
            Formatted prompt string
        """
        context = context or {}
        
        if mode == "planning":
            schema = context.get("schema", "")
            return build_planning_prompt(user_input, schema)
        elif mode == "refinement":
            execution_results = context.get("execution_results", {})
            return build_refinement_prompt(user_input, execution_results)
        elif mode == "formatting":
            final_data = context.get("final_data", {})
            return build_formatting_prompt(user_input, final_data)
        elif mode == "sql_generation":
            return PromptBuilder._build_sql_prompt(user_input, context)
        elif mode == "schema_analysis":
            return PromptBuilder._build_schema_prompt(user_input, context)
        elif mode == "query_explanation":
            return PromptBuilder._build_explanation_prompt(user_input, context)
        elif mode == "table_selection":
            return PromptBuilder._build_table_selection_prompt(user_input, context)
        else:
            return user_input
    
    @staticmethod
    def _build_sql_prompt(user_input: str, context: Dict[str, Any]) -> str:
        """Build prompt for SQL generation"""
        schema_info = context.get("schema", "")
        
        prompt = f"""You are a SQL expert. Convert the following natural language query to SQL.

Database Schema:
{schema_info}

User Query: {user_input}

Generate only the SQL query without explanation."""
        return prompt
    
    @staticmethod
    def _build_schema_prompt(user_input: str, context: Dict[str, Any]) -> str:
        """Build prompt for schema analysis"""
        schema = context.get("schema", "")
        
        prompt = f"""Analyze the following database schema and answer the question.

Schema:
{schema}

Question: {user_input}

Provide a clear and concise answer."""
        return prompt
    
    @staticmethod
    def _build_explanation_prompt(user_input: str, context: Dict[str, Any]) -> str:
        """Build prompt for query explanation"""
        query = context.get("query", user_input)
        
        prompt = f"""Explain the following SQL query in simple terms.

SQL Query:
{query}

Provide a clear explanation of what this query does."""
        return prompt
    
    @staticmethod
    def _build_table_selection_prompt(user_input: str, context: Dict[str, Any]) -> str:
        """Build prompt for table selection phase
        
        This prompt helps identify which tables are relevant to answer the user's query.
        It includes only table and column names without data types, constraints, or sample values.
        
        Args:
            user_input: The user's natural language query
            context: Dictionary containing schema information
            
        Returns:
            Formatted prompt string for table selection
        """
        schema = context.get("schema", "")
        
        # Extract only table and column names from schema (no data types, constraints, or sample values)
        # The schema is expected to be provided in a simplified format by the caller
        
        prompt = f"""You are a database expert specializing in table selection for query planning.
Your task is to identify which tables are needed to answer the user's query.

DATABASE SCHEMA (Table and Column Names Only):
{schema}

USER QUERY:
{user_input}

CRITICAL REQUIREMENTS:
- Identify which tables are needed to answer the query
- Choose only tables that are directly required
- If unsure, include the most likely table
- Return VALID JSON ONLY, no markdown, no explanations
- DO NOT generate SQL
- DO NOT include explanations

OUTPUT FORMAT (JSON ONLY):
{{
  "relevant_tables": ["table1", "table2"],
  "confidence": 0.0-1.0
}}

Return only the JSON object, nothing else."""
        return prompt
