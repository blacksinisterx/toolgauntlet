// Small hand-drawn SVG charts. No chart library: every mark is a plain element so it themes and scales with CSS variables.
import type { Rate } from './data';

export interface Pt { x: number; y: number; lo?: number; hi?: number }
export interface Series { name: string; color: string; points: Pt[] }

const W = 640, H = 300, M = { l: 54, r: 18, t: 16, b: 44 };

export function LineChart({ series, xs, yMax, yFmt, xLabel, yLabel, band = false, title }: {
  series: Series[]; xs: number[]; yMax?: number; yFmt: (v: number) => string; xLabel: string; yLabel: string; band?: boolean; title: string;
}) {
  const ymax = yMax ?? Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.hi ?? p.y))) * 1.08;
  const X = (v: number) => M.l + ((Math.log(v) - Math.log(xs[0])) / (Math.log(xs[xs.length - 1]) - Math.log(xs[0]))) * (W - M.l - M.r);
  const Y = (v: number) => H - M.b - (v / ymax) * (H - M.t - M.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * ymax);
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}><line x1={M.l} x2={W - M.r} y1={Y(t)} y2={Y(t)} className="grid" /><text x={M.l - 8} y={Y(t) + 4} className="tick" textAnchor="end">{yFmt(t)}</text></g>
        ))}
        {xs.map((x) => <text key={x} x={X(x)} y={H - M.b + 18} className="tick" textAnchor="middle">{x}</text>)}
        <text x={(M.l + W - M.r) / 2} y={H - 6} className="axis" textAnchor="middle">{xLabel}</text>
        <text transform={`translate(14 ${(H - M.b + M.t) / 2}) rotate(-90)`} className="axis" textAnchor="middle">{yLabel}</text>
        {series.map((s) => (
          <g key={s.name}>
            {band && <path d={`${s.points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x)},${Y(p.hi ?? p.y)}`).join(' ')} ${[...s.points].reverse().map((p) => `L${X(p.x)},${Y(p.lo ?? p.y)}`).join(' ')}Z`} fill={s.color} opacity=".12" />}
            <path d={s.points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x)},${Y(p.y)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="3" strokeLinejoin="round" />
            {s.points.map((p) => <circle key={p.x} cx={X(p.x)} cy={Y(p.y)} r="4.5" fill="var(--paper)" stroke={s.color} strokeWidth="2.5"><title>{`${s.name}, ${p.x} tools: ${yFmt(p.y)}`}</title></circle>)}
          </g>
        ))}
      </svg>
      <figcaption className="legend">{series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}</figcaption>
    </figure>
  );
}

/** A rate with its 95% interval as a bar: the bar is the estimate, the whisker is how unsure we are. */
export function RateBar({ r, color = 'var(--red)', label }: { r: Rate; color?: string; label?: string }) {
  if (!r.n) return <div className="ratebar na">n/a</div>;
  return (
    <div className="ratebar" title={`${r.k} of ${r.n} runs (95% interval ${Math.round(r.lo * 100)} to ${Math.round(r.hi * 100)}%)`}>
      {label && <span className="rb-label">{label}</span>}
      <div className="rb-track">
        <div className="rb-fill" style={{ width: `${(r.p ?? 0) * 100}%`, background: color }} />
        <div className="rb-whisker" style={{ left: `${r.lo * 100}%`, width: `${(r.hi - r.lo) * 100}%` }} />
      </div>
      <span className="rb-num">{Math.round((r.p ?? 0) * 100)}% <small>{r.k}/{r.n}</small></span>
    </div>
  );
}

export function Stamp({ children, tone = 'red' }: { children: React.ReactNode; tone?: 'red' | 'teal' | 'amber' | 'muted' }) {
  return <span className={`stamp ${tone}`}>{children}</span>;
}
