import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthError, fetchData, type Credentials } from './api';
import { AgentTable } from './components/AgentTable';
import { ChartCard } from './components/ChartCard';
import { ColumnChart, type Series } from './components/ColumnChart';
import { HBars } from './components/HBars';
import { Login } from './components/Login';
import { Methodology } from './components/Methodology';
import { StatTile, type Delta } from './components/StatTile';
import { ARTIFACTS, type ArtifactKey } from './config';
import { addDays, browserTimeZone, dayCount, fmtDay, fmtRange, localDay, todayIn } from './dates';
import { fmtCount, fmtHours, fmtMinutes, fmtPct, pctChange } from './format';
import { agentRows, caseUsage, indexData, summarize, type Minutes, type Range, type Summary } from './metrics';
import type { DashboardData } from './types';

const CREDS_KEY = 'zeeker-dashboard:session';
const MINUTES_KEY = 'zeeker-dashboard:minutes';
const LAUNCH_KEY = 'zeeker-dashboard:launch-day';
const THEME_KEY = 'zeeker-dashboard:theme';

type Preset = '7' | '14' | '30' | 'month' | 'launch' | 'custom';
type Theme = 'auto' | 'light' | 'dark';

const PRESETS: { value: Preset; label: string }[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'month', label: 'Month to date' },
  { value: 'launch', label: 'Since launch' },
  { value: 'custom', label: 'Custom range' },
];

// Chart series: handoffs and GHOs share one series (GHOs are rare); color follows the series.
const SERIES: (Series & { keys: ArtifactKey[] })[] = [
  { key: 'drafts', label: 'Drafts', color: 'var(--series-1)', keys: ['drafts'] },
  { key: 'research', label: 'Research', color: 'var(--series-2)', keys: ['research'] },
  { key: 'handoffs', label: 'Handoffs & GHOs', color: 'var(--series-3)', keys: ['handoffs', 'gho'] },
];

const defaultMinutes = (): Minutes =>
  Object.fromEntries(ARTIFACTS.map((a) => [a.key, a.defaultMinutes])) as Minutes;

function loadJSON<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

type Session = Credentials & { name: string };

export function App() {
  const [session, setSession] = useState<Session | null>(() => loadJSON(sessionStorage, CREDS_KEY));
  const [notice, setNotice] = useState<string | null>(null);
  const logout = useCallback((msg?: string) => {
    sessionStorage.removeItem(CREDS_KEY);
    setNotice(msg ?? null);
    setSession(null);
  }, []);

  if (!session) {
    return (
      <>
        {notice && (
          <div className="shell" role="status">
            <div className="error">{notice}</div>
          </div>
        )}
        <Login
          onLogin={(c, name) => {
            const s = { ...c, name };
            sessionStorage.setItem(CREDS_KEY, JSON.stringify(s));
            setNotice(null);
            setSession(s);
          }}
        />
      </>
    );
  }
  return (
    <Dashboard session={session} onLogout={logout} />
  );
}

