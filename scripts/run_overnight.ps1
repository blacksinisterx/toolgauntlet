# Overnight experiment batch. Resumable: stop it any time and run it again, finished runs are skipped.
# Needs: Ollama running, models pulled (qwen2.5:3b, qwen2.5:7b, hermes3:8b), and the venv set up (see STATUS.md).
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File scripts\run_overnight.ps1
$ErrorActionPreference = "Stop"
$py = Join-Path $PSScriptRoot "..\.venv\Scripts\python.exe"
Set-Location (Join-Path $PSScriptRoot "..\harness")
$models = "qwen2.5:3b", "qwen2.5:7b", "hermes3:8b"

# E1: cost, latency and tool-selection accuracy vs number of tools (benign tasks only)
& $py -m gauntlet.run --models $models --arms direct mcp --plan benign --n-tools 8 15 30 60 --trials 3

# E2: the heists, undefended (4 wordings per attack class)
& $py -m gauntlet.run --models $models --arms direct mcp --plan attack --n-tools 15 --trials 3

Write-Host "Done. Results: data\runs.jsonl"
