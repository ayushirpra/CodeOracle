# CodeOracle

AI-powered legacy codebase analysis, interactive dependency visualization, automated test generation with real execution, and modern refactoring proposals.

## Architecture

- **Frontend**: React + Vite + TypeScript + Tailwind CSS + Monaco Editor + React Flow
- **Backend**: Python FastAPI
- **Analysis**: Built-in AST (Python) & Tree-sitter (JavaScript)
- **AI**: Gemini API
- **Execution & Testing**: Isolated Docker sandbox + `pytest` + `coverage.py`

## Quick Start (Phase 0 Setup)

### Backend Setup
```bash
cd backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to access the CodeOracle developer dashboard.
