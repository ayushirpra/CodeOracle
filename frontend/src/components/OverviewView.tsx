import React, { useState } from 'react';
import { JobResponse, GraphData, FileStats } from '../services/api';
import DependencyGraph from './DependencyGraph';
import {
  FileCode,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Search,
  Network,
  ArrowRight,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface OverviewViewProps {
  job: JobResponse;
  graphData: GraphData | null;
  onNavigateTab: (tab: 'explanation' | 'tests' | 'refactor') => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  job,
  graphData,
  onNavigateTab,
}) => {
  const stats = job.stats;
  const [fileSearch, setFileSearch] = useState('');
  const [expandedGraph, setExpandedGraph] = useState(false);

  const files: FileStats[] = stats?.files || [];
  const filteredFiles = files.filter((f) =>
    f.path.toLowerCase().includes(fileSearch.toLowerCase()) ||
    f.language.toLowerCase().includes(fileSearch.toLowerCase())
  );

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 max-w-6xl mx-auto">
      {/* ─── 1. Strong Project Summary Banner ──────────────────────────── */}
      <div className="glass-panel rounded-2xl p-6 relative overflow-hidden shadow-glass border border-white/[0.08]">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-80 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-cyan-400 font-semibold uppercase tracking-wider">
                Codebase Overview
              </span>
              <span className="text-slate-600">/</span>
              <span className="text-xs text-slate-400 font-mono">AST Verified</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-mono truncate">
              {job.source_info}
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              Static abstract syntax tree analysis completed. Explore the architecture, review generated unit tests, or inspect modern refactorings below.
            </p>
          </div>

          {/* Key Metric Highlights */}
          <div className="flex items-center gap-4 sm:gap-6 pt-2 md:pt-0 shrink-0 border-t md:border-t-0 border-white/[0.06]">
            <div className="space-y-0.5">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Lines</div>
              <div className="text-lg sm:text-xl font-bold font-mono text-white">
                {(stats?.total_lines ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Files</div>
              <div className="text-lg sm:text-xl font-bold font-mono text-white">
                {stats?.total_files ?? 0}
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Stack</div>
              <div className="flex items-center gap-1.5 pt-0.5">
                {stats?.languages && stats.languages.length > 0 ? (
                  stats.languages.map((l) => (
                    <span
                      key={l}
                      className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 uppercase"
                    >
                      {l}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 font-mono">N/A</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. Clean 2-Column Responsive Grid ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Files Explorer) */}
        <div className="lg:col-span-5 glass-panel rounded-2xl flex flex-col overflow-hidden border border-white/[0.08]">
          <div className="p-4 border-b border-white/[0.08] flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Project Files</h3>
              <p className="text-[11px] text-slate-400">
                {filteredFiles.length} of {files.length} source files
              </p>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter files..."
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                className="glass-input rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none w-36 sm:w-44 transition-colors font-mono"
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-[420px] divide-y divide-white/[0.04]">
            {filteredFiles.length > 0 ? (
              filteredFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="px-4 py-2.5 hover:bg-white/[0.03] transition-colors flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <FileCode
                      className={`w-4 h-4 shrink-0 ${
                        file.language === 'python' ? 'text-blue-400' : 'text-amber-400'
                      }`}
                    />
                    <span className="font-mono text-slate-200 truncate">{file.path}</span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 font-mono text-[11px]">
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-400">
                      {file.language}
                    </span>
                    <span className="text-slate-500">{file.lines}L</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">
                No matching files found.
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Actions & Dependency Graph) */}
        <div className="lg:col-span-7 space-y-6 flex flex-col">
          {/* 3 Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Action 1: Explain */}
            <div
              onClick={() => onNavigateTab('explanation')}
              className="group cursor-pointer glass-card rounded-xl p-4 transition-all duration-200 hover:border-cyan-500/40 flex flex-col justify-between"
            >
              <div>
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                  AI Explanation
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Architecture summary & entry points
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-semibold text-cyan-400">
                <span>Explore</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Action 2: Tests */}
            <div
              onClick={() => onNavigateTab('tests')}
              className="group cursor-pointer glass-card rounded-xl p-4 transition-all duration-200 hover:border-emerald-500/40 flex flex-col justify-between"
            >
              <div>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Unit Test Suite
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Generated pytest & vitest files
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-semibold text-emerald-400">
                <span>Review</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Action 3: Refactor */}
            <div
              onClick={() => onNavigateTab('refactor')}
              className="group cursor-pointer glass-card rounded-xl p-4 transition-all duration-200 hover:border-violet-500/40 flex flex-col justify-between"
            >
              <div>
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-3 group-hover:scale-105 transition-transform">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white group-hover:text-violet-300 transition-colors">
                  Safe Refactoring
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Modern idioms & breaking change checks
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-semibold text-violet-400">
                <span>Inspect</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          {/* Dependency Graph Box */}
          <div className="glass-panel rounded-2xl flex-1 flex flex-col overflow-hidden border border-white/[0.08] min-h-[280px]">
            <div className="p-3.5 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-bold text-white">Dependency Map</h4>
                <span className="text-[10px] font-mono text-slate-400">
                  ({graphData?.total_nodes ?? 0} nodes / {graphData?.total_edges ?? 0} edges)
                </span>
              </div>
              <button
                onClick={() => setExpandedGraph(!expandedGraph)}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg glass-card transition-colors"
              >
                {expandedGraph ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                <span>{expandedGraph ? 'Collapse' : 'Expand'}</span>
              </button>
            </div>

            <div className={`flex-1 relative ${expandedGraph ? 'min-h-[460px]' : 'min-h-[220px]'}`}>
              {graphData ? (
                <DependencyGraph graphData={graphData} />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-xs font-mono">
                  Loading dependency graph...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewView;
