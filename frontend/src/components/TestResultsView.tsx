import React, { useState, useEffect } from 'react';
import { fetchJobTests, retryJobTests, JobTestResults, GeneratedTestFile, TestCaseResult } from '../services/api';
import {
  ShieldCheck, ShieldAlert, CheckCircle2, XCircle,
  FileCode, Terminal, Copy, Check, Play, RefreshCw, Zap
} from 'lucide-react';

interface TestResultsViewProps {
  jobId: string;
}

export const TestResultsView: React.FC<TestResultsViewProps> = ({ jobId }) => {
  const [data, setData] = useState<JobTestResults | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [retrying, setRetrying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'files' | 'cases' | 'terminal'>('files');
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  const loadTests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJobTests(jobId);
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate or execute test suite.');
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
      setError(err?.message || 'Targeted retry refinement failed.');
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    loadTests();
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin"></div>
          <Play className="w-6 h-6 text-cyan-400 absolute inset-0 m-auto" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Generating & Executing Unit Tests</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md">
            Gemini is constructing AST-guided test cases. Tests will run in an isolated Docker sandbox container.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-slate-900/80 border border-red-500/30 rounded-xl space-y-4">
        <div className="flex items-start space-x-3 text-red-400">
          <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-300">Test Generation / Execution Error</h4>
            <p className="text-sm text-slate-300 mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={loadTests}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Execution</span>
        </button>
      </div>
    );
  }

  if (!data) return null;

  const execution = data.execution;
  const covPercent = execution?.coverage?.coverage_percent ?? 0;
  const isHighCoverage = covPercent >= 60;
  const selectedFile: GeneratedTestFile | undefined = data.generated_files[selectedFileIndex];

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* ─── Top Metrics Bar ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Line Coverage Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center space-x-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
              isHighCoverage
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
            }`}
          >
            {covPercent.toFixed(0)}%
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Line Coverage</div>
            <div className="text-sm font-semibold text-slate-200 mt-0.5">
              {execution?.coverage ? (
                <span>{execution.coverage.covered_lines} / {execution.coverage.total_lines} lines</span>
              ) : (
                <span className="text-slate-400">N/A</span>
              )}
            </div>
            {isHighCoverage ? (
              <span className="text-[10px] text-emerald-400 font-medium">✓ Target (&gt;60%) Met</span>
            ) : (
              <span className="text-[10px] text-amber-400 font-medium">Below 60% Target</span>
            )}
          </div>
        </div>

        {/* Total Tests Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center space-x-4">
          <div className="w-12 h-12 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-xl flex items-center justify-center font-bold text-lg">
            {execution?.total_tests ?? data.generated_files.length}
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Generated Tests</div>
            <div className="text-sm font-semibold text-slate-200 mt-0.5">
              {execution?.passed_tests ?? 0} Passed, {execution?.failed_tests ?? 0} Failed
            </div>
            <span className="text-[10px] text-slate-400">across {data.generated_files.length} files</span>
          </div>
        </div>

        {/* Execution Status Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center space-x-4">
          {execution?.status === 'passed' ? (
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          ) : (
            <div className="w-12 h-12 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl flex items-center justify-center">
              <XCircle className="w-6 h-6" />
            </div>
          )}
          <div>
            <div className="text-xs text-slate-400 font-medium">Execution Status</div>
            <div className="text-sm font-semibold text-slate-200 capitalize mt-0.5">
              {execution?.status || 'Unknown'}
            </div>
            <span className="text-[10px] text-slate-400">{execution?.duration_seconds?.toFixed(1) ?? '0'}s runtime</span>
          </div>
        </div>

        {/* Docker Sandbox Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center space-x-4">
          <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Sandbox Environment</div>
            <div className="text-sm font-semibold text-indigo-300 mt-0.5">
              {execution?.error?.includes('unavailable') ? 'Docker Unavailable' : 'Docker Isolated'}
            </div>
            <span className="text-[10px] text-slate-400">Network Disabled (--network none)</span>
          </div>
        </div>
      </div>

      {/* ─── Bounded Coverage Retry Banner ──────────────────────────── */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
        <div className="flex items-center space-x-3 text-xs">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-200 flex items-center space-x-2">
              <span>Coverage Refinement (Retries: {data.retry_count ?? 0}/2)</span>
              {data.target_reached ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Target (&gt;60%) Reached
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Refinement Active
                </span>
              )}
            </div>
            {data.coverage_history && data.coverage_history.length > 0 && (
              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-1 font-mono">
                <span>Coverage Trend:</span>
                {data.coverage_history.map((cov, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <span className="text-slate-600">→</span>}
                    <span className={cov >= 60 ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                      {cov.toFixed(1)}%
                    </span>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>

        {!data.target_reached && (data.retry_count ?? 0) < 2 && (
          <button
            onClick={handleTargetedRetry}
            disabled={retrying}
            className="flex items-center space-x-2 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition shadow-md shadow-cyan-900/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
            <span>{retrying ? 'Generating Targeted Tests...' : 'Run Targeted Retry'}</span>
          </button>
        )}
      </div>

      {/* ─── Tabs Navigation ────────────────────────────────────────── */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('files')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-medium transition ${
            activeTab === 'files'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Generated Test Files ({data.generated_files.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('cases')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-medium transition ${
            activeTab === 'cases'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Test Cases ({execution?.test_cases?.length ?? 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('terminal')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-medium transition ${
            activeTab === 'terminal'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Execution Output Log</span>
        </button>
      </div>

      {/* ─── Tab Content: Generated Test Files ────────────────────── */}
      {activeTab === 'files' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden min-h-[420px]">
          {/* File selector sidebar */}
          <div className="md:col-span-1 border-r border-slate-800 p-3 space-y-1 bg-slate-950/50">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">
              Test Files
            </div>
            {data.generated_files.map((file, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedFileIndex(idx)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition flex items-center justify-between ${
                  selectedFileIndex === idx
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <span className="truncate">{file.file_path}</span>
                <span className="text-[10px] text-slate-500 uppercase ml-1">{file.language}</span>
              </button>
            ))}
          </div>

          {/* Code Viewer */}
          <div className="md:col-span-3 p-4 flex flex-col bg-slate-950">
            {selectedFile ? (
              <>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-2 text-xs font-mono text-slate-300">
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    <span>{selectedFile.file_path}</span>
                    <span className="text-slate-500">→ target: {selectedFile.target_file}</span>
                  </div>
                  <button
                    onClick={() => handleCopyCode(selectedFile.code)}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="flex-1 overflow-x-auto text-xs font-mono text-slate-200 bg-slate-900/60 p-4 rounded-lg leading-relaxed border border-slate-800">
                  <code>{selectedFile.code}</code>
                </pre>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                No test file selected.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Tab Content: Test Cases Breakdown ────────────────────── */}
      {activeTab === 'cases' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Execution Test Cases ({execution?.test_cases?.length ?? 0})
          </h4>
          {execution?.test_cases && execution.test_cases.length > 0 ? (
            <div className="space-y-2">
              {execution.test_cases.map((tc: TestCaseResult, idx: number) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg flex flex-col space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 font-mono text-slate-200 font-medium">
                      {tc.status === 'passed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span>{tc.name}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        tc.status === 'passed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {tc.status}
                    </span>
                  </div>
                  {tc.message && (
                    <div className="text-[11px] font-mono text-rose-300 bg-rose-950/30 p-2 rounded border border-rose-900/40 mt-1">
                      {tc.message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-400 py-6 text-center">
              No detailed test cases captured from runner output. Check the execution output log tab.
            </div>
          )}
        </div>
      )}

      {/* ─── Tab Content: Console Output Log ──────────────────────── */}
      {activeTab === 'terminal' && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-cyan-300 space-y-2">
          <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
            <span className="text-[11px] uppercase tracking-wider">Docker Container Stdout / Stderr</span>
            <span className="text-[10px]">pytest + coverage.py</span>
          </div>
          <pre className="overflow-x-auto max-h-96 leading-relaxed whitespace-pre-wrap text-slate-200">
            {execution?.stdout || execution?.stderr || 'No stdout/stderr captured.'}
          </pre>
        </div>
      )}
    </div>
  );
};
