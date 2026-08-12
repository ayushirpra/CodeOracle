import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
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

// --- Custom Node Component ---
const langColor: Record<string, string> = {
  python: '#3B82F6',
  javascript: '#F59E0B',
};

function FileNode({ data }: NodeProps) {
  const color = langColor[data.language] || '#6B7280';
  const borderColor = data.selected ? '#06B6D4' : `${color}60`;

  return (
    <div
      style={{ borderColor, boxShadow: data.selected ? `0 0 0 2px #06B6D4` : undefined }}
      className={`bg-[#151C2C] border-2 rounded-lg px-3 py-2.5 min-w-[140px] max-w-[200px] cursor-pointer transition-all`}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#334155', border: 'none' }} />
      <div className="flex items-center gap-2 mb-1.5">
        <FileCode size={13} style={{ color }} className="flex-shrink-0" />
        <span className="text-[11px] font-semibold text-white truncate font-mono leading-tight">
          {data.label}
        </span>
        {data.has_parse_error && <AlertTriangle size={11} className="text-amber-400 flex-shrink-0" />}
      </div>
      <div className="flex flex-wrap gap-1 mt-1">
        <span style={{ background: `${color}20`, color }} className="text-[9px] rounded px-1.5 py-0.5 font-mono font-medium uppercase tracking-wide">
          {data.language}
        </span>
        <span className="text-[9px] text-slate-400 font-mono">{data.total_lines}L</span>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#334155', border: 'none' }} />
    </div>
  );
}

const nodeTypes: NodeTypes = { file: FileNode };

// --- Layout helpers ---
function layoutNodes(gnodes: GNode[], gedges: GEdge[]): Node[] {
  // Assign x/y by building dependency levels (topological sort)
  const idSet = new Set(gnodes.map(n => n.id));
  const depCount: Record<string, number> = {};
  gnodes.forEach(n => { depCount[n.id] = 0; });
  gedges.forEach(e => {
    if (idSet.has(e.target)) depCount[e.target] = (depCount[e.target] || 0) + 1;
  });

  const levels: Record<string, number> = {};
  const queue = gnodes.filter(n => depCount[n.id] === 0).map(n => n.id);
  queue.forEach(id => { levels[id] = 0; });

  let i = 0;
  while (i < queue.length) {
    const curr = queue[i++];
    const outEdges = gedges.filter(e => e.source === curr);
    outEdges.forEach(e => {
      if (idSet.has(e.target)) {
        levels[e.target] = Math.max(levels[e.target] || 0, (levels[curr] || 0) + 1);
        queue.push(e.target);
      }
    });
  }
  gnodes.forEach(n => { if (!(n.id in levels)) levels[n.id] = 0; });

  const byLevel: Record<number, string[]> = {};
  Object.entries(levels).forEach(([id, lv]) => {
    byLevel[lv] = byLevel[lv] || [];
    byLevel[lv].push(id);
  });

  const NODE_W = 220, NODE_H = 100;
  const positions: Record<string, { x: number; y: number }> = {};
  Object.entries(byLevel).forEach(([lvStr, ids]) => {
    const lv = Number(lvStr);
    ids.forEach((id, idx) => {
      positions[id] = { x: lv * NODE_W, y: idx * NODE_H };
    });
  });

  return gnodes.map(gn => ({
    id: gn.id,
    type: 'file',
    position: positions[gn.id] || { x: 0, y: 0 },
    data: { ...gn, selected: false },
  }));
}

function toRFEdges(gedges: GEdge[]): Edge[] {
  return gedges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: e.is_relative,
    style: { stroke: '#334155', strokeWidth: 1.5 },
    labelStyle: { fill: '#64748B', fontSize: 10 },
    label: e.module.length < 20 ? e.module : `…${e.module.slice(-15)}`,
  }));
}

// --- Detail Panel ---
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
    <div className="w-72 bg-[#151C2C] border border-[#1E293B] rounded-xl shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E293B]">
        <span className="text-sm font-semibold text-white font-mono truncate pr-2">{node.label}</span>
        <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={15} /></button>
      </div>
      <div className="px-4 py-3 space-y-3 overflow-y-auto text-xs font-mono text-slate-300">
        <div className="grid grid-cols-2 gap-y-2">
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
          <div className="flex items-center gap-1.5 text-amber-400 bg-amber-950/30 border border-amber-800/40 rounded px-2 py-1.5">
            <AlertTriangle size={12} /> Parse error in this file
          </div>
        )}
        <Section title="Dependencies" items={deps} />
        <Section title="Dependents" items={dependents} />
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-slate-400 mb-1.5">{title} ({items.length})</div>
      {items.length === 0 ? (
        <div className="text-slate-600 italic">None</div>
      ) : (
        <ul className="space-y-1">
          {items.map(i => (
            <li key={i} className="text-cyan-400 truncate">{i}</li>
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

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const gnode = graphData.nodes.find(n => n.id === node.id);
    setSelectedNode(gnode || null);
  }, [graphData]);

  // Highlight filtered nodes
  const filteredIds = search
    ? new Set(graphData.nodes.filter(n =>
        n.path.toLowerCase().includes(search.toLowerCase()) ||
        n.language.toLowerCase().includes(search.toLowerCase())
      ).map(n => n.id))
    : null;

  const displayedNodes = nodes.map(n => ({
    ...n,
    style: filteredIds && !filteredIds.has(n.id)
      ? { opacity: 0.25 }
      : undefined,
  }));

  return (
    <div className="relative w-full h-full flex">
      {/* Search bar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="flex items-center bg-[#0B0F19] border border-[#1E293B] rounded-lg px-3 py-1.5 gap-2 shadow-lg">
          <Search size={13} className="text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter nodes…"
            className="bg-transparent text-xs text-slate-200 outline-none w-36 placeholder:text-slate-500 font-mono"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400 hover:text-white">
              <X size={12} />
            </button>
          )}
        </div>
        <div className="bg-[#0B0F19] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs font-mono text-slate-400">
          {graphData.total_nodes} nodes · {graphData.total_edges} edges
        </div>
      </div>

      {/* React Flow canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={displayedNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.2}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1E293B" gap={20} />
          <Controls className="bg-[#151C2C] border border-[#1E293B] rounded-lg" />
          <MiniMap
            nodeColor={n => langColor[(n.data as any)?.language] || '#334155'}
            maskColor="#0B0F1960"
            className="!bg-[#0B0F19] !border-[#1E293B]"
          />
        </ReactFlow>
      </div>

      {/* Node detail panel */}
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
