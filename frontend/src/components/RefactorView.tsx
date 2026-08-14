import React, { useState, useEffect } from 'react';
import {
  fetchJobRefactor,
  ProjectRefactorProposal,
  RefactoredFile,
  BreakingChangeWarning,
} from '../services/api';
import {
  Layers, AlertTriangle, ChevronDown, ChevronRight,
  FileCode, Sparkles, Copy, Check, ShieldAlert, ShieldCheck, Info,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RefactorViewProps {
  jobId: string;
}

type DiffMode = 'split' | 'unified';

// ─── Severity Badges ──────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const styles = {
    HIGH: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    LOW: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${styles[severity]} uppercase tracking-wide`}>
      {severity}
    </span>
  );
}

// ─── Breaking Change Card ─────────────────────────────────────────────────────

function BreakingChangeCard({ warning }: { warning: BreakingChangeWarning }) {
  const [expanded, setExpanded] = useState(false);
  const icons = {
    HIGH: <ShieldAlert className="w-4 h-4 text-rose-400" />,
    MEDIUM: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    LOW: <Info className="w-4 h-4 text-sky-400" />,
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/40 transition"
      >
        <div className="flex items-center space-x-2 min-w-0">
          {icons[warning.severity]}
          <SeverityBadge severity={warning.severity} />
          <code className="text-xs text-cyan-300 font-mono truncate">{warning.symbol}</code>
        </div>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-slate-800 pt-3">
          <p className="text-xs text-slate-300">{warning.description}</p>
          {(warning.original_signature || warning.proposed_signature) && (
            <div className="space-y-1">
              {warning.original_signature && (
                <div className="flex items-start space-x-2">
                  <span className="text-[10px] text-slate-500 w-16 shrink-0 pt-0.5">Before:</span>
                  <code className="text-[11px] text-rose-300 font-mono bg-rose-950/20 px-2 py-1 rounded block flex-1">
                    {warning.original_signature}
                  </code>
                </div>
              )}
              {warning.proposed_signature && (
                <div className="flex items-start space-x-2">
                  <span className="text-[10px] text-slate-500 w-16 shrink-0 pt-0.5">After:</span>
                  <code className="text-[11px] text-emerald-300 font-mono bg-emerald-950/20 px-2 py-1 rounded block flex-1">
                    {warning.proposed_signature}
                  </code>
                </div>
              )}
            </div>
          )}
          {warning.migration_hint && (
            <div className="flex items-start space-x-2 p-2 bg-slate-800/60 rounded-lg">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-indigo-300">{warning.migration_hint}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Diff Viewer ──────────────────────────────────────────────────────────────

function DiffViewer({ file, mode }: { file: RefactoredFile; mode: DiffMode }) {
  const [copiedOrig, setCopiedOrig] = useState(false);
  const [copiedProp, setCopiedProp] = useState(false);

  const copy = async (text: string, setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    await navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  if (mode === 'unified') {
    const lines = file.unified_diff.split('\n');
    return (
      <div className="bg-[#0B0F19] rounded-lg overflow-hidden border border-slate-800 font-mono text-[11px] leading-relaxed">
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <span className="text-slate-400 text-xs">Unified Diff — {file.file_path}</span>
          <button
            onClick={() => copy(file.unified_diff, setCopiedProp)}
            className="flex items-center space-x-1 text-slate-500 hover:text-slate-200 transition text-[10px]"
          >
            {copiedProp ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedProp ? 'Copied' : 'Copy diff'}</span>
          </button>
        </div>
        <div className="overflow-auto max-h-96 p-2">
          {lines.map((line, idx) => {
            let cls = 'text-slate-400';
            if (line.startsWith('+') && !line.startsWith('+++')) cls = 'text-emerald-400 bg-emerald-950/20';
            if (line.startsWith('-') && !line.startsWith('---')) cls = 'text-rose-400 bg-rose-950/20';
            if (line.startsWith('@@')) cls = 'text-cyan-400 bg-cyan-950/10';
            return (
              <div key={idx} className={`px-3 py-0.5 rounded ${cls} whitespace-pre`}>
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
    <div className="grid grid-cols-2 gap-3">
      {/* Original */}
      <div className="bg-[#0B0F19] rounded-lg border border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-rose-950/20 border-b border-rose-900/30">
          <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-widest">Original</span>
          <button onClick={() => copy(file.original_code, setCopiedOrig)} className="text-slate-500 hover:text-slate-200 transition">
            {copiedOrig ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <pre className="p-4 text-[11px] font-mono text-slate-300 overflow-auto max-h-80 leading-relaxed">
          {file.original_code}
        </pre>
      </div>

      {/* Proposed */}
      <div className="bg-[#0B0F19] rounded-lg border border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-emerald-950/20 border-b border-emerald-900/30">
          <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">Proposed</span>
          <button onClick={() => copy(file.proposed_code, setCopiedProp)} className="text-slate-500 hover:text-slate-200 transition">
            {copiedProp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <pre className="p-4 text-[11px] font-mono text-slate-300 overflow-auto max-h-80 leading-relaxed">
          {file.proposed_code}
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

  useEffect(() => {
    setLoading(true);
    fetchJobRefactor(jobId)
      .then(setData)
      .catch((err: any) => setError(err?.message || 'Failed to generate refactoring proposals.'))
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-indigo-500/20 border-t-indigo-400 animate-spin" />
          <Sparkles className="absolute inset-0 m-auto w-5 h-5 text-indigo-400" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-slate-300">Generating Refactoring Proposals</p>
          <p className="text-xs text-slate-500">Analysing code and computing unified diffs…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
        <AlertTriangle className="w-8 h-8 text-rose-400" />
        <p className="text-sm text-rose-300 font-medium">Refactoring Failed</p>
        <p className="text-xs text-slate-500 max-w-md text-center">{error}</p>
      </div>
    );
  }

  if (!data || data.files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
        <Layers className="w-8 h-8 opacity-30" />
        <p className="text-sm">No refactorable files found in this project.</p>
      </div>
    );
  }

  const selectedFile = data.files[selectedFileIdx];

  return (
    <div className="flex h-full overflow-hidden">
      {/* File sidebar */}
      <aside className="w-60 shrink-0 border-r border-slate-800 bg-[#0D1424] flex flex-col">
        <div className="px-4 py-3 border-b border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Refactored Files</p>
        </div>
        <div className="overflow-y-auto flex-1 py-1">
          {data.files.map((f, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedFileIdx(idx)}
              className={`w-full text-left px-4 py-2.5 transition flex items-start space-x-2 ${
                idx === selectedFileIdx
                  ? 'bg-indigo-600/20 border-l-2 border-indigo-400'
                  : 'hover:bg-slate-800/40 border-l-2 border-transparent'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-mono text-slate-300 truncate">{f.file_path.split('/').pop()}</p>
                {f.high_count > 0 && (
                  <span className="text-[9px] text-rose-400 font-bold">{f.high_count} HIGH</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main panel */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Summary header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-[#0D1424] flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-white">
              {data.total_files_refactored} file{data.total_files_refactored !== 1 ? 's' : ''} modernised
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {data.total_warnings} warning{data.total_warnings !== 1 ? 's' : ''} detected ·
              <span className="text-rose-400"> {data.high_warnings} HIGH</span> ·
              <span className="text-amber-400"> {data.medium_warnings} MEDIUM</span> ·
              <span className="text-sky-400"> {data.low_warnings} LOW</span>
            </p>
          </div>

          {/* Diff mode toggle */}
          <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5">
            {(['split', 'unified'] as const).map(m => (
              <button
                key={m}
                onClick={() => setDiffMode(m)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition capitalize ${
                  diffMode === m
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* File detail */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#0B0F19]">
          {selectedFile && (
            <>
              {/* File summary */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-start space-x-3">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300">{selectedFile.refactor_summary}</p>
              </div>

              {/* Diff */}
              <DiffViewer file={selectedFile} mode={diffMode} />

              {/* Breaking changes */}
              {selectedFile.breaking_changes.length > 0 ? (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-widest flex items-center space-x-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    <span>Breaking Change Warnings ({selectedFile.breaking_changes.length})</span>
                  </h4>
                  <div className="space-y-1.5">
                    {selectedFile.breaking_changes.map((w, idx) => (
                      <BreakingChangeCard key={idx} warning={w} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-2 p-3 bg-emerald-950/20 border border-emerald-800/30 rounded-lg">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-300">No breaking changes detected — safe to apply this refactor.</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default RefactorView;
