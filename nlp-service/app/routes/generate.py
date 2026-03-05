from fastapi import APIRouter, HTTPException
from app.models.request_models import GenerateRequest, GenerateResponse
from app.services.mode_handler import handle_mode

router = APIRouter()

@router.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    """
    Generate NLP response based on input and mode
    
    Args:
        request: GenerateRequest containing mode and payload
        
    Returns:
        GenerateResponse with success and data
    """
    try:
        result = handle_mode(
            mode=request.mode,
            payload=request.payload
        )
        
        return GenerateResponse(
            success=True,
            data=result
        )
        
    except Exception as e:
        return GenerateResponse(
            success=False,
            data={"error": str(e)}
        )
