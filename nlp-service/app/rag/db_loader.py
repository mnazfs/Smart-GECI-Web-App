"""
Database loader module for fetching and converting PostGIS data into RAG documents.
"""
import os
import logging
from typing import List, Optional, Dict, Any
from app.services.llm_provider import generate_response

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    raise ImportError(
        "psycopg2 is required for database connectivity. "
        "Install it with: pip install psycopg2-binary"
    )

logger = logging.getLogger(__name__)


def _get_db_connection():
    """
    Create and return a PostgreSQL database connection using environment variables.
    
    Returns:
        psycopg2.connection: Active database connection
        
    Raises:
        ValueError: If required environment variables are missing
        psycopg2.Error: If connection fails
    """
    db_host = os.getenv("DB_HOST")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME")
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    
    # Validate required credentials
    if not all([db_host, db_name, db_user, db_password]):
        raise ValueError(
            "Missing required database credentials. "
            "Please set DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD environment variables."
        )
    
    try:
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            dbname=db_name,
            user=db_user,
            password=db_password
        )
        logger.info(f"Successfully connected to database: {db_name}")
        return conn
    except psycopg2.Error as e:
        logger.error(f"Failed to connect to database: {e}")
        raise


def _convert_geometry_to_text(geom_wkb: Optional[bytes], srid: int = 4326) -> Optional[str]:
    """
    Convert PostGIS geometry (WKB format) to human-readable text.
    
    Args:
        geom_wkb: Geometry in WKB (Well-Known Binary) format
        srid: Spatial Reference System Identifier (default: 4326 for WGS84 lat/lng)
        
    Returns:
        Human-readable geometry description or None if geometry is invalid
    """
    if not geom_wkb:
        return None
    
    try:
        # Use shapely to parse WKB
        from shapely import wkb
        geom = wkb.loads(bytes(geom_wkb))
        
        geom_type = geom.geom_type
        
        if geom_type == "Point":
            lon, lat = geom.x, geom.y
            return f"Location: {lat:.6f}°N, {lon:.6f}°E"
        
        elif geom_type == "Polygon" or geom_type == "MultiPolygon":
            centroid = geom.centroid
            lon, lat = centroid.x, centroid.y
            area = geom.area
            return f"Area centered at {lat:.6f}°N, {lon:.6f}°E (approximate area: {area:.2f} sq units)"
        
        elif geom_type == "LineString" or geom_type == "MultiLineString":
            coords = list(geom.coords) if geom_type == "LineString" else list(geom.geoms[0].coords)
            if len(coords) >= 2:
                start_lon, start_lat = coords[0]
                end_lon, end_lat = coords[-1]
                return f"Line from {start_lat:.6f}°N, {start_lon:.6f}°E to {end_lat:.6f}°N, {end_lon:.6f}°E"
        
        else:
            # Generic fallback
            centroid = geom.centroid
            lon, lat = centroid.x, centroid.y
            return f"{geom_type} at approximately {lat:.6f}°N, {lon:.6f}°E"
            
    except Exception as e:
        logger.warning(f"Failed to convert geometry to text: {e}")
        return None


def _row_to_document(row: Dict[str, Any], table_name: str) -> str:
    """
    Convert a database row into a human-readable text paragraph.
    
    Args:
        row: Dictionary containing row data
        table_name: Name of the source table
        
    Returns:
        Formatted text document
    """
    parts = [f"[{table_name.upper()}]"]
    
    for key, value in row.items():
        # Skip None values and empty strings
        if value is None or value == "":
            continue
        
        # Handle geometry columns (typically named 'geom', 'geometry', 'the_geom', etc.)
        if key.lower() in ["geom", "geometry", "the_geom", "shape", "wkb_geometry"]:
            # Check if it's binary data (WKB format)
            if isinstance(value, (bytes, memoryview)):
                geo_text = _convert_geometry_to_text(value)
                if geo_text:
                    parts.append(geo_text)
            continue
        
        # Format the field name nicely
        field_name = key.replace("_", " ").title()
        
        # Handle different value types
        if isinstance(value, (int, float)):
            parts.append(f"{field_name}: {value}")
        elif isinstance(value, str):
            # Truncate very long strings
            if len(value) > 500:
                value = value[:500] + "..."
            parts.append(f"{field_name}: {value}")
        else:
            # Generic string conversion for other types
            parts.append(f"{field_name}: {str(value)}")
    
    return " | ".join(parts)


