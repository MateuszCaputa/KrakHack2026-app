'use client';

import { useState } from 'react';
import type { Recommendation, PipelineOutput } from '@/lib/types';

interface AutomationMatrixProps {
  recommendations: Recommendation[];
  pipeline: PipelineOutput;
}

const TYPE_COLORS: Record<string, string> = {
  automate: '#22c55e',
  eliminate: '#ef4444',
  simplify: '#3b82f6',
  parallelize: '#a855f7',
  reassign: '#f59e0b',
};

interface DotData {
  rec: Recommendation;
  x: number;
  y: number;
  radius: number;
}

export function AutomationMatrix({ recommendations, pipeline }: AutomationMatrixProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  if (recommendations.length === 0) return null;

  const activityMap = new Map(pipeline.activities.map((a) => [a.name, a]));
  const bottleneckTargets = new Set(
    pipeline.bottlenecks.filter((b) => b.severity === 'critical' || b.severity === 'high')
      .flatMap((b) => [b.from_activity, b.to_activity])
  );

  const dots: DotData[] = recommendations.map((rec) => {
    const value = (rec.estimated_time_saved_seconds * rec.affected_cases_percentage) / 100;
    const act = activityMap.get(rec.target);
    const appCount = act?.applications.length ?? 1;
    const performerCount = act?.performers.length ?? 1;
    const isBn = bottleneckTargets.has(rec.target) ? 1 : 0;
    const complexity = appCount + (performerCount > 2 ? 1 : 0) + isBn;
    const freq = act?.frequency ?? 10;

    return {
      rec,
      x: complexity,
      y: value,
      radius: Math.max(6, Math.min(20, Math.sqrt(freq) * 1.5)),
    };
  });

  const maxX = Math.max(...dots.map((d) => d.x), 1);
  const maxY = Math.max(...dots.map((d) => d.y), 1);

  const PAD = 50;
  const W = 500;
  const H = 340;
  const plotW = W - PAD * 2;
  const plotH = H - PAD * 2;
  const midX = PAD + plotW / 2;
  const midY = PAD + plotH / 2;

  function scaleX(v: number) {
    return PAD + (v / (maxX * 1.2)) * plotW;
  }
  function scaleY(v: number) {
    return PAD + plotH - (v / (maxY * 1.2)) * plotH;
  }

  const hovered = hoveredId != null ? dots.find((d) => d.rec.id === hoveredId) : null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-zinc-100 mb-1">Automation Readiness Matrix</h4>
      <p className="text-xs text-zinc-500 mb-3">
        Each dot is an automation target. Position shows value vs complexity.
      </p>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[600px] mx-auto" role="img" aria-label="Automation readiness scatter plot">
          {/* Quadrant backgrounds */}
          <rect x={PAD} y={PAD} width={plotW / 2} height={plotH / 2} fill="#22c55e" opacity={0.05} />
          <rect x={midX} y={PAD} width={plotW / 2} height={plotH / 2} fill="#3b82f6" opacity={0.05} />
          <rect x={PAD} y={midY} width={plotW / 2} height={plotH / 2} fill="#71717a" opacity={0.05} />
          <rect x={midX} y={midY} width={plotW / 2} height={plotH / 2} fill="#ef4444" opacity={0.05} />

          {/* Quadrant labels */}
          <text x={PAD + 8} y={PAD + 16} fontSize={10} fill="#71717a" opacity={0.6}>Quick Wins</text>
          <text x={midX + 8} y={PAD + 16} fontSize={10} fill="#71717a" opacity={0.6}>Strategic</text>
          <text x={PAD + 8} y={H - PAD - 8} fontSize={10} fill="#71717a" opacity={0.6}>Low Priority</text>
          <text x={midX + 8} y={H - PAD - 8} fontSize={10} fill="#71717a" opacity={0.6}>Avoid</text>

          {/* Axes */}
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#3f3f46" strokeWidth={1} />
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#3f3f46" strokeWidth={1} />

          {/* Axis labels */}
          <text x={W / 2} y={H - 10} fontSize={11} fill="#71717a" textAnchor="middle">Complexity →</text>
          <text x={14} y={H / 2} fontSize={11} fill="#71717a" textAnchor="middle" transform={`rotate(-90, 14, ${H / 2})`}>Value →</text>

          {/* Dots */}
          {dots.map((d) => (
            <circle
              key={d.rec.id}
              cx={scaleX(d.x)}
              cy={scaleY(d.y)}
              r={d.radius}
              fill={TYPE_COLORS[d.rec.type] ?? '#71717a'}
              opacity={hoveredId == null || hoveredId === d.rec.id ? 0.8 : 0.25}
              stroke={hoveredId === d.rec.id ? '#fff' : 'none'}
              strokeWidth={2}
              onMouseEnter={() => setHoveredId(d.rec.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="cursor-pointer transition-opacity"
            />
          ))}
        </svg>
      </div>

      {/* Tooltip info */}
      {hovered && (
        <div className="mt-2 p-3 bg-zinc-800 rounded-lg text-xs">
          <span className="font-medium text-zinc-200">{hovered.rec.target}</span>
          <span className="text-zinc-500 ml-2">
            {hovered.rec.type} · {hovered.rec.impact} impact · saves {Math.round(hovered.rec.estimated_time_saved_seconds)}s/case · {hovered.rec.affected_cases_percentage}% cases
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-zinc-500">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            {type}
          </div>
        ))}
      </div>
    </div>
  );
}
