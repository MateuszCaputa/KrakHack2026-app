'use client';

import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import type { PipelineOutput, Recommendation } from '@/lib/types';

/* ─────────────────────────── visual constants ───────────────────── */

const TW = 184;   // task width
const TH = 68;    // task height
const HG = 52;    // horizontal gap
const VG = 76;    // vertical gap between rows
const ER = 22;    // event circle radius
const PR = 4;     // tasks per row
const PAD = 60;   // canvas padding

const PALETTE = {
  automation: { fill: '#052e16', stroke: '#22c55e', glow: '#22c55e30', text: '#86efac', badge: 'RPA' },
  bottleneck:  { fill: '#450a0a', stroke: '#f87171', glow: '#f8717130', text: '#fca5a5', badge: '⚡ SLOW' },
  copypaste:   { fill: '#172554', stroke: '#60a5fa', glow: '#60a5fa30', text: '#93c5fd', badge: 'COPY' },
  default:     { fill: '#1c2333', stroke: '#475569', glow: '#47556918', text: '#cbd5e1', badge: null },
  start:       { fill: '#14532d', stroke: '#22c55e', glow: '#22c55e40', text: '#fff', badge: null },
  end:         { fill: '#7f1d1d', stroke: '#f87171', glow: '#f8717140', text: '#fff', badge: null },
} as const;

type Variant = keyof typeof PALETTE;

/* ─────────────────────────── data types ─────────────────────────── */

interface DiagramNode {
  id: string;
  label: string;
  kind: 'start' | 'end' | 'task';
  variant: Variant;
}

interface Box { x: number; y: number; w: number; h: number; }

/* ─────────────────────────── data extraction ────────────────────── */

const MAX_TASKS = 12;

