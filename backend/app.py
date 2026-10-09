"""
Parali Alert - AI-Powered Pre-Fire Intervention Intelligence Platform.
FastAPI Application Entrypoint.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os
import uvicorn
from config.settings import settings
from backend.api.routes import router as api_router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Geospatial pre-fire intelligence system prioritizing stubble burning intervention in Punjab, India."
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include core API routes
app.include_router(api_router)

# Mount frontend production dist if built
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="static")


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "tagline": "Pre-Fire Agricultural Intervention Intelligence System",
        "region": "Punjab, India (Pilot Districts: Sangrur, Ludhiana, Bathinda, Tarn Taran)",
        "api_docs": "/docs",
        "health": "/api/health",
        "rankings": "/api/risk-rankings?horizon=48"
    }


if __name__ == "__main__":
    uvicorn.run(
        "backend.app:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
