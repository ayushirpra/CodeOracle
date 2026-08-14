import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  NodeTypes,
  Handle,
  Position,
  NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { GraphData, GraphNode as GNode, GraphEdge as GEdge } from '../services/api';
import { FileCode, AlertTriangle, Search, X } from 'lucide-react';

// --- Custom Language Colors ---
const langColor: Record<string, { text: string; bg: string; border: string }> = {
  python: {
    text: '#38BDF8',
    bg: 'rgba(56, 189, 248, 0.12)',
    border: 'rgba(56, 189, 248, 0.3)',
  },
  javascript: {
    text: '#FBBF24',
    bg: 'rgba(251, 191, 36, 0.12)',
    border: 'rgba(251, 191, 36, 0.3)',
  },
};

function FileNode({ data }: NodeProps) {
  const styling = langColor[data.language] || {
    text: '#94A3B8',
    bg: 'rgba(148, 163, 184, 0.12)',
    border: 'rgba(148, 163, 184, 0.25)',
  };
  const isSelected = data.selected;

  return (
    <div
      style={{
        borderColor: isSelected ? '#38BDF8' : 'rgba(255, 255, 255, 0.1)',
        boxShadow: isSelected
          ? '0 0 20px rgba(56, 189, 248, 0.3)'
          : '0 4px 16px rgba(0, 0, 0, 0.4)',
      }}
      className="bg-[#0D121F]/90 backdrop-blur-md border rounded-xl px-4 py-3 min-w-[160px] max-w-[220px] cursor-pointer transition-all duration-200 hover:border-white/[0.2]"
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#38BDF8', width: 6, height: 6, border: 'none' }}
      />
      <div className="flex items-center gap-2 mb-2">
        <FileCode size={14} style={{ color: styling.text }} className="shrink-0" />
        <span className="text-xs font-semibold text-white truncate font-mono leading-tight">
          {data.label}
        </span>
        {data.has_parse_error && (
          <AlertTriangle size={12} className="text-amber-400 shrink-0 ml-auto" />
        )}
      </div>
      <div className="flex items-center gap-2">
        <span
          style={{ background: styling.bg, color: styling.text, borderColor: styling.border }}
          className="text-[9px] rounded-md px-1.5 py-0.5 font-mono font-bold uppercase tracking-wider border"
        >
          {data.language}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">{data.total_lines}L</span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#38BDF8', width: 6, height: 6, border: 'none' }}
      />
    </div>
  );
}

const nodeTypes: NodeTypes = { file: FileNode };

// --- Layout Helpers ---
function layoutNodes(gnodes: GNode[], gedges: GEdge[]): Node[] {
  const idSet = new Set(gnodes.map((n) => n.id));
  const depCount: Record<string, number> = {};
  gnodes.forEach((n) => {
    depCount[n.id] = 0;
  });
  gedges.forEach((e) => {
    if (idSet.has(e.target)) depCount[e.target] = (depCount[e.target] || 0) + 1;
  });

  const levels: Record<string, number> = {};
  const queue = gnodes.filter((n) => depCount[n.id] === 0).map((n) => n.id);
  queue.forEach((id) => {
    levels[id] = 0;
  });

  let i = 0;
  while (i < queue.length) {
    const curr = queue[i++];
    const outEdges = gedges.filter((e) => e.source === curr);
    outEdges.forEach((e) => {
      if (idSet.has(e.target)) {
        levels[e.target] = Math.max(levels[e.target] || 0, (levels[curr] || 0) + 1);
        queue.push(e.target);
      }
    });
  }
  gnodes.forEach((n) => {
    if (!(n.id in levels)) levels[n.id] = 0;
  });

  const byLevel: Record<number, string[]> = {};
  Object.entries(levels).forEach(([id, lv]) => {
    byLevel[lv] = byLevel[lv] || [];
    byLevel[lv].push(id);
  });

  const NODE_W = 250,
    NODE_H = 110;
  const positions: Record<string, { x: number; y: number }> = {};
  Object.entries(byLevel).forEach(([lvStr, ids]) => {
    const lv = Number(lvStr);
    ids.forEach((id, idx) => {
      positions[id] = { x: lv * NODE_W, y: idx * NODE_H };
    });
  });

  return gnodes.map((gn) => ({
    id: gn.id,
    type: 'file',
    position: positions[gn.id] || { x: 0, y: 0 },
    data: { ...gn, selected: false },
  }));
}

