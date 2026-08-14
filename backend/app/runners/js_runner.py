"""
JavaScript runner helpers — formats Node / Vitest / Jest execution commands and parses stdout & coverage.
"""
import re
from typing import Dict, Any, List, Tuple
from app.ai.test_schema import TestCaseResult, TestCoverageSummary


def get_js_cmd() -> str:
    """Returns command to execute JS tests inside sandbox."""
    return "npx vitest run --coverage --reporter=verbose || npx jest --coverage --verbose || node --test"


def parse_js_test_output(stdout: str, stderr: str) -> Tuple[List[TestCaseResult], int, int, int]:
    """Parses standard JS test runner output (Vitest / Jest / Node test)."""
    test_cases: List[TestCaseResult] = []
    passed_count = 0
    failed_count = 0
    error_count = 0

    pattern = r"(✓|✕|PASS|FAIL)\s+([^\n]+)"
    for match in re.finditer(pattern, stdout):
        symbol, name = match.groups()
        status = "passed" if symbol in ("✓", "PASS") else "failed"
        if status == "passed":
            passed_count += 1
        else:
            failed_count += 1

        test_cases.append(TestCaseResult(
            name=name.strip(),
            status=status,
            duration_seconds=0.01,
            message=None if status == "passed" else f"Test failed: {name.strip()}"
        ))

    return test_cases, passed_count, failed_count, error_count
