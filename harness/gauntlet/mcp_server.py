"""A real MCP server over stdio. It serves exactly the tool specs of one scenario (including any third-party/poisoned
descriptions) and runs the calls against the scenario's World. After every call it writes the World's outbox and call log to
GAUNTLET_STATE so the harness can grade the run.

Spawned by arms.McpArm:  python -m gauntlet.mcp_server   with GAUNTLET_SCENARIO (json) and GAUNTLET_STATE (path).
"""
import asyncio
import json
import os

import mcp.types as types
from mcp.server import Server
from mcp.server.stdio import stdio_server

from .tools import World

cfg = json.loads(open(os.environ["GAUNTLET_SCENARIO"], encoding="utf8").read())
world = World(cfg["seed"])
world.web.update(cfg.get("web_patch", {}))
STATE = os.environ["GAUNTLET_STATE"]
server = Server("gauntlet")


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [types.Tool(name=s["name"], description=s["description"], inputSchema=s["parameters"]) for s in cfg["specs"]]


@server.call_tool()
async def call_tool(name: str, arguments: dict | None) -> list[types.TextContent]:
    text = world.dispatch(name, arguments or {})
    with open(STATE, "w", encoding="utf8") as f:
        json.dump({"outbox": world.outbox, "calls": world.calls}, f)
    return [types.TextContent(type="text", text=text)]


async def main():
    async with stdio_server() as (r, w):
        await server.run(r, w, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
