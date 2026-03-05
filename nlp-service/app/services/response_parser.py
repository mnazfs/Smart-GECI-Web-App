import re
import json
from typing import Dict, Any, Optional

class ResponseParser:
    """Parse and clean responses from LLM"""
    
    @staticmethod
    def extract_json_from_response(raw_text: str) -> dict:
        """
        Extract and parse JSON from LLM response
        
        Args:
            raw_text: Raw LLM response text
            
        Returns:
            Parsed JSON dictionary
            
        Raises:
            Exception: If JSON extraction or parsing fails
        """
        try:
            # Remove markdown code blocks
            cleaned = re.sub(r'```json\s*', '', raw_text, flags=re.IGNORECASE)
            cleaned = re.sub(r'```\s*', '', cleaned)
            
            # Find first { and last } to extract JSON object
            first_brace = cleaned.find('{')
            last_brace = cleaned.rfind('}')
            
            if first_brace == -1 or last_brace == -1:
                raise Exception("No JSON object found in LLM response")
            
            # Extract substring from first { to last }
            json_str = cleaned[first_brace:last_brace + 1]
            
            # Parse JSON strictly
            parsed = json.loads(json_str)
            
            if not isinstance(parsed, dict):
                raise Exception("Extracted JSON is not a dictionary")
            
            return parsed
            
        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse JSON: {str(e)}")
        except Exception as e:
            raise Exception(f"Failed to extract JSON from response: {str(e)}")
    
    @staticmethod
    def parse_sql_response(response: str) -> str:
        """
        Extract SQL query from LLM response
        
        Args:
            response: Raw LLM response
            
        Returns:
            Cleaned SQL query
        """
        # Remove markdown code blocks
        sql = re.sub(r'```sql\s*|```\s*', '', response, flags=re.IGNORECASE)
        
        # Remove common explanatory text
        sql = re.sub(r'^(here is|here\'s|the sql query is).*?:\s*', '', sql, flags=re.IGNORECASE | re.MULTILINE)
        
        # Clean up whitespace
        sql = sql.strip()
        
        return sql
    
    @staticmethod
    def parse_general_response(response: str) -> str:
        """
        Clean general text response
        
        Args:
            response: Raw LLM response
            
        Returns:
            Cleaned response
        """
        # Remove excessive whitespace
        cleaned = re.sub(r'\s+', ' ', response)
        return cleaned.strip()
    
    @staticmethod
    def extract_metadata(response: str, mode: str) -> Dict[str, Any]:
        """
        Extract metadata from response
        
        Args:
            response: Raw LLM response
            mode: Generation mode
            
        Returns:
            Dictionary containing metadata
        """
        metadata = {
            "length": len(response),
            "mode": mode
        }
        
        if mode == "sql_generation":
            # Count SQL keywords
            sql_keywords = ["SELECT", "FROM", "WHERE", "JOIN", "GROUP BY", "ORDER BY"]
            metadata["sql_keywords"] = sum(1 for kw in sql_keywords if kw in response.upper())
        
        return metadata
