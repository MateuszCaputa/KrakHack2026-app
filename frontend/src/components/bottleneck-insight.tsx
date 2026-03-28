'use client';

import { useState } from 'react';
import type { Bottleneck } from '@/lib/types';
import { formatDuration } from '@/lib/utils';
import { formatBottleneckTransition } from '@/lib/format-names';

async function askGeminiAboutBottleneck(bottleneck: Bottleneck, isReworkLoop: boolean, from: string, to: string): Promise<string> {
  const prompt = isReworkLoop
    ? `Employee computer data shows: workers keep returning to "${from}" instead of finishing it in one go. Average return delay: ${formatDuration(bottleneck.avg_wait_seconds)}. Happened ${bottleneck.case_count} times.

Reply with exactly 3 lines separated by blank lines. Each line: max 25 words. No headers. No bullet points.

Line 1: One sentence describing what this looks like in a real office (concrete, human example).
Line 2: One sentence on the single most likely cause.
Line 3: One sentence on the single most effective fix — specific and actionable.

Write like a sharp consultant, not a teacher.`
    : `Employee computer data shows: after "${from}" is done, ${formatDuration(bottleneck.avg_wait_seconds)} passes before "${to}" starts. Happened ${bottleneck.case_count} times. Max delay: ${formatDuration(bottleneck.max_wait_seconds)}.

Reply with exactly 3 lines separated by blank lines. Each line: max 25 words. No headers. No bullet points.

Line 1: One sentence describing what this looks like in a real office (concrete, human example).
Line 2: One sentence on the single most likely cause.
Line 3: One sentence on the single most effective fix — specific and actionable.

Write like a sharp consultant, not a teacher.`;

  const res = await fetch('/api/ask-bottleneck', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  const data = await res.json();
  if (!res.ok || !data.text) {
    throw new Error(data.error ?? 'Empty response from AI');
  }
  return data.text;
}

interface BottleneckInsightProps {
  bottleneck: Bottleneck;
  /** Show inline summary sentence above the toggle. Default true. */
  showSummary?: boolean;
  /** Compact mode: single cause + fix instead of full lists. For use in dense views. */
  compact?: boolean;
}

function getCompactInsight(isReworkLoop: boolean, severity: string): { cause: string; fix: string } {
  if (isReworkLoop) {
    return {
      cause: 'Most likely cause: the employee is interrupted mid-task or starts without all the information they need, forcing them to leave and come back.',
      fix: 'Create a short checklist of everything needed before starting this task. No mid-task detours.',
    };
  }
  if (severity === 'critical' || severity === 'high') {
    return {
      cause: 'Most likely cause: the handoff is manual — someone finishes and has to notify the next person by message or email, which gets delayed or missed.',
      fix: 'Set up an automatic notification the moment this step is completed. The next person should not have to wait to be told.',
    };
  }
  return {
    cause: 'Most likely cause: the next step is waiting for an approval or runs only on a fixed schedule, even when work is ready earlier.',
    fix: 'Set a maximum approval response time and enforce it with a reminder. Consider triggering the next step automatically.',
  };
}

const REWORK_CAUSES = [
  { icon: '📋', text: 'The employee starts the task without all the information they need. They leave to find it in another system or ask a colleague, then come back.' },
  { icon: '📞', text: 'They are interrupted mid-task — a call, an email, a colleague stopping by. When they return, they need time to remember where they were.' },
  { icon: '⏳', text: 'They are waiting for someone else\'s approval or answer before they can continue. They check back repeatedly instead of moving on.' },
  { icon: '❌', text: 'Something was done incorrectly and must be fixed. This may be caused by unclear instructions or missing guidelines.' },
  { icon: '🔄', text: 'There is no clear definition of "done" for this task. Employees are unsure when to move on, so they keep returning to the same step.' },
];

const REWORK_SOLUTIONS = [
  { icon: '✅', text: 'Create a "ready to start" checklist. Before anyone begins, they confirm all required information is in front of them — no mid-task interruptions to fetch data.' },
  { icon: '🚫', text: 'Introduce focus blocks: dedicated time slots for this task, with notifications off and no meetings. Even 90 minutes of uninterrupted work eliminates most return trips.' },
  { icon: '📝', text: 'Write a one-page process guide defining what inputs are needed, what the output should look like, and when the task is finished. Remove all guesswork.' },
  { icon: '🔗', text: 'Connect your tools: if employees leave to get data from another system, have that data flow automatically to where the work happens.' },
  { icon: '📐', text: 'Define an approval deadline: if someone is waiting for a decision, the approver gets an automatic reminder after a set time. No more open-ended waiting.' },
];

const HANDOFF_CAUSES = [
  { icon: '📬', text: 'The handoff is manual — someone finishes and has to notify the next person by email or message. That message gets delayed, missed, or buried.' },
  { icon: '👤', text: 'Only one specific person can start the next step, and they are busy, on leave, or simply unaware that work is waiting for them.' },
  { icon: '✅', text: 'An approval is required before the next step can begin, but there is no deadline or reminder for the approver. It waits indefinitely.' },
  { icon: '📂', text: 'The output of the first step must be manually moved, formatted, or re-entered somewhere else before the next step can start.' },
  { icon: '📅', text: 'The next step only runs at scheduled intervals (e.g. once a day, on Fridays) even when work arrives earlier — a built-in wait.' },
];

const HANDOFF_SOLUTIONS = [
  { icon: '🔔', text: 'Set up automatic notifications: the moment the first step is completed, the responsible person for the next step gets an instant alert — not an email they may miss.' },
  { icon: '👥', text: 'Assign a backup: if only one person can do the next step, name a second person who can cover when the primary is unavailable.' },
  { icon: '⏱️', text: 'Set a maximum response time: approvals and handoffs must happen within a fixed number of hours. Make this a team agreement with a reminder system.' },
  { icon: '🔁', text: 'Automate the data transfer: if someone manually copies output from one place to another, that move can be done by software — instantly, with no errors.' },
  { icon: '📅', text: 'Move from batch to continuous flow: if the next step only runs on a schedule, ask whether it could trigger automatically whenever work is ready.' },
];

export function BottleneckInsight({ bottleneck, showSummary = true, compact = false }: BottleneckInsightProps) {
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const fmt = formatBottleneckTransition(bottleneck.from_activity, bottleneck.to_activity);

  async function handleAskAI() {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await askGeminiAboutBottleneck(bottleneck, fmt.isReworkLoop, fmt.from, fmt.to);
      setAiText(result);
    } catch {
      setAiError('Could not reach AI. Check your connection and try again.');
    } finally {
      setAiLoading(false);
    }
  }
  if (compact) {
    const { cause, fix } = getCompactInsight(fmt.isReworkLoop, bottleneck.severity);
    const description = fmt.isReworkLoop
      ? `Employees open ${fmt.from} to work on a task, leave before finishing, then come back — on average ${formatDuration(bottleneck.avg_wait_seconds)} later. This happened in ${bottleneck.case_count} cases. The work is being done in fragments instead of start-to-finish.`
      : `After ${fmt.from} finishes, the next step (${fmt.to}) does not start for an average of ${formatDuration(bottleneck.avg_wait_seconds)}. During that time nothing is happening — work is just sitting and waiting. This occurred in ${bottleneck.case_count} cases.`;
    return (
      <div className="space-y-2.5 text-xs leading-relaxed">
        <p className="text-zinc-300">{description}</p>
        <p className="text-zinc-400"><span className="text-zinc-500">Cause — </span>{cause}</p>
        <p className="text-zinc-400"><span className="text-green-500">Fix — </span>{fix}</p>

        {/* AI deep-dive */}
        {!aiText && (
          <button
            onClick={e => { e.stopPropagation(); handleAskAI(); }}
            disabled={aiLoading}
            className="flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors disabled:opacity-60
              border-indigo-800/60 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/40"
          >
            {aiLoading ? (
              <>
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Asking AI…
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/>
                </svg>
                Explain this in more detail with AI
              </>
            )}
          </button>
        )}

        {aiError && <p className="text-red-400 text-[11px]">{aiError}</p>}

        {aiText && (
          <div className="mt-2 space-y-2 border-t border-indigo-900/40 pt-2.5">
            <p className="text-[10px] uppercase tracking-widest text-indigo-400 font-semibold flex items-center gap-1">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/>
              </svg>
              AI Analysis
            </p>
            {aiText.split('\n\n').filter(Boolean).map((para, i) => (
              <p key={i} className="text-zinc-300 leading-relaxed">{para}</p>
            ))}
            <button
              onClick={e => { e.stopPropagation(); setAiText(null); }}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Hide
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Plain-language summary */}
      {showSummary && (
        fmt.isReworkLoop ? (
          <p className="text-xs text-zinc-400 leading-relaxed">
            Your team keeps coming back to <span className="text-amber-300 font-medium">{fmt.from}</span> instead
            of finishing it in one sitting. Each return costs{' '}
            <span className="text-red-400 font-medium">{formatDuration(bottleneck.avg_wait_seconds)}</span> of
            lost momentum across <span className="text-zinc-200 font-medium">{bottleneck.case_count} cases</span>.
          </p>
        ) : (
          <p className="text-xs text-zinc-400 leading-relaxed">
            After <span className="text-zinc-200 font-medium">{fmt.from}</span> finishes, the team waits an average of{' '}
            <span className="text-red-400 font-medium">{formatDuration(bottleneck.avg_wait_seconds)}</span> before{' '}
            <span className="text-zinc-200 font-medium">{fmt.to}</span> can begin —
            across <span className="text-zinc-200 font-medium">{bottleneck.case_count} cases</span>.
            Nobody is adding value during this gap.
          </p>
        )
      )}

      {/* Toggle — clicking directly fires AI */}
      {!aiText && (
        <button
          onClick={e => { e.stopPropagation(); handleAskAI(); }}
          disabled={aiLoading}
          className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium disabled:opacity-60"
        >
          {aiLoading ? (
            <>
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Asking AI…
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Why does this happen? What can you do?
            </>
          )}
        </button>
      )}

      {aiError && <p className="text-red-400 text-[11px]">{aiError}</p>}

      {aiText && (
        <div className="space-y-2 border-t border-zinc-800 pt-3 mt-1">
          <div className="space-y-2">
            {aiText.split('\n\n').filter(Boolean).map((para, i) => (
              <p key={i} className="text-xs text-zinc-300 leading-relaxed">{para}</p>
            ))}
          </div>
          <button
            onClick={e => { e.stopPropagation(); setAiText(null); }}
            className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Hide
          </button>
        </div>
      )}

    </div>
  );
}
