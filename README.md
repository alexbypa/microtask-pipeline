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