def summarize_table(table_name: str, rows: List[Dict[str, Any]]) -> str:
    """
    Sends entire table data to LLM and generates a summarized semantic document.
    
    Args:
        table_name: Name of the database table
        rows: List of row dictionaries from the table
        
    Returns:
        Summary text document describing the table content
    """
    # Convert rows to readable text
    table_text = ""
    for idx, row in enumerate(rows, 1):
        # Filter out geometry columns for summary
        filtered_row = {k: v for k, v in row.items() 
                       if k.lower() not in ["geom", "geometry", "the_geom", "shape", "wkb_geometry"]}
        
        row_text = " | ".join([f"{k}: {v}" for k, v in filtered_row.items() if v is not None])
        table_text += f"{idx}. {row_text}\n"
        
        # Limit to first 50 rows for summary to avoid token limits
        if idx >= 50:
            table_text += f"... ({len(rows)} total rows in table)\n"
            break

    prompt = f"""You are summarizing database content for a geospatial AI system.

Table Name: {table_name}

Here is the raw data from the table:

{table_text}

Create a structured summary that:
1. Describes what this table represents.
2. Mentions important entities and their key attributes.
3. Preserves important numeric values (counts, IDs, coordinates).
4. Is suitable for answering general questions about this table.

Keep it concise but informative (2-4 paragraphs)."""

    summary = generate_response(
        system_prompt="You are a database summarization assistant for geospatial data.",
        user_prompt=prompt
    )

    return summary


def load_database_documents() -> List[str]:
    """
    Load documents from the PostGIS database.
    Currently fetches data from the 'buildings' table and converts rows to text documents.
    
    Returns:
        List of text documents, one per database row
        
    Raises:
        Exception: If database operations fail
    """
    documents = []
    conn = None
    cursor = None
    
    try:
        # Get database connection
        conn = _get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Define tables to fetch (currently buildings and cse_1f)
        tables_config = [
            {
                "table": "buildings",
                "query": """
                    SELECT *, ST_AsEWKB(geom) as geom
                    FROM buildings
                    LIMIT 1000
                """
            },
            {
                "table": "cse_1f",
                "query": """
                    SELECT *, ST_AsEWKB(geom) as geom
                    FROM cse_1f
                    LIMIT 1000
                """
            }
        ]
        
        # Process each table
        for config in tables_config:
            table_name = config["table"]
            query = config["query"]
            
            logger.info(f"Fetching data from table: {table_name}")
            
            try:
                cursor.execute(query)
                rows = cursor.fetchall()
                
                logger.info(f"Retrieved {len(rows)} rows from {table_name}")
                
                # Convert DB rows into list of dicts
                row_dicts = [dict(row) for row in rows]
                
                # --------- TABLE SUMMARY GENERATION ---------
                if len(row_dicts) > 0:
                    print(f"🧠 Generating summary for table: {table_name}")
                    try:
                        table_summary_text = summarize_table(table_name, row_dicts)
                        
                        # Add metadata marker for summary document
                        summary_doc = f"[SUMMARY:{table_name.upper()}] {table_summary_text}"
                        documents.append(summary_doc)
                        
                        print(f"✓ Summary document added for {table_name}")
                    except Exception as e:
                        logger.warning(f"Failed to generate summary for {table_name}: {e}")
                        print(f"⚠️  Could not generate summary for {table_name}")
                
                # Convert each row to a document (existing logic with metadata)
                for row in rows:
                    doc = _row_to_document(dict(row), table_name)
                    documents.append(doc)
                    
            except psycopg2.Error as e:
                logger.error(f"Error querying table {table_name}: {e}")
                # Continue with other tables even if one fails
                continue
        
        logger.info(f"Successfully loaded {len(documents)} documents from database")
        
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        raise
    
    except psycopg2.Error as e:
        logger.error(f"Database error: {e}")
        raise
    
    except Exception as e:
        logger.error(f"Unexpected error loading database documents: {e}")
        raise
    
    finally:
        # Clean up resources
        if cursor:
            cursor.close()
        if conn:
            conn.close()
            logger.info("Database connection closed")
    
    return documents
