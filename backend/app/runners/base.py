"""
Base runner interface for test execution engines.
"""
from abc import ABC, abstractmethod
from app.ai.test_schema import TestExecutionResult


class BaseRunner(ABC):
    """Abstract contract for test execution runners (Docker sandbox, mock, etc.)."""

    @abstractmethod
    def run_tests(self, job_dir: str, language: str = "python", timeout: int = 30) -> TestExecutionResult:
        """
        Executes test suite located in job_dir and returns structured execution & coverage results.
        """
        pass
