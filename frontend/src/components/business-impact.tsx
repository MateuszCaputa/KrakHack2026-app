'use client';

import { useState, useMemo } from 'react';
import type { PipelineOutput } from '@/lib/types';
import { formatDuration } from '@/lib/utils';

// Research-backed constants
const COPY_PASTE_OVERHEAD_SECONDS = 30;
const CONTEXT_SWITCH_COST_SECONDS = 23;
const WORKING_DAYS_PER_MONTH = 21;
const DEFAULT_HOURLY_RATE = 35;

// ─── Wage helpers ─────────────────────────────────────────────────────────────

export type WageMode = 'uniform' | 'individual';

export interface WageConfig {
  mode: WageMode;
  uniform: number;
  individual: Record<string, number>; // userId → €/hr
}

export function defaultWageConfig(): WageConfig {
  return { mode: 'uniform', uniform: DEFAULT_HOURLY_RATE, individual: {} };
}

function rateFor(userId: string, wages: WageConfig): number {
  if (wages.mode === 'uniform') return wages.uniform;
  return wages.individual[userId] ?? wages.uniform;
}

/** Parse natural-language wage input into a per-user map.
 *  Accepts: "35" | "45,35,50" | "User A: 45, User B: 35" | "A=45 B=35" */
function parseWageText(
  text: string,
  userIds: string[],
  userLabels: Record<string, string>,
): Record<string, number> | null {
  const t = text.trim();
  if (!t) return null;

  // Single number → everyone gets it
  const single = t.match(/^€?\s*(\d+(?:\.\d+)?)\s*(?:\/h(?:r|our)?)?$/);
  if (single) {
    const rate = parseFloat(single[1]);
    return Object.fromEntries(userIds.map((id) => [id, rate]));
  }

  // CSV of numbers → assign to users in order (wrap if fewer numbers than users)
  const csvOnly = /^[\d\s,€.\/hrHR]+$/.test(t);
  if (csvOnly) {
    const nums = t.match(/\d+(?:\.\d+)?/g)?.map(Number);
    if (nums?.length) {
      return Object.fromEntries(userIds.map((id, i) => [id, nums[i % nums.length]]));
    }
  }

  // "Label: N" or "Label=N" pairs — match against user labels
  const pairPattern = /([A-Za-z][A-Za-z0-9 ]+?)\s*[:=]\s*€?\s*(\d+(?:\.\d+)?)/g;
  const pairs: [string, number][] = [];
  let m;
  while ((m = pairPattern.exec(t)) !== null) {
    pairs.push([m[1].trim().toLowerCase(), parseFloat(m[2])]);
  }
  if (pairs.length > 0) {
    const result: Record<string, number> = {};
    for (const [id] of Object.entries(userLabels)) {
      const label = userLabels[id].toLowerCase();
      const match = pairs.find(([key]) => label.includes(key) || key.includes(label.replace('user ', '')));
      if (match) result[id] = match[1];
    }
    if (Object.keys(result).length > 0) return result;
  }

  return null;
}

// ─── Waste computation ────────────────────────────────────────────────────────

interface UserWaste {
  userId: string;
  label: string;
  bottleneckWaitPerDay: number;
  copyPastePerDay: number;
  contextSwitchPerDay: number;
  totalPerDay: number;
  monthlyCost: number;
  topWasteSource: string;
  activityCount: number;
}

interface TeamWaste {
  totalPerDay: number;
  bottleneckWaitPerDay: number;
  copyPastePerDay: number;
  contextSwitchPerDay: number;
  monthlyCost: number;
  annualCost: number;
  daysInDataset: number;
  perUser: UserWaste[];
}

