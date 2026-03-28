# PRD-6: Live Alert Simulation

**Owner:** Mateusz
**Est:** 45 min
**Priority:** P2 — stretch goal, mentor's #1 WOW request
**Status:** pending
**Depends on:** PRDs 1-3 complete

---

## Why

Mentor Maciej Krzywda specifically asked for "live alerts from log stream" — treating the event log as a real-time stream and showing alerts as bottlenecks/anomalies are detected. This is the biggest differentiator: nobody else at the hackathon will have real-time process monitoring simulation.

## Approach

This is **cosmetic animation**, not real streaming. We take the already-analyzed pipeline data and "replay" insights as if they're being detected in real time. The data is 100% real — we're just animating the presentation.

### What It Shows

A scrolling feed of detected issues, appearing one by one with a timer:

1. **Bottleneck alerts** (red): "Bottleneck detected: Teams → Outlook — avg wait 45m, 12 cases affected"
2. **Context switch alerts** (amber): "High context switching: Browsing in Chrome — 23 app switches detected"
3. **Copy-paste flow alerts** (blue): "Data transfer pattern: Chrome → Excel — 47 copy-paste operations"
4. **Rework loop alerts** (purple): "Rework loop detected: [Teams → Presentation] repeats 12x in variant #5"
5. **Process complete** (green): "Analysis complete: 36 cases, 70 activities, 10 automation recommendations generated"

### UI Design

- New "Live Monitor" tab (or 6th tab after BPMN)
- Dark terminal-style feed with monospace text
- Each alert slides in from bottom with fade animation
- Left side: timestamp (simulated, incrementing)
- Center: alert message with severity icon
- Right side: severity badge (critical/high/medium/info)
- Auto-scrolls, plays through all alerts in ~15 seconds
- "Replay" button to restart the animation

### Data Source

Generate alerts from existing PipelineOutput + CopilotOutput:
- `bottlenecks` → bottleneck alerts (filter to high/critical severity)
- `activities` with high `context_switch_count` → context switch alerts
- `copy_paste_flows` → data transfer alerts
- `variants` with compressed loops → rework alerts
- Final summary → completion alert

## Files

- `frontend/src/components/live-monitor.tsx` (NEW) — the animated feed component
- `frontend/src/components/process-tabs.tsx` — add "Live Monitor" tab

## Verification

- Tab shows animated feed that auto-plays
- Each alert corresponds to real data from the pipeline
- Replay button restarts animation
- `cd frontend && npm run build` passes
- Looks impressive in demo
