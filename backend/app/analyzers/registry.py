from typing import Dict, List, Optional, Any
from app.analyzers.base.adapter import LanguageAdapter
from app.analyzers.base.schema import ProjectAnalysis, FileAnalysis
from app.analyzers.python.adapter import PythonAdapter
from app.analyzers.javascript.adapter import JavaScriptAdapter


class AdapterRegistry:
    """Registry and orchestrator for pluggable language adapters."""

    def __init__(self):
        self._adapters: List[LanguageAdapter] = []
        # Register default initial adapters
        self.register(PythonAdapter())
        self.register(JavaScriptAdapter())

    def register(self, adapter: LanguageAdapter):
        """Registers a new language adapter."""
        self._adapters.append(adapter)

    def get_adapter(self, file_path: str) -> Optional[LanguageAdapter]:
        """Finds registered adapter capable of handling the file extension."""
        for adapter in self._adapters:
            if adapter.can_handle(file_path):
                return adapter
        return None

    def analyze_project(self, scan_results: Dict[str, Any]) -> ProjectAnalysis:
        """
        Analyzes all source files in a scanned project using registered language adapters.
        Returns normalized ProjectAnalysis object.

        Files are parsed in parallel (up to 4 workers) since each file's AST parse
        is independent and CPU-bound — this meaningfully reduces wall-clock time for
        large (50+ file) projects without risking shared-state race conditions.
        """
        root_dir = scan_results.get("root_dir", "")
        scanned_files = scan_results.get("files", [])

        dependencies_summary: Dict[str, List[str]] = {}

        from concurrent.futures import ThreadPoolExecutor

        def _parse_file(file_info: Dict[str, Any]) -> FileAnalysis:
            full_path = file_info["full_path"]
            rel_path = file_info["path"]
            adapter = self.get_adapter(rel_path)
            if adapter:
                return adapter.parse_file(full_path, rel_path)
            return FileAnalysis(
                path=rel_path,
                language=file_info.get("language", "unknown"),
                total_lines=file_info.get("lines", 0),
                parse_error="No registered adapter available for file extension."
            )

        with ThreadPoolExecutor(max_workers=4) as executor:
            file_analyses: List[FileAnalysis] = list(executor.map(_parse_file, scanned_files))

        # Build dependency summary after parallel parse (sequential — fast dict ops)
        for analysis in file_analyses:
            imported_mods = [imp.module for imp in analysis.imports if imp.module]
            if imported_mods:
                dependencies_summary[analysis.path] = sorted(list(set(imported_mods)))

        return ProjectAnalysis(
            root_dir=root_dir,
            total_files=scan_results.get("total_files", len(file_analyses)),
            total_lines=scan_results.get("total_lines", sum(f.total_lines for f in file_analyses)),
            languages=scan_results.get("languages", []),
            files=file_analyses,
            dependencies_summary=dependencies_summary
        )


# Global adapter registry instance
adapter_registry = AdapterRegistry()
