"""
Health check endpoints.
"""
from fastapi import APIRouter, Request
from pydantic import BaseModel
from datetime import datetime

from app.config import get_settings

router = APIRouter()
settings = get_settings()


class HealthResponse(BaseModel):
    """Health check response model."""
    status: str
    service: str
    version: str
    model_loaded: bool
    model_version: str | None
    timestamp: datetime


class ReadinessResponse(BaseModel):
    """Readiness check response model."""
    ready: bool
    checks: dict[str, bool]


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request) -> HealthResponse:
    """
    Basic health check endpoint.
    Returns service status and model information.
    """
    model = getattr(request.app.state, "model", None)

    return HealthResponse(
        status="healthy" if model is not None else "degraded",
        service=settings.app_name,
        version=settings.app_version,
        model_loaded=model is not None,
        model_version=settings.model_version if model else None,
        timestamp=datetime.utcnow(),
    )


@router.get("/health/ready", response_model=ReadinessResponse)
async def readiness_check(request: Request) -> ReadinessResponse:
    """
    Readiness check for Kubernetes/load balancers.
    Checks if the service is ready to accept traffic.
    """
    model = getattr(request.app.state, "model", None)

    checks = {
        "model_loaded": model is not None,
        "config_valid": settings is not None,
    }

    return ReadinessResponse(
        ready=all(checks.values()),
        checks=checks,
    )


@router.get("/health/live")
async def liveness_check():
    """
    Liveness check for Kubernetes.
    Simple check that the service is running.
    """
    return {"alive": True}
