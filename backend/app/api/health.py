from datetime import datetime, timezone
from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()


@router.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint for Phase 0 verification and deployment monitoring.
    """
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "environment": settings.ENV,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "phase": 0
    }
