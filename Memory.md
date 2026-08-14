# CodeOracle — AI Coding Memory

This file is the coding agent's source of truth. Update it after every completed phase.

## Current Status
- Phase: 5 (Test Suite Generation & Execution) — Completed
- Overall status: Phase 5 fully implemented and verified with 54 backend tests passing
- Last updated: Phase 5 completion

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
  - `TestGenerator` (`backend/app/ai/test_generator.py`): AST-guided unit test generator using Gemini API for Python (`pytest`) and JavaScript (`vitest`/`jest`).
  - Test Schemas (`backend/app/ai/test_schema.py`): `GeneratedTestFile`, `TestCaseResult`, `TestCoverageSummary`, `TestExecutionResult`, `JobTestResults`.
  - Docker Execution Sandbox (`backend/app/runners/docker_runner.py`): Ephemeral Docker runner enforcing `--network none`, 512MB RAM cap, 1.0 CPU cap, 30s execution timeout, and automatic container destruction. Safe fallback when Docker daemon is unavailable.
  - Pytest & Coverage Parsers (`backend/app/runners/python_runner.py`, `js_runner.py`): Parses test execution stdout/stderr and real line coverage (`coverage.json`).
  - API Endpoint (`backend/app/api/tests_api.py`): Exposes `GET /api/jobs/{job_id}/tests` with complete error handling (503 missing key, 429 quota, 504 timeout, 502 service error).
  - Backend Test Suite (`backend/app/tests/test_test_gen.py`, `test_docker_runner.py`): 10 new unit tests (54 backend tests passing total).
  - Frontend UI (`frontend/src/components/TestResultsView.tsx`): Integrated under `Generated Tests` tab, featuring line coverage percentage badge, test pass/fail counters, Monaco-styled code viewer with copy button, individual test case breakdown, and Docker terminal execution log output.

## In Progress
- None (Phase 5 completed, ready for Phase 6).

## Next Task
Phase 6 — Coverage & Bounded Retries:
1. Target >60% line coverage on benchmark scripts.
2. Uncovered line ranges extraction from `coverage.json`.
3. Secondary targeted test generation prompt targeting missing lines.
4. Bounded retry loop (max 2 retries) to elevate coverage.

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
- [ ] >60% benchmark coverage achieved (Phase 6)
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
