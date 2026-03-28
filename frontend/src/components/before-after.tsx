import type { PipelineOutput, CopilotOutput } from '@/lib/types';
import { formatDuration } from '@/lib/utils';

interface BeforeAfterProps {
  pipeline: PipelineOutput;
  copilot: CopilotOutput;
}

interface Metric {
  label: string;
  current: number;
  optimized: number;
  format: (v: number) => string;
}

export function BeforeAfter({ pipeline, copilot }: BeforeAfterProps) {
  const { statistics: stats, activities, bottlenecks } = pipeline;
  const recs = copilot.recommendations ?? [];

  const eliminatedCount = recs.filter((r) => r.type === 'eliminate').length;
  const optimizedActivities = Math.max(1, stats.total_activities - eliminatedCount);

  const totalTimeSavedPerCase = recs.reduce((sum, r) => sum + (r.estimated_time_saved_seconds ?? 0), 0);
  const currentDuration = stats.avg_case_duration_seconds ?? 0;
  const optimizedDuration = Math.max(0, currentDuration - totalTimeSavedPerCase);

  const totalCopyPaste = activities.reduce((sum, a) => sum + a.copy_paste_count, 0);
  const automateRecs = new Set(recs.filter((r) => r.type === 'automate').map((r) => r.target.toLowerCase()));
  const cpReduced = activities
    .filter((a) => automateRecs.has(a.name.toLowerCase()))
    .reduce((sum, a) => sum + a.copy_paste_count * 0.9, 0);
  const optimizedCopyPaste = Math.round(totalCopyPaste - cpReduced);

  const highBn = bottlenecks.filter((b) => b.severity === 'critical' || b.severity === 'high').length;
  const bnTargets = new Set(recs.map((r) => r.target.toLowerCase()));
  const bnReduced = bottlenecks.filter(
    (b) => (b.severity === 'critical' || b.severity === 'high') &&
      (bnTargets.has(b.from_activity.toLowerCase()) || bnTargets.has(b.to_activity.toLowerCase()))
  ).length;
  const optimizedBn = Math.max(0, highBn - bnReduced);

  const metrics: Metric[] = [
    { label: 'Activities', current: stats.total_activities, optimized: optimizedActivities, format: (v) => String(v) },
    { label: 'Avg Case Duration', current: currentDuration, optimized: optimizedDuration, format: formatDuration },
    { label: 'High+ Bottlenecks', current: highBn, optimized: optimizedBn, format: (v) => String(v) },
    { label: 'Copy-Paste Ops', current: totalCopyPaste, optimized: optimizedCopyPaste, format: (v) => v.toLocaleString() },
  ];

  const durationPct = currentDuration > 0 ? Math.round((optimizedDuration / currentDuration) * 100) : 100;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
      <h4 className="text-sm font-semibold text-zinc-100 mb-1">Before / After Automation</h4>
      <p className="text-xs text-zinc-500 mb-4">Projected impact based on AI recommendations</p>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Current Process</p>
          {metrics.map((m) => (
            <div key={m.label} className="flex justify-between py-1.5 border-b border-zinc-800/50">
              <span className="text-xs text-zinc-400">{m.label}</span>
              <span className="text-sm font-mono text-zinc-200">{m.format(m.current)}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Optimized Process</p>
          {metrics.map((m) => {
            const pctChange = m.current > 0 ? Math.round(((m.optimized - m.current) / m.current) * 100) : 0;
            return (
              <div key={m.label} className="flex justify-between py-1.5 border-b border-zinc-800/50">
                <span className="text-xs text-zinc-400">{m.label}</span>
                <span className="text-sm font-mono">
                  <span className="text-green-400">{m.format(m.optimized)}</span>
                  {pctChange !== 0 && (
                    <span className="text-xs text-green-500 ml-1.5">
                      ({pctChange > 0 ? '+' : ''}{pctChange}%)
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 w-20">Current</span>
          <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-zinc-500 rounded-full" style={{ width: '100%' }} />
          </div>
          <span className="text-xs font-mono text-zinc-400 w-12 text-right">100%</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 w-20">Optimized</span>
          <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${durationPct}%` }} />
          </div>
          <span className="text-xs font-mono text-green-400 w-12 text-right">{durationPct}%</span>
        </div>
      </div>
    </div>
  );
}
