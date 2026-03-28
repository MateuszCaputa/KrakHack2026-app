import type { PipelineOutput, CopilotOutput } from './types';
import { formatDuration, formatDate } from './utils';
import { normalizeActivityName, formatBottleneckTransition } from './format-names';

const HOURLY_RATE = 50; // € per hour

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatEur(n: number): string {
  return n >= 1000 ? `€${(n / 1000).toFixed(1)}k` : `€${Math.round(n)}`;
}

export function generateReport(pipeline: PipelineOutput, copilot: CopilotOutput | null): string {
  const { statistics: stats, bottlenecks, activities, variants, copy_paste_flows } = pipeline;

  const now = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  // Monthly cost calculation
  const days = Math.max(1, (new Date(stats.end_date).getTime() - new Date(stats.start_date).getTime()) / 86_400_000);
  const monthlyMultiplier = 30 / days;
  const totalWaitSeconds = bottlenecks.reduce((s, bn) => s + bn.avg_wait_seconds * bn.case_count, 0);
  const monthlyWasteHours = (totalWaitSeconds / 3600) * monthlyMultiplier;
  const monthlyCost = Math.round(monthlyWasteHours * HOURLY_RATE);

  const sortedBn = [...bottlenecks]
    .sort((a, b) => b.avg_wait_seconds * b.case_count - a.avg_wait_seconds * a.case_count)
    .slice(0, 10);

  const sortedActivities = [...activities].sort((a, b) => b.frequency - a.frequency).slice(0, 15);
  const sortedVariants = [...variants].sort((a, b) => b.case_count - a.case_count).slice(0, 5);
  const topCopyPaste = [...activities].sort((a, b) => b.copy_paste_count - a.copy_paste_count).slice(0, 5);

  const recs = copilot?.recommendations
    ? [...copilot.recommendations].sort((a, b) => a.priority - b.priority)
    : [];

  const criticalHighBn = bottlenecks.filter(b => b.severity === 'critical' || b.severity === 'high').length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Process Analysis Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 960px; margin: 0 auto; padding: 48px 32px;
    background: #09090b; color: #e4e4e7; line-height: 1.6; font-size: 14px;
  }
  a { color: inherit; text-decoration: none; }

  /* Header */
  .header { border-bottom: 1px solid #27272a; padding-bottom: 24px; margin-bottom: 32px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .logo { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #71717a; }
  .meta { font-size: 11px; color: #52525b; text-align: right; }
  h1 { font-size: 28px; font-weight: 800; color: #fafafa; margin-top: 12px; }
  .subtitle { font-size: 13px; color: #71717a; margin-top: 4px; }

  /* Section headers */
  h2 {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;
    color: #52525b; margin: 40px 0 16px 0; padding-bottom: 8px;
    border-bottom: 1px solid #27272a;
  }

  /* Hero cost box */
  .hero {
    background: #18181b; border: 1px solid #27272a; border-radius: 12px;
    padding: 32px; margin-bottom: 8px; position: relative; overflow: hidden;
  }
  .hero-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #71717a; margin-bottom: 8px; }
  .hero-cost { font-size: 64px; font-weight: 900; color: #f87171; line-height: 1; margin-bottom: 8px; }
  .hero-sub { font-size: 16px; font-weight: 500; color: #d4d4d8; }
  .hero-detail { font-size: 12px; color: #71717a; margin-top: 4px; }

  /* Stat grid */
  .stat-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 8px; }
  .stat-box {
    background: #18181b; border: 1px solid #27272a; border-radius: 8px;
    padding: 14px 12px; text-align: center;
  }
  .stat-box .val { font-size: 22px; font-weight: 800; color: #fafafa; }
  .stat-box .lbl { font-size: 10px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
  .stat-box .note { font-size: 10px; color: #52525b; margin-top: 2px; }

  /* Win cards */
  .win-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .win-card {
    background: #18181b; border: 1px solid #27272a; border-radius: 10px; padding: 18px; position: relative;
  }
  .win-rank { position: absolute; top: 12px; right: 14px; font-size: 28px; font-weight: 900; color: #27272a; }
  .win-tag {
    display: inline-block; font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1px; padding: 2px 8px; border-radius: 4px; margin-bottom: 10px;
  }
  .win-title { font-size: 13px; font-weight: 700; color: #fafafa; margin-bottom: 6px; line-height: 1.3; }
  .win-why { font-size: 11px; color: #a1a1aa; line-height: 1.5; margin-bottom: 12px; }
  .win-savings { font-size: 20px; font-weight: 900; color: #4ade80; }
  .win-hours { font-size: 11px; color: #52525b; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th {
    background: #18181b; text-align: left; padding: 8px 12px;
    border-bottom: 1px solid #27272a; font-size: 10px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.5px; color: #71717a;
  }
  td { padding: 8px 12px; border-bottom: 1px solid #1c1c1f; color: #d4d4d8; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #18181b; }
  .table-wrap { background: #18181b; border: 1px solid #27272a; border-radius: 8px; overflow: hidden; }

  /* Severity / impact badges */
  .badge {
    display: inline-block; padding: 1px 7px; border-radius: 4px;
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .sev-critical { background: #450a0a; color: #f87171; }
  .sev-high     { background: #431407; color: #fb923c; }
  .sev-medium   { background: #422006; color: #fbbf24; }
  .sev-low      { background: #14532d; color: #4ade80; }
  .imp-high     { background: #14532d; color: #4ade80; }
  .imp-medium   { background: #422006; color: #fbbf24; }
  .imp-low      { background: #1e1e24; color: #71717a; }

  /* Bottleneck card */
  .bn-card {
    background: #18181b; border: 1px solid #27272a; border-radius: 8px;
    padding: 14px 16px; margin-bottom: 8px;
  }
  .bn-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .bn-transition { font-size: 13px; font-weight: 600; color: #fafafa; margin-bottom: 4px; }
  .bn-description { font-size: 11px; color: #71717a; }
  .bn-stats { display: flex; gap: 20px; text-align: right; flex-shrink: 0; }
  .bn-stat-val { font-size: 16px; font-weight: 800; color: #f87171; }
  .bn-stat-lbl { font-size: 9px; color: #52525b; text-transform: uppercase; }

  /* Reasoning block */
  .reasoning {
    background: #18181b; border-left: 2px solid #3f3f46;
    padding: 10px 14px; margin-bottom: 8px; border-radius: 0 6px 6px 0; font-size: 12px; color: #a1a1aa;
  }
  .reasoning strong { color: #d4d4d8; }

  /* Summary box */
  .summary-box {
    background: #18181b; border: 1px solid #27272a; border-radius: 8px;
    padding: 20px; font-size: 13px; color: #d4d4d8; line-height: 1.7;
  }

  /* Footer */
  footer {
    margin-top: 56px; padding-top: 20px; border-top: 1px solid #27272a;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 11px; color: #52525b;
  }

  @media print {
    body { background: #09090b; padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-top">
    <div class="logo">WorkTrace</div>
    <div class="meta">Generated: ${esc(now)}<br>Process ID: ${esc(pipeline.process_id)}<br>Period: ${esc(formatDate(stats.start_date))} – ${esc(formatDate(stats.end_date))}</div>
  </div>
  <h1>Process Analysis Report</h1>
  <div class="subtitle">${stats.total_users} employees · ${stats.total_cases} cases · ${stats.total_activities} activity types · ${stats.total_variants} process variants</div>
</div>

${copilot?.summary ? `<h2>Executive Summary</h2><div class="summary-box">${esc(copilot.summary)}</div>` : ''}

<!-- HERO -->
<h2>Monthly Cost of Manual Work</h2>
<div class="hero">
  <div class="hero-label">Estimated monthly cost of unautomated processes</div>
  <div class="hero-cost">${esc(formatEur(monthlyCost))}</div>
  <div class="hero-sub">walking out the door every month</div>
  <div class="hero-detail">${Math.round(monthlyWasteHours)}h of idle wait time · based on €${HOURLY_RATE}/h loaded cost · projected from ${Math.round(days)}-day dataset</div>
</div>

<!-- KEY STATS -->
<h2>Key Metrics</h2>
<div class="stat-grid">
  <div class="stat-box">
    <div class="val">${stats.total_cases.toLocaleString()}</div>
    <div class="lbl">Cases analyzed</div>
  </div>
  <div class="stat-box">
    <div class="val">${esc(formatDuration(stats.avg_case_duration_seconds))}</div>
    <div class="lbl">Avg case duration</div>
  </div>
  <div class="stat-box">
    <div class="val" style="color:#f87171">${criticalHighBn}</div>
    <div class="lbl">Critical bottlenecks</div>
    <div class="note">${bottlenecks.length} total found</div>
  </div>
  <div class="stat-box">
    <div class="val">${stats.total_applications}</div>
    <div class="lbl">Tools in use</div>
    <div class="note">more = more friction</div>
  </div>
  <div class="stat-box">
    <div class="val">${stats.total_variants}</div>
    <div class="lbl">Work patterns</div>
    <div class="note">different ways same task done</div>
  </div>
</div>

<!-- TOP AUTOMATION WINS -->
<h2>Top Automation Opportunities</h2>
${recs.length > 0 ? `
<div class="win-grid">
${recs.slice(0, 3).map((r, i) => {
  const hrs = (r.estimated_time_saved_seconds / 3600) * monthlyMultiplier;
  const eur = Math.round(hrs * HOURLY_RATE);
  const tagColors: Record<string, string> = {
    automate: 'background:#14532d;color:#4ade80',
    eliminate: 'background:#450a0a;color:#f87171',
    simplify: 'background:#422006;color:#fbbf24',
    parallelize: 'background:#1e1b4b;color:#818cf8',
    reassign: 'background:#0c1a2e;color:#38bdf8',
  };
  const tagStyle = tagColors[r.type] ?? 'background:#27272a;color:#a1a1aa';
  return `<div class="win-card">
  <div class="win-rank">#${i + 1}</div>
  <span class="win-tag" style="${tagStyle}">${esc(r.type)}</span>
  <div class="win-title">${esc(r.target.length > 55 ? r.target.slice(0, 52) + '…' : r.target)}</div>
  <div class="win-why">${esc(r.reasoning.split('.')[0] + '.')}</div>
  <div class="win-savings">${esc(formatEur(eur))}<span style="font-size:12px;font-weight:400;color:#52525b">/mo</span></div>
  <div class="win-hours">${Math.round(hrs)}h recovered · ${r.impact} impact</div>
</div>`;
}).join('\n')}
</div>
` : `
<div class="win-grid">
${(() => {
  const worstBn = [...bottlenecks].sort((a, b) => b.avg_wait_seconds * b.case_count - a.avg_wait_seconds * a.case_count)[0];
  const topCP = [...activities].sort((a, b) => b.copy_paste_count - a.copy_paste_count)[0];
  const topCtx = [...activities].filter(a => a.context_switch_count > 0).sort((a, b) => b.context_switch_count - a.context_switch_count)[0];
  const wins = [];

  if (worstBn) {
    const t = formatBottleneckTransition(worstBn.from_activity, worstBn.to_activity);
    const hrs = (worstBn.avg_wait_seconds * worstBn.case_count / 3600) * monthlyMultiplier;
    wins.push(`<div class="win-card">
  <div class="win-rank">#1</div>
  <span class="win-tag" style="background:#450a0a;color:#f87171">Fix Bottleneck</span>
  <div class="win-title">${esc(t.isReworkLoop ? normalizeActivityName(worstBn.from_activity) : `${t.from} → ${t.to}`)}</div>
  <div class="win-why">${esc(t.isReworkLoop ? `Employees repeatedly return to this step — ${formatDuration(worstBn.avg_wait_seconds)} avg delay each time across ${worstBn.case_count} cases.` : `Average ${formatDuration(worstBn.avg_wait_seconds)} idle wait between steps across ${worstBn.case_count} cases.`)}</div>
  <div class="win-savings">${esc(formatEur(Math.round(hrs * HOURLY_RATE)))}<span style="font-size:12px;font-weight:400;color:#52525b">/mo</span></div>
  <div class="win-hours">${Math.round(hrs)}h recovered</div>
</div>`);
  }

  if (topCP) {
    const hrs = (topCP.copy_paste_count * 8 / 3600) * monthlyMultiplier;
    wins.push(`<div class="win-card">
  <div class="win-rank">#2</div>
  <span class="win-tag" style="background:#422006;color:#fbbf24">RPA</span>
  <div class="win-title">${esc(normalizeActivityName(topCP.name))}</div>
  <div class="win-why">${esc(`${topCP.copy_paste_count.toLocaleString()} manual copy-paste operations across ${topCP.applications.slice(0, 2).join(' and ')}. Classic RPA target.`)}</div>
  <div class="win-savings">${esc(formatEur(Math.round(hrs * HOURLY_RATE)))}<span style="font-size:12px;font-weight:400;color:#52525b">/mo</span></div>
  <div class="win-hours">${Math.round(hrs)}h recovered</div>
</div>`);
  }

  if (topCtx) {
    const hrs = (topCtx.context_switch_count * 30 / 3600) * monthlyMultiplier;
    wins.push(`<div class="win-card">
  <div class="win-rank">#3</div>
  <span class="win-tag" style="background:#1e1b4b;color:#818cf8">Eliminate</span>
  <div class="win-title">${esc(normalizeActivityName(topCtx.name))}</div>
  <div class="win-why">${esc(`${topCtx.context_switch_count} app switches per case. Every switch costs ~30s of re-focus time.`)}</div>
  <div class="win-savings">${esc(formatEur(Math.round(hrs * HOURLY_RATE)))}<span style="font-size:12px;font-weight:400;color:#52525b">/mo</span></div>
  <div class="win-hours">${Math.round(hrs)}h recovered</div>
</div>`);
  }

  return wins.join('\n');
})()}
</div>
`}

<!-- BOTTLENECKS -->
<h2>Bottlenecks — Biggest First</h2>
${sortedBn.map((b, i) => {
  const t = formatBottleneckTransition(b.from_activity, b.to_activity);
  const totalHrs = Math.round(b.avg_wait_seconds * b.case_count / 3600);
  const totalCost = formatEur(totalHrs * HOURLY_RATE);
  const label = t.isReworkLoop
    ? `↩ ${esc(t.from)} — repeated task`
    : `${esc(t.from)} → ${esc(t.to)}`;
  const desc = t.isReworkLoop
    ? `Employees start this task, leave, then come back — ${formatDuration(b.avg_wait_seconds)} lost each time across ${b.case_count} cases.`
    : `Work sits idle for ${formatDuration(b.avg_wait_seconds)} on average after this step completes. Nobody is adding value during this gap.`;
  return `<div class="bn-card">
  <div class="bn-top">
    <div>
      <div class="bn-transition">${label}</div>
      <div class="bn-description">${esc(desc)}</div>
    </div>
    <div class="bn-stats">
      <div>
        <div class="bn-stat-val">${esc(formatDuration(b.avg_wait_seconds))}</div>
        <div class="bn-stat-lbl">avg wait</div>
      </div>
      <div>
        <div class="bn-stat-val">${b.case_count}</div>
        <div class="bn-stat-lbl">cases</div>
      </div>
      <div>
        <div class="bn-stat-val" style="color:#fbbf24">${esc(totalCost)}</div>
        <div class="bn-stat-lbl">labor lost</div>
      </div>
      <div style="text-align:right">
        <span class="badge sev-${b.severity}">${b.severity}</span>
      </div>
    </div>
  </div>
</div>`;
}).join('\n')}

<!-- RECOMMENDATIONS DETAIL -->
${recs.length > 0 ? `
<h2>Automation Recommendations — Detail</h2>
${recs.map((r, i) => `
<div class="reasoning">
  <strong>#${i + 1} [${esc(r.type.toUpperCase())}] ${esc(r.target)}</strong>
  <span class="badge imp-${r.impact}" style="margin-left:8px">${r.impact}</span>
  <span style="color:#52525b;font-size:10px;margin-left:8px">Priority ${r.priority}</span>
  <br>${esc(r.reasoning)}
  <br><span style="color:#71717a">Estimated: ${esc(formatDuration(r.estimated_time_saved_seconds))} saved · affects ${r.affected_cases_percentage}% of cases</span>
</div>`).join('\n')}
` : ''}

<!-- MANUAL DATA TRANSFERS -->
${copy_paste_flows && copy_paste_flows.length > 0 ? `
<h2>Manual Data Transfers Between Apps</h2>
<p style="font-size:12px;color:#71717a;margin-bottom:12px">Each row is an observed copy-paste flow — data manually moved from one tool to another instead of being synced automatically.</p>
<div class="table-wrap">
<table>
<tr><th>From</th><th>To</th><th>Operations recorded</th></tr>
${[...copy_paste_flows].sort((a, b) => b.count - a.count).slice(0, 15).map(f =>
  `<tr><td>${esc(f.source_app)}</td><td>${esc(f.target_app)}</td><td style="color:#fbbf24;font-weight:600">${f.count.toLocaleString()}</td></tr>`
).join('\n')}
</table>
</div>
` : ''}

<!-- TOP ACTIVITIES -->
<h2>Most Frequent Activities</h2>
<div class="table-wrap">
<table>
<tr><th>#</th><th>Activity</th><th>Occurrences</th><th>Avg Duration</th><th>Copy-pastes</th><th>App switches</th></tr>
${sortedActivities.map((a, i) => `<tr>
  <td style="color:#52525b">${i + 1}</td>
  <td style="color:#fafafa;font-weight:500">${esc(normalizeActivityName(a.name))}</td>
  <td>${a.frequency.toLocaleString()}</td>
  <td>${esc(formatDuration(a.avg_duration_seconds))}</td>
  <td style="${a.copy_paste_count > 50 ? 'color:#fbbf24;font-weight:600' : ''}">${a.copy_paste_count > 0 ? a.copy_paste_count.toLocaleString() : '—'}</td>
  <td>${a.context_switch_count > 0 ? a.context_switch_count.toLocaleString() : '—'}</td>
</tr>`).join('\n')}
</table>
</div>

<!-- PROCESS VARIANTS -->
<h2>Process Variants — How Work Gets Done</h2>
<p style="font-size:12px;color:#71717a;margin-bottom:12px">Each variant is a different sequence of steps employees followed. Variant 1 is the most common path.</p>
<div class="table-wrap">
<table>
<tr><th>#</th><th>Cases</th><th>Share</th><th>Step sequence</th></tr>
${sortedVariants.map((v, i) => `<tr>
  <td style="color:#52525b">${i + 1}</td>
  <td style="font-weight:600">${v.case_count}</td>
  <td>${v.percentage.toFixed(1)}%</td>
  <td style="font-size:11px;color:#a1a1aa">${esc(v.sequence.map(s => normalizeActivityName(s)).join(' → '))}</td>
</tr>`).join('\n')}
</table>
</div>

<footer>
  <span>WorkTrace · KrakHack 2026</span>
  <span>Process ID: ${esc(pipeline.process_id)} · ${esc(now)}</span>
</footer>

</body>
</html>`;
}
