import re
from typing import List, Tuple, Optional
from app.analyzers.base.adapter import LanguageAdapter
from app.analyzers.base.schema import (
    FileAnalysis,
    ImportSymbol,
    ExportSymbol,
    ClassSymbol,
    FunctionSymbol,
    ParameterSymbol,
    FunctionCall,
)


class JavaScriptAdapter(LanguageAdapter):
    """Language adapter for JavaScript and TypeScript parsing."""

    @property
    def language_name(self) -> str:
        return "javascript"

    @property
    def supported_extensions(self) -> List[str]:
        return [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]

    def parse_file(self, full_path: str, rel_path: str) -> FileAnalysis:
        try:
            with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                code = f.read()
        except Exception as exc:
            return FileAnalysis(
                path=rel_path,
                language=self.language_name,
                total_lines=0,
                parse_error=f"Failed to read file: {str(exc)}"
            )

        lines = code.splitlines()
        total_lines = len(lines)

        imports = self._extract_imports(lines)
        exports = self._extract_exports(lines)
        classes, standalone_functions = self._extract_classes_and_functions(lines)
        calls = self._extract_calls(lines)

        return FileAnalysis(
            path=rel_path,
            language=self.language_name,
            total_lines=total_lines,
            imports=imports,
            exports=exports,
            classes=classes,
            functions=standalone_functions,
            calls=calls
        )

    def _extract_imports(self, lines: List[str]) -> List[ImportSymbol]:
        imports: List[ImportSymbol] = []
        
        # ESM: import { x, y } from 'mod'  or import Default from 'mod'
        esm_pattern = re.compile(
            r"import\s+(?:([\w$\s,{}*]+)\s+from\s+)?['\"]([^'\"]+)['\"]"
        )
        # CJS: const x = require('mod')
        cjs_pattern = re.compile(
            r"(?:const|let|var)\s+(?:([\w$\s,{}]+)\s*=\s*)?require\s*\(\s*['\"]([^'\"]+)['\"]\s*\)"
        )

        for idx, line in enumerate(lines, 1):
            line_str = line.strip()
            if line_str.startswith("//") or line_str.startswith("/*"):
                continue

            esm_match = esm_pattern.search(line_str)
            if esm_match:
                names_part = esm_match.group(1) or ""
                mod = esm_match.group(2)
                imported_names = [
                    n.strip() for n in re.split(r"[,{}\s]+", names_part) if n.strip() and n.strip() != "*"
                ]
                imports.append(ImportSymbol(
                    module=mod,
                    names=imported_names,
                    line=idx,
                    is_relative=mod.startswith(".")
                ))
                continue

            cjs_match = cjs_pattern.search(line_str)
            if cjs_match:
                names_part = cjs_match.group(1) or ""
                mod = cjs_match.group(2)
                imported_names = [
                    n.strip() for n in re.split(r"[,{}\s]+", names_part) if n.strip()
                ]
                imports.append(ImportSymbol(
                    module=mod,
                    names=imported_names,
                    line=idx,
                    is_relative=mod.startswith(".")
                ))

        return imports

    def _extract_exports(self, lines: List[str]) -> List[ExportSymbol]:
        exports: List[ExportSymbol] = []
        
        # export default foo
        default_pattern = re.compile(r"export\s+default\s+([\w$]+)")
        # export const/function/class name
        named_pattern = re.compile(r"export\s+(?:const|let|var|function|class)\s+([\w$]+)")
        # module.exports = ...
        cjs_export_pattern = re.compile(r"module\.exports\s*=\s*(?:{[\s\w$,]+}|([\w$]+))")

        for idx, line in enumerate(lines, 1):
            line_str = line.strip()
            if line_str.startswith("//") or line_str.startswith("/*"):
                continue

            def_match = default_pattern.search(line_str)
            if def_match:
                exports.append(ExportSymbol(name=def_match.group(1), export_type="default", line=idx))
                continue

            named_match = named_pattern.search(line_str)
            if named_match:
                exports.append(ExportSymbol(name=named_match.group(1), export_type="named", line=idx))
                continue

            cjs_match = cjs_export_pattern.search(line_str)
            if cjs_match:
                name = cjs_match.group(1) or "module.exports"
                exports.append(ExportSymbol(name=name, export_type="default", line=idx))

        return exports

    def _extract_classes_and_functions(
        self, lines: List[str]
    ) -> Tuple[List[ClassSymbol], List[FunctionSymbol]]:
        classes: List[ClassSymbol] = []
        functions: List[FunctionSymbol] = []

        class_pattern = re.compile(r"class\s+([\w$]+)(?:\s+extends\s+([\w$.]+))?")
        func_pattern = re.compile(
            r"(?:async\s+)?function\s*([\w$]*)\s*\(([^)]*)\)"
        )
        arrow_pattern = re.compile(
            r"(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>"
        )

        in_class: Optional[str] = None
        current_class_methods: List[FunctionSymbol] = []
        current_class_name = ""
        current_class_bases: List[str] = []
        current_class_start = 1

        for idx, line in enumerate(lines, 1):
            line_str = line.strip()
            if line_str.startswith("//") or line_str.startswith("/*"):
                continue

            cls_match = class_pattern.search(line_str)
            if cls_match:
                cls_name = cls_match.group(1)
                base_cls = cls_match.group(2)
                bases = [base_cls] if base_cls else []
                classes.append(ClassSymbol(
                    name=cls_name,
                    base_classes=bases,
                    methods=[],
                    start_line=idx,
                    end_line=idx + 10 # Estimated
                ))
                continue

            func_match = func_pattern.search(line_str)
            if func_match:
                func_name = func_match.group(1) or "anonymous"
                raw_params = func_match.group(2)
                params = self._parse_params(raw_params)
                functions.append(FunctionSymbol(
                    name=func_name,
                    parameters=params,
                    start_line=idx,
                    end_line=idx + 5,
                    is_async="async" in line_str
                ))
                continue

            arrow_match = arrow_pattern.search(line_str)
            if arrow_match:
                func_name = arrow_match.group(1)
                raw_params = arrow_match.group(2)
                params = self._parse_params(raw_params)
                functions.append(FunctionSymbol(
                    name=func_name,
                    parameters=params,
                    start_line=idx,
                    end_line=idx + 5,
                    is_async="async" in line_str
                ))

        return classes, functions

    def _parse_params(self, raw_params: str) -> List[ParameterSymbol]:
        params: List[ParameterSymbol] = []
        if not raw_params.strip():
            return params

        parts = raw_params.split(",")
        for part in parts:
            p = part.strip()
            if not p:
                continue
            # Remove typescript type annotations (e.g. arg: string)
            name_part = p.split(":")[0].strip()
            default_val = p.split("=")[1].strip() if "=" in p else None
            params.append(ParameterSymbol(name=name_part, default_value=default_val))

        return params

    def _extract_calls(self, lines: List[str]) -> List[FunctionCall]:
        calls: List[FunctionCall] = []
        call_pattern = re.compile(r"([\w$.]+)\s*\(([^)]*)\)")
        keywords = {"if", "for", "while", "switch", "catch", "function", "require", "import"}

        for idx, line in enumerate(lines, 1):
            line_str = line.strip()
            if line_str.startswith("//") or line_str.startswith("/*"):
                continue

            for match in call_pattern.finditer(line_str):
                callee = match.group(1)
                if callee not in keywords and not callee.startswith("console."):
                    raw_args = match.group(2)
                    args_count = len([a for a in raw_args.split(",") if a.strip()])
                    calls.append(FunctionCall(
                        callee=callee,
                        args_count=args_count,
                        line=idx
                    ))

        return calls
