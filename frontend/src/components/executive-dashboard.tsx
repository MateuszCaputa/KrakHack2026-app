'use client';

import { useMemo } from 'react';
import type { PipelineOutput, CopilotOutput, Activity } from '@/lib/types';
import { formatDuration } from '@/lib/utils';
import { normalizeActivityName, formatBottleneckTransition } from '@/lib/format-names';
import { BottleneckInsight } from './bottleneck-insight';

const HOURLY_RATE = 50; // € per hour — conservative loaded cost
const PASSIVE_APPS = new Set(['Teams', 'Outlook', 'New Outlook', 'Slack', 'Gmail', 'Zoom', 'Meet']);

interface ExecutiveDashboardProps {
  pipeline: PipelineOutput;
  copilot?: CopilotOutput | null;
  onNavigate?: (tab: string, prefill?: string) => void;
}

interface Win {
  tag: string;
  tagColor: string;
  title: string;
  why: string;
  question: string;
  eurPerMonth: number;
  hoursPerMonth: number;
}

function formatEur(n: number): string {
  return n >= 1000 ? `€${(n / 1000).toFixed(1)}k` : `€${Math.round(n)}`;
}

function classifyActivity(a: Activity): 'core' | 'copy_paste' | 'coordination' {
  const name = a.name.toLowerCase();
  if (
    name.includes('communication') ||
    name.includes('meeting') ||
    name.includes('email') ||
    a.applications.every(app => PASSIVE_APPS.has(app))
  ) return 'coordination';
  const rate = a.copy_paste_count / Math.max(1, a.avg_duration_seconds / 60);
  return rate >= 0.3 || a.copy_paste_count >= 60 ? 'copy_paste' : 'core';
}