function Dashboard({ session, onLogout }: { session: Session; onLogout: (msg?: string) => void }) {
  const tz = useMemo(browserTimeZone, []);
  const today = todayIn(tz);

  const [preset, setPreset] = useState<Preset>('7');
  const [custom, setCustom] = useState<Range>({ from: addDays(today, -13), to: today });
  const [agentId, setAgentId] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<Minutes>(() => ({
    ...defaultMinutes(),
    ...(loadJSON<Partial<Minutes>>(localStorage, MINUTES_KEY) ?? {}),
  }));
  const [launchDay, setLaunchDay] = useState<string | null>(() => localStorage.getItem(LAUNCH_KEY));
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(THEME_KEY) as Theme) || 'auto');

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(MINUTES_KEY, JSON.stringify(minutes));
  }, [minutes]);

  // Selected range
  const range: Range = useMemo(() => {
    switch (preset) {
      case '7':
      case '14':
      case '30':
        return { from: addDays(today, -(Number(preset) - 1)), to: today };
      case 'month':
        return { from: `${today.slice(0, 8)}01`, to: today };
      case 'launch':
        return { from: launchDay ?? addDays(today, -365), to: today };
      case 'custom':
        return custom;
    }
  }, [preset, custom, today, launchDay]);

  const rangeValid = range.from <= range.to && dayCount(range.from, range.to) <= 366;
  const len = rangeValid ? dayCount(range.from, range.to) : 0;
  const prev: Range = { from: addDays(range.from, -len), to: addDays(range.from, -1) };
  const canCompare = !!launchDay && len <= 183 && prev.from >= launchDay;
  const fetchFrom = len <= 183 ? prev.from : range.from;

  // Load data (previous period included so deltas need no second call)
  useEffect(() => {
    if (!rangeValid) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchData(session, fetchFrom, range.to, tz)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoadedAt(new Date());
        const first = indexData(d).firstEvent;
        if (first) {
          const day = localDay(first, tz);
          localStorage.setItem(LAUNCH_KEY, day);
          setLaunchDay(day);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof AuthError) onLogout('Your session is no longer valid. Please sign in again.');
        else setError((e as Error).message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [session, fetchFrom, range.to, tz, rangeValid, reloadKey, onLogout]);

  const derived = useMemo(() => {
    if (!data) return null;
    const idx = indexData(data);
    const cur = summarize(data, idx, range, agentId, minutes, tz);
    const team = agentId ? summarize(data, idx, range, null, minutes, tz) : cur;
    const before = canCompare ? summarize(data, idx, prev, agentId, minutes, tz) : null;
    const usage = caseUsage(data, idx, range, agentId, tz);
    const agents = agentRows(data, idx, range, minutes, tz);
    const fullTrackingStart = idx.trackingStart.get('generated_research_action') ?? null;
    return {
      idx,
      cur,
      team,
      before,
      usage,
      agents,
      fullTrackingDay: fullTrackingStart ? localDay(fullTrackingStart, tz) : null,
    };
  }, [data, range.from, range.to, agentId, minutes, tz, canCompare]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const people = data?.people ?? [];
  const agentName = agentId ? (people.find((p) => p.id === agentId)?.name ?? 'Agent') : null;
  const vsLabel = `vs previous ${len} days`;
  const delta = (cur: number, before: number | undefined, upIsGood = true): Delta => ({
    change: pctChange(cur, before),
    vsLabel,
    upIsGood,
  });

  return (
    <div className="shell">
      <header className="header">
        <h1>Zeeker impact{agentName ? ` · ${agentName}` : ''}</h1>
        <div className="who">
          <span>Signed in as {session.name}</span>
          <select
            className="control"
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
            aria-label="Theme"
          >
            <option value="auto">Theme: system</option>
            <option value="light">Theme: light</option>
            <option value="dark">Theme: dark</option>
          </select>
          <button className="btn" onClick={() => onLogout()}>
            Sign out
          </button>
        </div>
      </header>

      <div className="filters">
        <label className="field">
          <span>Dates</span>
          <select className="control" value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {preset === 'custom' && (
          <>
            <label className="field">
              <span>From</span>
              <input
                className="control"
                type="date"
                value={custom.from}
                max={custom.to}
                onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>To</span>
              <input
                className="control"
                type="date"
                value={custom.to}
                min={custom.from}
                max={today}
                onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))}
              />
            </label>
          </>
        )}
        <label className="field">
          <span>Agent</span>
          <select
            className="control"
            value={agentId ?? ''}
            onChange={(e) => setAgentId(e.target.value || null)}
          >
            <option value="">Whole team</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name ?? 'Unnamed'}
              </option>
            ))}
          </select>
        </label>
        <span className="range-note">
          {rangeValid ? fmtRange(range.from, range.to) : 'Pick a range of up to 366 days'} · {tz}
        </span>
      </div>

      {error && (
        <div className="card error" role="alert" style={{ marginBottom: 16 }}>
          Couldn’t load data: {error}{' '}
          <button className="link" onClick={refresh}>
            Try again
          </button>
        </div>
      )}

      {!derived ? (
        <div className="empty">{loading ? 'Loading…' : 'No data yet.'}</div>
      ) : (
        <main className={`stack${loading ? ' loading' : ''}`} aria-busy={loading}>
          <Overview
            d={derived}
            agentName={agentName}
            peopleCount={people.length}
            len={len}
            delta={delta}
          />

          <ChartCard
            title="Estimated hours saved per day"
            subtitle="Artifacts produced × minutes saved each (see “How these numbers are calculated”)"
            legend={SERIES.map((s) => ({ label: s.label, color: s.color }))}
            table={{
              columns: ['Day', 'Drafts', 'Research', 'Handoffs & GHOs', 'Est. hours saved'],
              rows: derived.cur.days.map((p) => [
                fmtDay(p.day),
                fmtHours(p.hours.drafts),
                fmtHours(p.hours.research),
                fmtHours(p.hours.handoffs + p.hours.gho),
                fmtHours(p.total),
              ]),
            }}
          >
            <ColumnChart
              ariaLabel="Estimated hours saved per day, stacked by artifact type"
              days={derived.cur.days.map((p) => p.day)}
              series={SERIES}
              value={(i, key) => {
                const p = derived.cur.days[i];
                return SERIES.find((s) => s.key === key)!.keys.reduce((s, k) => s + p.hours[k], 0);
              }}
              format={(v) => `${fmtHours(v)} h`}
              annotation={
                derived.fullTrackingDay ? { day: derived.fullTrackingDay, label: 'Research tracked from here' } : null
              }
            />
          </ChartCard>

          <div className="grid grid-2">
            <ChartCard
              title="Cases added to Zeeker per day"
              table={{
                columns: ['Day', 'Cases added'],
                rows: derived.cur.days.map((p) => [fmtDay(p.day), fmtCount(p.casesAdded)]),
              }}
            >
              <ColumnChart
                ariaLabel="Cases added to Zeeker per day"
                days={derived.cur.days.map((p) => p.day)}
                series={[{ key: 'cases', label: 'Cases added', color: 'var(--series-1)' }]}
                value={(i) => derived.cur.days[i].casesAdded}
                format={(v) => fmtCount(v)}
                height={160}
              />
            </ChartCard>

            <ChartCard
              title="Artifacts produced"
              subtitle="Count in the selected dates, with the minutes saved each one is credited with"
            >
              <HBars
                rows={ARTIFACTS.map((a) => ({ label: a.label, value: derived.cur.artifacts[a.key] }))}
                format={fmtCount}
              />
              <p className="card-foot">
                {ARTIFACTS.map((a) => `${a.label}: ${minutes[a.key]} min`).join(' · ')}
              </p>
            </ChartCard>
          </div>

          <div className="grid grid-2">
            <ChartCard
              title="What Zeeker is used for"
              subtitle={
                derived.usage.n
                  ? `Share of the ${fmtCount(derived.usage.n)} cases first seen in the selected dates${
                      derived.usage.since ? ` (since full tracking on ${fmtDay(localDay(derived.usage.since, tz))})` : ''
                    }`
                  : 'No cases first seen in the selected dates since full tracking started'
              }
            >
              {derived.usage.n > 0 && (
                <HBars
                  rows={derived.usage.rows.map((r) => ({ label: r.label, value: r.count }))}
                  max={derived.usage.n}
                  format={(v) => fmtPct(v / derived.usage.n)}
                  detail={(v) => `${fmtCount(v)} ${v === 1 ? 'case' : 'cases'}`}
                />
              )}
            </ChartCard>

            <ChartCard
              title="Where time goes in Zeeker"
              subtitle={
                derived.cur.screenAgentDays
                  ? `Total time on each screen · about ${fmtMinutes(
                      derived.cur.screens.reduce((s, x) => s + x.seconds, 0) / 60 / derived.cur.screenAgentDays,
                    )} per active agent-day`
                  : 'No screen time recorded in the selected dates'
              }
            >
              {derived.cur.screenAgentDays > 0 && (
                <HBars
                  rows={derived.cur.screens
                    .filter((s) => s.seconds > 0)
                    .sort((a, b) => b.seconds - a.seconds)
                    .map((s) => ({ label: s.label, value: s.seconds }))}
                  format={(v) => fmtMinutes(v / 60)}
                />
              )}
            </ChartCard>
          </div>

          <ChartCard
            title="By agent"
            subtitle={`${fmtRange(range.from, range.to)} · click a name to see only that agent, click again for the team`}
          >
            <AgentTable rows={derived.agents} team={derived.team} selected={agentId} onSelect={setAgentId} />
          </ChartCard>

          <Methodology
            minutes={minutes}
            onChange={setMinutes}
            onReset={() => setMinutes(defaultMinutes())}
            fullTrackingDay={derived.fullTrackingDay}
            firstDay={launchDay}
          />

          <p className="muted" style={{ fontSize: 12 }}>
            {loadedAt && `Data loaded at ${loadedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · `}
            <button className="link" onClick={refresh} disabled={loading}>
              Refresh
            </button>
          </p>
        </main>
      )}
    </div>
  );
}

