'use client';

import { useMemo } from 'react';
import type { PipelineOutput, CopilotOutput, CopyPasteFlow } from '@/lib/types';
import { formatDuration } from '@/lib/utils';

interface ActionCardProps {
  pipeline: PipelineOutput;
  copilot: CopilotOutput | null;
}

interface Action {
  label: string;
  color: string;
  title: string;
  metric: string;
  savings: string;
  effort: string;
  nextStep: string;
}

export function ActionCard({ pipeline, copilot }: ActionCardProps) {
  const actions = useMemo(() => {
    const result: Action[] = [];
    const flows = pipeline.copy_paste_flows ?? [];

    // Action 1: Quick Win — Hub automation (from copy-paste flows)
    if (flows.length > 0) {
      const incoming = new Map<string, number>();
      for (const f of flows) {
        if (f.source_app !== f.target_app && f.count > 0) {
          incoming.set(f.target_app, (incoming.get(f.target_app) ?? 0) + f.count);
        }
      }
      let hubApp = '';
      let hubCount = 0;
      for (const [app, count] of incoming) {
        if (count > hubCount) { hubApp = app; hubCount = count; }
      }
      if (hubApp && hubCount > 50) {
        const hours = (hubCount * 5) / 3600;
        result.push({
          label: 'QUICK WIN',
          color: 'border-l-green-500',
          title: `Automate ${hubApp} reporting`,
          metric: `${hubCount.toLocaleString()} manual data transfers/month into ${hubApp}`,
          savings: `~${hours.toFixed(0)} hrs/month`,
          effort: '1-2 weeks',
          nextStep: `Deploy automated digest from source apps directly to ${hubApp}`,
        });
      }
    }

    // Action 2: High Impact — top recommendations
    if (copilot?.recommendations?.length) {
      const sorted = [...copilot.recommendations].sort(
        (a, b) => (b.estimated_time_saved_seconds * (b.affected_cases_percentage ?? 0)) -
                  (a.estimated_time_saved_seconds * (a.affected_cases_percentage ?? 0))
      );
      const top3 = sorted.slice(0, 3);
      const totalCopyPaste = pipeline.activities
        .filter((a) => a.copy_paste_count > 10)
        .reduce((s, a) => s + a.copy_paste_count, 0);
      const candidateCount = pipeline.activities.filter((a) => a.copy_paste_count > 10).length;
      const totalHours = top3.reduce((s, r) => s + r.estimated_time_saved_seconds * (r.affected_cases_percentage / 100) * pipeline.statistics.total_cases / 3600, 0);

      result.push({
        label: 'HIGH IMPACT',
        color: 'border-l-blue-500',
        title: 'RPA for repetitive data entry',
        metric: `${candidateCount} activities with ${totalCopyPaste.toLocaleString()} manual operations`,
        savings: `~${totalHours.toFixed(0)} hrs/month`,
        effort: '2-4 weeks',
        nextStep: `Start with: ${top3.map((r) => r.target).join(', ')}`,
      });
    }

    // Action 3: Process Fix — rework loops from variants
    const loopVariants = pipeline.variants
      .filter((v) => {
        const seq = v.sequence;
        for (let i = 0; i < seq.length - 3; i++) {
          if (seq[i] === seq[i + 2] && seq[i + 1] === seq[i + 3]) return true;
        }
        return false;
      });

    if (loopVariants.length > 0) {
      result.push({
        label: 'PROCESS FIX',
        color: 'border-l-amber-500',
        title: 'Eliminate rework loops',
        metric: `${loopVariants.length} process paths contain repetitive back-and-forth patterns`,
        savings: 'Variable — removes wasted cycles',
        effort: 'Process redesign',
        nextStep: 'Consolidate repeated app-switching into single workflow steps',
      });
    }

    return result;
  }, [pipeline, copilot]);

  if (actions.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-100">Recommended Actions</h3>
        <p className="text-xs text-zinc-500 mt-0.5">What to do Monday morning — prioritized by impact and effort</p>
      </div>
      <div className="divide-y divide-zinc-800">
        {actions.map((action, i) => (
          <div key={i} className={`px-4 py-3 border-l-2 ${action.color}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded ${
                action.label === 'QUICK WIN' ? 'bg-green-950/50 text-green-400' :
                action.label === 'HIGH IMPACT' ? 'bg-blue-950/50 text-blue-400' :
                'bg-amber-950/50 text-amber-400'
              }`}>
                {action.label}
              </span>
              <span className="text-sm font-medium text-zinc-200">{action.title}</span>
            </div>
            <p className="text-xs text-zinc-300">{action.metric}</p>
            <div className="flex gap-4 mt-1.5 text-xs">
              <span className="text-zinc-400">Saves: <span className="text-zinc-200">{action.savings}</span></span>
              <span className="text-zinc-400">Effort: <span className="text-zinc-200">{action.effort}</span></span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {'\u2192'} {action.nextStep}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