export function ExecutiveDashboard({ pipeline, copilot, onNavigate }: ExecutiveDashboardProps) {
  const { statistics: stats, bottlenecks, activities } = pipeline;

  const monthlyMultiplier = useMemo(() => {
    const days = Math.max(
      1,
      (new Date(stats.end_date).getTime() - new Date(stats.start_date).getTime()) / 86_400_000
    );
    return 30 / days;
  }, [stats]);

  // ── Total monthly waste cost ────────────────────────────────────────────────
  const { monthlyWasteHours, monthlyCost } = useMemo(() => {
    const totalWaitSeconds = bottlenecks.reduce(
      (s, bn) => s + bn.avg_wait_seconds * bn.case_count, 0
    );
    const hrs = (totalWaitSeconds / 3600) * monthlyMultiplier;
    return { monthlyWasteHours: hrs, monthlyCost: Math.round(hrs * HOURLY_RATE) };
  }, [bottlenecks, monthlyMultiplier]);

  // ── Time breakdown for donut ────────────────────────────────────────────────
  const timeBreakdown = useMemo(() => {
    const totals = { core: 0, copy_paste: 0, coordination: 0 };
    activities.forEach(a => {
      const cls = classifyActivity(a);
      totals[cls] += a.avg_duration_seconds * a.frequency;
    });
    const waitSecs = bottlenecks.reduce((s, bn) => s + bn.avg_wait_seconds * bn.case_count, 0);
    const grand = totals.core + totals.copy_paste + totals.coordination + waitSecs;
    const pct = (v: number) => Math.round((v / grand) * 100);
    return {
      core: pct(totals.core),
      copy_paste: pct(totals.copy_paste),
      coordination: pct(totals.coordination),
      waiting: pct(waitSecs),
    };
  }, [activities, bottlenecks]);

  // ── Top wins ────────────────────────────────────────────────────────────────
  const wins: Win[] = useMemo(() => {
    if (copilot?.recommendations?.length) {
      return [...copilot.recommendations]
        .sort((a, b) => b.estimated_time_saved_seconds - a.estimated_time_saved_seconds)
        .slice(0, 3)
        .map(r => {
          // estimated_time_saved_seconds = total observed time saved across all cases in dataset
          // scale to monthly only — no case multiplication to avoid inflation
          const hrs = (r.estimated_time_saved_seconds / 3600) * monthlyMultiplier;
          return {
            tag: r.automation_type,
            tagColor: r.impact === 'high' ? '#22c55e' : r.impact === 'medium' ? '#f59e0b' : '#818cf8',
            title: r.target.length > 60 ? r.target.slice(0, 57) + '…' : r.target,
            why: r.reasoning.split('.')[0] + '.',
            question: `We have an automation opportunity: "${r.target}". ${r.reasoning} What specific steps should we take to implement this and what savings can we expect?`,
            eurPerMonth: Math.round(hrs * HOURLY_RATE),
            hoursPerMonth: Math.round(hrs),
          };
        });
    }

    // Derive wins from pipeline data when copilot not yet run
    const derived: Win[] = [];

    // Win 1: biggest bottleneck
    const worstBn = [...bottlenecks].sort(
      (a, b) => b.avg_wait_seconds * b.case_count - a.avg_wait_seconds * a.case_count
    )[0];
    if (worstBn) {
      const hrs = (worstBn.avg_wait_seconds * worstBn.case_count / 3600) * monthlyMultiplier;
      derived.push({
        tag: 'Fix Bottleneck',
        tagColor: '#f43f5e',
        title: (() => {
          const t = formatBottleneckTransition(worstBn.from_activity, worstBn.to_activity);
          return t.isReworkLoop ? normalizeActivityName(worstBn.from_activity) : `${t.from} → ${t.to}`;
        })(),
        why: (() => {
          const t = formatBottleneckTransition(worstBn.from_activity, worstBn.to_activity);
          return t.isReworkLoop
            ? `Employees repeatedly return to this step — ${formatDuration(worstBn.avg_wait_seconds)} avg delay each time. Indicates corrections or interruptions that automation can prevent.`
            : `Average ${formatDuration(worstBn.avg_wait_seconds)} idle wait between these steps. Automating the handoff eliminates the delay entirely.`;
        })(),
        question: (() => {
          const t = formatBottleneckTransition(worstBn.from_activity, worstBn.to_activity);
          return t.isReworkLoop
            ? `Employees keep returning to "${t.from}" instead of finishing it in one go — average delay ${formatDuration(worstBn.avg_wait_seconds)} per return, ${worstBn.case_count} cases affected. What is the most likely cause and what is the single most effective fix?`
            : `There is an average ${formatDuration(worstBn.avg_wait_seconds)} idle wait between "${t.from}" and "${t.to}" across ${worstBn.case_count} cases. What is causing this gap and how can we eliminate it?`;
        })(),
        eurPerMonth: Math.round(hrs * HOURLY_RATE),
        hoursPerMonth: Math.round(hrs),
      });
    }

    // Win 2: highest copy-paste activity
    const topCopyPaste = [...activities].sort((a, b) => b.copy_paste_count - a.copy_paste_count)[0];
    if (topCopyPaste) {
      // copy_paste_count = total observed operations across dataset; 8s per operation is conservative
      const hrs = (topCopyPaste.copy_paste_count * 8 / 3600) * monthlyMultiplier;
      derived.push({
        tag: 'RPA',
        tagColor: '#f59e0b',
        title: normalizeActivityName(topCopyPaste.name),
        why: `${topCopyPaste.copy_paste_count} manual copy-paste operations per case across ${topCopyPaste.applications.slice(0, 2).join(' and ')}. Classic RPA target.`,
        question: `Employees perform ${topCopyPaste.copy_paste_count} manual copy-paste operations per case in "${normalizeActivityName(topCopyPaste.name)}" across ${topCopyPaste.applications.slice(0, 2).join(' and ')}. What RPA solution would eliminate this and how would we implement it?`,
        eurPerMonth: Math.round(hrs * HOURLY_RATE),
        hoursPerMonth: Math.round(hrs),
      });
    }

    // Win 3: most context-switch heavy
    const topCtx = [...activities]
      .filter(a => a.context_switch_count > 0)
      .sort((a, b) => b.context_switch_count - a.context_switch_count)[0];
    if (topCtx) {
      // context_switch_count = total observed switches; 30s re-focus cost per switch is conservative
      const hrs = (topCtx.context_switch_count * 30 / 3600) * monthlyMultiplier;
      derived.push({
        tag: 'Eliminate',
        tagColor: '#818cf8',
        title: normalizeActivityName(topCtx.name),
        why: `${topCtx.context_switch_count} app switches per case. Every switch costs ~90 s of re-focus time. Consolidate to one tool.`,
        question: `Employees switch between ${topCtx.context_switch_count} different applications per case while working on "${normalizeActivityName(topCtx.name)}". What is the best way to consolidate this and reduce the constant context switching?`,
        eurPerMonth: Math.round(hrs * HOURLY_RATE),
        hoursPerMonth: Math.round(hrs),
      });
    }

    return derived;
  }, [copilot, bottlenecks, activities, monthlyMultiplier, stats.total_cases]);

  // ── Worst bottleneck ────────────────────────────────────────────────────────
  const worstBn = useMemo(() =>
    [...bottlenecks].sort((a, b) =>
      b.avg_wait_seconds * b.case_count - a.avg_wait_seconds * a.case_count
    )[0],
    [bottlenecks]
  );

  const bnFmt = worstBn
    ? formatBottleneckTransition(worstBn.from_activity, worstBn.to_activity)
    : null;

const totalPotentialSavings = wins.reduce((s, w) => s + w.eurPerMonth, 0);
  const wastePct = timeBreakdown.copy_paste + timeBreakdown.waiting + timeBreakdown.coordination;

  // Donut: conic-gradient segments (core → copy_paste → coordination → waiting)
  const donutGradient = (() => {
    const c = timeBreakdown;
    const segments = [
      { pct: c.core, color: '#22c55e' },
      { pct: c.copy_paste, color: '#f59e0b' },
      { pct: c.coordination, color: '#818cf8' },
      { pct: c.waiting, color: '#f43f5e' },
    ];
    let cursor = 0;
    const parts = segments.map(s => {
      const from = cursor;
      cursor += s.pct;
      return `${s.color} ${from}% ${cursor}%`;
    });
    return `conic-gradient(${parts.join(', ')})`;
  })();

  return (
    <div className="space-y-6">

      {/* ── HERO ── */}
      <div
        className={`relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 px-8 py-8${onNavigate ? ' cursor-pointer hover:ring-1 hover:ring-amber-500/20 transition-all' : ''}`}
        onClick={onNavigate ? () => onNavigate('impact') : undefined}
      >
        {/* Subtle red glow behind the number */}
        <div className="absolute -top-10 -left-10 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1 font-medium">
            Monthly cost of unautomated manual work
          </p>
          <div className="flex items-end gap-4 flex-wrap">
            <span className="text-7xl font-black text-red-400 leading-none tabular-nums">
              {formatEur(monthlyCost)}
            </span>
            <div className="mb-2 space-y-0.5">
              <p className="text-zinc-300 text-lg font-medium">walking out the door</p>
              <p className="text-zinc-500 text-sm">
                {Math.round(monthlyWasteHours)}h of idle wait · {stats.total_users} employees · {stats.total_cases} cases analyzed
              </p>
            </div>
          </div>

          {/* 3 inline stat pills */}
          <div className="flex gap-3 flex-wrap mt-5">
            {[
              { label: 'Automation Waste', value: `${wastePct}% of work time`, accent: 'text-red-400', tab: 'overview' },
              { label: 'Avg Case Duration', value: formatDuration(stats.avg_case_duration_seconds), accent: 'text-zinc-200', tab: 'variants' },
              { label: 'Potential Monthly Savings', value: formatEur(totalPotentialSavings), accent: 'text-green-400', tab: 'impact' },
            ].map(s => (
              <div
                key={s.label}
                className={`flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-1.5${onNavigate ? ' cursor-pointer hover:ring-1 hover:ring-amber-500/20 transition-all' : ''}`}
                onClick={onNavigate ? (e) => { e.stopPropagation(); onNavigate(s.tab); } : undefined}
              >
                <span className="text-xs text-zinc-500">{s.label}</span>
                <span className={`text-xs font-semibold ${s.accent}`}>{s.value}</span>
              </div>
            ))}
          </div>
          {onNavigate && <p className="text-zinc-600 text-[10px] text-right mt-2">View details →</p>}
        </div>
      </div>

      {/* ── TOP 3 WINS ── */}
      <div>
        <p className="text-xs uppercase tracking-widest text-zinc-500 font-medium mb-3">
          Top automation wins — act on these first
        </p>
        <div className="grid grid-cols-3 gap-4">
          {wins.map((win, i) => (
            <div
              key={i}
              className={`relative bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3 overflow-hidden${onNavigate ? ' cursor-pointer hover:ring-1 hover:ring-amber-500/20 transition-all' : ''}`}
              onClick={onNavigate ? () => onNavigate('ai', win.question) : undefined}
            >
              {/* Rank */}
              <div className="absolute top-4 right-4 text-3xl font-black text-zinc-800 select-none leading-none">
                #{i + 1}
              </div>
              {/* Tag */}
              <div
                className="inline-flex self-start text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                style={{ backgroundColor: win.tagColor + '22', color: win.tagColor }}
              >
                {win.tag}
              </div>
              {/* Title */}
              <p className="text-sm font-semibold text-zinc-100 leading-snug pr-6">{win.title}</p>
              {/* Why */}
              <p className="text-xs text-zinc-400 leading-relaxed flex-1">{win.why}</p>
              {/* Savings */}
              <div className="border-t border-zinc-800 pt-3 flex items-end justify-between">
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wide">Save per month</p>
                  <p className="text-2xl font-black text-green-400">{formatEur(win.eurPerMonth)}</p>
                </div>
                <p className="text-xs text-zinc-500">{win.hoursPerMonth}h recovered</p>
              </div>
              {onNavigate && <p className="text-zinc-600 text-[10px] text-right">View details →</p>}
            </div>
          ))}
        </div>
      </div>

      {/* ── MIDDLE ROW: donut + worst bottleneck ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Time breakdown */}
        <div
          className={`bg-zinc-900 border border-zinc-800 rounded-xl p-6${onNavigate ? ' cursor-pointer hover:ring-1 hover:ring-amber-500/20 transition-all' : ''}`}
          onClick={onNavigate ? () => onNavigate('overview') : undefined}
        >
          <p className="text-xs uppercase tracking-widest text-zinc-500 font-medium mb-4">
            Where time actually goes
          </p>
          <div className="flex items-center gap-6">
            {/* Donut */}
            <div className="relative w-36 h-36 shrink-0">
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: donutGradient }}
              />
              <div className="absolute inset-5 rounded-full bg-zinc-900 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-white">{wastePct}%</span>
                <span className="text-[11px] text-zinc-400 uppercase tracking-wide">waste</span>
              </div>
            </div>
            {/* Legend */}
            <div className="space-y-2.5 flex-1">
              {[
                { color: '#22c55e', label: 'Core Work', pct: timeBreakdown.core },
                { color: '#f59e0b', label: 'Manual Data Transfer', pct: timeBreakdown.copy_paste },
                { color: '#818cf8', label: 'Coordination', pct: timeBreakdown.coordination },
                { color: '#f43f5e', label: 'Waiting / Blocked', pct: timeBreakdown.waiting },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-zinc-400 flex-1">{item.label}</span>
                  <span className="text-xs font-semibold text-zinc-200 tabular-nums">{item.pct}%</span>
                </div>
              ))}
            </div>
          </div>
          {onNavigate && <p className="text-zinc-600 text-[10px] text-right mt-2">View details →</p>}
        </div>

        {/* Worst bottleneck */}
        {worstBn && bnFmt && (
          <div
            className={`bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4${onNavigate ? ' cursor-pointer hover:ring-1 hover:ring-amber-500/20 transition-all' : ''}`}
            onClick={onNavigate ? () => onNavigate('bottlenecks') : undefined}
          >
            <p className="text-xs uppercase tracking-widest text-zinc-500 font-medium">
              Biggest single bottleneck
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className="shrink-0 text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                style={{ backgroundColor: '#f43f5e22', color: '#f43f5e' }}
              >
                {worstBn.severity}
              </div>
              {bnFmt.isReworkLoop && (
                <span className="text-xs text-amber-400 bg-amber-950/40 border border-amber-900/40 px-2 py-0.5 rounded font-semibold">
                  ↩ Repeated task — not finishing in one go
                </span>
              )}
            </div>
            {!bnFmt.isReworkLoop && (
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100 flex-wrap">
                <span className="bg-zinc-800 px-2 py-1 rounded">{bnFmt.from}</span>
                <span className="text-zinc-500 text-lg">→</span>
                <span className="bg-zinc-800 px-2 py-1 rounded">{bnFmt.to}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">Avg wait</p>
                <p className="text-2xl font-black text-red-400">{formatDuration(worstBn.avg_wait_seconds)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">Cases affected</p>
                <p className="text-2xl font-black text-zinc-200">{worstBn.case_count}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-zinc-400 uppercase tracking-wide">Total labor lost</p>
                <p className="text-lg font-bold text-zinc-300">
                  {Math.round(worstBn.avg_wait_seconds * worstBn.case_count / 3600)}h
                  <span className="text-zinc-500 font-normal text-xs ml-1.5">
                    = {formatEur(Math.round(worstBn.avg_wait_seconds * worstBn.case_count / 3600 * HOURLY_RATE))}
                  </span>
                </p>
              </div>
            </div>
            <BottleneckInsight bottleneck={worstBn} />
            {onNavigate && <p className="text-zinc-600 text-[10px] text-right">View details →</p>}
          </div>
        )}
      </div>

      {/* ── BOTTOM: process stats strip ── */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Users observed', value: stats.total_users, tab: 'journey' },
          { label: 'Applications used', value: stats.total_applications, tab: 'overview' },
          { label: 'Process variants', value: stats.total_variants, note: 'paths diverge from standard', tab: 'variants' },
          { label: 'Total interactions', value: stats.total_events.toLocaleString(), tab: 'overview' },
          { label: 'Bottlenecks detected', value: bottlenecks.length, note: `${bottlenecks.filter(b => b.severity === 'critical' || b.severity === 'high').length} critical/high`, tab: 'bottlenecks' },
        ].map(s => (
          <div
            key={s.label}
            className={`bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center${onNavigate ? ' cursor-pointer hover:ring-1 hover:ring-amber-500/20 transition-all' : ''}`}
            onClick={onNavigate ? () => onNavigate(s.tab) : undefined}
          >
            <p className="text-2xl font-black text-zinc-100">{s.value}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{s.label}</p>
            {s.note && <p className="text-[11px] text-zinc-500 mt-0.5">{s.note}</p>}
          </div>
        ))}
      </div>

    </div>
  );
}
