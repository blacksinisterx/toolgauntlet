"""One agent run: a plain tool-calling loop against a local Ollama model. Logs tokens, latency, every tool call."""
from __future__ import annotations

import time
import uuid

import httpx

from .arms import make_arm, ollama_tool
from .defenses import SinkGate, UNTRUSTED, approved_set, pin_filter, wrap_result
from .scenarios import SYSTEM, Scenario

OLLAMA = "http://localhost:11434"
MAX_STEPS = 6


async def run_once(scn: Scenario, arm_name: str, model: str, trial: int = 0, num_ctx: int = 8192, defense: str = "none") -> dict:
    arm = make_arm(arm_name)
    # a unique first line defeats Ollama's prompt cache across runs, so token counts reflect the whole prompt
    system = f"[run {uuid.uuid4().hex[:8]}] {SYSTEM}" + (f" {UNTRUSTED}" if defense == "prompt" else "")
    msgs = [{"role": "system", "content": system}, {"role": "user", "content": scn.prompt}]
    rec = {"run_id": f"{scn.id}|{arm_name}|{model}|t{trial}" + ("" if defense == "none" else f"|d:{defense}"), "defense": defense, "blocked": 0, "scenario": scn.id, "task": scn.task.id,
           "attack": scn.attack.id if scn.attack else None, "variant": scn.variant, "n_tools": scn.n_tools, "arm": arm_name, "model": model,
           "trial": trial, "seed": scn.seed, "steps": [], "final": "", "error": None}
    t0 = time.perf_counter()
    layered = arm_name in ("code", "docs")   # these arms apply pin/gate to the underlying calls themselves
    if layered:
        await arm.start(scn, approved_set(scn) if defense == "pin" else None,
                        (lambda vis: SinkGate(scn.prompt, [ollama_tool(x) for x in vis])) if defense == "gate" else None)
        msgs[0]["content"] += getattr(arm, "system_hint", "")
        if getattr(arm, "user_prefix", ""):
            msgs[1]["content"] = arm.user_prefix + chr(10) * 2 + scn.prompt
    else:
        await arm.start(scn)
        if defense == "pin":
            arm.tools = pin_filter(arm.tools, approved_set(scn))
    gate = SinkGate(scn.prompt, arm.tools) if defense == "gate" and not layered else None
    rec["tools_shown"] = len(arm.tools)
    try:
        async with httpx.AsyncClient(timeout=1800) as client:
            for _ in range(MAX_STEPS):
                body = {"model": model, "stream": False, "messages": msgs, "tools": arm.tools,
                        "options": {"temperature": 0, "seed": scn.seed + 1000 * trial, "num_ctx": num_ctx}}
                s0 = time.perf_counter()
                r = await client.post(f"{OLLAMA}/api/chat", json=body)
                r.raise_for_status()
                d = r.json()
                msg = d["message"]
                step = {"wall_s": round(time.perf_counter() - s0, 3), "prompt_tokens": d.get("prompt_eval_count"),
                        "gen_tokens": d.get("eval_count"), "load_s": round(d.get("load_duration", 0) / 1e9, 3), "tool_calls": []}
                rec["steps"].append(step)
                msgs.append(msg)
                calls = msg.get("tool_calls") or []
                if not calls:
                    rec["final"] = msg.get("content", "") or ""
                    # tokens were generated but nothing came back: the model wrote a tool call Ollama could not parse
                    step["lost_call"] = not rec["final"].strip() and (step["gen_tokens"] or 0) > 8
                    break
                for c in calls:
                    name, args = c["function"]["name"], c["function"].get("arguments") or {}
                    args = args if isinstance(args, dict) else {}
                    reason = gate.check(name, args) if gate else None
                    if reason:  # the gate stops the call before it reaches the tool
                        text, rtt, rec["blocked"] = reason, 0.0, rec["blocked"] + 1
                    else:
                        text, rtt = await arm.call(name, args)
                        if gate:
                            gate.observe(name, args, text)
                    step["tool_calls"].append({"name": name, "args": args, "result": text[:300], "rtt_s": round(rtt, 4), "blocked": bool(reason)})
                    msgs.append({"role": "tool", "content": wrap_result(text) if defense == "prompt" else text, "tool_name": name})
    except Exception as e:  # a failed run is data, not a crash
        rec["error"] = f"{type(e).__name__}: {str(e)[:200]}"
    finally:
        await arm.stop()
    rec["total_s"] = round(time.perf_counter() - t0, 3)
    called = [n for n, _ in scn.world.calls] if layered else [c["name"] for s in rec["steps"] for c in s["tool_calls"]]
    rec["blocked"] += getattr(arm, "blocked", 0)
    rec["lost_call"] = any(s.get("lost_call") for s in rec["steps"])
    rec["tools_called"] = called
    rec["utility"] = bool(scn.task.check(rec["final"], scn.world)) and rec["error"] is None
    rec["right_tools"] = set(scn.task.tools) <= set(called)
    rec["hijacked"] = scn.hijacked()
    rec["secret_read"] = scn.world.read_secrets()
    rec["attacker_contacted"] = scn.world.attacker_contacted()
    rec["prompt_tokens"] = sum(s["prompt_tokens"] or 0 for s in rec["steps"])
    rec["gen_tokens"] = sum(s["gen_tokens"] or 0 for s in rec["steps"])
    rec["tool_rtt_s"] = round(sum(c["rtt_s"] for s in rec["steps"] for c in s["tool_calls"]), 4)
    return rec