function Overview({
  d,
  agentName,
  peopleCount,
  len,
  delta,
}: {
  d: { cur: Summary; team: Summary; before: Summary | null };
  agentName: string | null;
  peopleCount: number;
  len: number;
  delta: (cur: number, before: number | undefined, upIsGood?: boolean) => Delta;
}) {
  const { cur, before, team } = d;
  const perAgentDay = cur.agentDays ? cur.hoursSaved / cur.agentDays : 0;
  const teamPerAgent = team.activeAgents ? team.hoursSaved / team.activeAgents : 0;
  return (
    <div className="grid grid-kpi">
      <StatTile
        hero
        label={agentName ? `Estimated hours saved by ${agentName}` : 'Estimated hours saved by the team'}
        value={fmtHours(cur.hoursSaved)}
        unit="h"
        delta={delta(cur.hoursSaved, before?.hoursSaved)}
        note={
          <>
            From {fmtCount(cur.artifactTotal)} artifacts · {fmtHours(perAgentDay)} h per active{' '}
            {agentName ? 'day' : 'agent-day'}
            {agentName && <> · team average {fmtHours(teamPerAgent)} h per agent</>}
          </>
        }
      />
      <StatTile
        label="Cases worked in Zeeker"
        value={fmtCount(cur.casesWorked)}
        delta={delta(cur.casesWorked, before?.casesWorked)}
        note={`${fmtCount(cur.casesAdded)} added in these dates`}
      />
      {agentName ? (
        <StatTile
          label="Active days"
          value={fmtCount(cur.agentDays)}
          unit={`of ${len}`}
          delta={delta(cur.agentDays, before?.agentDays)}
          note="Days with any Zeeker activity"
        />
      ) : (
        <StatTile
          label="Active agents"
          value={fmtCount(cur.activeAgents)}
          unit={`of ${peopleCount}`}
          delta={delta(cur.activeAgents, before?.activeAgents)}
          note={`${fmtCount(cur.agentDays)} agent-days of use`}
        />
      )}
      <StatTile
        label="Median time to resolution"
        value={cur.ttr.median == null ? '—' : fmtHours(cur.ttr.median)}
        unit={cur.ttr.median == null ? undefined : 'h'}
        delta={
          cur.ttr.median == null
            ? undefined
            : delta(cur.ttr.median, before?.ttr.median ?? undefined, false)
        }
        note={`${fmtCount(cur.ttr.n)} cases closed in OrgCS`}
      />
    </div>
  );
}
