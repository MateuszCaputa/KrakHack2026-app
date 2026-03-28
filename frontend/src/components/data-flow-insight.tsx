'use client';

import { useMemo } from 'react';
import type { Activity, CopyPasteFlow } from '@/lib/types';

const CATEGORY_MAP: Record<string, string> = {
  'Communication': 'Communication',
  'Development': 'Development',
  'Web & Research': 'Research',
  'Documentation': 'Documentation',
  'Project Management': 'Project Mgmt',
  'Admin & Config': 'Admin',
  'File & System': 'File Mgmt',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Communication': '#3b82f6',
  'Development': '#10b981',
  'Research': '#f59e0b',
  'Documentation': '#a855f7',
  'Project Mgmt': '#06b6d4',
  'Admin': '#71717a',
  'File Mgmt': '#f97316',
};

interface DataFlowInsightProps {
  activities: Activity[];
  copyPasteFlows: CopyPasteFlow[];
}

interface CategoryFlow {
  from: string;
  to: string;
  count: number;
}

export function DataFlowInsight({ activities, copyPasteFlows }: DataFlowInsightProps) {
  const flows = useMemo(() => {
    if (!copyPasteFlows.length || !activities.length) return null;

    // Build app → category mapping from activities
    const appToCategory = new Map<string, string>();
    for (const a of activities) {
      const cat = a.category ? (CATEGORY_MAP[a.category] ?? a.category) : null;
      if (!cat) continue;
      for (const app of a.applications) {
        appToCategory.set(app, cat);
      }
    }

    // Aggregate flows by category
    const catFlows = new Map<string, number>();
    const catIncoming = new Map<string, number>();
    const catOutgoing = new Map<string, number>();

    for (const flow of copyPasteFlows) {
      if (flow.source_app === flow.target_app || flow.count === 0) continue;
      const fromCat = appToCategory.get(flow.source_app);
      const toCat = appToCategory.get(flow.target_app);
      if (!fromCat || !toCat || fromCat === toCat) continue;

      const key = `${fromCat}→${toCat}`;
      catFlows.set(key, (catFlows.get(key) ?? 0) + flow.count);
      catOutgoing.set(fromCat, (catOutgoing.get(fromCat) ?? 0) + flow.count);
      catIncoming.set(toCat, (catIncoming.get(toCat) ?? 0) + flow.count);
    }

    const sortedFlows: CategoryFlow[] = [...catFlows.entries()]
      .map(([key, count]) => {
        const [from, to] = key.split('→');
        return { from, to, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    if (sortedFlows.length < 2) return null;

    // Find the biggest sink (most incoming)
    let sinkCat = '';
    let sinkIn = 0;
    let sinkOut = 0;
    for (const [cat, count] of catIncoming) {
      if (count > sinkIn) {
        sinkCat = cat;
        sinkIn = count;
        sinkOut = catOutgoing.get(cat) ?? 0;
      }
    }

    const ratio = sinkOut > 0 ? (sinkIn / sinkOut).toFixed(1) : 'N/A';
    const hoursPerMonth = (sinkIn * 5) / 3600; // ~5 seconds per manual transfer

    return { sortedFlows, sinkCat, sinkIn, sinkOut, ratio, hoursPerMonth };
  }, [activities, copyPasteFlows]);

  if (!flows) return null;

  const maxCount = Math.max(...flows.sortedFlows.map((f) => f.count), 1);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-medium text-zinc-200">Cross-Department Data Flows</h3>
        <p className="text-xs text-zinc-500 mt-0.5">
          Manual data transfers between work categories — reveals the hidden integration layer
        </p>
      </div>
      <div className="p-4 space-y-2">
        {flows.sortedFlows.map((flow, i) => {
          const pct = (flow.count / maxCount) * 100;
          const color = CATEGORY_COLORS[flow.from] ?? '#71717a';
          return (
            <div key={i} className="space-y-0.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">
                  <span style={{ color }}>{flow.from}</span>
                  <span className="text-zinc-600 mx-1">{'\u2192'}</span>
                  <span className="text-zinc-400">{flow.to}</span>
                </span>
                <span className="text-zinc-500 font-mono">{flow.count.toLocaleString()}</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.7 }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/50">
        <p className="text-xs text-zinc-400">
          <span className="text-amber-400 font-semibold">{flows.sinkCat}</span> receives{' '}
          <span className="text-zinc-200 font-medium">{flows.ratio}x</span> more data than it sends
          {' \u2014 '}
          <span className="text-zinc-200">{flows.sinkIn.toLocaleString()}</span> incoming vs{' '}
          <span className="text-zinc-200">{flows.sinkOut.toLocaleString()}</span> outgoing transfers.
          This manual reporting hub consumes ~<span className="text-amber-400 font-medium">{flows.hoursPerMonth.toFixed(1)}h/month</span>.
        </p>
      </div>
    </div>
  );
}
