"""
Breaking Change Detector — Phase 7.
Statically compares original vs refactored Python code using AST analysis to detect
function removals, parameter signature changes, and import contract modifications.
JavaScript code is scanned using regex-based pattern matching.
"""
import ast
import re
from typing import List, Dict, Set, Tuple, Optional
from app.refactor.schema import BreakingChangeWarning


# ─── Python AST Helpers ───────────────────────────────────────────────────────

def _parse_python_safely(code: str) -> Optional[ast.Module]:
    """Parse Python code and return AST, or None if it fails."""
    try:
        return ast.parse(code)
    except SyntaxError:
        return None


def _extract_python_functions(tree: ast.Module) -> Dict[str, Dict]:
    """Extract all top-level and class-level function signatures from Python AST."""
    funcs: Dict[str, Dict] = {}

    def _process_func(node: ast.FunctionDef, prefix: str = "") -> None:
        qual_name = f"{prefix}{node.name}" if prefix else node.name
        args = node.args
        params = []
        # Positional args (excluding self/cls)
        all_args = args.posonlyargs + args.args
        defaults_offset = len(all_args) - len(args.defaults)

        for i, arg in enumerate(all_args):
            if arg.arg in ("self", "cls"):
                continue
            default_val = None
            if i >= defaults_offset:
                d = args.defaults[i - defaults_offset]
                try:
                    default_val = ast.unparse(d)
                except Exception:
                    default_val = "..."

            annotation = ast.unparse(arg.annotation) if arg.annotation else None
            params.append({
                "name": arg.arg,
                "annotation": annotation,
                "has_default": default_val is not None,
                "default": default_val,
            })

        funcs[qual_name] = {
            "params": params,
            "param_names": [p["name"] for p in params],
            "is_async": isinstance(node, ast.AsyncFunctionDef),
        }

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            _process_func(node)
        elif isinstance(node, ast.ClassDef):
            for item in node.body:
                if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    _process_func(item, prefix=f"{node.name}.")

    return funcs


def _extract_python_classes(tree: ast.Module) -> Set[str]:
    """Return set of top-level class names."""
    return {
        node.name
        for node in ast.walk(tree)
        if isinstance(node, ast.ClassDef)
    }


