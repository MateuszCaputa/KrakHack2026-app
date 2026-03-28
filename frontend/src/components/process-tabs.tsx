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
import type { PipelineOutput, CopilotOutput } from '@/lib/types';
import { formatDuration, formatDate } from '@/lib/utils';
import { runAnalysis, getBpmnXml } from '@/lib/api';

type TabId = 'overview' | 'bottlenecks' | 'variants' | 'ai' | 'bpmn' | 'live';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'bottlenecks', label: 'Bottlenecks' },
  { id: 'variants', label: 'Variants' },
  { id: 'ai', label: 'AI Analysis' },
  { id: 'bpmn', label: 'BPMN' },
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

  const { statistics: stats, activities, bottlenecks, variants, application_usage, copy_paste_flows } = pipeline;

  const sortedActivities = [...activities].sort((a, b) => b.frequency - a.frequency);
  const topActivities = showAllActivities ? sortedActivities : sortedActivities.slice(0, 15);

  const sortedBottlenecks = [...bottlenecks].sort((a, b) => {
    const sev = { critical: 4, high: 3, medium: 2, low: 1 };
    return (sev[b.severity as keyof typeof sev] ?? 0) - (sev[a.severity as keyof typeof sev] ?? 0);
  });
  const visibleBottlenecks = showAllBottlenecks ? sortedBottlenecks : sortedBottlenecks.slice(0, 15);

  const maxUsage = Math.max(
    ...(application_usage?.map((a) => a.total_duration_seconds) ?? [1])
  );

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

  return (
    <div className="space-y-6">
      {/* Stats row */}
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
      <div className="flex gap-1 border-b border-zinc-800 overflow-x-auto">
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
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
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
              label="Top Bottleneck"
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
              label="Automation Candidates"
              value={activities.filter((a) => a.copy_paste_count > 10).length}
              sub="activities with >10 copy-paste ops"
              tooltip="Activities with heavy copy-paste operations (>10) that are strong candidates for RPA automation"
            />
          </div>

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
                      <InlineTooltip text="App switches within this step — frequent switching = fragmented cross-system work that automation can eliminate">Ctx Switches</InlineTooltip>
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
                      <td className="px-4 py-2 text-right font-mono text-zinc-400">{act.frequency}</td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-400">
                        {formatDuration(act.avg_duration_seconds)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-400">
                        {act.copy_paste_count > 0 ? (
                          <span className={act.copy_paste_count > 50 ? 'text-orange-400' : ''}>
                            {act.copy_paste_count}
                          </span>
                        ) : '\u2014'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-400">
                        {act.context_switch_count > 0 ? (
                          <span className={act.context_switch_count > 20 ? 'text-orange-400' : ''}>
                            {act.context_switch_count}
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
            {activities.length > 15 && (
              <button
                onClick={() => setShowAllActivities(!showAllActivities)}
                className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors border-t border-zinc-800"
              >
                {showAllActivities ? 'Show less' : `Show all ${activities.length} activities`}
              </button>
            )}
          </CollapsibleSection>

          {/* Application usage bar chart */}
          {application_usage && application_usage.length > 0 && (
            <CollapsibleSection
              title="Application Usage"
              tooltip="Total time spent in each application across all users. Active % shows how much of that time involved actual user interaction vs. idle/background time."
            >
              <div className="p-4 space-y-3">
                {[...application_usage]
                  .sort((a, b) => b.total_duration_seconds - a.total_duration_seconds)
                  .map((app) => {
                    const pct = maxUsage > 0
                      ? (app.total_duration_seconds / maxUsage) * 100
                      : 0;
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
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="text-xs text-zinc-600">
                          {activePct.toFixed(0)}% active
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CollapsibleSection>
          )}

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
        </div>
      )}

      {/* Tab: Bottlenecks */}
      {activeTab === 'bottlenecks' && (() => {
        const criticalCount = bottlenecks.filter((b) => b.severity === 'critical').length;
        const highCount = bottlenecks.filter((b) => b.severity === 'high').length;
        return (
        <>
        <p className="text-sm text-zinc-400">
          <span className="text-red-400 font-medium">{criticalCount} critical</span>
          {', '}
          <span className="text-orange-400 font-medium">{highCount} high</span>
          {' severity bottlenecks detected across '}
          <span className="text-zinc-200 font-medium">{bottlenecks.length} transitions</span>
        </p>
        <CollapsibleSection
          title="Bottleneck Transitions"
          tooltip="Transitions between activities where significant waiting time was detected. High avg wait = process friction; many cases = widespread impact."
          trailing={
            <span className="text-xs text-zinc-500">{bottlenecks.length} total</span>
          }
        >
          {bottlenecks.length === 0 ? (
            <div className="px-4 py-8 text-center text-zinc-500 text-sm">
              No bottlenecks detected.
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
                        {bn.case_count}
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
          {bottlenecks.length > 15 && (
            <button
              onClick={() => setShowAllBottlenecks(!showAllBottlenecks)}
              className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showAllBottlenecks ? 'Show less' : `Show all ${bottlenecks.length} bottlenecks`}
            </button>
          )}
        </CollapsibleSection>
        </>
        );
      })()}

      {/* Tab: Variants */}
      {activeTab === 'variants' && (() => {
        const sorted = [...variants].sort((a, b) => b.case_count - a.case_count);
        const happyPathSteps = sorted.length > 0 ? new Set(sorted[0].sequence) : new Set<string>();
        return (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">
            Each variant is a unique path through the process. Higher percentage = more common path. Loops highlighted in amber indicate repetitive patterns. Steps not in the happy path are highlighted in orange.
          </p>
          {sorted.length === 0 ? (
            <p className="text-zinc-500 text-sm">No variants found.</p>
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
        <div className="space-y-6">
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
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
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
                <CollapsibleSection
                  title={`Recommendations (${copilot.recommendations.length})`}
                  tooltip="Ranked automation opportunities — each recommendation targets a specific activity with a suggested action type (automate, eliminate, simplify, parallelize, or reassign)"
                >
                  <div className="p-4 space-y-3">
                    {[...copilot.recommendations]
                      .sort((a, b) => a.priority - b.priority)
                      .map((rec) => (
                        <RecommendationCard key={rec.id} recommendation={rec} />
                      ))}
                  </div>
                </CollapsibleSection>
              )}

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
        <BpmnTabContent
          processId={processId}
          pipeline={pipeline}
          recommendations={copilot?.recommendations ?? null}
          bpmnXml={bpmnXml}
          bpmnError={bpmnError}
          onLoadBpmn={handleLoadBpmn}
          onDownloadBpmn={handleDownloadBpmn}
        />
      )}

      {/* Tab: Live Monitor */}
      {activeTab === 'live' && (
        <LiveMonitor pipeline={pipeline} copilot={copilot} />
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
          <p className="text-sm font-semibold font-mono text-zinc-100">
            {v.percentage.toFixed(1)}%
          </p>
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">
          {v.case_count} cases
        </p>
        {v.avg_total_duration_seconds > 0 && (
          <p className="text-xs text-zinc-600 mt-0.5">
            {formatDuration(v.avg_total_duration_seconds)}
          </p>
        )}
        {v.sequence.length > 5 && (
          <p className="text-xs text-zinc-600 mt-0.5">
            {v.sequence.length} steps
          </p>
        )}
        {deviationCount > 0 && v.sequence.length > 3 && (
          <p className="text-xs text-amber-500 mt-0.5">
            {deviationCount} deviation{deviationCount !== 1 ? 's' : ''}
          </p>
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
