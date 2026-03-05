@echo off

start cmd /k "cd /d D:\Smart GECI Web App\frontend && npm run dev"
start cmd /k "cd /d D:\Smart GECI Web App\backend && npm run dev"
start cmd /k "cd /d D:\Smart GECI Web App\nlp-service && py -3.14 -m uvicorn app.main:app --port 8001 --reload"
start cmd /k "cd /d D:\Smart GECI Web App\uhi-module && npm run dev"
start cmd /k "cd /d D:\Smart GECI Web App\uhi-module\backend && python -m uvicorn main:app --reload --port 8002"

echo Starting all Smart GECI services...