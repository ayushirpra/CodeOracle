import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchHealth, HealthResponse,
  uploadZip, ingestGitHub,
  fetchJobGraph, fetchJobExplanation,
  JobResponse, GraphData, ProjectExplanation,
} from './services/api';
import OverviewView from './components/OverviewView';
import ExplanationView from './components/ExplanationView';
import TestResultsView from './components/TestResultsView';
import RefactorView from './components/RefactorView';
import {
  LayoutDashboard,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  GitBranch,
  Upload,
  Link2,
  Cpu,
  Plus,
  AlertTriangle,
  ArrowRight,
  SearchCode
} from 'lucide-react';

type AppStage = 'landing' | 'processing' | 'results';
type ResultTab = 'overview' | 'explanation' | 'tests' | 'refactor';

// ─── Status Indicator ───────────────────────────────────────────────────────
function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-card text-[11px] font-mono text-slate-400">
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
      <span>{connected ? 'Engine Active' : 'Connecting...'}</span>
    </div>
  );
}

// ─── Home / Landing View ────────────────────────────────────────────────────
function LandingView({
  health,
  onUpload,
  onGitHub,
}: {
  health: HealthResponse | null;
  onUpload: (f: File) => void;
  onGitHub: (url: string) => void;
}) {
  const [activeMode, setActiveMode] = useState<'zip' | 'github'>('zip');
  const [githubUrl, setGithubUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.zip')) {
      setSelectedFile(file);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = () => {
    if (activeMode === 'zip' && selectedFile) {
      onUpload(selectedFile);
    } else if (activeMode === 'github' && githubUrl.trim()) {
      onGitHub(githubUrl.trim());
    }
  };

  return (
    <main className="flex-1 overflow-y-auto min-h-0 w-full px-6 py-10 flex flex-col items-center">
      <div className="max-w-5xl w-full flex flex-col justify-center gap-10 my-auto py-4">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full glass-card border border-cyan-500/20 text-cyan-400 text-xs font-mono tracking-wide">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Next-Gen Static & AI Code Intelligence</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Understand. Test. Modernize.
        </h1>

        <p className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto font-normal">
          CodeOracle parses AST contracts, maps module dependencies, generates full unit tests, and drafts safe refactorings for legacy Python & JavaScript codebases.
        </p>
      </div>

      {/* Unified Ingestion Glass Card */}
      <div className="max-w-2xl w-full mx-auto glass-panel rounded-2xl p-6 sm:p-8 shadow-glass border border-white/[0.08] relative overflow-hidden">
        {/* Ambient Card Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Ingestion Mode Toggle */}
        <div className="flex items-center p-1 bg-black/40 rounded-xl border border-white/[0.06] mb-6">
          <button
            onClick={() => setActiveMode('zip')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeMode === 'zip'
                ? 'bg-white/[0.08] text-white shadow-sm border border-white/[0.08]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload ZIP Archive</span>
          </button>
          <button
            onClick={() => setActiveMode('github')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeMode === 'github'
                ? 'bg-white/[0.08] text-white shadow-sm border border-white/[0.08]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>Public GitHub Repo</span>
          </button>
        </div>

        {/* Mode Content */}
        {activeMode === 'zip' ? (
          <div className="space-y-5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`group flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
                dragging
                  ? 'border-cyan-400 bg-cyan-500/[0.06]'
                  : selectedFile
                  ? 'border-cyan-500/50 bg-cyan-950/20'
                  : 'border-white/[0.1] bg-black/30 hover:border-white/[0.2] hover:bg-white/[0.02]'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-105 transition-transform">
                <Upload className="w-6 h-6" />
              </div>

              {selectedFile ? (
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-white font-mono">{selectedFile.name}</p>
                  <p className="text-xs text-cyan-400 font-mono">
                    {(selectedFile.size / 1024).toFixed(1)} KB · Ready to analyze
                  </p>
                </div>
              ) : (
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-white">
                    Drop your project ZIP here, or <span className="text-cyan-400 underline underline-offset-2">browse</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Supports Python & JavaScript repos up to 10,000 lines
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Repository URL
              </label>
              <div className="relative">
                <Link2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && githubUrl && handleSubmit()}
                  placeholder="https://github.com/owner/repository"
                  className="w-full glass-input rounded-xl pl-10 pr-4 py-3 text-xs font-mono text-slate-200 placeholder:text-slate-500 outline-none transition-colors"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              No credentials or access tokens required for public repositories.
            </p>
          </div>
        )}

        {/* Primary Action Button */}
        <button
          onClick={handleSubmit}
          disabled={activeMode === 'zip' ? !selectedFile : !githubUrl.trim()}
          className="w-full mt-6 flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-30 disabled:pointer-events-none text-white font-semibold text-sm transition-all duration-200 shadow-glow-cyan"
        >
          <span>Analyze Project</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Footer Note */}
        <div className="mt-4 flex items-center justify-between text-[11px] font-mono text-slate-500 pt-3 border-t border-white/[0.06]">
          <span>Max 10,000 source lines</span>
          <StatusBadge connected={!!health} />
        </div>
      </div>

      {/* 3-Step Visual Process */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto w-full">
        <div className="glass-card rounded-xl p-5 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <SearchCode className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-white">1. Static AST Analysis</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Parses classes, function signatures, and builds an exact module dependency graph.
          </p>
        </div>

        <div className="glass-card rounded-xl p-5 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-white">2. AI Architecture Map</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Generates executive architectural summaries, entry points, and symbol explanations.
          </p>
        </div>

        <div className="glass-card rounded-xl p-5 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-white">3. Tests & Refactoring</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Generates full test suites and drafts safe, AST-verified modernization refactorings.
          </p>
        </div>
      </div>
      </div>
    </main>
  );
}

// ─── Processing View ────────────────────────────────────────────────────────
function ProcessingView({ source }: { source: string }) {
  const [step, setStep] = useState(0);
  const steps = [
    'Parsing project files & extracting AST structures',
    'Analyzing function signatures & module dependencies',
    'Generating architectural graph',
    'Finalizing intelligence dashboard',
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => (s < steps.length - 1 ? s + 1 : s));
    }, 1200);
    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <main className="flex-1 overflow-y-auto min-h-0 flex flex-col items-center justify-center gap-6 px-6 max-w-md mx-auto py-8">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl glass-panel flex items-center justify-center border border-cyan-500/30">
          <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin" />
        </div>
        <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full -z-10" />
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-lg font-bold text-white tracking-tight">Analyzing Codebase</h2>
        <p className="text-xs font-mono text-cyan-400 truncate max-w-xs mx-auto">
          {source}
        </p>
        <p className="text-xs text-slate-400 font-mono pt-1">
          {steps[step]}...
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden border border-white/[0.06]">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
          style={{ width: `${((step + 1) / steps.length) * 100}%` }}
        />
      </div>
    </main>
  );
}

// ─── Results Dashboard View ─────────────────────────────────────────────────
function ResultsView({
  job,
  graphData,
  explanation,
  explanationLoading,
  explanationError,
  onLoadExplanation,
}: {
  job: JobResponse;
  graphData: GraphData | null;
  explanation: ProjectExplanation | null;
  explanationLoading: boolean;
  explanationError: string | null;
  onLoadExplanation: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ResultTab>('overview');

  const navTabs = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'explanation' as const, label: 'Explain', icon: Sparkles },
    { id: 'tests' as const, label: 'Tests', icon: ShieldCheck },
    { id: 'refactor' as const, label: 'Refactor', icon: RefreshCw },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Subheader Navigation Bar */}
      <div className="border-b border-white/[0.08] glass-panel px-6 flex items-center justify-between shrink-0">
        {/* Navigation Tabs */}
        <nav className="flex space-x-1" aria-label="Tabs">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all duration-150 ${
                  isActive
                    ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Project Meta Info */}
        <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-slate-400">
          <span className="truncate max-w-[220px] text-slate-200 font-medium">{job.source_info}</span>
          <span className="text-slate-600">·</span>
          <span>{job.stats?.total_files ?? 0} files</span>
          <span className="text-slate-600">·</span>
          <span>{(job.stats?.total_lines ?? 0).toLocaleString()} lines</span>
        </div>
      </div>

      {/* Main Tab View */}
      <div className="flex-1 overflow-y-auto relative min-h-0">
        {activeTab === 'overview' && (
          <OverviewView
            job={job}
            graphData={graphData}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}
        {activeTab === 'explanation' && (
          <ExplanationView
            explanation={explanation}
            loading={explanationLoading}
            error={explanationError}
            onLoad={onLoadExplanation}
          />
        )}
        {activeTab === 'tests' && <TestResultsView jobId={job.job_id} />}
        {activeTab === 'refactor' && <RefactorView jobId={job.job_id} />}
      </div>
    </div>
  );
}

