'use client';

import { useState } from 'react';
import type { PipelineOutput } from '@/lib/types';

// Average seconds lost per copy-paste operation performed manually across apps
const COPY_PASTE_OVERHEAD_SECONDS = 30;
// Cognitive re-focus cost per context switch (Gloria Mark, UC Irvine research)
const CONTEXT_SWITCH_COST_SECONDS = 23;
const WORKING_DAYS_PER_MONTH = 21;

interface AutomatableWaste {
  bottleneckWaitPerDay: number;   // seconds
  copyPastePerDay: number;        // seconds
  contextSwitchPerDay: number;    // seconds
  totalPerDay: number;            // seconds
  perUserPerDay: number;          // seconds
  daysInDataset: number;
}

function computeWaste(pipeline: PipelineOutput): AutomatableWaste {
  const { statistics: stats, bottlenecks, activities } = pipeline;

  const startMs = new Date(stats.start_date).getTime();
  const endMs = new Date(stats.end_date).getTime();
  const daysInDataset = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

  const totalBottleneckWait = bottlenecks.reduce(
    (sum, bn) => sum + bn.avg_wait_seconds * (bn.case_count ?? 1),
    0,
  );

  const totalCopyPasteOps = activities.reduce((sum, a) => sum + a.copy_paste_count, 0);
  const totalContextSwitches = activities.reduce((sum, a) => sum + a.context_switch_count, 0);

  const bottleneckWaitPerDay = totalBottleneckWait / daysInDataset;
  const copyPastePerDay = (totalCopyPasteOps * COPY_PASTE_OVERHEAD_SECONDS) / daysInDataset;
  const contextSwitchPerDay = (totalContextSwitches * CONTEXT_SWITCH_COST_SECONDS) / daysInDataset;
  const totalPerDay = bottleneckWaitPerDay + copyPastePerDay + contextSwitchPerDay;
  const perUserPerDay = totalPerDay / Math.max(stats.total_users, 1);

  return {
    bottleneckWaitPerDay,
    copyPastePerDay,
    contextSwitchPerDay,
    totalPerDay,
    perUserPerDay,
    daysInDataset,
  };
}

function formatHours(seconds: number): string {
  const h = seconds / 3600;
  if (h >= 10) return `${Math.round(h)}h`;
  return `${h.toFixed(1)}h`;
}

function formatEur(amount: number): string {
  if (amount >= 1000) return `€${(amount / 1000).toFixed(1)}k`;
  return `€${Math.round(amount)}`;
}

function BreakdownRow({
  icon,
  label,
  secondsPerDay,
  totalPerDay,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  secondsPerDay: number;
  totalPerDay: number;
  note: string;
}) {
  const pct = totalPerDay > 0 ? (secondsPerDay / totalPerDay) * 100 : 0;
  const hours = secondsPerDay / 3600;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 text-zinc-400">
          {icon}
          <span>{label}</span>
          <span className="text-zinc-600 text-[10px]">{note}</span>
        </span>
        <span className="font-mono text-zinc-300 tabular-nums">
          {formatHours(secondsPerDay)}/day
          <span className="text-zinc-600 ml-1">({hours < 0.1 ? '<6m' : `${Math.round(pct)}%`})</span>
        </span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500/70 rounded-full transition-all duration-700"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

interface CostOfInactionProps {
  pipeline: PipelineOutput;
}

export function CostOfInaction({ pipeline }: CostOfInactionProps) {
  const [hourlyRate, setHourlyRate] = useState(35);
  const [editing, setEditing] = useState(false);

  const waste = computeWaste(pipeline);
  const { statistics: stats } = pipeline;

  const teamHoursPerDay = waste.totalPerDay / 3600;
  const teamHoursPerMonth = teamHoursPerDay * WORKING_DAYS_PER_MONTH;
  const monthlyCost = teamHoursPerMonth * hourlyRate;
  const annualCost = monthlyCost * 12;

  const userHoursPerDay = waste.perUserPerDay / 3600;

  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-900/40 bg-zinc-900">
      {/* Subtle glow accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-900/10 via-transparent to-transparent pointer-events-none" />

      <div className="relative p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold text-amber-500/80 uppercase tracking-widest mb-1">
              Cost of Inaction
            </p>
            <p className="text-xs text-zinc-500">
              Time lost daily to work automation could eliminate — across {stats.total_users} user{stats.total_users !== 1 ? 's' : ''}
            </p>
          </div>
          {/* Hourly rate editor */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] text-zinc-600">at</span>
            {editing ? (
              <input
                type="number"
                value={hourlyRate}
                min={1}
                max={500}
                onChange={(e) => setHourlyRate(Math.max(1, Number(e.target.value)))}
                onBlur={() => setEditing(false)}
                autoFocus
                className="w-14 px-1.5 py-0.5 text-xs bg-zinc-800 border border-zinc-600 rounded text-zinc-200 text-center focus:outline-none focus:border-amber-500"
              />
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="text-xs font-mono text-zinc-400 hover:text-zinc-200 underline underline-offset-2 decoration-zinc-700 hover:decoration-zinc-500 transition-colors cursor-pointer"
                title="Click to change hourly rate"
              >
                €{hourlyRate}/hr
              </button>
            )}
          </div>
        </div>

        {/* Main numbers */}
        <div className="flex items-end gap-6">
          <div>
            <div className="text-4xl font-bold tabular-nums text-amber-400">
              {formatHours(waste.totalPerDay)}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">lost per day (team total)</div>
          </div>
          <div className="pb-1 space-y-0.5">
            <div className="text-lg font-semibold tabular-nums text-zinc-200">
              {formatEur(monthlyCost)}
              <span className="text-sm font-normal text-zinc-500">/mo</span>
            </div>
            <div className="text-xs text-zinc-600">
              {formatEur(annualCost)}/yr · {formatHours(waste.perUserPerDay)}/day per user
            </div>
          </div>
        </div>

        {/* Breakdown bars */}
        <div className="space-y-3 pt-1 border-t border-zinc-800">
          <BreakdownRow
            icon={
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.1" />
                <path d="M5.5 3v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
            }
            label="Bottleneck wait time"
            secondsPerDay={waste.bottleneckWaitPerDay}
            totalPerDay={waste.totalPerDay}
            note="time spent waiting between steps"
          />
          <BreakdownRow
            icon={
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <rect x="1" y="2" width="5" height="7" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
                <path d="M7 1h2.5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5H7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                <path d="M3.5 5h3.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
            }
            label="Manual copy-paste"
            secondsPerDay={waste.copyPastePerDay}
            totalPerDay={waste.totalPerDay}
            note={`~${COPY_PASTE_OVERHEAD_SECONDS}s overhead per operation`}
          />
          <BreakdownRow
            icon={
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1 5.5h3M7 5.5h3M5.5 1v3M5.5 7v3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                <circle cx="5.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.1" />
              </svg>
            }
            label="Context switching"
            secondsPerDay={waste.contextSwitchPerDay}
            totalPerDay={waste.totalPerDay}
            note={`~${CONTEXT_SWITCH_COST_SECONDS}s re-focus cost per switch`}
          />
        </div>

        {/* Footer note */}
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          Based on {waste.daysInDataset} days of recorded data · copy-paste overhead per Gloria Mark (UC Irvine) · automating the top recommendations eliminates this cost
        </p>
      </div>
    </div>
  );
}
