const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

/** 1,284 / 12.9K — for counts */
export function fmtCount(n: number): string {
  return Math.abs(n) >= 10_000 ? compact.format(n) : int.format(n);
}

/** Hours with one decimal under 100, whole hours above. */
export function fmtHours(h: number): string {
  return Math.abs(h) >= 100 ? int.format(h) : one.format(h);
}

export function fmtMinutes(min: number): string {
  if (min < 1 && min > 0) return '<1 min';
  if (min >= 90) return `${one.format(min / 60)} h`;
  return `${int.format(min)} min`;
}

export function fmtPct(share: number): string {
  return `${int.format(share * 100)}%`;
}

/** Signed % change, or null when there is no comparable previous value. */
export function pctChange(current: number, previous: number | null | undefined): number | null {
  if (previous == null || previous === 0) return null;
  return (current - previous) / previous;
}

export function fmtDelta(change: number): string {
  const sign = change > 0 ? '+' : change < 0 ? '−' : '±';
  return `${sign}${int.format(Math.abs(change) * 100)}%`;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
