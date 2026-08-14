# CodeOracle — AI Coding Memory

This file is the coding agent's source of truth. Update it after every completed phase.

## Current Status
- Phase: 6 (Coverage Analysis & Bounded Retries) — Completed
- Overall status: Phase 6 fully implemented and verified with 58 backend tests passing
- Last updated: Phase 6 completion

## Completed
- Final product scope defined.
- Final architecture defined.
- Final engineering rules defined.
- Final implementation phases defined.
- Final design system defined.
- **Phase 0 Foundation Implemented**: React+Vite+TS frontend, FastAPI backend, health endpoint, Render config.
- **Phase 1 Project Ingestion Implemented**: ZIP upload (with Zip Slip protection), public GitHub download, file scanning, 10,000 line limit, job workspace management.
- **Phase 2 Language Adapters Implemented**: `LanguageAdapter` abstract contract, `PythonAdapter` (ast), `JavaScriptAdapter` (regex-AST), `AdapterRegistry`, normalized `ProjectAnalysis` schema, integrated into API pipeline.
- **Phase 3 Dependency Graph Implemented**:
  - `GraphNode`/`GraphEdge`/`DependencyGraph` schema in `backend/app/graph/schema.py`.
  - `GraphBuilder` in `backend/app/graph/builder.py`.
  - `GET /api/jobs/{job_id}/graph` endpoint.
  - `reactflow` added to frontend.
  - `DependencyGraph` React component in `frontend/src/components/DependencyGraph.tsx`.
- **Phase 4 Gemini Explanation Engine Implemented**:
  - `GeminiProvider` abstraction layer (`backend/app/ai/provider.py`).
  - `ExplanationEngine` & `ContextBuilder` (`backend/app/ai/engine.py`, `backend/app/ai/context_builder.py`).
  - Explanation Schema (`backend/app/ai/schema.py`).
  - `GET /api/jobs/{job_id}/explain` API endpoint.
  - Frontend UI (`frontend/src/components/ExplanationView.tsx`).
- **Phase 5 Test Suite Generation & Execution Implemented**:
  - `TestGenerator` (`backend/app/ai/test_generator.py`).
  - Test Schemas (`backend/app/ai/test_schema.py`).
  - Docker Execution Sandbox (`backend/app/runners/docker_runner.py`).
  - Pytest & Coverage Parsers (`backend/app/runners/python_runner.py`, `js_runner.py`).
  - API Endpoint (`backend/app/api/tests_api.py`).
  - Frontend UI (`frontend/src/components/TestResultsView.tsx`).
- **Phase 6 Coverage Analysis & Bounded Retries Implemented**:
  - `build_targeted_coverage_prompt` (`backend/app/ai/test_generator.py`): Formats targeted prompts containing missing line numbers extracted from `coverage.json` (`uncovered_lines_by_file`).
  - `refine_tests_for_coverage` (`backend/app/ai/test_generator.py`): Bounded retry loop (max 2 retries) that appends targeted tests for unexercised lines, re-runs in Docker sandbox, and tracks `coverage_history` and `target_reached` status.
  - API Endpoints (`backend/app/api/tests_api.py`): Automatic retry refinement in `GET /api/jobs/{job_id}/tests` when coverage $< 60\%$ and new `POST /api/jobs/{job_id}/retry-tests` endpoint.
  - Backend Test Suite (`backend/app/tests/test_coverage_retry.py`): 4 new unit tests covering targeted prompt construction, retry termination, and coverage escalation (58 backend tests passing total).
  - Frontend UI (`frontend/src/components/TestResultsView.tsx`): Displays `Coverage Refinement (Retries: X/2)` badge, coverage trend history (`40% -> 58% -> 75%`), target $>60\%$ status badge, and "Run Targeted Retry" button.

## In Progress
- None (Phase 6 completed, ready for Phase 7).

## Next Task
Phase 7 — Safe Code Refactoring & Breaking Change Warnings:
1. Gemini refactoring engine using AST analysis & context.
2. Modernization proposals (type hints, async/await, modern syntax).
3. Split-pane code diffs (Original | Proposed).
4. Signature / API / Import breaking change detector & warnings.

## Final Technology Decisions
- React + Vite + TypeScript + Tailwind + reactflow
- Monaco Editor (Phase 5+)
- FastAPI + Python
- Gemini API (`google-genai` SDK)
- Python built-in `ast`; JavaScript regex-AST
- pytest + coverage.py
- Docker sandbox (`docker run --network none --memory 512m`)
- Render
- Temporary filesystem; no database; no authentication

## Architecture Decisions
- Gemini access is hidden behind `GeminiProvider` abstraction.
- API key is never exposed to the frontend.
- AI engine never receives raw source code or unbounded repo context — receives structured summaries built by `ContextBuilder`.
- Docker execution is isolated with `--network none` and strict resource caps; falls back safely to descriptive error if Docker daemon is offline.
- Test runner output and `coverage.json` are parsed to produce actual (never fabricated) line coverage metrics.
- Targeted retry refinement is strictly bounded at max 2 retries to control cost and execution time while elevating line coverage toward $>60\%$.

## Known Issues
None.

## Environment Variables
Never store secret values here. `GEMINI_API_KEY` is read from server environment only.

## Verification Checklist
- [x] Frontend runs
- [x] Backend runs
- [x] Frontend reaches backend
- [x] ZIP upload works
- [x] Public GitHub ingestion works
- [x] Python adapter works
- [x] JavaScript adapter works
- [x] Dependency graph works
- [x] Gemini explanation engine works
- [x] Generated tests work
- [x] Docker runner works
- [x] Real coverage works
- [x] >60% benchmark coverage achieved
- [ ] Refactoring works (Phase 7)
- [ ] Breaking-change warnings work (Phase 7)
- [ ] 10k-line project handled
- [ ] Render deployment works

## Agent Update Rule
After each phase:
- Update Current Status.
- Move finished work into Completed.
- Record important decisions.
- Record bugs/blockers.
- Update verification checkboxes.
- Set the next smallest concrete task.
