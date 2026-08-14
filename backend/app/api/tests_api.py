"""
API endpoint for Test Suite Generation & Execution (Phase 5).
Exposes GET /api/jobs/{job_id}/tests.
"""
import os
from fastapi import APIRouter, HTTPException, status
from app.jobs.manager import job_manager
from app.analyzers.base.schema import ProjectAnalysis
from app.ai.test_generator import test_generator
from app.ai.test_schema import JobTestResults, TestExecutionResult
from app.runners.docker_runner import docker_runner
from app.ai.provider import (
    AIKeyMissingError, AIQuotaError, AITimeoutError, AIServiceError, AIResponseError
)

router = APIRouter(prefix="/jobs", tags=["Tests"])


@router.get("/{job_id}/tests", response_model=JobTestResults)
async def get_or_generate_job_tests(job_id: str):
    """
    Generates runnable unit tests, writes them to the temporary workspace,
    executes them inside an isolated Docker sandbox container, and returns test results + coverage.
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
            detail=f"Job '{job_id}' is not completed yet (status: {job.get('status')})."
        )

    # Return cached test result if available
    cached_tests = job.get("tests_result")
    if cached_tests:
        return JobTestResults.model_validate(cached_tests)

    stats = job.get("stats")
    if not stats:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job '{job_id}' has no analysis stats."
        )

    try:
        project_analysis = ProjectAnalysis.model_validate(stats)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load project analysis schema: {str(exc)}"
        )

    # Step 1: Generate unit test files using Gemini
    try:
        test_results = test_generator.generate_tests_for_project(project_analysis)
    except AIKeyMissingError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=exc.message
        )
    except AIQuotaError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=exc.message
        )
    except AITimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=exc.message
        )
    except (AIServiceError, AIResponseError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=exc.message
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Test generation failed: {str(exc)}"
        )

    job_dir = job.get("job_dir") or job_manager.get_job_dir(job_id)

    # Step 2: Save generated test files to job directory
    for gen_file in test_results.generated_files:
        full_test_path = os.path.join(job_dir, gen_file.file_path)
        os.makedirs(os.path.dirname(full_test_path), exist_ok=True)
        try:
            with open(full_test_path, "w", encoding="utf-8") as f:
                f.write(gen_file.code)
        except Exception as exc:
            test_results.error = f"Failed to write test file {gen_file.file_path}: {str(exc)}"

    # Step 3: Execute tests in Docker container
    primary_lang = project_analysis.primary_language or "python"
    exec_result = docker_runner.run_tests(job_dir=job_dir, language=primary_lang)
    test_results.execution = exec_result

    if exec_result.coverage:
        test_results.coverage_history = [exec_result.coverage.coverage_percent]
        test_results.target_reached = exec_result.coverage.coverage_percent >= 60.0

    # Step 4: Bounded retries if line coverage < 60%
    if exec_result.coverage and exec_result.coverage.coverage_percent < 60.0:
        test_results = test_generator.refine_tests_for_coverage(
            project=project_analysis,
            job_dir=job_dir,
            job_tests=test_results,
            primary_lang=primary_lang,
            target_percent=60.0,
            max_retries=2
        )

    # Save to job state
    job_manager.update_job(
        job_id=job_id,
        status="completed",
        stage="tests",
        tests_result=test_results.model_dump()
    )

    return test_results


@router.post("/{job_id}/retry-tests", response_model=JobTestResults)
async def retry_job_tests(job_id: str):
    """
    Triggers an explicit targeted retry iteration to elevate line coverage toward >60%.
    Appends targeted tests for uncovered lines and re-runs in Docker sandbox.
    """
    job = job_manager.get_job(job_id)
    if not job or job.get("status") != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job must be completed before retrying tests."
        )

    stats = job.get("stats")
    cached_tests = job.get("tests_result")
    if not stats or not cached_tests:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job statistics or test results not found."
        )

    project_analysis = ProjectAnalysis.model_validate(stats)
    test_results = JobTestResults.model_validate(cached_tests)
    job_dir = job.get("job_dir") or job_manager.get_job_dir(job_id)
    primary_lang = project_analysis.primary_language or "python"

    refined_results = test_generator.refine_tests_for_coverage(
        project=project_analysis,
        job_dir=job_dir,
        job_tests=test_results,
        primary_lang=primary_lang,
        target_percent=60.0,
        max_retries=2
    )

    job_manager.update_job(
        job_id=job_id,
        status="completed",
        stage="tests",
        tests_result=refined_results.model_dump()
    )

    return refined_results
