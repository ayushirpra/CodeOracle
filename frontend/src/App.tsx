import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchHealth, HealthResponse,
  uploadZip, ingestGitHub,
  fetchJobGraph, fetchJobExplanation,
  JobResponse, GraphData, ProjectExplanation,
} from './services/api';
import DependencyGraph from './components/DependencyGraph';
import ExplanationView from './components/ExplanationView';
import {
  Activity, CheckCircle2, RefreshCw,
  Cpu, Layers, GitBranch, Upload, Link, Network,
  X, AlertTriangle, ChevronRight, Sparkles,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

type AppView = 'landing' | 'processing' | 'results';

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${ok ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
  );
}

function LangBadge({ lang }: { lang: string }) {
  const colors: Record<string, string> = {
    python: 'text-blue-400 bg-blue-950/50 border-blue-800/50',
    javascript: 'text-amber-400 bg-amber-950/50 border-amber-800/50',
  };
  return (
    <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border ${colors[lang] ?? 'text-slate-400 bg-slate-900 border-slate-700'} uppercase tracking-wide`}>
      {lang}
    </span>
  );
}

// ─── Upload / Landing View ────────────────────────────────────────────────────

function LandingView({
  health,
  onUpload,
  onGitHub,
}: {
  health: HealthResponse | null;
  onUpload: (f: File) => void;
  onGitHub: (url: string) => void;
}) {
  const [githubUrl, setGithubUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.zip')) onUpload(file);
  }, [onUpload]);

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 flex flex-col gap-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-bold text-white tracking-tight">
          Understand any legacy codebase in minutes
        </h2>
        <p className="text-slate-400 max-w-xl mx-auto text-sm">
          Upload a ZIP archive or paste a public GitHub URL — CodeOracle analyses Python and JavaScript
          projects, maps dependencies, generates tests, and proposes safe refactors.
        </p>
      </div>

      {/* Input cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* ZIP Drop Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all
            ${dragging ? 'border-cyan-400 bg-cyan-950/20' : 'border-[#1E293B] bg-[#151C2C] hover:border-cyan-700 hover:bg-[#1a2235]'}`}
        >
          <Upload className="h-8 w-8 text-cyan-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-white">Drop ZIP archive here</p>
            <p className="text-xs text-slate-400 mt-1">or click to browse · max 10,000 source lines</p>
          </div>
          <div className="flex gap-2">
            <LangBadge lang="python" />
            <LangBadge lang="javascript" />
          </div>
          <input ref={fileRef} type="file" accept=".zip" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
        </div>

        {/* GitHub URL */}
        <div className="flex flex-col gap-3 p-6 rounded-xl border border-[#1E293B] bg-[#151C2C]">
          <div className="flex items-center gap-2 text-slate-300">
            <GitBranch className="h-5 w-5 text-indigo-400" />
            <span className="text-sm font-medium">Public GitHub Repository</span>
          </div>
          <input
            type="url"
            value={githubUrl}
            onChange={e => setGithubUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && githubUrl && onGitHub(githubUrl)}
            placeholder="https://github.com/owner/repository"
            className="bg-[#0B0F19] border border-[#2A364F] rounded-lg px-3 py-2.5 text-sm font-mono text-slate-200
              placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            onClick={() => githubUrl && onGitHub(githubUrl)}
            disabled={!githubUrl}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40
              text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            <Link className="h-4 w-4" /> Analyse Repository
          </button>
          <p className="text-xs text-slate-500">Public repositories only · no login required</p>
        </div>
      </div>

      {/* Backend status */}
      <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-mono">
        <StatusDot ok={!!health} />
        <span>Backend {health ? 'connected' : 'disconnected'} · /api/health</span>
      </div>
    </main>
  );
}

// ─── Processing View ──────────────────────────────────────────────────────────

function ProcessingView({ source }: { source: string }) {
  const stages = ['Ingest', 'Analyse', 'Explain', 'Test', 'Refactor'];
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
      <div className="text-center space-y-2">
        <div className="h-12 w-12 mx-auto rounded-full bg-cyan-950/40 border border-cyan-800/50 flex items-center justify-center">
          <RefreshCw className="h-6 w-6 text-cyan-400 animate-spin" />
        </div>
        <h2 className="text-xl font-semibold text-white">Analysing project…</h2>
        <p className="text-sm text-slate-400 font-mono truncate max-w-md">{source}</p>
      </div>
      <div className="flex items-center gap-2">
        {stages.map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
              <span className="text-[10px] text-slate-400 font-mono">{s}</span>
            </div>
            {i < stages.length - 1 && <ChevronRight className="h-3 w-3 text-slate-600 mb-3" />}
          </React.Fragment>
        ))}
      </div>
    </main>
  );
}

// ─── Results View ─────────────────────────────────────────────────────────────

