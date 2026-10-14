"""Resumable experiment runner. Appends one JSON line per run to data/runs.jsonl and skips run_ids already present,
so an overnight job can be stopped and restarted freely.

  python -m gauntlet.run --models qwen2.5:7b --arms direct mcp --plan both --n-tools 8 --trials 1 [--limit 5]
(run from harness/ with the venv python)
"""
import argparse
import asyncio
import json
import time
from pathlib import Path

from .agent import run_once
from .arms import ARMS
from .scenarios import attack_plan, benign_plan, build

OUT = Path(__file__).resolve().parents[2] / "data" / "runs.jsonl"


def done_ids(path: Path) -> set[str]:
    if not path.exists():
        return set()
    ids = set()
    for line in path.read_text(encoding="utf8").splitlines():
        try:
            ids.add(json.loads(line)["run_id"])
        except (ValueError, KeyError):
            pass
    return ids


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", nargs="+", default=["qwen2.5:7b"])
    ap.add_argument("--arms", nargs="+", default=list(ARMS))
    ap.add_argument("--plan", choices=["benign", "attack", "both"], default="both")
    ap.add_argument("--n-tools", type=int, nargs="+", default=[8])
    ap.add_argument("--defense", nargs="+", default=["none"], choices=["none", "pin", "prompt", "gate"])
    ap.add_argument("--trials", type=int, default=1)
    ap.add_argument("--limit", type=int, default=0, help="stop after this many NEW runs (0 = no limit)")
    ap.add_argument("--out", type=Path, default=OUT)
    a = ap.parse_args()

    plan = (benign_plan() if a.plan in ("benign", "both") else []) + (attack_plan() if a.plan in ("attack", "both") else [])
    seen = done_ids(a.out)
    todo = []
    for model in a.models:
        for n in a.n_tools:
            for arm in a.arms:
                for d in a.defense:
                    for task, attack, variant in plan:
                        for t in range(a.trials):
                            scn = build(task, attack, n, seed=t, variant=variant)
                            rid = f"{scn.id}|{arm}|{model}|t{t}" + ("" if d == "none" else f"|d:{d}")
                            if rid not in seen:
                                todo.append((scn, arm, model, t, rid, d))
    if a.limit:
        todo = todo[: a.limit]
    print(f"{len(seen)} already done, {len(todo)} to run -> {a.out}", flush=True)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    t0 = time.perf_counter()
    for i, (scn, arm, model, t, rid, d) in enumerate(todo, 1):
        if not scn.applies(arm):  # attack cannot reach the model in this arm: record the fact, do not spend a run
            rec = {"run_id": rid, "scenario": scn.id, "task": scn.task.id, "attack": scn.attack.id, "n_tools": scn.n_tools,
                   "variant": scn.variant, "arm": arm, "model": model, "trial": t, "defense": d, "na": True}
        else:
            rec = await run_once(scn, arm, model, t, defense=d)
        with a.out.open("a", encoding="utf8") as f:
            f.write(json.dumps(rec) + "\n")
        el = time.perf_counter() - t0
        eta = el / i * (len(todo) - i)
        flag = "n/a" if rec.get("na") else f"util={int(rec['utility'])} hijack={int(rec['hijacked'])} {rec['total_s']:.0f}s"
        print(f"[{i}/{len(todo)}] {rid}  {flag}  (eta {eta/60:.0f} min)", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