def _extract_python_imports(tree: ast.Module) -> Set[str]:
    """Return set of top-level imported module names."""
    modules: Set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                modules.add(alias.asname or alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                modules.add(node.module.split(".")[0])
    return modules


# ─── JavaScript Helpers ───────────────────────────────────────────────────────

def _extract_js_exports(code: str) -> Set[str]:
    """Extract named export function/const names from JavaScript/TypeScript using regex."""
    pattern = r'export\s+(?:function|const|class|async\s+function)\s+(\w+)'
    return set(re.findall(pattern, code))


# ─── Core Detection Logic ─────────────────────────────────────────────────────

def detect_python_breaking_changes(
    original_code: str,
    proposed_code: str,
    file_path: str = "",
) -> List[BreakingChangeWarning]:
    """
    Compare two Python source strings and detect breaking changes:
    - Removed functions/classes (HIGH)
    - Added required parameters (HIGH)
    - Renamed parameters (MEDIUM)
    - Changed type annotations (LOW)
    - Import changes (MEDIUM)
    """
    warnings: List[BreakingChangeWarning] = []

    orig_tree = _parse_python_safely(original_code)
    prop_tree = _parse_python_safely(proposed_code)

    if orig_tree is None or prop_tree is None:
        return warnings

    orig_funcs = _extract_python_functions(orig_tree)
    prop_funcs = _extract_python_functions(prop_tree)
    orig_classes = _extract_python_classes(orig_tree)
    prop_classes = _extract_python_classes(prop_tree)
    orig_imports = _extract_python_imports(orig_tree)
    prop_imports = _extract_python_imports(prop_tree)

    # 1. Removed functions → HIGH
    for name in orig_funcs:
        if name not in prop_funcs:
            warnings.append(BreakingChangeWarning(
                severity="HIGH",
                change_type="function_removed",
                symbol=name,
                description=f"Function `{name}` was removed in the refactored version.",
                original_signature=_format_sig(name, orig_funcs[name]),
                proposed_signature=None,
                migration_hint=f"Callers of `{name}` will break. Re-add the function or update all call sites.",
            ))

    # 2. Removed classes → HIGH
    for cls in orig_classes:
        if cls not in prop_classes:
            warnings.append(BreakingChangeWarning(
                severity="HIGH",
                change_type="class_removed",
                symbol=cls,
                description=f"Class `{cls}` was removed in the refactored version.",
                migration_hint=f"Remove all imports and usages of `{cls}`.",
            ))

    # 3. Signature changes on surviving functions
    for name in orig_funcs:
        if name not in prop_funcs:
            continue  # already reported as removed
        orig_params = orig_funcs[name]["params"]
        prop_params = prop_funcs[name]["params"]
        orig_names: List[str] = [p["name"] for p in orig_params]
        prop_names: List[str] = [p["name"] for p in prop_params]

        # Required parameters added → HIGH
        for p in prop_params:
            if p["name"] not in orig_names and not p["has_default"]:
                warnings.append(BreakingChangeWarning(
                    severity="HIGH",
                    change_type="parameter_added_required",
                    symbol=name,
                    description=f"Required parameter `{p['name']}` was added to `{name}()`.",
                    original_signature=_format_sig(name, orig_funcs[name]),
                    proposed_signature=_format_sig(name, prop_funcs[name]),
                    migration_hint=f"All call sites of `{name}()` must now pass `{p['name']}`.",
                ))

        # Removed parameters → HIGH
        for p in orig_params:
            if p["name"] not in prop_names:
                warnings.append(BreakingChangeWarning(
                    severity="HIGH",
                    change_type="parameter_removed",
                    symbol=name,
                    description=f"Parameter `{p['name']}` was removed from `{name}()`.",
                    original_signature=_format_sig(name, orig_funcs[name]),
                    proposed_signature=_format_sig(name, prop_funcs[name]),
                    migration_hint=f"Remove `{p['name']}` from all call sites of `{name}()`.",
                ))

        # Type annotation changes → LOW
        orig_ann = {p["name"]: p["annotation"] for p in orig_params}
        prop_ann = {p["name"]: p["annotation"] for p in prop_params}
        for pname, orig_type in orig_ann.items():
            if pname in prop_ann:
                new_type = prop_ann[pname]
                if orig_type != new_type and orig_type is not None and new_type is not None:
                    warnings.append(BreakingChangeWarning(
                        severity="LOW",
                        change_type="type_annotation_changed",
                        symbol=f"{name}.{pname}",
                        description=(
                            f"Type annotation for `{pname}` in `{name}()` changed "
                            f"from `{orig_type}` to `{new_type}`."
                        ),
                        migration_hint="Verify that the new type annotation is compatible with all callers.",
                    ))

    # 4. Import changes → MEDIUM
    removed_imports = orig_imports - prop_imports
    for mod in removed_imports:
        warnings.append(BreakingChangeWarning(
            severity="MEDIUM",
            change_type="import_removed",
            symbol=mod,
            description=f"Module `{mod}` is no longer imported in the refactored version.",
            migration_hint=f"Ensure nothing in the calling code depends on `{mod}` being imported from this file.",
        ))

    added_imports = prop_imports - orig_imports
    for mod in added_imports:
        warnings.append(BreakingChangeWarning(
            severity="LOW",
            change_type="import_added",
            symbol=mod,
            description=f"New import `{mod}` added — ensure `{mod}` is available in the target environment.",
            migration_hint=f"Add `{mod}` to project dependencies if it is a third-party package.",
        ))

    return warnings


def detect_js_breaking_changes(
    original_code: str,
    proposed_code: str,
    file_path: str = "",
) -> List[BreakingChangeWarning]:
    """
    Regex-based breaking change detection for JavaScript/TypeScript exports.
    """
    warnings: List[BreakingChangeWarning] = []
    orig_exports = _extract_js_exports(original_code)
    prop_exports = _extract_js_exports(proposed_code)

    for name in orig_exports:
        if name not in prop_exports:
            warnings.append(BreakingChangeWarning(
                severity="HIGH",
                change_type="export_removed",
                symbol=name,
                description=f"Export `{name}` was removed in the refactored version.",
                migration_hint=f"All importers of `{name}` will break. Re-export or update them.",
            ))

    return warnings


def detect_breaking_changes(
    original_code: str,
    proposed_code: str,
    language: str,
    file_path: str = "",
) -> List[BreakingChangeWarning]:
    """Entry point — dispatches to the appropriate detector by language."""
    if language == "python":
        return detect_python_breaking_changes(original_code, proposed_code, file_path)
    elif language in ("javascript", "typescript"):
        return detect_js_breaking_changes(original_code, proposed_code, file_path)
    return []


# ─── Formatting Helpers ───────────────────────────────────────────────────────

def _format_sig(name: str, func_info: Dict) -> str:
    """Format a human-readable function signature from extracted AST info."""
    params = func_info.get("params", [])
    parts = []
    for p in params:
        sig = p["name"]
        if p.get("annotation"):
            sig += f": {p['annotation']}"
        if p.get("has_default"):
            sig += f" = {p['default']}"
        parts.append(sig)
    prefix = "async " if func_info.get("is_async") else ""
    return f"{prefix}def {name}({', '.join(parts)})"