function ResultsView({
  job,
  graphData,
  explanation,
  explanationLoading,
  explanationError,
  onLoadExplanation,
  onReset,
}: {
  job: JobResponse;
  graphData: GraphData | null;
  explanation: ProjectExplanation | null;
  explanationLoading: boolean;
  explanationError: string | null;
  onLoadExplanation: () => void;
  onReset: () => void;
}) {
  const stats = job.stats;
  const [activeTab, setActiveTab] = useState<'graph' | 'explanation' | 'tests' | 'refactor'>('graph');
  const tabs = [
    { id: 'graph', label: 'Dependency Graph', icon: Network },
    { id: 'explanation', label: 'Explanation', icon: Sparkles },
    { id: 'tests', label: 'Generated Tests', icon: CheckCircle2 },
    { id: 'refactor', label: 'Refactored Code', icon: Activity },
  ] as const;

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      {/* Project header bar */}
      <div className="px-6 py-3 bg-[#151C2C] border-b border-[#1E293B] flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <span className="text-sm font-semibold text-white font-mono truncate">
            {job.source_info}
          </span>
          <div className="flex gap-2 flex-shrink-0">
            {stats?.languages.map(l => <LangBadge key={l} lang={l} />)}
          </div>
          {stats && (
            <div className="flex gap-4 text-xs font-mono text-slate-400 flex-shrink-0">
              <span>{stats.total_files} files</span>
              <span>{stats.total_lines.toLocaleString()} lines</span>
            </div>
          )}
        </div>
        <button onClick={onReset}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-[#1E293B] hover:border-[#2A364F] rounded-lg px-3 py-1.5 transition-colors flex-shrink-0">
          <X className="h-3.5 w-3.5" /> New Project
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[#1E293B] px-4 flex-shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors
              ${activeTab === tab.id
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'graph' && (
          graphData ? (
            <DependencyGraph graphData={graphData} />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              Building dependency graph…
            </div>
          )
        )}
        {activeTab === 'explanation' && (
          <ExplanationView
            explanation={explanation}
            loading={explanationLoading}
            error={explanationError}
            onLoad={onLoadExplanation}
          />
        )}
        {activeTab === 'tests' && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
            <Layers className="h-8 w-8 opacity-40" />
            <p className="text-sm">Test Generation — coming in Phase 5</p>
          </div>
        )}
        {activeTab === 'refactor' && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
            <Layers className="h-8 w-8 opacity-40" />
            <p className="text-sm">Refactoring — coming in Phase 7</p>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [view, setView] = useState<AppView>('landing');
  const [processingSource, setProcessingSource] = useState('');
  const [currentJob, setCurrentJob] = useState<JobResponse | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [explanation, setExplanation] = useState<ProjectExplanation | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => null);
  }, []);

  async function handleUpload(file: File) {
    setError(null);
    setView('processing');
    setProcessingSource(file.name);
    try {
      const job = await uploadZip(file);
      setCurrentJob(job);
      const graph = await fetchJobGraph(job.job_id);
      setGraphData(graph);
      setView('results');
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setView('landing');
    }
  }

  async function handleGitHub(url: string) {
    setError(null);
    setView('processing');
    setProcessingSource(url);
    try {
      const job = await ingestGitHub(url);
      setCurrentJob(job);
      const graph = await fetchJobGraph(job.job_id);
      setGraphData(graph);
      setView('results');
    } catch (err: any) {
      setError(err.message || 'GitHub ingestion failed');
      setView('landing');
    }
  }

  async function handleLoadExplanation() {
    if (!currentJob) return;
    setExplanationLoading(true);
    setExplanationError(null);
    try {
      const data = await fetchJobExplanation(currentJob.job_id);
      setExplanation(data);
    } catch (err: any) {
      setExplanationError(err.message || 'Failed to generate explanation');
    } finally {
      setExplanationLoading(false);
    }
  }

  function reset() {
    setView('landing');
    setCurrentJob(null);
    setGraphData(null);
    setExplanation(null);
    setExplanationLoading(false);
    setExplanationError(null);
    setError(null);
  }

  return (
    <div className="h-screen flex flex-col bg-[#0B0F19] text-slate-100 font-sans overflow-hidden">
      {/* Header */}
      <header className="border-b border-[#1E293B] bg-[#151C2C]/90 backdrop-blur px-6 py-3 flex-shrink-0 flex items-center justify-between z-50">
        <button onClick={reset} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Cpu className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-base font-bold text-white font-mono tracking-tight">CodeOracle</span>
            <p className="text-[10px] text-slate-400 leading-none mt-0.5">Legacy Codebase Intelligence</p>
          </div>
        </button>

        <div className="flex items-center gap-3">
          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/50 rounded-lg px-3 py-1.5 max-w-xs truncate">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
            </div>
          )}
          <div className="flex items-center gap-2 bg-[#0B0F19] px-3 py-1.5 rounded-lg border border-[#1E293B] text-xs font-mono">
            <StatusDot ok={!!health} />
            <span className="text-slate-300">{health ? 'Connected' : 'Backend offline'}</span>
          </div>
        </div>
      </header>

      {/* Body */}
      {view === 'landing' && <LandingView health={health} onUpload={handleUpload} onGitHub={handleGitHub} />}
      {view === 'processing' && <ProcessingView source={processingSource} />}
      {view === 'results' && currentJob && (
        <ResultsView
          job={currentJob}
          graphData={graphData}
          explanation={explanation}
          explanationLoading={explanationLoading}
          explanationError={explanationError}
          onLoadExplanation={handleLoadExplanation}
          onReset={reset}
        />
      )}

      {/* Footer */}
      {view === 'landing' && (
        <footer className="border-t border-[#1E293B] py-3 px-6 text-center text-xs text-slate-500 font-mono flex-shrink-0">
          CodeOracle © 2026 · Python & JavaScript Static Analysis · Render Deployment
        </footer>
      )}
    </div>
  );
};

export default App;
