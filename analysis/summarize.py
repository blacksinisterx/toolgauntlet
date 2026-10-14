"""data/runs.jsonl -> data/summary.json + docs/RESULTS.md (generated; do not edit by hand).
Every rate is shown with its n and a Wilson 95% interval. A difference is only called one when the intervals do not overlap.

  .venv\\Scripts\\python analysis\\summarize.py
"""
import json
import math
import statistics as st
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return (0.0, 0.0)
    p = k / n
    d = 1 + z * z / n
    c = p + z * z / (2 * n)
    m = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return ((c - m) / d, (c + m) / d)


def rate(rows, key):
    k = sum(1 for r in rows if r[key])
    lo, hi = wilson(k, len(rows))
    return {"k": k, "n": len(rows), "p": round(k / len(rows), 3) if rows else None, "lo": round(lo, 3), "hi": round(hi, 3)}


def fmt(r):
    return "n/a" if not r or not r["n"] else f"{r['p']*100:.0f}% ({r['k']}/{r['n']}, {r['lo']*100:.0f}-{r['hi']*100:.0f})"


def mean(xs):
    xs = [x for x in xs if x is not None]
    return round(st.mean(xs), 3) if xs else None


def load():
    path = ROOT / "data" / "runs.jsonl"
    return [json.loads(l) for l in path.read_text(encoding="utf8").splitlines() if l.strip()]


def main():
    allrows = load()
    na = [r for r in allrows if r.get("na")]
    runs = [r for r in allrows if not r.get("na")]
    benign = [r for r in runs if not r.get("attack") and r.get("defense", "none") == "none"]
    attack = [r for r in runs if r.get("attack")]
    out = {"counts": {"rows": len(allrows), "model_runs": len(runs), "not_applicable": len(na), "errors": sum(1 for r in runs if r.get("error"))}}

    # E1: cost / accuracy vs number of tools
    e1 = defaultdict(list)
    for r in benign:
        e1[(r["model"], r["arm"], r["n_tools"])].append(r)
    out["e1"] = [{"model": m, "arm": a, "n_tools": n, "runs": len(g), "utility": rate(g, "utility"), "right_tools": rate(g, "right_tools"),
                  "tokens_step1": mean([g_["steps"][0]["prompt_tokens"] for g_ in g if g_["steps"]]),
                  "prompt_tokens": mean([x["prompt_tokens"] for x in g]), "gen_tokens": mean([x["gen_tokens"] for x in g]),
                  "seconds": mean([x["total_s"] for x in g]),
                  "tool_rtt_ms": mean([x["tool_rtt_s"] * 1000 / max(1, len(x["tools_called"])) for x in g])}
                 for (m, a, n), g in sorted(e1.items())]

    # E2/E3: heists
    e2 = defaultdict(list)
    for r in attack:
        e2[(r.get("defense", "none"), r["arm"], r["attack"])].append(r)
    na_by = defaultdict(int)
    for r in na:
        na_by[(r.get("defense", "none"), r["arm"], r["attack"])] += 1
    keys = sorted(set(e2) | set(na_by))
    out["e2"] = [{"defense": d, "arm": a, "attack": at, "runs": len(e2.get(k := (d, a, at), [])), "not_applicable": na_by.get(k, 0),
                  "hijacked": rate(e2.get(k, []), "hijacked"), "secret_read": rate(e2.get(k, []), "secret_read"),
                  "utility": rate(e2.get(k, []), "utility")} for d, a, at in keys]
    by_model = defaultdict(list)
    for r in attack:
        by_model[(r.get("defense", "none"), r["arm"], r["model"])].append(r)
    out["e2_by_model"] = [{"defense": d, "arm": a, "model": m, "hijacked": rate(g, "hijacked")} for (d, a, m), g in sorted(by_model.items())]
    # utility cost of each defense on benign tasks
    cost = defaultdict(list)
    for r in runs:
        if not r.get("attack"):
            cost[(r.get("defense", "none"), r["arm"])].append(r)
    out["defense_utility"] = [{"defense": d, "arm": a, "utility": rate(g, "utility")} for (d, a), g in sorted(cost.items())]

    (ROOT / "data" / "summary.json").write_text(json.dumps(out, indent=2))

    md = ["# Results (generated from data/runs.jsonl, do not edit)\n",
          f"{out['counts']['model_runs']} model runs, {out['counts']['not_applicable']} recorded as not applicable, {out['counts']['errors']} errors. "
          "Rates show `percent (k/n, 95% Wilson interval)`. Local small models only: these say nothing about GPT, Claude or Gemini.\n",
          "## E1. Benign tasks vs number of tools\n",
          "| model | arm | tools | runs | utility | right tool | step-1 prompt tokens | seconds/run | tool RTT ms |", "|---|---|---|---|---|---|---|---|---|"]
    for x in out["e1"]:
        md.append(f"| {x['model']} | {x['arm']} | {x['n_tools']} | {x['runs']} | {fmt(x['utility'])} | {fmt(x['right_tools'])} | {x['tokens_step1']} | {x['seconds']} | {x['tool_rtt_ms']} |")
    md += ["\n## E2. The heists (hijack = the vault was robbed)\n", "| defense | arm | heist | runs | n/a | hijacked | read secrets | task still done |", "|---|---|---|---|---|---|---|---|"]
    for x in out["e2"]:
        md.append(f"| {x['defense']} | {x['arm']} | {x['attack']} | {x['runs']} | {x['not_applicable']} | {fmt(x['hijacked'])} | {fmt(x['secret_read'])} | {fmt(x['utility'])} |")
    md += ["\n## Hijack rate by model\n", "| defense | arm | model | hijacked |", "|---|---|---|---|"]
    md += [f"| {x['defense']} | {x['arm']} | {x['model']} | {fmt(x['hijacked'])} |" for x in out["e2_by_model"]]
    md += ["\n## Utility on benign tasks, per defense (the price of safety)\n", "| defense | arm | utility |", "|---|---|---|"]
    md += [f"| {x['defense']} | {x['arm']} | {fmt(x['utility'])} |" for x in out["defense_utility"]]
    (ROOT / "docs" / "RESULTS.md").write_text("\n".join(md) + "\n", encoding="utf8")
    print("\n".join(md[:2]), "\nwrote data/summary.json and docs/RESULTS.md")


if __name__ == "__main__":
    main()
