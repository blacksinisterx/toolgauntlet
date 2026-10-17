import { useMemo, useState } from 'react';
import { LineChart, RateBar, Stamp, type Series } from './charts';
import { ARMS, ARM_ORDER, DEFENSES, HEISTS, pct, pool, type Data, type E1Row } from './data';

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const NS = [8, 15, 30, 60];

export function Findings({ data }: { data: Data }) {
  const { summary: s } = data;
  const armsHere = ARM_ORDER.filter((a) => s.e1.some((r) => r.arm === a));
  const by = (a: string, n: number): E1Row[] => s.e1.filter((r) => r.arm === a && r.n_tools === n);

  const tokens: Series[] = armsHere.map((a) => ({ name: ARMS[a].nick, color: ARMS[a].color, points: NS.filter((n) => by(a, n).length).map((n) => ({ x: n, y: mean(by(a, n).map((r) => r.tokens_step1)) })) }));
  const util: Series[] = armsHere.map((a) => ({
    name: ARMS[a].nick, color: ARMS[a].color,
    points: NS.filter((n) => by(a, n).length).map((n) => { const p = pool(by(a, n).map((r) => r.utility)); return { x: n, y: p.p ?? 0, lo: p.lo, hi: p.hi }; }),
  }));
  const rtt = armsHere.map((a) => ({ a, ms: mean(s.e1.filter((r) => r.arm === a).map((r) => r.tool_rtt_ms)), lost: pool(s.e1.filter((r) => r.arm === a).map((r) => r.lost_call)) }));

  // direct vs MCP: do the model's inputs differ at all?
  const tokenGap = useMemo(() => {
    let gap = 0, cells = 0;
    for (const r of s.e1.filter((r) => r.arm === 'mcp')) {
      const d = s.e1.find((x) => x.arm === 'direct' && x.model === r.model && x.n_tools === r.n_tools);
      if (d) { gap = Math.max(gap, Math.abs(d.tokens_step1 - r.tokens_step1)); cells++; }
    }
    return cells ? { gap: Math.round(gap * 10) / 10, cells } : null;
  }, [s]);
  const perTool = useMemo(() => {
    const d = s.e1.filter((r) => r.arm === 'direct' && r.model === 'qwen2.5:7b');
    const a = d.find((r) => r.n_tools === 8), b = d.find((r) => r.n_tools === 60);
    return a && b ? (b.tokens_step1 - a.tokens_step1) / 52 : null;
  }, [s]);

  const e2 = s.e2.filter((r) => r.defense === 'none');
  const attacks = Object.keys(HEISTS);
  const [defArm, setDefArm] = useState('all');
  const defenseRows = Object.keys(DEFENSES).map((d) => {
    const rows = s.defense_matched.filter((r) => r.defense === d && (defArm === 'all' || r.arm === defArm));
    return { d, hij: pool(rows.map((r) => r.hijacked)), util: pool(rows.map((r) => r.utility)) };
  });

  return (
    <>
      <section className="hero">
        <div>
          <Stamp tone="muted">Case file no. 001</Stamp>
          <h1>Four ways to give an AI agent its tools.<br />Five ways to break them.</h1>
          <p className="lead">Same agent, same tasks, same vault. Only the way the tools reach the model changes. This is what each costs, and how easy each is to rob.</p>
          <div className="chips">
            <span><b>{s.counts.model_runs.toLocaleString()}</b> measured runs</span><span><b>3</b> local models</span>
            <span><b>{armsHere.length}</b> tool layers so far</span><span><b>{s.counts.errors}</b> crashed runs</span>
          </div>
        </div>
        <aside className="board" aria-hidden="true">
          {ARM_ORDER.map((a, i) => <div key={a} className="pin" style={{ ['--r' as string]: `${[-3, 2, -1.5, 3][i]}deg` }}><i style={{ background: ARMS[a].color }} /><b>{ARMS[a].nick}</b><small>{ARMS[a].label}</small></div>)}
          <svg viewBox="0 0 300 220"><path d="M40 40 C120 110 160 20 250 60 S 90 160 60 170 S 220 200 260 150" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeDasharray="1 0" opacity=".8" /></svg>
        </aside>
      </section>

      <section>
        <h2>What does the tool layer cost?</h2>
        <div className="grid2">
          <div className="card">
            <h3>Tokens the model reads before it can act</h3>
            <LineChart series={tokens} xs={NS} yFmt={(v) => `${Math.round(v)}`} xLabel="tools offered" yLabel="prompt tokens, first call" title="Prompt tokens against number of tools" />
            <p className="note">{perTool ? `About ${perTool.toFixed(0)} tokens per tool. ` : ''}{tokenGap ? `MCP and direct calling hand the model the same schemas: across ${tokenGap.cells} model and size combinations they differ by at most ${tokenGap.gap} tokens.` : ''}</p>
          </div>
          <div className="card">
            <h3>Does it still pick the right tool and finish?</h3>
            <LineChart series={util} xs={NS} yMax={1} band yFmt={(v) => `${Math.round(v * 100)}%`} xLabel="tools offered" yLabel="tasks completed" title="Task completion against number of tools" />
            <p className="note">Pooled over the 3 models; shaded band is the 95% interval. Overlapping bands mean no detectable difference.</p>
          </div>
        </div>
        <div className="card">
          <h3>Per-call overhead and failed tool calls</h3>
          <div className="rows rows3">
            {rtt.map((r) => (
              <div key={r.a} className="row"><b style={{ color: ARMS[r.a].color }}>{ARMS[r.a].nick}</b><span>{r.ms < 1 ? '<1' : r.ms.toFixed(1)} ms per tool call</span><span>{pct(r.lost)} of runs lost a tool call <small>({r.lost.k}/{r.lost.n})</small></span></div>
            ))}
          </div>
          <p className="note">"Lost" means the model wrote a tool call the runtime could not parse, so the turn ended with no answer.</p>
        </div>
      </section>

      <section>
        <h2>How easy is the vault to rob?</h2>
        <p className="lead">Each cell is a real attack scenario run many times. The bar is the share of runs where the secret reached the attacker; the whisker is the 95% interval.</p>
        {e2.length === 0 ? <div className="card pending"><Stamp tone="amber">Running</Stamp> The heist runs have not finished yet.</div> : (
          <div className="heat card">
            <div className="hrow head"><span />{ARM_ORDER.filter((a) => e2.some((r) => r.arm === a)).map((a) => <b key={a} style={{ color: ARMS[a].color }}>{ARMS[a].nick}</b>)}</div>
            {attacks.map((at) => (
              <div className="hrow" key={at}>
                <span><b>{HEISTS[at].title}</b><small>{HEISTS[at].via}</small></span>
                {ARM_ORDER.filter((a) => e2.some((r) => r.arm === a)).map((a) => {
                  const rs = e2.filter((r) => r.arm === a && r.attack === at);
                  const p = pool(rs.map((r) => r.hijacked)); const nOnly = rs.reduce((x, r) => x + r.not_applicable, 0);
                  return <div key={a}>{p.n ? <RateBar r={p} /> : nOnly ? <span className="na" title="The attacker's text cannot reach the model here: the developer wrote every tool description.">not exposed</span> : <span className="na">waiting</span>}</div>;
                })}
              </div>
            ))}
          </div>
        )}
        <p className="note"><b>Not exposed</b> is a result, not a gap: with hard-coded tool schemas the attacker cannot put text into a description. It does not mean the agent is safe against everything: the trojan page reaches every layer.</p>
      </section>

      <section>
        <h2>Defense shop</h2>
        <p className="lead">Three cheap defenses. Each is measured twice: how much it cuts the robbery rate, and what it costs in tasks completed.</p>
        <div className="seg" role="tablist" aria-label="Tool layer">
          {['all', ...ARM_ORDER].map((a) => <button key={a} className={defArm === a ? 'on' : ''} onClick={() => setDefArm(a)}>{a === 'all' ? 'All layers' : ARMS[a].nick}</button>)}
        </div>
        <div className="grid2">
          {defenseRows.map(({ d, hij, util }) => (
            <div className="card defense" key={d}>
              <h3>{DEFENSES[d].label}</h3><p className="note">{DEFENSES[d].what}</p>
              {hij.n || util.n ? <>
                <div className="lab">Vault robbed in</div><RateBar r={hij} />
                <div className="lab">Normal tasks still completed</div><RateBar r={util} color="var(--teal)" />
              </> : <Stamp tone="amber">Not run yet</Stamp>}
            </div>
          ))}
        </div>
        <p className="note">Like for like: qwen2.5 3B and 7B at 15 tools, the only runs every defense shares, with the undefended baseline restricted to the same runs. These two models were almost never robbed even without a defense, so there is little for a defense to prevent here. A 0% under a defense is not proof it works. What this section can say is the price: on these runs no defense cost a detectable share of normal tasks (the intervals overlap).</p>
      </section>

      <section className="card limits">
        <h2>What this can and cannot say</h2>
        <ul>
          <li>Three small local models (3B to 8B parameters). Nothing here is a claim about GPT, Claude or Gemini.</li>
          <li>The attacks are written by us, 4 wordings per class, against simulated tools. They are samples, not a complete catalogue.</li>
          <li>Trials differ by tool order, secret and seed at temperature 0, so they measure sensitivity to layout, not sampling noise. Intervals are wide on purpose.</li>
          <li>When intervals overlap we say "no detectable difference". We do not call a winner.</li>
        </ul>
      </section>
    </>
  );
}

