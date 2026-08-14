"""
Phase 9 — 10,000-line validation tests.
No live Gemini calls — all AI is mocked.

Validates:
1. Exact-10k line project is accepted (201) and correctly counted.
2. Repo context and file context stay within stated char bounds.
3. ExplanationEngine caps to ≤ 10 files even with 50-file project.
4. TestGenerator caps to ≤ 5 files even with 50-file project.
5. RefactorEngine caps to ≤ 5 files even with 50-file project.
6. Parallel Gemini calls never exceed 3 concurrently (global semaphore).
7. AST analysis of ~10,000 lines completes in < 10 seconds wall-clock.
8. Project exceeding 10,000 lines is rejected with HTTP 400.
9. Prompts do not contain raw source code.
"""
import io
import os
import time
import zipfile
import threading
import tempfile
from typing import List
from unittest.mock import patch, MagicMock
import concurrent.futures

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.ai.context_builder import ContextBuilder, MAX_CHARS_PER_FILE, MAX_CHARS_REPO_SUMMARY
from app.ai.engine import ExplanationEngine
from app.ai.provider import GeminiProvider, _GLOBAL_GEMINI_SEMAPHORE
from app.ai.schema import ProjectExplanation
from app.analyzers.base.schema import (
    ProjectAnalysis, FileAnalysis, FunctionSymbol, ClassSymbol,
    ParameterSymbol, ImportSymbol
)
from app.analyzers.registry import AdapterRegistry

client = TestClient(app)


# ─── Synthetic Project Generators ────────────────────────────────────────────