// ─── Root App Component ─────────────────────────────────────────────────────
export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [stage, setStage] = useState<AppStage>('landing');
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
    setStage('processing');
    setProcessingSource(file.name);
    try {
      const job = await uploadZip(file);
      setCurrentJob(job);
      const graph = await fetchJobGraph(job.job_id);
      setGraphData(graph);
      setStage('results');
    } catch (err: any) {
      setError(err.message || 'Project upload and analysis failed');
      setStage('landing');
    }
  }

  async function handleGitHub(url: string) {
    setError(null);
    setStage('processing');
    setProcessingSource(url);
    try {
      const job = await ingestGitHub(url);
      setCurrentJob(job);
      const graph = await fetchJobGraph(job.job_id);
      setGraphData(graph);
      setStage('results');
    } catch (err: any) {
      setError(err.message || 'GitHub ingestion and analysis failed');
      setStage('landing');
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
      setExplanationError(err.message || 'Failed to generate codebase explanation');
    } finally {
      setExplanationLoading(false);
    }
  }

  function handleReset() {
    setStage('landing');
    setCurrentJob(null);
    setGraphData(null);
    setExplanation(null);
    setExplanationLoading(false);
    setExplanationError(null);
    setError(null);
  }

  return (
    <div className="h-screen flex flex-col bg-ambient text-slate-100 font-sans overflow-hidden">
      {/* Global Minimal Glass Navbar */}
      <header className="border-b border-white/[0.08] glass-panel px-6 py-3 shrink-0 flex items-center justify-between z-50">
        <button
          onClick={handleReset}
          className="flex items-center gap-3 hover:opacity-90 transition-opacity text-left group"
        >
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-glow-cyan">
            <Cpu className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-base font-bold text-white font-mono tracking-tight block leading-none">
              CodeOracle
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Codebase Intelligence
            </span>
          </div>
        </button>

        <div className="flex items-center gap-3">
          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-950/60 border border-rose-800/60 rounded-xl px-3 py-1.5 max-w-sm truncate">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span className="truncate">{error}</span>
            </div>
          )}

          {stage === 'results' && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 glass-card hover:bg-white/[0.08] border border-white/[0.1] rounded-xl px-3.5 py-1.5 transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span>New Project</span>
            </button>
          )}
        </div>
      </header>

      {/* Body Flow */}
      {stage === 'landing' && (
        <LandingView health={health} onUpload={handleUpload} onGitHub={handleGitHub} />
      )}

      {stage === 'processing' && <ProcessingView source={processingSource} />}

      {stage === 'results' && currentJob && (
        <ResultsView
          job={currentJob}
          graphData={graphData}
          explanation={explanation}
          explanationLoading={explanationLoading}
          explanationError={explanationError}
          onLoadExplanation={handleLoadExplanation}
        />
      )}
    </div>
  );
};

export default App;
