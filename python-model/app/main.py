"""
FastAPI entry point for the XGBoost NBA Prediction microservice.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.api.routes import health, predictions, features
from app.models.model_loader import load_model

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for startup/shutdown events."""
    # Startup: Load the XGBoost model
    print(f"Loading XGBoost model from {settings.model_path}...")
    try:
        app.state.model = load_model(settings.model_path)
        print("Model loaded successfully!")
    except FileNotFoundError:
        print(f"Warning: Model file not found at {settings.model_path}")
        print("Service will start but predictions will fail until model is trained.")
        app.state.model = None
    except Exception as e:
        print(f"Warning: Failed to load model: {e}")
        app.state.model = None

    yield

    # Shutdown: Cleanup if needed
    print("Shutting down XGBoost service...")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="XGBoost-based NBA game prediction microservice",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(predictions.router, prefix="/predict", tags=["Predictions"])
app.include_router(features.router, prefix="/features", tags=["Features"])


@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
