"""
Refactor Engine — Phase 7.
Orchestrates Gemini-powered code modernisation:
  1. Builds AST-guided prompts via prompts.py
  2. Calls GeminiProvider to get proposed refactored code
  3. Computes unified diffs with difflib
  4. Detects breaking changes with breaking_changes.py
  5. Assembles per-file RefactoredFile and project-level ProjectRefactorProposal
"""
import re
import os
import time
import difflib
from typing import List, Optional

from app.analyzers.base.schema import ProjectAnalysis, FileAnalysis
from app.ai.provider import gemini_provider, GeminiProvider, AIProviderError
from app.refactor.schema import RefactoredFile, ProjectRefactorProposal, BreakingChangeWarning
from app.refactor.prompts import (
    build_python_refactor_prompt,
    build_javascript_refactor_prompt,
    build_refactor_summary_prompt,
)
from app.refactor.breaking_changes import detect_breaking_changes

# Maximum number of files to refactor per project (cost/time guard)
MAX_FILES_TO_REFACTOR = 5
INTER_FILE_DELAY_SECS = 0.3


# ─── Code Extraction Helpers ─────────────────────────────────────────────────

def _extract_code_block(text: str, lang: str) -> str:
    """
    Extract code from a Gemini response that wraps code in ``` fenced blocks.
    Falls back to the full text if no fence is found.
    """
    # Try language-specific fence first
    pattern = rf"```{re.escape(lang)}\s*\n(.*?)```"
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()

    # Generic fence fallback
    generic = re.search(r"```\w*\s*\n(.*?)```", text, re.DOTALL)
    if generic:
        return generic.group(1).strip()

    # Last resort: strip leading/trailing backtick lines
    lines = text.strip().splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines).strip()


def _compute_unified_diff(original: str, proposed: str, file_path: str) -> str:
    """Generate a unified diff string between two code strings."""
    orig_lines = original.splitlines(keepends=True)
    prop_lines = proposed.splitlines(keepends=True)
    diff_lines = list(difflib.unified_diff(
        orig_lines,
        prop_lines,
        fromfile=f"a/{file_path}",
        tofile=f"b/{file_path}",
        lineterm="",
    ))
    return "".join(diff_lines)


def _read_source_file(job_dir: str, file_path: str) -> Optional[str]:
    """Read source file from job directory; return None if unreadable."""
    full_path = os.path.join(job_dir, file_path)
    if not os.path.exists(full_path):
        return None
    try:
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception:
        return None


# ─── File Refactoring ────────────────────────────────────────────────────────

def _refactor_single_file(
    fa: FileAnalysis,
    original_code: str,
    provider: GeminiProvider,
) -> RefactoredFile:
    """
    Refactor a single source file using Gemini and compute all metadata.
    """
    lang = fa.language.lower()

    # Build appropriate prompt
    if lang == "python":
        prompt = build_python_refactor_prompt(fa, original_code)
        fence_lang = "python"
    elif lang in ("javascript", "typescript"):
        prompt = build_javascript_refactor_prompt(fa, original_code)
        fence_lang = "javascript"
    else:
        # Unsupported language — return original unchanged
        return RefactoredFile(
            file_path=fa.path,
            language=lang,
            original_code=original_code,
            proposed_code=original_code,
            unified_diff="",
            refactor_summary="Language not supported for refactoring.",
        )

    # Call Gemini
    raw_response = provider.generate(prompt, temperature=0.15)
    proposed_code = _extract_code_block(raw_response, fence_lang)

    # Safety: if Gemini returns empty or identical code, use original
    if not proposed_code.strip() or proposed_code.strip() == original_code.strip():
        proposed_code = original_code

    # Compute unified diff
    unified_diff = _compute_unified_diff(original_code, proposed_code, fa.path)

    # Detect breaking changes
    breaking = detect_breaking_changes(original_code, proposed_code, lang, fa.path)

    high_count = sum(1 for w in breaking if w.severity == "HIGH")
    medium_count = sum(1 for w in breaking if w.severity == "MEDIUM")
    low_count = sum(1 for w in breaking if w.severity == "LOW")

    # Generate plain-English summary locally from diff to avoid redundant AI API round-trips
    summary = ""
    if unified_diff:
        lines_added = sum(1 for line in unified_diff.splitlines() if line.startswith("+") and not line.startswith("+++"))
        lines_removed = sum(1 for line in unified_diff.splitlines() if line.startswith("-") and not line.startswith("---"))
        summary = f"Modernised `{fa.path}` ({lines_added} additions, {lines_removed} deletions) with type annotations and modern idioms."
    else:
        summary = f"Preserved `{fa.path}` structure — no structural changes required."

    return RefactoredFile(
        file_path=fa.path,
        language=lang,
        original_code=original_code,
        proposed_code=proposed_code,
        unified_diff=unified_diff,
        breaking_changes=breaking,
        high_count=high_count,
        medium_count=medium_count,
        low_count=low_count,
        refactor_summary=summary or f"Refactored `{fa.path}` with modern idioms.",
    )


# ─── Project Refactoring Engine ──────────────────────────────────────────────

class RefactorEngine:
    """Orchestrates Gemini-based refactoring proposals for a full project."""

    def __init__(self, provider: GeminiProvider = gemini_provider):
        self._provider = provider

    def refactor_project(
        self,
        project: ProjectAnalysis,
        job_dir: str,
    ) -> ProjectRefactorProposal:
        """
        Iterate over project source files, call Gemini to propose refactored code,
        compute diffs, detect breaking changes, and return aggregated results.

        Only refactors files that:
          - Have no parse errors
          - Are Python or JavaScript
          - Contain at least one function or class
        """
        candidate_files = [
            fa for fa in project.files
            if not fa.parse_error
            and fa.language.lower() in ("python", "javascript", "typescript")
            and (fa.functions or fa.classes)
        ]

        # Limit to MAX_FILES_TO_REFACTOR to control cost/time
        candidate_files = candidate_files[:MAX_FILES_TO_REFACTOR]

        refactored_files: List[RefactoredFile] = []

        for fa in candidate_files:
            original_code = _read_source_file(job_dir, fa.path)
            if original_code is None:
                continue

            try:
                rf = _refactor_single_file(fa, original_code, self._provider)
                refactored_files.append(rf)
            except AIProviderError:
                raise
            except Exception:
                # Skip file silently on unexpected errors; don't abort the whole project
                pass

            time.sleep(INTER_FILE_DELAY_SECS)

        # Aggregate counts
        total_warnings = sum(len(rf.breaking_changes) for rf in refactored_files)
        high_warnings = sum(rf.high_count for rf in refactored_files)
        medium_warnings = sum(rf.medium_count for rf in refactored_files)
        low_warnings = sum(rf.low_count for rf in refactored_files)

        return ProjectRefactorProposal(
            total_files_refactored=len(refactored_files),
            total_warnings=total_warnings,
            high_warnings=high_warnings,
            medium_warnings=medium_warnings,
            low_warnings=low_warnings,
            files=refactored_files,
        )


# Singleton
refactor_engine = RefactorEngine()
