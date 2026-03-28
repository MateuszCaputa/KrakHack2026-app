'use client';

import { useState, useTransition } from 'react';
import { StatCard } from './stat-card';
import { SeverityBadge } from './severity-badge';
import { RecommendationCard } from './recommendation-card';
import { BpmnViewer } from './bpmn-viewer';
import { CollapsibleSection } from './collapsible-section';
import { InlineTooltip } from './tooltip';
import { LiveMonitor } from './live-monitor';
import { HealthScore } from './health-score';
import { RoiCalculator } from './roi-calculator';
import { AskProcess } from './ask-process';
import { AutomationMatrix } from './automation-matrix';
import { BeforeAfter } from './before-after';
import { OverviewFilterBar, BottleneckFilterBar, VariantFilterBar } from './filter-bar';
import { useFilters } from '@/hooks/use-filters';
import { CategoryBreakdown, HubInsight } from './category-breakdown';
import { DataFlowInsight } from './data-flow-insight';
import { ActionCard } from './action-card';
import type { PipelineOutput, CopilotOutput, ImpactLevel, RecommendationType } from '@/lib/types';
import { formatDuration, formatDate } from '@/lib/utils';
import { runAnalysis, getBpmnXml } from '@/lib/api';
import { generateReport } from '@/lib/report';

type TabId = 'overview' | 'bottlenecks' | 'variants' | 'ai' | 'bpmn' | 'live';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'bottlenecks', label: 'Bottlenecks' },
  { id: 'variants', label: 'Process Paths' },
  { id: 'ai', label: 'AI Analysis' },
  { id: 'bpmn', label: 'Workflow Diagram' },
  { id: 'live', label: 'Live Monitor' },
];

interface CompressedSegment {
  steps: string[];
  count: number;
}

function compressSequence(seq: string[]): CompressedSegment[] {
  if (seq.length <= 6) return seq.map((s) => ({ steps: [s], count: 1 }));

  const result: CompressedSegment[] = [];
  let i = 0;

  while (i < seq.length) {
    let bestLen = 0;
    let bestCount = 0;

    // Try pattern lengths 1-4
    for (let patLen = 1; patLen <= Math.min(4, Math.floor((seq.length - i) / 2)); patLen++) {
      let count = 1;
      let j = i + patLen;
      while (j + patLen <= seq.length) {
        let match = true;
        for (let k = 0; k < patLen; k++) {
          if (seq[i + k] !== seq[j + k]) { match = false; break; }
        }
        if (!match) break;
        count++;
        j += patLen;
      }
      if (count >= 2 && count * patLen > bestCount * bestLen) {
        bestLen = patLen;
        bestCount = count;
      }
    }

    if (bestLen > 0 && bestCount >= 2) {
      result.push({ steps: seq.slice(i, i + bestLen), count: bestCount });
      i += bestLen * bestCount;
    } else {
      result.push({ steps: [seq[i]], count: 1 });
      i++;
    }
  }

  return result;
}

interface ProcessTabsProps {
  pipeline: PipelineOutput;
  processId: string;
}

