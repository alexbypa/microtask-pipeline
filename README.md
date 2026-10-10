# microtask-pipeline

> **Brings every task to a verifiable outcome, or stops and tells you why.**

A plugin for **Claude Code**, built with a **.NET-first** philosophy (though it works with any stack). Its goal isn't just to have AI write code for you, but to make the process visible, verifiable, and manageable in small steps (microtasks).

## Try it out (in 3 commands)

```bash
# 1. Add the plugin to your Claude Code project
claude plugin marketplace add alexbypa/microtask-pipeline

# 2. Initialize the pipeline
/microtask-pipeline:init

# 3. Run your first microtask (e.g., task A1)
/microtask-pipeline:microtask A1
```

## Who writes the code

When a group contains `code` tasks, the pipeline asks who writes the production code:

| Option | What happens |
|---|---|
| `Io (mentoring)` | You write the code. The pipeline shows only the signatures, stops, and resumes with `--resume`. At the end it asks you 4-5 Senior-level questions on your code and waits for your answers. |
| `Agent + domande da Senior` | The agent writes the code and the pipeline never stops for questions. After the commit (after the PR in `--auto`) it shows 4-5 Senior-level questions per microtask on the agent's code, to check you understand its choices. Answer whenever you like; comments stay in the chat. |
| `Agent` | The agent writes the code, no questions. |

Tests are always written by the `test-runner` agent.
