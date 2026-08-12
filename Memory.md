# CodeOracle — AI Coding Memory

This file is the coding agent's source of truth. Update it after every completed phase.

## Current Status
- Phase: 0 (Foundation) — Completed
- Overall status: Phase 0 verified and complete
- Last updated: Phase 0 foundation setup

## Completed
- Final product scope defined.
- Final architecture defined.
- Final engineering rules defined.
- Final implementation phases defined.
- Final design system defined.
- **Phase 0 Foundation Implemented**:
  - React + Vite + TypeScript + Tailwind CSS frontend (`frontend/`).
  - FastAPI backend with CORS middleware & config (`backend/`).
  - REST Health endpoint `/api/health` returning system status, phase, and timestamp.
  - API service layer in frontend (`src/services/api.ts`) connecting to backend health endpoint.
  - Futuristic dark UI matching `Design.md` specification.
  - Render blueprint (`render.yaml`) and Docker container configuration (`Dockerfile`).
  - Monorepo layout with module package initializers for future phases.

## In Progress
- None (Phase 0 completed, awaiting instruction for Phase 1).

## Next Task
Phase 1 — Ingestion:
1. ZIP upload handling & path traversal safety validation.
2. Public GitHub URL downloader.
3. Ignore rules (`.git`, `node_modules`, `.venv`, build artifacts).
4. Language detection & 10,000-line source validation.
5. Temporary job creation & storage management.

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
- [ ] ZIP upload works
- [ ] Public GitHub ingestion works
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
