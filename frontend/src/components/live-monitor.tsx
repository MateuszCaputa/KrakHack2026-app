'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PipelineOutput, CopilotOutput } from '@/lib/types';
import { formatDuration } from '@/lib/utils';

interface Alert {
  id: number;
  type: 'bottleneck' | 'context-switch' | 'copy-paste' | 'rework' | 'complete';
  severity: 'critical' | 'high' | 'medium' | 'info';
  message: string;
  timestamp: string;
}

const SEVERITY_STYLES: Record<Alert['severity'], string> = {
  critical: 'bg-red-900/40 text-red-400 border-red-800/50',
  high: 'bg-orange-900/40 text-orange-400 border-orange-800/50',
  medium: 'bg-amber-900/40 text-amber-400 border-amber-800/50',
  info: 'bg-blue-900/40 text-blue-400 border-blue-800/50',
};

const TYPE_ICONS: Record<Alert['type'], string> = {
  'bottleneck': '\u26a0',
  'context-switch': '\u21c4',
  'copy-paste': '\u2398',
  'rework': '\u21ba',
  'complete': '\u2713',
};

function generateAlerts(pipeline: PipelineOutput, copilot: CopilotOutput | null): Alert[] {
  const alerts: Alert[] = [];
  let id = 0;
  const baseTime = new Date('2026-03-28T09:00:00');

  const highBottlenecks = pipeline.bottlenecks
    .filter((b) => b.severity === 'critical' || b.severity === 'high')
    .sort((a, b) => b.avg_wait_seconds - a.avg_wait_seconds)
    .slice(0, 5);

  for (const bn of highBottlenecks) {
    const ts = new Date(baseTime.getTime() + id * 1200);
    alerts.push({
      id: id++,
      type: 'bottleneck',
      severity: bn.severity === 'critical' ? 'critical' : 'high',
      message: `Bottleneck detected: ${bn.from_activity} \u2192 ${bn.to_activity} \u2014 avg wait ${formatDuration(bn.avg_wait_seconds)}, ${bn.case_count} cases affected`,
      timestamp: ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    });
  }

  const highCtxSwitch = pipeline.activities
    .filter((a) => a.context_switch_count > 10)
    .sort((a, b) => b.context_switch_count - a.context_switch_count)
    .slice(0, 3);

  for (const act of highCtxSwitch) {
    const ts = new Date(baseTime.getTime() + id * 1200);
    alerts.push({
      id: id++,
      type: 'context-switch',
      severity: 'medium',
      message: `High context switching: ${act.name} \u2014 ${act.context_switch_count} app switches detected across ${act.applications.length} applications`,
      timestamp: ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    });
  }

  const flows = (pipeline.copy_paste_flows ?? [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  for (const flow of flows) {
    const ts = new Date(baseTime.getTime() + id * 1200);
    alerts.push({
      id: id++,
      type: 'copy-paste',
      severity: 'info',
      message: `Data transfer pattern: ${flow.source_app} \u2192 ${flow.target_app} \u2014 ${flow.count} copy-paste operations`,
      timestamp: ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    });
  }

  const loopVariants = pipeline.variants
    .filter((v) => {
      const seen = new Set<string>();
      for (const step of v.sequence) {
        if (seen.has(step)) return true;
        seen.add(step);
      }
      return false;
    })
    .slice(0, 3);

  for (const v of loopVariants) {
    const repeated = v.sequence.filter((step, i) => v.sequence.indexOf(step) !== i);
    const uniqueRepeated = [...new Set(repeated)].slice(0, 2);
    const ts = new Date(baseTime.getTime() + id * 1200);
    alerts.push({
      id: id++,
      type: 'rework',
      severity: 'medium',
      message: `Rework loop detected: [${uniqueRepeated.join(' \u2192 ')}] repeats in variant #${v.variant_id} (${v.case_count} cases)`,
      timestamp: ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    });
  }

  const ts = new Date(baseTime.getTime() + id * 1200);
  const recCount = copilot?.recommendations?.length ?? 0;
  alerts.push({
    id: id++,
    type: 'complete',
    severity: 'info',
    message: `Analysis complete: ${pipeline.statistics.total_cases} cases, ${pipeline.statistics.total_activities} activities, ${recCount} automation recommendations generated`,
    timestamp: ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  });

  return alerts;
}

interface LiveMonitorProps {
  pipeline: PipelineOutput;
  copilot: CopilotOutput | null;
}

export function LiveMonitor({ pipeline, copilot }: LiveMonitorProps) {
  const allAlerts = generateAlerts(pipeline, copilot);
  const [visibleCount, setVisibleCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  const replay = useCallback(() => {
    setVisibleCount(0);
    setIsPlaying(true);
  }, []);

  useEffect(() => {
    if (!isPlaying || visibleCount >= allAlerts.length) {
      if (visibleCount >= allAlerts.length) setIsPlaying(false);
      return;
    }
    const delay = visibleCount === 0 ? 500 : 800 + Math.random() * 400;
    const timer = setTimeout(() => {
      setVisibleCount((c) => c + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [visibleCount, isPlaying, allAlerts.length]);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [visibleCount]);

  const visible = allAlerts.slice(0, visibleCount);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">
            Live Process Monitor
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Simulated real-time alert feed from event log analysis
          </p>
        </div>
        <button
          onClick={replay}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg border border-zinc-700 transition-colors"
        >
          {'\u21ba'} Replay
        </button>
      </div>

      <div
        ref={feedRef}
        className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-y-auto font-mono text-xs"
        style={{ height: '480px' }}
      >
        {visible.length === 0 && (
          <div className="flex items-center justify-center h-full text-zinc-600">
            <span className="animate-pulse">Initializing process monitor...</span>
          </div>
        )}
        {visible.map((alert, i) => (
          <div
            key={alert.id}
            className="flex items-start gap-3 px-4 py-3 border-b border-zinc-900 animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}
          >
            <span className="text-zinc-600 whitespace-nowrap flex-shrink-0 pt-0.5">
              {alert.timestamp}
            </span>
            <span className="flex-shrink-0 pt-0.5 w-4 text-center">
              {TYPE_ICONS[alert.type]}
            </span>
            <span className="flex-1 text-zinc-300 leading-relaxed">
              {alert.message}
            </span>
            <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${SEVERITY_STYLES[alert.severity]}`}>
              {alert.severity}
            </span>
          </div>
        ))}
        {isPlaying && visibleCount > 0 && (
          <div className="px-4 py-3 text-zinc-600 animate-pulse">
            Monitoring...
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-zinc-600">
        <span>{visibleCount} / {allAlerts.length} alerts</span>
        {!isPlaying && visibleCount >= allAlerts.length && (
          <span className="text-green-500">Stream complete</span>
        )}
      </div>
    </div>
  );
}
