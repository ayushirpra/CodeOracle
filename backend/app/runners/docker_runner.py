"""
Docker Runner — executes test suites inside isolated Docker sandbox containers.
Enforces strict security constraints: network disabled (--network none), resource limits, timeout, and cleanup.
"""
import os
import sys
import json
import shutil
import subprocess
from typing import Optional
from app.runners.base import BaseRunner
from app.runners.python_runner import get_python_cmd, parse_pytest_output, parse_coverage_json
from app.runners.js_runner import get_js_cmd, parse_js_test_output
from app.ai.test_schema import TestExecutionResult, TestCoverageSummary


class DockerRunner(BaseRunner):
    """
    Executes generated test suites inside an isolated ephemeral Docker container.
    """

    PYTHON_IMAGE = "python:3.11-slim"
    NODE_IMAGE = "node:20-slim"
    DEFAULT_TIMEOUT_SECS = 30

    def is_docker_available(self) -> bool:
        """Checks if Docker CLI and daemon are accessible."""
        try:
            res = subprocess.run(
                ["docker", "info"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=5
            )
            return res.returncode == 0
        except Exception:
            return False

    def run_tests(
        self,
        job_dir: str,
        language: str = "python",
        timeout: int = DEFAULT_TIMEOUT_SECS
    ) -> TestExecutionResult:
        """
        Runs test suite in isolated Docker container.
        Fails safely if Docker is unavailable.
        """
        if not os.path.exists(job_dir):
            return TestExecutionResult(
                status="error",
                error=f"Job directory '{job_dir}' does not exist."
            )

        if not self.is_docker_available():
            return TestExecutionResult(
                status="error",
                error="Docker isolation environment unavailable. Ensure Docker daemon is running."
            )

        abs_job_dir = os.path.abspath(job_dir)
        container_name = f"codeoracle_sandbox_{os.path.basename(job_dir)}"

        if language == "python":
            image = self.PYTHON_IMAGE
            # Inline shell script ensuring pytest and coverage are available and running tests
            inner_script = (
                "pip install --quiet pytest coverage && "
                "python -m coverage run -m pytest --tb=short -v && "
                "python -m coverage json -o coverage.json"
            )
        elif language in ("javascript", "typescript"):
            image = self.NODE_IMAGE
            inner_script = get_js_cmd()
        else:
            return TestExecutionResult(
                status="error",
                error=f"Unsupported language for Docker test execution: '{language}'."
            )

        docker_cmd = [
            "docker", "run",
            "--rm",
            "--name", container_name,
            "--network", "none",
            "--memory", "512m",
            "--cpus", "1.0",
            "-v", f"{abs_job_dir}:/workspace",
            "-w", "/workspace",
            image,
            "sh", "-c", inner_script
        ]

        try:
            proc = subprocess.run(
                docker_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=timeout
            )
            stdout = proc.stdout or ""
            stderr = proc.stderr or ""
            exit_code = proc.returncode

            # Read coverage.json if generated
            cov_summary: Optional[TestCoverageSummary] = None
            cov_file = os.path.join(abs_job_dir, "coverage.json")

            if os.path.exists(cov_file):
                try:
                    with open(cov_file, "r", encoding="utf-8") as f:
                        cov_data = json.load(f)
                    cov_summary = parse_coverage_json(cov_data)
                except Exception as exc:
                    stderr += f"\nFailed to parse coverage.json: {str(exc)}"

            # Parse test cases & status
            if language == "python":
                test_cases, passed_cnt, failed_cnt, err_cnt = parse_pytest_output(stdout, stderr)
            else:
                test_cases, passed_cnt, failed_cnt, err_cnt = parse_js_test_output(stdout, stderr)

            total_tests = len(test_cases) or (passed_cnt + failed_cnt + err_cnt)
            exec_status = "passed" if (exit_code == 0 and failed_cnt == 0 and err_cnt == 0) else "failed"

            return TestExecutionResult(
                status=exec_status,
                total_tests=total_tests,
                passed_tests=passed_cnt,
                failed_tests=failed_cnt,
                error_tests=err_cnt,
                duration_seconds=float(timeout - 5), # estimated execution duration
                test_cases=test_cases,
                coverage=cov_summary,
                stdout=stdout,
                stderr=stderr
            )

        except subprocess.TimeoutExpired:
            # Force kill lingering container if timeout expired
            subprocess.run(["docker", "kill", container_name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return TestExecutionResult(
                status="error",
                error=f"Test execution timed out after {timeout} seconds.",
                stdout="",
                stderr="Container timed out."
            )
        except Exception as exc:
            return TestExecutionResult(
                status="error",
                error=f"Docker sandbox execution failed: {str(exc)}"
            )


docker_runner = DockerRunner()
