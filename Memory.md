# CodeOracle — AI Coding Memory

This file is the coding agent's source of truth. Update it after every completed phase.

## Current Status
- Phase: 7 (Safe Code Refactoring & Breaking Change Warnings) — Completed
- Overall status: Phase 7 fully implemented and verified with 79 backend tests passing
- Last updated: Phase 7 completion

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
- **Phase 7 Safe Code Refactoring & Breaking Change Warnings Implemented**:
  - `schema.py` (`backend/app/refactor/`): `BreakingChangeWarning`, `RefactoredFile`, `ProjectRefactorProposal` Pydantic models.
  - `prompts.py` (`backend/app/refactor/`): AST-guided Gemini prompts for Python (type hints, f-strings, pathlib, async/await) and JavaScript (ES2022+, arrow functions, optional chaining).
  - `breaking_changes.py` (`backend/app/refactor/`): Static AST comparator detecting removed functions/classes (HIGH), added required parameters (HIGH), parameter removals (HIGH), removed imports (MEDIUM), added imports (LOW). JS regex-based export removal detection.
  - `engine.py` (`backend/app/refactor/`): `RefactorEngine` orchestrator — calls Gemini per file, computes `difflib.unified_diff`, runs breaking change detector, generates plain-English summaries. Capped at 5 files per project.
  - `refactor_api.py` (`backend/app/api/`): `GET /api/jobs/{job_id}/refactor` with full AI error handling and caching.
  - Backend Test Suite (`backend/app/tests/test_refactor.py`): 21 new unit tests across breaking change detection, unified diff, code extraction, engine integration, and API router (79 backend tests passing total).
  - Frontend UI (`frontend/src/components/RefactorView.tsx`): File sidebar navigator, split/unified diff viewer toggle, severity-badged breaking change cards (HIGH/MEDIUM/LOW) with collapsible details, migration hints, and before/after signature comparison.

## In Progress
- None (Phase 7 completed, ready for Phase 8).

## Next Task
Phase 8 — Deployment & Final Polish:
1. Render deployment configuration (backend + frontend).
2. Environment variable documentation.
3. Final end-to-end smoke test on deployed instance.

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
- [x] Refactoring works (Phase 7)
- [x] Breaking-change warnings work (Phase 7)
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
