"""
Unit tests for Docker Runner, pytest output parsing, and coverage parsing.
"""
import pytest
from unittest.mock import MagicMock, patch
from app.runners.docker_runner import DockerRunner
from app.runners.python_runner import parse_pytest_output, parse_coverage_json


def test_docker_runner_non_existent_dir():
    runner = DockerRunner()
    res = runner.run_tests("/path/does/not/exist/12345")
    assert res.status == "error"
    assert "does not exist" in res.error


def test_docker_runner_docker_unavailable_fallback(tmp_path):
    runner = DockerRunner()
    with patch.object(runner, "is_docker_available", return_value=False):
        res = runner.run_tests(str(tmp_path))
        assert res.status == "error"
        assert "Docker isolation environment unavailable" in res.error


def test_parse_pytest_output_success():
    stdout = """
tests/test_math.py::test_add PASSED [ 50%]
tests/test_math.py::test_subtract PASSED [100%]

= 2 passed in 0.04s =
"""
    test_cases, passed, failed, errors = parse_pytest_output(stdout, "")
    assert passed == 2
    assert failed == 0
    assert len(test_cases) == 2
    assert test_cases[0].name == "test_add"
    assert test_cases[0].status == "passed"


def test_parse_pytest_output_failures():
    stdout = """
tests/test_math.py::test_divide_zero FAILED [100%]

= 1 failed in 0.05s =
"""
    test_cases, passed, failed, errors = parse_pytest_output(stdout, "")
    assert passed == 0
    assert failed == 1
    assert len(test_cases) == 1
    assert test_cases[0].name == "test_divide_zero"
    assert test_cases[0].status == "failed"


def test_parse_coverage_json():
    data = {
        "totals": {
            "covered_lines": 18,
            "num_statements": 20,
            "percent_covered": 90.0
        },
        "files": {
            "math_utils.py": {
                "executed_lines": [1, 2, 3],
                "missing_lines": [4, 5]
            }
        }
    }
    summary = parse_coverage_json(data)
    assert summary.covered_lines == 18
    assert summary.total_lines == 20
    assert summary.coverage_percent == 90.0
    assert summary.uncovered_lines_by_file == {"math_utils.py": [4, 5]}
