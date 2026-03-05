import os
import requests
from dotenv import load_dotenv

load_dotenv()

# Toggle between Groq and Ollama
USE_GROQ = os.getenv("USE_GROQ", "true").lower() == "true"

if USE_GROQ:
    from groq import Groq
    
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not found in environment variables")
    
    groq_client = Groq(api_key=GROQ_API_KEY)
    MODEL_NAME = "llama-3.1-8b-instant"
    print(f"🤖 LLM Provider: Groq ({MODEL_NAME})")
else:
    # Ollama configuration
    OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3:8b")
    print(f"🤖 LLM Provider: Ollama ({OLLAMA_MODEL} at {OLLAMA_URL})")

def generate_response(system_prompt: str, user_prompt: str) -> str:
    """
    Generate LLM response using either Groq or Ollama based on USE_GROQ setting
    
    Args:
        system_prompt: System instruction for the LLM
        user_prompt: User's prompt/question
        
    Returns:
        Generated response text
    """
    try:
        if USE_GROQ:
            # Groq API
            chat_completion = groq_client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2
            )
            return chat_completion.choices[0].message.content
        
        else:
            # Ollama API
            # Combine system and user prompts for Ollama
            combined_prompt = f"{system_prompt}\n\n{user_prompt}"
            
            url = f"{OLLAMA_URL}/api/generate"
            body = {
                "model": OLLAMA_MODEL,
                "prompt": combined_prompt,
                "temperature": 0.2,
                "stream": False
            }
            
            response = requests.post(url, json=body, timeout=60)
            response.raise_for_status()
            
            result = response.json()
            return result.get("response", "").strip()

    except Exception as e:
        print(f"[LLM ERROR] {e}")
        return "LLM service temporarily unavailable."
