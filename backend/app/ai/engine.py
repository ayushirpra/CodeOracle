"""
Explanation engine — orchestrates context building and AI calls.
One file = one bounded Gemini call. No unbounded full-repo dumps.
"""
import time
from typing import Optional, List
from app.analyzers.base.schema import ProjectAnalysis, FileAnalysis
from app.graph.schema import DependencyGraph
from app.ai.provider import GeminiProvider, AIProviderError, gemini_provider
from app.ai.context_builder import ContextBuilder, context_builder
from app.ai.prompts import repo_overview_prompt, file_explanation_prompt, symbol_explanation_prompt
from app.ai.schema import (
    ProjectExplanation, FileExplanation, SymbolExplanation
)

# How long to pause between per-file calls to avoid rate limits
INTER_FILE_DELAY_SECS = 0.3


class ExplanationEngine:
    """
    Hierarchical explanation engine.
    - Step 1: generate a repository overview from a compact summary.
    - Step 2: per file, generate file-level explanations with symbol details.
    Each call is bounded — never sends >3000 chars per file context.
    """

    def __init__(
        self,
        provider: Optional[GeminiProvider] = None,
        ctx_builder: Optional[ContextBuilder] = None,
    ):
        self._provider = provider or gemini_provider
        self._ctx = ctx_builder or context_builder

    def explain_project(
        self,
        project: ProjectAnalysis,
        graph: Optional[DependencyGraph] = None,
    ) -> ProjectExplanation:
        """
        Generate a complete hierarchical explanation for a project.
        Returns partial results on partial failures, marks them clearly.
        """
        # --- 1. Repository overview ---
        repo_ctx = self._ctx.build_repo_context(project, graph)
        prompt = repo_overview_prompt(repo_ctx)
        try:
            overview_text = self._provider.generate(prompt)
        except AIProviderError as exc:
            return ProjectExplanation(
                overview="",
                languages=project.languages,
                total_files=project.total_files,
                total_lines=project.total_lines,
                error=f"Repository overview failed: {exc.message}",
            )

        # --- 2. Per-file explanations ---
        # Cap candidate files to top 10 for performance and token boundaries
        candidate_files = project.files[:10]
        file_explanations: List[FileExplanation] = []
        had_error = False

        from concurrent.futures import ThreadPoolExecutor

        def _worker(fa: FileAnalysis) -> FileExplanation:
            return self._explain_file(fa, graph)

        with ThreadPoolExecutor(max_workers=3) as executor:
            results = list(executor.map(_worker, candidate_files))

        for fe in results:
            if fe.error:
                had_error = True
            file_explanations.append(fe)

        # Determine entry points heuristically from the overview context
        entry_points = _heuristic_entry_points(project)

        return ProjectExplanation(
            overview=overview_text,
            languages=project.languages,
            total_files=project.total_files,
            total_lines=project.total_lines,
            files=file_explanations,
            entry_points=entry_points,
            partial=had_error,
        )

    def _explain_file(
        self,
        fa: FileAnalysis,
        graph: Optional[DependencyGraph] = None,
    ) -> FileExplanation:
        """Generate explanation for a single file + its symbols."""
        file_ctx = self._ctx.build_file_context(fa, graph)
        prompt = file_explanation_prompt(file_ctx)

        try:
            file_text = self._provider.generate(prompt)
        except AIProviderError as exc:
            return FileExplanation(
                path=fa.path,
                language=fa.language,
                total_lines=fa.total_lines,
                summary="",
                error=f"File explanation failed: {exc.message}",
            )

        key_exports = [ex.name for ex in fa.exports[:10]]
        deps = [imp.module for imp in fa.imports[:10]]

        # Construct symbol explanations directly from AST Analysis metadata
        symbols: List[SymbolExplanation] = []
        for cls in fa.classes[:10]:
            methods_str = ", ".join(m.name for m in cls.methods[:5])
            symbols.append(SymbolExplanation(
                name=cls.name,
                symbol_type="class",
                file_path=fa.path,
                start_line=cls.start_line,
                end_line=cls.end_line,
                summary=cls.docstring or f"Class {cls.name} defining methods: {methods_str or 'None'}.",
                dependencies=cls.base_classes[:5],
            ))

        for fn in fa.functions[:10]:
            params_str = ", ".join(p.name for p in fn.parameters[:5])
            symbols.append(SymbolExplanation(
                name=fn.name,
                symbol_type="function",
                file_path=fa.path,
                start_line=fn.start_line,
                end_line=fn.end_line,
                summary=fn.docstring or f"Function {fn.name}({params_str}) -> {fn.return_type or 'Any'}.",
                dependencies=list({c.callee for c in getattr(fn, "calls", [])})[:5],
            ))

        return FileExplanation(
            path=fa.path,
            language=fa.language,
            total_lines=fa.total_lines,
            summary=file_text,
            key_exports=key_exports,
            dependencies=deps,
            symbols=symbols,
        )


def _heuristic_entry_points(project: ProjectAnalysis) -> List[str]:
    """
    Heuristically identify entry-point files by name convention.
    No AI call — pure static heuristic.
    """
    entry_names = {"main", "index", "app", "server", "run", "__main__"}
    results = []
    for fa in project.files:
        base = fa.path.replace("\\", "/").split("/")[-1]
        stem = base.rsplit(".", 1)[0].lower()
        if stem in entry_names:
            results.append(fa.path)
    return results


# Module-level singleton
explanation_engine = ExplanationEngine()
