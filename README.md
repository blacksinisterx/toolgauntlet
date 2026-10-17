# ToolGauntlet

**Four ways to give an AI agent its tools, measured: what each costs, and how easy each is to hijack.**
Everything ran free, on a laptop GPU, against local models. Live site: **https://toolgauntlet.vercel.app**

| Layer (site nickname) | How the model gets its tools |
|---|---|
| Direct function calling (*The Fortress*) | Tool schemas hard-coded in the app, called in-process |
| MCP (*The Embassy*) | A real MCP server over stdio: `tools/list`, then `tools/call` |
| Code execution (*The Workshop*) | The model sees three small tools and writes Python that calls the real tools in a restricted subprocess |
| Raw API + docs (*The Library*) | One `http_request` tool plus the API documentation as text |

Same agent, same eight everyday tasks, same simulated vault (a fake `secrets.txt` with a per-run key). Only the layer changes.
Five attacks ("heists") try to make the agent leak the key or mail the attacker: a poisoned tool description, a trojan web page, an impostor helper tool, a smuggling parameter description, and a look-alike `send_mail` tool. Three cheap defenses are tried on top: pin the approved tool descriptions, tell the model tool text is untrusted, and gate the dangerous `send_email`.

The site has the findings, a replay Arena, a "Call It" prediction game played on real runs, the heists, a trace explorer for every run, and the method.

## Findings (3 local models, 3,636 measured runs)

All numbers come from [`data/runs.jsonl`](data/runs.jsonl) (one line per run) and are rebuilt into [`docs/RESULTS.md`](docs/RESULTS.md). Rates show the 95% Wilson interval where it matters.

- **Direct and MCP hand the model the same thing.** The first-call prompt differs by at most 0.6 tokens across 12 model and size combinations, and both finish the same share of everyday tasks: 73% (210/288) direct, 73% (209/288) MCP. Up to 60 tools there is no detectable difference. MCP's cost is time: 5.7 ms per tool call against under 1 ms, and about 0.7 s more per run on the 3B model (2.7 s against 2.0 s).
- **Tool schemas cost about 48 tokens each.** On qwen2.5:7b the first call grows from 600 tokens at 8 tools to 3,121 at 60. The code layer stays flat at 335 tokens whatever the tool count.
- **"Just give it the API docs" collapses as the API grows.** The docs layer completed 33% (24/72) of everyday tasks at 8 tools and 1% (1/72) at 60. 72% (206/288) of its runs ended in a tool call the runtime could not parse.
- **The code layer barely worked on these models**: 5% (15/288) of everyday tasks, 30% (86/288) of runs lost the tool call. That is a statement about 3B to 8B models writing code inside a JSON argument, not about code execution in general.
- **Hijacks were rare: 10 of 3,636 runs (0.3%).** Four leaked the secret (all hermes3:8b, all via the trojan page, 2 of 12 runs for direct and 2 of 12 for MCP). Six were the model picking the attacker's look-alike mail tool without reading the secret. hermes3 read the secrets file after the trojan page in 8 of 12 direct and 8 of 12 MCP runs; the Qwen models did so in 0 to 2 of 12; the code and docs layers in 0 of 36 each, but they hardly finish a task at all, so that zero says little.
- **Hard-coded tools are not exposed to description attacks.** Three of the five heists live in third-party tool descriptions. A developer-written direct layer never receives them, so those 588 scenarios are recorded as "not exposed" and cost no model call. The trojan page reaches every layer.
- **The defenses could not be shown to help or hurt.** They were run on qwen2.5 3B and 7B at 15 tools, where the undefended hijack rate was already about 1% for MCP (2/192) and 0% elsewhere. Under defense it stayed 0 to 1%. On normal tasks none cost a detectable share (direct 81% undefended against 72 to 81% with a defense; MCP 77% against 75 to 81%). The defenses were **not** run on hermes3, the only model that leaked the secret.

## What this cannot say

- Three small local models (qwen2.5 3B and 7B, hermes3 8B). Nothing here is a claim about GPT, Claude, Gemini or any hosted model.
- Authored attacks (four wordings per class) against simulated tools. They are samples, not a catalogue, and no real server was touched.
- Trials differ by tool order, secret and seed at temperature 0, so intervals measure layout sensitivity, not sampling noise. Cells have 24 runs or fewer, so intervals are wide. When intervals overlap the site says "no detectable difference" and names no winner.
- The code sandbox is an AST allow-list in a restricted subprocess, not Docker, and not a security boundary.
- The sixth attack in the plan (a rug-pull through MCP `list_changed`) was **not implemented**, so there are five heists, not six.
- A few latency cells were inflated by other work sharing the GPU; token counts and accuracy are unaffected.

## A bug we found in our own data

The MCP trojan-page runs were first recorded with the payload placeholder never filled in, so those runs were never attacked. It surfaced because direct and MCP, which should behave alike, did not. The 84 affected rows were moved to [`data/invalid/`](data/invalid/), the cause fixed, a regression test added, and the same scenarios rerun. Details in [`docs/METHOD_NOTES.md`](docs/METHOD_NOTES.md).

## Reproduce

Built and tested on Python 3.13. Needs [Ollama](https://ollama.com) running, and the three models (`qwen2.5:3b`, `qwen2.5:7b`, `hermes3:8b`).

```
python -m venv .venv
.venv\Scripts\python -m pip install -r harness\requirements.txt
cd harness
..\.venv\Scripts\python -m pytest -q                      # 35 tests, no model needed
..\.venv\Scripts\python -m gauntlet.run --models qwen2.5:3b --arms direct mcp --plan both --limit 10 --out ..\data\smoke.jsonl
```

The full matrix is `scripts/resume.sh` (Git Bash) or `scripts/run_overnight.ps1`; finished run ids are skipped, so it can be stopped and resumed. Rebuild the tables and the site data with `analysis/summarize.py` and `analysis/export_site.py`, then `cd site && npm ci && npm run dev`.

## Layout

- `harness/gauntlet/` tools and vault, scenarios and attacks, the four layers, defenses, the agent loop, the resumable runner
- `data/runs.jsonl` every run, with every step; `data/invalid/` rows removed for a known bug
- `analysis/` tables and the static data the site reads
- `site/` the Vite and React site (deployed on Vercel via `vercel.json`)
- `docs/` method notes, budget, generated results, LinkedIn post drafts
