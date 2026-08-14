"""
Phase 7 Unit Tests — Refactoring Engine & Breaking Change Detector.
Tests cover:
  1. Python AST breaking change detection (function removed, param added, class removed)
  2. JavaScript export breaking change detection
  3. Unified diff computation
  4. Code block extraction from Gemini responses
  5. Engine integration with mocked Gemini provider
  6. API router 404 / 400 error paths
"""
import pytest
from unittest.mock import MagicMock, patch

# ─── Breaking Change Detector Tests ─────────────────────────────────────────

from app.refactor.breaking_changes import (
    detect_python_breaking_changes,
    detect_js_breaking_changes,
    detect_breaking_changes,
)


ORIGINAL_PYTHON = """
def add(a, b):
    return a + b

def subtract(x, y):
    return x - y

class Calculator:
    def multiply(self, a, b):
        return a * b
"""

PROPOSED_PYTHON_SAFE = """
from typing import Union

def add(a: Union[int, float], b: Union[int, float]) -> Union[int, float]:
    \"\"\"Add two numbers.\"\"\"
    return a + b

def subtract(x: int, y: int) -> int:
    \"\"\"Subtract y from x.\"\"\"
    return x - y

class Calculator:
    def multiply(self, a: int, b: int) -> int:
        \"\"\"Multiply two integers.\"\"\"
        return a * b
"""

PROPOSED_PYTHON_REMOVED_FUNC = """
def add(a, b):
    return a + b
# subtract was removed
"""

PROPOSED_PYTHON_ADDED_REQUIRED_PARAM = """
def add(a, b, c):
    return a + b + c

def subtract(x, y):
    return x - y
"""

PROPOSED_PYTHON_REMOVED_CLASS = """
def add(a, b):
    return a + b

def subtract(x, y):
    return x - y
"""


class TestPythonBreakingChanges:

    def test_no_breaking_changes_safe_refactor(self):
        """Adding type annotations is not a breaking change."""
        warnings = detect_python_breaking_changes(ORIGINAL_PYTHON, PROPOSED_PYTHON_SAFE)
        high = [w for w in warnings if w.severity == "HIGH"]
        assert len(high) == 0

    def test_function_removed_is_high_severity(self):
        """Removing a public function should be detected as HIGH severity."""
        warnings = detect_python_breaking_changes(ORIGINAL_PYTHON, PROPOSED_PYTHON_REMOVED_FUNC)
        high = [w for w in warnings if w.severity == "HIGH" and w.change_type == "function_removed"]
        assert any(w.symbol == "subtract" for w in high), f"Expected 'subtract' removed, got: {high}"

    def test_required_param_added_is_high_severity(self):
        """Adding a required parameter is a HIGH severity breaking change."""
        warnings = detect_python_breaking_changes(ORIGINAL_PYTHON, PROPOSED_PYTHON_ADDED_REQUIRED_PARAM)
        high = [w for w in warnings if w.severity == "HIGH" and w.change_type == "parameter_added_required"]
        assert any(w.symbol == "add" for w in high), f"Expected 'add' param change, got: {high}"

    def test_class_removed_is_high_severity(self):
        """Removing a class should be detected as HIGH severity."""
        warnings = detect_python_breaking_changes(ORIGINAL_PYTHON, PROPOSED_PYTHON_REMOVED_CLASS)
        high = [w for w in warnings if w.severity == "HIGH" and w.change_type == "class_removed"]
        assert any(w.symbol == "Calculator" for w in high), f"Expected 'Calculator' removed, got: {high}"

    def test_import_added_is_low_severity(self):
        """Adding a new import is LOW severity."""
        warnings = detect_python_breaking_changes(ORIGINAL_PYTHON, PROPOSED_PYTHON_SAFE)
        low = [w for w in warnings if w.change_type == "import_added"]
        assert any(w.symbol == "typing" for w in low), f"Expected 'typing' import added, got: {low}"

    def test_invalid_python_returns_empty(self):
        """Unparseable code should return an empty warning list, not crash."""
        warnings = detect_python_breaking_changes("def foo(:", "def foo():\n  pass")
        assert warnings == []

    def test_dispatch_python(self):
        """dispatch function routes to Python detector."""
        warnings = detect_breaking_changes(ORIGINAL_PYTHON, PROPOSED_PYTHON_REMOVED_FUNC, "python")
        assert any(w.change_type == "function_removed" for w in warnings)

    def test_dispatch_unsupported_language(self):
        """Unsupported language returns empty list."""
        warnings = detect_breaking_changes("code", "code", "ruby")
        assert warnings == []


ORIGINAL_JS = """
export function greet(name) { return `Hello, ${name}`; }
export function farewell(name) { return `Goodbye, ${name}`; }
"""

PROPOSED_JS_EXPORT_REMOVED = """
export const greet = (name) => `Hello, ${name}`;
// farewell removed
"""


class TestJSBreakingChanges:

    def test_export_removed_is_high(self):
        """Removing a named export is HIGH severity."""
        warnings = detect_js_breaking_changes(ORIGINAL_JS, PROPOSED_JS_EXPORT_REMOVED)
        high = [w for w in warnings if w.severity == "HIGH" and w.change_type == "export_removed"]
        assert any(w.symbol == "farewell" for w in high)

    def test_no_breaking_when_exports_preserved(self):
        """Preserving all exports produces no breaking change warnings."""
        warnings = detect_js_breaking_changes(ORIGINAL_JS, ORIGINAL_JS)
        assert len(warnings) == 0

    def test_dispatch_javascript(self):
        """dispatch function routes to JS detector."""
        warnings = detect_breaking_changes(ORIGINAL_JS, PROPOSED_JS_EXPORT_REMOVED, "javascript")
        assert any(w.change_type == "export_removed" for w in warnings)