function toRFEdges(gedges: GEdge[]): Edge[] {
  return gedges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: e.is_relative,
    style: { stroke: 'rgba(56, 189, 248, 0.35)', strokeWidth: 1.5 },
    labelStyle: { fill: '#CBD5E1', fontSize: 10, fontFamily: 'ui-monospace' },
    labelBgStyle: {
      fill: 'rgba(15, 23, 42, 0.92)',
      stroke: 'rgba(255, 255, 255, 0.12)',
      strokeWidth: 1,
      rx: 6,
      ry: 6,
    },
    labelBgPadding: [6, 4] as [number, number],
    label: e.module.length < 20 ? e.module : `…${e.module.slice(-15)}`,
  }));
}

// --- Node Detail Inspector Modal ---
function NodeDetail({
  node,
  graphData,
  onClose,
}: {
  node: GNode;
  graphData: GraphData;
  onClose: () => void;
}) {
  const deps = graphData.dependencies_map[node.id] || [];
  const dependents = graphData.dependents_map[node.id] || [];

  return (
    <div className="w-80 bg-[#0E1422]/95 backdrop-blur-xl rounded-2xl border border-white/[0.14] shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <FileCode size={14} className="text-sky-400 shrink-0" />
          <span className="text-xs font-bold text-white font-mono truncate">{node.label}</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>
      <div className="px-4 py-3 space-y-3 overflow-y-auto max-h-80 text-xs font-mono text-slate-300">
        <div className="grid grid-cols-2 gap-y-2 text-[11px]">
          {[
            ['Path', node.path],
            ['Language', node.language],
            ['Lines', node.total_lines],
            ['Functions', node.num_functions],
            ['Classes', node.num_classes],
            ['Imports', node.num_imports],
            ['Exports', node.num_exports],
          ].map(([k, v]) => (
            <React.Fragment key={String(k)}>
              <span className="text-slate-500">{k}</span>
              <span className="text-slate-200 truncate">{String(v)}</span>
            </React.Fragment>
          ))}
        </div>
        {node.has_parse_error && (
          <div className="flex items-center gap-1.5 text-amber-400 bg-amber-950/40 border border-amber-800/40 rounded-lg p-2 text-[11px]">
            <AlertTriangle size={12} /> Parse warning in file
          </div>
        )}
        <Section title="Imports / Dependencies" items={deps} />
        <Section title="Imported by (Dependents)" items={dependents} />
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="pt-2 border-t border-white/[0.06]">
      <div className="text-slate-400 text-[11px] font-semibold mb-1">
        {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <div className="text-slate-600 text-[10px] italic">None</div>
      ) : (
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i} className="text-sky-400 text-[11px] truncate">
              {i}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Main DependencyGraph Component ---
interface DependencyGraphProps {
  graphData: GraphData;
}

export default function DependencyGraph({ graphData }: DependencyGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<GNode | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setNodes(layoutNodes(graphData.nodes, graphData.edges));
    setEdges(toRFEdges(graphData.edges));
    setSelectedNode(null);
  }, [graphData]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const gnode = graphData.nodes.find((n) => n.id === node.id);
      setSelectedNode(gnode || null);
    },
    [graphData]
  );

  const filteredIds = search
    ? new Set(
        graphData.nodes
          .filter(
            (n) =>
              n.path.toLowerCase().includes(search.toLowerCase()) ||
              n.language.toLowerCase().includes(search.toLowerCase())
          )
          .map((n) => n.id)
      )
    : null;

  const displayedNodes = nodes.map((n) => ({
    ...n,
    style: filteredIds && !filteredIds.has(n.id) ? { opacity: 0.15 } : undefined,
  }));

  return (
    <div className="relative w-full h-full flex">
      {/* Search Filter Overlay */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="flex items-center bg-[#0E1422]/90 backdrop-blur-md border border-white/[0.1] rounded-xl px-3 py-1.5 gap-2 shadow-lg">
          <Search size={13} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter nodes..."
            className="bg-transparent text-xs text-slate-200 outline-none w-36 placeholder:text-slate-500 font-mono"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400 hover:text-white">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={displayedNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.2}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(255, 255, 255, 0.04)" gap={20} size={1} />
          <Controls
            showInteractive={false}
            className="!bg-[#0E1422]/90 !backdrop-blur-md !border-white/[0.1] !rounded-xl !shadow-xl overflow-hidden [&>button]:!bg-transparent [&>button]:!border-b [&>button]:!border-white/[0.08] [&>button]:!fill-slate-300 hover:[&>button]:!bg-white/[0.08]"
          />
        </ReactFlow>
      </div>

      {/* Node Detail Popup */}
      {selectedNode && (
        <div className="absolute top-3 right-3 z-10">
          <NodeDetail
            node={selectedNode}
            graphData={graphData}
            onClose={() => setSelectedNode(null)}
          />
        </div>
      )}
    </div>
  );
}
