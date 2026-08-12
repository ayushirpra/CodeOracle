# CodeOracle — AI Coding Memory

This file is the coding agent's source of truth. Update it after every completed phase.

## Current Status
- Phase: 3 (Dependency Graph) — Completed
- Overall status: Phase 3 fully implemented and verified
- Last updated: Phase 3 completion

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
  - `GraphNode`/`GraphEdge`/`DependencyGraph` schema in `backend/app/graph/schema.py` (separate from language adapter schema).
  - `GraphBuilder` in `backend/app/graph/builder.py`: builds nodes from `FileAnalysis`, builds edges only from statically-proven imports, resolves relative imports across Python (dotted) and JavaScript (`./`, `../`), deduplicates edges, builds `dependents_map` and `dependencies_map`.
  - `GET /api/jobs/{job_id}/graph` endpoint returning full graph data.
  - `reactflow` added to frontend.
  - `DependencyGraph` React component in `frontend/src/components/DependencyGraph.tsx` with custom file nodes, topological layout, zoom/pan, MiniMap, node search/filter, node detail panel showing dependencies, dependents, and file info.
  - `App.tsx` rebuilt as multi-view application: landing with upload zone + GitHub input, processing view, results view with four tabs (Graph active, others pending later phases).
  - All API types added to `frontend/src/services/api.ts`.

## In Progress
- None (Phase 3 completed, awaiting instruction for Phase 4).

## Next Task
Phase 4 — AI Explanation:
1. Gemini API abstraction layer in `backend/app/ai/`.
2. Structured prompts using hierarchical context (repo → module → function, using `ProjectAnalysis` output).
3. Repository, module, and function/class-level explanation endpoints.
4. Preserve file/line references; state uncertainty explicitly.

## Final Technology Decisions
- React + Vite + TypeScript + Tailwind + reactflow
- Monaco Editor (Phase 5+)
- FastAPI + Python
- Gemini API
- Python built-in `ast`; JavaScript regex-AST
- pytest + coverage.py
- Docker sandbox (Phase 5+)
- Render
- Temporary filesystem; no database; no authentication

## Architecture Decisions
- Graph logic is completely separate from language adapters.
- Only statically-proven import relationships produce graph edges.
- No edges are invented for unresolvable external packages.
- Adjacency maps (dependents/dependencies) are pre-computed in the graph.
- Frontend uses topological sort for initial node layout.

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
- [x] Dependency graph works
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
