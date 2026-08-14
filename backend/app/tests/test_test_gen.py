"""
Unit tests for test generator (TestGenerator, prompts, and output parsing).
"""
import pytest
from unittest.mock import MagicMock
from app.analyzers.base.schema import (
    ProjectAnalysis, FileAnalysis, FunctionSymbol, ClassSymbol, ParameterSymbol
)
from app.ai.test_generator import (
    build_python_test_prompt, build_javascript_test_prompt,
    extract_code_block, TestGenerator
)
from app.ai.provider import AIQuotaError


def test_build_python_test_prompt():
    fa = FileAnalysis(
        path="math_utils.py",
        language="python",
        total_lines=25,
        functions=[
            FunctionSymbol(
                name="add",
                start_line=1,
                end_line=5,
                parameters=[ParameterSymbol(name="a"), ParameterSymbol(name="b")],
                return_type="int"
            )
        ],
        classes=[]
    )
    prompt = build_python_test_prompt(fa)
    assert "math_utils.py" in prompt
    assert "Function add" in prompt
    assert "pytest" in prompt


def test_build_javascript_test_prompt():
    fa = FileAnalysis(
        path="utils.js",
        language="javascript",
        total_lines=15,
        functions=[
            FunctionSymbol(
                name="formatDate",
                start_line=1,
                end_line=10,
                parameters=[ParameterSymbol(name="d")]
            )
        ]
    )
    prompt = build_javascript_test_prompt(fa)
    assert "utils.js" in prompt
    assert "Function formatDate" in prompt
    assert "Jest/Vitest" in prompt


def test_extract_code_block_markdown():
    raw_response = "Here is your test suite:\n```python\ndef test_add():\n    assert 1 + 1 == 2\n```\nHope this helps!"
    code = extract_code_block(raw_response)
    assert code == "def test_add():\n    assert 1 + 1 == 2"


def test_extract_code_block_raw():
    raw_response = "def test_add():\n    assert 1 + 1 == 2"
    code = extract_code_block(raw_response)
    assert code == "def test_add():\n    assert 1 + 1 == 2"


def test_test_generator_mocked_provider():
    mock_provider = MagicMock()
    mock_provider.generate.return_value = "```python\ndef test_multiply():\n    assert multiply(2, 3) == 6\n```"

    generator = TestGenerator(provider=mock_provider)
    project = ProjectAnalysis(
        root_dir="/tmp/calc",
        total_files=1,
        total_lines=10,
        languages=["python"],
        files=[
            FileAnalysis(
                path="calculator.py",
                language="python",
                total_lines=10,
                functions=[FunctionSymbol(name="multiply", start_line=1, end_line=5, parameters=[])]
            )
        ]
    )

    results = generator.generate_tests_for_project(project)
    assert len(results.generated_files) == 1
    gen_file = results.generated_files[0]
    assert gen_file.target_file == "calculator.py"
    assert "def test_multiply():" in gen_file.code
    assert results.error is None


def test_gemini_generates_test_files():
    mock_provider = MagicMock()
    mock_provider.generate.return_value = "```python\ndef test_add():\n    assert add(1, 2) == 3\n```"
    generator = TestGenerator(provider=mock_provider)
    project = ProjectAnalysis(
        root_dir="/workspace",
        total_files=1,
        total_lines=5,
        languages=["python"],
        files=[
            FileAnalysis(
                path="math.py",
                language="python",
                total_lines=5,
                functions=[FunctionSymbol(name="add", start_line=1, end_line=5, parameters=[])]
            )
        ]
    )

    results = generator.generate_tests_for_project(project)
    assert len(results.generated_files) == 1
    assert results.generated_files[0].file_path == "tests/test_math.py"
    assert "def test_add()" in results.generated_files[0].code


def test_docker_unavailable_returns_generated_test_content_safely(tmp_path):
    from unittest.mock import patch
    from app.runners.docker_runner import docker_runner
    from app.ai.test_schema import JobTestResults, GeneratedTestFile

    job_dir = str(tmp_path)
    with patch.object(docker_runner, 'is_docker_available', return_value=False):
        exec_res = docker_runner.run_tests(job_dir=job_dir, language="python")
        assert exec_res.status == "error"
        assert "Docker isolation environment unavailable" in exec_res.error

        # Ensure generated files are preserved even when Docker execution is offline
        test_results = JobTestResults(
            generated_files=[
                GeneratedTestFile(
                    file_path="test_math.py",
                    target_file="math.py",
                    code="def test_add(): assert True\n",
                    language="python"
                )
            ],
            execution=exec_res
        )
        assert len(test_results.generated_files) == 1
        assert "def test_add()" in test_results.generated_files[0].code
        assert test_results.execution.error is not None


def test_docker_available_executes_tests_normally():
    from unittest.mock import patch
    from app.runners.docker_runner import docker_runner
    from app.ai.test_schema import TestExecutionResult

    mock_exec = TestExecutionResult(
        status="passed",
        total_tests=1,
        passed_tests=1,
        failed_tests=0,
        error_tests=0,
        duration_seconds=0.5,
        test_cases=[]
    )

    with patch.object(docker_runner, 'is_docker_available', return_value=True):
        with patch.object(docker_runner, 'run_tests', return_value=mock_exec):
            res = docker_runner.run_tests("/tmp/job", "python")
            assert res.status == "passed"
            assert res.passed_tests == 1


def test_no_host_execution_ever_occurs_when_docker_offline(tmp_path):
    from unittest.mock import patch
    import subprocess
    from app.runners.docker_runner import docker_runner

    with patch.object(docker_runner, 'is_docker_available', return_value=False):
        with patch.object(subprocess, 'run') as mock_sub_run:
            exec_res = docker_runner.run_tests(job_dir=str(tmp_path), language="python")
            assert exec_res.status == "error"
            # Ensure subprocess.run was NEVER called to execute pytest/user code on host
            mock_sub_run.assert_not_called()

