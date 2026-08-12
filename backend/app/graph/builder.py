import os
from typing import Dict, List, Set
from app.analyzers.base.schema import ProjectAnalysis, FileAnalysis
from app.graph.schema import DependencyGraph, GraphNode, GraphEdge


class GraphBuilder:
    """
    Builds a normalized dependency graph from ProjectAnalysis output.
    Only relationships proven by static analysis are included — no invented edges.
    """

    def build(self, project_analysis: ProjectAnalysis) -> DependencyGraph:
        """
        Constructs nodes from analyzed files, then builds edges from
        import statements that resolve to other files within the project.
        """
        nodes: List[GraphNode] = []
        edges: List[GraphEdge] = []

        # Index all project file paths for resolution
        # key: normalized path, value: path as stored in FileAnalysis
        path_index: Dict[str, str] = {}
        for fa in project_analysis.files:
            path_index[fa.path] = fa.path
            # Also index by basename without extension for module-style imports
            base = os.path.splitext(fa.path)[0].replace("\\", "/")
            path_index[base] = fa.path

        # Build nodes
        for fa in project_analysis.files:
            node_id = fa.path
            nodes.append(GraphNode(
                id=node_id,
                label=os.path.basename(fa.path),
                language=fa.language,
                path=fa.path,
                total_lines=fa.total_lines,
                num_functions=len(fa.functions) + sum(len(c.methods) for c in fa.classes),
                num_classes=len(fa.classes),
                num_imports=len(fa.imports),
                num_exports=len(fa.exports),
                has_parse_error=fa.parse_error is not None,
            ))

        # Build edges from imports
        edge_set: Set[str] = set()
        edge_counter = 0

        for fa in project_analysis.files:
            source_id = fa.path

            for imp in fa.imports:
                # Only resolve relative imports or cross-file imports within the project
                target_id = self._resolve_import(imp.module, fa.path, imp.is_relative, path_index)

                if target_id and target_id != source_id:
                    edge_key = f"{source_id}→{target_id}"
                    if edge_key not in edge_set:
                        edge_set.add(edge_key)
                        edges.append(GraphEdge(
                            id=f"e{edge_counter}",
                            source=source_id,
                            target=target_id,
                            module=imp.module,
                            is_relative=imp.is_relative,
                        ))
                        edge_counter += 1

        # Build adjacency maps
        dependents_map: Dict[str, List[str]] = {n.id: [] for n in nodes}
        dependencies_map: Dict[str, List[str]] = {n.id: [] for n in nodes}

        for edge in edges:
            if edge.source in dependencies_map:
                dependencies_map[edge.source].append(edge.target)
            if edge.target in dependents_map:
                dependents_map[edge.target].append(edge.source)

        return DependencyGraph(
            nodes=nodes,
            edges=edges,
            total_nodes=len(nodes),
            total_edges=len(edges),
            dependents_map=dependents_map,
            dependencies_map=dependencies_map,
        )

    def _resolve_import(
        self,
        module: str,
        source_path: str,
        is_relative: bool,
        path_index: Dict[str, str],
    ) -> str:
        """
        Attempts to resolve an import module name to a concrete file path
        within the project. Returns the resolved path or empty string.
        Only establishes edges that can be proven from static analysis.
        """
        source_dir = os.path.dirname(source_path).replace("\\", "/")
        module_as_path = module.replace(".", "/").replace("\\", "/")

        candidates: List[str] = []

        # Normalise module path: strip leading ./ and ../ for resolution
        module_clean = module.lstrip("./")
        module_clean_path = module_clean.replace(".", "/").replace("\\", "/")

        if is_relative or module.startswith("."):
            # Relative import: resolve against source file's directory
            if source_dir:
                candidates.append(f"{source_dir}/{module_clean_path}")
            candidates.append(module_clean_path)

            # Also try with just the clean module as Python dotted import (utils -> utils)
            if source_dir:
                candidates.append(f"{source_dir}/{module_as_path}")
            candidates.append(module_as_path)
        else:
            # Absolute import: try as project-relative path
            candidates.append(module_as_path)
            if source_dir:
                candidates.append(f"{source_dir}/{module_as_path}")

        for candidate in candidates:
            candidate = candidate.replace("\\", "/")
            if candidate in path_index:
                return path_index[candidate]
            # Try with .py and .js extensions
            for ext in ["", ".py", ".js", ".ts", ".jsx", ".tsx"]:
                key = f"{candidate}{ext}"
                if key in path_index:
                    return path_index[key]

        return ""


# Module-level singleton
graph_builder = GraphBuilder()