function computeTeamWaste(pipeline: PipelineOutput, wages: WageConfig): TeamWaste {
  const { statistics: stats, bottlenecks, activities } = pipeline;
  const performers = pipeline.performer_stats ?? [];

  const startMs = new Date(stats.start_date).getTime();
  const endMs = new Date(stats.end_date).getTime();
  const daysInDataset = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

  const userLabels = Object.fromEntries(
    performers.map((p, i) => [p.user, `User ${String.fromCharCode(65 + i)}`]),
  );

  // Total team waste
  const totalBnWait = bottlenecks.reduce((s, bn) => s + bn.avg_wait_seconds * (bn.case_count ?? 1), 0);
  const totalCopyPaste = activities.reduce((s, a) => s + a.copy_paste_count, 0);
  const totalCtxSwitch = activities.reduce((s, a) => s + a.context_switch_count, 0);

  const bnPerDay = totalBnWait / daysInDataset;
  const cpPerDay = (totalCopyPaste * COPY_PASTE_OVERHEAD_SECONDS) / daysInDataset;
  const ctxPerDay = (totalCtxSwitch * CONTEXT_SWITCH_COST_SECONDS) / daysInDataset;
  const totalPerDay = bnPerDay + cpPerDay + ctxPerDay;

  // Per-user waste (proportional share by performer count on each activity)
  const perUser: UserWaste[] = performers.map((p) => {
    const myActivities = activities.filter((a) => a.performers.includes(p.user));
    const share = myActivities.length;

    let userCopyPaste = 0;
    let userCtxSwitch = 0;
    for (const act of myActivities) {
      const split = Math.max(act.performers.length, 1);
      userCopyPaste += act.copy_paste_count / split;
      userCtxSwitch += act.context_switch_count / split;
    }

    // Bottleneck share: transitions involving this user's activities
    const myActivityNames = new Set(myActivities.map((a) => a.name));
    const myBns = bottlenecks.filter(
      (bn) => myActivityNames.has(bn.from_activity) || myActivityNames.has(bn.to_activity),
    );
    // Divide bottleneck wait by avg performer count of involved activities
    const userBnWait = myBns.reduce((s, bn) => {
      const involvedActs = activities.filter(
        (a) => (a.name === bn.from_activity || a.name === bn.to_activity) && a.performers.includes(p.user),
      );
      const avgSplit = involvedActs.length > 0
        ? involvedActs.reduce((sum, a) => sum + Math.max(a.performers.length, 1), 0) / involvedActs.length
        : 1;
      return s + (bn.avg_wait_seconds * (bn.case_count ?? 1)) / avgSplit;
    }, 0);

    const userBnPerDay = userBnWait / daysInDataset;
    const userCpPerDay = (userCopyPaste * COPY_PASTE_OVERHEAD_SECONDS) / daysInDataset;
    const userCtxPerDay = (userCtxSwitch * CONTEXT_SWITCH_COST_SECONDS) / daysInDataset;
    const userTotalPerDay = userBnPerDay + userCpPerDay + userCtxPerDay;

    const hourlyRate = rateFor(p.user, wages);
    const monthlyCost = (userTotalPerDay / 3600) * hourlyRate * WORKING_DAYS_PER_MONTH;

    const topSource =
      userBnPerDay >= userCpPerDay && userBnPerDay >= userCtxPerDay
        ? 'Waiting'
        : userCpPerDay >= userCtxPerDay
        ? 'Copy-paste'
        : 'Context switching';

    return {
      userId: p.user,
      label: userLabels[p.user] ?? p.user.slice(0, 8),
      bottleneckWaitPerDay: userBnPerDay,
      copyPastePerDay: userCpPerDay,
      contextSwitchPerDay: userCtxPerDay,
      totalPerDay: userTotalPerDay,
      monthlyCost,
      topWasteSource: topSource,
      activityCount: share,
    };
  });

  const monthlyCost = perUser.reduce((s, u) => s + u.monthlyCost, 0);

  return {
    totalPerDay,
    bottleneckWaitPerDay: bnPerDay,
    copyPastePerDay: cpPerDay,
    contextSwitchPerDay: ctxPerDay,
    monthlyCost,
    annualCost: monthlyCost * 12,
    daysInDataset,
    perUser,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function fmt(seconds: number) {
  const h = seconds / 3600;
  return h >= 10 ? `${Math.round(h)}h` : h < 0.017 ? '<1m' : `${h.toFixed(1)}h`;
}

function fmtEur(n: number) {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}k`;
  return `€${Math.round(n)}`;
}

function WasteBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Wage configurator ────────────────────────────────────────────────────────

function WageConfigurator({
  wages,
  onChange,
  userIds,
  userLabels,
}: {
  wages: WageConfig;
  onChange: (w: WageConfig) => void;
  userIds: string[];
  userLabels: Record<string, string>;
}) {
  const [quickText, setQuickText] = useState('');
  const [parseError, setParseError] = useState(false);

  function applyQuick() {
    const result = parseWageText(quickText, userIds, userLabels);
    if (!result) { setParseError(true); return; }
    setParseError(false);
    setQuickText('');
    onChange({ ...wages, mode: 'individual', individual: { ...wages.individual, ...result } });
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Wage Configuration</h3>
        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-0.5">
          {(['uniform', 'individual'] as WageMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onChange({ ...wages, mode: m })}
              className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-all ${
                wages.mode === m
                  ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {m === 'uniform' ? 'Same for all' : 'Individual'}
            </button>
          ))}
        </div>
      </div>

      {wages.mode === 'uniform' ? (
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">Hourly rate for all users</span>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 text-sm">€</span>
            <input
              type="number"
              min={1}
              max={999}
              value={wages.uniform}
              onChange={(e) => onChange({ ...wages, uniform: Math.max(1, Number(e.target.value)) })}
              className="w-20 px-2 py-1 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-center focus:outline-none focus:border-zinc-500 [appearance:textfield]"
            />
            <span className="text-zinc-500 text-xs">/hr</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Quick-set parser */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={quickText}
                onChange={(e) => { setQuickText(e.target.value); setParseError(false); }}
                onKeyDown={(e) => e.key === 'Enter' && applyQuick()}
                placeholder='Quick set: "35" · "45, 35, 50" · "User A: 45, User B: 35"'
                className={`w-full px-3 py-1.5 text-xs bg-zinc-800 border rounded-lg text-zinc-200 placeholder:text-zinc-500 focus:outline-none transition-colors ${
                  parseError ? 'border-red-600 focus:border-red-500' : 'border-zinc-700 focus:border-zinc-500'
                }`}
              />
              {parseError && (
                <p className="absolute top-full mt-1 left-0 text-[10px] text-red-400">
                  Couldn't parse — try "User A: 45, User B: 35" or just "35"
                </p>
              )}
            </div>
            <button
              onClick={applyQuick}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg border border-zinc-600 transition-colors flex-shrink-0"
            >
              Apply
            </button>
          </div>

          {/* Per-user inputs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {userIds.map((id) => {
              const label = userLabels[id] ?? id.slice(0, 8);
              const rate = wages.individual[id] ?? wages.uniform;
              return (
                <div key={id} className="flex items-center gap-1.5 bg-zinc-800/60 border border-zinc-700/60 rounded-lg px-3 py-2">
                  <span className="text-xs text-zinc-400 flex-1 truncate">{label}</span>
                  <span className="text-zinc-500 text-xs">€</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={rate}
                    onChange={(e) =>
                      onChange({
                        ...wages,
                        individual: { ...wages.individual, [id]: Math.max(1, Number(e.target.value)) },
                      })
                    }
                    className="w-12 bg-transparent text-xs text-zinc-200 text-right focus:outline-none [appearance:textfield]"
                  />
                  <span className="text-zinc-500 text-[10px]">/h</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCards({ waste }: { waste: TeamWaste }) {
  const cards = [
    {
      label: 'Lost per day',
      value: fmt(waste.totalPerDay),
      sub: 'team total',
      color: 'text-amber-400',
      border: 'border-amber-900/40',
      bg: 'from-amber-900/10',
    },
    {
      label: 'Monthly cost',
      value: fmtEur(waste.monthlyCost),
      sub: `${WORKING_DAYS_PER_MONTH} working days`,
      color: 'text-red-400',
      border: 'border-red-900/40',
      bg: 'from-red-900/10',
    },
    {
      label: 'Annual cost',
      value: fmtEur(waste.annualCost),
      sub: 'if nothing changes',
      color: 'text-red-400',
      border: 'border-red-900/30',
      bg: 'from-red-900/5',
    },
    {
      label: 'Data period',
      value: `${waste.daysInDataset}d`,
      sub: 'of recorded sessions',
      color: 'text-zinc-300',
      border: 'border-zinc-800',
      bg: 'from-transparent',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`relative overflow-hidden rounded-xl border ${c.border} bg-zinc-900 p-4`}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${c.bg} via-transparent to-transparent pointer-events-none`} />
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{c.label}</p>
          <p className={`text-2xl font-bold tabular-nums ${c.color}`}>{c.value}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Waste breakdown bars ────────────────────────────────────────────────────

function WasteBreakdown({ waste }: { waste: TeamWaste }) {
  const rows = [
    {
      label: 'Bottleneck wait time',
      value: waste.bottleneckWaitPerDay,
      note: 'idle time between process steps',
      color: 'bg-red-500/70',
    },
    {
      label: 'Manual copy-paste',
      value: waste.copyPastePerDay,
      note: `~${COPY_PASTE_OVERHEAD_SECONDS}s overhead per operation`,
      color: 'bg-amber-500/70',
    },
    {
      label: 'Context switching',
      value: waste.contextSwitchPerDay,
      note: `~${CONTEXT_SWITCH_COST_SECONDS}s re-focus cost per switch`,
      color: 'bg-orange-500/70',
    },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-zinc-200">Waste Breakdown</h3>
      <div className="space-y-3.5">
        {rows.map((r) => {
          const pct = waste.totalPerDay > 0 ? (r.value / waste.totalPerDay) * 100 : 0;
          return (
            <div key={r.label} className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">
                  {r.label}
                  <span className="text-zinc-500 ml-2 text-[10px]">{r.note}</span>
                </span>
                <span className="font-mono text-zinc-400 tabular-nums">
                  {fmt(r.value)}/day
                  <span className="text-zinc-500 ml-1">({Math.round(pct)}%)</span>
                </span>
              </div>
              <WasteBar value={r.value} max={waste.totalPerDay} color={r.color} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Per-user table ───────────────────────────────────────────────────────────

function PerUserTable({
  users,
  selectedId,
  onSelect,
  renderDrillDown,
}: {
  users: UserWaste[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  renderDrillDown?: (user: UserWaste) => React.ReactNode;
}) {
  const maxWaste = Math.max(...users.map((u) => u.totalPerDay), 1);
  const sorted = [...users].sort((a, b) => b.totalPerDay - a.totalPerDay);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Per-User Breakdown</h3>
        <span className="text-[10px] text-zinc-500">click a row to drill down</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-5 py-2.5 text-[11px] text-zinc-500 font-medium">User</th>
              <th className="text-right px-4 py-2.5 text-[11px] text-zinc-500 font-medium">Lost/day</th>
              <th className="text-right px-4 py-2.5 text-[11px] text-zinc-500 font-medium">Monthly cost</th>
              <th className="text-left px-4 py-2.5 text-[11px] text-zinc-500 font-medium">Top waste</th>
              <th className="px-4 py-2.5 text-[11px] text-zinc-500 font-medium">Relative waste</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((u) => {
              const isSelected = selectedId === u.userId;
              return (
                <tr
                  key={u.userId}
                  onClick={() => onSelect(u.userId)}
                  className={`border-b border-zinc-800/50 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-amber-900/10 border-l-2 border-l-amber-500'
                      : 'hover:bg-zinc-800/40'
                  }`}
                >
                  <td className="px-5 py-3 text-zinc-200 font-medium">{u.label}</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-400 tabular-nums">
                    {fmt(u.totalPerDay)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-300 tabular-nums">
                    {fmtEur(u.monthlyCost)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                      {u.topWasteSource}
                    </span>
                  </td>
                  <td className="px-4 py-3 w-32">
                    <WasteBar value={u.totalPerDay} max={maxWaste} color="bg-amber-500/60" />
                  </td>
                </tr>
              );
              // Drilldown is rendered outside the table below
            })}
          </tbody>
        </table>
      </div>
      {/* Render drilldown inline right after the table, tied to selected user */}
      {selectedId && renderDrillDown && (() => {
        const selectedUser = sorted.find((u) => u.userId === selectedId);
        return selectedUser ? renderDrillDown(selectedUser) : null;
      })()}
    </div>
  );
}

// ─── User drill-down ──────────────────────────────────────────────────────────

function UserDrillDown({
  user,
  pipeline,
  wages,
}: {
  user: UserWaste;
  pipeline: PipelineOutput;
  wages: WageConfig;
}) {
  const { activities, bottlenecks } = pipeline;
  const rate = rateFor(user.userId, wages);

  const myActivities = activities
    .filter((a) => a.performers.includes(user.userId))
    .sort((a, b) => b.copy_paste_count + b.context_switch_count - (a.copy_paste_count + a.context_switch_count));

  const myActivityNames = new Set(myActivities.map((a) => a.name));
  const myBottlenecks = bottlenecks
    .filter((bn) => myActivityNames.has(bn.from_activity) || myActivityNames.has(bn.to_activity))
    .sort((a, b) => b.avg_wait_seconds - a.avg_wait_seconds)
    .slice(0, 5);

  const dailyHours = user.totalPerDay / 3600;
  const monthlySavings = dailyHours * WORKING_DAYS_PER_MONTH * rate;

  return (
    <div className="bg-zinc-900 border border-amber-900/30 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-800 bg-amber-900/5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">{user.label}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {user.activityCount} activities · €{rate}/hr · automating their waste saves {fmtEur(monthlySavings)}/mo
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-amber-400 tabular-nums">{fmt(user.totalPerDay)}</p>
            <p className="text-[10px] text-zinc-500">lost per day</p>
          </div>
        </div>

        {/* Mini breakdown */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: 'Waiting', value: user.bottleneckWaitPerDay, color: 'text-red-400' },
            { label: 'Copy-paste', value: user.copyPastePerDay, color: 'text-amber-400' },
            { label: 'Ctx switches', value: user.contextSwitchPerDay, color: 'text-orange-400' },
          ].map((item) => (
            <div key={item.label} className="bg-zinc-800/60 rounded-lg px-3 py-2 text-center">
              <p className={`text-sm font-mono font-semibold ${item.color}`}>{fmt(item.value)}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{item.label}/day</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
        {/* Top activities by waste */}
        <div className="p-5">
          <p className="text-xs font-medium text-zinc-400 mb-3">Their most wasteful activities</p>
          <div className="space-y-2">
            {myActivities.slice(0, 5).map((act) => {
              const wasteScore = act.copy_paste_count * COPY_PASTE_OVERHEAD_SECONDS +
                act.context_switch_count * CONTEXT_SWITCH_COST_SECONDS;
              return (
                <div key={act.name} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-zinc-300 truncate flex-1">{act.name}</span>
                  <div className="flex gap-2 flex-shrink-0">
                    {act.copy_paste_count > 0 && (
                      <span className="text-amber-500/80 font-mono">{act.copy_paste_count} cp</span>
                    )}
                    {act.context_switch_count > 0 && (
                      <span className="text-orange-500/80 font-mono">{act.context_switch_count} sw</span>
                    )}
                    <span className="text-zinc-500 font-mono">{fmt(wasteScore)}</span>
                  </div>
                </div>
              );
            })}
            {myActivities.length === 0 && (
              <p className="text-xs text-zinc-500">No activity data for this user.</p>
            )}
          </div>
        </div>

        {/* Top bottlenecks */}
        <div className="p-5">
          <p className="text-xs font-medium text-zinc-400 mb-3">Bottlenecks they're stuck in</p>
          <div className="space-y-2">
            {myBottlenecks.map((bn, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-zinc-500 flex-shrink-0 font-mono w-4">{i + 1}.</span>
                <span className="text-zinc-400 truncate flex-1">
                  {bn.from_activity.slice(0, 18)}{bn.from_activity.length > 18 ? '…' : ''}
                  <span className="text-zinc-500 mx-1">→</span>
                  {bn.to_activity.slice(0, 18)}{bn.to_activity.length > 18 ? '…' : ''}
                </span>
                <span className="text-red-400 font-mono flex-shrink-0">
                  {formatDuration(bn.avg_wait_seconds)}
                </span>
              </div>
            ))}
            {myBottlenecks.length === 0 && (
              <p className="text-xs text-zinc-500">No bottlenecks linked to their activities.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

interface BusinessImpactProps {
  pipeline: PipelineOutput;
  wages: WageConfig;
  onWagesChange: (w: WageConfig) => void;
}

export function BusinessImpact({ pipeline, wages, onWagesChange }: BusinessImpactProps) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const performers = pipeline.performer_stats ?? [];
  const userIds = performers.map((p) => p.user);
  const userLabels = Object.fromEntries(
    performers.map((p, i) => [p.user, `User ${String.fromCharCode(65 + i)}`]),
  );

  const waste = useMemo(
    () => computeTeamWaste(pipeline, wages),
    [pipeline, wages],
  );

  const selectedWaste = waste.perUser.find((u) => u.userId === selectedUser) ?? null;

  function toggleUser(id: string) {
    setSelectedUser((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-5">
      <WageConfigurator
        wages={wages}
        onChange={onWagesChange}
        userIds={userIds}
        userLabels={userLabels}
      />

      <SummaryCards waste={waste} />

      <WasteBreakdown waste={waste} />

      {performers.length > 0 && (
        <PerUserTable
          users={waste.perUser}
          selectedId={selectedUser}
          onSelect={toggleUser}
          renderDrillDown={(user) => (
            <UserDrillDown user={user} pipeline={pipeline} wages={wages} />
          )}
        />
      )}

      <p className="text-[10px] text-zinc-500 px-1">
        Waste estimates: bottleneck wait time from pipeline analysis · copy-paste overhead ~{COPY_PASTE_OVERHEAD_SECONDS}s/op ·
        context-switch re-focus ~{CONTEXT_SWITCH_COST_SECONDS}s/switch (Gloria Mark, UC Irvine) ·
        per-user share proportional to performer count on each activity
      </p>
    </div>
  );
}
