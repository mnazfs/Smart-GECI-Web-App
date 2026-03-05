from pydantic import BaseModel
from typing import Dict, Any

class GenerateRequest(BaseModel):
    """Request model for text generation"""
    mode: str
    payload: Dict[str, Any]

class GenerateResponse(BaseModel):
    """Response model for text generation"""
    success: bool
    data: Dict[str, Any]
