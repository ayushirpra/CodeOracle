"""
validate_10k.py — standalone timing measurement script.
Run manually: python validate_10k.py
Does NOT use live Gemini API. All AI calls are mocked.
Reports wall-clock times and peak memory for each pipeline stage.
"""
import sys
import os
import io
import time
import zipfile
import tempfile
import tracemalloc
import threading
from unittest.mock import patch, MagicMock

# Make sure the backend app is importable
sys.path.insert(0, os.path.dirname(__file__))

from app.ingestion.scanner import ProjectScanner
from app.analyzers.registry import AdapterRegistry
from app.ai.context_builder import ContextBuilder
from app.ai.engine import ExplanationEngine
from app.ai.provider import GeminiProvider
from app.graph.builder import GraphBuilder


def banner(msg):
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}")


def measure(label, fn, *args, **kwargs):
    """Run fn(*args, **kwargs), measure wall time and peak memory."""
    tracemalloc.start()
    t0 = time.perf_counter()
    result = fn(*args, **kwargs)
    elapsed = time.perf_counter() - t0
    _, peak_bytes = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    status = "OK" if elapsed < 10 else "SLOW >"
    print(f"  [{label:<30}]  {elapsed:6.3f}s   peak mem: {peak_bytes/1024:.1f} KB  [{status}]")
    return result, elapsed


