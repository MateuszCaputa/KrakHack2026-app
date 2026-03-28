/**
 * TypeScript interfaces matching backend API contracts.
 */

export interface UploadResponse {
  process_id: string;
  status: string;
  filename: string;
}

export interface RunLocalResponse {
  process_id: string;
  status: string;
  summary: string;
  recommendations_count: number;
  top_recommendations: string[];
  hint: string;
}

export interface PipelineStatistics {
  total_cases: number;
  total_events: number;
  total_activities: number;
  total_variants: number;
  total_users: number;
  total_applications: number;
  avg_case_duration_seconds: number;
  median_case_duration_seconds: number;
  start_date: string;
  end_date: string;
}

export interface Activity {
  name: string;
  frequency: number;
  avg_duration_seconds: number;
  min_duration_seconds: number;
  max_duration_seconds: number;
  applications: string[];
  performers: string[];
  copy_paste_count: number;
  manual_interaction_count: number;
  context_switch_count: number;
  category: string | null;
}

export interface Variant {
  variant_id: number;
  sequence: string[];
  case_count: number;
  percentage: number;
  avg_total_duration_seconds: number;
}

export type BottleneckSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Bottleneck {
  from_activity: string;
  to_activity: string;
  avg_wait_seconds: number;
  max_wait_seconds: number;
  case_count: number;
  severity: BottleneckSeverity;
}

export interface ProcessMapNode {
  id: string;
  label: string;
  frequency: number;
}

export interface ProcessMapEdge {
  source: string;
  target: string;
  weight: number;
  avg_duration_seconds: number;
}

export interface ProcessMap {
  nodes: ProcessMapNode[];
  edges: ProcessMapEdge[];
}

export interface ApplicationUsage {
  application: string;
  total_duration_seconds: number;
  active_duration_seconds: number;
  passive_duration_seconds: number;
}

export interface CopyPasteFlow {
  source_app: string;
  target_app: string;
  count: number;
}

export interface PerformerStats {
  user: string;
  total_events: number;
  total_duration_seconds: number;
  avg_activity_duration_seconds: number;
  top_applications: string[];
  activity_count: number;
}

export interface PipelineOutput {
  process_id: string;
  statistics: PipelineStatistics;
  activities: Activity[];
  variants: Variant[];
  bottlenecks: Bottleneck[];
  process_map: ProcessMap;
  application_usage: ApplicationUsage[];
  copy_paste_flows: CopyPasteFlow[];
  performer_stats?: PerformerStats[];
}

export type RecommendationType =
  | 'automate'
  | 'eliminate'
  | 'simplify'
  | 'parallelize'
  | 'reassign';

export type ImpactLevel = 'low' | 'medium' | 'high';

export interface Recommendation {
  id: number;
  type: RecommendationType;
  target: string;
  reasoning: string;
  impact: ImpactLevel;
  priority: number;
  estimated_time_saved_seconds: number;
  affected_cases_percentage: number;
  automation_type: string;
}

export interface AutomationStep {
  action: string;
  description: string;
  target_app?: string | null;
}

export interface AutomationBlueprint {
  blueprint_id: string;
  name: string;
  target_activity: string;
  automation_type: string;
  trigger_description: string;
  steps: AutomationStep[];
  technology_stack: string[];
  complexity: string;
  estimated_dev_hours: number;
  prerequisites: string[];
}

export interface CopilotOutput {
  process_id: string;
  summary: string;
  recommendations: Recommendation[];
  bpmn_xml: string;
  reference_bpmn_comparison: string | null;
  decision_rules: unknown[];
  process_variables: unknown[];
  blueprints?: AutomationBlueprint[];
}

export interface ApiError {
  error: string;
  detail?: string;
}
