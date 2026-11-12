// Calendar dates are handled as 'YYYY-MM-DD' strings in the viewer's time zone.

export const browserTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function localDay(date: Date | string, tz: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export const todayIn = (tz: string) => localDay(new Date(), tz);

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

/** Inclusive number of days in [from, to]. */
export function dayCount(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000) + 1;
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function isWeekend(iso: string): boolean {
  const day = parse(iso).getUTCDay();
  return day === 0 || day === 6;
}

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const weekdayMonthDay = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export const fmtDay = (iso: string) => monthDay.format(parse(iso));
export const fmtDayLong = (iso: string) => weekdayMonthDay.format(parse(iso));
export const fmtRange = (from: string, to: string) =>
  from === to ? fmtDay(from) : `${fmtDay(from)} – ${fmtDay(to)}`;
