import type { PipelineOutput } from '@/lib/types';
import { InlineTooltip } from './tooltip';

interface HealthScoreProps {
  pipeline: PipelineOutput;
}

function computeHealthScore(pipeline: PipelineOutput) {
  const { statistics: stats, bottlenecks, activities } = pipeline;

  const standardization = Math.max(0, 100 - stats.total_variants * 3);

  const criticalCount = bottlenecks.filter((b) => b.severity === 'critical').length;
  const highCount = bottlenecks.filter((b) => b.severity === 'high').length;
  const mediumCount = bottlenecks.filter((b) => b.severity === 'medium').length;
  const bottleneckHealth = Math.max(0, 100 - criticalCount * 25 - highCount * 10 - mediumCount * 3);

  const totalCopyPaste = activities.reduce((sum, a) => sum + a.copy_paste_count, 0);
  const automationBurden = Math.max(0, 100 - (totalCopyPaste / Math.max(stats.total_events, 1)) * 300);

  const overall = Math.round((standardization + bottleneckHealth + automationBurden) / 3);

  return { overall, standardization, bottleneckHealth, automationBurden };
}

function scoreColor(score: number): string {
  if (score > 70) return 'bg-green-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function scoreTextColor(score: number): string {
  if (score > 70) return 'text-green-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

export function HealthScore({ pipeline }: HealthScoreProps) {
  const { overall, standardization, bottleneckHealth, automationBurden } = computeHealthScore(pipeline);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
          Process Health
        </h3>
        <InlineTooltip text="Composite score from three factors: process standardization (fewer variants = better), bottleneck severity (fewer critical/high = better), and automation burden (less copy-paste = better). Each factor scores 0-100, then averaged.">
          <span className="text-xs text-zinc-600 cursor-help">?</span>
        </InlineTooltip>
      </div>

      <div className="flex items-end gap-4 mb-4">
        <span className={`text-4xl font-bold tabular-nums ${scoreTextColor(overall)}`}>
          {overall}
        </span>
        <span className="text-lg text-zinc-600 mb-1">/ 100</span>
      </div>

      <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all duration-500 ${scoreColor(overall)}`}
          style={{ width: `${overall}%` }}
        />
      </div>

      <div className="flex gap-6 text-xs">
        <div>
          <span className="text-zinc-500">Standardization</span>
          <span className={`ml-1.5 font-mono font-medium ${scoreTextColor(standardization)}`}>
            {Math.round(standardization)}
          </span>
        </div>
        <div>
          <span className="text-zinc-500">Bottlenecks</span>
          <span className={`ml-1.5 font-mono font-medium ${scoreTextColor(bottleneckHealth)}`}>
            {Math.round(bottleneckHealth)}
          </span>
        </div>
        <div>
          <span className="text-zinc-500">Automation</span>
          <span className={`ml-1.5 font-mono font-medium ${scoreTextColor(automationBurden)}`}>
            {Math.round(automationBurden)}
          </span>
        </div>
      </div>
    </div>
  );
}
