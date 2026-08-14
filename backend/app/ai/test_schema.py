"""
Test Generation and Execution Schemas.
Normalized models for generated test files, test execution metrics, and line coverage reports.
"""
from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class GeneratedTestFile(BaseModel):
    """Represents a generated test file."""
    file_path: str                 # Relative path in job directory, e.g., 'tests/test_math.py'
    target_file: str               # Target source file, e.g., 'math_utils.py'
    code: str                      # Test code string
    language: str                  # 'python' | 'javascript'


class TestCaseResult(BaseModel):
    """Result of an individual test case execution."""
    __test__ = False
    name: str                      # Name of the test case, e.g. 'test_add_positive_numbers'
    status: str                    # 'passed' | 'failed' | 'error' | 'skipped'
    duration_seconds: float = 0.0
    message: Optional[str] = None  # Traceback or assertion error message if failed/error


class TestCoverageSummary(BaseModel):
    """Line coverage summary extracted from coverage reports (e.g. coverage.json)."""
    __test__ = False
    covered_lines: int = 0
    total_lines: int = 0
    coverage_percent: float = 0.0
    uncovered_lines_by_file: Dict[str, List[int]] = Field(default_factory=dict)


class TestExecutionResult(BaseModel):
    """Combined output of running the test suite in Docker."""
    __test__ = False
    status: str                    # 'passed' | 'failed' | 'error'
    total_tests: int = 0
    passed_tests: int = 0
    failed_tests: int = 0
    error_tests: int = 0
    duration_seconds: float = 0.0
    test_cases: List[TestCaseResult] = Field(default_factory=list)
    coverage: Optional[TestCoverageSummary] = None
    stdout: str = ""
    stderr: str = ""
    error: Optional[str] = None    # Error message if sandbox/execution engine failed


class JobTestResults(BaseModel):
    """Complete test suite package for a job."""
    __test__ = False
    generated_files: List[GeneratedTestFile] = Field(default_factory=list)
    execution: Optional[TestExecutionResult] = None
    retry_count: int = 0
    target_reached: bool = False
    coverage_history: List[float] = Field(default_factory=list)
    error: Optional[str] = None
