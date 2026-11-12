import { fmtCount, fmtHours } from '../format';
import type { AgentRow, Summary } from '../metrics';

function ttrCell(s: Summary) {
  return s.ttr.median == null ? '—' : `${fmtHours(s.ttr.median)} h (n=${s.ttr.n})`;
}

export function AgentTable({
  rows,
  team,
  selected,
  onSelect,
}: {
  rows: AgentRow[];
  team: Summary;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const maxHours = Math.max(...rows.map((r) => r.summary.hoursSaved), 0);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Agent</th>
            <th scope="col">Active days</th>
            <th scope="col">Cases worked</th>
            <th scope="col">Drafts</th>
            <th scope="col">Research</th>
            <th scope="col">Handoffs &amp; GHOs</th>
            <th scope="col">Est. hours saved</th>
            <th scope="col">Hours saved / active day</th>
            <th scope="col">Median TTR (closed)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ person, summary: s }) => {
            const isSel = selected === person.id;
            return (
              <tr key={person.id} className={isSel ? 'is-selected' : undefined}>
                <td>
                  <button
                    className="agent-btn"
                    aria-pressed={isSel}
                    title={isSel ? 'Back to team view' : 'Show only this agent'}
                    onClick={() => onSelect(isSel ? null : person.id)}
                  >
                    {person.name ?? 'Unnamed'}
                  </button>
                </td>
                <td>{fmtCount(s.agentDays)}</td>
                <td>{fmtCount(s.casesWorked)}</td>
                <td>{fmtCount(s.artifacts.drafts)}</td>
                <td>{fmtCount(s.artifacts.research)}</td>
                <td>{fmtCount(s.artifacts.handoffs + s.artifacts.gho)}</td>
                <td>
                  <span className="meter">
                    {fmtHours(s.hoursSaved)} h
                    <span className="meter-track" aria-hidden="true">
                      <span
                        className="meter-fill"
                        style={{ width: `${maxHours ? (s.hoursSaved / maxHours) * 100 : 0}%` }}
                      />
                    </span>
                  </span>
                </td>
                <td>{s.agentDays ? `${fmtHours(s.hoursSaved / s.agentDays)} h` : '—'}</td>
                <td>{ttrCell(s)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Team</th>
            <td>{fmtCount(team.agentDays)}</td>
            <td>{fmtCount(team.casesWorked)}</td>
            <td>{fmtCount(team.artifacts.drafts)}</td>
            <td>{fmtCount(team.artifacts.research)}</td>
            <td>{fmtCount(team.artifacts.handoffs + team.artifacts.gho)}</td>
            <td>{fmtHours(team.hoursSaved)} h</td>
            <td>{team.agentDays ? `${fmtHours(team.hoursSaved / team.agentDays)} h` : '—'}</td>
            <td>{ttrCell(team)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
