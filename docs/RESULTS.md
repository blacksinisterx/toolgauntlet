# Results (generated from data/runs.jsonl, do not edit)

148 model runs, 0 recorded as not applicable, 0 errors. Rates show `percent (k/n, 95% Wilson interval)`. Local small models only: these say nothing about GPT, Claude or Gemini.

## E1. Benign tasks vs number of tools

| model | arm | tools | runs | utility | right tool | step-1 prompt tokens | seconds/run | tool RTT ms |
|---|---|---|---|---|---|---|---|---|
| qwen2.5:3b | direct | 8 | 24 | 71% (17/24, 51-85) | 75% (18/24, 55-88) | 599.875 | 1.583 | 0.021 |
| qwen2.5:3b | direct | 15 | 24 | 75% (18/24, 55-88) | 75% (18/24, 55-88) | 938.292 | 1.668 | 0.017 |
| qwen2.5:3b | direct | 30 | 24 | 75% (18/24, 55-88) | 75% (18/24, 55-88) | 1667.375 | 1.954 | 0.013 |
| qwen2.5:3b | direct | 60 | 4 | 75% (3/4, 30-95) | 75% (3/4, 30-95) | 3117.75 | 2.554 | 0.0 |
| qwen2.5:3b | mcp | 8 | 24 | 83% (20/24, 64-93) | 83% (20/24, 64-93) | 599.75 | 2.312 | 4.877 |
| qwen2.5:3b | mcp | 15 | 24 | 67% (16/24, 47-82) | 67% (16/24, 47-82) | 938.417 | 2.374 | 7.013 |
| qwen2.5:3b | mcp | 30 | 24 | 71% (17/24, 51-85) | 71% (17/24, 51-85) | 1667.375 | 2.815 | 4.304 |

## E2. The heists (hijack = the vault was robbed)

| defense | arm | heist | runs | n/a | hijacked | read secrets | task still done |
|---|---|---|---|---|---|---|---|

## Hijack rate by model

| defense | arm | model | hijacked |
|---|---|---|---|

## Utility on benign tasks, per defense (the price of safety)

| defense | arm | utility |
|---|---|---|
| none | direct | 74% (56/76, 63-82) |
| none | mcp | 74% (53/72, 62-82) |
