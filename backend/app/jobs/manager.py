import os
import json
import shutil
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

TEMP_BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "tmp", "jobs"))


class JobManager:
    """Manages temporary job workspace directories and in-memory job state metadata."""

    def __init__(self, base_dir: str = TEMP_BASE_DIR):
        self.base_dir = base_dir
        self._jobs: Dict[str, Dict[str, Any]] = {}

        os.makedirs(self.base_dir, exist_ok=True)

    def create_job(self, source_type: str, source_info: str) -> str:
        # Run periodic cleanup of expired job workspaces
        self.cleanup_expired_jobs()

        job_id = str(uuid.uuid4())
        job_dir = os.path.join(self.base_dir, job_id)
        os.makedirs(job_dir, exist_ok=True)

        job_data = {
            "job_id": job_id,
            "status": "processing",
            "stage": "ingestion",
            "source_type": source_type,
            "source_info": source_info,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "stats": None,
            "error": None,
            "stage_error": None,
            "tests_result": None,
            "refactor_result": None,
            "job_dir": job_dir
        }

        self._jobs[job_id] = job_data
        self._save_job_state(job_data)
        return job_id

    def _save_job_state(self, job_data: Dict[str, Any]) -> None:
        """Saves job state to workspace disk as job_state.json."""
        try:
            job_dir = job_data.get("job_dir")
            if job_dir and os.path.exists(job_dir):
                state_file = os.path.join(job_dir, "job_state.json")
                def _json_default(obj):
                    if hasattr(obj, "model_dump"):
                        return obj.model_dump()
                    if hasattr(obj, "dict"):
                        return obj.dict()
                    return str(obj)

                with open(state_file, "w", encoding="utf-8") as f:
                    json.dump(job_data, f, indent=2, default=_json_default)
        except Exception:
            pass

    def cleanup_expired_jobs(self, max_age_seconds: int = 3600) -> int:
        """Deletes job workspaces older than max_age_seconds (default 1 hour)."""
        now = datetime.now(timezone.utc)
        expired_ids = []
        for jid, job in list(self._jobs.items()):
            try:
                updated_at = datetime.fromisoformat(job["updated_at"])
                if (now - updated_at).total_seconds() > max_age_seconds:
                    expired_ids.append(jid)
            except Exception:
                pass

        cleaned_count = 0
        for jid in expired_ids:
            if self.delete_job(jid):
                cleaned_count += 1
        return cleaned_count

    def get_job_dir(self, job_id: str) -> str:
        job_dir = os.path.join(self.base_dir, job_id)
        os.makedirs(job_dir, exist_ok=True)
        return job_dir

    def update_job(
        self,
        job_id: str,
        status: str,
        stage: str,
        stats: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        stage_error: Optional[str] = None,
        tests_result: Optional[Dict[str, Any]] = None,
        refactor_result: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        job = self.get_job(job_id)
        if not job:
            return None

        job["status"] = status
        job["stage"] = stage
        job["updated_at"] = datetime.now(timezone.utc).isoformat()

        if stats is not None:
            job["stats"] = stats
        if error is not None:
            job["error"] = error
        if stage_error is not None:
            job["stage_error"] = stage_error
        if tests_result is not None:
            job["tests_result"] = tests_result
        if refactor_result is not None:
            job["refactor_result"] = refactor_result

        self._jobs[job_id] = job
        self._save_job_state(job)
        return job

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        if job_id not in self._jobs:
            job_dir = os.path.join(self.base_dir, job_id)
            state_file = os.path.join(job_dir, "job_state.json")
            if os.path.exists(state_file):
                try:
                    with open(state_file, "r", encoding="utf-8") as f:
                        job_data = json.load(f)
                        self._jobs[job_id] = job_data
                except Exception:
                    pass
        return self._jobs.get(job_id)

    def delete_job(self, job_id: str) -> bool:
        job = self.get_job(job_id)
        if job or job_id in self._jobs:
            job_dir = (job or {}).get("job_dir") or os.path.join(self.base_dir, job_id)
            if os.path.exists(job_dir):
                try:
                    shutil.rmtree(job_dir, ignore_errors=True)
                except Exception:
                    pass
            self._jobs.pop(job_id, None)
            return True
        return False


job_manager = JobManager()
