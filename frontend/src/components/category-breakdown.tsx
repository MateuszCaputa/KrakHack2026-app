'use client';

import { useMemo, useState } from 'react';
import type { Activity, CopyPasteFlow } from '@/lib/types';
import { formatDuration } from '@/lib/utils';
import { normalizeActivityName } from '@/lib/format-names';
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
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const categories = useMemo(() => {
    const map = new Map<string, { events: number; duration: number; copyPaste: number; items: Activity[] }>();
    for (const a of activities) {
      const cat = a.category ?? 'Other';
      const prev = map.get(cat) ?? { events: 0, duration: 0, copyPaste: 0, items: [] };
      map.set(cat, {
        events: prev.events + a.frequency,
        duration: prev.duration + a.avg_duration_seconds * a.frequency,
        copyPaste: prev.copyPaste + a.copy_paste_count,
        items: [...prev.items, a],
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
      tooltip="Process steps grouped by business domain — click any category to see which specific activities are inside it"
    >
      <div className="p-4 space-y-1">
        {categories.map((cat) => {
          const pct = totalEvents > 0 ? (cat.events / totalEvents * 100) : 0;
          const barPct = (cat.events / maxEvents) * 100;
          const colorClass = CATEGORY_COLORS[cat.name] ?? CATEGORY_COLORS['Other'];
          const isExpanded = expandedCat === cat.name;
          const sortedItems = [...cat.items].sort((a, b) => b.frequency - a.frequency);
          return (
            <div key={cat.name} className="rounded-lg overflow-hidden">
              {/* Category row — clickable */}
              <button
                onClick={() => setExpandedCat(isExpanded ? null : cat.name)}
                className="w-full text-left px-3 py-2.5 hover:bg-zinc-800/50 transition-colors rounded-lg space-y-1.5"
              >
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5">
                    <svg
                      width="10" height="10" viewBox="0 0 12 12" fill="none"
                      className={`text-zinc-500 transition-transform duration-150 shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                    >
                      <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-zinc-200 font-medium">{cat.name}</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-500">{cat.items.length} activities</span>
                  </div>
                  <span className="text-zinc-400 font-mono">
                    {cat.events.toLocaleString()} occurrences · {formatDuration(cat.duration)}
                    {cat.copyPaste > 0 && <span className="text-amber-500"> · {cat.copyPaste.toLocaleString()} copy-pastes</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${barPct}%` }} />
                  </div>
                  <span className="text-xs text-zinc-300 font-mono w-10 text-right">{pct.toFixed(0)}%</span>
                </div>
              </button>

              {/* Expanded activity list */}
              {isExpanded && (
                <div className="mx-3 mb-2 border border-zinc-800 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900">
                        <th className="text-left px-3 py-2 text-zinc-500 font-medium">Activity</th>
                        <th className="text-right px-3 py-2 text-zinc-500 font-medium">Occurrences</th>
                        <th className="text-right px-3 py-2 text-zinc-500 font-medium">Avg duration</th>
                        <th className="text-right px-3 py-2 text-zinc-500 font-medium">Copy-pastes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedItems.map((a) => (
                        <tr key={a.name} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30">
                          <td className="px-3 py-2 text-zinc-300">{normalizeActivityName(a.name)}</td>
                          <td className="px-3 py-2 text-right font-mono text-zinc-400">{a.frequency.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-mono text-zinc-400">{formatDuration(a.avg_duration_seconds)}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {a.copy_paste_count > 0
                              ? <span className={a.copy_paste_count > 50 ? 'text-amber-400' : 'text-zinc-400'}>{a.copy_paste_count.toLocaleString()}</span>
                              : <span className="text-zinc-600">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
        <p className="text-xs text-zinc-300 mt-1">
          {hub.app} receives manual data from <span className="text-amber-300 font-semibold">{hub.sources} different apps</span> — a centralized bottleneck for manual data transfer.
        </p>
      </div>
      <div className="p-4 space-y-2">
        {hub.topFlows.map((flow) => (
          <div key={`${flow.source_app}-${flow.target_app}`} className="flex justify-between text-xs">
            <span className="text-zinc-300">
              {flow.source_app} <span className="text-zinc-500">{'\u2192'}</span> {flow.target_app}
            </span>
            <span className="text-amber-400 font-mono">{flow.count.toLocaleString()} transfers</span>
          </div>
        ))}
        <div className="pt-2 mt-2 border-t border-zinc-800">
          <p className="text-xs text-zinc-300">
            <span className="text-amber-300 font-bold">{hub.total.toLocaleString()}</span> total manual transfers into {hub.app}.
            An automated reporting integration could eliminate these entirely.
          </p>
        </div>
      </div>
    </div>
  );
}
