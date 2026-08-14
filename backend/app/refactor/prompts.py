"""
Refactor Prompts — Phase 7.
Builds Gemini prompts for safe, behavior-preserving code modernisation.
"""
from app.analyzers.base.schema import FileAnalysis


def build_python_refactor_prompt(fa: FileAnalysis, original_code: str) -> str:
    """
    Builds a Gemini prompt to modernise a Python file.
    Instructs the model to: add type hints, use f-strings, async/await where applicable,
    improve abstractions — while NEVER changing public API signatures or removing functions.
    """
    symbols = []
    for cls in fa.classes:
        symbols.append(f"  class {cls.name}")
    for fn in fa.functions:
        params = ", ".join(p.name for p in fn.parameters)
        symbols.append(f"  def {fn.name}({params})")
    symbol_str = "\n".join(symbols) if symbols else "  (no top-level symbols detected)"

    return f"""You are an expert Python modernisation engineer.
Refactor the following Python source file to use modern Python 3.10+ idioms.

--- File Metadata ---
File path : {fa.path}
Lines     : {fa.total_lines}

Public symbols (DO NOT REMOVE or rename these):
{symbol_str}

--- Modernisation Rules ---
1. Add PEP 484 type annotations to ALL function parameters and return types using the `typing` module or built-in generics.
2. Replace %-format and .format() string formatting with f-strings.
3. Replace verbose loops with list/dict comprehensions where idiomatic.
4. Use `pathlib.Path` instead of `os.path` for file operations.
5. Add `async` / `await` where I/O or sleep calls are made, if not already present.
6. Keep all existing public function and class names EXACTLY the same.
7. Never remove any existing function, class, or module-level variable.
8. Never change the number or names of required positional parameters.
9. Add or improve docstrings where missing.
10. Output ONLY the complete refactored Python source code inside a ```python ... ``` block.
    Do NOT include any explanatory text, commentary, or diff output outside the code block.

--- Original Source Code ---
```python
{original_code}
```""".strip()


def build_javascript_refactor_prompt(fa: FileAnalysis, original_code: str) -> str:
    """
    Builds a Gemini prompt to modernise a JavaScript/TypeScript file.
    """
    symbols = []
    for fn in fa.functions:
        params = ", ".join(p.name for p in fn.parameters)
        symbols.append(f"  function {fn.name}({params})")
    symbol_str = "\n".join(symbols) if symbols else "  (no top-level symbols detected)"

    return f"""You are an expert JavaScript/TypeScript modernisation engineer.
Refactor the following JavaScript source file to use modern ES2022+ idioms.

--- File Metadata ---
File path : {fa.path}
Lines     : {fa.total_lines}

Public symbols (DO NOT REMOVE or rename these):
{symbol_str}

--- Modernisation Rules ---
1. Replace `var` with `const` or `let` throughout.
2. Replace traditional `function` declarations with arrow functions where appropriate.
3. Replace `.then()` promise chains with `async`/`await`.
4. Use optional chaining (`?.`) and nullish coalescing (`??`) where appropriate.
5. Replace string concatenation with template literals.
6. Never remove existing named exports.
7. Keep all existing public function and export names EXACTLY the same.
8. Add JSDoc comments where missing.
9. Output ONLY the complete refactored JavaScript source code inside a ```javascript ... ``` block.
    Do NOT include any explanatory text, commentary, or diff output outside the code block.

--- Original Source Code ---
```javascript
{original_code}
```""".strip()


def build_refactor_summary_prompt(file_path: str, diff_text: str) -> str:
    """Asks Gemini for a brief plain-English summary of what was modernised."""
    return f"""You are a technical writer.
Given this unified diff for `{file_path}`, write ONE sentence (max 25 words) summarising
what was modernised in plain English. Do not include code or symbols.

--- Unified Diff ---
{diff_text[:3000]}

Output ONLY the one-sentence summary. No bullet points, no markdown.
""".strip()
