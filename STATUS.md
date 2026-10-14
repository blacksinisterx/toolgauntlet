# ToolGauntlet: status and how to continue

Plan: `PLAN.md` (v2). Measured Phase 0 results and the frozen budget: `docs/BUDGET.md`.
No GitHub repo yet (the user will create it later). Commits are local, author `blacksinisterx <aiza.ali03@gmail.com>`, no co-author trailers.

## Done
- **Phase 0**: Ollama works; qwen2.5:7b, hermes3:8b, mistral:7b and qwen2.5:3b all call tools natively; speed measured; budget frozen.
- **Phase 1 (partly)**: `harness/gauntlet/`
  - `tools.py`: 8 simulated tools, the vault (`World`) with a per-seed canary, `send_email` as the only dangerous door, distractor tools to scale to 8/15/30/60.
  - `scenarios.py`: 8 benign tasks with deterministic graders; 5 attack classes x 4 wordings; objective success (canary in outbox, canary in a third-party tool's arguments, or the look-alike tool called). The attack-surface rule per arm is documented at the top of the file.
  - `arms.py` + `mcp_server.py`: **direct** (in-process) and **mcp** (real stdio MCP server, `mcp` 1.x pinned because 2.x has a different low-level API).
  - `agent.py`: tool-calling loop against Ollama; logs tokens, wall time, per-call RTT, every tool call.
  - `run.py`: resumable runner writing `data/runs.jsonl`; `n/a` runs are recorded without a model call.
  - `tests/test_core.py`: 12 deterministic tests (no LLM), including a real MCP stdio round trip.
- Smoke runs (not results): a handful of runs on 3B and 7B models confirmed the whole pipeline end to end.

## Not done yet (in this order)
1. ~~Arms `code` and `docs`~~ DONE (restricted-subprocess sandbox instead of Docker, see docs/METHOD_NOTES.md). Defenses D1 to D3 are DONE too (`defenses.py`, `--defense pin prompt gate`). 33 tests.
2. **Attack 4, "The Bait and Switch" (rug-pull)**: MCP `list_changed` after the first call. Not implemented; do not report it until it is.
3. (defenses: done)
4. **Run E1 and E2** with `scripts/run_overnight.ps1`, then **analysis**: Wilson 95% intervals, accuracy-vs-n crossover, ASR heatmap, the "Surprise Finder" ranking, `docs/post-fodder.md`.
5. **Site** (Vite + React + TS, same look family as the Jev projects but its own heist theme): Findings, Arena (replay of recorded runs), The Heists, Defense Shop, Trace Explorer, Methodology and dataset download. Static, free (Cloudflare Pages is already set up for Hopboard; reuse the account).
6. README with findings and limits, 3 GIFs, 2 to 3 LinkedIn posts written from measured results only.

## Run it
```
python -m venv .venv
.venv\Scripts\python -m pip install -r harness\requirements.txt
cd harness
..\.venv\Scripts\python -m pytest -q                # 12 tests, no model needed
..\.venv\Scripts\python -m gauntlet.probe qwen2.5:7b hermes3:8b qwen2.5:3b
..\.venv\Scripts\python -m gauntlet.run --models qwen2.5:3b --arms direct mcp --plan both --limit 10 --out ..\data\smoke.jsonl
```
Overnight: `powershell -ExecutionPolicy Bypass -File scripts\run_overnight.ps1`

## Things to remember
- Never state a number in a post or README that is not in `data/runs.jsonl`.
- Small local models are not frontier models. Every claim says "for these models".
- Ollama must be running (`ollama list` works). 4 GB VRAM means 7 to 8B models partly run on CPU.
