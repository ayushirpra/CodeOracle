# CodeOracle — AI Coding Memory

This file is the coding agent's source of truth. Update it after every completed phase.

## Current Status
- Phase: 4 (AI Explanation Engine) — Completed
- Overall status: Phase 4 fully implemented and verified
- Last updated: Phase 4 completion

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
  - `GeminiProvider` abstraction layer (`backend/app/ai/provider.py`): Lazy client initialization using `google-genai` SDK, API key read exclusively from server environment (`GEMINI_API_KEY`), handles `AIKeyMissingError`, `AIQuotaError`, `AITimeoutError`, `AIResponseError`, `AIServiceError` with retry logic for 429/500/503.
  - `ExplanationEngine` & `ContextBuilder` (`backend/app/ai/engine.py`, `backend/app/ai/context_builder.py`): Hierarchical context construction (repo overview -> per-file -> per-symbol), bounded prompts (<3,000 chars per file context block, never sends raw source code or entire 10k-line repo at once), structured prompt templates with line references and explicit uncertainty instructions.
  - Explanation Schema (`backend/app/ai/schema.py`): `ProjectExplanation`, `FileExplanation`, `SymbolExplanation`.
  - `GET /api/jobs/{job_id}/explain` API endpoint returning structured project explanations and handling all AI error codes (503 missing key, 429 quota, 504 timeout, 502 service error).
  - Test Suite (`backend/app/tests/test_explain.py`): 24 new tests covering context builder bounds, prompt generation, mocked provider behavior, entry point heuristics, partial failure handling, and API status codes.
  - Frontend UI (`frontend/src/components/ExplanationView.tsx`): Integrated under Explanation tab, features custom markdown-like Gemini renderer, expandable file cards, symbol accordions, entry points list, partial warning banner, and error handling states.

## In Progress
- None (Phase 4 completed, awaiting instruction for Phase 5).

## Next Task
Phase 5 — Test Suite Generation & Execution:
1. Gemini test generation prompt using AST signatures + context.
2. Generate pytest (Python) or Jest/Node test runner code (JavaScript).
3. Docker container execution sandbox for isolation.
4. Execution results API returning pass/fail status and output logs.

## Final Technology Decisions
- React + Vite + TypeScript + Tailwind + reactflow
- Monaco Editor (Phase 5+)
- FastAPI + Python
- Gemini API (`google-genai` SDK)
- Python built-in `ast`; JavaScript regex-AST
- pytest + coverage.py
- Docker sandbox (Phase 5+)
- Render
- Temporary filesystem; no database; no authentication

## Architecture Decisions
- Gemini access is hidden behind `GeminiProvider` abstraction.
- API key is never exposed to the frontend.
- AI engine never receives raw source code or unbounded repo context — receives structured summaries built by `ContextBuilder`.
- Individual file explanation failures do not fail the whole request; partial explanations are returned and flagged.

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
