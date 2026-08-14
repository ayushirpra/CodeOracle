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


def build_targeted_coverage_prompt(fa: FileAnalysis, uncovered_lines: List[int], existing_test_code: str) -> str:
    """Builds a targeted prompt requesting additional unit tests specifically exercising uncovered lines."""
    lines_str = ", ".join(str(ln) for ln in uncovered_lines[:20])
    module_import_path = os.path.splitext(fa.path.replace("\\", "/"))[0].replace("/", ".")

    prompt = f"""
You are an expert test engineer. The existing test suite for `{fa.path}` does not cover lines: {lines_str}.

--- Module AST Context ---
File path: {fa.path}
Module import path: {module_import_path}
Total lines: {fa.total_lines}
Uncovered line numbers: {lines_str}

--- Existing Test Code ---
{existing_test_code[:1000]}

--- Instructions ---
1. Write NEW, additional unit test functions specifically designed to execute the logic, branches, or conditions on uncovered lines {lines_str}.
2. Use unique test function names (e.g. `test_retry_coverage_line_{uncovered_lines[0]}` or descriptive branch names).
3. Do not repeat existing tests. Output ONLY the additional Python/JavaScript code block wrapped in ```python or ```javascript codeblocks.
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
        Generates test files for non-test source files in a project (capped at 5 files for scalability).
        Returns JobTestResults containing GeneratedTestFile items.
        """
        candidate_files: List[FileAnalysis] = []
        for fa in project.files:
            norm_path = fa.path.replace("\\", "/").lower()
            if "test_" in norm_path or "_test" in norm_path or "/tests/" in norm_path:
                continue
            if not fa.functions and not fa.classes and fa.total_lines < 3:
                continue
            if fa.language.lower() in ("python", "javascript", "typescript"):
                candidate_files.append(fa)

        candidate_files = candidate_files[:5]

        generated_files: List[GeneratedTestFile] = []
        errors: List[str] = []

        from concurrent.futures import ThreadPoolExecutor

        def _worker(fa: FileAnalysis) -> Optional[GeneratedTestFile]:
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
                return None

            try:
                raw_response = self._provider.generate(prompt)
                code = extract_code_block(raw_response, default_lang=fa.language)

                if code:
                    return GeneratedTestFile(
                        file_path=test_path.replace("\\", "/"),
                        target_file=fa.path,
                        code=code,
                        language=fa.language
                    )
            except AIProviderError as exc:
                errors.append(f"Failed to generate tests for {fa.path}: {exc.message}")
            except Exception as exc:
                errors.append(f"Error generating tests for {fa.path}: {str(exc)}")
            return None

        with ThreadPoolExecutor(max_workers=3) as executor:
            results = list(executor.map(_worker, candidate_files))

        for res in results:
            if res:
                generated_files.append(res)

        err_msg = "; ".join(errors) if errors else None
        return JobTestResults(
            generated_files=generated_files,
            error=err_msg
        )

    def refine_tests_for_coverage(
        self,
        project: ProjectAnalysis,
        job_dir: str,
        job_tests: JobTestResults,
        runner_instance=None,
        primary_lang: str = "python",
        target_percent: float = 60.0,
        max_retries: int = 2
    ) -> JobTestResults:
        """
        Bounded retry refinement loop to elevate coverage toward target_percent.
        Reads uncovered lines from coverage.json, generates targeted tests, appends them to files,
        and re-runs in Docker container. Bounded at max_retries (default 2).
        """
        from app.runners.docker_runner import docker_runner
        runner = runner_instance or docker_runner

        if not job_tests.execution or not job_tests.execution.coverage:
            return job_tests

        curr_cov = job_tests.execution.coverage.coverage_percent
        job_tests.coverage_history = [curr_cov]
        job_tests.target_reached = curr_cov >= target_percent
        job_tests.retry_count = 0

        retry_iteration = 0
        while curr_cov < target_percent and retry_iteration < max_retries:
            uncovered_map = job_tests.execution.coverage.uncovered_lines_by_file
            if not uncovered_map:
                break

            retry_iteration += 1
            has_new_tests = False

            for target_file, missing_lines in uncovered_map.items():
                if not missing_lines:
                    continue

                matching_fa = next(
                    (fa for fa in project.files if fa.path.replace("\\", "/") == target_file.replace("\\", "/")),
                    None
                )
                if not matching_fa:
                    base = os.path.basename(target_file)
                    matching_fa = next(
                        (fa for fa in project.files if os.path.basename(fa.path) == base),
                        None
                    )

                if not matching_fa:
                    continue

                gen_file = next(
                    (gf for gf in job_tests.generated_files if gf.target_file == matching_fa.path),
                    None
                )
                existing_code = gen_file.code if gen_file else ""

                prompt = build_targeted_coverage_prompt(matching_fa, missing_lines, existing_code)

                try:
                    time.sleep(INTER_FILE_DELAY_SECS)
                    raw_resp = self._provider.generate(prompt)
                    extra_code = extract_code_block(raw_resp, default_lang=matching_fa.language)

                    if extra_code:
                        new_code = existing_code + "\n\n# Targeted Retry Additional Coverage Tests\n" + extra_code
                        if gen_file:
                            gen_file.code = new_code
                            full_test_path = os.path.join(job_dir, gen_file.file_path)
                        else:
                            test_filename = f"test_{os.path.basename(matching_fa.path)}"
                            rel_path = f"tests/{test_filename}"
                            full_test_path = os.path.join(job_dir, rel_path)
                            gen_file = GeneratedTestFile(
                                file_path=rel_path,
                                target_file=matching_fa.path,
                                code=new_code,
                                language=matching_fa.language
                            )
                            job_tests.generated_files.append(gen_file)

                        os.makedirs(os.path.dirname(full_test_path), exist_ok=True)
                        with open(full_test_path, "w", encoding="utf-8") as f:
                            f.write(new_code)
                        has_new_tests = True
                except Exception:
                    pass

            if not has_new_tests:
                break

            exec_res = runner.run_tests(job_dir=job_dir, language=primary_lang)
            job_tests.execution = exec_res
            job_tests.retry_count = retry_iteration

            if exec_res.coverage:
                curr_cov = exec_res.coverage.coverage_percent
                job_tests.coverage_history.append(curr_cov)

            if curr_cov >= target_percent:
                job_tests.target_reached = True
                break

        job_tests.target_reached = curr_cov >= target_percent
        return job_tests


test_generator = TestGenerator()
