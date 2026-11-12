import type { ReactNode } from 'react';
import { fmtDelta } from '../format';

export interface Delta {
  change: number | null; // fraction, e.g. 0.12 = +12%
  vsLabel: string; // e.g. "vs previous 7 days"
  upIsGood?: boolean;
}

export function StatTile({
  label,
  value,
  unit,
  delta,
  note,
  hero,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: Delta;
  note?: ReactNode;
  hero?: boolean;
}) {
  return (
    <div className={`card${hero ? ' hero' : ''}`}>
      <div className="tile-label">{label}</div>
      <div className="tile-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {delta && <DeltaLine {...delta} />}
      {note && <div className="tile-note">{note}</div>}
    </div>
  );
}

function DeltaLine({ change, vsLabel, upIsGood = true }: Delta) {
  if (change == null) {
    return <div className="tile-delta">No comparable previous period</div>;
  }
  const flat = Math.abs(change) < 0.005;
  const good = flat ? null : change > 0 === upIsGood;
  const arrow = flat ? '→' : change > 0 ? '▲' : '▼';
  return (
    <div className="tile-delta">
      <span className={good == null ? '' : good ? 'delta-good' : 'delta-bad'}>
        <span aria-hidden="true">{arrow}</span> {fmtDelta(change)}
      </span>
      <span>{vsLabel}</span>
    </div>
  );
}
