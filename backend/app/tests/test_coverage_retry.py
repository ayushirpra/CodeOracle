"""
Unit tests for Phase 6 coverage analysis and bounded retry generator refinement loop.
"""
import pytest
from unittest.mock import MagicMock, patch
from app.analyzers.base.schema import (
    ProjectAnalysis, FileAnalysis, FunctionSymbol, ParameterSymbol
)
from app.ai.test_schema import (
    JobTestResults, GeneratedTestFile, TestExecutionResult, TestCoverageSummary
)
from app.ai.test_generator import TestGenerator, build_targeted_coverage_prompt


def test_build_targeted_coverage_prompt():
    fa = FileAnalysis(
        path="services/calculator.py",
        language="python",
        total_lines=50,
        functions=[FunctionSymbol(name="multiply", start_line=10, end_line=15, parameters=[])]
    )
    prompt = build_targeted_coverage_prompt(fa, [12, 13, 14], "def test_add(): assert True")
    assert "services/calculator.py" in prompt
    assert "12, 13, 14" in prompt
    assert "def test_add()" in prompt


def test_refine_tests_no_retry_needed_when_target_met():
    mock_provider = MagicMock()
    generator = TestGenerator(provider=mock_provider)

    project = ProjectAnalysis(
        root_dir="/tmp/project",
        total_files=1,
        total_lines=30,
        languages=["python"],
        files=[FileAnalysis(path="math.py", language="python", total_lines=30)]
    )

    initial_job_tests = JobTestResults(
        generated_files=[GeneratedTestFile(file_path="tests/test_math.py", target_file="math.py", code="def test_a(): pass", language="python")],
        execution=TestExecutionResult(
            status="passed",
            total_tests=1,
            passed_tests=1,
            coverage=TestCoverageSummary(covered_lines=20, total_lines=25, coverage_percent=80.0, uncovered_lines_by_file={"math.py": [21, 22]})
        )
    )

    refined = generator.refine_tests_for_coverage(
        project=project,
        job_dir="/tmp/project",
        job_tests=initial_job_tests,
        target_percent=60.0,
        max_retries=2
    )

    assert refined.retry_count == 0
    assert refined.target_reached is True
    assert refined.coverage_history == [80.0]
    assert mock_provider.generate.call_count == 0


def test_refine_tests_bounded_retry_loop_elevates_coverage():
    mock_provider = MagicMock()
    mock_provider.generate.return_value = "```python\ndef test_retry_math():\n    assert math_func(5) == 25\n```"

    generator = TestGenerator(provider=mock_provider)

    project = ProjectAnalysis(
        root_dir="/tmp/project",
        total_files=1,
        total_lines=30,
        languages=["python"],
        files=[FileAnalysis(path="math.py", language="python", total_lines=30)]
    )

    initial_job_tests = JobTestResults(
        generated_files=[GeneratedTestFile(file_path="tests/test_math.py", target_file="math.py", code="def test_a(): pass", language="python")],
        execution=TestExecutionResult(
            status="passed",
            total_tests=1,
            passed_tests=1,
            coverage=TestCoverageSummary(covered_lines=10, total_lines=25, coverage_percent=40.0, uncovered_lines_by_file={"math.py": [15, 16, 17]})
        )
    )

    mock_runner = MagicMock()
    # On first retry, coverage jumps to 75.0%
    mock_runner.run_tests.return_value = TestExecutionResult(
        status="passed",
        total_tests=2,
        passed_tests=2,
        coverage=TestCoverageSummary(covered_lines=19, total_lines=25, coverage_percent=75.0, uncovered_lines_by_file={})
    )

    with patch("os.makedirs"), patch("builtins.open", MagicMock()):
        refined = generator.refine_tests_for_coverage(
            project=project,
            job_dir="/tmp/project",
            job_tests=initial_job_tests,
            runner_instance=mock_runner,
            target_percent=60.0,
            max_retries=2
        )

    assert refined.retry_count == 1
    assert refined.target_reached is True
    assert refined.coverage_history == [40.0, 75.0]
    assert mock_provider.generate.call_count == 1


def test_refine_tests_bounded_retry_max_limit_enforced():
    mock_provider = MagicMock()
    mock_provider.generate.return_value = "```python\ndef test_retry(): pass\n```"

    generator = TestGenerator(provider=mock_provider)

    project = ProjectAnalysis(
        root_dir="/tmp/project",
        total_files=1,
        total_lines=100,
        languages=["python"],
        files=[FileAnalysis(path="complex.py", language="python", total_lines=100)]
    )

    initial_job_tests = JobTestResults(
        generated_files=[GeneratedTestFile(file_path="tests/test_complex.py", target_file="complex.py", code="def test_a(): pass", language="python")],
        execution=TestExecutionResult(
            status="passed",
            total_tests=1,
            passed_tests=1,
            coverage=TestCoverageSummary(covered_lines=20, total_lines=100, coverage_percent=20.0, uncovered_lines_by_file={"complex.py": [30, 31, 32]})
        )
    )

    mock_runner = MagicMock()
    # Retries stay at 30% and 40% (below 60%)
    mock_runner.run_tests.side_effect = [
        TestExecutionResult(
            status="passed",
            total_tests=2,
            passed_tests=2,
            coverage=TestCoverageSummary(covered_lines=30, total_lines=100, coverage_percent=30.0, uncovered_lines_by_file={"complex.py": [31, 32]})
        ),
        TestExecutionResult(
            status="passed",
            total_tests=3,
            passed_tests=3,
            coverage=TestCoverageSummary(covered_lines=40, total_lines=100, coverage_percent=40.0, uncovered_lines_by_file={"complex.py": [32]})
        )
    ]

    with patch("os.makedirs"), patch("builtins.open", MagicMock()):
        refined = generator.refine_tests_for_coverage(
            project=project,
            job_dir="/tmp/project",
            job_tests=initial_job_tests,
            runner_instance=mock_runner,
            target_percent=60.0,
            max_retries=2
        )

    # Must stop at max 2 retries
    assert refined.retry_count == 2
    assert refined.target_reached is False
    assert refined.coverage_history == [20.0, 30.0, 40.0]
    assert mock_runner.run_tests.call_count == 2
