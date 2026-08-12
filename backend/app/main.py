import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.core.config import settings
from app.api.health import router as health_router
from app.api.projects import router as projects_router
from app.api.jobs import router as jobs_router
from app.api.explain import router as explain_router

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered developer tool for legacy code analysis, test generation, and refactoring.",
    version="0.1.0",
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes under /api
app.include_router(health_router, prefix=settings.API_V1_STR)
app.include_router(projects_router, prefix=settings.API_V1_STR)
app.include_router(jobs_router, prefix=settings.API_V1_STR)
app.include_router(explain_router, prefix=settings.API_V1_STR)

# Root fallbacks
app.include_router(health_router, prefix="")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
