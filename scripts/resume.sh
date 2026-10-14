#!/usr/bin/env bash
# Resume the experiments (Git Bash). Safe to stop and re-run: finished run ids are skipped.
# Phase A uses only qwen2.5:7b (pulled already); phase B starts when qwen2.5:3b and hermes3:8b are available.
cd "$(dirname "$0")/../harness"
PY=../.venv/Scripts/python
ARMS="direct mcp code docs"

# A: the 7B model, everything that does not need the other models
$PY -m gauntlet.run --models qwen2.5:7b --arms $ARMS --plan attack --n-tools 15 --trials 3
$PY -m gauntlet.run --models qwen2.5:7b --arms code docs --plan benign --n-tools 8 15 30 60 --trials 3

# B: wait for the other models, then everything else (same matrix as run_overnight.ps1)
until ollama list | grep -q "hermes3:8b" && ollama list | grep -q "qwen2.5:3b"; do echo "waiting for model downloads..."; sleep 30; done
MODELS="qwen2.5:3b qwen2.5:7b hermes3:8b"
$PY -m gauntlet.run --models $MODELS --arms $ARMS --plan benign --n-tools 8 15 30 60 --trials 3
$PY -m gauntlet.run --models $MODELS --arms $ARMS --plan attack --n-tools 15 --trials 3
D="qwen2.5:3b qwen2.5:7b"
$PY -m gauntlet.run --models $D --arms $ARMS --plan attack --n-tools 15 --trials 2 --defense pin prompt gate
$PY -m gauntlet.run --models $D --arms $ARMS --plan benign --n-tools 15 --trials 2 --defense pin prompt gate
echo "ALL DONE"
