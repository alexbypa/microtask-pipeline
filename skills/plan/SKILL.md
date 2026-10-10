---
name: plan
description: "Turns a roadmap document into microtask queue rows (Queue in CLAUDE.md): proposes groups, IDs, types and tasks with a reference to the source section, waits for approval, then appends them to the queue."
disable-model-invocation: true
argument-hint: "<roadmap file> [--prefix R]"
---
# Roadmap → microtask queue

This skill **only writes the queue**: it runs no task (that is `/microtask-pipeline:microtask`'s job) and touches no code.

## Arguments
- `<roadmap file>` (required): any markdown file (plan, spec, bullet list). Missing or unreadable → say so and stop.
- `--prefix <letter>` (optional): letter for the IDs, e.g. `R` → tasks `R0`, `R1`… and groups `RG0`, `RG1`…. Missing → the first uppercase letter not used as the initial of any ID in `Queue` and `Done`; groups `G<n>` from the first free number.

## 1. Config
Read `## Microtask config` in the project's `CLAUDE.md` (`Queue`, default `TODO.md`; `Done`, optional). Section missing → STOP: "run `/microtask-pipeline:init` first".

## 2. Existing IDs and groups
Collect every ID (ID column) and group (Group column) already in `Queue` **and** `Done`. New ones must not overlap with each other or with existing ones, and **no new ID may equal a group name** (the pipeline looks up its argument in both columns). `--prefix` already in use → continue numbering from the highest existing one with that letter.

## 3. Reading
Read **only** the roadmap file, once. No code, no other documents, except a link in the document that is needed to understand a task's scope.

## 4. Breakdown
- **One group per increment or phase** of the document (one group = one pipeline commit). Document without phases → groups of 3-6 related tasks.
- **One microtask per contract or layer**: never two projects in the same task, never two repositories.
- **Type**: `analysis` for decisions or open points, `code` for code and tests, `docs` for documentation, `content` for drafts.
- **Open decisions first**: if the document has open points or questions, the first group is an `analysis` task that settles them.
- **Task**: one line, imperative verb, then the section reference: `→ <file path>#<heading slug>`. This way the pipeline, when running the task, reads only that section. GitHub-style slug (lowercase, spaces → `-`, punctuation removed).
- **Order**: the document's order (the pipeline takes the first `[ ]` from the top). An explicit dependency that contradicts it → follow the dependency and note it.
- Task language: the conversation's language.

## 5. Notes (before the table)
- **Too big**: tasks that touch several layers or projects, with the proposed split (already applied in the table).
- **Other repository**: tasks that belong to a repo other than the current one. They do **not** go in the table: list them with the suggestion to run `plan` in that repo.
- **Not converted**: parts of the document that did not become tasks (context, decisions already made, out-of-scope points), one line each, so it is clear nothing went missing.

## 6. ⏸ GATE
Show, in the conversation's language:
1. the notes;
2. the proposed table, in the queue format:
   ```markdown
   | Status | ID | Group | Type | Task |
   |---|---|---|---|---|
   | [ ] | R0 | RG0 | analysis | Decide the open points in an ADR → docs/plan.md#open-points |
   ```
3. the summary: number of groups, tasks per type, target queue file.

Then **a single** `AskUserQuestion`: "Add these tasks to `<Queue>`?" → `Add` / `Edit` / `Cancel`.
- `Edit` → ask what to change, apply it, show the table and the question again.
- `Cancel` → STOP, nothing written.

## 7. Writing
Only after `Add`:
- rows **at the end** of the existing queue table, with Edit (never rewrite the file, never reorder existing rows);
- no table → create it at the end of the file under `## Microtask queue` with the header `| Status | ID | Group | Type | Task |`; existing table with headers in another language → keep them;
- `Queue` file missing → create it with that section only.
Re-read the file and check that the pre-existing rows are unchanged.

## 8. Wrap-up
One line with the command to start: `/microtask-pipeline:microtask <first added group> --manual`. No commit: the queue goes into the commit of the first group that runs.
