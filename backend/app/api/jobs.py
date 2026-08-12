from fastapi import APIRouter, HTTPException, status
from app.jobs.manager import job_manager

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.get("/{job_id}")
async def get_job_status(job_id: str):
    """
    Returns state, stage, statistics, and any stage errors for a given job.
    """
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found."
        )

    # Exclude internal filesystem paths from client response
    client_response = {k: v for k, v in job.items() if k != "job_dir"}
    return client_response


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    """
    Cancels job and cleans up temporary workspace files.
    """
    deleted = job_manager.delete_job(job_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found."
        )

    return {"message": f"Job '{job_id}' and associated temporary files deleted successfully."}
