import type { PipelineOutput, CopilotOutput } from './types';
import { formatDuration, formatDate } from './utils';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function generateReport(pipeline: PipelineOutput, copilot: CopilotOutput | null): string {
  const { statistics: stats, bottlenecks, activities, variants, copy_paste_flows } = pipeline;

  const sortedBn = [...bottlenecks]
    .sort((a, b) => {
      const sev: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      return (sev[b.severity] ?? 0) - (sev[a.severity] ?? 0);
    })
    .slice(0, 10);

  const sortedActivities = [...activities].sort((a, b) => b.frequency - a.frequency).slice(0, 15);
  const sortedVariants = [...variants].sort((a, b) => b.case_count - a.case_count).slice(0, 5);

  const recs = copilot?.recommendations
    ? [...copilot.recommendations].sort((a, b) => a.priority - b.priority)
    : [];

  const now = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Process Analysis Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a; line-height: 1.5; font-size: 14px; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  h2 { font-size: 16px; margin-top: 32px; padding: 6px 0; border-bottom: 2px solid #2563eb; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th { background: #f4f4f5; text-align: left; padding: 8px 10px; border: 1px solid #e4e4e7; font-weight: 600; font-size: 12px; }
  td { padding: 6px 10px; border: 1px solid #e4e4e7; }
  tr:nth-child(even) { background: #fafafa; }
  .severity-critical { color: #dc2626; font-weight: 600; }
  .severity-high { color: #ea580c; font-weight: 600; }
  .severity-medium { color: #d97706; }
  .severity-low { color: #65a30d; }
  .impact-high { color: #dc2626; font-weight: 600; }
  .impact-medium { color: #d97706; }
  .impact-low { color: #65a30d; }
  .reasoning { color: #555; font-size: 12px; margin: 4px 0 12px 0; padding-left: 10px; border-left: 2px solid #e4e4e7; }
  .summary-text { background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 12px 0; }
  .stat-box { background: #f4f4f5; padding: 12px; border-radius: 6px; text-align: center; }
  .stat-box .val { font-size: 20px; font-weight: 700; color: #18181b; }
  .stat-box .lbl { font-size: 11px; color: #71717a; text-transform: uppercase; }
  footer { margin-top: 48px; padding-top: 12px; border-top: 1px solid #e4e4e7; text-align: center; color: #a1a1aa; font-size: 11px; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<h1>Process Analysis Report</h1>
<p class="meta">Generated: ${esc(now)} | Process: ${esc(pipeline.process_id)}</p>

${copilot?.summary ? `<h2>Executive Summary</h2><div class="summary-text">${esc(copilot.summary)}</div>` : ''}

<h2>Process Statistics</h2>
<div class="stat-grid">
  <div class="stat-box"><div class="val">${stats.total_cases.toLocaleString()}</div><div class="lbl">Cases</div></div>
  <div class="stat-box"><div class="val">${stats.total_events.toLocaleString()}</div><div class="lbl">Events</div></div>
  <div class="stat-box"><div class="val">${stats.total_activities}</div><div class="lbl">Activities</div></div>
  <div class="stat-box"><div class="val">${stats.total_variants}</div><div class="lbl">Variants</div></div>
  <div class="stat-box"><div class="val">${esc(formatDuration(stats.avg_case_duration_seconds))}</div><div class="lbl">Avg Duration</div></div>
  <div class="stat-box"><div class="val">${esc(formatDate(stats.start_date))} – ${esc(formatDate(stats.end_date))}</div><div class="lbl">Date Range</div></div>
</div>

<h2>Top Activities</h2>
<table>
<tr><th>#</th><th>Activity</th><th>Frequency</th><th>Avg Duration</th><th>Copy-Paste</th><th>Apps</th></tr>
${sortedActivities.map((a, i) => `<tr><td>${i + 1}</td><td>${esc(a.name)}</td><td>${a.frequency.toLocaleString()}</td><td>${esc(formatDuration(a.avg_duration_seconds))}</td><td>${a.copy_paste_count || '—'}</td><td>${esc(a.applications.join(', '))}</td></tr>`).join('\n')}
</table>

<h2>Top Bottlenecks</h2>
<table>
<tr><th>#</th><th>Transition</th><th>Avg Wait</th><th>Max Wait</th><th>Cases</th><th>Severity</th></tr>
${sortedBn.map((b, i) => `<tr><td>${i + 1}</td><td>${esc(b.from_activity)} → ${esc(b.to_activity)}</td><td>${esc(formatDuration(b.avg_wait_seconds))}</td><td>${esc(formatDuration(b.max_wait_seconds))}</td><td>${b.case_count}</td><td><span class="severity-${b.severity}">${b.severity}</span></td></tr>`).join('\n')}
</table>

${recs.length > 0 ? `
<h2>Automation Recommendations</h2>
<table>
<tr><th>#</th><th>P</th><th>Type</th><th>Target</th><th>Time Saved</th><th>Cases</th><th>Impact</th></tr>
${recs.map((r, i) => `<tr><td>${i + 1}</td><td>${r.priority}</td><td>${esc(r.type)}</td><td>${esc(r.target)}</td><td>${esc(formatDuration(r.estimated_time_saved_seconds))}/case</td><td>${r.affected_cases_percentage}%</td><td><span class="impact-${r.impact}">${r.impact}</span></td></tr>`).join('\n')}
</table>
${recs.map((r) => `<div class="reasoning"><strong>${esc(r.target)}</strong>: ${esc(r.reasoning)}</div>`).join('\n')}
` : ''}

${copy_paste_flows && copy_paste_flows.length > 0 ? `
<h2>Cross-App Data Transfers</h2>
<table>
<tr><th>Source</th><th>Target</th><th>Operations</th></tr>
${[...copy_paste_flows].sort((a, b) => b.count - a.count).map((f) => `<tr><td>${esc(f.source_app)}</td><td>${esc(f.target_app)}</td><td>${f.count.toLocaleString()}</td></tr>`).join('\n')}
</table>
` : ''}

<h2>Process Variants (Top ${sortedVariants.length})</h2>
<table>
<tr><th>#</th><th>Cases</th><th>%</th><th>Sequence</th></tr>
${sortedVariants.map((v, i) => `<tr><td>${i + 1}</td><td>${v.case_count}</td><td>${v.percentage.toFixed(1)}%</td><td style="font-size:11px">${esc(v.sequence.join(' → '))}</td></tr>`).join('\n')}
</table>

<footer>Generated by Process-to-Automation Copilot | KrakHack 2026</footer>
</body>
</html>`;
}
