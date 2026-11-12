/** Ranked/listed horizontal bars, one series (slot-1 hue), value printed at the tip. */
export function HBars({
  rows,
  max,
  format,
  detail,
}: {
  rows: { label: string; value: number }[];
  max?: number;
  format: (v: number) => string;
  detail?: (v: number) => string | null;
}) {
  const top = max ?? Math.max(...rows.map((r) => r.value), 0);
  return (
    <div className="hbars" role="list">
      {rows.map((r) => {
        const pct = top > 0 ? (r.value / top) * 100 : 0;
        const extra = detail?.(r.value);
        return (
          <div
            className="hbar"
            role="listitem"
            key={r.label}
            aria-label={`${r.label}: ${format(r.value)}${extra ? ` (${extra})` : ''}`}
          >
            <span className="hbar-label">{r.label}</span>
            <span className="hbar-track">
              {/* reserve room for the tip label so it never overflows the card */}
              <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex' }}>
                <span className="hbar-fill" style={{ width: `${pct}%`, minWidth: r.value > 0 ? 3 : 0 }} />
              </span>
              <span className="hbar-value" style={{ flex: 'none', minWidth: 90 }}>
                {format(r.value)}
                {extra && <span className="muted">{extra}</span>}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
