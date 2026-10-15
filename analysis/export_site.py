"""data/runs.jsonl -> site/public/data/*.json  (static files the website reads; no server, no database).

  summary.json   the tables from summarize.py
  traces.json    one light row per model run (for the Trace Explorer)
  replays.json   groups of the SAME scenario run through different arms, with every step, for the Arena and the heist pages
Run summarize.py first, then:  .venv\\Scripts\\python analysis\\export_site.py
"""
import json
import shutil
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "site" / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)

rows = [json.loads(l) for l in (ROOT / "data" / "runs.jsonl").read_text(encoding="utf8").splitlines() if l.strip()]
runs = [r for r in rows if not r.get("na")]
na = [r for r in rows if r.get("na")]


def light(r):
    return {"id": r["run_id"], "arm": r["arm"], "model": r["model"], "task": r["task"], "attack": r.get("attack"), "variant": r.get("variant", 0),
            "n": r["n_tools"], "defense": r.get("defense", "none"), "trial": r["trial"], "utility": r["utility"], "hijacked": r["hijacked"],
            "secret_read": r["secret_read"], "blocked": r.get("blocked", 0), "lost_call": bool(r.get("lost_call")), "tools_called": r["tools_called"],
            "prompt_tokens": r["prompt_tokens"], "gen_tokens": r["gen_tokens"], "seconds": r["total_s"], "final": (r["final"] or "")[:160]}


def full(r):
    d = light(r)
    d["steps"] = [{"wall": s["wall_s"], "ptok": s["prompt_tokens"], "gtok": s["gen_tokens"], "lost": bool(s.get("lost_call")),
                   "calls": [{"name": c["name"], "args": json.dumps(c["args"])[:260], "result": c["result"][:200], "rtt_ms": round(c["rtt_s"] * 1000, 2),
                              "blocked": c.get("blocked", False)} for c in s["tool_calls"]]} for s in r["steps"]]
    d["final"] = (r["final"] or "")[:400]
    return d


# --- replay groups: same scenario/model/trial/defense seen through several arms ---
groups = defaultdict(list)
for r in runs:
    groups[(r["scenario"], r["model"], r["trial"], r.get("defense", "none"))].append(r)
cands = []
for key, g in groups.items():
    if len({r["arm"] for r in g}) < 2:
        continue
    outcomes = {(r["utility"], r["hijacked"]) for r in g}
    interest = (3 if any(r["hijacked"] for r in g) else 0) + (2 if len(outcomes) > 1 else 0) + (1 if any(r.get("lost_call") for r in g) else 0)
    cands.append((interest, key, g))
cands.sort(key=lambda c: (-c[0], c[1]))
chosen, seen_cells = [], defaultdict(int)
for interest, key, g in cands:
    cell = (g[0]["task"], g[0].get("attack"), g[0]["model"])
    if seen_cells[cell] >= 2 or len(chosen) >= 90:
        continue
    seen_cells[cell] += 1
    chosen.append({"scenario": key[0], "model": key[1], "trial": key[2], "defense": key[3], "task": g[0]["task"], "attack": g[0].get("attack"),
                   "n": g[0]["n_tools"], "interest": interest, "runs": [full(r) for r in sorted(g, key=lambda r: r["arm"])]})

hij = [full(r) for r in runs if r["hijacked"]][:80]   # every robbed vault keeps its full trace
(OUT / "replays.json").write_text(json.dumps({"groups": chosen, "hijacks": hij}, separators=(",", ":")))
(OUT / "traces.json").write_text(json.dumps({"runs": [light(r) for r in runs], "not_applicable": len(na)}, separators=(",", ":")))
shutil.copy(ROOT / "data" / "summary.json", OUT / "summary.json")
shutil.copy(ROOT / "data" / "runs.jsonl", OUT / "runs.jsonl")   # the whole dataset is downloadable
print(f"exported: {len(runs)} runs, {len(chosen)} replay groups, {len(hij)} hijack traces, {len(na)} n/a")
for f in OUT.glob("*.json"):
    print(" ", f.name, round(f.stat().st_size / 1024), "KB")
