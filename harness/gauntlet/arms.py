"""How the agent gets its tools. Same tools, same World; only the access layer differs.

  direct  - schemas hard-coded in the app, called in-process.            (descriptions are written by the developer)
  mcp     - a real MCP server over stdio: tools/list + tools/call.        (descriptions are supplied by the server)
  code    - TODO: agent writes Python against a typed module in a Docker sandbox.
  docs    - TODO: one http_request tool plus API documentation text.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import time
from contextlib import AsyncExitStack

from .scenarios import Scenario

ARMS = ("direct", "mcp")   # implemented so far; see STATUS.md for code/docs


def ollama_tool(s: dict) -> dict:
    return {"type": "function", "function": {"name": s["name"], "description": s["description"], "parameters": s["parameters"]}}


class DirectArm:
    name = "direct"

    async def start(self, scn: Scenario):
        self.scn = scn
        # developer-authored descriptions: third-party description text never reaches the model in this arm
        self.specs = [s for s in scn.specs if s["name"] not in scn.third_party]
        self.tools = [ollama_tool(s) for s in self.specs]

    async def call(self, name: str, args: dict) -> tuple[str, float]:
        t0 = time.perf_counter()
        out = self.scn.world.dispatch(name, args)
        return out, time.perf_counter() - t0

    async def stop(self):
        pass


class McpArm:
    name = "mcp"

    async def start(self, scn: Scenario):
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        self.scn = scn
        self._tmp = tempfile.mkdtemp(prefix="gauntlet-")
        cfg_path, self.state_path = os.path.join(self._tmp, "scenario.json"), os.path.join(self._tmp, "state.json")
        with open(cfg_path, "w", encoding="utf8") as f:
            json.dump({"seed": scn.seed, "specs": scn.specs, "web_patch": scn.attack.web_patch if scn.attack else {}}, f)
        params = StdioServerParameters(command=sys.executable, args=["-m", "gauntlet.mcp_server"],
                                       env={**os.environ, "GAUNTLET_SCENARIO": cfg_path, "GAUNTLET_STATE": self.state_path})
        self._stack = AsyncExitStack()
        read, write = await self._stack.enter_async_context(stdio_client(params))
        self.session = await self._stack.enter_async_context(ClientSession(read, write))
        await self.session.initialize()
        listed = await self.session.list_tools()
        self.tools = [ollama_tool({"name": t.name, "description": t.description or "", "parameters": t.inputSchema}) for t in listed.tools]

    async def call(self, name: str, args: dict) -> tuple[str, float]:
        t0 = time.perf_counter()
        res = await self.session.call_tool(name, args)
        rtt = time.perf_counter() - t0
        return "".join(c.text for c in res.content if getattr(c, "type", "") == "text"), rtt

    async def stop(self):
        await self._stack.aclose()
        try:  # the server process holds the real World; copy its final state back so the run can be graded
            st = json.load(open(self.state_path, encoding="utf8"))
            self.scn.world.outbox, self.scn.world.calls = st["outbox"], [tuple(c) for c in st["calls"]]
        except FileNotFoundError:
            pass  # the model never called a tool


def make_arm(name: str):
    if name == "direct":
        return DirectArm()
    if name == "mcp":
        return McpArm()
    raise NotImplementedError(f"arm '{name}' is not built yet (see STATUS.md)")
