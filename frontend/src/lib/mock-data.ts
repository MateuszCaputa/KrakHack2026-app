/**
 * Mock data simulating pipeline and copilot output.
 * Used for demo rendering until real modules are wired.
 * Shape matches backend/models.py exactly.
 */

export const MOCK_PIPELINE_OUTPUT = {
  process_id: "demo-001",
  process_steps: [
    {
      name: "Communication",
      frequency: 342,
      avg_duration_seconds: 1620,
      applications: ["Teams", "Outlook", "New Outlook"],
      performers: ["user-01", "user-02", "user-03", "user-04"],
      manual_interaction_count: 890,
      copy_paste_count: 45,
    },
    {
      name: "Working on kyp-backend",
      frequency: 287,
      avg_duration_seconds: 3240,
      applications: ["IntelliJ", "Chrome", "WindowsTerminal"],
      performers: ["user-01", "user-03", "user-05"],
      manual_interaction_count: 2100,
      copy_paste_count: 156,
    },
    {
      name: "Working on kyp-frontend",
      frequency: 198,
      avg_duration_seconds: 2880,
      applications: ["Code", "Chrome", "Figma"],
      performers: ["user-02", "user-04"],
      manual_interaction_count: 1650,
      copy_paste_count: 98,
    },
    {
      name: "Code Review",
      frequency: 145,
      avg_duration_seconds: 1080,
      applications: ["Chrome", "Gitlab", "IntelliJ"],
      performers: ["user-01", "user-02", "user-03"],
      manual_interaction_count: 320,
      copy_paste_count: 67,
    },
    {
      name: "Youtrack Tasks",
      frequency: 210,
      avg_duration_seconds: 540,
      applications: ["Youtrack", "Chrome"],
      performers: ["user-01", "user-02", "user-03", "user-04", "user-05"],
      manual_interaction_count: 450,
      copy_paste_count: 82,
    },
    {
      name: "Documentation",
      frequency: 89,
      avg_duration_seconds: 1800,
      applications: ["Sharepoint", "Confluence", "Chrome"],
      performers: ["user-02", "user-04"],
      manual_interaction_count: 520,
      copy_paste_count: 110,
    },
    {
      name: "Testing & Debugging",
      frequency: 167,
      avg_duration_seconds: 2400,
      applications: ["IntelliJ", "Chrome", "Postman", "Dbeaver"],
      performers: ["user-01", "user-03", "user-05"],
      manual_interaction_count: 780,
      copy_paste_count: 43,
    },
    {
      name: "Deployment",
      frequency: 52,
      avg_duration_seconds: 900,
      applications: ["Team City", "Grafana", "MobaXterm"],
      performers: ["user-01", "user-05"],
      manual_interaction_count: 120,
      copy_paste_count: 28,
    },
  ],
  variants: [
    {
      variant_id: 1,
      sequence: [
        "Youtrack Tasks",
        "Working on kyp-backend",
        "Testing & Debugging",
        "Code Review",
        "Deployment",
      ],
      case_count: 45,
      percentage: 32.1,
      avg_total_duration_seconds: 28800,
    },
    {
      variant_id: 2,
      sequence: [
        "Youtrack Tasks",
        "Working on kyp-frontend",
        "Testing & Debugging",
        "Code Review",
        "Deployment",
      ],
      case_count: 32,
      percentage: 22.9,
      avg_total_duration_seconds: 25200,
    },
    {
      variant_id: 3,
      sequence: [
        "Communication",
        "Youtrack Tasks",
        "Working on kyp-backend",
        "Communication",
        "Code Review",
      ],
      case_count: 28,
      percentage: 20.0,
      avg_total_duration_seconds: 32400,
    },
    {
      variant_id: 4,
      sequence: [
        "Documentation",
        "Working on kyp-frontend",
        "Communication",
        "Code Review",
      ],
      case_count: 18,
      percentage: 12.9,
      avg_total_duration_seconds: 21600,
    },
    {
      variant_id: 5,
      sequence: [
        "Youtrack Tasks",
        "Working on kyp-backend",
        "Working on kyp-backend",
        "Testing & Debugging",
        "Testing & Debugging",
        "Code Review",
        "Deployment",
      ],
      case_count: 17,
      percentage: 12.1,
      avg_total_duration_seconds: 43200,
    },
  ],
  bottlenecks: [
    {
      from_step: "Code Review",
      to_step: "Deployment",
      avg_wait_seconds: 14400,
      max_wait_seconds: 86400,
      case_count: 38,
      severity: "critical",
    },
    {
      from_step: "Working on kyp-backend",
      to_step: "Code Review",
      avg_wait_seconds: 7200,
      max_wait_seconds: 43200,
      case_count: 52,
      severity: "high",
    },
    {
      from_step: "Communication",
      to_step: "Working on kyp-backend",
      avg_wait_seconds: 3600,
      max_wait_seconds: 18000,
      case_count: 67,
      severity: "medium",
    },
    {
      from_step: "Youtrack Tasks",
      to_step: "Working on kyp-frontend",
      avg_wait_seconds: 1800,
      max_wait_seconds: 7200,
      case_count: 30,
      severity: "low",
    },
  ],
  process_map: {
    nodes: [
      { id: "communication", label: "Communication", frequency: 342 },
      { id: "backend", label: "Working on kyp-backend", frequency: 287 },
      { id: "frontend", label: "Working on kyp-frontend", frequency: 198 },
      { id: "review", label: "Code Review", frequency: 145 },
      { id: "youtrack", label: "Youtrack Tasks", frequency: 210 },
      { id: "docs", label: "Documentation", frequency: 89 },
      { id: "testing", label: "Testing & Debugging", frequency: 167 },
      { id: "deploy", label: "Deployment", frequency: 52 },
    ],
    edges: [
      { source: "youtrack", target: "backend", weight: 85 },
      { source: "youtrack", target: "frontend", weight: 62 },
      { source: "backend", target: "testing", weight: 78 },
      { source: "frontend", target: "testing", weight: 55 },
      { source: "testing", target: "review", weight: 90 },
      { source: "review", target: "deploy", weight: 45 },
      { source: "communication", target: "youtrack", weight: 70 },
      { source: "communication", target: "backend", weight: 40 },
      { source: "docs", target: "frontend", weight: 25 },
      { source: "review", target: "backend", weight: 30 },
    ],
  },
  statistics: {
    total_cases: 140,
    total_events: 48520,
    total_process_steps: 8,
    total_variants: 5,
    total_users: 5,
    total_applications: 18,
    avg_case_duration_seconds: 28800,
    median_case_duration_seconds: 25200,
    date_range_start: "2026-03-01",
    date_range_end: "2026-03-20",
  },
  application_usage: [
    { application: "Teams", total_duration_seconds: 427200, active_duration_seconds: 306720, passive_duration_seconds: 120480 },
    { application: "IntelliJ", total_duration_seconds: 388800, active_duration_seconds: 349920, passive_duration_seconds: 38880 },
    { application: "Chrome", total_duration_seconds: 302400, active_duration_seconds: 241920, passive_duration_seconds: 60480 },
    { application: "Code", total_duration_seconds: 259200, active_duration_seconds: 233280, passive_duration_seconds: 25920 },
    { application: "Youtrack", total_duration_seconds: 172800, active_duration_seconds: 155520, passive_duration_seconds: 17280 },
    { application: "Figma", total_duration_seconds: 115200, active_duration_seconds: 92160, passive_duration_seconds: 23040 },
  ],
};