export function ProcessTabs({ pipeline, processId }: ProcessTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [copilot, setCopilot] = useState<CopilotOutput | null>(null);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [bpmnXml, setBpmnXml] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [showAllBottlenecks, setShowAllBottlenecks] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [showAllApps, setShowAllApps] = useState(false);
  const [showAllPerformers, setShowAllPerformers] = useState(false);
  const [recImpact, setRecImpact] = useState<ImpactLevel[]>([]);
  const [recType, setRecType] = useState<RecommendationType[]>([]);

  const {
    filters,
    isActive: filtersActive,
    availableUsers,
    availableApps,
    filteredActivities,
    filteredBottlenecks,
    filteredPerformers,
    filteredVariants,
    toggleUser,
    toggleSeverity,
    toggleApplication,
    setSearch,
    setMinDuration,
    setMinWait,
    setMinVariantCases,
    clearTabFilters,
  } = useFilters(pipeline);

  const { statistics: stats, application_usage, copy_paste_flows } = pipeline;

  const sortedActivities = [...filteredActivities].sort((a, b) => b.frequency - a.frequency);
  const topActivities = showAllActivities ? sortedActivities : sortedActivities.slice(0, 15);

  const sortedBottlenecks = [...filteredBottlenecks].sort((a, b) => {
    const sev = { critical: 4, high: 3, medium: 2, low: 1 };
    return (sev[b.severity as keyof typeof sev] ?? 0) - (sev[a.severity as keyof typeof sev] ?? 0);
  });
  const visibleBottlenecks = showAllBottlenecks ? sortedBottlenecks : sortedBottlenecks.slice(0, 15);


  async function handleRunAnalysis() {
    setCopilotError(null);
    startTransition(async () => {
      try {
        const data = await runAnalysis(processId);
        setCopilot(data);
      } catch (err) {
        setCopilotError(err instanceof Error ? err.message : 'Analysis failed');
      }
    });
  }

  const [bpmnError, setBpmnError] = useState<string | null>(null);

  async function handleLoadBpmn() {
    setBpmnError(null);
    try {
      const xml = await getBpmnXml(processId);
      setBpmnXml(xml);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      setBpmnError(msg.includes('202') ? 'Run AI Analysis first to generate BPMN.' : `Failed to load BPMN: ${msg}`);
    }
  }

  function handleDownloadBpmn() {
    if (!bpmnXml) return;
    const blob = new Blob([bpmnXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `process-${processId}.bpmn`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportReport() {
    const html = generateReport(pipeline, copilot);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="flex items-center justify-between">
        <div />
        <button
          onClick={handleExportReport}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg border border-zinc-700 transition-colors z-10"
          aria-label="Export analysis report as HTML"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v7M3 6l3 3 3-3M1 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Export Report
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Cases"
          value={stats.total_cases.toLocaleString()}
          tooltip="Unique process executions found — more cases = more reliable automation ROI estimates"
        />
        <StatCard
          label="Events"
          value={stats.total_events.toLocaleString()}
          tooltip="Total user interactions (clicks, keystrokes, app switches) — high counts signal repetitive manual work ripe for automation"
        />
        <StatCard
          label="Activities"
          value={stats.total_activities}
          tooltip="Distinct process steps — each is a potential automation target"
        />
        <StatCard
          label="Variants"
          value={stats.total_variants}
          tooltip="Unique process paths — more variants means less standardization and higher automation complexity"
        />
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-zinc-800 overflow-x-auto" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === 'bpmn' && !bpmnXml) {
                handleLoadBpmn();
              }
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-indigo-400 text-indigo-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
            aria-label={`${tab.label} tab`}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6 tab-content" key="overview">
          <OverviewFilterBar
            filters={filters}
            availableUsers={availableUsers}
            availableApps={availableApps}
            onToggleUser={toggleUser}
            onToggleApplication={toggleApplication}
            onSetSearch={setSearch}
            onSetMinDuration={setMinDuration}
            onClear={() => clearTabFilters('overview')}
          />
          <HealthScore pipeline={pipeline} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard
              label="Date Range"
              value={formatDate(stats.start_date)}
              sub={`to ${formatDate(stats.end_date)}`}
              tooltip="Time span covered by the uploaded event log data"
            />
            <StatCard
              label="Avg Case Duration"
              value={formatDuration(stats.avg_case_duration_seconds)}
              sub={`median ${formatDuration(stats.median_case_duration_seconds)}`}
              tooltip="Average time from first to last event in a case. Median shows the typical case without outlier skew."
            />
            <StatCard
              label="Users / Apps"
              value={`${stats.total_users} / ${stats.total_applications}`}
              sub="unique users and applications"
              tooltip="Number of distinct employees and software applications observed in the event log"
            />
            <StatCard
              label="Biggest Delay"
              value={
                sortedBottlenecks.length > 0
                  ? `${sortedBottlenecks[0].severity} · ${formatDuration(sortedBottlenecks[0].avg_wait_seconds)}`
                  : 'None'
              }
              sub={
                sortedBottlenecks.length > 0
                  ? `${sortedBottlenecks[0].from_activity.slice(0, 15)}${sortedBottlenecks[0].from_activity.length > 15 ? '…' : ''} → ${sortedBottlenecks[0].to_activity.slice(0, 15)}${sortedBottlenecks[0].to_activity.length > 15 ? '…' : ''}`
                  : undefined
              }
              tooltip="Highest-severity bottleneck transition — the biggest source of delay in the process"
            />
            <StatCard
              label="RPA-Ready Activities"
              value={filteredActivities.filter((a) => a.copy_paste_count > 10).length}
              sub="activities with >10 copy-paste ops"
              tooltip="Activities with heavy copy-paste operations (>10) that are strong candidates for RPA automation"
            />
          </div>

          {/* Activity categories */}
          <CategoryBreakdown activities={filteredActivities} />

          {/* Communication hub insight */}
          {copy_paste_flows && copy_paste_flows.length > 0 && (
            <HubInsight copyPasteFlows={copy_paste_flows} />
          )}

          {/* Cross-department data flows */}
          {copy_paste_flows && copy_paste_flows.length > 0 && (
            <DataFlowInsight activities={pipeline.activities} copyPasteFlows={copy_paste_flows} />
          )}

          {/* Top activities table */}
          <CollapsibleSection
            title="Top Activities"
            tooltip="Most frequent process steps — each row is an aggregated activity with its occurrence count, average time, and copy-paste operations detected"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium">Name</th>
                    <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">
                      <InlineTooltip text="Occurrence count — higher frequency = higher automation ROI">Freq</InlineTooltip>
                    </th>
                    <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">
                      <InlineTooltip text="Average time per occurrence — longer steps yield more savings when automated">Avg Duration</InlineTooltip>
                    </th>
                    <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">
                      <InlineTooltip text="Manual data transfers between apps — high counts are prime RPA automation targets">Copy-Paste</InlineTooltip>
                    </th>
                    <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">
                      <InlineTooltip text="App switches within this step — frequent switching = fragmented cross-system work that automation can eliminate">App Switches</InlineTooltip>
                    </th>
                    <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium">
                      <InlineTooltip text="Apps used — multi-app steps often involve manual data transfer between systems">Applications</InlineTooltip>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topActivities.map((act) => (
                    <tr key={act.name} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-4 py-2 text-zinc-200">{act.name}</td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-400">{act.frequency.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-400">
                        {formatDuration(act.avg_duration_seconds)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-400">
                        {act.copy_paste_count > 0 ? (
                          <span className={act.copy_paste_count > 50 ? 'text-orange-400' : ''}>
                            {act.copy_paste_count.toLocaleString()}
                          </span>
                        ) : '\u2014'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-400">
                        {act.context_switch_count > 0 ? (
                          <span className={act.context_switch_count > 20 ? 'text-orange-400' : ''}>
                            {act.context_switch_count.toLocaleString()}
                          </span>
                        ) : '\u2014'}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1 flex-wrap">
                          {act.applications.slice(0, 4).map((app) => (
                            <span
                              key={app}
                              className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400"
                            >
                              {app}
                            </span>
                          ))}
                          {act.applications.length > 4 && (
                            <span className="text-xs text-zinc-600">
                              +{act.applications.length - 4}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredActivities.length > 15 && (
              <button
                onClick={() => setShowAllActivities(!showAllActivities)}
                className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors border-t border-zinc-800"
              >
                {showAllActivities ? 'Show less' : `Show all ${filteredActivities.length} activities${filtersActive ? ' (filtered)' : ''}`}
              </button>
            )}
          </CollapsibleSection>

          {/* Application usage bar chart */}
          {application_usage && application_usage.length > 0 && (() => {
            const userFiltered = filters.users.length > 0 || filters.applications.length > 0;
            const appsInFilteredActivities = userFiltered
              ? new Set(filteredActivities.flatMap((a) => a.applications))
              : null;
            const visibleApps = appsInFilteredActivities
              ? application_usage.filter((a) => appsInFilteredActivities.has(a.application))
              : application_usage;
            const sortedApps = [...visibleApps].sort((a, b) => b.total_duration_seconds - a.total_duration_seconds);
            const displayedApps = showAllApps ? sortedApps : sortedApps.slice(0, 10);
            const filteredMax = Math.max(...sortedApps.map((a) => a.total_duration_seconds), 1);
            return (
            <CollapsibleSection
              title="Application Usage"
              tooltip={userFiltered
                ? "Apps used by selected user(s) — bars show relative usage among these apps. Duration figures are dataset-wide totals (per-user breakdown not available at this level)."
                : "Total time spent in each application across all users. Active % shows how much of that time involved actual user interaction vs. idle/background time."}
            >
              {userFiltered && (
                <div className="mx-4 mt-3 flex items-center gap-1.5 text-[11px] text-blue-400 bg-blue-900/10 border border-blue-800/30 rounded-lg px-3 py-1.5">
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.1"/><path d="M5.5 4.5v3M5.5 3.5v.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
                  Showing apps used by selected user{filters.users.length > 1 ? 's' : ''} — durations reflect full dataset
                </div>
              )}
              <div className="p-4 space-y-3">
                {displayedApps.map((app) => {
                  const pct = filteredMax > 0 ? (app.total_duration_seconds / filteredMax) * 100 : 0;
                  const activePct = app.total_duration_seconds > 0
                    ? (app.active_duration_seconds / app.total_duration_seconds) * 100
                    : 0;
                  return (
                    <div key={app.application} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-300">{app.application}</span>
                        <span className="text-zinc-500 font-mono">
                          {formatDuration(app.total_duration_seconds)}
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-xs text-zinc-600">{activePct.toFixed(0)}% active</div>
                    </div>
                  );
                })}
                {sortedApps.length === 0 && (
                  <p className="text-xs text-zinc-500 text-center py-2">No application data for selected filters.</p>
                )}
              </div>
              {sortedApps.length > 10 && (
                <button
                  onClick={() => setShowAllApps(!showAllApps)}
                  className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors border-t border-zinc-800"
                >
                  {showAllApps ? 'Show less' : `Show all ${sortedApps.length} applications`}
                </button>
              )}
            </CollapsibleSection>
            );
          })()}

          {/* Cross-App Data Transfers */}
          {copy_paste_flows && copy_paste_flows.length > 0 && (() => {
            const maxFlow = Math.max(...copy_paste_flows.map((f) => f.count));
            return (
              <CollapsibleSection
                title="Cross-App Data Transfers"
                tooltip="Copy-paste operations detected between applications from Activity Heatmap data — each flow represents manual data transfer that could be automated"
              >
                <div className="p-4 space-y-3">
                  {[...copy_paste_flows]
                    .sort((a, b) => b.count - a.count)
                    .map((flow) => {
                      const pct = maxFlow > 0 ? (flow.count / maxFlow) * 100 : 0;
                      return (
                        <div key={`${flow.source_app}-${flow.target_app}`} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-zinc-300">
                              {flow.source_app} <span className="text-zinc-600">{'\u2192'}</span> {flow.target_app}
                            </span>
                            <span className="text-zinc-500 font-mono">
                              {flow.count} operations
                            </span>
                          </div>
                          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-600 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CollapsibleSection>
            );
          })()}

          {/* Performer Analysis */}
          {filteredPerformers.length > 0 && (() => {
            const performers = filteredPerformers;
            const displayedPerformers = showAllPerformers ? performers : performers.slice(0, 10);
            const maxEvents = Math.max(...performers.map((p) => p.total_events));
            const fastest = performers.reduce((a, b) => a.avg_activity_duration_seconds < b.avg_activity_duration_seconds ? a : b);
            const slowest = performers.reduce((a, b) => a.avg_activity_duration_seconds > b.avg_activity_duration_seconds ? a : b);
            return (
              <CollapsibleSection
                title="Performer Analysis"
                tooltip="Per-user performance metrics — identify training opportunities by comparing efficiency across team members"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium">User</th>
                        <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">Events</th>
                        <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">Avg Duration</th>
                        <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">Activities</th>
                        <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium">Top Apps</th>
                        <th className="px-4 py-2 text-xs text-zinc-500 font-medium">Workload</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedPerformers.map((p) => {
                        const isFastest = p.user === fastest.user && performers.length > 1;
                        const isSlowest = p.user === slowest.user && performers.length > 1;
                        const barPct = maxEvents > 0 ? (p.total_events / maxEvents) * 100 : 0;
                        return (
                          <tr key={p.user} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                            <td className={`px-4 py-2 ${isFastest ? 'text-green-400' : isSlowest ? 'text-amber-400' : 'text-zinc-200'}`}>
                              {p.user}
                              {isFastest && <span className="ml-1 text-[10px] text-green-500">fastest</span>}
                              {isSlowest && <span className="ml-1 text-[10px] text-amber-500">slowest</span>}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-zinc-400">{p.total_events.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right font-mono text-zinc-400">{formatDuration(p.avg_activity_duration_seconds)}</td>
                            <td className="px-4 py-2 text-right font-mono text-zinc-400">{p.activity_count}</td>
                            <td className="px-4 py-2">
                              <div className="flex gap-1 flex-wrap">
                                {p.top_applications.map((app) => (
                                  <span key={app} className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{app}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-2 w-24">
                              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${barPct}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {performers.length > 10 && (
                  <button
                    onClick={() => setShowAllPerformers(!showAllPerformers)}
                    className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors border-t border-zinc-800"
                  >
                    {showAllPerformers ? 'Show less' : `Show all ${performers.length} users`}
                  </button>
                )}
              </CollapsibleSection>
            );
          })()}
        </div>
      )}

      {/* Tab: Bottlenecks */}
      {activeTab === 'bottlenecks' && (() => {
        const criticalCount = filteredBottlenecks.filter((b) => b.severity === 'critical').length;
        const highCount = filteredBottlenecks.filter((b) => b.severity === 'high').length;
        return (
        <>
        <BottleneckFilterBar
          filters={filters}
          availableUsers={availableUsers}
          onToggleUser={toggleUser}
          onToggleSeverity={toggleSeverity}
          onSetMinWait={setMinWait}
          onClear={() => clearTabFilters('bottlenecks')}
        />
        <p className="text-sm text-zinc-400">
          <span className="text-red-400 font-medium">{criticalCount} critical</span>
          {', '}
          <span className="text-orange-400 font-medium">{highCount} high</span>
          {' severity bottlenecks detected across '}
          <span className="text-zinc-200 font-medium">{filteredBottlenecks.length} transitions</span>
          {filtersActive && <span className="text-zinc-500 text-xs ml-1">(filtered)</span>}
        </p>
        <CollapsibleSection
          title="Bottleneck Transitions"
          tooltip="Transitions between activities where significant waiting time was detected. High avg wait = process friction; many cases = widespread impact."
          trailing={
            <span className="text-xs text-zinc-500">{filteredBottlenecks.length} total</span>
          }
        >
          {filteredBottlenecks.length === 0 ? (
            <div className="px-4 py-8 text-center text-zinc-500 text-sm">
              {filtersActive ? 'No bottlenecks match current filters.' : 'No bottlenecks detected.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium">
                      <InlineTooltip text="Activity pair with detected delay — automating the handoff eliminates waiting time">Transition</InlineTooltip>
                    </th>
                    <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">
                      <InlineTooltip text="Average delay between steps — this is recoverable time if the handoff is automated">Avg Wait</InlineTooltip>
                    </th>
                    <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">
                      <InlineTooltip text="Worst-case delay observed — shows the upper bound of process friction at this handoff">Max Wait</InlineTooltip>
                    </th>
                    <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">
                      <InlineTooltip text="Cases affected — more cases = broader impact when this bottleneck is resolved">Cases</InlineTooltip>
                    </th>
                    <th className="text-center px-4 py-2 text-xs text-zinc-500 font-medium">
                      <InlineTooltip text="Impact level — critical/high bottlenecks should be prioritized for automation">Severity</InlineTooltip>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBottlenecks.map((bn, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-4 py-3 text-zinc-200">
                        <span className="text-zinc-400">{bn.from_activity}</span>
                        <span className="mx-2 text-zinc-600">{'\u2192'}</span>
                        <span>{bn.to_activity}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400">
                        {formatDuration(bn.avg_wait_seconds)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400">
                        {formatDuration(bn.max_wait_seconds)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400">
                        {bn.case_count?.toLocaleString() ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <SeverityBadge severity={bn.severity} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filteredBottlenecks.length > 15 && (
            <button
              onClick={() => setShowAllBottlenecks(!showAllBottlenecks)}
              className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showAllBottlenecks ? 'Show less' : `Show all ${filteredBottlenecks.length} bottlenecks`}
            </button>
          )}
        </CollapsibleSection>
        </>
        );
      })()}

      {/* Tab: Variants */}
      {activeTab === 'variants' && (() => {
        const sorted = [...filteredVariants].sort((a, b) => b.case_count - a.case_count);
        const happyPathSteps = sorted.length > 0 ? new Set(sorted[0].sequence) : new Set<string>();
        return (
        <div className="space-y-3">
          <VariantFilterBar
            filters={filters}
            availableUsers={availableUsers}
            onToggleUser={toggleUser}
            onSetMinVariantCases={setMinVariantCases}
            onClear={() => clearTabFilters('variants')}
          />
          <p className="text-xs text-zinc-500">
            Each variant is a unique path through the process. Higher percentage = more common path. Loops highlighted in amber indicate repetitive patterns. Steps not in the happy path are highlighted in orange.
          </p>
          {filtersActive && (
            <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-900/10 border border-blue-800/40 rounded-lg px-3 py-2">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/><path d="M6 5v4M6 3.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              {filters.users.length > 0
                ? `Showing variants that include activities performed by selected user${filters.users.length > 1 ? 's' : ''}. Case counts reflect the full dataset.`
                : 'Filters active — showing variants matching filtered activities.'}
            </div>
          )}
          {sorted.length === 0 ? (
            <p className="text-zinc-500 text-sm">{filtersActive ? 'No variants match current filters.' : 'No variants found.'}</p>
          ) : (
            sorted
              .slice(0, 10)
              .map((v, idx) => (
                <VariantCard key={v.variant_id} variant={v} isHappyPath={idx === 0} happyPathSteps={happyPathSteps} />
              ))
          )}
        </div>
        );
      })()}

      {/* Tab: AI Analysis */}
      {activeTab === 'ai' && (
        <div className="space-y-6 tab-content" key="ai">
          <AskProcess processId={processId} />

          {!copilot && !isPending && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center space-y-4">
              <div>
                <p className="text-zinc-200 font-medium">Run AI Analysis</p>
                <p className="text-sm text-zinc-500 mt-1">
                  The AI copilot will analyse the process and generate automation recommendations.
                </p>
              </div>
              {copilotError && (
                <p className="text-sm text-red-400">{copilotError}</p>
              )}
              <button
                onClick={handleRunAnalysis}
                className="inline-flex items-center gap-2 px-4 py-2 accent-gradient hover:opacity-90 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Run AI Analysis
              </button>
            </div>
          )}

          {!copilot && isPending && (
            <div className="space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
                <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
                <div className="h-3 w-full bg-zinc-800 rounded animate-pulse" />
                <div className="h-3 w-3/4 bg-zinc-800 rounded animate-pulse" />
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-16 bg-zinc-800 rounded animate-pulse" />
                    <div className="h-4 w-48 bg-zinc-800 rounded animate-pulse" />
                  </div>
                  <div className="h-3 w-full bg-zinc-800 rounded animate-pulse" />
                  <div className="h-3 w-5/6 bg-zinc-800 rounded animate-pulse" />
                  <div className="flex gap-2">
                    <div className="h-5 w-20 bg-zinc-800 rounded animate-pulse" />
                    <div className="h-5 w-20 bg-zinc-800 rounded animate-pulse" />
                  </div>
                </div>
              ))}
              <p className="text-center text-xs text-zinc-500 animate-pulse">
                AI is analysing the process and generating recommendations...
              </p>
            </div>
          )}

          {copilot && (
            <>
              {/* Executive action card */}
              <ActionCard pipeline={pipeline} copilot={copilot} />

              {copilot.summary && (
                <CollapsibleSection
                  title="Summary"
                  tooltip="AI-generated overview of the discovered process, key metrics, and high-level findings"
                >
                  <div className="p-4">
                    <p className="text-sm text-zinc-400 leading-relaxed">{copilot.summary}</p>
                  </div>
                </CollapsibleSection>
              )}

              {copilot.recommendations?.length > 0 && (
                <AutomationMatrix recommendations={copilot.recommendations} pipeline={pipeline} />
              )}

              {copilot.recommendations?.length > 0 && (() => {
                const IMPACTS: ImpactLevel[] = ['high', 'medium', 'low'];
                const TYPES: RecommendationType[] = ['automate', 'eliminate', 'simplify', 'parallelize', 'reassign'];
                const IMPACT_COLORS: Record<ImpactLevel, { idle: string; active: string }> = {
                  high: { idle: 'border-zinc-700 bg-zinc-800/60 text-zinc-500 hover:text-emerald-400 hover:border-emerald-700', active: 'border-emerald-500 bg-emerald-900/30 text-emerald-300' },
                  medium: { idle: 'border-zinc-700 bg-zinc-800/60 text-zinc-500 hover:text-blue-400 hover:border-blue-700', active: 'border-blue-500 bg-blue-900/30 text-blue-300' },
                  low: { idle: 'border-zinc-700 bg-zinc-800/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500', active: 'border-zinc-400 bg-zinc-800 text-zinc-200' },
                };
                const TYPE_ICONS: Record<RecommendationType, string> = { automate: '⚡', eliminate: '✕', simplify: '◈', parallelize: '⇉', reassign: '→' };
                const filtered = copilot.recommendations.filter((r) => {
                  if (recImpact.length > 0 && !recImpact.includes(r.impact)) return false;
                  if (recType.length > 0 && !recType.includes(r.type)) return false;
                  return true;
                });
                const anyRecFilter = recImpact.length > 0 || recType.length > 0;
                return (
                <>
                {/* Recommendation filters */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest select-none mr-1">Filter</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">Impact</span>
                      <div className="flex gap-1">
                        {IMPACTS.map((imp) => {
                          const active = recImpact.includes(imp);
                          const c = IMPACT_COLORS[imp];
                          return (
                            <button key={imp} onClick={() => setRecImpact((prev) => active ? prev.filter((x) => x !== imp) : [...prev, imp])} aria-pressed={active}
                              className={`px-2.5 py-1 text-[11px] font-medium rounded-md border capitalize transition-all ${active ? c.active : c.idle}`}>
                              {imp}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <span className="w-px h-4 bg-zinc-700 self-center" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">Type</span>
                      <div className="flex gap-1 flex-wrap">
                        {TYPES.map((t) => {
                          const active = recType.includes(t);
                          return (
                            <button key={t} onClick={() => setRecType((prev) => active ? prev.filter((x) => x !== t) : [...prev, t])} aria-pressed={active}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border capitalize transition-all ${
                                active ? 'border-violet-500 bg-violet-900/30 text-violet-300' : 'border-zinc-700 bg-zinc-800/60 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                              }`}>
                              <span className="text-[10px]">{TYPE_ICONS[t]}</span>{t}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {anyRecFilter && (
                      <button onClick={() => { setRecImpact([]); setRecType([]); }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-md border border-transparent hover:border-zinc-700 transition-all">
                        <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 1.5L7.5 7.5M7.5 1.5L1.5 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              <CollapsibleSection
                  title={`Recommendations (${filtered.length}${anyRecFilter ? ` of ${copilot.recommendations.length}` : ''})`}
                  tooltip="Ranked automation opportunities — each recommendation targets a specific activity with a suggested action type (automate, eliminate, simplify, parallelize, or reassign)"
                  trailing={
                    copilot.blueprints && copilot.blueprints.length > 0 ? (
                      <button
                        onClick={() => {
                          const blob = new Blob([JSON.stringify(copilot.blueprints, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `blueprints-${processId}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="text-xs px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-colors"
                        aria-label="Download all automation blueprints as JSON"
                      >
                        Download All Blueprints
                      </button>
                    ) : undefined
                  }
                >
                  <div className="p-4 space-y-3">
                    {filtered.length === 0 ? (
                      <p className="text-sm text-zinc-500 text-center py-4">No recommendations match current filters.</p>
                    ) : (
                      [...filtered]
                        .sort((a, b) => a.priority - b.priority)
                        .map((rec) => {
                          const bp = copilot.blueprints?.find((b) => b.target_activity === rec.target);
                          return <RecommendationCard key={rec.id} recommendation={rec} blueprint={bp} />;
                        })
                    )}
                  </div>
                </CollapsibleSection>
                </>
                );
              })()}

              {copilot.recommendations?.length > 0 && (
                <RoiCalculator recommendations={copilot.recommendations} pipeline={pipeline} />
              )}

              <BeforeAfter pipeline={pipeline} copilot={copilot} />

              {copilot.reference_bpmn_comparison && (
                <CollapsibleSection
                  title="Reference BPMN Comparison"
                  tooltip="Comparison of the discovered process against the reference BPMN model to identify deviations"
                >
                  <div className="p-4">
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      {copilot.reference_bpmn_comparison}
                    </p>
                  </div>
                </CollapsibleSection>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: BPMN */}
      {activeTab === 'bpmn' && (
        <div className="tab-content" key="bpmn"><BpmnTabContent
          processId={processId}
          pipeline={pipeline}
          recommendations={copilot?.recommendations ?? null}
          bpmnXml={bpmnXml}
          bpmnError={bpmnError}
          onLoadBpmn={handleLoadBpmn}
          onDownloadBpmn={handleDownloadBpmn}
        /></div>
      )}

      {/* Tab: Live Monitor */}
      {activeTab === 'live' && (
        <div className="tab-content" key="live"><LiveMonitor pipeline={pipeline} copilot={copilot} /></div>
      )}
    </div>
  );
}

const COLLAPSED_MAX = 12;

function VariantCard({
  variant: v,
  isHappyPath = false,
  happyPathSteps,
}: {
  variant: ProcessTabsProps['pipeline']['variants'][number];
  isHappyPath?: boolean;
  happyPathSteps: Set<string>;
}) {
  const compressed = compressSequence(v.sequence);
  const isLong = compressed.length > COLLAPSED_MAX;
  const [expanded, setExpanded] = useState(!isLong);
  const visible = expanded ? compressed : compressed.slice(0, COLLAPSED_MAX);
  const hiddenCount = compressed.length - COLLAPSED_MAX;

  const deviationCount = isHappyPath
    ? 0
    : v.sequence.filter((step) => !happyPathSteps.has(step)).length;

  function stepClass(step: string): string {
    if (isHappyPath || happyPathSteps.has(step)) {
      return 'text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700';
    }
    return 'text-xs px-2 py-0.5 rounded-full bg-amber-900/30 text-zinc-200 border border-amber-700';
  }

  function singleStepClass(step: string): string {
    if (isHappyPath || happyPathSteps.has(step)) {
      return 'text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700';
    }
    return 'text-xs px-2.5 py-1 rounded-full bg-amber-900/30 text-zinc-200 border border-amber-700';
  }

  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-start gap-4 ${isHappyPath ? 'border-l-2 border-l-green-500' : ''}`}>
      <div className="text-right min-w-[64px]">
        <div className="flex items-center justify-end gap-1.5">
          <InlineTooltip text="Percentage of all recorded cases that followed this exact path. Higher = more common.">
            <p className="text-sm font-semibold font-mono text-zinc-100">
              {v.percentage.toFixed(1)}%
            </p>
          </InlineTooltip>
        </div>
        <InlineTooltip text="Number of unique process executions (user sessions) that followed this variant.">
          <p className="text-xs text-zinc-500 mt-0.5">
            {v.case_count.toLocaleString()} cases
          </p>
        </InlineTooltip>
        {v.avg_total_duration_seconds > 0 && (
          <InlineTooltip text="Average time from first to last step in this variant. Shorter = more efficient path.">
            <p className="text-xs text-zinc-600 mt-0.5">
              {formatDuration(v.avg_total_duration_seconds)}
            </p>
          </InlineTooltip>
        )}
        {v.sequence.length > 5 && (
          <p className="text-xs text-zinc-600 mt-0.5">
            {v.sequence.length} steps
          </p>
        )}
        {deviationCount > 0 && v.sequence.length > 3 && (
          <InlineTooltip text="Steps in this variant that don't appear in the most common (happy) path — highlighted in orange. High deviation count signals non-standard process execution.">
            <p className="text-xs text-amber-500 mt-0.5">
              {deviationCount} deviation{deviationCount !== 1 ? 's' : ''}
            </p>
          </InlineTooltip>
        )}
      </div>
      <div className="flex-1">
        <div className="flex gap-1.5 flex-wrap items-center">
          {visible.map((segment, idx) => (
            <span key={idx} className="flex items-center gap-1.5">
              {segment.count > 1 ? (
                <span className="flex items-center gap-0.5 border border-amber-800/50 rounded-full px-1 py-0.5 bg-amber-950/30">
                  {segment.steps.map((step, si) => (
                    <span key={si} className="flex items-center gap-0.5">
                      <span className={stepClass(step)}>
                        {step}
                      </span>
                      {si < segment.steps.length - 1 && (
                        <span className="text-zinc-600 text-xs">{'\u2192'}</span>
                      )}
                    </span>
                  ))}
                  <span className="text-xs font-mono text-amber-400 ml-1">{'\u00d7'}{segment.count}</span>
                </span>
              ) : (
                <span className={singleStepClass(segment.steps[0])}>
                  {segment.steps[0]}
                </span>
              )}
              {idx < visible.length - 1 && (
                <span className="text-zinc-600 text-xs">{'\u2192'}</span>
              )}
            </span>
          ))}
          {isLong && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs px-2.5 py-1 rounded-full bg-blue-900/40 text-blue-400 border border-blue-800/50 hover:bg-blue-900/60 transition-colors"
            >
              +{hiddenCount} more
            </button>
          )}
          {isLong && expanded && (
            <button
              onClick={() => setExpanded(false)}
              className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              show less
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** BPMN tab — shows the AI-generated optimized workflow */
function BpmnTabContent({
  pipeline,
  recommendations,
  bpmnXml,
  bpmnError,
  onLoadBpmn,
  onDownloadBpmn,
}: {
  processId: string;
  pipeline: PipelineOutput;
  recommendations: import('@/lib/types').Recommendation[] | null;
  bpmnXml: string | null;
  bpmnError: string | null;
  onLoadBpmn: () => void;
  onDownloadBpmn: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">
            AI-Generated BPMN 2.0 Workflow
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Color-coded by insight — green: automation target · red: bottleneck · blue: copy-paste intensive
          </p>
        </div>
        {bpmnXml && !bpmnXml.startsWith('<!--') && (
          <button
            onClick={onDownloadBpmn}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg border border-zinc-700 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v7M3 6l3 3 3-3M1 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Download BPMN
          </button>
        )}
      </div>

      {/* Diagram renders immediately from pipeline data — no XML loading needed */}
      <BpmnViewer pipeline={pipeline} recommendations={recommendations} />
    </div>
  );
}