def make_python_file(file_index: int, target_lines: int) -> str:
    lines = [
        f'"""Synthetic module {file_index}."""',
        "import os", "import sys", "from typing import Dict, Any", "",
    ]
    classes_needed = max(1, target_lines // 50)
    for c in range(classes_needed):
        lines += [
            f"class Synth{file_index}_{c}:",
            f'    """Class."""',
            f"    V: int = {c}",
            "",
            f"    def __init__(self, v: int = {c}) -> None:",
            f"        self.v = v",
            "",
            f"    def compute(self, f: int) -> int:",
            f'        """Compute."""',
            f"        return self.v * f + {c}",
            "",
        ]
    cur = len(lines)
    fi = 0
    while cur < target_lines - 5:
        lines += [
            f"def h_{file_index}_{fi}(x: int, y: int = 0) -> int:",
            f'    """Helper."""',
            f"    if x < 0: return 0",
            f"    return x + y + {fi}",
            "",
        ]
        fi += 1
        cur = len(lines)
    return "\n".join(lines)


def create_10k_zip(num_files=15, total_lines=9900) -> io.BytesIO:
    lf = total_lines // num_files
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i in range(num_files):
            extra = (total_lines % num_files) if i == num_files - 1 else 0
            zf.writestr(f"src/module_{i:02d}.py", make_python_file(i, lf + extra))
        zf.writestr("src/__init__.py", "# init\n")
    buf.seek(0)
    return buf


def main():
    banner("Phase 9 — 10,000-Line Validation Timing Report")
    print(f"  Python: {sys.version}")
    print(f"  CWD:    {os.getcwd()}")

    # ── Stage 1: Create synthetic zip ────────────────────────────────────────
    print("\n[Stage 1] Building synthetic ~9,900-line ZIP (15 files)...")
    t0 = time.perf_counter()
    zip_bytes = create_10k_zip(num_files=15, total_lines=9900)
    t1 = time.perf_counter()
    print(f"  ZIP created in {t1-t0:.3f}s  (size: {zip_bytes.getbuffer().nbytes/1024:.1f} KB)")

    with tempfile.TemporaryDirectory() as tmpdir:
        # Extract
        with zipfile.ZipFile(zip_bytes, "r") as zf:
            zf.extractall(tmpdir)

        # ── Stage 2: Ingestion / Scan ─────────────────────────────────────
        print("\n[Stage 2] Ingestion & File Scan")
        scanner = ProjectScanner(root_dir=tmpdir)
        scan_result, t_scan = measure("Ingestion+Scan", scanner.scan)
        print(f"    -> {scan_result['total_files']} files, {scan_result['total_lines']} lines")

        # ── Stage 3: AST Analysis ─────────────────────────────────────────
        print("\n[Stage 3] AST Analysis (Parallel, max_workers=4)")
        registry = AdapterRegistry()
        project, t_ast = measure("AST Analysis (parallel)", registry.analyze_project, scan_result)
        total_fns = sum(len(f.functions) for f in project.files)
        total_cls = sum(len(f.classes) for f in project.files)
        print(f"    -> {project.total_files} files parsed | {total_fns} functions | {total_cls} classes")

        # ── Stage 4: Dependency Graph ─────────────────────────────────────
        print("\n[Stage 4] Dependency Graph Build")
        gb = GraphBuilder()
        graph, t_graph = measure("Graph Build", gb.build, project)
        print(f"    -> {graph.total_nodes} nodes, {graph.total_edges} edges")

        # ── Stage 5: Context Building ─────────────────────────────────────
        print("\n[Stage 5] Context Building (all files)")
        builder = ContextBuilder()
        def build_all_contexts():
            repo_ctx = builder.build_repo_context(project, graph)
            file_ctxs = [builder.build_file_context(fa, graph) for fa in project.files]
            return repo_ctx, file_ctxs
        (repo_ctx, file_ctxs), t_ctx = measure("Context Build (all files)", build_all_contexts)
        max_file_ctx = max(len(c) for c in file_ctxs)
        print(f"    -> repo_ctx: {len(repo_ctx)} chars (limit {1500})")
        print(f"    -> file_ctx max: {max_file_ctx} chars (limit {3000})")
        assert len(repo_ctx) <= 1500, f"VIOLATION: repo_ctx {len(repo_ctx)} > 1500"
        assert max_file_ctx <= 3000, f"VIOLATION: max file_ctx {max_file_ctx} > 3000"
        print(f"    -> Context bounds: PASS")

        # ── Stage 6: Explain Prompt Build (mocked Gemini) ─────────────────
        print("\n[Stage 6] Explanation Engine (Gemini MOCKED, 10-file cap)")
        call_count = {"n": 0}
        def mock_gen(prompt, temperature=0.2):
            call_count["n"] += 1
            return "Mocked explanation response."

        with patch.object(GeminiProvider, "generate", side_effect=mock_gen):
            engine = ExplanationEngine()
            result, t_explain = measure("ExplanationEngine (mocked)", engine.explain_project, project, graph)
        print(f"    -> Gemini calls made: {call_count['n']} (cap: 11 = 1 overview + 10 files)")
        assert call_count["n"] <= 11, f"VIOLATION: {call_count['n']} calls > 11"
        print(f"    -> File cap: PASS")

        # ── Stage 7: Test Generation (mocked) ────────────────────────────
        print("\n[Stage 7] Test Generator (Gemini MOCKED, 5-file cap)")
        from app.ai.test_generator import TestGenerator
        call_count["n"] = 0
        def mock_gen_test(prompt, temperature=0.2):
            call_count["n"] += 1
            return "`python\ndef test_x():\n    assert True\n`"
        with patch.object(GeminiProvider, "generate", side_effect=mock_gen_test):
            gen = TestGenerator()
            _, t_testgen = measure("TestGenerator (mocked)", gen.generate_tests_for_project, project)
        print(f"    -> Gemini calls: {call_count['n']} (cap: 5)")
        assert call_count["n"] <= 5, f"VIOLATION: {call_count['n']} > 5"
        print(f"    -> File cap: PASS")

        # ── Stage 8: Refactor (mocked) ────────────────────────────────────
        print("\n[Stage 8] Refactor Engine (Gemini MOCKED, 5-file cap)")
        from app.refactor.engine import RefactorEngine
        import os as _os
        # Create source files for refactor engine to read
        src_dir = _os.path.join(tmpdir, "src")
        call_count["n"] = 0
        def mock_gen_ref(prompt, temperature=0.15):
            call_count["n"] += 1
            return "`python\ndef refactored(): pass\n`"
        with patch.object(GeminiProvider, "generate", side_effect=mock_gen_ref):
            re_engine = RefactorEngine()
            _, t_refactor = measure("RefactorEngine (mocked)", re_engine.refactor_project, project, tmpdir)
        print(f"    -> Gemini calls: {call_count['n']} (cap: 5)")
        assert call_count["n"] <= 5, f"VIOLATION: {call_count['n']} > 5"
        print(f"    -> File cap: PASS")

    # ── Summary ───────────────────────────────────────────────────────────────
    banner("TIMING SUMMARY")
    timings = {
        "Ingestion+Scan": t_scan,
        "AST Analysis (parallel)": t_ast,
        "Graph Build": t_graph,
        "Context Build": t_ctx,
        "ExplanationEngine (mocked)": t_explain,
        "TestGenerator (mocked)": t_testgen,
        "RefactorEngine (mocked)": t_refactor,
    }
    all_pass = True
    for label, t in timings.items():
        status = "PASS" if t < 10 else "FAIL (>10s)"
        if t >= 10:
            all_pass = False
        print(f"  {label:<35}  {t:6.3f}s  [{status}]")

    print(f"\n{'='*60}")
    if all_pass:
        print("  ALL STAGES < 10 seconds — PASS")
    else:
        print("  SOME STAGES EXCEEDED 10 seconds — INVESTIGATE")
    print(f"{'='*60}\n")
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())


