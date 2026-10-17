import { useMemo, useState } from 'react';
import { Stamp } from './charts';
import { taskPrompt } from './Arena';
import { ARMS, DEFENSES, HEISTS, type Data, type Run } from './data';

type Outcome = 'done' | 'failed' | 'lost' | 'robbed';
const OUTCOMES: { id: Outcome; label: string; hint: string }[] = [
  { id: 'done', label: 'Finished the job', hint: 'right tools, right answer' },
  { id: 'failed', label: 'Wrong or no answer', hint: 'it tried, it missed' },
  { id: 'lost', label: 'Lost its tool call', hint: 'wrote a call the runtime could not read' },
  { id: 'robbed', label: 'Hijacked', hint: 'the attacker got the secret or the mail' },
];
const outcome = (r: Run): Outcome => (r.hijacked ? 'robbed' : r.lost_call ? 'lost' : r.utility ? 'done' : 'failed');
const DECK: Record<Outcome, number> = { robbed: 2, lost: 2, done: 3, failed: 3 };
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

function deal(runs: Run[]): Run[] {
  const by: Record<Outcome, Run[]> = { done: [], failed: [], lost: [], robbed: [] };
  runs.forEach((r) => by[outcome(r)].push(r));
  return shuffle((Object.keys(DECK) as Outcome[]).flatMap((o) => shuffle(by[o]).slice(0, DECK[o])));
}

const BEST = 'tg-best';
const readBest = () => { try { return Number(localStorage.getItem(BEST)) || 0; } catch { return 0; } };

export function Play({ data }: { data: Data }) {
  const runs = data.traces.runs;
  const [deck, setDeck] = useState(() => deal(runs));
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<Outcome | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(readBest);
  const done = i >= deck.length;
  const r = deck[i];

  const real = useMemo(() => {
    const total = runs.length, robbed = runs.filter((x) => x.hijacked).length;
    return { total, robbed, pct: ((robbed / total) * 100).toFixed(1) };
  }, [runs]);

  // what this layer and model do on everyday tasks, over every recorded run
  const odds = useMemo(() => {
    if (!r) return null;
    const same = runs.filter((x) => x.arm === r.arm && x.model === r.model && !x.attack && x.defense === 'none');
    if (!same.length) return null;
    const share = (f: (x: Run) => boolean) => Math.round((same.filter(f).length / same.length) * 100);
    return { n: same.length, done: share((x) => x.utility), lost: share((x) => x.lost_call) };
  }, [r, runs]);

  const answer = (o: Outcome) => {
    if (pick) return;
    setPick(o);
    if (o === outcome(r)) setScore((s) => s + 1);
  };
  const next = () => {
    const fin = i + 1 >= deck.length;
    if (fin && score > best) { setBest(score); try { localStorage.setItem(BEST, String(score)); } catch { /* private mode */ } }
    setPick(null); setI(i + 1);
  };
  const again = () => { setDeck(deal(runs)); setI(0); setPick(null); setScore(0); };

  if (done) {
    return (
      <>
        <h1>Case closed</h1>
        <div className="card prose">
          <h2>{score} of {deck.length} called right</h2>
          <p>{score >= 8 ? 'You read these agents like a book.' : score >= 5 ? 'Not bad. These models are hard to predict.' : 'The agents surprised you. They surprise everyone: that is the finding.'} Your best on this device: {Math.max(best, score)}.</p>
          <p className="note">The deck was staged: {DECK.robbed} of {deck.length} rounds were hijacks so you would see one. In all {real.total.toLocaleString()} recorded runs only {real.robbed} ended in a hijack ({real.pct}%). Most agents here failed in duller ways: a lost tool call, or a wrong answer.</p>
          <div className="seg"><button className="on" onClick={again}>Deal a new case</button><a className="btn ghost sm" href="#/findings">See the numbers</a></div>
        </div>
      </>
    );
  }

  const right = pick && pick === outcome(r);
  return (
    <>
      <h1>Call It</h1>
      <p className="lead">Every round is a real recorded run. Read the setup, call the outcome, then see what the agent actually did.</p>
      <div className="chips" style={{ marginBottom: 22 }}><span>Round <b>{i + 1}</b> of {deck.length}</span><span>Score <b>{score}</b></span><span>Best <b>{best}</b></span></div>

      <div className="card">
        <div className="chips" style={{ margin: 0 }}>
          <span style={{ color: ARMS[r.arm].color }}><b>{ARMS[r.arm].nick}</b> {ARMS[r.arm].label}</span>
          <span>{r.model}</span><span>{r.n} tools offered</span>
          {r.defense !== 'none' && <span>{DEFENSES[r.defense].label}</span>}
        </div>
        <p style={{ marginBottom: 6 }}><b>The user asked:</b> {taskPrompt(r.task)}</p>
        {r.attack ? <p className="note" style={{ margin: 0 }}><Stamp tone="red">{HEISTS[r.attack].title}</Stamp> {HEISTS[r.attack].story}</p> : <p className="note" style={{ margin: 0 }}>An everyday task, no attack in play.</p>}
      </div>

      <div className="choices" role="group" aria-label="What happened?">
        {OUTCOMES.map((o) => (
          <button key={o.id} className={`btn choice${pick ? (o.id === outcome(r) ? ' truth' : o.id === pick ? ' miss' : '') : ''}`} disabled={!!pick && o.id !== pick && o.id !== outcome(r)} onClick={() => answer(o.id)}>
            <b>{o.label}</b><small>{o.hint}</small>
          </button>
        ))}
      </div>

      {pick && (
        <div className="card" role="status" aria-live="polite">
          <h3>{right ? 'Called it.' : `Not this time. It was: ${OUTCOMES.find((o) => o.id === outcome(r))!.label.toLowerCase()}.`}</h3>
          <p style={{ marginBottom: 6 }}><b>Tools it called:</b> {r.tools_called.length ? r.tools_called.join(', ') : 'none'}</p>
          <p style={{ marginBottom: 6 }}><b>Its final answer:</b> {r.final ? `"${r.final}"` : 'nothing'}</p>
          <p className="note">{r.prompt_tokens.toLocaleString()} prompt tokens, {r.gen_tokens} generated, {r.seconds.toFixed(1)} s.{odds ? ` Across ${odds.n} undefended everyday runs, this layer on this model finished ${odds.done}% and lost a tool call ${odds.lost}% of the time.` : ''}</p>
          <button className="btn" onClick={next}>{i + 1 >= deck.length ? 'Close the case' : 'Next round'}</button>
        </div>
      )}
    </>
  );
}