function isCleanName(s: string): boolean {
  if (!s || s.length > 48) return false;
  if (s.includes('://') || s.toLowerCase().includes('http')) return false;
  if (s.includes('?') && s.includes('=')) return false;
  if ((s.match(/\//g) ?? []).length > 1) return false;
  if (/^[0-9a-f]{8,}$/i.test(s)) return false;
  return true;
}

function extractSequence(pipeline: PipelineOutput): string[] {
  // Try top variant — require at least 3 *unique* steps (dedup before checking)
  if (pipeline.variants.length > 0) {
    const best = [...pipeline.variants].sort((a, b) => b.case_count - a.case_count)[0];
    const unique = [...new Set(best.sequence.filter(isCleanName))];
    if (unique.length >= 3) return unique.slice(0, MAX_TASKS);
  }

  // Fall through to activities sorted by frequency (the dominant workflow)
  if (pipeline.activities.length > 0) {
    const names = [...pipeline.activities]
      .sort((a, b) => b.frequency - a.frequency)
      .filter(a => isCleanName(a.name))
      .map(a => a.name);
    if (names.length >= 2) return [...new Set(names)].slice(0, MAX_TASKS);
  }

  return ['Start Process', 'Process Step', 'Complete'];
}

function buildColorMap(
  sequence: string[],
  pipeline: PipelineOutput,
  recommendations: Recommendation[] | null,
): Map<string, Variant> {
  const botSet = new Set(
    pipeline.bottlenecks
      .filter(b => b.severity === 'critical' || b.severity === 'high')
      .flatMap(b => [b.from_activity.toLowerCase(), b.to_activity.toLowerCase()])
  );
  const autoSet = new Set(
    (recommendations ?? [])
      .filter(r => r.type === 'automate' || r.automation_type)
      .map(r => r.target.toLowerCase())
  );
  const copySet = new Set(
    pipeline.activities
      .filter(a => (a.copy_paste_count ?? 0) > 2)
      .map(a => a.name.toLowerCase())
  );

  const map = new Map<string, Variant>();
  for (const name of sequence) {
    const l = name.toLowerCase();
    if (autoSet.has(l)) map.set(name, 'automation');
    else if (botSet.has(l)) map.set(name, 'bottleneck');
    else if (copySet.has(l)) map.set(name, 'copypaste');
    else map.set(name, 'default');
  }
  return map;
}

function buildNodes(sequence: string[], colorMap: Map<string, Variant>): DiagramNode[] {
  const nodes: DiagramNode[] = [
    { id: '_start', label: 'Start', kind: 'start', variant: 'start' },
  ];
  for (let i = 0; i < sequence.length; i++) {
    nodes.push({ id: `t${i}`, label: sequence[i], kind: 'task', variant: colorMap.get(sequence[i]) ?? 'default' });
  }
  nodes.push({ id: '_end', label: 'End', kind: 'end', variant: 'end' });
  return nodes;
}

/* ─────────────────────────── layout ─────────────────────────────── */

function computeBoxes(nodes: DiagramNode[]): Map<string, Box> {
  const boxes = new Map<string, Box>();
  const tasks = nodes.filter(n => n.kind === 'task');
  const tc = tasks.length;

  nodes.forEach(n => {
    if (n.kind === 'start') {
      boxes.set(n.id, { x: PAD, y: PAD + TH / 2 - ER, w: ER * 2, h: ER * 2 });
    } else if (n.kind === 'end') {
      const lastRow = tc > 0 ? Math.floor((tc - 1) / PR) : 0;
      const lastCol = tc > 0 ? (tc - 1) % PR : 0;
      if (lastCol + 1 < PR) {
        boxes.set(n.id, {
          x: PAD + ER * 2 + HG + (lastCol + 1) * (TW + HG) + TW / 2 - ER,
          y: PAD + lastRow * (TH + VG) + TH / 2 - ER,
          w: ER * 2, h: ER * 2,
        });
      } else {
        boxes.set(n.id, {
          x: PAD + ER * 2 + HG + TW / 2 - ER,
          y: PAD + (lastRow + 1) * (TH + VG) + TH / 2 - ER,
          w: ER * 2, h: ER * 2,
        });
      }
    }
  });

  let ti = 0;
  for (const n of nodes) {
    if (n.kind !== 'task') continue;
    const row = Math.floor(ti / PR);
    const col = ti % PR;
    boxes.set(n.id, {
      x: PAD + ER * 2 + HG + col * (TW + HG),
      y: PAD + row * (TH + VG),
      w: TW, h: TH,
    });
    ti++;
  }

  return boxes;
}

/* ─────────────────────────── edge paths ─────────────────────────── */

function edgePath(fb: Box, tb: Box): string {
  const sx = fb.x + fb.w,  sy = fb.y + fb.h / 2;
  const tx = tb.x,          ty = tb.y + tb.h / 2;

  if (Math.abs(sy - ty) < 8 && tx >= sx - 2) {
    const mx = (sx + tx) / 2;
    return `M ${sx} ${sy} C ${mx} ${sy} ${mx} ${ty} ${tx} ${ty}`;
  }
  if (ty > sy) {
    const bx = fb.x + fb.w / 2, by = fb.y + fb.h;
    const ex = tb.x + tb.w / 2, ey = tb.y;
    const my = by + (ey - by) * 0.5;
    return `M ${bx} ${by} C ${bx} ${my} ${ex} ${my} ${ex} ${ey}`;
  }
  return `M ${sx} ${sy} L ${tx} ${ty}`;
}

/* ─────────────────────────── SVG node renderers ─────────────────── */

function trunc(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function TaskNode({ node, box }: { node: DiagramNode; box: Box }) {
  const p = PALETTE[node.variant];
  const line1 = trunc(node.label, 22);
  const line2 = node.label.length > 22 ? trunc(node.label.slice(21), 22) : null;
  const midY = line2 ? box.h / 2 - 7 : box.h / 2 + 5;

  return (
    <g transform={`translate(${box.x},${box.y})`}>
      <rect x={-2} y={-2} width={TW + 4} height={TH + 4} rx={13} fill={p.glow} />
      <rect x={3} y={5} width={TW} height={TH} rx={10} fill="#00000050" />
      <rect width={TW} height={TH} rx={10} fill={p.fill} stroke={p.stroke} strokeWidth={1.5} />
      <rect width={5} height={TH} rx={10} fill={p.stroke} opacity={0.85} />
      {p.badge && (
        <g transform={`translate(${TW - 46}, 7)`}>
          <rect width={38} height={16} rx={4} fill={p.stroke} opacity={0.2} />
          <text x={19} y={11.5} textAnchor="middle" fill={p.stroke} fontSize={7.5} fontWeight="800" letterSpacing="0.06em">{p.badge}</text>
        </g>
      )}
      <text x={TW / 2 + 3} y={midY} textAnchor="middle" fill={p.text} fontSize={11.5} fontWeight={600} fontFamily="system-ui,sans-serif">{line1}</text>
      {line2 && <text x={TW / 2 + 3} y={midY + 15} textAnchor="middle" fill={p.text} fontSize={11.5} fontWeight={600} fontFamily="system-ui,sans-serif" opacity={0.8}>{line2}</text>}
    </g>
  );
}

function EventNode({ node, box }: { node: DiagramNode; box: Box }) {
  const p = PALETTE[node.variant];
  const cx = box.x + ER, cy = box.y + ER;
  return (
    <g>
      <circle cx={cx} cy={cy} r={ER + 7} fill={p.glow} />
      <circle cx={cx + 2} cy={cy + 3} r={ER} fill="#00000060" />
      <circle cx={cx} cy={cy} r={ER} fill={p.fill} stroke={p.stroke} strokeWidth={2} />
      {node.kind === 'start'
        ? <polygon points={`${cx - 7},${cy - 9} ${cx - 7},${cy + 9} ${cx + 10},${cy}`} fill={p.stroke} opacity={0.9} />
        : <rect x={cx - 8} y={cy - 8} width={16} height={16} rx={2} fill={p.stroke} opacity={0.9} />}
      <text x={cx} y={cy + ER + 16} textAnchor="middle" fill={p.stroke} fontSize={10} fontWeight={700} fontFamily="system-ui,sans-serif">{node.label}</text>
    </g>
  );
}

/* ─────────────────────────── legend ─────────────────────────────── */

const LEGEND = [
  { fill: PALETTE.automation.fill, stroke: PALETTE.automation.stroke, label: 'Automation Candidate (RPA)' },
  { fill: PALETTE.bottleneck.fill,  stroke: PALETTE.bottleneck.stroke,  label: 'Bottleneck' },
  { fill: PALETTE.copypaste.fill,   stroke: PALETTE.copypaste.stroke,   label: 'Copy-Paste Intensive' },
  { fill: PALETTE.default.fill,     stroke: PALETTE.default.stroke,     label: 'Manual Step' },
];

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 bg-[#0a0d14] border-t border-white/10">
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Legend</span>
      {LEGEND.map(item => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: item.fill, border: `1.5px solid ${item.stroke}` }} />
          <span className="text-[11px] text-white/50">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── diagram canvas ─────────────────────── */

function DiagramCanvas({ nodes, boxes }: { nodes: DiagramNode[]; boxes: Map<string, Box> }) {
  const { vw, vh } = useMemo(() => {
    let mx = 0, my = 0;
    for (const b of boxes.values()) { mx = Math.max(mx, b.x + b.w); my = Math.max(my, b.y + b.h + 44); }
    return { vw: mx + PAD, vh: my + PAD };
  }, [boxes]);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ ox: number; oy: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const fitToView = useCallback(() => {
    if (!wrapRef.current) return;
    const { width, height } = wrapRef.current.getBoundingClientRect();
    const s = Math.min((width - 40) / vw, (height - 40) / vh, 1.2);
    setScale(s);
    setPan({ x: (width - vw * s) / 2, y: (height - vh * s) / 2 });
  }, [vw, vh]);

  useEffect(() => { fitToView(); }, [fitToView]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.min(Math.max(s * (e.deltaY < 0 ? 1.12 : 0.9), 0.15), 3));
  };

  const nodeIds = useMemo(() => nodes.map(n => n.id), [nodes]);

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full bg-[#080b12] overflow-hidden select-none"
      style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      onWheel={onWheel}
      onMouseDown={e => { dragging.current = { ox: e.clientX - pan.x, oy: e.clientY - pan.y }; }}
      onMouseMove={e => { if (dragging.current) setPan({ x: e.clientX - dragging.current.ox, y: e.clientY - dragging.current.oy }); }}
      onMouseUp={() => { dragging.current = null; }}
      onMouseLeave={() => { dragging.current = null; }}
    >
      {/* toolbar */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5 bg-white/10 backdrop-blur border border-white/20 rounded-lg p-1 shadow-lg">
        <button onClick={() => setScale(s => Math.min(s * 1.25, 3))} className="w-7 h-7 flex items-center justify-center text-white/70 hover:bg-white/10 rounded text-base font-medium transition-colors" title="Zoom in">+</button>
        <button onClick={() => setScale(s => Math.max(s / 1.25, 0.15))} className="w-7 h-7 flex items-center justify-center text-white/70 hover:bg-white/10 rounded text-base font-medium transition-colors" title="Zoom out">−</button>
        <div className="w-px h-4 bg-white/20 mx-0.5" />
        <button onClick={fitToView} className="w-7 h-7 flex items-center justify-center text-white/70 hover:bg-white/10 rounded transition-colors" title="Fit to view">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 5V1.5A.5.5 0 011.5 1H5M9 1h4.5a.5.5 0 01.5.5V5M14 9v4.5a.5.5 0 01-.5.5H10M5 14H1.5a.5.5 0 01-.5-.5V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </button>
      </div>

      <div style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`, transformOrigin: '0 0', willChange: 'transform' }}>
        <svg width={vw} height={vh} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#ffffff0d" />
            </pattern>
            <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 1 L9 5 L0 9 Z" fill="#4b5563" />
            </marker>
            <style>{`@keyframes dash{to{stroke-dashoffset:-18}} .fp{animation:dash 2s linear infinite}`}</style>
          </defs>

          <rect width={vw} height={vh} fill="url(#dots)" />

          {/* edges: sequential pairs */}
          {nodeIds.slice(0, -1).map((id, i) => {
            const fb = boxes.get(id);
            const tb = boxes.get(nodeIds[i + 1]);
            if (!fb || !tb) return null;
            return (
              <path key={`e${i}`} d={edgePath(fb, tb)} fill="none" stroke="#2d3748" strokeWidth={2} strokeDasharray="6 3" markerEnd="url(#arr)" className="fp" />
            );
          })}

          {/* nodes */}
          {nodes.map(n => {
            const b = boxes.get(n.id);
            if (!b) return null;
            if (n.kind === 'task') return <TaskNode key={n.id} node={n} box={b} />;
            return <EventNode key={n.id} node={n} box={b} />;
          })}
        </svg>
      </div>
    </div>
  );
}

/* ─────────────────────────── public component ───────────────────── */

export interface BpmnViewerProps {
  pipeline: PipelineOutput;
  recommendations: Recommendation[] | null;
}

export function BpmnViewer({ pipeline, recommendations }: BpmnViewerProps) {
  const { nodes, boxes } = useMemo(() => {
    const seq = extractSequence(pipeline);
    const colorMap = buildColorMap(seq, pipeline, recommendations);
    const ns = buildNodes(seq, colorMap);
    const bs = computeBoxes(ns);
    return { nodes: ns, boxes: bs };
  }, [pipeline, recommendations]);

  return (
    <div className="w-full rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60">
      {/* header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#0d1017] border-b border-white/10">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-[11px] text-white/40 font-medium tracking-wide ml-1">BPMN 2.0 — Process Workflow</span>
        <div className="ml-auto">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-950/60 border border-green-700/40 text-[10px] font-semibold text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Generated Workflow
          </span>
        </div>
      </div>

      {/* canvas */}
      <div className="h-[620px]">
        <DiagramCanvas nodes={nodes} boxes={boxes} />
      </div>

      <Legend />
    </div>
  );
}
