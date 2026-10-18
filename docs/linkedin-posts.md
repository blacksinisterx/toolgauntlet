# LinkedIn post drafts (every number is in data/runs.jsonl; site: https://toolgauntlet.vercel.app)

Short on purpose. Pick one, post it, post the next a few days later.

## Post 1: "MCP is dead"

"MCP is dead, just use the API." Someone told me that. It's a claim, not a benchmark, so I built one.

I ran 4,428 agent runs on local models (qwen2.5 3B and 7B, hermes3 8B). Same tasks, same tools, four ways of handing them to the model.

MCP vs plain function calling: the model reads the same thing (prompts differed by at most 0.6 tokens) and finishes the same share of everyday tasks, 73% vs 73%, from 8 up to 60 tools. MCP's cost is a protocol hop: 5.7 ms per tool call against under 1 ms.

"Just use the API" (one HTTP tool plus the docs): 33% of tasks at 8 tools, 1% at 60.

So not dead, at least not on these models. 3B to 8B only, nothing here speaks for GPT or Claude. Data and an interactive site: https://toolgauntlet.vercel.app

## Post 2: "Just give the agent the API docs"

I tested "skip the tools, just give the agent the API docs", on 3 local models.

With 8 tools' worth of docs it finished 24 of 72 everyday tasks (33%).
With 60 tools' worth: 1 of 72.
72% of its runs ended in a tool call the runtime couldn't parse.

Direct function calling stayed between 69% and 75% across the same range.

Small local models, simulated tools. But "docs instead of tools" does not scale the way it sounds like it would.

https://toolgauntlet.vercel.app

## Post 3: Prompt injection

I fired 5 kinds of prompt-injection attacks at AI agents built 4 different ways (3 small local models, 4,428 runs).

Hijacked: 16 runs. About 0.4%.
Only 8 actually leaked the secret, all from one model (hermes3 8B) reading a poisoned web page. It read the secrets file in 8 of 8 runs, under direct calling and under MCP alike.
The other 8 picked an attacker's look-alike "send_mail" tool.

Then I tried defenses on that one model. A "treat tool text as untrusted" prompt took secret-file reads from 8 of 8 to 0 of 8. A gate on the send tool stopped every leak but not the reading. Pinning tool descriptions did nothing, because the attack came in a tool result, not a description.

One thing I did not expect: the model mattered much more than the layer. Direct and MCP looked the same for the same model.

I also found a bug in my own MCP runs where the attack was never delivered. Caught it because two setups that should behave alike didn't. Fixed, reran, documented.

Small models, authored attacks, wide intervals. Play with the data: https://toolgauntlet.vercel.app
