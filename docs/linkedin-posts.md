# LinkedIn post drafts (every number is in data/runs.jsonl; site: https://toolgauntlet.vercel.app)

Short on purpose. Pick one, post it, post the next a few days later.

## Post 1: MCP vs plain function calling

I measured MCP against plain function calling, on local models (qwen2.5 3B and 7B, hermes3 8B). Same agent, same tasks, same tools.

What the model reads: identical. Across 12 model and size combinations the prompts differed by at most 0.6 tokens.
How many everyday tasks it finished: 73% for both (210 of 288 vs 209 of 288), from 8 up to 60 tools.
What MCP actually costs: time. 5.7 ms per tool call against under 1 ms, and about 0.7 s more per run on the 3B model.

So the MCP argument is not about tokens or accuracy. It's about whether you want a protocol.

3B to 8B models only, nothing here speaks for GPT or Claude. Data and an interactive site: https://toolgauntlet.vercel.app

## Post 2: "Just give the agent the API docs"

I tested "skip the tools, just give the agent the API docs", on 3 local models.

With 8 tools' worth of docs it finished 24 of 72 everyday tasks (33%).
With 60 tools' worth: 1 of 72.
72% of its runs ended in a tool call the runtime couldn't parse.

Direct function calling stayed between 69% and 75% across the same range.

Small local models, simulated tools. But "docs instead of tools" does not scale the way it sounds like it would.

https://toolgauntlet.vercel.app

## Post 3: Prompt injection

I fired 5 kinds of prompt-injection attacks at AI agents built 4 different ways (3 small local models, 3,636 runs).

Hijacked: 10 runs. About 0.3%.
Only 4 actually leaked the secret, all from one model (hermes3 8B) reading a poisoned web page. It read the secrets file in 8 of 12 runs, under direct calling and under MCP alike.
The other 6 picked an attacker's look-alike "send_mail" tool.

One thing I did not expect: the model mattered much more than the layer. Direct and MCP looked the same for the same model.

I also found a bug in my own MCP runs where the attack was never delivered. Caught it because two setups that should behave alike didn't. Fixed, reran, documented.

Small models, authored attacks, wide intervals. Play with the data: https://toolgauntlet.vercel.app
