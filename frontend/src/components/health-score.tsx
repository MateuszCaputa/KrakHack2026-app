import type { PipelineOutput } from '@/lib/types';
import { InlineTooltip } from './tooltip';

interface HealthScoreProps {
  pipeline: PipelineOutput;
}

function computeHealthScore(pipeline: PipelineOutput) {
  const { bottlenecks, activities, variants } = pipeline;

  // Standardization: share of cases following the dominant path.
  // 67%+ on the top variant → 100; fully fragmented (all unique paths) → 0.
  const topVariantPct = variants.length > 0 ? (variants[0].percentage ?? 0) : 0;
  const standardization = Math.min(100, Math.max(0, Math.round(topVariantPct * 1.5)));

  // Bottleneck health: severity distribution relative to total bottlenecks.
  // Avoids punishing datasets that simply have more transitions.
  const totalBn = bottlenecks.length;
  const criticalCount = bottlenecks.filter((b) => b.severity === 'critical').length;
  const highCount = bottlenecks.filter((b) => b.severity === 'high').length;
  const mediumCount = bottlenecks.filter((b) => b.severity === 'medium').length;
  const bottleneckHealth =
    totalBn === 0
      ? 100
      : Math.max(
          0,
          Math.round(
            100 -
              (criticalCount / totalBn) * 80 -
              (highCount / totalBn) * 40 -
              (mediumCount / totalBn) * 15,
          ),
        );

  // Automation burden: fraction of activities with heavy copy-paste (>10 ops).
  // Fully relative — dataset size doesn't matter.
  const heavyCopyPasteCount = activities.filter((a) => a.copy_paste_count > 10).length;
  const automationBurden =
    activities.length === 0
      ? 100
      : Math.max(0, Math.round(100 - (heavyCopyPasteCount / activities.length) * 100));

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
        <InlineTooltip text="Composite score from three factors: standardization (how many cases follow the dominant path), bottleneck severity distribution (fraction of critical/high vs total), and automation burden (fraction of activities with heavy copy-paste). Each scores 0–100, then averaged.">
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
          <InlineTooltip text="Standardization (0–100). Measures how many cases follow the dominant process path. Top variant covers 67%+ of cases → 100. Fully fragmented (every case unique) → 0.">
            <span className="text-zinc-500 cursor-help">Standardization</span>
          </InlineTooltip>
          <span className={`ml-1.5 font-mono font-medium ${scoreTextColor(standardization)}`}>
            {Math.round(standardization)}
          </span>
        </div>
        <div>
          <InlineTooltip text="Bottleneck health (0–100). Based on severity distribution relative to total bottleneck count — not absolute numbers. 100% critical transitions → ~20; all low severity → 100.">
            <span className="text-zinc-500 cursor-help">Bottlenecks</span>
          </InlineTooltip>
          <span className={`ml-1.5 font-mono font-medium ${scoreTextColor(bottleneckHealth)}`}>
            {Math.round(bottleneckHealth)}
          </span>
        </div>
        <div>
          <InlineTooltip text="Automation burden (0–100). Fraction of activities with more than 10 copy-paste operations. 0% heavy copy-paste → 100; all activities copy-paste-heavy → 0.">
            <span className="text-zinc-500 cursor-help">Automation</span>
          </InlineTooltip>
          <span className={`ml-1.5 font-mono font-medium ${scoreTextColor(automationBurden)}`}>
            {Math.round(automationBurden)}
          </span>
        </div>
      </div>
    </div>
  );
}
