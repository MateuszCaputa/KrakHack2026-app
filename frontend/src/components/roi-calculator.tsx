'use client';

import { useState } from 'react';
import type { Recommendation, PipelineOutput } from '@/lib/types';
import { formatDuration } from '@/lib/utils';
import { CollapsibleSection } from './collapsible-section';
import { InlineTooltip } from './tooltip';

interface RoiCalculatorProps {
  recommendations: Recommendation[];
  pipeline: PipelineOutput;
}

export function RoiCalculator({ recommendations, pipeline }: RoiCalculatorProps) {
  const [hourlyRate, setHourlyRate] = useState(25);
  const [casesPerMonth, setCasesPerMonth] = useState(pipeline.statistics.total_cases);

  const breakdown = recommendations.map((rec) => {
    const monthlyHoursSaved =
      (rec.estimated_time_saved_seconds * casesPerMonth * rec.affected_cases_percentage / 100) / 3600;
    const monthlyCostSaved = monthlyHoursSaved * hourlyRate;
    return { rec, monthlyHoursSaved, monthlyCostSaved };
  });

  const totalMonthlyHours = breakdown.reduce((sum, b) => sum + b.monthlyHoursSaved, 0);
  const totalMonthlyCost = breakdown.reduce((sum, b) => sum + b.monthlyCostSaved, 0);
  const totalAnnualCost = totalMonthlyCost * 12;

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 border border-green-800/30 rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Estimated Annual Savings</p>
            <p className="text-4xl font-bold text-green-400 tabular-nums">
              ${totalAnnualCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-sm text-zinc-500 mt-1">
              {totalMonthlyHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} hours/month recovered across {recommendations.length} automation targets
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500 mb-0.5">Monthly</p>
            <p className="text-xl font-semibold text-green-400/80 tabular-nums">
              ${totalMonthlyCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-zinc-400">
                <InlineTooltip text="Average fully-loaded hourly cost per FTE — includes salary, benefits, overhead">
                  Hourly Rate
                </InlineTooltip>
              </label>
              <span className="text-sm font-mono text-zinc-200">${hourlyRate}/hr</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value))}
              className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-blue-500"
              aria-label="Hourly rate slider"
            />
            <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
              <span>$10</span>
              <span>$100</span>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-zinc-400">
                <InlineTooltip text="Estimated monthly case volume — adjust to match production throughput">
                  Cases / Month
                </InlineTooltip>
              </label>
              <span className="text-sm font-mono text-zinc-200">{casesPerMonth.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={Math.max(1, Math.floor(pipeline.statistics.total_cases / 10))}
              max={pipeline.statistics.total_cases * 5}
              step={Math.max(1, Math.floor(pipeline.statistics.total_cases / 50))}
              value={casesPerMonth}
              onChange={(e) => setCasesPerMonth(Number(e.target.value))}
              className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-blue-500"
              aria-label="Monthly cases slider"
            />
            <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
              <span>{Math.max(1, Math.floor(pipeline.statistics.total_cases / 10)).toLocaleString()}</span>
              <span>{(pipeline.statistics.total_cases * 5).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <CollapsibleSection
        title="Savings Breakdown"
        tooltip="Per-recommendation savings estimate based on time saved per case, case volume, and hourly rate"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium">Target</th>
                <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">Time Saved/Case</th>
                <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">Cases Affected</th>
                <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">Monthly Hours</th>
                <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">Monthly Savings</th>
              </tr>
            </thead>
            <tbody>
              {breakdown
                .sort((a, b) => b.monthlyCostSaved - a.monthlyCostSaved)
                .map(({ rec, monthlyHoursSaved, monthlyCostSaved }) => (
                  <tr key={rec.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-4 py-2 text-zinc-200">{rec.target}</td>
                    <td className="px-4 py-2 text-right font-mono text-zinc-400">
                      {formatDuration(rec.estimated_time_saved_seconds)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-zinc-400">
                      {rec.affected_cases_percentage.toFixed(0)}%
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-zinc-400">
                      {monthlyHoursSaved.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-green-400">
                      ${monthlyCostSaved.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>
    </div>
  );
}
