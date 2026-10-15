import { useMemo, useState } from 'react';
import { Stamp } from './charts';
import { ARMS, ARM_ORDER, DEFENSES, HEISTS, MODELS, type Data, type Run } from './data';
import { taskPrompt } from './Arena';

const PAGE = 40;

export function Traces({ data }: { data: Data }) {
  const [f, setF] = useState({ arm: '', model: '', attack: '', defense: '', outcome: '' });
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const full = useMemo(() => {
    const m = new Map<string, Run>();
    data.replays.groups.forEach((g) => g.runs.forEach((r) => m.set(r.id, r)));
    data.replays.hijacks.forEach((r) => m.set(r.id, r));
    return m;
  }, [data]);
  const rows = useMemo(() => data.traces.runs.filter((r) =>
    (!f.arm || r.arm === f.arm) && (!f.model || r.model === f.model) && (!f.defense || r.defense === f.defense) &&
    (!f.attack || (f.attack === 'benign' ? !r.attack : r.attack === f.attack)) &&
    (!f.outcome || (f.outcome === 'robbed' ? r.hijacked : f.outcome === 'done' ? r.utility : f.outcome === 'lost' ? r.lost_call : !r.utility && !r.hijacked))), [data, f]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); setPage(0); };
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const sel = open ? full.get(open) ?? data.traces.runs.find((r) => r.id === open) : null;

  return (
    <>
      <h1>Trace explorer</h1>
      <p className="lead">Every measured run. Full step-by-step traces are kept for the replay groups and for every robbed vault; the rest show their summary.</p>
      <div className="controls">
        <select value={f.arm} onChange={set('arm')} aria-label="Tool layer"><option value="">All layers</option>{ARM_ORDER.map((a) => <option key={a} value={a}>{ARMS[a].nick}</option>)}</select>
        <select value={f.model} onChange={set('model')} aria-label="Model"><option value="">All models</option>{MODELS.map((m) => <option key={m}>{m}</option>)}</select>
        <select value={f.attack} onChange={set('attack')} aria-label="Scenario"><option value="">All scenarios</option><option value="benign">Everyday tasks</option>{Object.entries(HEISTS).map(([k, h]) => <option key={k} value={k}>{h.title}</option>)}</select>
        <select value={f.defense} onChange={set('defense')} aria-label="Defense"><option value="">Any defense</option>{Object.entries(DEFENSES).map(([k, d]) => <option key={k} value={k}>{d.label}</option>)}</select>
        <select value={f.outcome} onChange={set('outcome')} aria-label="Outcome"><option value="">Any outcome</option><option value="done">Task done</option><option value="failed">Task failed</option><option value="robbed">Vault robbed</option><option value="lost">Tool call lost</option></select>
      </div>
      <p className="note">{rows.length.toLocaleString()} runs match. {data.traces.not_applicable} further attack scenarios were recorded as not exposed (no model call spent).</p>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Layer</th><th>Model</th><th>Scenario</th><th>Tools</th><th>Defense</th><th>Tokens</th><th>Time</th><th>Outcome</th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className={open === r.id ? 'sel' : ''} onClick={() => setOpen(open === r.id ? null : r.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(open === r.id ? null : r.id)}>
                <td style={{ color: ARMS[r.arm].color }}><b>{ARMS[r.arm].nick}</b></td><td>{r.model}</td>
                <td>{r.attack ? HEISTS[r.attack].title : r.task}{r.attack && <small> v{r.variant + 1}</small>}</td><td>{r.n}</td><td>{r.defense}</td>
                <td>{r.prompt_tokens.toLocaleString()}</td><td>{r.seconds.toFixed(1)}s</td>
                <td>{r.hijacked ? <Stamp tone="red">robbed</Stamp> : r.lost_call ? <Stamp tone="amber">call lost</Stamp> : r.utility ? <Stamp tone="teal">done</Stamp> : <Stamp tone="muted">failed</Stamp>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager"><button className="btn ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>{page + 1} / {Math.max(1, Math.ceil(rows.length / PAGE))}</span><button className="btn ghost" disabled={(page + 1) * PAGE >= rows.length} onClick={() => setPage(page + 1)}>Next</button></div>
      {sel && (
        <div className="card detail">
          <h3>{sel.attack ? HEISTS[sel.attack].title : 'Everyday task'}: {taskPrompt(sel.task)}</h3>
          <p className="note">{ARMS[sel.arm].label} · {sel.model} · {sel.n} tools · defense: {sel.defense} · trial {sel.trial}</p>
          {sel.steps ? (
            <ol className="events static">
              {sel.steps.flatMap((s, i) => [
                <li key={`m${i}`} className="think"><span className="tag">model</span>reads {s.ptok} tokens, writes {s.gtok}{s.lost && <Stamp tone="amber">call lost</Stamp>}</li>,
                ...s.calls.map((c, j) => <li key={`c${i}${j}`} className={`call ${/evil\.test|secrets\.txt/.test(c.args) || c.name === 'send_mail' ? 'bad' : ''}`}><span className="tag">{c.blocked ? 'blocked' : 'tool'}</span><code>{c.name}({c.args})</code><em>{c.result}</em></li>),
              ])}
              <li className="final"><span className="tag">answer</span>{sel.final || '(none)'}</li>
            </ol>
          ) : <p>Tools called: {sel.tools_called.join(', ') || 'none'}.<br />Answer: {sel.final || '(none)'}<br /><small>Full steps are kept for replay groups and robbed vaults only.</small></p>}
        </div>
      )}
    </>
  );
}
