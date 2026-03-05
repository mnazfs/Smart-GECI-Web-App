# NLP Service

A FastAPI-based service for natural language processing using Ollama.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment variables in `.env`:
```
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2
```

3. Ensure Ollama is running locally

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

## API Endpoints

- `POST /api/generate` - Generate NLP responses
- `GET /health` - Health check endpoint

## Example Request

```bash
curl -X POST "http://localhost:8001/api/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Translate: Show me all cities",
    "mode": "sql_generation",
    "context": {}
  }'
```
