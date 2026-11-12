import { useState, type ReactNode } from 'react';

export interface TableSpec {
  columns: string[];
  rows: (string | number)[][];
}

/** Card with title, optional legend and a table-view toggle (the accessible twin of the chart). */
export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  footer,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  legend?: { label: string; color: string }[];
  table?: TableSpec;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="sub">{subtitle}</p>}
        </div>
        {table && (
          <button className="link table-toggle" onClick={() => setShowTable((s) => !s)}>
            {showTable ? 'Show chart' : 'Show table'}
          </button>
        )}
      </div>
      {legend && legend.length > 1 && !showTable && (
        <div className="legend">
          {legend.map((l) => (
            <span className="legend-item" key={l.label}>
              <span className="swatch" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
      {showTable && table ? <DataTable {...table} /> : children}
      {footer && <div className="card-foot">{footer}</div>}
    </section>
  );
}

export function DataTable({ columns, rows }: TableSpec) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
