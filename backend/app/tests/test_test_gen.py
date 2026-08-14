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
