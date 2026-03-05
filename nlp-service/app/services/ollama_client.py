import requests
from typing import Optional, Dict, Any
from app import config

def call_ollama(prompt: str) -> dict:
    """
    Call Ollama API to generate text
    
    Args:
        prompt: The input prompt
        
    Returns:
        JSON response from Ollama
        
    Raises:
        Exception: If Ollama request fails
    """
    try:
        url = f"{config.OLLAMA_URL}/api/generate"
        
        body = {
            "model": config.OLLAMA_MODEL,
            "prompt": prompt,
            "temperature": config.TEMPERATURE,
            "stream": False
        }
        
        response = requests.post(url, json=body, timeout=60)
        response.raise_for_status()
        
        return response.json()
        
    except requests.exceptions.RequestException as e:
        raise Exception(f"Ollama request failed: {str(e)}")
    except Exception as e:
        raise Exception(f"Unexpected error calling Ollama: {str(e)}")

class OllamaClient:
    """Client for interacting with Ollama API"""
    
    def __init__(self):
        self.base_url = config.OLLAMA_URL
        self.model = config.OLLAMA_MODEL
    
    def generate(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        stream: bool = False
    ) -> Dict[str, Any]:
        """
        Generate text using Ollama
        
        Args:
            prompt: The input prompt
            temperature: Temperature for generation
            max_tokens: Maximum tokens to generate
            stream: Whether to stream the response
            
        Returns:
            Dictionary containing the response
        """
        try:
            url = f"{self.base_url}/api/generate"
            
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": stream,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens
                }
            }
            
            response = requests.post(url, json=payload, timeout=60)
            response.raise_for_status()
            
            data = response.json()
            
            return {
                "success": True,
                "response": data.get("response", ""),
                "model": data.get("model", self.model),
                "done": data.get("done", False)
            }
            
        except requests.exceptions.RequestException as e:
            return {
                "success": False,
                "error": f"Ollama request failed: {str(e)}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}"
            }
    
    def health_check(self) -> bool:
        """Check if Ollama service is available"""
        try:
            url = f"{self.base_url}/api/tags"
            response = requests.get(url, timeout=5)
            return response.status_code == 200
        except:
            return False
