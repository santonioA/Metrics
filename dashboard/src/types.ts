export interface Person {
  id: string;
  name: string | null;
}

export interface Metric {
  id: number;
  code: string;
  name: string;
  unit: 'count' | 'hours' | 'seconds';
  tracking_start: string | null;
  last_seen: string | null;
}

export interface DailyRow {
  day: string; // YYYY-MM-DD in the requested time zone
  user_id: string;
  metric_id: number;
  events: number;
  value: number;
  cases: number;
}

export interface CaseRow {
  case_number: string;
  owner_id: string;
  user_ids: string[];
  first_seen_at: string;
  last_seen_at: string;
  logged_at: string | null;
  removed: boolean;
  closed_at: string | null;
  ttr_hours: number | null;
  research_generated: number;
  re_research: number;
  drafts_generated: number;
  drafts_copied: number;
  handoffs_generated: number;
  handoffs_copied: number;
  gho_generated: number;
  gho_copied: number;
  messages: number;
  screen_seconds: number;
  events: number;
}

export interface DashboardData {
  range: { from: string; to: string; tz: string };
  people: Person[];
  metrics: Metric[];
  daily: DailyRow[];
  cases: CaseRow[];
}
