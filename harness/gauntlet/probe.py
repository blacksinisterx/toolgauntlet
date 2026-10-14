"""Phase 0 probe: which local models can do native tool calling, and how fast are they on this machine?

Run: .venv/Scripts/python -m gauntlet.probe qwen2.5:7b hermes3:8b ...   (from harness/)
Writes data/probe.json. Everything is measured; nothing here is an estimate.
"""
import json
import sys
import time
from pathlib import Path

import httpx

OLLAMA = "http://localhost:11434"
TOOLS = [
    {"type": "function", "function": {
        "name": "calculator", "description": "Evaluate an arithmetic expression and return the number.",
        "parameters": {"type": "object", "properties": {"expression": {"type": "string"}}, "required": ["expression"]}}},
    {"type": "function", "function": {
        "name": "weather_lookup", "description": "Get the current weather for a city.",
        "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]}}},
]
# (prompt, expected tool, a substring the arguments must contain)
CASES = [
    ("What is 17 * 23? Use a tool.", "calculator", "17"),
    ("What's the weather like in Lahore right now?", "weather_lookup", "lahore"),
    ("Please compute 1250 / 5 for me.", "calculator", "1250"),
]


def probe(model: str) -> dict:
    out = {"model": model, "cases": [], "native_tool_calls": 0, "correct_tool": 0, "valid_args": 0}
    for prompt, want, must in CASES:
        body = {"model": model, "stream": False, "tools": TOOLS, "options": {"temperature": 0, "num_ctx": 4096},
                "messages": [{"role": "user", "content": prompt}]}
        t0 = time.perf_counter()
        try:
            r = httpx.post(f"{OLLAMA}/api/chat", json=body, timeout=600)
            r.raise_for_status()
            d = r.json()
        except Exception as e:  # model without tool support returns HTTP 400
            out["cases"].append({"prompt": prompt, "error": str(e)[:160]})
            continue
        wall = time.perf_counter() - t0
        calls = d.get("message", {}).get("tool_calls") or []
        name = calls[0]["function"]["name"] if calls else None
        args = calls[0]["function"].get("arguments") if calls else None
        ok_args = bool(args) and must.lower() in json.dumps(args).lower()
        out["native_tool_calls"] += bool(calls)
        out["correct_tool"] += name == want
        out["valid_args"] += ok_args
        ev, evd = d.get("eval_count", 0), d.get("eval_duration", 1)
        out["cases"].append({
            "prompt": prompt, "tool": name, "args": args, "wall_s": round(wall, 2),
            "prompt_tokens": d.get("prompt_eval_count"), "gen_tokens": ev,
            "gen_tok_per_s": round(ev / (evd / 1e9), 1) if ev else None,
            "load_s": round(d.get("load_duration", 0) / 1e9, 2),
        })
    n = len(CASES)
    out["verdict"] = "usable" if out["valid_args"] == n else ("partial" if out["valid_args"] else "no")
    return out


if __name__ == "__main__":
    models = sys.argv[1:] or ["qwen2.5:7b"]
    results = []
    for m in models:
        print(f"probing {m} ...", flush=True)
        r = probe(m)
        results.append(r)
        warm = [c["wall_s"] for c in r["cases"][1:] if "wall_s" in c]
        print(f"  {r['verdict']}: native={r['native_tool_calls']}/3 right_tool={r['correct_tool']}/3 args_ok={r['valid_args']}/3"
              f" | warm call {sum(warm)/len(warm):.1f}s | gen {r['cases'][-1].get('gen_tok_per_s')} tok/s" if warm else f"  {r['verdict']}: {r['cases']}", flush=True)
    path = Path(__file__).resolve().parents[2] / "data" / "probe.json"
    path.write_text(json.dumps(results, indent=2))
    print("wrote", path)
