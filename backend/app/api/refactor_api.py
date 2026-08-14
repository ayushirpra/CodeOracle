"""
Refactor API — Phase 7.
Exposes GET /api/jobs/{job_id}/refactor to return Gemini-powered refactoring proposals
with unified code diffs and AST-based breaking change warnings.
"""
from fastapi import APIRouter, HTTPException, status
from app.jobs.manager import job_manager
from app.analyzers.base.schema import ProjectAnalysis
from app.refactor.engine import refactor_engine
from app.refactor.schema import ProjectRefactorProposal
from app.ai.provider import (
    AIKeyMissingError, AIQuotaError, AITimeoutError, AIServiceError, AIResponseError
)

router = APIRouter(prefix="/jobs", tags=["Refactor"])


@router.get("/{job_id}/refactor", response_model=ProjectRefactorProposal)
async def get_or_generate_refactor(job_id: str):
    """
    Generates Gemini-powered refactoring proposals for each analysed source file.
    Returns unified diffs (Original | Proposed) and severity-categorised breaking change warnings.
    Results are cached per job — subsequent calls return the cached result.
    """
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found."
        )

    if job.get("status") != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job '{job_id}' is not yet completed (status: {job.get('status')})."
        )

    # Return cached result if available
    cached_refactor = job.get("refactor_result")
    if cached_refactor:
        return ProjectRefactorProposal.model_validate(cached_refactor)

    stats = job.get("stats")
    if not stats:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job '{job_id}' has no analysis data."
        )

    try:
        project_analysis = ProjectAnalysis.model_validate(stats)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load project analysis schema: {str(exc)}"
        )

    job_dir = job.get("job_dir") or job_manager.get_job_dir(job_id)

    try:
        proposal = refactor_engine.refactor_project(project_analysis, job_dir)
    except AIKeyMissingError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "configuration", "message": exc.message}
        )
    except AIQuotaError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "quota", "message": exc.message}
        )
    except AITimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={"error": "timeout", "message": exc.message}
        )
    except (AIServiceError, AIResponseError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": "ai_service", "message": exc.message}
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal", "message": str(exc)}
        )

    # Cache to job state
    job_manager.update_job(
        job_id=job_id,
        status="completed",
        stage="refactor",
        refactor_result=proposal.model_dump()
    )

    return proposal
