"""
main.py — FastAPI application entry point.

Mounts the frontend as static files and wires in the API router.
Run with: uvicorn backend.main:app --reload  (from the project root)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from backend.api.routes import router

app = FastAPI(
    title="Epidemic Spread Simulator",
    description="Algorithm Visualization Lab — DAA + DMS Project",
    version="1.0.0",
)

# Allow the browser (running on any local port) to reach the API during dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all algorithm / simulation endpoints under /api
app.include_router(router, prefix="/api")

# Serve the vanilla-JS frontend from the frontend/ directory
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/", include_in_schema=False)
def serve_index():
    """Serve the SPA index page at root."""
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
