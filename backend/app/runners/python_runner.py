"""
Python runner helpers — formats pytest execution commands and parses pytest stdout & coverage.json.
"""
import re
import json
import os
from typing import Dict, Any, List, Tuple
from app.ai.test_schema import TestCaseResult, TestCoverageSummary


def get_python_cmd() -> str:
    """Returns command to execute pytest with coverage inside sandbox."""
    return "python -m coverage run -m pytest --tb=short -v && python -m coverage json -o coverage.json"


def parse_pytest_output(stdout: str, stderr: str) -> Tuple[List[TestCaseResult], int, int, int]:
    """
    Parses verbose pytest terminal output to extract individual test case results and counts.
    Returns: (test_cases, passed_count, failed_count, error_count)
    """
    test_cases: List[TestCaseResult] = []
    passed_count = 0
    failed_count = 0
    error_count = 0

    # Pattern matching lines like:
    # tests/test_math.py::test_add PASSED [ 50%]
    # tests/test_math.py::test_divide_zero FAILED [100%]
    # test_math.py::test_foo ERROR
    pattern = r"([^\s]+::[^\s]+)\s+(PASSED|FAILED|ERROR|SKIPPED)"

    for match in re.finditer(pattern, stdout):
        full_name, status_str = match.groups()
        test_name = full_name.split("::")[-1]
        status = status_str.lower()

        if status == "passed":
            passed_count += 1
        elif status == "failed":
            failed_count += 1
        elif status == "error":
            error_count += 1

        test_cases.append(TestCaseResult(
            name=test_name,
            status=status,
            duration_seconds=0.01,
            message=None if status == "passed" else f"Test {status_str}: {full_name}"
        ))

    # If regex missed summary lines, check summary text (e.g. "2 passed, 1 failed in 0.05s")
    if not test_cases:
        summary_match = re.search(r"(\d+)\s+passed", stdout)
        if summary_match:
            passed_count = int(summary_match.group(1))
        failed_match = re.search(r"(\d+)\s+failed", stdout)
        if failed_match:
            failed_count = int(failed_match.group(1))
        err_match = re.search(r"(\d+)\s+error", stdout)
        if err_match:
            error_count = int(err_match.group(1))

    return test_cases, passed_count, failed_count, error_count


def parse_coverage_json(data: Dict[str, Any]) -> TestCoverageSummary:
    """
    Parses Python coverage.json dictionary into a normalized TestCoverageSummary.
    """
    totals = data.get("totals", {})
    covered_lines = totals.get("covered_lines", 0)
    num_statements = totals.get("num_statements", 0) or totals.get("total_lines", 0)
    percent = totals.get("percent_covered", 0.0)

    # Fallback calculation if num_statements > 0
    if percent == 0.0 and num_statements > 0:
        percent = (covered_lines / num_statements) * 100.0

    files_data = data.get("files", {})
    uncovered_map: Dict[str, List[int]] = {}

    for filepath, finfo in files_data.items():
        missing = finfo.get("missing_lines", [])
        # Skip test files in coverage report
        if "test_" not in filepath.lower():
            uncovered_map[filepath] = missing

    return TestCoverageSummary(
        covered_lines=covered_lines,
        total_lines=num_statements,
        coverage_percent=round(percent, 2),
        uncovered_lines_by_file=uncovered_map
    )
