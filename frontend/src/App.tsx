import React, { useState, useEffect } from 'react';
import { fetchHealth, HealthResponse } from './services/api';
import { Server, Activity, CheckCircle2, AlertCircle, RefreshCw, Cpu, Layers, FileCode } from 'lucide-react';

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<string>('');

  const checkBackendHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHealth();
      setHealth(data);
      setLastCheck(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkBackendHealth();
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-[#1E293B] bg-[#151C2C]/80 backdrop-blur sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Cpu className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold tracking-tight text-white font-mono">CodeOracle</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono font-medium">
                  Phase 0: Foundation
                </span>
              </div>
              <p className="text-xs text-slate-400">AI-Powered Legacy Codebase Understanding & Modernization</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-[#0B0F19] px-3 py-1.5 rounded-md border border-[#1E293B] text-xs font-mono">
              <span className={`h-2 w-2 rounded-full ${health ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-slate-300">
                Backend: {health ? 'Connected' : error ? 'Disconnected' : 'Checking...'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-8">
        
        {/* Pipeline Bar per Design.md */}
        <section className="bg-[#151C2C] border border-[#1E293B] rounded-xl p-5 shadow-xl">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 font-mono">
            Analysis Pipeline Architecture
          </h2>
          <div className="grid grid-cols-5 gap-3">
            {[
              { stage: 'Ingest', status: 'Pending Phase 1', icon: Layers, active: false },
              { stage: 'Analyze', status: 'Pending Phase 2', icon: FileCode, active: false },
              { stage: 'Explain', status: 'Pending Phase 4', icon: Cpu, active: false },
              { stage: 'Test', status: 'Pending Phase 5', icon: Activity, active: false },
              { stage: 'Refactor', status: 'Pending Phase 7', icon: CheckCircle2, active: false },
            ].map((p, idx) => (
              <div
                key={idx}
                className="bg-[#0B0F19] border border-[#1E293B] p-3.5 rounded-lg flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-mono text-cyan-400">0{idx + 1}. {p.stage}</span>
                  <p.icon className="h-4 w-4 text-slate-500" />
                </div>
                <div className="text-xs text-slate-400 font-mono">{p.status}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Phase 0 Status & Backend Health */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Foundation Health Card */}
          <div className="bg-[#151C2C] border border-[#1E293B] rounded-xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-lg bg-blue-950/60 border border-blue-800/50 text-blue-400">
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Backend System Status</h3>
                    <p className="text-xs text-slate-400">FastAPI REST Server Health Monitor</p>
                  </div>
                </div>
                <button
                  onClick={checkBackendHealth}
                  disabled={loading}
                  className="p-2 rounded-lg bg-[#0B0F19] hover:bg-[#1E293B] border border-[#1E293B] text-slate-300 transition-colors disabled:opacity-50"
                  title="Re-check Connection"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
                </button>
              </div>

              {loading ? (
                <div className="py-8 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <RefreshCw className="h-6 w-6 animate-spin text-cyan-400" />
                  <span className="text-sm font-mono">Pinging FastAPI endpoint...</span>
                </div>
              ) : error ? (
                <div className="bg-rose-950/30 border border-rose-800/50 rounded-lg p-4 text-rose-300 text-sm flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Backend Unreachable</span>
                    <p className="text-xs text-rose-400/80 mt-1">{error}</p>
                    <p className="text-xs text-slate-400 mt-2 font-mono">
                      Target: http://localhost:8000/api/health
                    </p>
                  </div>
                </div>
              ) : health ? (
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between py-2 border-b border-[#1E293B]">
                    <span className="text-slate-400">Status</span>
                    <span className="text-emerald-400 font-semibold uppercase">{health.status}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#1E293B]">
                    <span className="text-slate-400">Application Name</span>
                    <span className="text-slate-200">{health.app}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#1E293B]">
                    <span className="text-slate-400">Environment</span>
                    <span className="text-cyan-400">{health.environment}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#1E293B]">
                    <span className="text-slate-400">Phase</span>
                    <span className="text-indigo-400">Phase {health.phase} (Foundation)</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Server Timestamp</span>
                    <span className="text-slate-300">{new Date(health.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 pt-3 border-t border-[#1E293B] flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Endpoint: /api/health</span>
              <span>Last check: {lastCheck || 'N/A'}</span>
            </div>
          </div>

          {/* Phase 0 System Verification */}
          <div className="bg-[#151C2C] border border-[#1E293B] rounded-xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800/50 text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Phase 0 Foundation Checklist</h3>
                  <p className="text-xs text-slate-400">Verification of stack and contract setup</p>
                </div>
              </div>

              <ul className="space-y-3 text-xs">
                {[
                  { title: 'React + Vite + TypeScript Frontend initialized', done: true },
                  { title: 'Tailwind CSS dark technical theme defined', done: true },
                  { title: 'FastAPI Backend with CORS & environment config', done: true },
                  { title: 'Health REST API endpoint (/api/health)', done: true },
                  { title: 'Frontend ↔ Backend proxy communication verified', done: !!health },
                  { title: 'Render single-deployment setup (render.yaml & Dockerfile)', done: true },
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center space-x-2.5 p-2 rounded bg-[#0B0F19] border border-[#1E293B]">
                    <CheckCircle2 className={`h-4 w-4 ${item.done ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span className={item.done ? 'text-slate-200' : 'text-slate-500'}>{item.title}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 pt-3 border-t border-[#1E293B] text-xs text-slate-400">
              <span>Exit Criteria: Frontend and backend communicate cleanly over HTTP REST.</span>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1E293B] py-4 px-6 text-center text-xs text-slate-400 font-mono">
        CodeOracle © 2026 — Pluggable Multi-Language Codebase Modernization Platform
      </footer>
    </div>
  );
};

export default App;
