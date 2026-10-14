"""Run model-written Python in a restricted subprocess. The code can do exactly one useful thing: call `tools.<name>(...)`.

Layers (no Docker needed, but this is NOT a security boundary against a determined attacker; here the model is a small local
model and every tool is simulated, so the worst realistic outcome is a wasted run):
  1. AST allow-list in the harness: no imports, no dunder names/attributes, no exec/eval/open/getattr/...
  2. a separate interpreter (-I), empty temp cwd, minimal environment
  3. restricted builtins inside the subprocess, and a hard timeout
  4. every tool call is sent back over a pipe and executed by the harness against its own World, so the subprocess never touches state

Protocol: harness writes {"code": "..."} to the child's stdin. The child writes JSON lines to stdout:
  {"call": name, "args": {...}}  -> harness replies on stdin with {"result": "..."}
  {"done": true, "output": "...", "error": null|"..."}
"""
from __future__ import annotations

import ast
import json
import os
import subprocess
import sys
import tempfile
import threading

FORBIDDEN_CALLS = {"exec", "eval", "compile", "open", "getattr", "setattr", "delattr", "globals", "locals", "vars", "input",
                   "breakpoint", "__import__", "memoryview", "type", "super", "help", "dir"}
TIMEOUT_S = 10
MAX_OUT = 2000


def check_code(code: str) -> str | None:
    """Return a reason the code is rejected, or None if it passes the allow-list."""
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return f"syntax error: {e.msg} (line {e.lineno})"
    for n in ast.walk(tree):
        if isinstance(n, (ast.Import, ast.ImportFrom)):
            return "imports are not allowed; json, math and re are already available"
        if isinstance(n, ast.Name) and (n.id.startswith("__") or n.id in FORBIDDEN_CALLS):
            return f"'{n.id}' is not allowed"
        if isinstance(n, ast.Attribute) and n.attr.startswith("_"):
            return "attributes starting with an underscore are not allowed"
        if isinstance(n, (ast.Global, ast.Nonlocal)):
            return "global/nonlocal are not allowed"
    return None


CHILD = r'''
import sys, json, math, re
import builtins as _B
SAFE = {k: getattr(_B, k) for k in (
    "print len range int float str bool list dict set tuple sum min max sorted enumerate zip abs round any all isinstance "
    "map filter reversed repr Exception ValueError KeyError TypeError IndexError StopIteration True False None").split()}
_out = []
def _print(*a, **k): _out.append(" ".join(str(x) for x in a))
SAFE["print"] = _print
def _call(name):
    def f(*pos, **kw):
        if pos: raise TypeError("use keyword arguments, e.g. tools.%s(city='Paris')" % name)
        sys.__stdout__.write(json.dumps({"call": name, "args": kw}) + "\n"); sys.__stdout__.flush()
        return json.loads(sys.stdin.readline())["result"]
    return f
class Tools:
    def __getattr__(self, name):
        if name.startswith("_"): raise AttributeError(name)
        return _call(name)
req = json.loads(sys.stdin.readline())
err = None
try:
    exec(compile(req["code"], "<agent>", "exec"), {"__builtins__": SAFE, "tools": Tools(), "json": json, "math": math, "re": re})
except BaseException as e:
    err = type(e).__name__ + ": " + str(e)[:200]
sys.__stdout__.write(json.dumps({"done": True, "output": "\n".join(_out), "error": err}) + "\n"); sys.__stdout__.flush()
'''


def run(code: str, dispatch) -> str:
    """Execute `code`; `dispatch(name, args) -> str` performs the tool calls. Returns what the agent sees."""
    bad = check_code(code)
    if bad:
        return f"rejected: {bad}"
    cwd = tempfile.mkdtemp(prefix="gauntlet-sbx-")
    env = {k: v for k, v in os.environ.items() if k in ("SYSTEMROOT", "PATH", "TEMP", "TMP")}
    p = subprocess.Popen([sys.executable, "-I", "-c", CHILD], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                         cwd=cwd, env=env, text=True, bufsize=1)
    timer = threading.Timer(TIMEOUT_S, p.kill)
    timer.start()
    try:
        p.stdin.write(json.dumps({"code": code}) + "\n"); p.stdin.flush()
        while True:
            line = p.stdout.readline()
            if not line:
                return "error: the program was stopped (timeout or crash)"
            msg = json.loads(line)
            if msg.get("done"):
                out = (msg["output"] or "")[:MAX_OUT]
                return out + (f"\n[error: {msg['error']}]" if msg["error"] else "") or "(no output: use print())"
            p.stdin.write(json.dumps({"result": dispatch(msg["call"], msg.get("args") or {})}) + "\n"); p.stdin.flush()
    except (BrokenPipeError, ValueError):
        return "error: the program was stopped (timeout or crash)"
    finally:
        timer.cancel()
        p.kill()