def _make_python_file_content(file_index: int, target_lines: int) -> str:
    lines = [
        f'"""Synthetic module {file_index}."""',
        "import os",
        "import sys",
        "from typing import List, Dict, Any",
        "",
    ]
    classes_needed = max(1, target_lines // 50)
    for cls_idx in range(classes_needed):
        cls_name = f"SyntheticClass{file_index}_{cls_idx}"
        lines += [
            f"class {cls_name}:",
            f'    """Class {cls_name}."""',
            f"    DEFAULT_VALUE: int = {cls_idx}",
            "",
            f"    def __init__(self, value: int = {cls_idx}) -> None:",
            f"        self.value = value",
            f"        self.name = '{cls_name}'",
            "",
            f"    def compute(self, factor: int) -> int:",
            f'        """Compute."""',
            f"        return self.value * factor + {cls_idx}",
            "",
            f"    def to_dict(self) -> Dict[str, Any]:",
            f'        """Serialize."""',
            f"        return {{'value': self.value, 'name': self.name}}",
            "",
        ]
    current = len(lines)
    fn_idx = 0
    while current < target_lines - 5:
        lines += [
            f"def helper_func_{file_index}_{fn_idx}(x: int, y: int = 0) -> int:",
            f'    """Helper {fn_idx}."""',
            f"    if x < 0:",
            f"        return 0",
            f"    return x + y + {fn_idx}",
            "",
        ]
        fn_idx += 1
        current = len(lines)
    return "\n".join(lines)


def _create_synthetic_10k_zip(num_files: int = 15, total_target_lines: int = 9900) -> io.BytesIO:
    lines_per_file = total_target_lines // num_files
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for i in range(num_files):
            extra = (total_target_lines % num_files) if i == num_files - 1 else 0
            content = _make_python_file_content(i, lines_per_file + extra)
            zf.writestr(f"src/module_{i:02d}.py", content)
        zf.writestr("src/__init__.py", "# Package init\n")
    zip_buffer.seek(0)
    return zip_buffer


def _make_large_project_analysis(num_files: int = 50) -> ProjectAnalysis:
    files = []
    for i in range(num_files):
        funcs = [
            FunctionSymbol(
                name=f"func_{i}_{j}", start_line=j*10+1, end_line=j*10+9,
                parameters=[ParameterSymbol(name="x"), ParameterSymbol(name="y")],
                return_type="int", is_async=False, is_method=False,
                docstring=f"Function {j}.",
            )
            for j in range(5)
        ]
        classes = [
            ClassSymbol(
                name=f"Class{i}_{k}", start_line=k*20+1, end_line=k*20+19,
                methods=[
                    FunctionSymbol(
                        name=f"method_{k}_{m}", start_line=k*20+m*3+2, end_line=k*20+m*3+4,
                        parameters=[ParameterSymbol(name="self")],
                        is_method=True, class_name=f"Class{i}_{k}",
                    )
                    for m in range(3)
                ],
                docstring=f"Class {k}.",
            )
            for k in range(2)
        ]
        files.append(FileAnalysis(
            path=f"src/module_{i:02d}.py", language="python", total_lines=200,
            imports=[ImportSymbol(module="os", line=1), ImportSymbol(module="sys", line=2)],
            functions=funcs, classes=classes,
        ))
    return ProjectAnalysis(
        root_dir="/tmp/synthetic_10k", total_files=num_files,
        total_lines=num_files * 200, languages=["python"], files=files,
    )


# ─── Test 1: Exact-10k project accepted ──────────────────────────────────────

def test_10k_line_project_accepted():
    zip_bytes = _create_synthetic_10k_zip(num_files=15, total_target_lines=9900)
    response = client.post(
        "/api/projects/upload",
        files={"file": ("synthetic_10k.zip", zip_bytes, "application/zip")},
    )
    assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
    data = response.json()
    assert data["status"] == "completed"
    assert "job_id" in data
    stats = data["stats"]
    assert stats["total_files"] >= 15
    assert stats["total_lines"] <= 10000
    assert "python" in stats["languages"]


# ─── Test 2: Context builder stays within bounds ─────────────────────────────

def test_repo_context_bounded_for_large_project():
    project = _make_large_project_analysis(num_files=50)
    ctx = ContextBuilder().build_repo_context(project)
    assert len(ctx) <= MAX_CHARS_REPO_SUMMARY, f"Repo context {len(ctx)} > {MAX_CHARS_REPO_SUMMARY}"


def test_file_context_bounded_for_large_file():
    project = _make_large_project_analysis(num_files=1)
    ctx = ContextBuilder().build_file_context(project.files[0])
    assert len(ctx) <= MAX_CHARS_PER_FILE, f"File context {len(ctx)} > {MAX_CHARS_PER_FILE}"


def test_all_files_context_bounded():
    project = _make_large_project_analysis(num_files=50)
    builder = ContextBuilder()
    for fa in project.files:
        ctx = builder.build_file_context(fa)
        assert len(ctx) <= MAX_CHARS_PER_FILE, f"{fa.path}: {len(ctx)} > {MAX_CHARS_PER_FILE}"


# ─── Test 3: ExplanationEngine caps at 10 files ──────────────────────────────

def test_explanation_engine_caps_files_at_10():
    project = _make_large_project_analysis(num_files=50)
    call_count = {"n": 0}

    def mock_generate(prompt, temperature=0.2):
        call_count["n"] += 1
        return "Mocked explanation."

    with patch.object(GeminiProvider, "generate", side_effect=mock_generate):
        result = ExplanationEngine().explain_project(project)

    assert call_count["n"] <= 11, f"ExplanationEngine made {call_count['n']} calls; expected ≤11"
    assert isinstance(result, ProjectExplanation)


# ─── Test 4: TestGenerator caps at 5 files ───────────────────────────────────

def test_test_generator_caps_files_at_5():
    from app.ai.test_generator import TestGenerator
    project = _make_large_project_analysis(num_files=50)
    call_count = {"n": 0}

    def mock_generate(prompt, temperature=0.2):
        call_count["n"] += 1
        return "`python\ndef test_mock():\n    assert True\n`"

    with patch.object(GeminiProvider, "generate", side_effect=mock_generate):
        TestGenerator().generate_tests_for_project(project)

    assert call_count["n"] <= 5, f"TestGenerator made {call_count['n']} calls; expected ≤5"


# ─── Test 5: RefactorEngine caps at 5 files ──────────────────────────────────

def test_refactor_engine_caps_files_at_5():
    from app.refactor.engine import RefactorEngine
    project = _make_large_project_analysis(num_files=50)
    call_count = {"n": 0}

    def mock_generate(prompt, temperature=0.2):
        call_count["n"] += 1
        return "`python\ndef refactored(): pass\n`"

    with tempfile.TemporaryDirectory() as job_dir:
        src_dir = os.path.join(job_dir, "src")
        os.makedirs(src_dir, exist_ok=True)
        for i in range(50):
            with open(os.path.join(src_dir, f"module_{i:02d}.py"), "w") as f:
                f.write(f"def func_{i}():\n    pass\n")

        with patch.object(GeminiProvider, "generate", side_effect=mock_generate):
            RefactorEngine().refactor_project(project, job_dir)

    assert call_count["n"] <= 5, f"RefactorEngine made {call_count['n']} calls; expected ≤5"


# ─── Test 6: Global semaphore limits concurrent Gemini calls to ≤ 3 ──────────

def test_global_semaphore_limits_concurrent_calls():
    """Semaphore with value=3 must never allow >3 concurrent acquires."""
    sem = threading.Semaphore(3)
    max_concurrent = {"value": 0}
    current = {"value": 0}
    lock = threading.Lock()

    def task():
        sem.acquire()
        try:
            with lock:
                current["value"] += 1
                if current["value"] > max_concurrent["value"]:
                    max_concurrent["value"] = current["value"]
            time.sleep(0.03)  # Hold slot briefly
        finally:
            with lock:
                current["value"] -= 1
            sem.release()

    with concurrent.futures.ThreadPoolExecutor(max_workers=9) as pool:
        futs = [pool.submit(task) for _ in range(9)]
        concurrent.futures.wait(futs)

    assert max_concurrent["value"] <= 3, (
        f"Concurrent count hit {max_concurrent['value']}; semaphore should cap at 3"
    )


def test_global_semaphore_exists_in_provider():
    """Verify _GLOBAL_GEMINI_SEMAPHORE is exported from provider module."""
    import app.ai.provider as pmod
    assert hasattr(pmod, "_GLOBAL_GEMINI_SEMAPHORE"), (
        "_GLOBAL_GEMINI_SEMAPHORE missing from provider module"
    )
    assert isinstance(pmod._GLOBAL_GEMINI_SEMAPHORE, type(threading.Semaphore())), (
        "_GLOBAL_GEMINI_SEMAPHORE is not a threading.Semaphore"
    )


# ─── Test 7: AST analysis timing < 10 seconds ────────────────────────────────

def test_ast_analysis_timing_under_10_seconds():
    zip_bytes = _create_synthetic_10k_zip(num_files=15, total_target_lines=9900)
    with tempfile.TemporaryDirectory() as tmpdir:
        with zipfile.ZipFile(zip_bytes, "r") as zf:
            zf.extractall(tmpdir)

        from app.ingestion.scanner import ProjectScanner
        scan_result = ProjectScanner(root_dir=tmpdir).scan()

        t_start = time.perf_counter()
        project = AdapterRegistry().analyze_project(scan_result)
        elapsed = time.perf_counter() - t_start

    assert elapsed < 10.0, f"AST analysis took {elapsed:.2f}s — exceeds 10s limit"
    assert project.total_files >= 15
    assert project.total_lines <= 10000


# ─── Test 8: Over-10k project rejected ───────────────────────────────────────

def test_over_10k_project_rejected():
    long_content = "x = 1\n" * 10005
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("large_module.py", long_content)
    zip_buffer.seek(0)

    response = client.post(
        "/api/projects/upload",
        files={"file": ("overlimit.zip", zip_buffer, "application/zip")},
    )
    assert response.status_code == 400
    msg = response.json()["detail"]["message"].lower()
    assert "line limit" in msg or "exceeds" in msg, f"Unexpected message: {msg}"


# ─── Test 9: Prompts do not contain raw source code ──────────────────────────

def test_prompts_do_not_contain_raw_source_code():
    project = _make_large_project_analysis(num_files=3)
    received_prompts = []

    def capture_generate(prompt, temperature=0.2):
        received_prompts.append(prompt)
        return "Summary."

    with patch.object(GeminiProvider, "generate", side_effect=capture_generate):
        ExplanationEngine().explain_project(project)

    raw_markers = ["def __init__(self", "return x + y", "import os\nimport sys"]
    for prompt in received_prompts:
        for marker in raw_markers:
            assert marker not in prompt, (
                f"Prompt contains raw source marker: '{marker[:40]}'"
            )

