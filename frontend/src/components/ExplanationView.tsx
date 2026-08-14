import React, { useState } from 'react';
import { ProjectExplanation, FileExplanation, SymbolExplanation } from '../services/api';
import {
  FileCode,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Sparkles,
  Search,
  BookOpen,
  ArrowUpRight,
  Code2
} from 'lucide-react';

// ─── Markdown Parser for Clean AI Output ────────────────────────────────────
function GeminiContent({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    // Headings
    if (/^#{1,3}\s/.test(line)) {
      const content = line.replace(/^#{1,3}\s/, '');
      elements.push(
        <h4 key={i} className="text-white font-bold text-sm mt-4 mb-1.5 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          {renderInline(content)}
        </h4>
      );
      continue;
    }

    // Bullets
    if (/^\s*[-*•]\s/.test(line)) {
      elements.push(
        <li key={i} className="ml-5 text-slate-300 text-xs list-disc leading-relaxed pl-1">
          {renderInline(line.replace(/^\s*[-*•]\s/, ''))}
        </li>
      );
      continue;
    }

    // Numbered lists
    if (/^\s*\d+\.\s/.test(line)) {
      elements.push(
        <li key={i} className="ml-5 text-slate-300 text-xs list-decimal leading-relaxed pl-1">
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

  return <div className={`space-y-1.5 ${className}`}>{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="text-white font-semibold">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

// ─── Symbol Row ─────────────────────────────────────────────────────────────
function SymbolRow({ sym }: { sym: SymbolExplanation }) {
  const [open, setOpen] = useState(false);
  const isClass = sym.symbol_type === 'class';

  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden glass-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/[0.04] transition-colors text-left"
      >
        {open ? (
          <ChevronDown size={13} className="text-slate-400 shrink-0" />
        ) : (
          <ChevronRight size={13} className="text-slate-400 shrink-0" />
        )}
        <span
          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
            isClass
              ? 'text-indigo-300 bg-indigo-950/60 border-indigo-800/50'
              : 'text-emerald-300 bg-emerald-950/60 border-emerald-800/50'
          }`}
        >
          {sym.symbol_type}
        </span>
        <span className="text-xs text-white font-mono font-medium truncate">{sym.name}</span>
        <span className="text-[10px] text-slate-500 font-mono ml-auto shrink-0">
          L{sym.start_line}–{sym.end_line}
        </span>
      </button>

      {open && (
        <div className="px-4 py-3 bg-black/40 space-y-2 border-t border-white/[0.06]">
          {sym.summary ? (
            <GeminiContent text={sym.summary} />
          ) : sym.uncertainty ? (
            <p className="text-xs text-amber-400 italic">{sym.uncertainty}</p>
          ) : null}

          {sym.dependencies && sym.dependencies.length > 0 && (
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono pt-1">
              <span className="text-slate-500">Dependencies:</span>
              <span className="text-cyan-400">{sym.dependencies.join(', ')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── File Section ───────────────────────────────────────────────────────────
function FileArticle({ fe }: { fe: FileExplanation }) {
  const [open, setOpen] = useState(false);
  const hasError = !!fe.error;

  return (
    <div
      className={`border rounded-2xl overflow-hidden transition-all ${
        hasError ? 'border-rose-500/40 bg-rose-950/20' : 'border-white/[0.08] glass-panel'
      }`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-white/[0.03] transition-colors text-left"
      >
        {open ? (
          <ChevronDown size={14} className="text-slate-400 shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-slate-400 shrink-0" />
        )}
        <FileCode
          size={16}
          className={fe.language === 'python' ? 'text-blue-400 shrink-0' : 'text-amber-400 shrink-0'}
        />
        <div className="min-w-0 pr-2">
          <span className="text-xs font-mono font-semibold text-white truncate block">
            {fe.path}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <span className="text-[10px] text-slate-400 font-mono">{fe.total_lines}L</span>
          {hasError && <AlertCircle size={14} className="text-rose-400" />}
          {fe.symbols.length > 0 && (
            <span className="text-[10px] text-slate-300 font-mono px-2 py-0.5 rounded-full bg-white/[0.06]">
              {fe.symbols.length} symbols
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="px-5 py-4 bg-black/40 space-y-4 border-t border-white/[0.06]">
          {hasError ? (
            <div className="flex items-start gap-2 text-rose-300 text-xs bg-rose-950/40 border border-rose-800/50 rounded-xl p-3">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{fe.error}</span>
            </div>
          ) : (
            <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.06]">
              <GeminiContent text={fe.summary} />
            </div>
          )}

          {fe.symbols.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <Code2 size={12} className="text-cyan-400" />
                <span>Symbols & Contracts ({fe.symbols.length})</span>
              </div>
              <div className="space-y-1.5">
                {fe.symbols.map((sym) => (
                  <SymbolRow key={sym.name} sym={sym} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
interface ExplanationViewProps {
  explanation: ProjectExplanation | null;
  loading: boolean;
  error: string | null;
  onLoad: () => void;
}

export default function ExplanationView({
  explanation,
  loading,
  error,
  onLoad,
}: ExplanationViewProps) {
  const [fileFilter, setFileFilter] = useState('');
  const [showFullNarrative, setShowFullNarrative] = useState(false);

  React.useEffect(() => {
    if (!explanation && !loading && !error) {
      onLoad();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl glass-panel border border-cyan-500/30 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-white">Generating Architectural Explanation</h3>
          <p className="text-xs text-slate-400 font-mono">
            Gemini is reading module structures and entry points in parallel...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-800/60 flex items-center justify-center text-rose-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-sm font-semibold text-white">Explanation Generation Failed</h3>
          <p className="text-xs text-slate-400 leading-relaxed font-mono">{error}</p>
        </div>
        <button
          onClick={onLoad}
          className="px-4 py-2 glass-card hover:bg-white/[0.08] text-slate-200 text-xs font-semibold rounded-xl transition-colors border border-white/[0.1]"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!explanation) return null;

  // Extract executive summary bullet lines
  const rawLines = explanation.overview.split('\n').filter((l) => l.trim());
  const bulletLines = rawLines.filter((l) => /^[-*•]|\d+\./.test(l.trim())).slice(0, 4);
  const highlights = bulletLines.length > 0 ? bulletLines : rawLines.slice(0, 3);

  const filteredFiles = explanation.files.filter((f) =>
    f.path.toLowerCase().includes(fileFilter.toLowerCase())
  );

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 max-w-5xl mx-auto">
      {/* ─── Executive Summary Section ─────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-6 sm:p-7 space-y-5 border border-white/[0.08] shadow-glass relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-64 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Executive Architecture Summary
              </h2>
              <span className="text-[11px] font-mono text-slate-400">
                Synthesized from AST static analysis
              </span>
            </div>
          </div>

          <span className="text-xs font-mono text-slate-400">
            {explanation.total_files} files · {explanation.total_lines.toLocaleString()} lines
          </span>
        </div>

        {/* Highlights List */}
        <div className="space-y-2.5 pt-1">
          {highlights.map((line, i) => (
            <div key={i} className="flex items-start gap-3 text-xs text-slate-300 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5"></span>
              <span>{line.replace(/^[-*•]\s*|\d+\.\s*/, '').trim()}</span>
            </div>
          ))}
        </div>

        {/* Entry Points */}
        {explanation.entry_points && explanation.entry_points.length > 0 && (
          <div className="pt-3 border-t border-white/[0.06] flex items-center gap-2.5 flex-wrap text-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Identified Entry Points:
            </span>
            {explanation.entry_points.map((ep) => (
              <span
                key={ep}
                className="font-mono text-[11px] text-cyan-300 bg-cyan-950/40 border border-cyan-800/50 rounded-lg px-2.5 py-0.5 flex items-center gap-1"
              >
                <span>{ep}</span>
                <ArrowUpRight className="w-3 h-3 text-cyan-400 opacity-70" />
              </span>
            ))}
          </div>
        )}

        {/* Full Overview Toggle */}
        <div className="pt-1">
          <button
            onClick={() => setShowFullNarrative(!showFullNarrative)}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1.5 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{showFullNarrative ? 'Collapse Full Architecture Narrative' : 'Read Full Architecture Narrative'}</span>
          </button>
          {showFullNarrative && (
            <div className="mt-4 p-5 bg-black/40 rounded-xl border border-white/[0.08]">
              <GeminiContent text={explanation.overview} />
            </div>
          )}
        </div>
      </div>

      {/* ─── Files Breakdown Section ───────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-white">Module & Symbol Breakdown</h3>
            <p className="text-xs text-slate-400">
              Detailed descriptions of modules and individual AST symbols
            </p>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search files..."
              value={fileFilter}
              onChange={(e) => setFileFilter(e.target.value)}
              className="glass-input rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none w-48 transition-colors font-mono"
            />
          </div>
        </div>

        {filteredFiles.length > 0 ? (
          <div className="space-y-3">
            {filteredFiles.map((fe) => (
              <FileArticle key={fe.path} fe={fe} />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500 glass-panel rounded-2xl border border-white/[0.08] font-mono">
            No matching files found.
          </div>
        )}
      </div>
    </div>
  );
}
