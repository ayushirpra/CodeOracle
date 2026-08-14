"""
Test Generator — uses Gemini API and AST context to generate runnable unit tests.
Produces test files for Python (pytest) and JavaScript (vitest/jest).
"""
import re
import os
import time
from typing import List, Optional
from app.analyzers.base.schema import ProjectAnalysis, FileAnalysis
from app.ai.provider import GeminiProvider, gemini_provider, AIProviderError
from app.ai.test_schema import GeneratedTestFile, JobTestResults

INTER_FILE_DELAY_SECS = 0.3


def build_python_test_prompt(fa: FileAnalysis) -> str:
    """Builds a prompt asking Gemini for runnable pytest unit tests targeting a Python file."""
    symbols_info = []

    for cls in fa.classes:
        methods = [m.name for m in cls.methods]
        symbols_info.append(f"Class {cls.name} (methods: {', '.join(methods)})")

    for fn in fa.functions:
        params = [p.name for p in fn.parameters]
        ret = fn.return_type or "Unknown"
        symbols_info.append(f"Function {fn.name}({', '.join(params)}) -> {ret}")

    symbols_str = "\n".join(symbols_info) if symbols_info else "Module level functions and logic."
    module_import_path = os.path.splitext(fa.path.replace("\\", "/"))[0].replace("/", ".")

    prompt = f"""
You are an expert Python test engineer. Write a complete, runnable pytest unit test suite for the Python file: `{fa.path}`.

--- Module AST Context ---
File path: {fa.path}
Module import path: {module_import_path}
Total lines: {fa.total_lines}

Functions and Classes to test:
{symbols_str}

--- Instructions ---
1. Import the module under test using standard Python import syntax: `import {module_import_path}` or `from {module_import_path} import ...`.
2. Write multiple test functions starting with `test_` covering normal behavior, edge cases, zero/empty inputs, and invalid inputs.
3. If external I/O, network calls, or databases are present, use `unittest.mock` (`@patch` or `MagicMock`) to stub them out so tests execute deterministically.
4. DO NOT write placeholder comments like `# Add test here`. Provide complete, working assertions (`assert ...`).
5. Output ONLY the raw Python test code wrapped in ```python and ``` codeblock. Do not add any conversational text before or after.
"""
    return prompt.strip()


def build_javascript_test_prompt(fa: FileAnalysis) -> str:
    """Builds a prompt asking Gemini for runnable unit tests targeting a JS/TS file."""
    symbols_info = []
    for fn in fa.functions:
        params = [p.name for p in fn.parameters]
        symbols_info.append(f"Function {fn.name}({', '.join(params)})")

    symbols_str = "\n".join(symbols_info) if symbols_info else "Module exports."

    prompt = f"""
You are an expert JavaScript test engineer. Write a complete, runnable Jest/Vitest unit test suite for the JS file: `{fa.path}`.

--- Module AST Context ---
File path: {fa.path}
Total lines: {fa.total_lines}

Functions to test:
{symbols_str}

--- Instructions ---
1. Import the target module using relative import paths.
2. Write test cases using `describe` and `test` / `it` blocks with `expect(...)` assertions.
3. Stub external calls with `jest.fn()` if needed.
4. Output ONLY raw JavaScript code wrapped in ```javascript and ``` codeblock. Do not add conversational text.
"""
    return prompt.strip()


def extract_code_block(text: str, default_lang: str = "python") -> str:
    """Extracts raw code from Markdown ``` code blocks."""
    pattern = r"```(?:python|js|javascript|typescript)?\s*(.*?)\s*```"
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()

    # Fallback: strip leading/trailing backticks if any
    cleaned = text.strip()
    if cleaned.startswith("```") and cleaned.endswith("```"):
        lines = cleaned.splitlines()
        if len(lines) >= 2:
            return "\n".join(lines[1:-1]).strip()
    return cleaned


class TestGenerator:
    """Generates unit test files for a ProjectAnalysis using Gemini."""
    __test__ = False

    def __init__(self, provider: Optional[GeminiProvider] = None):
        self._provider = provider or gemini_provider

    def generate_tests_for_project(self, project: ProjectAnalysis) -> JobTestResults:
        """
        Generates test files for all non-test source files in a project.
        Returns JobTestResults containing GeneratedTestFile items.
        """
        generated_files: List[GeneratedTestFile] = []
        errors: List[str] = []

        for fa in project.files:
            # Skip existing test files
            norm_path = fa.path.replace("\\", "/").lower()
            if "test_" in norm_path or "_test" in norm_path or "/tests/" in norm_path:
                continue

            # Skip empty files
            if not fa.functions and not fa.classes and fa.total_lines < 3:
                continue

            time.sleep(INTER_FILE_DELAY_SECS)

            if fa.language == "python":
                prompt = build_python_test_prompt(fa)
                test_filename = f"test_{os.path.basename(fa.path)}"
                test_dir = os.path.dirname(fa.path)
                test_path = os.path.join(test_dir, test_filename) if test_dir else f"tests/{test_filename}"
            elif fa.language in ("javascript", "typescript"):
                prompt = build_javascript_test_prompt(fa)
                base = os.path.splitext(os.path.basename(fa.path))[0]
                test_filename = f"{base}.test.js"
                test_dir = os.path.dirname(fa.path)
                test_path = os.path.join(test_dir, test_filename) if test_dir else f"tests/{test_filename}"
            else:
                continue

            try:
                raw_response = self._provider.generate(prompt)
                code = extract_code_block(raw_response, default_lang=fa.language)

                if code:
                    generated_files.append(GeneratedTestFile(
                        file_path=test_path.replace("\\", "/"),
                        target_file=fa.path,
                        code=code,
                        language=fa.language
                    ))
            except AIProviderError as exc:
                errors.append(f"Failed to generate tests for {fa.path}: {exc.message}")
            except Exception as exc:
                errors.append(f"Error generating tests for {fa.path}: {str(exc)}")

        err_msg = "; ".join(errors) if errors else None
        return JobTestResults(
            generated_files=generated_files,
            error=err_msg
        )


test_generator = TestGenerator()
