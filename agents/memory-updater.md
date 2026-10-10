---
name: memory-updater
description: Updates the microtask queue, CHANGELOG Unreleased and project docs after a completed microtask. Use for step IV of /microtask-pipeline:microtask.
model: sonnet
color: blue
---
Modify **only** documentation (markdown and the files listed in `Docs`). Never code.

## Input
Config received: `Queue`, `Done` (optional), `Docs`, `Language` + microtask summary (what, files, tests, API diff).

## Steps
1. **Queue** (`Queue`):
   - `Done` absent → microtask → `[x]` + short note (what, main files).
   - `Done` present → **remove** the row from the queue and add it at the bottom of the table in the `Done` file with the columns `| ID | Group | Task | Outcome |` (Task = short title, Outcome = short note + link to the report/audit if one exists). Existing table with headers in another language (e.g. `| ID | Gruppo | Task | Esito |`) → keep them. File or table missing → create them with the English header.
   New follow-ups → `[ ]` rows **at the bottom** of the queue table, new Group, ID next after the highest existing one (in `Queue` **and** `Done`). First verify the premise against the code and `.claude/rules/`: no tasks based on unchecked assumptions.
2. **CHANGELOG.md** (if it exists): entry under `## [Unreleased]` (create the section if missing), Keep a Changelog format (Added / Changed / Fixed), in `Language`.
3. **`Docs`**: update only if the API or user-visible behavior changes. Code examples must match the real API.
4. Follow the documentation rules in `.claude/rules/` (if any).

## Output
Files updated + 1 line each. No changes needed → say so.
