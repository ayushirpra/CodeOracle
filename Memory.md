# CodeOracle — AI Coding Memory

This file is the coding agent's source of truth. Update it after every completed phase.

## Current Status
- Phase: 8 (Deployment & Production Readiness Audit) — Completed
- Overall status: Production blockers resolved; Render deploy config, Docker sandbox script, backend requirements, and CORS/env vars fully verified. 79 backend tests passing.
- Last updated: Phase 8 production audit completion

## Completed
- Final product scope defined.
- Final architecture defined.
- Final engineering rules defined.
- Final implementation phases defined.
- Final design system defined.
- **Phase 0 Foundation Implemented**: React+Vite+TS frontend, FastAPI backend, health endpoint, Render config.
- **Phase 1 Project Ingestion Implemented**: ZIP upload (with Zip Slip protection), public GitHub download, file scanning, 10,000 line limit, job workspace management.
- **Phase 2 Language Adapters Implemented**: `LanguageAdapter` abstract contract, `PythonAdapter` (ast), `JavaScriptAdapter` (regex-AST), `AdapterRegistry`, normalized `ProjectAnalysis` schema, integrated into API pipeline.
- **Phase 3 Dependency Graph Implemented**: `GraphNode`/`GraphEdge`/`DependencyGraph` schema, `GraphBuilder`, `GET /api/jobs/{job_id}/graph`, `reactflow` UI.
- **Phase 4 Gemini Explanation Engine Implemented**: `GeminiProvider` abstraction, `ExplanationEngine` & `ContextBuilder`, `GET /api/jobs/{job_id}/explain`, `ExplanationView`.
- **Phase 5 Test Suite Generation & Execution Implemented**: `TestGenerator`, `docker_runner` isolated sandbox (`--network none`), pytest & coverage parsers, `GET /api/jobs/{job_id}/tests`, `TestResultsView`.
- **Phase 6 Coverage Analysis & Bounded Retries Implemented**: `uncovered_lines_by_file` extraction from `coverage.json`, targeted prompts, bounded retry refinement loop (max 2 retries), coverage progression trends, `POST /api/jobs/{job_id}/retry-tests`.
- **Phase 7 Safe Code Refactoring & Breaking Change Warnings Implemented**: AST static comparator (`breaking_changes.py`), Gemini prompts (`prompts.py`), `RefactorEngine` orchestrator, `GET /api/jobs/{job_id}/refactor`, `RefactorView` split/unified diff & warning cards.
- **Phase 8 Production Readiness Audit & Deployment Fixes Implemented**:
  - `backend/requirements.txt`: Added `google-genai>=0.1.0`.
  - `render.yaml`: Configured `VITE_API_BASE_URL` (`https://codeoracle-backend.onrender.com`) for static frontend build and set `ALLOWED_ORIGINS` for production CORS.
  - `Dockerfile`: Updated `CMD` to shell form (`sh -c uvicorn ... --port ${PORT:-8000}`).
  - `backend/app/runners/docker_runner.py`: Fixed `--network none` pipe flaw using offline-capable coverage/pytest execution script while preserving strict Docker fail-safe security rule (no unsandboxed execution).
  - `backend/app/jobs/manager.py`: Implemented 1-hour job workspace TTL garbage collection (`cleanup_expired_jobs`).

## In Progress
- Ready for deployment to Render.

## Next Task
1. Commit and push repository changes to GitHub.
2. Deploy to Render via `render.yaml`.
3. Perform live end-to-end smoke testing.

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
