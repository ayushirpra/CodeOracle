# CodeOracle — AI Coding Memory

This file is the coding agent's source of truth. Update it after every completed phase.

## Current Status
- Phase: 2 (Language Adapters) — Completed
- Overall status: Phase 2 pluggable language adapter system verified and complete
- Last updated: Phase 2 completion

## Completed
- Final product scope defined.
- Final architecture defined.
- Final engineering rules defined.
- Final implementation phases defined.
- Final design system defined.
- **Phase 0 Foundation Implemented**:
  - React + Vite + TypeScript + Tailwind CSS frontend (`frontend/`).
  - FastAPI backend with CORS middleware & config (`backend/`).
  - REST Health endpoint `/api/health`.
- **Phase 1 Project Ingestion Implemented**:
  - `POST /api/projects/upload` and `POST /api/projects/github`.
  - Zip Slip security validation and temporary job workspace manager.
  - Source file scanning and 10,000 line limit enforcement.
- **Phase 2 Language Adapters Implemented**:
  - `LanguageAdapter` common abstract base contract (`backend/app/analyzers/base/adapter.py`).
  - Normalized Pydantic analysis schema (`backend/app/analyzers/base/schema.py`) covering imports, exports, classes, functions, parameters, function calls, line numbers, and docstrings.
  - `PythonAdapter` (`backend/app/analyzers/python/adapter.py`) built on Python's built-in `ast` module.
  - `JavaScriptAdapter` (`backend/app/analyzers/javascript/adapter.py`) supporting `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` ESM & CommonJS parsing.
  - `AdapterRegistry` (`backend/app/analyzers/registry.py`) providing dynamic adapter dispatching and whole-project AST analysis aggregation.
  - Pipeline integration in `POST /api/projects/upload` and `POST /api/projects/github`.
  - Comprehensive unit test suite in `backend/app/tests/test_adapters.py` (11/11 tests passing across project test suite).

## In Progress
- None (Phase 2 completed, awaiting instruction for Phase 3).

## Next Task
Phase 3 — Dependency Graph:
1. Construct normalized dependency graph from `ProjectAnalysis` output.
2. Build FastAPI graph API (`GET /api/jobs/{job_id}/graph`).
3. Build React Flow visual dependency graph canvas in frontend with search, zoom, filter, and node details panel.

## Final Technology Decisions
- React + Vite + TypeScript + Tailwind
- Monaco Editor
- React Flow
- FastAPI + Python
- Gemini API
- Python built-in `ast`
- JavaScript Tree-sitter/parser
- NetworkX/normalized graph data
- pytest + coverage.py
- JavaScript-compatible test/coverage tooling
- Docker sandbox
- Render
- Temporary filesystem
- No database
- No authentication
- Public GitHub repositories only

## Architecture Decisions
- Python and JavaScript are initial language adapters.
- Future languages plug into the common adapter interface.
- Static analysis provides factual structure; Gemini interprets it.
- Never send an entire 10k-line repository in one prompt.
- Coverage is measured only from real execution.
- Never execute untrusted code inside FastAPI.
- Original source is never silently overwritten.

## Hackathon Constraints
- Python mandatory.
- JavaScript initial second language.
- ZIP + public GitHub.
- Maximum 10,000 source lines.
- >60% benchmark line coverage target.
- Explanation judged on clarity, accuracy and completeness.
- Refactoring must include safety/breaking-change warnings.
- Render deployment.
- ₹0-first development.

## Explicitly Deferred
Do not add before core requirements work:
- login/signup
- user profiles
- persistent history
- database
- private GitHub support
- Redis/Celery
- Ollama fallback
- extra cloud infrastructure

## Known Issues
None.

## Environment Variables
Never store secret values here. Gemini API key and deployment configuration are environment variables only.

## Verification Checklist
- [x] Frontend runs
- [x] Backend runs
- [x] Frontend reaches backend
- [x] ZIP upload works
- [x] Public GitHub ingestion works
- [x] Python adapter works
- [x] JavaScript adapter works
- [ ] Dependency graph works
- [ ] Gemini explanation works
- [ ] Generated tests work
- [ ] Docker runner works
- [ ] Real coverage works
- [ ] >60% benchmark coverage achieved
- [ ] Refactoring works
- [ ] Breaking-change warnings work
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
