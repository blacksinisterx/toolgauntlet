# Phase 0 result: what runs, how fast, and the frozen budget

All numbers are measured on this machine (RTX 3050 Laptop 4 GB, 32 GB RAM, Ollama 0.15.6), not estimated. Raw probe: `data/probe.json`.

## Which models can do native tool calling
Probe: 3 prompts, two tools, temperature 0 (`harness/gauntlet/probe.py`).

| Model | Native tool calls | Right tool | Valid args | Warm call (short prompt) | Generation |
|---|---|---|---|---|---|
| qwen2.5:7b | 3/3 | 3/3 | 3/3 | 5.4 s | 8.9 tok/s |
| hermes3:8b | 3/3 | 3/3 | 3/3 | 5.7 s | 8.6 tok/s |
| mistral:7b | 3/3 | 3/3 | 3/3 | 12.3 s | 8.9 tok/s |
| qwen2.5:3b | works end to end in the harness | | | | fits fully on the GPU |
| llama3:8b | excluded: the original llama3 template has no tool support | | | | |

## Whole-run time in the harness (agent loop, 2 model calls, MCP over real stdio)

| Model | Tools shown | Prompt tokens (whole run, 2 model calls) | Seconds per run |
|---|---|---|---|
| qwen2.5:3b | 8 | ~1,250 | ~2.5 |
| qwen2.5:7b | 8 | ~1,250 | ~7 to 9 |
| qwen2.5:7b | 60 | ~6,300 | ~11 |
| hermes3:8b | 30 | ~3,400 | ~6 to 20 (first call loads the model) |

Tool-schema cost is about 48 prompt tokens per tool: step-1 prompts measured in E1 were about 600 tokens at 8 tools and about 3,100 at 60 (the whole-run totals above count two model calls). An earlier version of this file said 100 per tool; that mixed up a two-call total with a single prompt. MCP round-trip per tool call: about 4 to 6 ms. Direct in-process call: well under 1 ms.

## Frozen budget
Earlier estimate was 20 to 40 s per run; reality is 2.5 to 11 s, so the full plan fits easily.

| Experiment | Matrix | Runs | Estimated time |
|---|---|---|---|
| E1 cost / accuracy vs tool count | 8 tasks x 4 arms x 3 models x n in {8,15,30,60} x 3 trials | 1,152 | about 3 h (code arm is slowest) |
| E2 heists, undefended | 32 scenarios (4 wordings per class) x 4 arms x 3 models x 3 trials, minus n/a | about 1,000 | about 2.5 h |
| E3 defenses | attacks + benign, 2 models (3B, 7B), 2 trials, 3 defenses, 4 arms | about 1,900 | about 3 h |

About 4,000 runs, about 8 to 9 hours: one night. Use `scripts/run_overnight.ps1`; the runner is resumable and skips finished run ids. `direct` and `mcp` for E1/E2 were started first and are the first to finish.

## Method notes
- Trials differ by seed: tool order, the per-run canary string and the Ollama sampling seed change; temperature is 0. So repeated trials measure sensitivity to layout, not sampling noise.
- A random id is put first in every system prompt so Ollama's prompt cache cannot hide token costs across runs.
- `n/a` runs are recorded without spending a model call: description-class attacks cannot reach the model in the direct arm, because there the developer writes the descriptions. This is a finding about the architecture, and the results page must say so.
