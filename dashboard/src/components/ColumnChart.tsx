import { useLayoutEffect, useRef, useState } from 'react';
import { fmtDay, fmtDayLong } from '../dates';

export interface Series {
  key: string;
  label: string;
  color: string;
}

const GAP = 2; // surface gap between stacked segments
const RADIUS = 4; // rounded data-end
const MAX_COL = 24;
const M = { top: 22, right: 8, bottom: 26, left: 40 };

function niceStep(max: number, target = 4) {
  if (max <= 0) return 1;
  const raw = max / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

function topRounded(x: number, w: number, yTop: number, yBottom: number) {
  const r = Math.min(RADIUS, (yBottom - yTop) / 1, w / 2);
  return `M${x},${yBottom}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop + r}V${yBottom}Z`;
}

/** Stacked (or single-series) columns per day, with a per-day hover/focus tooltip. */
export function ColumnChart({
  days,
  series,
  value,
  format,
  height = 200,
  annotation,
  ariaLabel,
}: {
  days: string[];
  series: Series[];
  value: (dayIndex: number, seriesKey: string) => number;
  format: (v: number) => string;
  height?: number;
  annotation?: { day: string; label: string } | null;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = days.length;
  const plotW = width - M.left - M.right;
  const totals = days.map((_, i) => series.reduce((s, se) => s + value(i, se.key), 0));
  const step = niceStep(Math.max(...totals, 0));
  const maxV = Math.max(step, Math.ceil(Math.max(...totals, 0) / step) * step);
  const ticks = Array.from({ length: Math.round(maxV / step) + 1 }, (_, i) => i * step);
  const y = (v: number) => M.top + height - (v / maxV) * height;
  const band = plotW / Math.max(n, 1);
  const colW = Math.min(MAX_COL, Math.max(3, band * 0.6));
  const cx = (i: number) => M.left + band * (i + 0.5);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 52))));
  const svgH = M.top + height + M.bottom;

  const annIdx = annotation ? days.indexOf(annotation.day) : -1;
  const annX = annIdx >= 0 ? M.left + band * annIdx : 0;
  const annRight = annX > width * 0.65;

  const tipLeft = hover == null ? 0 : cx(hover) + colW / 2 + 10;
  const flip = tipLeft + 180 > width;

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={svgH} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={M.left}
              x2={width - M.right}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 ? 'var(--baseline)' : 'var(--grid)'}
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
            <text className="axis-text" x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {format(t)}
            </text>
          </g>
        ))}

        {annIdx > 0 && (
          <g>
            <line
              x1={annX}
              x2={annX}
              y1={M.top - 6}
              y2={y(0)}
              stroke="var(--text-muted)"
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
            <text
              className="annot-text"
              x={annRight ? annX - 4 : annX + 4}
              y={M.top - 10}
              textAnchor={annRight ? 'end' : 'start'}
            >
              {annotation!.label}
            </text>
          </g>
        )}

        {days.map((d, i) => {
          let cum = 0;
          const segs = series
            .map((s) => ({ s, v: value(i, s.key) }))
            .filter((x) => x.v > 0);
          const x = cx(i) - colW / 2;
          return (
            <g key={d} opacity={hover == null || hover === i ? 1 : 0.55}>
              {segs.map(({ s, v }, k) => {
                const yBottom = y(cum);
                cum += v;
                const yTop = y(cum);
                const isTop = k === segs.length - 1;
                const top = isTop ? yTop : Math.min(yTop + GAP, yBottom);
                if (yBottom - top < 0.5) return null;
                return isTop ? (
                  <path key={s.key} d={topRounded(x, colW, top, yBottom)} fill={s.color} />
                ) : (
                  <rect key={s.key} x={x} y={top} width={colW} height={yBottom - top} fill={s.color} />
                );
              })}
            </g>
          );
        })}

        {days.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={d} className="axis-text" x={cx(i)} y={y(0) + 17} textAnchor="middle">
              {fmtDay(d)}
            </text>
          ) : null,
        )}

        {/* hit targets: the whole day band, bigger than the mark */}
        {days.map((d, i) => (
          <rect
            key={d}
            className="band"
            x={M.left + band * i}
            y={M.top}
            width={band}
            height={height}
            tabIndex={0}
            aria-label={`${fmtDayLong(d)}: ${series
              .map((s) => `${s.label} ${format(value(i, s.key))}`)
              .join(', ')}${series.length > 1 ? `, total ${format(totals[i])}` : ''}`}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover((h) => (h === i ? null : h))}
            onFocus={() => setHover(i)}
            onBlur={() => setHover((h) => (h === i ? null : h))}
          />
        ))}
      </svg>

      {hover != null && (
        <div
          className="tooltip"
          style={{
            top: M.top,
            left: flip ? undefined : tipLeft,
            right: flip ? width - (cx(hover) - colW / 2 - 10) : undefined,
          }}
        >
          <div className="tt-title">{fmtDayLong(days[hover])}</div>
          {[...series].reverse().map((s) => (
            <div className="tt-row" key={s.key}>
              <span>
                <span className="linekey" style={{ background: s.color }} />
                {s.label}
              </span>
              <strong>{format(value(hover, s.key))}</strong>
            </div>
          ))}
          {series.length > 1 && (
            <div className="tt-row tt-total">
              <span>Total</span>
              <strong>{format(totals[hover])}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
