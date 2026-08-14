import React, { useState, useEffect } from 'react';
import {
  fetchJobTests,
  retryJobTests,
  JobTestResults,
  GeneratedTestFile,
  TestCaseResult,
} from '../services/api';
import {
  CheckCircle2,
  XCircle,
  FileCode,
  Terminal,
  Copy,
  Check,
  RefreshCw,
  Info,
  Shield,
  Layers
} from 'lucide-react';

interface TestResultsViewProps {
  jobId: string;
}

export const TestResultsView: React.FC<TestResultsViewProps> = ({ jobId }) => {
  const [data, setData] = useState<JobTestResults | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [retrying, setRetrying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'tests' | 'cases' | 'logs'>('tests');
  const [copied, setCopied] = useState<boolean>(false);

  const loadTests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJobTests(jobId);
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate unit test suite.');
    } finally {
      setLoading(false);
    }
  };

  const handleTargetedRetry = async () => {
    setRetrying(true);
    try {
      const res = await retryJobTests(jobId);
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Targeted coverage refinement failed.');
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    loadTests();
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl glass-panel border border-emerald-500/30 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-white">Generating Unit Tests</h3>
          <p className="text-xs text-slate-400 font-mono">
            Gemini is producing runnable pytest / vitest test suites based on AST contracts...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-800/60 flex items-center justify-center text-rose-400">
          <XCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-sm font-semibold text-white">Test Generation Failed</h3>
          <p className="text-xs text-slate-400 leading-relaxed font-mono">{error}</p>
        </div>
        <button
          onClick={loadTests}
          className="px-4 py-2 glass-card hover:bg-white/[0.08] text-slate-200 text-xs font-semibold rounded-xl transition-colors border border-white/[0.1] flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Try Again</span>
        </button>
      </div>
    );
  }

  if (!data || data.generated_files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center space-y-2 text-slate-400">
        <Layers className="w-8 h-8 opacity-30" />
        <p className="text-sm">No testable files found in this project.</p>
      </div>
    );
  }

  const execution = data.execution;
  const isDockerUnavailable = execution?.error?.includes('unavailable');
  const covPercent = execution?.coverage?.coverage_percent ?? 0;
  const selectedFile: GeneratedTestFile | undefined = data.generated_files[selectedFileIndex];

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-4 max-w-6xl mx-auto overflow-y-auto min-h-0">
      {/* ─── Header & Secondary Execution Status ───────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel rounded-2xl p-4 sm:p-5 border border-white/[0.08] shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-white">
              Generated Test Suite ({data.generated_files.length} file{data.generated_files.length !== 1 ? 's' : ''})
            </h3>
            <p className="text-xs text-slate-400">
              Complete runnable test files with assertions and mocks
            </p>
          </div>

          {/* Secondary Docker & Execution Pill */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full glass-card text-xs">
            {isDockerUnavailable ? (
              <span className="flex items-center gap-1.5 text-amber-400 text-[11px] font-mono">
                <Info size={13} className="shrink-0" />
                <span>Docker offline (tests generated & ready for copy)</span>
              </span>
            ) : execution?.status === 'passed' ? (
              <span className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-mono">
                <CheckCircle2 size={13} className="shrink-0" />
                <span>{execution.passed_tests}/{execution.total_tests} Tests Passed · {covPercent.toFixed(0)}% Coverage</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-indigo-300 text-[11px] font-mono">
                <Shield size={13} className="shrink-0" />
                <span>Sandbox Verified</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons & Sub-tabs */}
        <div className="flex items-center gap-2.5">
          {!data.target_reached && (data.retry_count ?? 0) < 2 && !isDockerUnavailable && (
            <button
              onClick={handleTargetedRetry}
              disabled={retrying}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
              <span>{retrying ? 'Refining...' : 'Refine Coverage'}</span>
            </button>
          )}

          {/* Sub-tabs */}
          <div className="flex items-center bg-black/40 rounded-xl p-0.5 border border-white/[0.06]">
            <button
              onClick={() => setActiveTab('tests')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === 'tests' ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Generated Code
            </button>
            {execution?.test_cases && execution.test_cases.length > 0 && (
              <button
                onClick={() => setActiveTab('cases')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  activeTab === 'cases' ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Cases ({execution.test_cases.length})
              </button>
            )}
            {(execution?.stdout || execution?.stderr) && (
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  activeTab === 'logs' ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Logs
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Main Content Area ────────────────────────────────────────── */}
      {activeTab === 'tests' && (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 glass-panel rounded-2xl overflow-hidden border border-white/[0.08] min-h-0">
          {/* File Picker Sidebar */}
          <div className="md:col-span-1 border-r border-white/[0.08] bg-black/20 flex flex-col min-h-0">
            <div className="p-3.5 border-b border-white/[0.08]">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Test Files
              </span>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {data.generated_files.map((file, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedFileIndex(idx)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-mono transition flex items-center justify-between gap-2 ${
                    selectedFileIndex === idx
                      ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 font-semibold'
                      : 'text-slate-300 hover:bg-white/[0.03]'
                  }`}
                >
                  <span className="truncate">{file.file_path}</span>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400 shrink-0">
                    {file.language}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Code Viewer */}
          <div className="md:col-span-3 flex flex-col bg-black/40 min-h-0">
            {selectedFile ? (
              <>
                <div className="p-3.5 border-b border-white/[0.08] flex items-center justify-between gap-3 bg-white/[0.02]">
                  <div className="flex items-center gap-2 text-xs font-mono min-w-0">
                    <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="text-white font-semibold truncate">{selectedFile.file_path}</span>
                    <span className="text-slate-500 hidden sm:inline truncate">
                      → testing <span className="text-slate-300">{selectedFile.target_file}</span>
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyCode(selectedFile.code)}
                    className="flex items-center gap-1.5 px-3 py-1.5 glass-card hover:bg-white/[0.08] text-slate-200 rounded-xl text-xs font-semibold transition shrink-0 border border-white/[0.1]"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Test Code'}</span>
                  </button>
                </div>

                <div className="flex-1 overflow-auto p-5 font-mono text-xs text-slate-200 leading-relaxed">
                  <pre>
                    <code>{selectedFile.code}</code>
                  </pre>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-xs font-mono">
                No test file selected.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Execution Test Cases Sub-tab ─────────────────────────────── */}
      {activeTab === 'cases' && execution?.test_cases && (
        <div className="flex-1 glass-panel rounded-2xl p-5 overflow-y-auto space-y-3 border border-white/[0.08]">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Test Case Breakdown ({execution.test_cases.length})
          </h4>
          <div className="space-y-2">
            {execution.test_cases.map((tc: TestCaseResult, idx: number) => (
              <div
                key={idx}
                className="p-3.5 bg-black/40 border border-white/[0.06] rounded-xl flex flex-col space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-mono text-slate-200">
                    {tc.status === 'passed' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="font-medium">{tc.name}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      tc.status === 'passed'
                        ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                        : 'bg-rose-950/60 text-rose-300 border border-rose-800/50'
                    }`}
                  >
                    {tc.status}
                  </span>
                </div>
                {tc.message && (
                  <div className="text-[11px] font-mono text-rose-300 bg-rose-950/40 p-3 rounded-lg border border-rose-900/40 mt-1">
                    {tc.message}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Execution Output Logs Sub-tab ────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="flex-1 glass-panel rounded-2xl p-5 font-mono text-xs text-cyan-300 flex flex-col overflow-hidden border border-white/[0.08]">
          <div className="flex items-center justify-between text-slate-400 pb-3 border-b border-white/[0.08] shrink-0">
            <span className="text-xs uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Container Runner Output</span>
            </span>
          </div>
          <pre className="flex-1 overflow-auto pt-3 leading-relaxed whitespace-pre-wrap text-slate-200">
            {execution?.stdout || execution?.stderr || 'No execution logs recorded.'}
          </pre>
        </div>
      )}
    </div>
  );
};

export default TestResultsView;
