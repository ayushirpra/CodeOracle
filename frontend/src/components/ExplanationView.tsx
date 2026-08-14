import React, { useState } from 'react';
import { ProjectExplanation, FileExplanation, SymbolExplanation } from '../services/api';
import { AlertTriangle, CheckCircle2, FileCode, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';

// ─── Markdown-like renderer for Gemini text output ───────────────────────────
// Renders bold (**text**), headings (### text), and bullet lists cleanly.
function GeminiText({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    // Heading: ### or **Heading**
    if (/^#{1,3}\s/.test(line)) {
      const content = line.replace(/^#{1,3}\s/, '');
      elements.push(
        <p key={i} className="text-slate-200 font-semibold text-sm mt-3 mb-1">
          {renderInline(content)}
        </p>
      );
      continue;
    }

    // Bullet
    if (/^\s*[-*]\s/.test(line)) {
      elements.push(
        <li key={i} className="ml-4 text-slate-300 text-xs list-disc">
          {renderInline(line.replace(/^\s*[-*]\s/, ''))}
        </li>
      );
      continue;
    }

    // Numbered list
    if (/^\s*\d+\.\s/.test(line)) {
      elements.push(
        <li key={i} className="ml-4 text-slate-300 text-xs list-decimal">
          {renderInline(line.replace(/^\s*\d+\.\s/, ''))}
        </li>
      );
      continue;
    }

    elements.push(
      <p key={i} className="text-slate-300 text-xs leading-relaxed">
        {renderInline(line)}
      </p>
    );
  }

  return <div className={`space-y-0.5 ${className}`}>{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="text-slate-100 font-semibold">{part}</strong>
      : <span key={i}>{part}</span>
  );
}

// ─── Symbol card ─────────────────────────────────────────────────────────────
function SymbolCard({ sym }: { sym: SymbolExplanation }) {
  const [open, setOpen] = useState(false);
  const typeColor = sym.symbol_type === 'class'
    ? 'text-indigo-400 bg-indigo-950/40 border-indigo-800/40'
    : 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40';

  return (
    <div className="border border-[#1E293B] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2 bg-[#0D1420] hover:bg-[#0f1928] transition-colors text-left"
      >
        {open ? <ChevronDown size={13} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={13} className="text-slate-400 flex-shrink-0" />}
        <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${typeColor} uppercase flex-shrink-0`}>
          {sym.symbol_type}
        </span>
        <span className="text-xs text-slate-200 font-mono font-medium truncate">{sym.name}</span>
        <span className="text-[10px] text-slate-500 font-mono ml-auto flex-shrink-0">
          L{sym.start_line}–{sym.end_line}
        </span>
      </button>

      {open && (
        <div className="px-4 py-3 bg-[#0B0F19] space-y-3 border-t border-[#1E293B]">
          {sym.summary ? (
            <GeminiText text={sym.summary} />
          ) : sym.uncertainty ? (
            <p className="text-xs text-amber-400 italic">{sym.uncertainty}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── File card ───────────────────────────────────────────────────────────────
function FileCard({ fe }: { fe: FileExplanation }) {
  const [open, setOpen] = useState(false);
  const hasError = !!fe.error;

  return (
    <div className={`border rounded-xl overflow-hidden ${hasError ? 'border-rose-800/50' : 'border-[#1E293B]'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-[#151C2C] hover:bg-[#1a2235] transition-colors text-left"
      >
        {open ? <ChevronDown size={14} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />}
        <FileCode size={14} className={fe.language === 'python' ? 'text-blue-400' : 'text-amber-400'} />
        <span className="text-xs text-slate-200 font-mono truncate">{fe.path}</span>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-slate-500 font-mono">{fe.total_lines}L</span>
          {hasError && <AlertCircle size={13} className="text-rose-400" />}
          {fe.symbols.length > 0 && (
            <span className="text-[10px] text-slate-500 font-mono">{fe.symbols.length} symbols</span>
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 py-3 bg-[#0B0F19] space-y-4 border-t border-[#1E293B]">
          {hasError ? (
            <div className="flex items-start gap-2 text-rose-300 text-xs bg-rose-950/30 border border-rose-800/40 rounded-lg p-3">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
              <span>{fe.error}</span>
            </div>
          ) : (
            <GeminiText text={fe.summary} />
          )}

          {fe.symbols.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">Symbols</p>
              <div className="space-y-1.5">
                {fe.symbols.map(sym => <SymbolCard key={sym.name} sym={sym} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ExplanationView ────────────────────────────────────────────────────
interface ExplanationViewProps {
  explanation: ProjectExplanation | null;
  loading: boolean;
  error: string | null;
  onLoad: () => void;
}

export default function ExplanationView({ explanation, loading, error, onLoad }: ExplanationViewProps) {
  // Auto-trigger on first render if nothing loaded yet
  React.useEffect(() => {
    if (!explanation && !loading && !error) {
      onLoad();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-2 border-cyan-800 border-t-cyan-400 animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-slate-200">Generating explanation…</p>
          <p className="text-xs text-slate-500 font-mono">Gemini is reading your codebase in parallel</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="flex items-start gap-3 text-rose-300 bg-rose-950/30 border border-rose-800/50 rounded-xl px-5 py-4 max-w-md text-sm">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">Explanation failed</p>
            <p className="text-xs text-rose-400/80">{error}</p>
          </div>
        </div>
        <button
          onClick={onLoad}
          className="text-xs text-slate-400 hover:text-white border border-[#1E293B] hover:border-[#2A364F] px-4 py-2 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!explanation) return null;

  // Extract top-level bullets from overview for executive summary
  const overviewLines = explanation.overview.split('\n').filter(l => l.trim());
  const bulletLines = overviewLines.filter(l => /^[-*•]|\d+\./.test(l.trim())).slice(0, 3);
  const summaryBullets = bulletLines.length > 0 ? bulletLines : overviewLines.slice(0, 3);

  return (
    <div className="h-full overflow-y-auto px-5 py-4 space-y-5">
      {/* Partial warning */}
      {explanation.partial && (
        <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-950/20 border border-amber-800/40 rounded-lg px-3 py-2">
          <AlertTriangle size={13} />
          Some files could not be explained — results are partial.
        </div>
      )}

      {/* Executive Summary Banner */}
      <div className="bg-gradient-to-br from-[#0f1928] to-[#151C2C] border border-cyan-800/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 size={15} className="text-cyan-400" />
          <span className="text-sm font-semibold text-white">Architecture Overview</span>
          <span className="ml-auto text-[10px] font-mono text-slate-500">
            {explanation.total_files} files · {explanation.total_lines.toLocaleString()} lines · {explanation.languages.join(', ')}
          </span>
        </div>

        {/* Key points */}
        <ul className="space-y-1.5">
          {summaryBullets.map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
              <span className="text-cyan-500 mt-0.5 flex-shrink-0">▸</span>
              <span>{line.replace(/^[-*•]\s*|\d+\.\s*/, '').trim()}</span>
            </li>
          ))}
        </ul>

        {explanation.entry_points.length > 0 && (
          <div className="pt-2 border-t border-[#1E293B] flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Entry Points:</span>
            {explanation.entry_points.map(ep => (
              <span key={ep} className="text-[10px] font-mono text-cyan-400 bg-cyan-950/30 border border-cyan-800/40 rounded px-2 py-0.5">
                {ep}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Full Overview — collapsible */}
      <details className="group">
        <summary className="text-xs font-mono text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors select-none">
          Full Gemini Overview ▸
        </summary>
        <div className="mt-3 bg-[#151C2C] border border-[#1E293B] rounded-xl p-4">
          <GeminiText text={explanation.overview} />
        </div>
      </details>

      {/* Per-file explanations */}
      {explanation.files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-wider">
            File Explanations ({explanation.files.length})
          </p>
          {explanation.files.map(fe => (
            <FileCard key={fe.path} fe={fe} />
          ))}
        </div>
      )}
    </div>
  );
}
