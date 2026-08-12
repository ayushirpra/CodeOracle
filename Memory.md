# CodeOracle — AI Coding Memory

This file is the coding agent's source of truth. Update it after every completed phase.

## Current Status
- Phase: 1 (Ingestion) — Completed
- Overall status: Phase 1 project ingestion verified and complete
- Last updated: Phase 1 completion

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
  - `POST /api/projects/upload`: Handles ZIP file uploads with Zip Slip path-traversal prevention.
  - `POST /api/projects/github`: Downloads public GitHub repositories via zip codeload / shallow clone.
  - `GET /api/jobs/{job_id}` & `DELETE /api/jobs/{job_id}`: Job state and workspace cleanup endpoints.
  - `ProjectScanner`: Directory scanner enforcing ignore rules (`.git`, `node_modules`, `.venv`, build artifacts, etc.), detecting Python/JS source files, counting non-ignored lines, and enforcing the 10,000 line limit.
  - Custom exceptions (`InvalidZipError`, `PathTraversalError`, `LineLimitExceededError`, `NoSupportedFilesError`, `GitHubRepoError`).
  - Comprehensive unit test suite in `backend/app/tests/test_ingestion.py` (7/7 passed).

## In Progress
- None (Phase 1 completed, awaiting instruction for Phase 2).

## Next Task
Phase 2 — Language Adapters:
1. Define common adapter contract (`detect`, `parse`, `extract_symbols`, `extract_dependencies`, `build_context`, `test_framework`).
2. Implement Python `ast` adapter.
3. Implement JavaScript adapter.
4. Output normalized parsing & dependency schema.

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
- [ ] Python adapter works
- [ ] JavaScript adapter works
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
