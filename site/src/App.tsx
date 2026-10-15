import { useEffect, useState } from 'react';
import { useData } from './data';
import { Findings } from './Findings';
import { Arena } from './Arena';
import { Heists } from './Heists';
import { Traces } from './Traces';
import { Method } from './Method';

const TABS = [['findings', 'Findings'], ['arena', 'Arena'], ['heists', 'The Heists'], ['traces', 'Traces'], ['method', 'Method']] as const;
const route = () => (location.hash.replace(/^#\/?/, '') || 'findings');

export default function App() {
  const { data, error } = useData();
  const [r, setR] = useState(route());
  const [theme, setTheme] = useState<string>(() => document.documentElement.dataset.theme || 'light');
  useEffect(() => { const f = () => { setR(route()); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  const flip = () => { const n = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n; try { localStorage.setItem('tg-theme', n); } catch { /* private mode */ } setTheme(n); };

  return (
    <div className="shell">
      <header className="top">
        <a className="brand" href="#/findings" aria-label="ToolGauntlet home"><span className="mark">TG</span><b>ToolGauntlet</b></a>
        <nav aria-label="Sections">{TABS.map(([k, l]) => <a key={k} href={`#/${k}`} className={r === k ? 'on' : ''} aria-current={r === k ? 'page' : undefined}>{l}</a>)}</nav>
        <button className="btn ghost sm" onClick={flip} aria-label={theme === 'dark' ? 'Switch to the daylight desk' : 'Switch to the night desk'}>{theme === 'dark' ? 'Day' : 'Night'}</button>
      </header>
      <main>
        {error && <div className="card pending">{error}</div>}
        {!data && !error && <div className="card pending">Opening the case file…</div>}
        {data && (r === 'arena' ? <Arena data={data} /> : r === 'heists' ? <Heists data={data} /> : r === 'traces' ? <Traces data={data} /> : r === 'method' ? <Method data={data} /> : <Findings data={data} />)}
      </main>
      <footer>
        <span>A measured comparison on three small local models. No claim about any other model. Every number comes from <a href="/data/runs.jsonl">runs.jsonl</a>.</span>
        <span>Built by <a href="https://storm-bureau-portfolio.vercel.app/">Aiza Ali</a></span>
      </footer>
    </div>
  );
}
