import { ARTIFACTS, CASE_LOGGED, SCREENS, type ArtifactKey } from './config';
import { eachDay, localDay } from './dates';
import { median } from './format';
import type { CaseRow, DashboardData, DailyRow, Person } from './types';

export type Minutes = Record<ArtifactKey, number>;

export interface Range {
  from: string;
  to: string;
}

export interface DayPoint {
  day: string;
  hours: Record<ArtifactKey, number>;
  total: number;
  casesAdded: number;
}

export interface Summary {
  range: Range;
  days: DayPoint[];
  artifacts: Record<ArtifactKey, number>;
  artifactTotal: number;
  hoursSaved: number;
  activeAgents: number;
  /** agent-days with any activity */
  agentDays: number;
  casesWorked: number;
  casesAdded: number;
  ttr: { median: number | null; n: number };
  screens: { label: string; seconds: number }[];
  screenAgentDays: number;
}

export interface CaseUsage {
  since: string | null;
  n: number;
  rows: { label: string; count: number }[];
}

export interface AgentRow {
  person: Person;
  summary: Summary;
}

/** Index helpers built once per payload. */
export function indexData(data: DashboardData) {
  const codeById = new Map(data.metrics.map((m) => [m.id, m.code]));
  const artifactByCode = new Map<string, ArtifactKey>();
  for (const a of ARTIFACTS) for (const c of a.metricCodes) artifactByCode.set(c, a.key);
  const screenLabel = new Map(SCREENS.map((s) => [s.code, s.label]));
  const trackingStart = new Map(data.metrics.map((m) => [m.code, m.tracking_start]));
  const firstEvent = data.metrics
    .map((m) => m.tracking_start)
    .filter((t): t is string => !!t)
    .sort()[0];
  return { codeById, artifactByCode, screenLabel, trackingStart, firstEvent };
}

export type DataIndex = ReturnType<typeof indexData>;

const zeroArtifacts = (): Record<ArtifactKey, number> =>
  Object.fromEntries(ARTIFACTS.map((a) => [a.key, 0])) as Record<ArtifactKey, number>;

function inRange(day: string, r: Range) {
  return day >= r.from && day <= r.to;
}

function caseActiveIn(c: CaseRow, r: Range, tz: string) {
  return localDay(c.first_seen_at, tz) <= r.to && localDay(c.last_seen_at, tz) >= r.from;
}

export function summarize(
  data: DashboardData,
  idx: DataIndex,
  r: Range,
  agentId: string | null,
  minutes: Minutes,
  tz: string,
): Summary {
  const dayMap = new Map<string, DayPoint>(
    eachDay(r.from, r.to).map((d) => [d, { day: d, hours: zeroArtifacts(), total: 0, casesAdded: 0 }]),
  );
  const artifacts = zeroArtifacts();
  const activeUsers = new Set<string>();
  const agentDays = new Set<string>();
  const screenAgentDays = new Set<string>();
  const screenSeconds = new Map<string, number>();
  let casesAdded = 0;

  const rows: DailyRow[] = data.daily.filter(
    (d) => inRange(d.day, r) && (!agentId || d.user_id === agentId),
  );
  for (const row of rows) {
    const code = idx.codeById.get(row.metric_id);
    if (!code) continue;
    const point = dayMap.get(row.day);
    activeUsers.add(row.user_id);
    agentDays.add(`${row.user_id}|${row.day}`);

    const art = idx.artifactByCode.get(code);
    if (art) {
      artifacts[art] += row.events;
      if (point) {
        const h = (row.events * minutes[art]) / 60;
        point.hours[art] += h;
        point.total += h;
      }
    }
    if (code === CASE_LOGGED) {
      casesAdded += row.events;
      if (point) point.casesAdded += row.events;
    }
    if (idx.screenLabel.has(code)) {
      screenSeconds.set(code, (screenSeconds.get(code) ?? 0) + Number(row.value));
      screenAgentDays.add(`${row.user_id}|${row.day}`);
    }
  }

  const cases = data.cases.filter(
    (c) => (!agentId || c.user_ids.includes(agentId)) && caseActiveIn(c, r, tz),
  );
  const closedTtr = data.cases
    .filter(
      (c) =>
        c.closed_at &&
        c.ttr_hours != null &&
        inRange(localDay(c.closed_at, tz), r) &&
        (!agentId || c.user_ids.includes(agentId)),
    )
    .map((c) => Number(c.ttr_hours));

  const artifactTotal = Object.values(artifacts).reduce((a, b) => a + b, 0);
  const hoursSaved = ARTIFACTS.reduce((sum, a) => sum + (artifacts[a.key] * minutes[a.key]) / 60, 0);

  return {
    range: r,
    days: [...dayMap.values()],
    artifacts,
    artifactTotal,
    hoursSaved,
    activeAgents: activeUsers.size,
    agentDays: agentDays.size,
    casesWorked: cases.length,
    casesAdded,
    ttr: { median: median(closedTtr), n: closedTtr.length },
    screens: SCREENS.map((s) => ({ label: s.label, seconds: screenSeconds.get(s.code) ?? 0 })),
    screenAgentDays: screenAgentDays.size,
  };
}

/** Which Zeeker features each case used. Only cases first seen once full tracking was live. */
export function caseUsage(
  data: DashboardData,
  idx: DataIndex,
  r: Range,
  agentId: string | null,
  tz: string,
): CaseUsage {
  const since = idx.trackingStart.get('generated_research_action') ?? null;
  const cases = data.cases.filter(
    (c) =>
      (!agentId || c.user_ids.includes(agentId)) &&
      inRange(localDay(c.first_seen_at, tz), r) &&
      (!since || c.first_seen_at >= since),
  );
  const count = (fn: (c: CaseRow) => boolean) => cases.filter(fn).length;
  return {
    since,
    n: cases.length,
    rows: [
      { label: 'Research run', count: count((c) => c.research_generated > 0) },
      { label: 'Draft produced', count: count((c) => c.drafts_generated > 0 || c.drafts_copied > 0) },
      { label: 'Handoff produced', count: count((c) => c.handoffs_generated > 0 || c.handoffs_copied > 0) },
      { label: 'GHO produced', count: count((c) => c.gho_generated > 0 || c.gho_copied > 0) },
      { label: 'Closed in OrgCS', count: count((c) => !!c.closed_at) },
      { label: 'Removed from Zeeker', count: count((c) => c.removed) },
    ],
  };
}

export function agentRows(
  data: DashboardData,
  idx: DataIndex,
  r: Range,
  minutes: Minutes,
  tz: string,
): AgentRow[] {
  return data.people
    .map((p) => ({ person: p, summary: summarize(data, idx, r, p.id, minutes, tz) }))
    .sort((a, b) => b.summary.hoursSaved - a.summary.hoursSaved);
}