export const MOCK_COPILOT_OUTPUT = {
  process_id: "demo-001",
  summary:
    "The analyzed process covers a software development lifecycle at KYP, involving 5 team members across 18 applications over a 20-day period. The most frequent activities are Communication (342 occurrences) and Working on kyp-backend (287). Critical bottlenecks exist in the Code Review → Deployment transition (avg 4h wait) and excessive copy-paste operations in Documentation (110 operations) suggest manual data transfer between systems.",
  recommendations: [
    {
      id: 1,
      type: "automate",
      target: "Documentation → Copy-paste between Sharepoint and Confluence",
      reasoning:
        "110 copy-paste operations detected between documentation tools. This is a classic RPA candidate — data is being manually transferred between Sharepoint and Confluence instead of synced automatically.",
      impact: "high",
      priority: 1,
      estimated_time_saved_seconds: 36000,
      affected_cases_percentage: 45.2,
      automation_type: "RPA",
    },
    {
      id: 2,
      type: "automate",
      target: "Youtrack Tasks → Code assignment workflow",
      reasoning:
        "82 copy-paste operations from Youtrack to IDE environments. Task details are being manually copied from the issue tracker to development environments. A Youtrack-IDE integration plugin would eliminate this.",
      impact: "high",
      priority: 2,
      estimated_time_saved_seconds: 28800,
      affected_cases_percentage: 67.5,
      automation_type: "API Integration",
    },
    {
      id: 3,
      type: "simplify",
      target: "Code Review → Deployment pipeline",
      reasoning:
        "Average 4-hour wait between code review completion and deployment, with max delays of 24h. The deployment step is manual and requires specific personnel. Automating CI/CD would reduce this to minutes.",
      impact: "high",
      priority: 1,
      estimated_time_saved_seconds: 51840,
      affected_cases_percentage: 32.1,
      automation_type: "CI/CD Pipeline",
    },
    {
      id: 4,
      type: "eliminate",
      target: "Redundant context switches in Communication",
      reasoning:
        "342 communication steps with frequent switches between Teams, Outlook, and New Outlook. Consolidating to a single communication channel would reduce context-switching overhead by an estimated 30%.",
      impact: "medium",
      priority: 3,
      estimated_time_saved_seconds: 14400,
      affected_cases_percentage: 85.0,
      automation_type: "Process Redesign",
    },
    {
      id: 5,
      type: "parallelize",
      target: "Testing & Debugging + Code Review",
      reasoning:
        "Currently sequential: testing must complete before review starts. Variant 5 shows rework loops (double testing, double coding). Introducing automated test suites running in parallel with review would catch issues earlier.",
      impact: "medium",
      priority: 4,
      estimated_time_saved_seconds: 10800,
      affected_cases_percentage: 22.9,
      automation_type: "Workflow Redesign",
    },
  ],
  bpmn_xml: "<placeholder>BPMN XML will be generated here</placeholder>",
  decision_rules: [
    {
      rule_id: "DR-001",
      condition: "IF copy_paste_count > 50 AND applications.length > 1",
      action: "Flag for RPA automation review",
      description: "High cross-application copy-paste indicates manual data transfer",
    },
    {
      rule_id: "DR-002",
      condition: "IF avg_wait_seconds > 3600 AND severity IN ('high', 'critical')",
      action: "Escalate to process owner for pipeline automation",
      description: "Long waits between steps suggest manual handoffs",
    },
  ],
  process_variables: [
    { name: "assignee", type: "string", description: "Task assignee from Youtrack", source_step: "Youtrack Tasks" },
    { name: "review_status", type: "string", description: "Code review outcome", source_step: "Code Review" },
    { name: "deploy_target", type: "string", description: "Target environment", source_step: "Deployment" },
  ],
};

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
