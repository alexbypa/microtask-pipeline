---
name: init
description: "Sets up microtask-pipeline in the current project: detects build/test/folders, proposes the \"## Microtask config\" section for CLAUDE.md and creates the queue in TODO.md if missing."
disable-model-invocation: true
---
# microtask-pipeline setup

Goal: write the `## Microtask config` section in the project's `CLAUDE.md`, so the `/microtask-pipeline:microtask` skill and the hooks know how to work.

## 1. Current state
- Look for `CLAUDE.md` in the root or `.claude/CLAUDE.md`.
- `## Microtask config` section already there → show it and ask whether to update it. No → STOP.
- No `CLAUDE.md` → offer to create it (header + config section only); suggest Claude Code's `/init` for the rest.

## 2. Detect (read only)
| Key | How to detect it |
|---|---|
| `Build` | **Commands** section of CLAUDE.md; otherwise `*.slnx`/`*.sln` → `dotnet build <file> -c Release`; `package.json` → `build` script; `pyproject.toml`/`Makefile`/`Cargo.toml`/`go.mod` → the standard command |
| `Test` | **Commands** section; otherwise `*.Tests*`/`*Test*` projects → `dotnet test <solution>` if every test project is in the solution, otherwise report the excluded ones and offer to add them; `package.json` → `test` script; `pytest`, `cargo test`, `go test ./...` |
| `Coverage` | optional. .NET with `Microsoft.NET.Test.Sdk` → `<Test> --collect "Code Coverage;Format=cobertura" --results-directory TestResults/coverage` (no new package; `TestResults/` in `.gitignore`); other stacks → a command that produces Cobertura XML, otherwise omit |
| `Watch dir` | `src/` if it exists, otherwise the main code folder |
| `Docs` | `README.md`, `CHANGELOG.md`, `docs/` — only the existing ones |
| `Queue` | `TODO.md` |
| `Done` | optional: `DONE.md` if it exists, otherwise omit (completed tasks stay `[x]` in the queue) |
| `Branch` | `outcome_yyyyMMdd-<Group>` (`<Group>` stays literal: the skill replaces it with the group being run) |
| `Language` | language of the existing README/CHANGELOG; default English |
| `Social drafts` | optional: omit (default `off`); `on` only if the user wants social post drafts for features |

Verify the detected commands by running them **only if** harmless and fast (build/test); otherwise report "not verified".

## 3. Propose and confirm
Show the complete section, ready to paste:
```markdown
## Microtask config
- Queue: TODO.md
- Done: DONE.md        # optional
- Branch: outcome_yyyyMMdd-<Group>
- Build: <command>
- Test: <command>
- Coverage: <command>   # optional
- Watch dir: src
- Docs: README.md, CHANGELOG.md
- Language: English
```
**⏸ Wait for confirmation or corrections.** Then append it to the end of `CLAUDE.md` (Edit, never overwrite the file).

## 4. Queue
`Queue` file missing or without a queue table → offer to add:
```markdown
## Microtask queue

| Status | ID | Group | Type | Task |
|---|---|---|---|---|
| [ ] | T1 | G1 | code | <first task> |
```
Types: `code` `analysis` `docs` `content`. Statuses: `[ ]` `[/]` `[x]`.
**⏸ Wait for confirmation** before writing.

## 5. Wrap-up
Summarise the modified files and remind the user:
- from a roadmap to queued tasks: `/microtask-pipeline:plan <roadmap file>`;
- start the pipeline: `/microtask-pipeline:microtask` (or `/microtask-pipeline:microtask <ID>`);
- the Stop hook is now active on `Watch dir`.
