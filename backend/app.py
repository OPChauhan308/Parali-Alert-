"""
Parali Alert - AI-Powered Pre-Fire Intervention Intelligence Platform.
FastAPI Application Entrypoint.
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pathlib import Path
import logging
import uvicorn

from contextlib import asynccontextmanager
import asyncio
from config.settings import settings
from backend.api.routes import router as api_router, _evaluate_all_units

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Background worker pipeline precomputing evaluations so API endpoints respond in < 5ms (Optimization A2).
    """
    async def _precompute_loop():
        await asyncio.sleep(0.5)
        while True:
            try:
                await _evaluate_all_units(horizon_hours=48)
                await _evaluate_all_units(horizon_hours=24)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Background evaluation worker exception: {e}")
            await asyncio.sleep(max(10, settings.EVALUATION_CACHE_TTL_SECONDS - 5))

    worker_task = asyncio.create_task(_precompute_loop())
    yield
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Geospatial pre-fire intelligence system prioritizing stubble burning intervention in Punjab, India.",
    lifespan=lifespan
)

# CORS Middleware with explicit allowed origins from settings (I2)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global Exception Handler returning structured JSON (I10)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": True,
            "message": "Internal Server Error",
            "detail": str(exc) if settings.DEBUG else "An unexpected server error occurred.",
            "path": request.url.path,
            "method": request.method
        }
    )


# Include core API routes under /api
app.include_router(api_router)


# API Root Discovery
@app.get("/api")
async def api_root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "tagline": "Pre-Fire Agricultural Intervention Intelligence System",
        "region": "Punjab, India (Pilot Districts: Sangrur, Ludhiana, Bathinda, Tarn Taran)",
        "api_docs": "/docs",
        "health": "/api/health",
        "rankings": "/api/risk-rankings?horizon=48"
    }


# Mount frontend production dist if built, otherwise provide informational root (I3)
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="static")
else:
    @app.get("/")
    async def dev_root():
        return {
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "online",
            "docs": "/docs",
            "api_root": "/api",
            "frontend_note": "Frontend Vite dev server runs at http://localhost:5173"
        }


if __name__ == "__main__":
    uvicorn.run(
        "backend.app:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
