/**
 * Human-readable name normalization for KYP.ai task mining output.
 *
 * Raw activity names come from OCR window captures and are often
 * concatenated app names with "ocr" suffixes (e.g. "intellijocr",
 * "chromeconfluence"). This module translates them to business language.
 */

const APP_DISPLAY: Record<string, string> = {
  intellij:        'IntelliJ',
  intellijocr:     'IntelliJ',
  code:            'VS Code',
  vscode:          'VS Code',
  cursor:          'Cursor',
  chrome:          'Chrome',
  firefox:         'Firefox',
  edge:            'Edge',
  safari:          'Safari',
  teams:           'Microsoft Teams',
  outlook:         'Outlook',
  newoutlook:      'Outlook',
  gmail:           'Gmail',
  slack:           'Slack',
  zoom:            'Zoom',
  meet:            'Google Meet',
  youtrack:        'YouTrack',
  jira:            'Jira',
  linear:          'Linear',
  trello:          'Trello',
  postman:         'Postman',
  insomnia:        'Insomnia',
  dbeaver:         'DBeaver',
  datagrip:        'DataGrip',
  figma:           'Figma',
  sketch:          'Sketch',
  confluence:      'Confluence',
  sharepoint:      'SharePoint',
  notion:          'Notion',
  gitlab:          'GitLab',
  github:          'GitHub',
  bitbucket:       'Bitbucket',
  windowsterminal: 'Terminal',
  terminal:        'Terminal',
  iterm:           'iTerm',
  mobaxterm:       'SSH Client',
  teamcity:        'TeamCity',
  jenkins:         'Jenkins',
  grafana:         'Grafana',
  datadog:         'Datadog',
  excel:           'Excel',
  word:            'Word',
  powerpoint:      'PowerPoint',
  notepad:         'Notepad',
  explorer:        'File Explorer',
  finder:          'Finder',
};

const APP_CATEGORY: Record<string, string> = {
  intellij:        'Coding',
  intellijocr:     'Coding',
  code:            'Coding',
  vscode:          'Coding',
  cursor:          'Coding',
  postman:         'API Testing',
  insomnia:        'API Testing',
  dbeaver:         'Database',
  datagrip:        'Database',
  figma:           'Design',
  sketch:          'Design',
  confluence:      'Documentation',
  sharepoint:      'Documentation',
  notion:          'Documentation',
  gitlab:          'Code Review',
  github:          'Code Review',
  bitbucket:       'Code Review',
  windowsterminal: 'Terminal',
  terminal:        'Terminal',
  mobaxterm:       'Remote Access',
  teamcity:        'CI/CD',
  jenkins:         'CI/CD',
  grafana:         'Monitoring',
  datadog:         'Monitoring',
  youtrack:        'Task Tracking',
  jira:            'Task Tracking',
  linear:          'Task Tracking',
  trello:          'Task Tracking',
  teams:           'Communication',
  outlook:         'Communication',
  newoutlook:      'Communication',
  gmail:           'Communication',
  slack:           'Communication',
  zoom:            'Communication',
};

function lookup(raw: string): { display: string; category: string } | null {
  const key = raw.toLowerCase().replace(/\s+/g, '');
  const withoutOcr = key.replace(/ocr$/, '');

  for (const k of [key, withoutOcr]) {
    if (APP_DISPLAY[k]) {
      return { display: APP_DISPLAY[k], category: APP_CATEGORY[k] ?? '' };
    }
  }

  // Try matching a known app as a prefix (e.g. "chromeconfluence" → Chrome + Confluence)
  for (const [appKey, appName] of Object.entries(APP_DISPLAY)) {
    if (key.startsWith(appKey) && key.length > appKey.length) {
      const rest = key.slice(appKey.length).replace(/ocr$/, '');
      const secondApp = APP_DISPLAY[rest];
      if (secondApp) {
        return { display: `${appName} + ${secondApp}`, category: APP_CATEGORY[appKey] ?? '' };
      }
    }
  }

  return null;
}

/**
 * Normalize a raw KYP.ai activity name to plain business language.
 * Returns the app name with an optional category hint (e.g. "IntelliJ · Coding").
 */
export function normalizeActivityName(raw: string): string {
  if (!raw?.trim()) return raw;

  const result = lookup(raw);
  if (result) {
    return result.category ? `${result.display} · ${result.category}` : result.display;
  }

  // Fallback: split camelCase, trim, capitalize first letter
  return raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^(.)/, c => c.toUpperCase())
    .trim();
}

/**
 * Short variant — app name only, no category. For use in tight spaces (timeline blocks, badges).
 */
export function normalizeActivityNameShort(raw: string): string {
  if (!raw?.trim()) return raw;

  const result = lookup(raw);
  if (result) return result.display;

  return raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^(.)/, c => c.toUpperCase())
    .trim();
}

/**
 * Format a bottleneck transition for human-readable display.
 * Handles the "X → X" rework loop case which confuses non-technical readers.
 */
export function formatBottleneckTransition(
  from: string,
  to: string
): { from: string; to: string; isReworkLoop: boolean; reworkLabel: string } {
  const fromNorm = normalizeActivityName(from);
  const toNorm   = normalizeActivityName(to);
  const isReworkLoop = from === to || fromNorm === toNorm;

  return {
    from:         fromNorm,
    to:           toNorm,
    isReworkLoop,
    reworkLabel:  isReworkLoop
      ? `Rework loop — employees return to ${fromNorm} repeatedly (indicates corrections or interruptions)`
      : '',
  };
}

/**
 * Shorten a UUID-style user identifier for display.
 * "10cc0df6-245d-4b23-..." → "10cc0df6…"
 */
export function formatUserId(id: string): string {
  if (id.length > 16 && id.includes('-')) return id.slice(0, 8) + '…';
  return id;
}
