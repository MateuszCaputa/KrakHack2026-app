'use client';

import { useMemo } from 'react';
import type { Activity, CopyPasteFlow } from '@/lib/types';
import { formatDuration } from '@/lib/utils';
import { CollapsibleSection } from './collapsible-section';

const CATEGORY_COLORS: Record<string, string> = {
  'Communication': 'bg-blue-500',
  'Development': 'bg-emerald-500',
  'Web & Research': 'bg-amber-500',
  'Documentation': 'bg-purple-500',
  'Project Management': 'bg-cyan-500',
  'Admin & Config': 'bg-zinc-500',
  'File & System': 'bg-orange-500',
  'Other': 'bg-zinc-600',
};

interface CategoryBreakdownProps {
  activities: Activity[];
}

export function CategoryBreakdown({ activities }: CategoryBreakdownProps) {
  const categories = useMemo(() => {
    const map = new Map<string, { events: number; duration: number; copyPaste: number }>();
    for (const a of activities) {
      const cat = a.category ?? 'Other';
      const prev = map.get(cat) ?? { events: 0, duration: 0, copyPaste: 0 };
      map.set(cat, {
        events: prev.events + a.frequency,
        duration: prev.duration + a.avg_duration_seconds * a.frequency,
        copyPaste: prev.copyPaste + a.copy_paste_count,
      });
    }
    return [...map.entries()]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.events - a.events);
  }, [activities]);

  const totalEvents = categories.reduce((s, c) => s + c.events, 0);
  const maxEvents = Math.max(...categories.map((c) => c.events), 1);

  if (categories.length <= 1) return null;

  return (
    <CollapsibleSection
      title="Work Categories"
      tooltip="Process steps grouped by business domain — reveals where time and manual effort concentrate across departments"
    >
      <div className="p-4 space-y-3">
        {categories.map((cat) => {
          const pct = totalEvents > 0 ? (cat.events / totalEvents * 100) : 0;
          const barPct = (cat.events / maxEvents) * 100;
          const colorClass = CATEGORY_COLORS[cat.name] ?? CATEGORY_COLORS['Other'];
          return (
            <div key={cat.name} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300 font-medium">{cat.name}</span>
                <span className="text-zinc-500 font-mono">
                  {cat.events.toLocaleString()} events {'\u00b7'} {formatDuration(cat.duration)} {'\u00b7'} {cat.copyPaste.toLocaleString()} copy-paste
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${colorClass}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-500 font-mono w-10 text-right">{pct.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}

interface HubInsightProps {
  copyPasteFlows: CopyPasteFlow[];
}

export function HubInsight({ copyPasteFlows }: HubInsightProps) {
  const hub = useMemo(() => {
    if (!copyPasteFlows.length) return null;

    const incomingByApp = new Map<string, { sources: string[]; total: number }>();
    for (const flow of copyPasteFlows) {
      if (flow.source_app === flow.target_app || flow.count === 0) continue;
      const prev = incomingByApp.get(flow.target_app) ?? { sources: [], total: 0 };
      prev.sources.push(flow.source_app);
      prev.total += flow.count;
      incomingByApp.set(flow.target_app, prev);
    }

    let bestApp = '';
    let bestData = { sources: [] as string[], total: 0 };
    for (const [app, data] of incomingByApp) {
      if (data.sources.length > bestData.sources.length ||
          (data.sources.length === bestData.sources.length && data.total > bestData.total)) {
        bestApp = app;
        bestData = data;
      }
    }

    if (!bestApp || bestData.sources.length < 3) return null;

    const topFlows = copyPasteFlows
      .filter((f) => f.target_app === bestApp && f.source_app !== bestApp && f.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return { app: bestApp, sources: bestData.sources.length, total: bestData.total, topFlows };
  }, [copyPasteFlows]);

  if (!hub) return null;

  return (
    <div className="bg-zinc-900 border border-amber-800/40 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-800/30 bg-amber-950/20">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-sm">&#9888;</span>
          <h3 className="text-sm font-semibold text-amber-200">
            Communication Hub Detected: {hub.app}
          </h3>
        </div>
        <p className="text-xs text-zinc-400 mt-1">
          {hub.app} receives manual copy-paste data from {hub.sources} different applications — a centralized bottleneck for manual data transfer.
        </p>
      </div>
      <div className="p-4 space-y-2">
        {hub.topFlows.map((flow) => (
          <div key={`${flow.source_app}-${flow.target_app}`} className="flex justify-between text-xs">
            <span className="text-zinc-300">
              {flow.source_app} <span className="text-zinc-600">{'\u2192'}</span> {flow.target_app}
            </span>
            <span className="text-amber-400 font-mono">{flow.count.toLocaleString()} transfers</span>
          </div>
        ))}
        <div className="pt-2 mt-2 border-t border-zinc-800">
          <p className="text-xs text-zinc-400">
            <span className="text-amber-400 font-semibold">{hub.total.toLocaleString()}</span> total manual transfers into {hub.app}.
            An automated reporting integration could eliminate these entirely.
          </p>
        </div>
      </div>
    </div>
  );
}
