import React, { useState, useEffect } from 'react';
import {
  fetchJobRefactor,
  ProjectRefactorProposal,
  RefactoredFile,
  BreakingChangeWarning,
} from '../services/api';
import {
  Layers,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileCode,
  Sparkles,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  Info,
  RefreshCw,
} from 'lucide-react';

interface RefactorViewProps {
  jobId: string;
}

type DiffMode = 'split' | 'unified';

// ─── Severity Badge ──────────────────────────────────────────────────────────
function SeverityBadge({ severity }: { severity: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const styles = {
    HIGH: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
    MEDIUM: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
    LOW: 'bg-sky-950/60 text-sky-300 border-sky-800/60',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${styles[severity]} uppercase tracking-wide font-mono`}>
      {severity}
    </span>
  );
}

// ─── Breaking Change Card ─────────────────────────────────────────────────────
function BreakingChangeCard({ warning }: { warning: BreakingChangeWarning }) {
  const [expanded, setExpanded] = useState(false);
  const icons = {
    HIGH: <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />,
    MEDIUM: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
    LOW: <Info className="w-4 h-4 text-sky-400 shrink-0" />,
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden border border-white/[0.08]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.04] transition text-left gap-3"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {icons[warning.severity]}
          <SeverityBadge severity={warning.severity} />
          <code className="text-xs text-cyan-300 font-mono font-semibold truncate">
            {warning.symbol}
          </code>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-3 border-t border-white/[0.06] bg-black/40">
          <p className="text-xs text-slate-300 leading-relaxed">{warning.description}</p>
          {(warning.original_signature || warning.proposed_signature) && (
            <div className="space-y-2 font-mono text-[11px]">
              {warning.original_signature && (
                <div className="p-2.5 bg-rose-950/20 border border-rose-900/30 rounded-xl">
                  <span className="text-[10px] text-rose-400 block uppercase font-bold mb-1">
                    Previous Signature
                  </span>
                  <code className="text-rose-200">{warning.original_signature}</code>
                </div>
              )}
              {warning.proposed_signature && (
                <div className="p-2.5 bg-emerald-950/20 border border-emerald-900/30 rounded-xl">
                  <span className="text-[10px] text-emerald-400 block uppercase font-bold mb-1">
                    Refactored Signature
                  </span>
                  <code className="text-emerald-200">{warning.proposed_signature}</code>
                </div>
              )}
            </div>
          )}
          {warning.migration_hint && (
            <div className="flex items-start gap-2 p-3 bg-indigo-950/30 border border-indigo-800/40 rounded-xl">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-200 leading-relaxed">{warning.migration_hint}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Diff Viewer ──────────────────────────────────────────────────────────────
function DiffViewer({ file, mode }: { file: RefactoredFile; mode: DiffMode }) {
  const [copied, setCopied] = useState(false);

  const copyCode = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (mode === 'unified') {
    const lines = file.unified_diff.split('\n');
    return (
      <div className="bg-black/50 rounded-2xl overflow-hidden border border-white/[0.08] font-mono text-xs leading-relaxed flex flex-col min-h-0">
        <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.08] flex items-center justify-between">
          <span className="text-slate-300 text-xs font-medium">Unified Diff</span>
          <button
            onClick={() => copyCode(file.proposed_code)}
            className="flex items-center gap-1.5 px-3 py-1 glass-card hover:bg-white/[0.08] text-slate-200 rounded-lg text-xs transition border border-white/[0.08]"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Proposed'}</span>
          </button>
        </div>
        <div className="overflow-auto p-4 flex-1">
          {lines.map((line, idx) => {
            let cls = 'text-slate-400';
            if (line.startsWith('+') && !line.startsWith('+++'))
              cls = 'text-emerald-300 bg-emerald-950/30';
            if (line.startsWith('-') && !line.startsWith('---'))
              cls = 'text-rose-300 bg-rose-950/30';
            if (line.startsWith('@@')) cls = 'text-cyan-300 bg-cyan-950/20';
            return (
              <div key={idx} className={`px-3 py-0.5 rounded font-mono ${cls} whitespace-pre`}>
                {line || ' '}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Split mode
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
      {/* Original */}
      <div className="bg-black/50 rounded-2xl border border-white/[0.08] overflow-hidden flex flex-col min-h-0">
        <div className="px-4 py-2.5 bg-rose-950/30 border-b border-rose-900/40 flex items-center justify-between">
          <span className="text-xs font-semibold text-rose-300 uppercase tracking-wider">
            Original Code
          </span>
        </div>
        <pre className="p-4 text-xs font-mono text-slate-300 overflow-auto flex-1 leading-relaxed">
          <code>{file.original_code}</code>
        </pre>
      </div>

      {/* Proposed */}
      <div className="bg-black/50 rounded-2xl border border-white/[0.08] overflow-hidden flex flex-col min-h-0">
        <div className="px-4 py-2.5 bg-emerald-950/30 border-b border-emerald-900/40 flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
            Proposed Refactoring
          </span>
          <button
            onClick={() => copyCode(file.proposed_code)}
            className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 rounded-lg text-[11px] font-semibold transition"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
        <pre className="p-4 text-xs font-mono text-emerald-200 overflow-auto flex-1 leading-relaxed">
          <code>{file.proposed_code}</code>
        </pre>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const RefactorView: React.FC<RefactorViewProps> = ({ jobId }) => {
  const [data, setData] = useState<ProjectRefactorProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diffMode, setDiffMode] = useState<DiffMode>('split');
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);

  const loadRefactor = () => {
    setLoading(true);
    setError(null);
    fetchJobRefactor(jobId)
      .then(setData)
      .catch((err: any) => setError(err?.message || 'Failed to generate refactoring proposals.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRefactor();
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl glass-panel border border-violet-500/30 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-violet-400 animate-spin" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-white">Drafting Modern Refactoring Proposals</h3>
          <p className="text-xs text-slate-400 font-mono">
            Gemini is modernizing idioms, adding types, and evaluating AST breaking changes...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-800/60 flex items-center justify-center text-rose-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-sm font-semibold text-white">Refactoring Analysis Failed</h3>
          <p className="text-xs text-slate-400 leading-relaxed font-mono">{error}</p>
        </div>
        <button
          onClick={loadRefactor}
          className="px-4 py-2 glass-card hover:bg-white/[0.08] text-slate-200 text-xs font-semibold rounded-xl transition-colors border border-white/[0.1] flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Try Again</span>
        </button>
      </div>
    );
  }

  if (!data || data.files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center space-y-2 text-slate-400">
        <Layers className="w-8 h-8 opacity-30" />
        <p className="text-sm font-mono">No refactorable source files found in this project.</p>
      </div>
    );
  }

  const selectedFile = data.files[selectedFileIdx];

  return (
    <div className="h-full flex flex-col p-6 space-y-4 max-w-6xl mx-auto overflow-y-auto min-h-0">
      {/* ─── Header Summary Row ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel rounded-2xl p-4 sm:p-5 border border-white/[0.08] shrink-0">
        <div>
          <h3 className="text-sm font-bold text-white">
            Code Modernization & Refactoring ({data.total_files_refactored} file{data.total_files_refactored !== 1 ? 's' : ''})
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            {data.total_warnings} total warnings detected ·{' '}
            <span className="text-rose-400 font-semibold">{data.high_warnings} High</span> ·{' '}
            <span className="text-amber-400 font-semibold">{data.medium_warnings} Medium</span> ·{' '}
            <span className="text-sky-400 font-semibold">{data.low_warnings} Low</span>
          </p>
        </div>

        {/* Diff Mode Toggle */}
        <div className="flex items-center bg-black/40 rounded-xl p-0.5 border border-white/[0.06]">
          {(['split', 'unified'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setDiffMode(m)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition capitalize ${
                diffMode === m
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m} View
            </button>
          ))}
        </div>
      </div>

      {/* ─── Main Grid Layout ─────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 glass-panel rounded-2xl overflow-hidden border border-white/[0.08] min-h-0">
        {/* Sidebar File List */}
        <div className="md:col-span-1 border-r border-white/[0.08] bg-black/20 flex flex-col min-h-0">
          <div className="p-3.5 border-b border-white/[0.08]">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Refactored Files
            </span>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {data.files.map((file, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedFileIdx(idx)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-mono transition flex items-center justify-between gap-2 ${
                  selectedFileIdx === idx
                    ? 'bg-violet-950/60 text-violet-300 border border-violet-800/60 font-semibold'
                    : 'text-slate-300 hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileCode className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <span className="truncate">{file.file_path.split('/').pop()}</span>
                </div>
                {file.high_count > 0 ? (
                  <span className="text-[9px] text-rose-300 bg-rose-950/60 border border-rose-800/50 px-1.5 py-0.5 rounded font-bold shrink-0">
                    {file.high_count} HIGH
                  </span>
                ) : (
                  <span className="text-[9px] text-emerald-400 font-bold shrink-0">SAFE</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Diff & Warnings View */}
        <div className="md:col-span-3 flex flex-col p-5 bg-black/40 overflow-y-auto space-y-4 min-h-0">
          {selectedFile && (
            <>
              {/* Summary Banner */}
              <div className="p-4 glass-card rounded-xl flex items-start gap-3 border border-white/[0.08]">
                <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300 leading-relaxed font-mono">
                  {selectedFile.refactor_summary}
                </p>
              </div>

              {/* Diff Container */}
              <div className="flex-1 min-h-[260px] flex flex-col">
                <DiffViewer file={selectedFile} mode={diffMode} />
              </div>

              {/* Breaking Changes Warnings */}
              <div className="space-y-2.5 pt-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>Breaking Change Impact ({selectedFile.breaking_changes.length})</span>
                </h4>

                {selectedFile.breaking_changes.length > 0 ? (
                  <div className="space-y-2">
                    {selectedFile.breaking_changes.map((w, idx) => (
                      <BreakingChangeCard key={idx} warning={w} />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 p-4 bg-emerald-950/20 border border-emerald-800/30 rounded-xl text-xs text-emerald-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>No breaking changes detected — proposal preserves existing signatures and caller compatibility.</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RefactorView;
