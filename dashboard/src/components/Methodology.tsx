import { ARTIFACTS } from '../config';
import { fmtDay } from '../dates';
import type { Minutes } from '../metrics';

export function Methodology({
  minutes,
  onChange,
  onReset,
  fullTrackingDay,
  firstDay,
}: {
  minutes: Minutes;
  onChange: (m: Minutes) => void;
  onReset: () => void;
  fullTrackingDay: string | null;
  firstDay: string | null;
}) {
  const isDefault = ARTIFACTS.every((a) => minutes[a.key] === a.defaultMinutes);
  return (
    <section className="card" id="methodology">
      <div className="card-head">
        <div>
          <h2>How these numbers are calculated</h2>
          <p className="sub">
            Estimated hours saved = artifacts produced × minutes saved per artifact. Adjust the minutes below; the
            change is saved in this browser only.
          </p>
        </div>
        {!isDefault && (
          <button className="link table-toggle" onClick={onReset}>
            Reset to defaults
          </button>
        )}
      </div>

      <div className="assumptions">
        {ARTIFACTS.map((a) => (
          <div className="assumption" key={a.key}>
            <div className="assumption-title">{a.label}</div>
            <label>
              <input
                className="control num"
                type="number"
                min={0}
                max={240}
                step={1}
                value={minutes[a.key]}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(240, Number(e.target.value) || 0));
                  onChange({ ...minutes, [a.key]: v });
                }}
                aria-label={`Minutes saved per ${a.label.toLowerCase()}`}
              />
              <span className="secondary">min each</span>
            </label>
            <p>{a.description}</p>
            <p className="muted">Default: {a.defaultMinutes} min</p>
          </div>
        ))}
      </div>

      <ul className="notes">
        <li>
          <strong>No “before Zeeker” baseline yet.</strong> Tracking starts
          {firstDay ? ` on ${fmtDay(firstDay)}` : ' when Zeeker launched'}, so time saved is an estimate from the
          minutes above, not a measured before/after comparison.
        </li>
        <li>
          <strong>Tracking was added in stages.</strong> Case, draft, handoff and GHO counts go back to launch.
          Research runs, screen time and per-case feature usage are only tracked
          {fullTrackingDay ? ` since ${fmtDay(fullTrackingDay)}` : ' since the second release'}; earlier days show
          zero for those, which doesn’t mean they weren’t used.
        </li>
        <li>
          <strong>Drafts</strong> are counted when the plugin produces (auto-copies) them. Manual copies of an
          existing draft are re-use and aren’t counted.
        </li>
        <li>
          <strong>Cases worked</strong> = cases with Zeeker activity between their first and last event that overlap
          the selected dates. A case worked by two agents counts once for the team and once for each agent.
        </li>
        <li>
          <strong>Median TTR</strong> uses cases closed in OrgCS during the selected dates (time to resolution, in
          hours). With few closed cases it moves a lot; check the n.
        </li>
        <li>
          <strong>Changes vs previous period</strong> are only shown when the previous period is fully after
          launch, so early days don’t inflate growth.
        </li>
        <li>Days are grouped in your browser’s time zone.</li>
      </ul>
    </section>
  );
}
