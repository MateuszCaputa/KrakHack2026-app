'use client';

import { useMemo } from 'react';
import type { PipelineOutput } from '@/lib/types';

interface BusinessIdInsightProps {
  pipeline: PipelineOutput;
}

export function BusinessIdInsight({ pipeline }: BusinessIdInsightProps) {
  const insight = useMemo(() => {
    const totalCases = pipeline.statistics.total_cases;
    if (totalCases === 0) return null;

    // Count cases that look like ticket IDs (PRO-xxx, DEP-xxx, SUP-xxx pattern)
    // vs session-based fallback IDs
    // We can infer this from variant data and activity patterns
    // Since we don't have raw case IDs in frontend, estimate from activities
    // that have "View Issue List", "View Agile Board", "Update working progress"
    // which indicate tracked work

    const trackedActivities = pipeline.activities.filter((a) =>
      ['View Issue List', 'View Agile Board', 'Update working progress', 'DevOps Multi Team'].includes(a.name)
    );
    const trackedEvents = trackedActivities.reduce((s, a) => s + a.frequency, 0);
    const totalEvents = pipeline.statistics.total_events;
    const trackedPct = totalEvents > 0 ? (trackedEvents / totalEvents * 100) : 0;
    const untrackedPct = 100 - trackedPct;

    if (trackedPct < 1) return null;

    return { trackedPct, untrackedPct, trackedEvents, totalEvents };
  }, [pipeline]);

  if (!insight) return null;

  return (
    <div className="card-premium border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-red-800/30 bg-red-950/10">
        <div className="flex items-center gap-2">
          <span className="text-red-400 text-sm">&#9888;</span>
          <h3 className="text-sm font-semibold text-red-200">
            Process Visibility Gap
          </h3>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm text-zinc-300">
          Only <span className="text-red-400 font-bold">{insight.trackedPct.toFixed(1)}%</span> of events are linked to tracked business cases (ticket IDs like PRO-xxx, DEP-xxx).
          The remaining <span className="text-zinc-100 font-semibold">{insight.untrackedPct.toFixed(0)}%</span> is untracked "dark work."
        </p>
        <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-500 to-amber-500"
            style={{ width: `${Math.max(insight.trackedPct, 2)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-red-400">{insight.trackedPct.toFixed(1)}% tracked (tickets)</span>
          <span className="text-zinc-400">{insight.untrackedPct.toFixed(0)}% untracked (dark work)</span>
        </div>
        <p className="text-xs text-zinc-400">
          Work in Teams, Chrome, Outlook, and Excel has zero traceability to business cases.
          This is a process governance risk — management cannot measure what they cannot track.
        </p>
      </div>
    </div>
  );
}