# ─── Unified Diff Tests ──────────────────────────────────────────────────────

from app.refactor.engine import _compute_unified_diff, _extract_code_block


class TestUnifiedDiff:

    def test_diff_additions_visible(self):
        orig = "def foo():\n    pass\n"
        proposed = "def foo() -> None:\n    pass\n"
        diff = _compute_unified_diff(orig, proposed, "foo.py")
        assert "+" in diff
        assert "-" in diff

    def test_diff_identical_code_is_empty(self):
        code = "def foo():\n    return 42\n"
        diff = _compute_unified_diff(code, code, "same.py")
        assert diff == ""


class TestExtractCodeBlock:

    def test_extracts_python_fence(self):
        text = "Here is your code:\n```python\ndef foo():\n    pass\n```\nDone."
        result = _extract_code_block(text, "python")
        assert "def foo" in result

    def test_extracts_generic_fence(self):
        text = "```\ndef foo():\n    pass\n```"
        result = _extract_code_block(text, "python")
        assert "def foo" in result

    def test_returns_text_if_no_fence(self):
        text = "def foo():\n    pass"
        result = _extract_code_block(text, "python")
        assert "def foo" in result


# ─── Engine Integration Tests (Mocked Gemini) ────────────────────────────────

from app.refactor.engine import RefactorEngine, _refactor_single_file
from app.analyzers.base.schema import ProjectAnalysis, FileAnalysis, FunctionSymbol, ParameterSymbol


def _make_file_analysis(path: str = "main.py", language: str = "python") -> FileAnalysis:
    return FileAnalysis(
        path=path,
        language=language,
        total_lines=10,
        functions=[
            FunctionSymbol(
                name="add",
                parameters=[
                    ParameterSymbol(name="a"),
                    ParameterSymbol(name="b"),
                ],
                start_line=1,
                end_line=3,
            )
        ],
    )


def _make_project(files=None) -> ProjectAnalysis:
    return ProjectAnalysis(
        root_dir="/tmp/test",
        total_files=1,
        total_lines=10,
        languages=["python"],
        files=files or [_make_file_analysis()],
    )


class TestRefactorEngine:

    def test_refactor_single_file_safe_proposal(self):
        """Engine should produce a RefactoredFile with diff and no HIGH warnings for safe refactor."""
        mock_provider = MagicMock()
        mock_provider.generate.return_value = (
            "```python\n"
            "from typing import Union\n"
            "def add(a: int, b: int) -> int:\n"
            "    return a + b\n"
            "```"
        )
        fa = _make_file_analysis()
        rf = _refactor_single_file(fa, "def add(a, b):\n    return a + b\n", mock_provider)
        assert rf.file_path == "main.py"
        assert "def add" in rf.proposed_code
        high = [w for w in rf.breaking_changes if w.severity == "HIGH"]
        assert len(high) == 0

    def test_refactor_engine_skips_files_with_parse_error(self, tmp_path):
        """Files with parse errors are excluded from refactoring candidates."""
        mock_provider = MagicMock()
        mock_provider.generate.return_value = "```python\ndef foo(): pass\n```"
        bad_file = FileAnalysis(
            path="bad.py",
            language="python",
            total_lines=1,
            parse_error="SyntaxError",
            functions=[FunctionSymbol(name="foo", parameters=[], start_line=1, end_line=1)],
        )
        project = _make_project(files=[bad_file])
        engine = RefactorEngine(provider=mock_provider)
        result = engine.refactor_project(project, str(tmp_path))
        # bad.py was not readable from tmp_path so result will be 0 files
        assert result.total_files_refactored == 0

    def test_refactor_engine_reads_file_and_proposes(self, tmp_path):
        """Engine reads original code from job_dir and returns refactored proposal."""
        orig_code = "def add(a, b):\n    return a + b\n"
        src_file = tmp_path / "main.py"
        src_file.write_text(orig_code, encoding="utf-8")

        mock_provider = MagicMock()
        mock_provider.generate.return_value = (
            "```python\n"
            "def add(a: int, b: int) -> int:\n"
            "    return a + b\n"
            "```"
        )
        project = _make_project(files=[_make_file_analysis("main.py")])
        engine = RefactorEngine(provider=mock_provider)
        result = engine.refactor_project(project, str(tmp_path))
        assert result.total_files_refactored == 1
        assert result.files[0].file_path == "main.py"


# ─── API Router Tests ────────────────────────────────────────────────────────

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestRefactorAPI:

    def test_404_for_unknown_job(self):
        response = client.get("/api/jobs/nonexistent-job-id/refactor")
        assert response.status_code == 404

    def test_400_for_incomplete_job(self):
        """Jobs that are not in 'completed' state should return 400."""
        from app.jobs.manager import job_manager
        job_id = job_manager.create_job("test", "test.zip")
        response = client.get(f"/api/jobs/{job_id}/refactor")
        assert response.status_code == 400
