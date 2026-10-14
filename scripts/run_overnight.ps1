# Overnight experiment batch. Resumable: stop it any time and run it again, finished runs are skipped.
# Needs: Ollama running, models pulled (qwen2.5:3b, qwen2.5:7b, hermes3:8b), and the venv set up (see STATUS.md).
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File scripts\run_overnight.ps1
$ErrorActionPreference = "Stop"
$py = Join-Path $PSScriptRoot "..\.venv\Scripts\python.exe"
Set-Location (Join-Path $PSScriptRoot "..\harness")
$models = "qwen2.5:3b", "qwen2.5:7b", "hermes3:8b"
$arms = "direct", "mcp", "code", "docs"

# E1: cost, latency and tool-selection accuracy vs number of tools (benign tasks)
& $py -m gauntlet.run --models $models --arms $arms --plan benign --n-tools 8 15 30 60 --trials 3

# E2: the heists, undefended (4 wordings per attack class)
& $py -m gauntlet.run --models $models --arms $arms --plan attack --n-tools 15 --trials 3

# E3: defenses. Two models only (hermes3 drops tool calls with the prompt defense, see docs/METHOD_NOTES.md), 2 trials.
$d = "qwen2.5:3b", "qwen2.5:7b"
& $py -m gauntlet.run --models $d --arms $arms --plan attack --n-tools 15 --trials 2 --defense pin prompt gate
& $py -m gauntlet.run --models $d --arms $arms --plan benign --n-tools 15 --trials 2 --defense pin prompt gate   # what each defense costs in utility

Write-Host "Done. Then run: .venv\Scripts\python analysis\summarize.py"
